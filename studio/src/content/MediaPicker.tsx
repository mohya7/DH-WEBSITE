import { Button, Checkbox, Form, Input, Modal, Upload, Typography, type UploadFile } from "antd";
import { useRef, useState } from "react";
import { request } from "../api/http";
import { ListPager } from "../ui/ListPager";
import { latestOnly, withPage } from "../ui/paging";

export type MediaChoice = {
  id: string;
  path: string;
  alt: string;
};

type MediaRow = {
  id: string;
  path: string;
  alt: string;
  originalName: string;
  caption?: string | null;
};

type MediaPage = {
  items: MediaRow[];
  total: number;
};

const pageSize = 24;

const paths = new Map<string, string>();

export function rememberMedia(id: string, path: string) {
  paths.set(id, path);
}

export function rememberedMedia(id: string): string | undefined {
  return paths.get(id);
}

export function MediaPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (choice: MediaChoice) => void;
}) {
  // What is in the search box, and the search last submitted. Every list
  // request uses the submitted one.
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [current, setCurrent] = useState(1);
  const [total, setTotal] = useState(0);
  const requests = useRef(latestOnly());
  const [items, setItems] = useState<MediaRow[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [decorative, setDecorative] = useState(false);

  async function load(term: string, pageNumber: number) {
    const ticket = requests.current.start();
    const result = await request(`/api/v1/media?${withPage(new URLSearchParams({ search: term }), pageNumber, pageSize)}`);
    if (!requests.current.isLatest(ticket)) return;
    if (!result.ok || result.body === null) {
      setMessage(result.problem?.title ?? "The library could not be loaded.");
      return;
    }

    const page = result.body as MediaPage;
    for (const item of page.items) rememberMedia(item.id, item.path);
    setCurrent(pageNumber);
    setTotal(page.total);
    setItems(page.items);
  }

  // The pager moves when the page arrives (load), so after a failure it still
  // shows the page whose rows are on screen.
  function goTo(pageNumber: number) {
    void load(applied, pageNumber);
  }

  function submitSearch(term: string) {
    setApplied(term);
    void load(term, 1);
  }

  async function upload() {
    const file = fileList[0]?.originFileObj;
    if (file === undefined) {
      setMessage("Choose an image to upload.");
      return;
    }

    const body = new FormData();
    body.set("file", file);
    body.set("alt", alt);
    body.set("decorative", String(decorative));
    const result = await request("/api/v1/media", { method: "POST", body });
    if (!result.ok || result.body === null) {
      setMessage(result.problem?.title ?? "The upload was refused.");
      return;
    }

    const created = result.body as MediaRow;
    rememberMedia(created.id, created.path);
    onSelect({ id: created.id, path: created.path, alt: created.alt });
    setFileList([]);
    setAlt("");
    setDecorative(false);
  }

  return (
    <Modal
      title="Choose an image"
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      afterOpenChange={(visible) => {
        // Each opening starts on page 1 with the applied search, and the box
        // shows that search, so the box and the images agree.
        if (visible) {
          setSearch(applied);
          void load(applied, 1);
        }
      }}
    >
      <div className="mb-3 flex gap-2">
        <Input.Search
          placeholder="Search alt text, caption, or file name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onSearch={(value) => submitSearch(value)}
          allowClear
        />
      </div>
      {message !== null ? <Typography.Paragraph type="danger">{message}</Typography.Paragraph> : null}
      <div className="mb-4 grid grid-cols-4 gap-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="media-tile"
            onClick={() => onSelect({ id: item.id, path: item.path, alt: item.alt })}
          >
            <img src={item.path} alt={item.alt} className="mb-2 h-20 w-full object-contain" />
            <span className="line-clamp-2 text-xs">{item.alt || item.originalName}</span>
          </button>
        ))}
      </div>
      <ListPager label="Image picker pages" current={current} pageSize={pageSize} total={total} onChange={goTo} size="small" />
      <Typography.Title level={5}>Upload</Typography.Title>
      <Form layout="vertical">
        <Form.Item label="File">
          <Upload
            maxCount={1}
            fileList={fileList}
            beforeUpload={() => false}
            onChange={({ fileList: next }) => {
              setFileList(next.slice(-1).map((entry) => ({ ...entry, status: "done" })));
            }}
            onRemove={() => setFileList([])}
          >
            <Button>Choose file</Button>
          </Upload>
        </Form.Item>
        <Form.Item label="Alt text" required={!decorative}>
          <Input value={alt} onChange={(event) => setAlt(event.target.value)} />
        </Form.Item>
        <Checkbox checked={decorative} onChange={(event) => setDecorative(event.target.checked)}>
          Decorative
        </Checkbox>
        <div className="mt-3">
          <Button type="primary" onClick={() => void upload()}>
            Upload and use
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
