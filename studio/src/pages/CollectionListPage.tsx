import { Button, Input, Segmented, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { jsonInit, request } from "../api/http";
import { publicPath, routeFor, websiteOrigin, type CollectionName } from "../content/model";
import { PageHeader } from "../ui/PageHeader";
import { StatusChip } from "../ui/StatusChip";

type ListItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  state: string;
  version: number;
  sortOrder: number;
  summary?: string | null;
  imagePath?: string | null;
  chips?: string[];
};

type ListPage = {
  items: ListItem[];
  total: number;
};

type ItemBody = {
  id: string;
  version: number;
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
    sections: Array<{ type: string; visible: boolean; fields: Record<string, unknown> }> | null;
  };
};

export function CollectionListPage({ collection }: { collection: CollectionName }) {
  const route = routeFor(collection);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState<ListPage>({ items: [], total: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const canReorder = route.ordered && search.trim().length === 0 && status === undefined && page.total === page.items.length;

  const counts = useMemo(() => ({
    all: page.total,
    published: page.items.filter((item) => item.status === "published").length,
    draft: page.items.filter((item) => item.status === "draft").length,
  }), [page]);

  useEffect(() => {
    void load(params.get("q") ?? search, status);
  }, [collection]);

  async function load(nextSearch = search, nextStatus = status) {
    const query = new URLSearchParams({ pageSize: "100" });
    if (nextSearch.trim().length > 0) query.set("search", nextSearch.trim());
    if (nextStatus !== undefined) query.set("status", nextStatus);
    const result = await request(`/api/v1/${collection}?${query.toString()}`);
    if (!result.ok || result.body === null) {
      setMessage(result.problem?.title ?? "The list could not be loaded.");
      return;
    }
    setPage(result.body as ListPage);
  }

  async function createItem() {
    const suffix = crypto.randomUUID().slice(0, 8);
    const result = await request(`/api/v1/${collection}`, jsonInit("POST", { slug: `draft-${suffix}`, title: "Untitled" }));
    if (!result.ok || result.body === null) {
      setMessage(result.problem?.title ?? "The item could not be created.");
      return;
    }
    navigate(`/${route.path}/${(result.body as { id: string }).id}`);
  }

  async function duplicateItem(row: ListItem) {
    const loaded = await request(`/api/v1/${collection}/${row.id}`);
    if (!loaded.ok || loaded.body === null) {
      setMessage(loaded.problem?.title ?? "The item could not be copied.");
      return;
    }
    const source = loaded.body as ItemBody;
    const suffix = crypto.randomUUID().slice(0, 8);
    const created = await request(`/api/v1/${collection}`, jsonInit("POST", {
      slug: `copy-${suffix}`,
      title: `${source.content.title} — Copy`,
    }));
    if (!created.ok || created.body === null) {
      setMessage(created.problem?.title ?? "A draft copy could not be created.");
      return;
    }
    const draft = created.body as { id: string; version: number };
    const saved = await request(`/api/v1/${collection}/${draft.id}/save`, jsonInit("PUT", {
      version: draft.version,
      slug: `copy-${suffix}`,
      title: `${source.content.title} — Copy`,
      metaTitle: source.content.metaTitle,
      metaDescription: source.content.metaDescription,
      shareImageId: source.content.shareImageId,
      shareImageAltOverride: source.content.shareImageAltOverride,
      canonicalOverride: source.content.canonicalOverride,
      noIndex: source.content.noIndex,
      sortOrder: source.content.sortOrder,
      fields: source.content.fields,
      sections: route.sections
        ? (source.content.sections ?? []).map((section) => ({
          type: section.type,
          visible: section.visible,
          fields: section.fields,
        }))
        : undefined,
    }));
    if (!saved.ok) {
      setMessage(saved.problem?.title ?? "The copy was created, but its fields were not saved.");
    }
    navigate(`/${route.path}/${draft.id}`);
  }

  async function persistOrder(items: ListItem[]) {
    const previous = page.items;
    setPage({ ...page, items });
    const result = await request(`/api/v1/${collection}/order`, jsonInit("POST", {
      items: items.map((item) => ({ id: item.id, version: item.version })),
    }));
    if (!result.ok) {
      setPage({ ...page, items: previous });
      setMessage(result.status === 409 ? "Someone else changed an item. The order was not saved." : result.problem?.title ?? "The order was not saved.");
      return;
    }
    await load();
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= page.items.length) return;
    const items = page.items.slice();
    const [row] = items.splice(index, 1);
    if (row === undefined) return;
    items.splice(target, 0, row);
    void persistOrder(items);
  }

  return (
    <section>
      <PageHeader
        title={route.label}
        subtitle={route.description}
        extra={<Button type="primary" onClick={() => void createItem()}>Add {route.singular}</Button>}
      />
      <div className="content-toolbar">
        <Segmented
          value={status ?? "all"}
          onChange={(value) => {
            const next = value === "all" ? undefined : String(value);
            setStatus(next);
            void load(search, next);
          }}
          options={[
            { value: "all", label: `All ${counts.all}` },
            { value: "published", label: `Published ${counts.published}` },
            { value: "draft", label: `Drafts ${counts.draft}` },
          ]}
        />
        <div className="flex items-center gap-2">
          <Input.Search
            placeholder="Search this collection..."
            value={search}
            allowClear
            onChange={(event) => setSearch(event.target.value)}
            onSearch={(value) => void load(value, status)}
          />
          <button
            type="button"
            className={`layout-btn${layout === "grid" ? " is-active" : ""}`}
            aria-pressed={layout === "grid"}
            onClick={() => setLayout("grid")}
          >
            Grid
          </button>
          <button
            type="button"
            className={`layout-btn${layout === "list" ? " is-active" : ""}`}
            aria-pressed={layout === "list"}
            onClick={() => setLayout("list")}
          >
            List
          </button>
        </div>
      </div>
      {route.ordered ? (
        <Typography.Paragraph type="secondary">
          {canReorder
            ? "Reorder with the arrows. The new order saves immediately."
            : "Clear the search and status filter to reorder this set."}
        </Typography.Paragraph>
      ) : null}
      {message !== null ? <Typography.Paragraph type="danger">{message}</Typography.Paragraph> : null}
      <div className={`content-grid${layout === "list" ? " is-list" : ""}`}>
        {page.items.map((item, index) => {
          const preview = item.status === "published" ? publicPath(collection, item.slug) : null;
          const mediaClass = `content-card__media${route.media === "logo" ? " is-logo" : ""}${route.media === "portrait" ? " is-portrait" : ""}`;
          return (
            <article key={item.id} className="content-card">
              <div className={mediaClass}>
                {item.imagePath ? (
                  <img src={item.imagePath} alt="" />
                ) : (
                  <span className="content-card__placeholder" aria-hidden="true">{route.icon}</span>
                )}
                <StatusChip state={item.state} />
              </div>
              <div className="content-card__body">
                <span className="content-card__type">{route.singular}</span>
                <h3>{item.title}</h3>
                {item.summary ? <p>{item.summary}</p> : null}
                {item.chips !== undefined && item.chips.length > 0 ? (
                  <div className="content-meta">
                    {item.chips.map((chip) => <span key={chip}>{chip}</span>)}
                  </div>
                ) : null}
              </div>
              <footer className="content-card__foot">
                <button type="button" className="edit-btn" onClick={() => navigate(`/${route.path}/${item.id}`)}>Edit</button>
                <button type="button" className="card-action is-labelled" title="Duplicate as a new draft" onClick={() => void duplicateItem(item)}>
                  Duplicate
                </button>
                {preview !== null ? (
                  <a className="card-action is-labelled" href={`${websiteOrigin}${preview}`} target="_blank" rel="noopener" title="Open the live page">
                    Preview
                  </a>
                ) : null}
                {canReorder ? (
                  <div className="reorder-actions">
                    <button type="button" className="card-action" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Move up" title="Move up">↑</button>
                    <button type="button" className="card-action" disabled={index === page.items.length - 1} onClick={() => move(index, 1)} aria-label="Move down" title="Move down">↓</button>
                  </div>
                ) : null}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
