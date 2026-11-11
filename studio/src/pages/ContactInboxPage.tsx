import { Button, Drawer, Input, Space, Typography, message } from "antd";
import { PageHeader } from "../ui/PageHeader";
import { StatusChip } from "../ui/StatusChip";
import { useEffect, useRef, useState } from "react";
import { jsonInit, request } from "../api/http";
import { ListPager } from "../ui/ListPager";
import { afterEmptyPage, latestOnly, withPage } from "../ui/paging";

type ContactRow = {
  id: string;
  name: string;
  organization: string;
  email: string;
  situation: string;
  status: string;
  createdAt: string;
  handledAt?: string | null;
};

type ContactDetail = ContactRow & {
  role?: string | null;
  message: string;
  handledById?: string | null;
};

type Page = { items: ContactRow[]; total: number };

const pageSize = 50;

export function ContactInboxPage() {
  // What is in the search box, and the search last submitted. Every list
  // request uses the submitted one, so the pager's total matches the rows.
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [current, setCurrent] = useState(1);
  const requests = useRef(latestOnly());
  const [page, setPage] = useState<Page>({ items: [], total: 0 });
  const [selected, setSelected] = useState<ContactDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load("", 1);
  }, []);

  async function load(term: string, pageNumber: number, jumped = false) {
    const ticket = requests.current.start();
    const params = new URLSearchParams();
    if (term.trim()) params.set("search", term.trim());
    const result = await request(`/api/v1/contact-requests?${withPage(params, pageNumber, pageSize)}`);
    if (!requests.current.isLatest(ticket)) return;
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "Contact requests could not be loaded.");
      return;
    }
    const body = result.body as Page;
    // Past the last page after a change: show the new last page instead,
    // once. A list that promises rows it does not give is a load error.
    const step = body.items.length === 0 ? afterEmptyPage(pageNumber, body.total, pageSize, jumped) : "show";
    if (step === "fail") {
      setError("Contact requests could not be loaded.");
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

  async function open(id: string) {
    const result = await request(`/api/v1/contact-requests/${id}`);
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "The request could not be opened.");
      return;
    }
    setSelected(result.body as ContactDetail);
  }

  async function handle() {
    if (selected === null) return;
    const result = await request(`/api/v1/contact-requests/${selected.id}/handled`, jsonInit("POST"));
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "The request was not marked handled.");
      return;
    }
    setSelected(result.body as ContactDetail);
    message.success("Marked handled.");
    await load(applied, current);
  }

  const incoming = page.items.filter((item) => item.status === "new").length;
  const handled = page.items.filter((item) => item.status !== "new").length;

  return (
    <section>
      <PageHeader title="Inbox" subtitle="Review enquiry submissions from the contact form." />
      <div className="stats-grid">
        <article className="stat-card"><span>Total requests</span><strong>{page.total}</strong></article>
        <article className="stat-card"><span>New</span><strong>{incoming}</strong></article>
        <article className="stat-card"><span>Handled</span><strong>{handled}</strong></article>
      </div>
      <Input.Search
        className="mb-4 max-w-md"
        placeholder="Search name, organization, email..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onSearch={(value) => submitSearch(value)}
        allowClear
      />
      {error !== null ? <Typography.Paragraph type="danger">{error}</Typography.Paragraph> : null}
      {page.items.map((row) => (
        <article key={row.id} className="panel contact-card" role="button" tabIndex={0} onClick={() => void open(row.id)} onKeyDown={(event) => { if (event.key === "Enter") void open(row.id); }}>
          <header className="mb-3 flex items-start justify-between gap-3">
            <div>
              <span className="content-card__type">{row.situation}</span>
              <h2 className="!mb-1">{row.name}</h2>
              <p>{row.organization} · {row.email}</p>
            </div>
            <StatusChip state={row.status} />
          </header>
        </article>
      ))}
      <ListPager label="Inbox pages" current={current} pageSize={pageSize} total={page.total} onChange={goTo} />
      <Drawer title={selected?.name} open={selected !== null} onClose={() => setSelected(null)} size={480}>
        {selected !== null ? (
          <Space orientation="vertical" className="w-full">
            <Typography.Text>{selected.email}</Typography.Text>
            <Typography.Text type="secondary">{selected.organization}{selected.role ? ` · ${selected.role}` : ""}</Typography.Text>
            <Typography.Text type="secondary">{selected.situation}</Typography.Text>
            <Typography.Paragraph className="whitespace-pre-wrap break-words">
              {selected.message}
            </Typography.Paragraph>
            {selected.status === "new" ? (
              <Button type="primary" onClick={() => void handle()}>Mark handled</Button>
            ) : (
              <Typography.Text type="secondary">Handled {selected.handledAt ?? ""}</Typography.Text>
            )}
            <Button href={`mailto:${selected.email}`}>Reply by email</Button>
          </Space>
        ) : null}
      </Drawer>
    </section>
  );
}
