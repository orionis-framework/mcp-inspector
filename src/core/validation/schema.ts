import Ajv from "ajv";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { AnySchema, ValidateFunction } from "ajv";
import type { SchemaResult } from "./types";

const options = {
  allErrors: true,
  strict: false,
  ownProperties: true,
  addUsedSchema: false,
  inlineRefs: false,
  loopRequired: 50,
  loopEnum: 50,
};
const draft7 = new Ajv(options);
const draft2020 = new Ajv2020(options);
addFormats(draft7);
addFormats(draft2020);
const cache = new Map<string, ValidateFunction>();
const ok = (): SchemaResult => ({ valid: true, schemaValid: true, errors: [] });
const invalid = (message: string, limited = false): SchemaResult => ({
  valid: false,
  schemaValid: false,
  errors: [message],
  ...(limited ? { limited } : {}),
});

/** No network reference resolution. Large/complex inputs are explicitly not verified. */
function guard(value: unknown, maxBytes: number): string | undefined {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return "Cyclic or non-JSON input cannot be inspected.";
  }
  if (!serialized || serialized.length > maxBytes)
    return `Inspection limit exceeded (${maxBytes} characters).`;
  let count = 0;
  function visit(node: unknown, depth: number): string | undefined {
    if (++count > 4_000 || depth > 32)
      return "Inspection depth or node limit exceeded.";
    if (node && typeof node === "object") {
      for (const child of Object.values(node)) {
        const error = visit(child, depth + 1);
        if (error) return error;
      }
    }
  }
  return visit(value, 0);
}

function compile(schema: unknown): {
  validator?: ValidateFunction;
  result: SchemaResult;
} {
  if (!schema || typeof schema !== "object" || Array.isArray(schema))
    return { result: invalid("MCP schemas must be JSON Schema objects.") };
  const limit = guard(schema, 100_000);
  if (limit) return { result: invalid(limit, true) };
  const object = schema as Record<string, unknown>;
  const dialect = object.$schema;
  const use7 =
    dialect === "http://json-schema.org/draft-07/schema#" ||
    dialect === "https://json-schema.org/draft-07/schema#" ||
    dialect === "http://json-schema.org/draft-07/schema";
  if (
    dialect !== undefined &&
    !use7 &&
    dialect !== "https://json-schema.org/draft/2020-12/schema" &&
    dialect !== "https://json-schema.org/draft/2020-12/schema#"
  ) {
    return {
      result: invalid(
        `Unsupported schema dialect: ${String(dialect)}. Supported: 2020-12 (default), draft-07.`,
        true,
      ),
    };
  }
  let restricted: string | undefined;
  let references = 0;
  let compositions = 0;
  const riskyPattern = (pattern: string): boolean =>
    pattern.length > 128 ||
    /\\[1-9]|\(\?/.test(pattern) ||
    (pattern.match(/(?<!\\)[+*{]/g)?.length ?? 0) > 1 ||
    /\)[+*{]/.test(pattern);
  function visit(node: unknown, compositionDepth = 0): void {
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      if (key === "$ref" || key === "$dynamicRef") references++;
      if (
        (key === "$ref" || key === "$dynamicRef") &&
        typeof child === "string" &&
        !child.startsWith("#")
      )
        restricted =
          "External schema references are not fetched. Supply a self-contained schema.";
      // Reject constructs capable of disproportionate browser CPU consumption.
      if (
        (key === "pattern" &&
          typeof child === "string" &&
          riskyPattern(child)) ||
        (key === "patternProperties" &&
          child &&
          typeof child === "object" &&
          Object.keys(child).some(riskyPattern))
      )
        restricted =
          "Complex regular expressions require offline validation; browser execution is limited.";
      const isComposition = [
        "anyOf",
        "oneOf",
        "allOf",
        "if",
        "then",
        "else",
      ].includes(key);
      if (isComposition) compositions++;
      if (
        compositionDepth > 8 ||
        compositions > 64 ||
        references > 64 ||
        (isComposition && Array.isArray(child) && child.length > 12)
      )
        restricted =
          "Schema composition or reference complexity exceeds browser inspection limits.";
      visit(child, compositionDepth + (isComposition ? 1 : 0));
    }
  }
  visit(schema);
  if (restricted) return { result: invalid(restricted, true) };
  const key = JSON.stringify(schema);
  const existing = cache.get(key);
  if (existing) return { validator: existing, result: ok() };
  try {
    const effectiveSchema = use7
      ? { ...object, $schema: "http://json-schema.org/draft-07/schema#" }
      : schema;
    const validator = (use7 ? draft7 : draft2020).compile(
      effectiveSchema as AnySchema,
    );
    if (cache.size >= 100) cache.clear();
    cache.set(key, validator);
    return { validator, result: ok() };
  } catch (error) {
    return {
      result: invalid(
        error instanceof Error ? error.message : "Invalid JSON Schema.",
      ),
    };
  }
}

export function inspectSchema(schema: unknown): SchemaResult {
  return compile(schema).result;
}

export function validateJsonSchema(
  schema: unknown,
  data: unknown,
): SchemaResult {
  const { validator, result } = compile(schema);
  if (!validator) return result;
  const limit = guard(data, 1_000_000);
  if (limit)
    return { valid: false, schemaValid: true, errors: [limit], limited: true };
  try {
    const valid = validator(data) as boolean;
    return {
      valid,
      schemaValid: true,
      errors: (validator.errors ?? [])
        .map(
          (error) =>
            `${error.instancePath || "/"} ${error.message ?? "is invalid"}${error.params.missingProperty ? `: ${String(error.params.missingProperty)}` : ""}`,
        )
        .slice(0, 50),
    };
  } catch (error) {
    return {
      valid: false,
      schemaValid: true,
      limited: true,
      errors: [
        error instanceof Error ? error.message : "Validation could not finish.",
      ],
    };
  }
}
