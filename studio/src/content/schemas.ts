import { useQuery } from "@tanstack/react-query";
import { request } from "../api/http";

export type SchemaNode = {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  required?: string[];
  enum?: (string | null)[];
  oneOf?: SchemaNode[];
  const?: string;
  "x-dh-kind"?: string;
  "x-dh-label"?: string;
  "x-dh-help"?: string;
};

export type SchemaCatalog = {
  defs: { $defs?: Record<string, SchemaNode> };
  sections: Record<string, SchemaNode>;
  collections: Record<string, SchemaNode>;
};

export function useSchemas() {
  return useQuery({
    queryKey: ["schemas"],
    queryFn: async () => {
      const result = await request("/api/v1/schemas");
      if (!result.ok || result.body === null) {
        throw new Error(result.problem?.title ?? "The form registry could not be loaded.");
      }

      return result.body as SchemaCatalog;
    },
    staleTime: Infinity,
  });
}

export function resolveSchema(node: SchemaNode, defs: SchemaCatalog["defs"]): SchemaNode {
  if (node.$ref === undefined) {
    return node;
  }

  const name = node.$ref.split("/").pop();
  const resolved = name === undefined ? undefined : defs.$defs?.[name];
  return resolved ?? node;
}

export function kindOf(node: SchemaNode): string {
  return node["x-dh-kind"] ?? (Array.isArray(node.type) ? node.type.find((item) => item !== "null") : node.type) ?? "text";
}

export function fieldLabel(name: string, node: SchemaNode): string {
  return node["x-dh-label"] ?? name.replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}
