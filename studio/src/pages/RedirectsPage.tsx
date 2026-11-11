import { Button, Form, Input, Modal, Table, Typography, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { jsonInit, request } from "../api/http";
import { tablePager } from "../ui/ListPager";
import { PageHeader } from "../ui/PageHeader";
import { afterEmptyPage, latestOnly, withPage } from "../ui/paging";

type RedirectRow = {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  source: string;
  createdAt: string;
};

type Page = { items: RedirectRow[]; total: number };

const pageSize = 50;

export function RedirectsPage() {
  // What is in the search box, and the search last submitted. Every list
  // request uses the submitted one.
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [current, setCurrent] = useState(1);
  const requests = useRef(latestOnly());
  const [page, setPage] = useState<Page>({ items: [], total: 0 });
  const [open, setOpen] = useState(false);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load("", 1);
  }, []);

  async function load(term: string, pageNumber: number, jumped = false) {
    const ticket = requests.current.start();
    const params = new URLSearchParams();
    if (term.trim()) params.set("search", term.trim());
    const result = await request(`/api/v1/redirects?${withPage(params, pageNumber, pageSize)}`);
    if (!requests.current.isLatest(ticket)) return;
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "Redirects could not be loaded.");
      return;
    }
    const body = result.body as Page;
    // Past the last page after a delete: show the new last page instead,
    // once. A list that promises rows it does not give is a load error.
    const step = body.items.length === 0 ? afterEmptyPage(pageNumber, body.total, pageSize, jumped) : "show";
    if (step === "fail") {
      setError("Redirects could not be loaded.");
      return;
    }
    if (step !== "show") {
      await load(term, step, true);
      return;
    }
    setError(null);
    setCurrent(pageNumber);
    setPage(body);
  }

  // The pager moves when the page arrives (load), so after a failure it still
  // shows the page whose rows are on screen.
  function goTo(pageNumber: number) {
    void load(applied, pageNumber);
  }

  function submitSearch(term: string) {
    setApplied(term);
    void load(term, 1);
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
    await load(applied, current);
  }

  async function remove(id: string) {
    const result = await request(`/api/v1/redirects/${id}`, { method: "DELETE" });
    if (!result.ok) {
      setError(result.problem?.title ?? "The redirect was not deleted.");
      return;
    }
    await load(applied, current);
  }

  return (
    <section className="surface-card">
      <PageHeader
        title="Redirects"
        extra={<Button type="primary" onClick={() => setOpen(true)}>Add redirect</Button>}
      />
      <Input.Search className="mb-4 max-w-md" value={search} onChange={(event) => setSearch(event.target.value)} onSearch={(value) => submitSearch(value)} allowClear placeholder="Search paths" />
      {error !== null ? <Typography.Paragraph type="danger">{error}</Typography.Paragraph> : null}
      <Table
        rowKey="id"
        dataSource={page.items}
        pagination={tablePager(current, pageSize, page.total, goTo)}
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
