import { Button, Checkbox, Input, InputNumber, Space } from "antd";
import { useState } from "react";
import { request } from "../api/http";
import { labelFromKey, referenceCollections } from "./model";
import { MediaPicker, type MediaChoice } from "./MediaPicker";
import { InlineTextEditor } from "./InlineTextEditor";
import { RichTextEditor } from "./RichTextEditor";
import { fieldLabel, kindOf, resolveSchema, type SchemaCatalog, type SchemaNode } from "./schemas";

type Value = Record<string, unknown>;

const allowAllMarks = () => true;

/**
 * inlineTextMarks: whether an inline-text field, by name, may carry bold,
 * italic, and links. The item editor passes the rule for each section
 * (model.ts, inlineMarksAllowed); a field without marks is edited as plain text.
 */
export function FormWalker({
  schema,
  catalog,
  value,
  onChange,
  fieldPath,
  inlineTextMarks = allowAllMarks,
}: {
  schema: SchemaNode;
  catalog: SchemaCatalog;
  value: Value;
  onChange: (value: Value) => void;
  fieldPath: string;
  inlineTextMarks?: (field: string) => boolean;
}) {
  const resolved = resolveSchema(schema, catalog.defs);
  const properties = resolved.properties ?? {};
  return (
    <div className="flex flex-col gap-4">
      {Object.entries(properties).map(([name, property]) => (
        <Field
          key={name}
          name={name}
          schema={resolveSchema(property, catalog.defs)}
          catalog={catalog}
          required={(resolved.required ?? []).includes(name)}
          value={value[name]}
          fieldPath={fieldPath.length === 0 ? name : `${fieldPath}.${name}`}
          onChange={(next) => onChange({ ...value, [name]: next })}
          inlineTextMarks={inlineTextMarks}
        />
      ))}
    </div>
  );
}

function Field({
  name,
  schema,
  catalog,
  required,
  value,
  onChange,
  fieldPath,
  inlineTextMarks,
}: {
  name: string;
  schema: SchemaNode;
  catalog: SchemaCatalog;
  required: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
  fieldPath: string;
  inlineTextMarks: (field: string) => boolean;
}) {
  const label = fieldLabel(name, schema);
  if (schema.oneOf !== undefined) {
    return <OneOfField label={label} schema={schema} catalog={catalog} value={value} onChange={onChange} fieldPath={fieldPath} inlineTextMarks={inlineTextMarks} />;
  }

  const kind = kindOf(schema);
  if (kind === "media" || kind === "reference") {
    return (
      <label className="block" data-field={fieldPath}>
        <span className="mb-1 block text-sm">
          {label}
          {required ? " *" : ""}
        </span>
        <Control kind={kind} schema={schema} value={value} onChange={onChange} />
      </label>
    );
  }

  if (schema.properties !== undefined) {
    const objectValue = isRecord(value) ? value : {};
    return (
      <fieldset data-field={fieldPath} className="section-card">
        <legend className="px-1 text-sm">{label}</legend>
        <FormWalker schema={schema} catalog={catalog} value={objectValue} onChange={onChange} fieldPath={fieldPath} inlineTextMarks={inlineTextMarks} />
      </fieldset>
    );
  }

  if (kind === "richText") {
    // Not a <label>: clicking a label activates its first button, which would toggle bold.
    return (
      <div className="block" data-field={fieldPath}>
        <span className="mb-1 block text-sm">
          {label}
          {required ? " *" : ""}
        </span>
        <RichTextEditor value={text(value)} onChange={onChange} fieldPath={fieldPath} label={label} />
      </div>
    );
  }

  if (kind === "inlineText") {
    // Not a <label>, for the same reason as rich text.
    return (
      <div className="block" data-field={fieldPath}>
        <span className="mb-1 block text-sm">
          {label}
          {required ? " *" : ""}
        </span>
        <InlineTextEditor value={text(value)} onChange={onChange} fieldPath={fieldPath} allowMarks={inlineTextMarks(name)} label={label} />
      </div>
    );
  }

  if ((schema.type === "array" || (Array.isArray(schema.type) && schema.type.includes("array"))) && schema.items !== undefined) {
    return <ArrayField label={label} schema={schema} catalog={catalog} value={value} onChange={onChange} fieldPath={fieldPath} inlineTextMarks={inlineTextMarks} />;
  }

  return (
    <label className="block" data-field={fieldPath}>
      <span className="mb-1 block text-sm">
        {label}
        {required ? " *" : ""}
      </span>
      <Control kind={kind} schema={schema} value={value} onChange={onChange} />
    </label>
  );
}

