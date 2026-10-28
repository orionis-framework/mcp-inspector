import type { JsonSchema } from "../../types/mcp";

export interface HeaderBinding {
  path: string[];
  header: string;
  type: string;
}
const token = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
export function encodeHeader(value: string | number | boolean): string {
  const text = String(value);
  if (
    /^[\x20-\x7e\t]*$/.test(text) &&
    text.trim() === text &&
    !(text.startsWith("=?base64?") && text.endsWith("?="))
  )
    return text;
  const bytes = new TextEncoder().encode(text);
  return `=?base64?${btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))}?=`;
}

/** Validate every annotation, including annotations hidden behind unsupported schema paths. */
export function headerBindings(schema: JsonSchema): HeaderBinding[] {
  const bindings: HeaderBinding[] = [];
  const names = new Set<string>();
  let nodes = 0;
  function walk(
    value: unknown,
    path: string[],
    reachable: boolean,
    depth: number,
  ): void {
    if (++nodes > 10000 || depth > 64)
      throw new Error("Schema exceeds inspection limits");
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((v) => walk(v, path, false, depth + 1));
      return;
    }
    const item = value as Record<string, unknown>;
    if ("x-mcp-header" in item) {
      const name = item["x-mcp-header"];
      if (
        !reachable ||
        path.length === 0 ||
        typeof name !== "string" ||
        !token.test(name)
      )
        throw new Error(
          "x-mcp-header must be a nonempty HTTP token on a statically reachable property",
        );
      if (!["integer", "string", "boolean"].includes(String(item.type)))
        throw new Error("x-mcp-header requires integer, string or boolean");
      if (names.has(name.toLowerCase()))
        throw new Error("x-mcp-header names must be case-insensitively unique");
      names.add(name.toLowerCase());
      bindings.push({
        path,
        header: `Mcp-Param-${name}`,
        type: String(item.type),
      });
    }
    for (const [key, child] of Object.entries(item)) {
      if (
        key === "properties" &&
        child &&
        typeof child === "object" &&
        !Array.isArray(child)
      ) {
        for (const [property, definition] of Object.entries(child))
          walk(definition, [...path, property], reachable, depth + 1);
      } else if (child && typeof child === "object") {
        walk(child, path, false, depth + 1);
      }
    }
  }
  walk(schema, [], true, 0);
  return bindings;
}

export function parameterHeaders(
  schema: JsonSchema,
  args: Record<string, unknown>,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const binding of headerBindings(schema)) {
    let value: unknown = args;
    for (const part of binding.path) {
      value =
        value && typeof value === "object" && Object.hasOwn(value, part)
          ? (value as Record<string, unknown>)[part]
          : undefined;
    }
    if (value === undefined || value === null) continue;
    if (
      (binding.type === "integer" && !Number.isSafeInteger(value)) ||
      (binding.type === "string" && typeof value !== "string") ||
      (binding.type === "boolean" && typeof value !== "boolean")
    )
      throw new Error(`Invalid value for ${binding.header}`);
    headers[binding.header] = encodeHeader(value as string | number | boolean);
  }
  return headers;
}
