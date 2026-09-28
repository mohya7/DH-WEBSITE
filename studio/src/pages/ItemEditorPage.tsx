import { Button, Checkbox, Drawer, Input, Modal, Select, Space, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { jsonInit, request, type Problem } from "../api/http";
import { FormWalker } from "../content/FormWalker";
import { MediaPicker, type MediaChoice } from "../content/MediaPicker";
import { inlineMarksAllowed, labelFromKey, publicPath, routeFor, type CollectionName } from "../content/model";
import { useSchemas } from "../content/schemas";
import { StatusChip } from "../ui/StatusChip";

type SectionDraft = {
  id?: string;
  type: string;
  visible: boolean;
  fields: Record<string, unknown>;
};

type ItemBody = {
  id: string;
  status: string;
  state: string;
  version: number;
  notice: string | null;
  hasWorkingCopy: boolean;
  endedAt: string | null;
  content: {
    slug: string;
    title: string;
    metaTitle: string | null;
    metaDescription: string | null;
    shareImageId: string | null;
    shareImageAltOverride: string | null;
    canonicalOverride: string | null;
    noIndex: boolean;
    sortOrder: number;
    fields: Record<string, unknown>;
    sections: Array<SectionDraft & { id: string }> | null;
  };
  live: { slug: string; title: string } | null;
  warnings?: Record<string, string[]>;
};

type Revision = { id: string; version: number; publishedAt: string };

export function ItemEditorPage({ collection }: { collection: CollectionName }) {
  const { id = "" } = useParams();
  const route = routeFor(collection);
  const navigate = useNavigate();
  const auth = useAuth();
  const schemas = useSchemas();
  const [item, setItem] = useState<ItemBody | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [shareImageId, setShareImageId] = useState<string | null>(null);
  const [shareAlt, setShareAlt] = useState("");
  const [canonical, setCanonical] = useState("");
  const [noIndex, setNoIndex] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [sections, setSections] = useState<SectionDraft[]>([]);
  const [openSection, setOpenSection] = useState<number | null>(null);
  const [saved, setSaved] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [conflict, setConflict] = useState(false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [snapshotText, setSnapshotText] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const snapshot = useMemo(() => JSON.stringify(payloadOf()), [title, slug, metaTitle, metaDescription, shareImageId, shareAlt, canonical, noIndex, sortOrder, fields, sections]);
  const dirty = item !== null && snapshot !== saved;
  const blocker = useBlocker(dirty);

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function payloadOf() {
    return {
      slug,
      title,
      metaTitle: empty(metaTitle),
      metaDescription: empty(metaDescription),
      shareImageId,
      shareImageAltOverride: empty(shareAlt),
      canonicalOverride: empty(canonical),
      noIndex,
      sortOrder,
      fields,
      sections: route.sections ? sections.map((section) => ({
        ...(section.id === undefined ? {} : { id: section.id }),
        type: section.type,
        visible: section.visible,
        fields: section.fields,
      })) : undefined,
    };
  }

  function apply(body: ItemBody) {
    setItem(body);
    setTitle(body.content.title);
    setSlug(body.content.slug);
    setMetaTitle(body.content.metaTitle ?? "");
    setMetaDescription(body.content.metaDescription ?? "");
    setShareImageId(body.content.shareImageId);
    setShareAlt(body.content.shareImageAltOverride ?? "");
    setCanonical(body.content.canonicalOverride ?? "");
    setNoIndex(body.content.noIndex);
    setSortOrder(body.content.sortOrder);
    setFields(body.content.fields ?? {});
    setSections((body.content.sections ?? []).map((section) => ({
      id: section.id,
      type: section.type,
      visible: section.visible,
      fields: section.fields ?? {},
    })));
    setSaved(JSON.stringify({
      slug: body.content.slug,
      title: body.content.title,
      metaTitle: body.content.metaTitle,
      metaDescription: body.content.metaDescription,
      shareImageId: body.content.shareImageId,
      shareImageAltOverride: body.content.shareImageAltOverride,
      canonicalOverride: body.content.canonicalOverride,
      noIndex: body.content.noIndex,
      sortOrder: body.content.sortOrder,
      fields: body.content.fields ?? {},
      sections: route.sections ? (body.content.sections ?? []).map((section) => ({
        id: section.id,
        type: section.type,
        visible: section.visible,
        fields: section.fields ?? {},
      })) : undefined,
    }));
    if (body.warnings !== undefined && Object.keys(body.warnings).length > 0) {
      setProblem({ warnings: body.warnings, title: "Published, with warnings." });
    }
  }

  async function load() {
    const result = await request(`/api/v1/${collection}/${id}`);
    if (!result.ok || result.body === null) {
      setMessage(result.problem?.title ?? "The item could not be opened.");
      return;
    }
    apply(result.body as ItemBody);
  }

  async function save() {
    if (item === null) return;
    const result = await request(`/api/v1/${collection}/${id}/save`, jsonInit("PUT", { version: item.version, ...payloadOf() }));
    if (result.status === 409) {
      setConflict(true);
      return;
    }
    if (!result.ok || result.body === null) {
      setProblem(result.problem);
      return;
    }
    setProblem(null);
    apply(result.body as ItemBody);
    setMessage("Saved.");
  }

  async function publish() {
    if (item === null) return;
    const result = await request(`/api/v1/${collection}/${id}/publish`, jsonInit("POST", { version: item.version }));
    if (result.status === 409) {
      setConflict(true);
      return;
    }
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    apply(result.body as ItemBody);
    setMessage("Published. Changes appear on the website at the next build.");
  }

  async function act(path: string, okMessage: string) {
    if (item === null) return;
    const result = await request(path, jsonInit("POST", { version: item.version }));
    if (result.status === 409) {
      setConflict(true);
      return;
    }
    if (!result.ok || result.body === null) {
      setProblem(result.problem);
      return;
    }
    apply(result.body as ItemBody);
    setMessage(okMessage);
  }

  async function remove() {
    if (item === null) return;
    const result = await request(`/api/v1/${collection}/${id}?version=${item.version}`, { method: "DELETE" });
    if (!result.ok && result.status !== 204) {
      setMessage(result.problem?.title ?? "The item was not deleted.");
      return;
    }
    navigate(`/${route.path}`);
  }

  function moveSection(index: number, target: number) {
    if (target < 0 || target >= sections.length) return;
    const next = sections.slice();
    const [row] = next.splice(index, 1);
    if (row === undefined) return;
    next.splice(target, 0, row);
    setSections(next);
  }

  function focusField(key: string) {
    const match = /^sections\[(\d+)\]/.exec(key);
    if (match?.[1] !== undefined) {
      setOpenSection(Number(match[1]));
    } else if (key === "references" || key === "links") {
      const needle = key === "links" ? '"href"' : '"reference"';
      const index = sections.findIndex((section) => JSON.stringify(section.fields).includes(needle));
      setOpenSection(index >= 0 ? index : 0);
    }
    window.setTimeout(() => {
      const node = document.querySelector(`[data-field="${cssEscape(key)}"]`)
      ?? document.querySelector(`[data-check="${cssEscape(key)}"]`);
      node?.scrollIntoView({ block: "center" });
      const input = node?.querySelector("input, textarea, select");
      if (input instanceof HTMLElement) input.focus();
    }, key === "references" || key === "links" || match !== null ? 50 : 0);
  }

  const livePath = item?.live === null || item?.live === undefined ? null : publicPath(collection, item.live.slug);
  const nextPath = publicPath(collection, slug);
  const redirect = item?.status === "published" && livePath !== null && nextPath !== null && livePath !== nextPath
    ? `Publishing will redirect ${livePath} to ${nextPath}. Saving does not create it.`
    : null;
  const collectionSchema = schemas.data?.collections[collection];

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" className="back-link" onClick={() => navigate(`/${route.path}`)}>← {route.label}</button>
          <span className="page-kicker">{item === null ? "NEW CONTENT" : "EDIT CONTENT"}</span>
          <Typography.Title level={2} className="!mb-1">{title || route.label}</Typography.Title>
          {item !== null ? <StatusChip state={item.state} /> : null}
          {item?.notice !== null && item?.notice !== undefined ? <Typography.Paragraph className="!mb-0">{item.notice}</Typography.Paragraph> : null}
          {item?.state === "changed" ? <Typography.Paragraph className="!mb-0">These edits are not on the website yet.</Typography.Paragraph> : null}
          {item?.endedAt !== null && item?.endedAt !== undefined ? <Typography.Paragraph>Ended {item.endedAt}. Publish brings this vacancy back and clears the end date.</Typography.Paragraph> : null}
        </div>
        <Space wrap>
          <Button type="primary" onClick={() => void save()} disabled={!dirty}>Save content</Button>
          <Button onClick={() => void publish()} disabled={dirty || item === null}>Publish</Button>
          {item?.status === "published" ? <Button onClick={() => void act(`/api/v1/${collection}/${id}/unpublish`, "Unpublished.")}>Unpublish</Button> : null}
          {item?.hasWorkingCopy ? <Button onClick={() => void act(`/api/v1/${collection}/${id}/discard`, "Draft discarded.")}>Discard draft</Button> : null}
          {collection === "vacancies" && item?.status === "published" ? <Button onClick={() => void act(`/api/v1/vacancies/${id}/end`, "Vacancy ended.")}>End</Button> : null}
          <Button onClick={() => void openRevisions()}>Revisions</Button>
          {auth.user?.role === "admin" && item?.status !== "published" ? <Button danger onClick={() => void remove()}>Delete</Button> : null}
        </Space>
      </div>
      {dirty ? <Typography.Paragraph>Save before publishing, so the check runs on what is on screen.</Typography.Paragraph> : null}
      {redirect !== null ? <Typography.Paragraph>{redirect}</Typography.Paragraph> : null}
      {message !== null ? <Typography.Paragraph>{message}</Typography.Paragraph> : null}
      <Findings problem={problem} onJump={focusField} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <label data-field="title">Title<Input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label data-field="slug">
            Address
            <Input value={slug} onChange={(event) => setSlug(event.target.value)} />
          </label>
          {collectionSchema !== undefined && schemas.data !== undefined ? (
            <FormWalker schema={collectionSchema} catalog={schemas.data} value={fields} onChange={setFields} fieldPath="" />
          ) : null}
          {route.sections ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <Typography.Title level={4} className="!mb-0">Sections</Typography.Title>
                <Select
                  placeholder="Add section"
                  style={{ width: 220 }}
                  value={undefined}
                  showSearch
                  virtual={false}
                  optionFilterProp="label"
                  options={Object.keys(schemas.data?.sections ?? {}).map((type) => ({ value: type, label: labelFromKey(type) }))}
                  onChange={(type) => {
                    if (type === undefined) return;
                    setSections([...sections, { type, visible: true, fields: {} }]);
                    setOpenSection(sections.length);
                  }}
                />
              </div>
              <Typography.Paragraph type="secondary">Move up and Move down reorder the sections now. The new order is saved with the item.</Typography.Paragraph>
              <div className="flex flex-col gap-3">
                {sections.map((section, index) => (
                  <article
                    key={section.id ?? `new-${index}`}
                    data-field={`sections[${index}]`}
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragIndex === null) return;
                      moveSection(dragIndex, index);
                      setDragIndex(null);
                    }}
                    className="section-card"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <strong>{labelFromKey(section.type)}{section.visible ? "" : " · Hidden"}</strong>
                      <Space wrap>
                        <Button onClick={() => moveSection(index, index - 1)} disabled={index === 0}>Move up</Button>
                        <Button onClick={() => moveSection(index, index + 1)} disabled={index === sections.length - 1}>Move down</Button>
                        <Button onClick={() => setSections(sections.map((entry, entryIndex) => entryIndex === index ? { ...entry, visible: !entry.visible } : entry))}>{section.visible ? "Hide" : "Show"}</Button>
                        <Button onClick={() => setOpenSection(openSection === index ? null : index)}>{openSection === index ? "Close" : "Edit"}</Button>
                        <Button onClick={() => setSections(sections.filter((_, entryIndex) => entryIndex !== index))}>Remove</Button>
                      </Space>
                    </div>
                    {openSection === index && schemas.data !== undefined && schemas.data.sections[section.type] !== undefined ? (
                      <FormWalker
                        schema={schemas.data.sections[section.type]}
                        catalog={schemas.data}
                        value={section.fields}
                        onChange={(next) => setSections(sections.map((entry, entryIndex) => entryIndex === index ? { ...entry, fields: next } : entry))}
                        fieldPath={`sections[${index}]`}
                        inlineTextMarks={(field) => inlineMarksAllowed(collection, section.type, field)}
                      />
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <aside className="section-card">
          <Typography.Title level={4}>Search result</Typography.Title>
          {nextPath === null ? <Typography.Paragraph>This item has no public page.</Typography.Paragraph> : (
            <div className="seo-preview mb-4">
              <div className="text-lg" style={{ color: "#7fd0f6" }}>{shown(metaTitle, title) || "Untitled"}</div>
              <div className="text-sm text-[#006621]">{nextPath}</div>
              <div className="text-sm" style={{ color: "var(--dh-text-secondary)" }}>{shown(metaDescription, textField(fields.summary))}</div>
            </div>
          )}
          <label className="mb-3 block" data-field="metaTitle">
            Meta title
            <Input value={metaTitle} maxLength={300} onChange={(event) => setMetaTitle(event.target.value)} />
            <Count value={shown(metaTitle, title)} guide={60} limit={300} />
          </label>
          <label className="mb-3 block" data-field="metaDescription">
            Meta description
            <Input.TextArea rows={4} value={metaDescription} maxLength={500} onChange={(event) => setMetaDescription(event.target.value)} />
            <Count value={shown(metaDescription, textField(fields.summary))} guide={160} limit={500} />
          </label>
          <div className="mb-3" data-field="shareImage">
            <div className="mb-1 text-sm">Share image</div>
            <Space>
              <Button onClick={() => setPicker(true)}>{shareImageId === null ? "Choose image" : "Change image"}</Button>
              <Button onClick={() => setShareImageId(null)}>Clear</Button>
            </Space>
            <Input className="mt-2" placeholder="Alt text" value={shareAlt} onChange={(event) => setShareAlt(event.target.value)} />
          </div>
          <label className="mb-3 block" data-field="canonicalOverride">
            Canonical address
            <Input value={canonical} onChange={(event) => setCanonical(event.target.value)} />
          </label>
          <Checkbox checked={noIndex} onChange={(event) => setNoIndex(event.target.checked)}>Hide from search</Checkbox>
        </aside>
      </div>
      <MediaPicker open={picker} onClose={() => setPicker(false)} onSelect={(choice: MediaChoice) => { setShareImageId(choice.id); if (shareAlt.length === 0) setShareAlt(choice.alt); setPicker(false); }} />
      <Modal
        title="Someone else changed this item."
        open={conflict}
        onCancel={() => setConflict(false)}
        footer={[
          <Button key="keep" onClick={() => setConflict(false)}>Keep editing</Button>,
          <Button key="reload" type="primary" onClick={() => { setConflict(false); void load(); }}>Reload</Button>,
        ]}
      >
        <p>Reload replaces this form with the saved item. Keep editing leaves your changes on screen and writes nothing.</p>
      </Modal>
      <Modal
        title="Leave without saving?"
        open={blocker.state === "blocked"}
        onCancel={() => blocker.reset?.()}
        onOk={() => blocker.proceed?.()}
        okText="Leave"
        cancelText="Stay"
      >
        <p>This form has unsaved changes.</p>
      </Modal>
      <Drawer title="Revisions" open={revisionsOpen} onClose={() => { setRevisionsOpen(false); setSnapshotText(null); }}>
        <Typography.Paragraph>Restore writes a draft. It does not publish.</Typography.Paragraph>
        {snapshotText !== null ? <pre className="seo-preview mb-4 max-h-48 overflow-auto text-xs">{snapshotText}</pre> : null}
        {revisions.map((revision) => (
          <div key={revision.id} className="mb-3 flex items-center justify-between gap-2">
            <span>Version {revision.version}</span>
            <Space>
              <Button onClick={() => void viewRevision(revision.id)}>View</Button>
              <Button onClick={() => { if (dirty) setPendingRestore(revision.id); else void restore(revision.id); }}>Restore</Button>
            </Space>
          </div>
        ))}
      </Drawer>
      <Modal
        title="Restore over unsaved edits?"
        open={pendingRestore !== null}
        onCancel={() => setPendingRestore(null)}
        onOk={() => {
          const revisionId = pendingRestore;
          setPendingRestore(null);
          if (revisionId !== null) void restore(revisionId);
        }}
        okText="Restore"
        cancelText="Keep editing"
      >
        <p>Restore writes a draft from this snapshot. It does not publish. Unsaved edits on this form will be replaced.</p>
      </Modal>
    </section>
  );

  async function restore(revisionId: string) {
    if (item === null) return;
    const result = await request(`/api/v1/${collection}/${id}/revisions/${revisionId}/restore`, jsonInit("POST", { version: item.version }));
    if (result.status === 409) {
      setConflict(true);
      return;
    }
    if (!result.ok || result.body === null) {
      setProblem(result.problem);
      return;
    }
    const restored = result.body as { item: ItemBody; missingMedia: string[] };
    apply(restored.item);
    setMessage(restored.missingMedia.length > 0
      ? `Restored as a draft. Missing images: ${restored.missingMedia.join(", ")}`
      : "Restored as a draft.");
  }

  async function viewRevision(revisionId: string) {
    const result = await request(`/api/v1/${collection}/${id}/revisions/${revisionId}`);
    if (!result.ok || result.body === null) return;
    const body = result.body as { snapshot: { title?: string; slug?: string; sections?: Array<{ type: string }> } };
    const sections = (body.snapshot.sections ?? []).map((section) => section.type).join(", ");
    setSnapshotText(`${body.snapshot.title ?? ""}\n${body.snapshot.slug ?? ""}${sections.length > 0 ? `\n${sections}` : ""}`);
  }

  async function openRevisions() {
    const result = await request(`/api/v1/${collection}/${id}/revisions`);
    if (!result.ok || result.body === null) return;
    setRevisions((result.body as { items: Revision[] }).items);
    setRevisionsOpen(true);
  }
}

function Findings({ problem, onJump }: { problem: Problem | null; onJump: (key: string) => void }) {
  if (problem === null) return null;
  const errors = Object.entries(problem.errors ?? {});
  const warnings = Object.entries(problem.warnings ?? {});
  if (errors.length === 0 && warnings.length === 0) return null;
  return (
    <div className="findings">
      <strong>{problem.title ?? "Publishing is blocked until every check passes."}</strong>
      <ul className="mt-2">
        {errors.map(([key, messages]) => (
          <li key={key}>
            <button type="button" className="text-left text-red-800" onClick={() => onJump(key)}>{key}: {messages.join(" ")}</button>
          </li>
        ))}
        {warnings.map(([key, messages]) => (
          <li key={`w-${key}`}>
            <button type="button" className="text-left" onClick={() => onJump(key)}>{key}: {messages.join(" ")}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Count({ value, guide, limit }: { value: string; guide: number; limit: number }) {
  return <span className="text-xs" style={{ color: "var(--dh-text-muted)" }}>{value.length} / {guide} shown, {limit} maximum</span>;
}

function shown(primary: string, fallback: string): string {
  return primary.trim().length > 0 ? primary : fallback;
}

function textField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function empty(value: string): string | null {
  return value.trim().length === 0 ? null : value;
}

function cssEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}
