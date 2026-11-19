import { Button, Form, Input, Modal, Select, Space, Table, Typography, message, Result } from "antd";
import { PageHeader } from "../ui/PageHeader";
import { StatusChip } from "../ui/StatusChip";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { jsonInit, request } from "../api/http";

type UserRow = {
  id: string;
  email: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
};

/* An action waiting for the admin's confirmation (ADM-04). */
type Pending = { kind: "role"; row: UserRow; role: string } | { kind: "reactivate"; row: UserRow };

const roleOptions = [{ value: "editor" }, { value: "admin" }, { value: "hr", label: "HR" }];

function roleLabel(role: string) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

export function UsersPage() {
  const auth = useAuth();
  const [items, setItems] = useState<UserRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "hr">("editor");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [deactivatedMatch, setDeactivatedMatch] = useState<UserRow | null>(null);
  // The dialog keeps its text while it closes.
  const lastPending = useRef<Pending | null>(null);
  if (pending !== null) lastPending.current = pending;
  const shownPending = pending ?? lastPending.current;

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
      // A deactivated user keeps their email; offer to bring them back instead.
      const typed = email.trim().toLowerCase();
      const match = result.problem?.code === "email_taken"
        ? items.find((item) => !item.active && item.email.toLowerCase() === typed)
        : undefined;
      if (match !== undefined) {
        setDeactivatedMatch(match);
        return;
      }
      setError(result.problem?.title ?? "The user was not created.");
      return;
    }
    setCreateOpen(false);
    setEmail("");
    setPassword("");
    message.success("User created.");
    await load();
  }

  function reactivateInstead(row: UserRow) {
    setCreateOpen(false);
    setDeactivatedMatch(null);
    setEmail("");
    setPassword("");
    setPending({ kind: "reactivate", row });
  }

  async function confirmPending() {
    const action = pending;
    setPending(null);
    if (action === null) return;
    if (action.kind === "role") await changeRole(action.row, action.role);
    else await reactivate(action.row);
  }

  async function changeRole(row: UserRow, next: string) {
    const result = await request(`/api/v1/users/${row.id}/role`, jsonInit("PUT", { role: next }));
    if (!result.ok) {
      setError(result.problem?.title ?? "The role was not changed.");
      return;
    }
    message.success(`Role changed. ${row.email} must sign in again.`);
    await load();
  }

  async function reactivate(row: UserRow) {
    const result = await request(`/api/v1/users/${row.id}/reactivate`, jsonInit("POST"));
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "The user was not reactivated.");
      return;
    }
    setTempPassword((result.body as { temporaryPassword: string }).temporaryPassword);
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
        title="User Management"
        extra={<Button type="primary" onClick={() => setCreateOpen(true)}>Create user</Button>}
      />
      {error !== null ? <Typography.Paragraph type="danger">{error}</Typography.Paragraph> : null}
      <Table
        rowKey="id"
        dataSource={items}
        pagination={false}
        columns={[
          { title: "Email", dataIndex: "email" },
          {
            title: "Role",
            dataIndex: "role",
            width: 130,
            // Another active user's role can be changed; your own row and inactive rows keep the chip.
            render: (value: string, row) =>
              row.active && row.id !== auth.user?.id ? (
                <Select
                  id={`user-role-${row.id}`}
                  size="small"
                  aria-label={`Role for ${row.email}`}
                  value={value}
                  style={{ width: "100%" }}
                  onChange={(next: string) => {
                    if (next !== row.role) setPending({ kind: "role", row, role: next });
                  }}
                  options={roleOptions}
                />
              ) : (
                <StatusChip state={value} />
              ),
          },
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
              ) : (
                <Button size="small" onClick={() => setPending({ kind: "reactivate", row })}>Reactivate</Button>
              ),
          },
        ]}
      />
      <Modal
        title="Create user"
        open={createOpen}
        destroyOnHidden
        onCancel={() => {
          setCreateOpen(false);
          setDeactivatedMatch(null);
        }}
        onOk={() => void create()}
        okText="Create"
      >
        <Form layout="vertical">
          <Form.Item label="Email" required>
            <Input
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setDeactivatedMatch(null);
              }}
            />
          </Form.Item>
          <Form.Item label="Role" required>
            <Select value={role} onChange={setRole} options={roleOptions} />
          </Form.Item>
          <Form.Item label="Password (min 12)" required>
            <Input.Password value={password} onChange={(event) => setPassword(event.target.value)} />
          </Form.Item>
        </Form>
        {deactivatedMatch !== null ? (
          <div>
            <Typography.Paragraph type="warning">That email belongs to a deactivated user.</Typography.Paragraph>
            <Button onClick={() => reactivateInstead(deactivatedMatch)}>Reactivate instead</Button>
          </div>
        ) : null}
      </Modal>
      <Modal
        title={shownPending === null ? "" : shownPending.kind === "role" ? "Change role?" : `Reactivate ${shownPending.row.email}?`}
        open={pending !== null}
        destroyOnHidden
        onCancel={() => setPending(null)}
        onOk={() => void confirmPending()}
        okText={shownPending?.kind === "role" ? "Change role" : "Reactivate"}
      >
        {shownPending === null ? null : shownPending.kind === "role" ? (
          <Typography.Paragraph>
            {`${shownPending.row.email} becomes ${roleLabel(shownPending.role)}. They are signed out and sign in again with the new role.`}
          </Typography.Paragraph>
        ) : (
          <Typography.Paragraph>They get a temporary password and must change it at sign-in.</Typography.Paragraph>
        )}
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
