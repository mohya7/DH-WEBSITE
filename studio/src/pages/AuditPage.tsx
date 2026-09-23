import { Button, DatePicker, Input, Space, Table, Typography, Result } from "antd";
import { PageHeader } from "../ui/PageHeader";
import type { Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { request } from "../api/http";

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

  useEffect(() => {
    if (auth.user?.role === "admin") void load();
  }, [auth.user?.role]);

  if (auth.user?.role !== "admin") {
    return <Result status="403" title="You do not have access to this area." />;
  }

  async function load() {
    const params = new URLSearchParams({ pageSize: "50" });
    if (action.trim()) params.set("action", action.trim());
    if (entityType.trim()) params.set("entityType", entityType.trim());
    if (userId.trim()) params.set("userId", userId.trim());
    if (range?.[0]) params.set("from", range[0].toISOString());
    if (range?.[1]) params.set("to", range[1].toISOString());
    const result = await request(`/api/v1/audit?${params}`);
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "Audit log could not be loaded.");
      return;
    }
    setError(null);
    setPage(result.body as Page);
  }

  return (
    <section className="surface-card">
      <PageHeader title="Audit log" />
      <Space wrap className="mb-4">
        <Input placeholder="User id" value={userId} onChange={(event) => setUserId(event.target.value)} allowClear style={{ width: 220 }} />
        <Input placeholder="Action" value={action} onChange={(event) => setAction(event.target.value)} allowClear style={{ width: 160 }} />
        <Input placeholder="Entity type" value={entityType} onChange={(event) => setEntityType(event.target.value)} allowClear style={{ width: 160 }} />
        <DatePicker.RangePicker value={range as [Dayjs, Dayjs] | null} onChange={(value) => setRange(value)} />
        <Button onClick={() => void load()}>Filter</Button>
      </Space>
      {error !== null ? <Typography.Paragraph type="danger">{error}</Typography.Paragraph> : null}
      <Table
        rowKey="id"
        dataSource={page.items}
        pagination={false}
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
