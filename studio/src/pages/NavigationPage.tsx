import { Button, Form, Input, Segmented, Select, Space, Typography, message } from "antd";
import { PageHeader } from "../ui/PageHeader";
import { useEffect, useState } from "react";
import { jsonInit, request } from "../api/http";
import { labelFromKey, referenceCollections } from "../content/model";

type NavNode = {
  id?: string;
  label: string;
  linkKind?: "group" | "internal" | "external";
  targetType?: string | null;
  targetId?: string | null;
  url?: string | null;
  children?: NavNode[];
};

type NavResponse = { menu: string; items: NavNode[] };

const targetTypes = ["page", "service", "partner", "case_study", "blog_post", "vacancy"] as const;

export function NavigationPage() {
  const [menu, setMenu] = useState<"header" | "footer">("header");
  const [items, setItems] = useState<NavNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load(menu);
  }, [menu]);

  async function load(next: "header" | "footer") {
    const result = await request(`/api/v1/navigation?menu=${next}`);
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "Navigation could not be loaded.");
      return;
    }
    setError(null);
    setItems((result.body as NavResponse).items);
  }

  async function save() {
    const result = await request("/api/v1/navigation", jsonInit("PUT", { menu, items }));
    if (!result.ok) {
      setError(result.problem?.title ?? "Navigation was not saved.");
      return;
    }
    message.success("Navigation saved.");
    setItems((result.body as NavResponse).items);
  }

  function updateRoot(index: number, patch: Partial<NavNode>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateChild(parent: number, index: number, patch: Partial<NavNode>) {
    setItems((current) =>
      current.map((item, i) =>
        i === parent
          ? { ...item, children: (item.children ?? []).map((child, c) => (c === index ? { ...child, ...patch } : child)) }
          : item,
      ),
    );
  }

  return (
    <section className="surface-card">
      <PageHeader
        title="Navigation"
        extra={
          <Space>
            <Segmented
              value={menu}
              onChange={(value) => setMenu(value as "header" | "footer")}
              options={[
                { value: "header", label: "Header" },
                { value: "footer", label: "Footer" },
              ]}
            />
            <Button type="primary" onClick={() => void save()}>Save</Button>
          </Space>
        }
      />
      {error !== null ? <Typography.Paragraph type="danger">{error}</Typography.Paragraph> : null}
      <Space orientation="vertical" className="w-full" size="large">
        {items.map((item, index) => (
          <div key={item.id ?? index} className="section-card">
            <Form layout="vertical">
              <Form.Item label="Label">
                <Input value={item.label} onChange={(event) => updateRoot(index, { label: event.target.value })} />
              </Form.Item>
              {(item.children?.length ?? 0) > 0 ? (
                <Typography.Text type="secondary">Group — children hold the links.</Typography.Text>
              ) : (
                <LinkFields
                  node={item}
                  onChange={(patch) => updateRoot(index, patch)}
                />
              )}
            </Form>
            <div className="ml-4 space-y-3 border-l pl-4" style={{ borderColor: "var(--dh-border)" }}>
              {(item.children ?? []).map((child, childIndex) => (
                <div key={child.id ?? childIndex} className="section-card space-y-2">
                  <Input placeholder="Label" value={child.label} onChange={(event) => updateChild(index, childIndex, { label: event.target.value })} />
                  <LinkFields node={child} onChange={(patch) => updateChild(index, childIndex, patch)} />
                </div>
              ))}
              <Button
                size="small"
                onClick={() =>
                  updateRoot(index, {
                    linkKind: "group",
                    targetType: null,
                    targetId: null,
                    url: null,
                    children: [...(item.children ?? []), { label: "New link", linkKind: "internal", targetType: "page", targetId: null }],
                  })
                }
              >
                Add child link
              </Button>
            </div>
          </div>
        ))}
        <Button onClick={() => setItems((current) => [...current, { label: "New item", linkKind: "group", children: [] }])}>
          Add top-level item
        </Button>
      </Space>
    </section>
  );
}

function LinkFields({ node, onChange }: { node: NavNode; onChange: (patch: Partial<NavNode>) => void }) {
  const kind = node.linkKind ?? (node.url ? "external" : node.targetId ? "internal" : "group");
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<Array<{ id: string; title: string }>>([]);
  const type = node.targetType ?? "page";

  async function find(term: string, nextType: string) {
    const collection = referenceCollections[nextType];
    if (collection === undefined) return;
    const result = await request(`/api/v1/${collection}?pageSize=8&search=${encodeURIComponent(term)}`);
    if (!result.ok || result.body === null) return;
    setHits((result.body as { items: Array<{ id: string; title: string }> }).items);
  }

  return (
    <div className="grid gap-3">
      <Select
        value={kind}
        options={[
          { value: "group", label: "Group (no link)" },
          { value: "internal", label: "Internal content" },
          { value: "external", label: "External URL" },
        ]}
        onChange={(value) =>
          onChange({
            linkKind: value as NavNode["linkKind"],
            targetType: value === "internal" ? type : null,
            targetId: value === "internal" ? node.targetId ?? null : null,
            url: value === "external" ? node.url ?? "" : null,
          })
        }
      />
      {kind === "internal" ? (
        <>
          <Select
            value={type}
            options={targetTypes.map((value) => ({ value, label: labelFromKey(value) }))}
            onChange={(value) => {
              onChange({ linkKind: "internal", targetType: value, targetId: null, url: null });
              setHits([]);
            }}
          />
          <Input
            placeholder="Search content"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              void find(event.target.value, type);
            }}
          />
          <ul className="max-h-40 overflow-auto text-sm">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className="reference-hit py-1 text-left"
                  onClick={() => onChange({ linkKind: "internal", targetType: type, targetId: hit.id, url: null })}
                >
                  {hit.title}
                </button>
              </li>
            ))}
          </ul>
          <Typography.Text type="secondary" className="text-xs">
            {node.targetId ? `Linked ${type} ${node.targetId}` : "Choose an item."}
          </Typography.Text>
        </>
      ) : null}
      {kind === "external" ? (
        <Input
          placeholder="https://…"
          value={node.url ?? ""}
          onChange={(event) => onChange({ linkKind: "external", url: event.target.value, targetType: null, targetId: null })}
        />
      ) : null}
    </div>
  );
}
