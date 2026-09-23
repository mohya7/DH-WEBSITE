import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "../api/http";
import { useAuth } from "../auth/AuthProvider";
import { collectionRoutes } from "../content/model";

type Stats = {
  total: number;
  published: number;
  drafts: number;
  byCollection: Array<{ path: string; label: string; total: number }>;
};

type Activity = { id: string; action: string; entityType: string; at: string; detail?: string | null };

export function OverviewPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, drafts: 0, byCollection: [] });
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const rows = await Promise.all(collectionRoutes.map(async (route) => {
      const result = await request(`/api/v1/${route.collection}?pageSize=100`);
      if (!result.ok || result.body === null) {
        return { path: route.path, label: route.label, items: [] as Array<{ status: string }> };
      }
      return { path: route.path, label: route.label, items: (result.body as { items: Array<{ status: string }> }).items };
    }));
    const items = rows.flatMap((row) => row.items);
    setStats({
      total: items.length,
      published: items.filter((item) => item.status === "published").length,
      drafts: items.filter((item) => item.status === "draft").length,
      byCollection: rows.map((row) => ({ path: row.path, label: row.label, total: row.items.length })),
    });
    if (auth.user?.role === "admin") {
      const audit = await request("/api/v1/audit?pageSize=8");
      if (audit.ok && audit.body !== null) {
        setActivity((audit.body as { items: Activity[] }).items);
      }
    }
  }

  return (
    <section>
      <div className="section-title-row">
        <div>
          <span className="page-kicker">DIGITAL HUB CMS</span>
          <h1>Overview</h1>
          <p>Published cards, drafts, and recent changes.</p>
        </div>
        <div className="flex gap-2">
          <button className="edit-btn" type="button" onClick={() => navigate("/pages")}>Pages</button>
          <button className="edit-btn" type="button" onClick={() => navigate("/contact")}>Inbox</button>
        </div>
      </div>
      <div className="stats-grid">
        <article className="stat-card"><span>Total cards</span><strong>{stats.total}</strong></article>
        <article className="stat-card"><span>Published content</span><strong>{stats.published}</strong></article>
        <article className="stat-card"><span>Drafts</span><strong>{stats.drafts}</strong></article>
        <article className="stat-card"><span>Collections</span><strong>{stats.byCollection.length}</strong></article>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel">
          <h2>Recent activity</h2>
          <p style={{ color: "var(--dh-text-muted)", fontSize: 11 }}>Latest changes in this workspace</p>
          {activity.length === 0 ? <p>No recent activity to show.</p> : (
            <ul>
              {activity.map((row) => (
                <li key={row.id} className="mb-2">
                  <strong>{row.action}</strong> {row.entityType} {row.detail ?? ""}
                  <small style={{ display: "block", color: "var(--dh-text-muted)" }}>{new Date(row.at).toLocaleString()}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <h2>Content distribution</h2>
          {stats.byCollection.map((row) => (
            <div key={row.path} className="mb-2 flex justify-between text-sm">
              <span>{row.label}</span>
              <strong>{row.total}</strong>
            </div>
          ))}
        </section>
      </div>
      <section className="panel quick-panel mt-4">
        <h2>Quick actions</h2>
        <div className="quick-grid">
          <button type="button" onClick={() => navigate("/blog-posts")}>
            <span><strong>New article</strong><small>Open the blog list</small></span>
          </button>
          <button type="button" onClick={() => navigate("/case-studies")}>
            <span><strong>New case study</strong><small>Document a result</small></span>
          </button>
          <button type="button" onClick={() => navigate("/contact")}>
            <span><strong>Inbox</strong><small>Sales and enquiry inbox</small></span>
          </button>
        </div>
      </section>
    </section>
  );
}
