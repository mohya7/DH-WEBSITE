import { Button, Form, Input, Modal, Table, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { jsonInit, request } from "../api/http";
import { PageHeader } from "../ui/PageHeader";

type RedirectRow = {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  source: string;
  createdAt: string;
};

type Page = { items: RedirectRow[]; total: number };

export function RedirectsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<Page>({ items: [], total: 0 });
  const [open, setOpen] = useState(false);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load(term = search) {
    const params = new URLSearchParams({ pageSize: "50" });
    if (term.trim()) params.set("search", term.trim());
    const result = await request(`/api/v1/redirects?${params}`);
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "Redirects could not be loaded.");
      return;
    }
    setError(null);
    setPage(result.body as Page);
  }

  async function create() {
    const result = await request("/api/v1/redirects", jsonInit("POST", { fromPath, toPath }));
    if (!result.ok) {
      setError(result.problem?.title ?? "The redirect was not created.");
      return;
    }
    setOpen(false);
    setFromPath("");
    setToPath("");
    message.success("Redirect created.");
    await load();
  }

  async function remove(id: string) {
    const result = await request(`/api/v1/redirects/${id}`, { method: "DELETE" });
    if (!result.ok) {
      setError(result.problem?.title ?? "The redirect was not deleted.");
      return;
    }
    await load();
  }

  return (
    <section className="surface-card">
      <PageHeader
        title="Redirects"
        extra={<Button type="primary" onClick={() => setOpen(true)}>Add redirect</Button>}
      />
      <Input.Search className="mb-4 max-w-md" value={search} onChange={(event) => setSearch(event.target.value)} onSearch={(value) => void load(value)} allowClear placeholder="Search paths" />
      {error !== null ? <Typography.Paragraph type="danger">{error}</Typography.Paragraph> : null}
      <Table
        rowKey="id"
        dataSource={page.items}
        pagination={false}
        columns={[
          { title: "From", dataIndex: "fromPath" },
          { title: "To", dataIndex: "toPath" },
          { title: "Source", dataIndex: "source", width: 100 },
          {
            title: "",
            width: 100,
            render: (_, row) => (
              <Button danger size="small" onClick={() => void remove(row.id)}>Delete</Button>
            ),
          },
        ]}
      />
      <Modal title="Add redirect" open={open} onCancel={() => setOpen(false)} onOk={() => void create()} okText="Create">
        <Form layout="vertical">
          <Form.Item label="From path" required>
            <Input value={fromPath} onChange={(event) => setFromPath(event.target.value)} placeholder="/old-path" />
          </Form.Item>
          <Form.Item label="To path" required>
            <Input value={toPath} onChange={(event) => setToPath(event.target.value)} placeholder="/new-path" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