function Control({
  kind,
  schema,
  value,
  onChange,
}: {
  kind: string;
  schema: SchemaNode;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [picker, setPicker] = useState(false);
  if (kind === "longText") {
    return <Input.TextArea rows={4} value={text(value)} onChange={(event) => onChange(event.target.value)} />;
  }
  if (kind === "boolean") {
    return <Checkbox checked={value === true} onChange={(event) => onChange(event.target.checked)}>{text(value) === "" ? "Yes" : ""}</Checkbox>;
  }
  if (kind === "number") {
    return <InputNumber value={typeof value === "number" ? value : undefined} onChange={(next) => onChange(next)} />;
  }
  if (kind === "date") {
    // A calendar date picker. The native input's value is already YYYY-MM-DD: no Date
    // object and no time zone, so the stored day is the day picked. Cleared is null.
    return <input type="date" className="native-control" value={text(value)} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)} />;
  }
  if (kind === "media" || schema.properties?.mediaId !== undefined) {
    const media = isRecord(value) ? value : { mediaId: "", alt: "", decorative: false };
    return (
      <div className="flex flex-col gap-2">
        <Space>
          <Button onClick={() => setPicker(true)}>{typeof media.mediaId === "string" && media.mediaId.length > 0 ? "Change image" : "Choose image"}</Button>
        </Space>
        <Input placeholder="Alt text for this use" value={text(media.alt)} onChange={(event) => onChange({ ...media, alt: event.target.value })} />
        <Checkbox checked={media.decorative === true} onChange={(event) => onChange({ ...media, decorative: event.target.checked })}>
          Decorative for this use
        </Checkbox>
        <MediaPicker
          open={picker}
          onClose={() => setPicker(false)}
          onSelect={(choice) => {
            onChange({ mediaId: choice.id, alt: text(media.alt) || choice.alt, decorative: media.decorative === true });
            setPicker(false);
          }}
        />
      </div>
    );
  }
  if (kind === "mediaId") {
    return (
      <Space>
        <Input value={text(value)} readOnly placeholder="No image" />
        <Button onClick={() => setPicker(true)}>Choose image</Button>
        <Button onClick={() => onChange(null)}>Clear</Button>
        <MediaPicker
          open={picker}
          onClose={() => setPicker(false)}
          onSelect={(choice: MediaChoice) => {
            onChange(choice.id);
            setPicker(false);
          }}
        />
      </Space>
    );
  }
  if (kind === "reference" || (schema.properties?.type !== undefined && schema.properties.id !== undefined)) {
    return <ReferenceField value={value} schema={schema} onChange={onChange} />;
  }
  if (schema.enum !== undefined) {
    return (
      <select className="native-control" value={text(value)} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose</option>
        {schema.enum.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }
  return <Input value={text(value)} onChange={(event) => onChange(event.target.value)} />;
}

/**
 * Picks a content item for a { type, id } reference. The types offered are the
 * schema's enum (defs.json: service, partner, case study, blog post, page), each
 * searched in its collection. Changing the type clears the search, so a hit from
 * the previous collection can never be saved under the new type.
 */
function ReferenceField({
  value,
  schema,
  onChange,
}: {
  value: unknown;
  schema: SchemaNode;
  onChange: (value: unknown) => void;
}) {
  const current = isRecord(value) ? value : { type: schema.properties?.type?.enum?.[0] ?? "service", id: "" };
  const options = schema.properties?.type?.enum ?? Object.keys(referenceCollections);
  const type = text(current.type) || options[0] || "service";
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([]);

  async function find(term: string) {
    const collection = referenceCollections[type];
    if (collection === undefined) return;
    const result = await request(`/api/v1/${collection}?pageSize=8&search=${encodeURIComponent(term)}`);
    if (!result.ok || result.body === null) return;
    setItems((result.body as { items: Array<{ id: string; title: string }> }).items);
  }

  return (
    <div className="flex flex-col gap-2" data-check="references">
      <select
        className="native-control"
        aria-label="Linked item type"
        value={type}
        onChange={(event) => {
          setSearch("");
          setItems([]);
          onChange({ type: event.target.value, id: "" });
        }}
      >
        {options.map((option) => (
          <option key={option} value={option}>{labelFromKey(option)}</option>
        ))}
      </select>
      <Input
        placeholder="Search the linked item"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          void find(event.target.value);
        }}
      />
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className="reference-hit py-1" onClick={() => onChange({ type, id: item.id })}>
              {item.title}
            </button>
          </li>
        ))}
      </ul>
      <span className="text-xs" style={{ color: "var(--dh-text-muted)" }}>{text(current.id).length > 0 ? `Linked item ${text(current.id)}` : "No item chosen. An empty title uses the linked item."}</span>
    </div>
  );
}

