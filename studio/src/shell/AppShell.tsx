import { Alert, Button, Form, Input, Modal, Result, Spin, message } from "antd";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { jsonInit, request } from "../api/http";
import { useAuth } from "../auth/AuthProvider";
import type { StudioUser } from "../auth/session";
import { queryClient, sessionQueryKey } from "../queryClient";
import { StatusChip } from "../ui/StatusChip";
import { areasForRole, isStudioRole, type StudioArea } from "./areas";
import logo from "@digitalhub/theme/assets/digital-hub-logo.png";

const groups = ["Content", "Library", "Site", "Administration"] as const;

const groupIcons: Record<(typeof groups)[number], string> = {
  Content:
    "M3 3.5h10v3H3zM3 8h6v2H3zM3 11.5h8v1.5H3z",
  Library:
    "M2.5 3h3v10h-3zM6.5 3h3v10h-3zM10.5 3H13.5v10H10.5z",
  Site:
    "M8 2.5 13.5 6v7.5h-11V6z",
  Administration:
    "M8 3.2a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zM3.5 13.2c.4-2.2 2.2-3.4 4.5-3.4s4.1 1.2 4.5 3.4",
};

function groupOf(pathname: string, visible: StudioArea[]): (typeof groups)[number] {
  const match = visible.find((area) => pathname === area.path || pathname.startsWith(`${area.path}/`));
  return match?.group ?? "Content";
}

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const user = auth.user;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [newContacts, setNewContacts] = useState(0);

  useEffect(() => {
    if (user === null || !isStudioRole(user.role)) return;
    let cancelled = false;
    async function loadCount() {
      const result = await request("/api/v1/contact-requests/new-count");
      if (cancelled || !result.ok || result.body === null) return;
      setNewContacts((result.body as { count: number }).count);
    }
    void loadCount();
    const timer = window.setInterval(() => void loadCount(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user, location.pathname]);

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
  const availableGroups = groups.filter((group) => visible.some((area) => area.group === group));
  const currentGroup = groupOf(location.pathname, visible);
  const pills = visible.filter((area) => area.group === currentGroup);

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
    <div className="studio-shell">
      <nav className="studio-rail" aria-label="Studio">
        <img className="studio-rail-logo" src={logo} alt="Digital Hub" />
        {availableGroups.map((group) => {
          const first = visible.find((area) => area.group === group);
          if (first === undefined) return null;
          const active = currentGroup === group;
          return (
            <button
              key={group}
              type="button"
              className="studio-rail-item"
              aria-current={active ? "true" : undefined}
              onClick={() => navigate(first.path)}
            >
              <span className="studio-rail-disk" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d={groupIcons[group]} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
              </span>
              {group}
            </button>
          );
        })}
      </nav>
      <div className="studio-main">
        <header className="studio-top">
          <nav className="studio-pills" aria-label={currentGroup}>
            {pills.map((area) => (
              <NavLink
                key={area.path}
                to={area.path}
                role="menuitem"
                aria-label={area.label}
                className="studio-pill"
                aria-current={location.pathname === area.path || location.pathname.startsWith(`${area.path}/`) ? "page" : undefined}
              >
                {area.label}
                {area.path === "/contact" && newContacts > 0 ? (
                  <span className="studio-pill-dot" aria-hidden="true" />
                ) : null}
              </NavLink>
            ))}
          </nav>
          <div className="studio-user">
            <span>{user.email}</span>
            <StatusChip state={user.role} />
            <Button onClick={() => void auth.signOut()}>Sign out</Button>
          </div>
        </header>
        <main>
          {user.mustChangePassword ? (
            <Alert
              className="!mb-4"
              type="warning"
              showIcon
              message="You must change your temporary password before continuing."
            />
          ) : null}
          <Outlet />
        </main>
      </div>
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
    </div>
  );
}
