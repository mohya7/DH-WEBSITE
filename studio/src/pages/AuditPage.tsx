import { Button, DatePicker, Input, Space, Table, Typography, Result } from "antd";
import { PageHeader } from "../ui/PageHeader";
import type { Dayjs } from "dayjs";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { request } from "../api/http";
import { tablePager } from "../ui/ListPager";
import { latestOnly, withPage } from "../ui/paging";

type AuditRow = {
  id: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  at: string;
  success: boolean;
  detail?: string | null;
};

type Page = { items: AuditRow[]; total: number };

type Filters = {
  action: string;
  entityType: string;
  userId: string;
  range: [Dayjs | null, Dayjs | null] | null;
};

const noFilters: Filters = { action: "", entityType: "", userId: "", range: null };
const pageSize = 50;

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function AuditPage() {
  const auth = useAuth();
  const [page, setPage] = useState<Page>({ items: [], total: 0 });
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [userId, setUserId] = useState("");
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The filters last applied with Filter. Page clicks use these, never what is
  // typed but not yet applied, so the pager's total matches the rows.
  const [applied, setApplied] = useState<Filters>(noFilters);
  const [current, setCurrent] = useState(1);
  const requests = useRef(latestOnly());

  useEffect(() => {
    if (auth.user?.role === "admin") void load(noFilters, 1);
  }, [auth.user?.role]);

  if (auth.user?.role !== "admin") {
    return <Result status="403" title="You do not have access to this area." />;
  }

  async function load(filters: Filters, pageNumber: number) {
    const ticket = requests.current.start();
    const params = new URLSearchParams();
    if (filters.action.trim()) params.set("action", filters.action.trim());
    if (filters.entityType.trim()) params.set("entityType", filters.entityType.trim());
    if (filters.userId.trim()) params.set("userId", filters.userId.trim());
    if (filters.range?.[0]) params.set("from", filters.range[0].toISOString());
    if (filters.range?.[1]) params.set("to", filters.range[1].toISOString());
    const result = await request(`/api/v1/audit?${withPage(params, pageNumber, pageSize)}`);
    if (!requests.current.isLatest(ticket)) return;
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "Audit log could not be loaded.");
      return;
    }
    setError(null);
    setCurrent(pageNumber);
    setPage(result.body as Page);
  }

  function goTo(pageNumber: number) {
    setCurrent(pageNumber);
    void load(applied, pageNumber);
  }

  function filter() {
    const filters = { action, entityType, userId, range };
    setApplied(filters);
    setCurrent(1);
    void load(filters, 1);
  }

  return (
    <section className="surface-card">
      <PageHeader title="Audit log" />
      <Space wrap className="mb-4">
        <Input placeholder="User id" value={userId} onChange={(event) => setUserId(event.target.value)} allowClear style={{ width: 220 }} />
        <Input placeholder="Action" value={action} onChange={(event) => setAction(event.target.value)} allowClear style={{ width: 160 }} />
        <Input placeholder="Entity type" value={entityType} onChange={(event) => setEntityType(event.target.value)} allowClear style={{ width: 160 }} />
        <DatePicker.RangePicker value={range as [Dayjs, Dayjs] | null} onChange={(value) => setRange(value)} />
        <Button onClick={filter}>Filter</Button>
      </Space>
      {error !== null ? <Typography.Paragraph type="danger">{error}</Typography.Paragraph> : null}
      <Table
        rowKey="id"
        dataSource={page.items}
        pagination={tablePager(current, pageSize, page.total, goTo)}
        columns={[
          { title: "When", dataIndex: "at", render: (value: string) => formatWhen(value), width: 180 },
          { title: "Action", dataIndex: "action", width: 160 },
          { title: "Entity", dataIndex: "entityType", width: 140 },
          { title: "Entity id", dataIndex: "entityId" },
          { title: "User", dataIndex: "userId" },
          { title: "Detail", dataIndex: "detail" },
        ]}
      />
    </section>
  );
}
