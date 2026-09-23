import { Button, Form, Input, Modal, Select, Space, Table, Typography, message, Result } from "antd";
import { PageHeader } from "../ui/PageHeader";
import { StatusChip } from "../ui/StatusChip";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { jsonInit, request } from "../api/http";

type UserRow = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
};

export function UsersPage() {
  const auth = useAuth();
  const [items, setItems] = useState<UserRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor">("editor");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (auth.user?.role === "admin") void load();
  }, [auth.user?.role]);

  if (auth.user?.role !== "admin") {
    return <Result status="403" title="You do not have access to this area." />;
  }

  async function load() {
    const result = await request("/api/v1/users");
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "Users could not be loaded.");
      return;
    }
    setError(null);
    setItems((result.body as { items: UserRow[] }).items);
  }

  async function create() {
    const result = await request("/api/v1/users", jsonInit("POST", { email, role, password }));
    if (!result.ok) {
      setError(result.problem?.title ?? "The user was not created.");
      return;
    }
    setCreateOpen(false);
    setEmail("");
    setPassword("");
    message.success("User created.");
    await load();
  }

  async function deactivate(id: string) {
    const result = await request(`/api/v1/users/${id}/deactivate`, jsonInit("POST"));
    if (!result.ok) {
      setError(result.problem?.title ?? "The user was not deactivated.");
      return;
    }
    await load();
  }

  async function resetPassword(id: string) {
    const result = await request(`/api/v1/users/${id}/reset-password`, jsonInit("POST"));
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "The password was not reset.");
      return;
    }
    setTempPassword((result.body as { temporaryPassword: string }).temporaryPassword);
    await load();
  }

  return (
    <section className="surface-card">
      <PageHeader
        title="Users"
        extra={<Button type="primary" onClick={() => setCreateOpen(true)}>Create user</Button>}
      />
      {error !== null ? <Typography.Paragraph type="danger">{error}</Typography.Paragraph> : null}
      <Table
        rowKey="id"
        dataSource={items}
        pagination={false}
        columns={[
          { title: "Email", dataIndex: "email" },
          { title: "Role", dataIndex: "role", width: 100, render: (role: string) => <StatusChip state={role} /> },
          {
            title: "Status",
            width: 140,
            render: (_, row) => (row.active ? (row.mustChangePassword ? "Must change password" : "Active") : "Inactive"),
          },
          {
            title: "",
            width: 260,
            render: (_, row) =>
              row.active ? (
                <Space>
                  <Button size="small" onClick={() => void resetPassword(row.id)}>Reset password</Button>
                  <Button danger size="small" onClick={() => void deactivate(row.id)}>Deactivate</Button>
                </Space>
              ) : null,
          },
        ]}
      />
      <Modal title="Create user" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void create()} okText="Create">
        <Form layout="vertical">
          <Form.Item label="Email" required><Input value={email} onChange={(event) => setEmail(event.target.value)} /></Form.Item>
          <Form.Item label="Role" required>
            <Select value={role} onChange={setRole} options={[{ value: "editor" }, { value: "admin" }]} />
          </Form.Item>
          <Form.Item label="Password (min 12)" required>
            <Input.Password value={password} onChange={(event) => setPassword(event.target.value)} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="Temporary password"
        open={tempPassword !== null}
        onCancel={() => setTempPassword(null)}
        onOk={() => setTempPassword(null)}
        okText="I have copied it"
        cancelButtonProps={{ style: { display: "none" } }}
      >
        <Typography.Paragraph>Show this password once. It will not be shown again.</Typography.Paragraph>
        <Input.Password value={tempPassword ?? ""} readOnly />
      </Modal>
    </section>
  );
}
