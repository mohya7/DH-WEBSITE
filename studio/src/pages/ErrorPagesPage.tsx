import { Button, Form, Input, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { jsonInit, request } from "../api/http";
import { RichTextEditor } from "../content/RichTextEditor";
import { PageHeader } from "../ui/PageHeader";

type ErrorPage = {
  type: string;
  id: string;
  title: string;
  body: string;
  version: number;
};

export function ErrorPagesPage() {
  const [items, setItems] = useState<ErrorPage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const result = await request("/api/v1/error-pages");
    if (!result.ok || result.body === null) {
      setError(result.problem?.title ?? "Error pages could not be loaded.");
      return;
    }
    setError(null);
    setItems((result.body as { items: ErrorPage[] }).items);
  }

  async function save(page: ErrorPage) {
    const result = await request(`/api/v1/error-pages/${page.type}`, jsonInit("PUT", {
      version: page.version,
      title: page.title,
      body: page.body,
    }));
    if (!result.ok || result.body === null) {
      setError(result.status === 409 ? "Someone else changed this page." : result.problem?.title ?? "The page was not saved.");
      return;
    }
    const saved = result.body as ErrorPage;
    setItems((current) => current.map((item) => (item.type === saved.type ? saved : item)));
    message.success(`${page.type} page saved.`);
  }

  function patch(type: string, update: Partial<ErrorPage>) {
    setItems((current) => current.map((item) => (item.type === type ? { ...item, ...update } : item)));
  }

  return (
    <section className="surface-card max-w-3xl">
      <PageHeader title="Error pages" />
      <Typography.Paragraph type="secondary">
        These pages use reserved slugs <code>error-404</code> and <code>error-500</code>.
      </Typography.Paragraph>
      {error !== null ? <Typography.Paragraph type="danger">{error}</Typography.Paragraph> : null}
      <div className="space-y-8">
        {items.map((page) => (
          <div key={page.type} className="section-card">
            <Typography.Title level={4}>{page.type} page</Typography.Title>
            <Form layout="vertical">
              <Form.Item label="Title">
                <Input value={page.title} onChange={(event) => patch(page.type, { title: event.target.value })} />
              </Form.Item>
              <Form.Item label="Body">
                <RichTextEditor value={page.body} onChange={(body) => patch(page.type, { body })} fieldPath={`error-${page.type}.body`} label="Body" />
              </Form.Item>
              <Button type="primary" onClick={() => void save(page)}>Save</Button>
            </Form>
          </div>
        ))}
      </div>
    </section>
  );
}
