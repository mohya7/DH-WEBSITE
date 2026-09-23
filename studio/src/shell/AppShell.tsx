import { Button, Form, Input, Modal, Result, Spin, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { jsonInit, request } from "../api/http";
import { useAuth } from "../auth/AuthProvider";
import { collectionRoutes, websiteOrigin } from "../content/model";
import type { StudioUser } from "../auth/session";
import { queryClient, sessionQueryKey } from "../queryClient";
import { areasForRole, isStudioRole, type StudioArea } from "./areas";
import logo from "@digitalhub/theme/assets/digital-hub-logo.png";

const groups = ["Website content", "Website & system"] as const;

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const user = auth.user;
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (user === null || !isStudioRole(user.role)) return;
    let cancelled = false;
    async function loadCounts() {
      const next: Record<string, number> = {};
      const contact = await request("/api/v1/contact-requests/new-count");
      if (!cancelled && contact.ok && contact.body !== null) {
        next["/contact"] = (contact.body as { count: number }).count;
      }
      await Promise.all(collectionRoutes.map(async (route) => {
        const result = await request(`/api/v1/${route.collection}?pageSize=1`);
        if (!cancelled && result.ok && result.body !== null) {
          next[`/${route.path}`] = (result.body as { total: number }).total;
        }
      }));
      if (!cancelled) setCounts(next);
    }
    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [user, location.pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("globalSearch")?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(() => (user === null ? [] : areasForRole(user.role)), [user]);

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

  const signedIn = user;

  async function changePassword() {
    setChanging(true);
    const result = await request("/api/v1/auth/change-password", jsonInit("POST", { currentPassword, newPassword }));
    setChanging(false);
    if (!result.ok) {
      message.error(result.problem?.title ?? "The password was not changed.");
      return;
    }
    const next: StudioUser = {
      id: signedIn.id,
      email: signedIn.email,
      role: signedIn.role,
      mustChangePassword: false,
    };
    queryClient.setQueryData(sessionQueryKey, next);
    setCurrentPassword("");
    setNewPassword("");
    setPasswordOpen(false);
    message.success("Password updated.");
  }

  async function runGlobalSearch() {
    const query = search.trim();
    if (query.length === 0) return;
    for (const route of collectionRoutes) {
      const result = await request(`/api/v1/${route.collection}?pageSize=1&search=${encodeURIComponent(query)}`);
      if (result.ok && result.body !== null && (result.body as { total: number }).total > 0) {
        navigate(`/${route.path}?q=${encodeURIComponent(query)}`);
        return;
      }
    }
    message.error("No content matched this search.");
  }

  const initials = user.email.slice(0, 2).toUpperCase();
  const forcePassword = user.mustChangePassword;

  return (
    <div className={`studio-shell${collapsed ? " is-collapsed" : ""}`}>
      <aside className="studio-sidebar" id="sidebar">
        <a className="studio-brand" href={websiteOrigin} target="_blank" rel="noopener">
          <img src={logo} alt="Digital Hub" />
          <span>CONTENT STUDIO</span>
        </a>
        <nav className="studio-nav" aria-label="Studio">
          {visible.filter((area) => area.group === null).map((area) => (
            <NavLink key={area.path} to={area.path} end={area.path === "/"} className="studio-nav-link">
              <span>{area.label}</span>
            </NavLink>
          ))}
          {groups.map((group) => {
            const items = visible.filter((area) => area.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="studio-nav-group">
                <p className="studio-nav-label">{group.toUpperCase()}</p>
                {items.map((area) => (
                  <AreaLink key={area.path} area={area} count={counts[area.path]} />
                ))}
              </div>
            );
          })}
        </nav>
        <div className="studio-sidebar-foot">
          <div className="studio-health">
            <span className="studio-health-dot" />
            <div>
              <strong>Website connected</strong>
              <small>Content API</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="studio-workspace">
        <header className="studio-top">
          <Button className="icon-btn" aria-label="Toggle sidebar" aria-controls="sidebar" onClick={() => setCollapsed((value) => !value)}>
            Menu
          </Button>
          <label className="studio-search">
            <input
              id="globalSearch"
              type="search"
              placeholder="Search all content..."
              aria-label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void runGlobalSearch();
              }}
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="studio-top-actions">
            <a className="studio-view-site" href={websiteOrigin} target="_blank" rel="noopener">
              View website
            </a>
            <div>
              <button type="button" className="studio-user-chip" aria-label={`${user.email} account menu`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
                <span className="studio-user-avatar">{initials}</span>
                <span>
                  <strong>{user.email}</strong>
                  <small>{user.role === "admin" ? "Administrator" : "Editor"}</small>
                </span>
              </button>
              {menuOpen ? (
                <div className="ant-dropdown-menu" role="menu" style={{ position: "absolute", right: 34, marginTop: 8, minWidth: 210, padding: 6, borderRadius: 14 }}>
                  <Button type="text" block onClick={() => { setMenuOpen(false); setPasswordOpen(true); }}>
                    Change password
                  </Button>
                  <Button type="text" danger block onClick={() => void auth.signOut()}>
                    Sign out
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="studio-main">
          <Outlet />
        </main>
      </div>
      <Modal
        title="Change password"
        open={passwordOpen || forcePassword}
        closable={!forcePassword}
        maskClosable={!forcePassword}
        footer={null}
        onCancel={() => { if (!forcePassword) setPasswordOpen(false); }}
      >
        {forcePassword ? <p>You must change your temporary password before continuing.</p> : null}
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

function AreaLink({ area, count }: { area: StudioArea; count?: number }) {
  return (
    <NavLink to={area.path} className="studio-nav-link" aria-label={area.label}>
      <span>{area.label}</span>
      {count !== undefined && count > 0 ? <b>{count}</b> : null}
    </NavLink>
  );
}