function ArrayField({
  label,
  schema,
  catalog,
  value,
  onChange,
  fieldPath,
  inlineTextMarks,
}: {
  label: string;
  schema: SchemaNode;
  catalog: SchemaCatalog;
  value: unknown;
  onChange: (value: unknown) => void;
  fieldPath: string;
  inlineTextMarks: (field: string) => boolean;
}) {
  const items = Array.isArray(value) ? value : [];
  const itemSchema = schema.items === undefined ? {} : resolveSchema(schema.items, catalog.defs);
  const objectItem = itemSchema.properties !== undefined || itemSchema.oneOf !== undefined;
  return (
    <div data-field={fieldPath}>
      <div className="mb-2 text-sm">{label}</div>
      <div className="flex flex-col gap-3">
        {items.map((item, index) => (
          <div key={index} className="section-card">
            {objectItem ? (
              <FormWalker
                schema={itemSchema.oneOf !== undefined ? branchFor(itemSchema, item) : itemSchema}
                catalog={catalog}
                value={isRecord(item) ? item : {}}
                onChange={(next) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? next : entry)))}
                fieldPath={`${fieldPath}[${index}]`}
                inlineTextMarks={inlineTextMarks}
              />
            ) : (
              <Input
                value={text(item)}
                onChange={(event) => onChange(items.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry)))}
              />
            )}
            <Button className="mt-2" onClick={() => onChange(items.filter((_, entryIndex) => entryIndex !== index))}>Remove</Button>
          </div>
        ))}
      </div>
      <Button
        className="mt-2"
        onClick={() => onChange([...items, objectItem ? defaultObject(itemSchema) : ""])}
      >
        Add {label.toLowerCase()}
      </Button>
    </div>
  );
}

function OneOfField({
  label,
  schema,
  catalog,
  value,
  onChange,
  fieldPath,
  inlineTextMarks,
}: {
  label: string;
  schema: SchemaNode;
  catalog: SchemaCatalog;
  value: unknown;
  onChange: (value: unknown) => void;
  fieldPath: string;
  inlineTextMarks: (field: string) => boolean;
}) {
  const branches = (schema.oneOf ?? []).map((branch) => resolveSchema(branch, catalog.defs));
  const current = isRecord(value) ? text(value.kind) : "";
  const selected = branches.find((branch) => branch.properties?.kind?.const === current) ?? branches[0];
  if (selected === undefined) return null;
  const kind = selected.properties?.kind?.const ?? "";
  return (
    <div data-field={fieldPath}>
      <div className="mb-2 text-sm">{label}</div>
      <select
        className="native-control mb-2"
        value={kind}
        onChange={(event) => {
          const next = branches.find((branch) => branch.properties?.kind?.const === event.target.value);
          onChange(next === undefined ? {} : defaultObject(next));
        }}
      >
        {branches.map((branch) => (
          <option key={branch.properties?.kind?.const} value={branch.properties?.kind?.const}>{branch.properties?.kind?.const}</option>
        ))}
      </select>
      <FormWalker schema={selected} catalog={catalog} value={isRecord(value) ? value : {}} onChange={onChange} fieldPath={fieldPath} inlineTextMarks={inlineTextMarks} />
    </div>
  );
}

function branchFor(schema: SchemaNode, value: unknown): SchemaNode {
  const branches = schema.oneOf ?? [];
  const kind = isRecord(value) ? text(value.kind) : "";
  return branches.find((branch) => branch.properties?.kind?.const === kind) ?? branches[0] ?? {};
}

function defaultObject(schema: SchemaNode): Value {
  const value: Value = {};
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    if (property.const !== undefined) value[name] = property.const;
  }
  return value;
}

function isRecord(value: unknown): value is Value {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
