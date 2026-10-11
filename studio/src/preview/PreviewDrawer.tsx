/*
 * The draft preview (Phase C, 9.1): the item's sections as the website renders them,
 * in an iframe. The iframe is sandboxed without scripts and gets its document as
 * srcdoc, so the website's stylesheets apply only inside it and the Studio's never
 * reach it. It previews what is on screen, saved or not.
 */
import { useQuery } from "@tanstack/react-query";
import { Alert, Drawer, Typography } from "antd";
import { useEffect, useState } from "react";
import { websiteOrigin } from "../content/model";
import { renderSections, previewDocument, type PreviewInput } from "./previewDocument";
import { loadMedia, loadPreviewData, type PreviewMedia } from "./previewData";

export function PreviewDrawer({ open, onClose, input }: { open: boolean; onClose: () => void; input: PreviewInput }) {
  const data = useQuery({ queryKey: ["preview-data"], queryFn: loadPreviewData, enabled: open, staleTime: 30_000 });
  const [media, setMedia] = useState(() => new Map<string, PreviewMedia | null>());
  const origin = window.location.origin;
  const result = data.data === undefined ? null : renderSections(input, data.data, media, origin);
  const missing = result?.missingMedia.join(",") ?? "";

  useEffect(() => {
    if (!open || missing === "") return;
    let cancelled = false;
    void Promise.all(missing.split(",").map(async (id) => [id, await loadMedia(id)] as const)).then((loaded) => {
      if (cancelled) return;
      setMedia((current) => {
        const next = new Map(current);
        for (const [id, asset] of loaded) next.set(id, asset);
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, missing]);

  const ready = result !== null && result.missingMedia.length === 0;
  return (
    <Drawer title="Preview" open={open} onClose={onClose} size="min(1280px, 96vw)" destroyOnHidden>
      {data.isError ? <Alert type="error" showIcon title={data.error instanceof Error ? data.error.message : "The preview could not be loaded."} /> : null}
      {result !== null && result.failed.length > 0 ? (
        <Alert
          className="!mb-3"
          type="warning"
          showIcon
          title={`Not shown: ${result.failed.map((entry) => `section ${entry.index + 1} (${entry.type})`).join(", ")}. Finish its fields to preview it.`}
        />
      ) : null}
      {ready ? (
        <iframe
          title="Website preview"
          className="block w-full"
          style={{ height: "78vh", border: "1px solid var(--dh-border, #d9d9d9)", borderRadius: 8, background: "#fff" }}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          srcDoc={previewDocument(input, result.html, websiteOrigin, origin)}
        />
      ) : data.isError ? null : <Typography.Paragraph>Loading the preview…</Typography.Paragraph>}
    </Drawer>
  );
}
