import { Button, Input, Segmented, Space, Table, Typography } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsonInit, request } from "../api/http";
import { routeFor, type CollectionName } from "../content/model";
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
};

type ListPage = {
  items: ListItem[];
  total: number;
};

export function CollectionListPage({ collection }: { collection: CollectionName }) {
  const route = routeFor(collection);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState<ListPage>({ items: [], total: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const canReorder = route.ordered && search.trim().length === 0 && status === undefined && page.total === page.items.length;

  useEffect(() => {
    void load();
  }, [collection]);

  async function load(nextSearch = search, nextStatus = status) {
    const params = new URLSearchParams({ pageSize: "100" });
    if (nextSearch.trim().length > 0) params.set("search", nextSearch.trim());
    if (nextStatus !== undefined) params.set("status", nextStatus);
    const result = await request(`/api/v1/${collection}?${params.toString()}`);
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
    const created = result.body as { id: string };
    navigate(`/${route.path}/${created.id}`);
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
    <section className="surface-card">
      <PageHeader
        title={route.label}
        subtitle={`${page.total} item${page.total === 1 ? "" : "s"}`}
        extra={<Button type="primary" onClick={() => void createItem()}>New</Button>}
      />
      <Space className="mb-4" wrap>
        <Input.Search
          placeholder="Search title or address"
          value={search}
          allowClear
          onChange={(event) => setSearch(event.target.value)}
          onSearch={(value) => void load(value, status)}
        />
        <Segmented
          value={status ?? "all"}
          onChange={(value) => {
            const next = value === "all" ? undefined : String(value);
            setStatus(next);
            void load(search, next);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "draft", label: "Draft" },
            { value: "published", label: "Published" },
            { value: "ended", label: "Ended" },
          ]}
        />
      </Space>
      {route.ordered ? (
        <Typography.Paragraph type="secondary">
          {canReorder
            ? "Move up and Move down reorder the whole set. Drag does the same. The order is saved immediately."
            : "Clear the search and status filter to reorder this set."}
        </Typography.Paragraph>
      ) : null}
      {message !== null ? <Typography.Paragraph type="danger">{message}</Typography.Paragraph> : null}
      <Table
        rowKey="id"
        pagination={false}
        dataSource={page.items}
        onRow={(_, index) => ({
          tabIndex: 0,
          draggable: canReorder,
          onDragStart: () => setDragIndex(index ?? null),
          onDragOver: (event) => event.preventDefault(),
          onDrop: () => {
            if (dragIndex === null || index === undefined) return;
            const items = page.items.slice();
            const [row] = items.splice(dragIndex, 1);
            if (row === undefined) return;
            items.splice(index, 0, row);
            setDragIndex(null);
            void persistOrder(items);
          },
        })}
        columns={[
          { title: "Title", dataIndex: "title", render: (title: string, row: ListItem) => <Button type="link" onClick={() => navigate(`/${route.path}/${row.id}`)}>{title}</Button> },
          { title: "Address", dataIndex: "slug" },
          { title: "State", dataIndex: "state", render: (state: string) => <StatusChip state={state} /> },
          {
            title: "",
            render: (_value: unknown, _row: ListItem, index: number) => canReorder ? (
              <Space>
                <Button onClick={() => move(index, -1)} disabled={index === 0}>Move up</Button>
                <Button onClick={() => move(index, 1)} disabled={index === page.items.length - 1}>Move down</Button>
              </Space>
            ) : null,
          },
        ]}
      />
    </section>
  );
}
