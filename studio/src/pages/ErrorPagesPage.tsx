import { Button, Form, Input, Space, Typography, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { jsonInit, request, type Problem } from "../api/http";
import { RichTextEditor } from "../content/RichTextEditor";
import { PageHeader } from "../ui/PageHeader";
import { StatusChip } from "../ui/StatusChip";

type ErrorPage = {
  type: string;
  id: string;
  title: string;
  body: string;
  version: number;
  status: string;
  state: string;
  hasWorkingCopy: boolean;
  publishedAt: string | null;
  notice?: string | null;
};

/*
 * ADM-05: the 404 and 500 pages are ordinary pages. A Save edits the draft (a
 * published page keeps its live text until Publish), and Publish uses the page
 * publish route, so it runs every check Pages runs.
 */
export function ErrorPagesPage() {
  const [items, setItems] = useState<ErrorPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [problems, setProblems] = useState<Record<string, Problem | null>>({});
  // A reload keeps the unsaved edits of other cards.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  // The card whose Save or Publish is in flight; a second click waits for the answer.
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const busyRef = useRef<Record<string, boolean>>({});

  function begin(type: string) {
    if (busyRef.current[type]) return false;
    busyRef.current = { ...busyRef.current, [type]: true };
    setBusy(busyRef.current);
    return true;
  }

  function end(type: string) {
    busyRef.current = { ...busyRef.current, [type]: false };
    setBusy(busyRef.current);
  }

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const result = await request("/api/v1/error-pages");
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "Error pages could not be loaded.");
      return;
    }
    setError(null);
    const loaded = (result.body as { items: ErrorPage[] }).items;
    setItems((current) => loaded.map((item) => (dirtyRef.current[item.type] ? current.find((kept) => kept.type === item.type) ?? item : item)));
  }

  function setProblem(type: string, problem: Problem | null) {
    setProblems((current) => ({ ...current, [type]: problem }));
  }

  async function save(page: ErrorPage) {
    if (!begin(page.type)) return;
    try {
      await sendSave(page);
    } finally {
      end(page.type);
    }
  }

  async function sendSave(page: ErrorPage) {
    const result = await request(`/api/v1/error-pages/${page.type}`, jsonInit("PUT", {
      version: page.version,
      title: page.title,
      body: page.body,
    }));
    if (!result.ok || result.body === null) {
      if (result.status === 409) {
        setError("Someone else changed this page.");
      } else if (result.status === 400 && result.problem?.errors !== undefined) {
        setProblem(page.type, result.problem);
      } else {
        setError(result.problem?.title ?? "The page was not saved.");
      }
      return;
    }
    const saved = result.body as ErrorPage;
    setError(null);
    setProblem(page.type, null);
    setDirty((current) => ({ ...current, [page.type]: false }));
    setItems((current) => current.map((item) => (item.type === saved.type ? saved : item)));
    message.success(saved.status === "published"
      ? `${page.type} page saved as a draft. Publish to put it on the website.`
      : `${page.type} page saved.`);
  }

  async function publish(page: ErrorPage) {
    if (!begin(page.type)) return;
    try {
      await sendPublish(page);
    } finally {
      end(page.type);
    }
  }

  async function sendPublish(page: ErrorPage) {
    const result = await request(`/api/v1/pages/${page.id}/publish`, jsonInit("POST", { version: page.version }));
    if (!result.ok) {
      if (result.status === 409) {
        setError("Someone else changed this page.");
      } else if (result.status === 400 && (result.problem?.errors !== undefined || result.problem?.warnings !== undefined)) {
        setProblem(page.type, result.problem);
      } else {
        setError(result.problem?.title ?? "The page was not published.");
      }
      return;
    }
    const warnings = (result.body as { warnings?: Record<string, string[]> } | null)?.warnings ?? {};
    setProblem(page.type, Object.keys(warnings).length > 0 ? { title: "Published, with warnings.", warnings } : null);
    await load();
    message.success(`${page.type} page published. Changes appear on the website at the next build.`);
  }

  function patch(type: string, update: Partial<ErrorPage>) {
    setDirty((current) => ({ ...current, [type]: true }));
    setItems((current) => current.map((item) => (item.type === type ? { ...item, ...update } : item)));
  }

  return (
    <section className="surface-card max-w-3xl">
      <PageHeader title="Error pages" />
      <Typography.Paragraph type="secondary">
        These pages use reserved slugs <code>error-404</code> and <code>error-500</code>.
      </Typography.Paragraph>
      {error !== null ? <Typography.Paragraph type="danger">{error}</Typography.Paragraph> : null}
      <div className="space-y-8">
        {items.map((page) => {
          const unsaved = dirty[page.type] === true;
          const sending = busy[page.type] === true;
          return (
            <div key={page.type} className="section-card">
              <div className="flex items-center gap-3">
                <Typography.Title level={4} className="!mb-0">{page.type} page</Typography.Title>
                <StatusChip state={page.state} />
              </div>
              {page.state === "published" && page.notice ? <Typography.Paragraph type="secondary">{page.notice}</Typography.Paragraph> : null}
              <Findings problem={problems[page.type] ?? null} />
              <Form layout="vertical">
                <Form.Item label="Title">
                  <Input value={page.title} onChange={(event) => patch(page.type, { title: event.target.value })} />
                </Form.Item>
                <Form.Item label="Body">
                  <RichTextEditor value={page.body} onChange={(body) => patch(page.type, { body })} fieldPath={`error-${page.type}.body`} label="Body" />
                </Form.Item>
                <Space>
                  <Button type="primary" disabled={sending} onClick={() => void save(page)}>Save</Button>
                  <Button disabled={unsaved || sending} onClick={() => void publish(page)}>Publish</Button>
                </Space>
                {unsaved ? <Typography.Paragraph type="secondary" className="!mt-2">Save before publishing, so the check runs on what is on screen.</Typography.Paragraph> : null}
              </Form>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* What blocks a publish or a save, as Pages lists it, without jump links: this
   screen has no section form to jump to. */
function Findings({ problem }: { problem: Problem | null }) {
  if (problem === null) return null;
  const errors = Object.entries(problem.errors ?? {});
  const warnings = Object.entries(problem.warnings ?? {});
  if (errors.length === 0 && warnings.length === 0) return null;
  return (
    <div className="findings">
      <strong>{problem.title ?? "Publishing is blocked until every check passes."}</strong>
      <ul className="mt-2">
        {errors.map(([key, messages]) => <li key={`error-${key}`} className="text-red-800">{key}: {messages.join(" ")}</li>)}
        {warnings.map(([key, messages]) => <li key={`warning-${key}`}>{key}: {messages.join(" ")}</li>)}
      </ul>
    </div>
  );
}
