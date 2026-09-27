/*
 * rich_text: a labelled block of prose. On case studies it is the "Solution" and
 * "Results" blocks (.cs-section) with paragraph and list blocks; its TipTap body,
 * where there is one (the 404 and 500 pages), renders in the same block.
 */
import type { BlockContext } from "../context";
import type { RichTextFields } from "../generated/schema-types";
import { parseRichText } from "../richtext/document";
import { RichText } from "../richtext/RichText";
import { Prose } from "./Prose";

export function RichTextSection({ fields, ctx }: { fields: RichTextFields; ctx: BlockContext }) {
  return (
    <Prose eyebrow={fields.eyebrow} heading={fields.heading} blocks={fields.blocks}>
      <RichText doc={parseRichText(fields.body)} ctx={ctx} />
    </Prose>
  );
}
