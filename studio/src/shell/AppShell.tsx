import { Button, Layout, Menu, Result, Spin, Tag, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { brand } from "../theme";
import { areasForRole, isStudioRole } from "./areas";
import { useAuth } from "../auth/AuthProvider";

const { Header, Sider, Content } = Layout;

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const user = auth.user;

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
          selectedKeys={[location.pathname]}
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
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
