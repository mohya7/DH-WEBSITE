import { Button, Form, Input, Modal, Typography } from "antd";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { jsonInit, request } from "../api/http";
import { MediaPicker } from "../content/MediaPicker";
import { PageHeader } from "../ui/PageHeader";

type MediaRow = {
  id: string;
  path: string;
  alt: string;
  caption?: string | null;
  decorative: boolean;
  originalName: string;
};

type MediaPage = { items: MediaRow[]; total: number };

export function MediaLibraryPage() {
  const auth = useAuth();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<MediaRow[]>([]);
  const [selected, setSelected] = useState<MediaRow | null>(null);
  const [usages, setUsages] = useState<string[]>([]);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [decorative, setDecorative] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load(term = search) {
    const result = await request(`/api/v1/media?pageSize=48&search=${encodeURIComponent(term)}`);
    if (!result.ok || result.body === null) {
      setMessage(result.problem?.title ?? "The library could not be loaded.");
      return;
    }
    setItems((result.body as MediaPage).items);
  }

  async function open(row: MediaRow) {
    setSelected(row);
    setAlt(row.alt);
    setCaption(row.caption ?? "");
    setDecorative(row.decorative);
    setMessage(null);
    const result = await request(`/api/v1/media/${row.id}`);
    if (!result.ok || result.body === null) return;
    const detail = result.body as { image: MediaRow; usages: string[] };
    setUsages(detail.usages);
    setAlt(detail.image.alt);
    setCaption(detail.image.caption ?? "");
    setDecorative(detail.image.decorative);
  }

  async function save() {
    if (selected === null) return;
    const result = await request(`/api/v1/media/${selected.id}`, jsonInit("PUT", { alt, caption, decorative }));
    if (!result.ok) {
      setMessage(result.problem?.title ?? "The image was not saved.");
      return;
    }
    setMessage("Saved.");
    await load();
  }

  async function remove() {
    if (selected === null) return;
    const result = await request(`/api/v1/media/${selected.id}`, { method: "DELETE" });
    if (!result.ok) {
      const places = result.problem?.usages ?? [];
      setMessage(places.length > 0 ? `This image is used, so it was not deleted. ${places.join("; ")}` : result.problem?.title ?? "The image was not deleted.");
      if (places.length > 0) setUsages(places);
      return;
    }
    setSelected(null);
    await load();
  }

  return (
    <section className="surface-card">
      <PageHeader
        title="Media library"
        extra={<Button type="primary" onClick={() => setUpload(true)}>Upload</Button>}
      />
      <Input.Search className="mb-4 max-w-md" placeholder="Search alt text, caption, or file name" value={search} onChange={(event) => setSearch(event.target.value)} onSearch={(value) => void load(value)} allowClear />
      {message !== null && selected === null ? <Typography.Paragraph>{message}</Typography.Paragraph> : null}
      <div className="grid grid-cols-4 gap-4">
        {items.map((item) => (
          <button key={item.id} type="button" className="media-tile" onClick={() => void open(item)}>
            <img src={item.path} alt={item.alt} className="mb-2 h-28 w-full object-contain" />
            <span className="line-clamp-2 text-sm">{item.alt || item.originalName}</span>
          </button>
        ))}
      </div>
      <Modal title="Image" open={selected !== null} onCancel={() => setSelected(null)} footer={null} width={640}>
        {selected !== null ? (
          <Form layout="vertical">
            <img src={selected.path} alt={alt} className="mb-4 max-h-60 object-contain" />
            <Form.Item label="Alt text">
              <Input value={alt} onChange={(event) => setAlt(event.target.value)} />
            </Form.Item>
            <Form.Item label="Caption">
              <Input value={caption} onChange={(event) => setCaption(event.target.value)} />
            </Form.Item>
            <label className="mb-3 flex items-center gap-2">
              <input type="checkbox" checked={decorative} onChange={(event) => setDecorative(event.target.checked)} />
              Decorative
            </label>
            <Typography.Title level={5}>Used in</Typography.Title>
            {usages.length === 0 ? <Typography.Paragraph>This image is not used.</Typography.Paragraph> : (
              <ul className="mb-4 list-disc pl-5">{usages.map((place) => <li key={place}>{place}</li>)}</ul>
            )}
            {message !== null ? <Typography.Paragraph>{message}</Typography.Paragraph> : null}
            <div className="flex gap-2">
              <Button type="primary" onClick={() => void save()}>Save</Button>
              {auth.user?.role === "admin" ? <Button danger onClick={() => void remove()}>Delete</Button> : null}
            </div>
          </Form>
        ) : null}
      </Modal>
      <MediaPicker open={upload} onClose={() => { setUpload(false); void load(); }} onSelect={() => { setUpload(false); void load(); }} />
    </section>
  );
}
