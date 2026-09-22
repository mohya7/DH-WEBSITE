import { Alert, Button, Form, Input, Layout, Menu, Modal, Result, Spin, Tag, Typography, message } from "antd";
import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { jsonInit, request } from "../api/http";
import { useAuth } from "../auth/AuthProvider";
import type { StudioUser } from "../auth/session";
import { queryClient, sessionQueryKey } from "../queryClient";
import { brand } from "../theme";
import { areasForRole, isStudioRole } from "./areas";

const { Header, Sider, Content } = Layout;

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const user = auth.user;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);

  if (!auth.ready || user === null) {
    return (
      <div className="grid min-h-svh place-items-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!isStudioRole(user.role)) {
    return (
      <Result
        status="403"
        title="This account cannot use the Content Studio"
        subTitle={`${user.email} is signed in as ${user.role}.`}
        extra={
          <Button type="primary" onClick={() => void auth.signOut()}>
            Sign out
          </Button>
        }
      />
    );
  }

  const visible = areasForRole(user.role);
  const groups = ["Content", "Library", "Site", "Administration"] as const;
  const items = groups
    .map((group) => ({
      type: "group" as const,
      label: group,
      children: visible
        .filter((area) => area.group === group)
        .map((area) => ({ key: area.path, label: area.label })),
    }))
    .filter((group) => group.children.length > 0);

  async function changePassword() {
    if (user === null) return;
    setChanging(true);
    const result = await request("/api/v1/auth/change-password", jsonInit("POST", { currentPassword, newPassword }));
    setChanging(false);
    if (!result.ok) {
      message.error(result.problem?.title ?? "The password was not changed.");
      return;
    }
    const next: StudioUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: false,
    };
    queryClient.setQueryData(sessionQueryKey, next);
    setCurrentPassword("");
    setNewPassword("");
    message.success("Password updated.");
  }

  return (
    <Layout className="min-h-svh">
      <Sider width={240} theme="light" className="border-r border-slate-200">
        <div className="flex items-center gap-3 px-4 py-5">
          <span aria-hidden="true" className="inline-block h-7 w-7 rounded-md" style={{ backgroundColor: brand.accent }} />
          <Typography.Text strong style={{ color: brand.primary }}>
            Content Studio
          </Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[visible.find((area) => location.pathname === area.path || location.pathname.startsWith(`${area.path}/`))?.path ?? location.pathname]}
          items={items}
          onClick={({ key }) => navigate(String(key))}
        />
      </Sider>
      <Layout>
        <Header
          className="flex items-center justify-end gap-3 px-6"
          style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}
        >
          <Typography.Text>{user.email}</Typography.Text>
          <Tag color="blue">{user.role}</Tag>
          <Button onClick={() => void auth.signOut()}>Sign out</Button>
        </Header>
        <Content className="p-6">
          {user.mustChangePassword ? (
            <Alert
              className="!mb-4"
              type="warning"
              showIcon
              message="You must change your temporary password before continuing."
            />
          ) : null}
          <Outlet />
        </Content>
      </Layout>
      <Modal title="Change password" open={user.mustChangePassword} closable={false} maskClosable={false} footer={null}>
        <Form layout="vertical" onFinish={() => void changePassword()}>
          <Form.Item label="Current password" required>
            <Input.Password value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </Form.Item>
          <Form.Item label="New password (min 12)" required>
            <Input.Password value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={changing} block>
            Update password
          </Button>
        </Form>
      </Modal>
    </Layout>
  );
}
