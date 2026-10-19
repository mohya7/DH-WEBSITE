import { Table, Typography } from "antd";
import { useEffect, useState } from "react";
import { request } from "../api/http";
import { useAuth } from "../auth/AuthProvider";
import { PageHeader } from "../ui/PageHeader";
import { StatusChip } from "../ui/StatusChip";

type Row = {
  vacancyId: string | null;
  title: string;
  status: string | null;
  counts: Record<string, number>;
};

type Body = {
  months: string[];
  rows: Row[];
};

export function ApplicationsPage() {
  const auth = useAuth();
  const [body, setBody] = useState<Body | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (auth.user?.role !== "hr") return;
    void request("/api/v1/applications").then((result) => {
      if (!result.ok || result.body === null) {
        setMessage(result.problem?.title ?? "The counts could not be loaded.");
        return;
      }
      setBody(result.body as Body);
    });
  }, [auth.user?.role]);

  if (auth.user?.role !== "hr") {
    return <Typography.Paragraph>These counts are available to HR only.</Typography.Paragraph>;
  }

  const months = body?.months ?? [];
  return (
    <section>
      <PageHeader title="Applications" subtitle="How many applications arrived. No names or files are kept here." />
      {message !== null ? <Typography.Paragraph type="danger">{message}</Typography.Paragraph> : null}
      <Table
        rowKey={(row) => row.vacancyId ?? "general"}
        dataSource={body?.rows ?? []}
        pagination={false}
        columns={[
          { title: "Position", dataIndex: "title" },
          {
            title: "Status",
            dataIndex: "status",
            render: (status: string | null) => status === null ? "General" : <StatusChip state={status} />,
          },
          ...months.map((month) => ({
            title: month,
            render: (_: unknown, row: Row) => row.counts[month] ?? 0,
          })),
          {
            title: "Total",
            render: (_: unknown, row: Row) => Object.values(row.counts).reduce((sum, count) => sum + count, 0),
          },
        ]}
      />
    </section>
  );
}
