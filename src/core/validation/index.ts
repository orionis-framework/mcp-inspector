import type {
  RequestRecord,
  ToolResult,
  ResourceResult,
  PromptResult,
} from "../../types/mcp";
import { MCP_VERSION } from "../../types/mcp";
import { inspectSchema, validateJsonSchema } from "./schema";
import type { Category, Snapshot, TestResult, TestStatus } from "./types";
export * from "./types";
export * from "./schema";
export * from "./score";

const BASE = "https://modelcontextprotocol.io/specification/2026-07-28";
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const string = (value: unknown): string =>
  typeof value === "string" ? value : "";
const completed = (record: RequestRecord): boolean =>
  record.response !== undefined || record.error !== undefined;
const hasControl = (value: string): boolean =>
  [...value].some((character) => character.charCodeAt(0) <= 32);
const absoluteUri = (value: unknown): boolean =>
  typeof value === "string" &&
  /^[a-zA-Z][a-zA-Z\d+.-]*:[^\s]*$/.test(value) &&
  !/[{}<>"\\^`|]/.test(value) &&
  !hasControl(value) &&
  !/%(?![a-fA-F0-9]{2})/.test(value);
const base64 = (value: unknown): boolean =>
  typeof value === "string" &&
  value.length % 4 === 0 &&
  /^[A-Za-z0-9+/]*={0,2}$/.test(value);
/** RFC 6570 syntax check; expansion and resource existence require a manual read. */
export function validUriTemplate(value: unknown): boolean {
  if (
    typeof value !== "string" ||
    !value.length ||
    /[\s<>"\\^`|]/.test(value) ||
    hasControl(value)
  )
    return false;
  let valid = true;
  const remaining = value.replace(
    /\{([^{}]*)\}/g,
    (_expression, body: string) => {
      const variables = /^[+#./;?&]/.test(body) ? body.slice(1) : body;
      if (
        !variables ||
        !variables
          .split(",")
          .every((variable) =>
            /^(?:[A-Za-z0-9_]|%[A-Fa-f0-9]{2})+(?:\.(?:[A-Za-z0-9_]|%[A-Fa-f0-9]{2})+)*(?::[1-9][0-9]{0,3}|\*)?$/.test(
              variable,
            ),
          )
      )
        valid = false;
      return "";
    },
  );
  return (
    valid && !/[{}]/.test(remaining) && !/%(?![a-fA-F0-9]{2})/.test(remaining)
  );
}
const headers = (record: RequestRecord): Record<string, string> =>
  Object.fromEntries(
    Object.entries(record.configuredHeaders).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );

export function finding(
  id: string,
  label: string,
  category: Category,
  status: TestStatus,
  component: string,
  evidence: string,
  recommendation = "",
  reference = BASE,
  options: Partial<
    Pick<TestResult, "severity" | "heuristic" | "scoreEligible">
  > = {},
): TestResult {
  return {
    id,
    label,
    category,
    status,
    component,
    issue: label,
    evidence,
    recommendation,
    reference,
    severity:
      status === "Failed" ? "error" : status === "Warning" ? "warning" : "info",
    ...options,
  };
}

export function metrics(records: RequestRecord[]) {
  const network = records.filter(
    (record) => !record.cached && completed(record),
  );
  const samples = network
    .filter((record) => !record.error && Number.isFinite(record.durationMs))
    .map((record) => record.durationMs)
    .sort((a, b) => a - b);
  const percentile = (p: number) =>
    samples.length
      ? samples[Math.max(0, Math.ceil(samples.length * p) - 1)]
      : null;
  return {
    count: network.length,
    samples: samples.length,
    average: samples.length
      ? samples.reduce((sum, value) => sum + value, 0) / samples.length
      : null,
    p50: percentile(0.5),
    p95: percentile(0.95),
    errors: network.filter(
      (record) => record.error && record.error.kind !== "cancelled",
    ).length,
    timeouts: network.filter((record) => record.error?.kind === "timeout")
      .length,
    cancelled: network.filter((record) => record.error?.kind === "cancelled")
      .length,
  };
}

export function evaluate(snapshot: Snapshot): TestResult[] {
  const tests: TestResult[] = [];
  const add = (test: TestResult) => tests.push(test);
  const records = snapshot.records.filter(
    (record) => !record.cached && completed(record),
  );
  const responses = records.filter((record) => record.response !== undefined);
  const rpcResponses = responses.filter(
    (record) => !["authentication", "http"].includes(record.error?.kind ?? ""),
  );
  const successful = records.filter((record) => !record.error);
  const discovery = snapshot.discovery;
  add(
    finding(
      "MCP-PROTOCOL-001",
      "Protocol version",
      "protocol",
      discovery
        ? discovery.supportedVersions.includes(MCP_VERSION)
          ? "Passed"
          : "Failed"
        : "Blocked",
      "server",
      discovery
        ? `Advertised: ${discovery.supportedVersions.join(", ")}`
        : "Discovery has not completed.",
      "Advertise and implement the requested protocol revision.",
      `${BASE}/basic/versioning`,
      {
        severity:
          discovery && !discovery.supportedVersions.includes(MCP_VERSION)
            ? "critical"
            : "info",
      },
    ),
  );
  const metadataValid = records.every((record) => {
    const meta = object(record.request.params._meta);
    return (
      meta["io.modelcontextprotocol/protocolVersion"] === MCP_VERSION &&
      meta["io.modelcontextprotocol/clientCapabilities"] !== null &&
      typeof meta["io.modelcontextprotocol/clientCapabilities"] === "object" &&
      !Array.isArray(meta["io.modelcontextprotocol/clientCapabilities"])
    );
  });
  add(
    finding(
      "MCP-PROTOCOL-002",
      "Self-contained request metadata",
      "protocol",
      records.length ? (metadataValid ? "Passed" : "Failed") : "Not Tested",
      "client",
      `${records.length} recorded network requests inspected. This checks configured requests.`,
      "Include protocolVersion and clientCapabilities metadata on every request.",
      `${BASE}/basic#_meta`,
    ),
  );
  const headersValid = records.every((record) => {
    const h = headers(record);
    return (
      h["mcp-protocol-version"] === MCP_VERSION &&
      h["mcp-method"] === record.method &&
      h.accept?.includes("application/json") &&
      h.accept.includes("text/event-stream") &&
      h["content-type"]?.includes("application/json")
    );
  });
  add(
    finding(
      "MCP-PROTOCOL-003",
      "Configured HTTP headers",
      "protocol",
      records.length ? (headersValid ? "Passed" : "Failed") : "Not Tested",
      "client",
      "Checks client-configured headers, not a packet capture or browser-managed headers.",
      "Mirror metadata and method headers; accept JSON and SSE.",
      `${BASE}/basic/transports/streamable-http`,
    ),
  );
  const envelopesValid = rpcResponses.every((record) => {
    const response = object(record.response);
    const error = object(response.error);
    const validId =
      response.id === record.request.id ||
      ((record.httpStatus ?? 200) >= 400 &&
        response.id === undefined &&
        Object.hasOwn(response, "error"));
    const result = response.result;
    const validResult =
      !Object.hasOwn(response, "result") ||
      (result !== null &&
        typeof result === "object" &&
        !Array.isArray(result) &&
        (object(result).resultType === undefined ||
          ["complete", "input_required"].includes(
            string(object(result).resultType),
          )));
    return (
      response.jsonrpc === "2.0" &&
      validId &&
      validResult &&
      Object.hasOwn(response, "result") !== Object.hasOwn(response, "error") &&
      (!Object.hasOwn(response, "error") ||
        (Number.isInteger(error.code) && typeof error.message === "string"))
    );
  });
  add(
    finding(
      "MCP-PROTOCOL-004",
      "JSON-RPC envelopes and identifiers",
      "protocol",
      rpcResponses.length ? (envelopesValid ? "Passed" : "Failed") : "Blocked",
      "server",
      `${rpcResponses.length} accessible MCP response envelopes inspected. HTTP authentication/rejection bodies are excluded.`,
      "Return one result or error with the matching request ID.",
      `${BASE}/basic`,
      { severity: envelopesValid ? "info" : "critical" },
    ),
  );
  const noSession = records.every(
    (record) =>
      !headers(record)["mcp-session-id"] &&
      record.method !== "initialize" &&
      record.method !== "notifications/initialized",
  );
  add(
    finding(
      "MCP-PROTOCOL-005",
      "Requests without session initialization",
      "protocol",
      successful.length ? (noSession ? "Passed" : "Failed") : "Not Tested",
      "server",
      `${successful.length} successful requests made without any client handshake. This does not prove server internals are stateless.`,
      "Accept independently authenticated requests without a session identifier.",
      `${BASE}/basic#statelessness`,
    ),
  );
  add(
    finding(
      "MCP-PROTOCOL-006",
      "Cross-connection session independence",
      "protocol",
      "Not Tested",
      "server",
      "Fetch does not expose control over TCP connection reuse. Internal session independence cannot be proven by this browser.",
      "Verify with an external integration test using separate connections.",
      `${BASE}/basic#statelessness`,
    ),
  );
  const errorResponses = rpcResponses.filter((record) =>
    Object.hasOwn(object(record.response), "error"),
  );
  add(
    finding(
      "MCP-PROTOCOL-007",
      "Observed JSON-RPC errors",
      "protocol",
      errorResponses.length
        ? errorResponses.every((record) => {
            const error = object(object(record.response).error);
            return (
              Number.isInteger(error.code) && typeof error.message === "string"
            );
          })
          ? "Passed"
          : "Failed"
        : "Not Tested",
      "server",
      errorResponses.length
        ? `${errorResponses.length} real error responses inspected.`
        : "No error response observed. No invalid tool was executed to manufacture an error.",
      "Review an explicitly authorized error response.",
      `${BASE}/basic#error-codes`,
    ),
  );
  const withoutResultType = rpcResponses.filter(
    (record) =>
      Object.hasOwn(object(record.response), "result") &&
      !Object.hasOwn(object(object(record.response).result), "resultType"),
  );
  if (withoutResultType.length)
    add(
      finding(
        "MCP-PROTOCOL-008",
        "Result discriminator missing",
        "protocol",
        "Warning",
        "server",
        `${withoutResultType.length} results omitted resultType; accepted as complete for compatibility.`,
        "Return resultType: complete for modern complete results.",
        `${BASE}/basic#resulttype`,
      ),
    );
  const names = new Set<string>();
  for (const tool of snapshot.tools) {
    if (!tool || typeof tool !== "object" || Array.isArray(tool)) {
      add(
        finding(
          `MCP-TOOL-MALFORMED:${tests.length}`,
          "Malformed tool definition",
          "tools",
          "Failed",
          "server",
          "Tool catalog contains a non-object value.",
          "Return tool definitions as objects.",
          `${BASE}/server/tools`,
        ),
      );
      continue;
    }
    const key = `tool:${tool.name}`;
    add(
      finding(
        `MCP-TOOL-NAME:${tool.name}`,
        "Tool identifier",
        "tools",
        typeof tool.name === "string" &&
          tool.name.length > 0 &&
          !names.has(tool.name)
          ? /^[A-Za-z0-9_.-]{1,128}$/.test(tool.name)
            ? "Passed"
            : "Warning"
          : "Failed",
        key,
        `Identifier: ${String(tool.name)}.`,
        "Use a unique, descriptive name of 1–128 ASCII letters, digits, dots, underscores or hyphens.",
        `${BASE}/server/tools#tool-names`,
      ),
    );
    names.add(tool.name);
    for (const [label, schema] of [
      ["input", tool.inputSchema],
      ["output", tool.outputSchema],
    ] as const) {
      if (label === "output" && schema === undefined) {
        add(
          finding(
            `MCP-TOOL-OUTPUT:${tool.name}`,
            "Optional output schema",
            "tools",
            "Not Applicable",
            key,
            "No output schema declared; this is optional.",
            "",
            `${BASE}/server/tools`,
          ),
        );
        continue;
      }
      const result = inspectSchema(schema);
      add(
        finding(
          `MCP-TOOL-SCHEMA:${tool.name}:${label}`,
          `${label === "input" ? "Input" : "Output"} schema`,
          "tools",
          result.limited ? "Not Tested" : result.valid ? "Passed" : "Failed",
          key,
          result.errors.join("; ") ||
            "Schema compiled using its declared dialect (2020-12 by default).",
          "Use a valid, self-contained JSON Schema; resolve inspection limits offline.",
          `${BASE}/basic#json-schema-usage`,
        ),
      );
    }
    const description = string(tool.description).trim();
    add(
      finding(
        `MCP-TOOL-014:${tool.name}`,
        "Tool description clarity",
        "ai",
        description.length >= 40 && description.split(/\s+/).length >= 7
          ? "Passed"
          : "Warning",
        key,
        description
          ? `Description has ${description.length} characters.`
          : "No description supplied.",
        "Describe the business entity, supported inputs, side effects, and returned result. Length is a heuristic, not proof of clarity.",
        `${BASE}/server/tools`,
        { heuristic: true },
      ),
    );
    const properties = object(object(tool.inputSchema).properties);
    const undocumented = Object.entries(properties)
      .filter(([, property]) => !string(object(property).description).trim())
      .map(([name]) => name);
    add(
      finding(
        `MCP-AI-ARGUMENTS:${tool.name}`,
        "Argument documentation",
        "ai",
        !Object.keys(properties).length
          ? "Not Applicable"
          : undocumented.length
            ? "Warning"
            : "Passed",
        key,
        undocumented.length
          ? `Missing descriptions: ${undocumented.join(", ")}`
          : "All declared properties have descriptions.",
        "Document argument meaning, constraints, and units.",
        `${BASE}/server/tools`,
        { heuristic: true },
      ),
    );
    const complex =
      (JSON.stringify(tool.inputSchema) ?? "").length > 12_000 ||
      Object.keys(properties).length > 20;
    add(
      finding(
        `MCP-AI-COMPLEXITY:${tool.name}`,
        "Schema complexity",
        "ai",
        complex ? "Warning" : "Passed",
        key,
        `${Object.keys(properties).length} top-level properties; complexity is a heuristic.`,
        "Consider smaller, well-documented tools when arguments become hard to select.",
        `${BASE}/server/tools`,
        { heuristic: true },
      ),
    );
    if (/^(get|run|do|execute|data|process|tool)[_\d]*$/i.test(tool.name))
      add(
        finding(
          `MCP-AI-NAME:${tool.name}`,
          "Tool name is broad",
          "ai",
          "Warning",
          key,
          `The name ${tool.name} does not identify a business entity.`,
          "Include an operation and entity, for example search_orders.",
          `${BASE}/server/tools`,
          { heuristic: true },
        ),
      );
    const duplicate = snapshot.tools.find(
      (other) =>
        other &&
        other !== tool &&
        string(other.description).trim().toLowerCase() ===
          description.toLowerCase() &&
        description.length > 0,
    );
    if (duplicate)
      add(
        finding(
          `MCP-AI-AMBIGUOUS:${tool.name}`,
          "Descriptions overlap",
          "ai",
          "Warning",
          key,
          `Same description as ${duplicate.name}.`,
          "Explain when to select each tool and how their results differ.",
          `${BASE}/server/tools`,
          { heuristic: true },
        ),
      );
  }
  for (const [kind, items] of [
    ["resource", snapshot.resources],
    ["template", snapshot.templates],
  ] as const) {
    const identifiers = new Set<string>();
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        add(
          finding(
            `MCP-${kind}-MALFORMED:${tests.length}`,
            `Malformed ${kind} definition`,
            "tools",
            "Failed",
            "server",
            "Catalog contains a non-object value.",
            "Return catalog entries as objects.",
            `${BASE}/server/resources`,
          ),
        );
        continue;
      }
      const uri =
        kind === "resource"
          ? String(item.uri ?? "")
          : String(item.uriTemplate ?? "");
      const validUri =
        kind === "template" ? validUriTemplate(uri) : absoluteUri(uri);
      add(
        finding(
          `MCP-${kind.toUpperCase()}-ID:${uri}`,
          `${kind === "resource" ? "Resource URI" : "Template URI"} and name`,
          "tools",
          validUri &&
            typeof item.name === "string" &&
            Boolean(item.name) &&
            !identifiers.has(uri)
            ? "Passed"
            : "Failed",
          `${kind}:${uri}`,
          `${uri || "(missing URI)"}; ${String(item.name ?? "(missing name)")}`,
          "Supply a unique URI or valid RFC 6570 template and a string name. Existence requires a manual resource read.",
          `${BASE}/server/resources`,
        ),
      );
      identifiers.add(uri);
      if (item.mimeType !== undefined)
        add(
          finding(
            `MCP-MIME:${kind}:${uri}`,
            "Declared media type",
            "tools",
            typeof item.mimeType === "string" &&
              /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+(?:\s*;.*)?$/.test(item.mimeType)
              ? "Passed"
              : "Warning",
            `${kind}:${uri}`,
            String(item.mimeType),
            "Use a registered media type or a valid custom MIME type.",
            `${BASE}/server/resources`,
          ),
        );
    }
  }
  const promptNames = new Set<string>();
  for (const prompt of snapshot.prompts) {
    if (!prompt || typeof prompt !== "object" || Array.isArray(prompt)) {
      add(
        finding(
          `MCP-PROMPT-MALFORMED:${tests.length}`,
          "Malformed prompt definition",
          "tools",
          "Failed",
          "server",
          "Prompt catalog contains a non-object value.",
          "Return prompt definitions as objects.",
          `${BASE}/server/prompts`,
        ),
      );
      continue;
    }
    const argumentsList = Array.isArray(prompt.arguments)
      ? prompt.arguments
      : [];
    const validArguments =
      (prompt.arguments === undefined || Array.isArray(prompt.arguments)) &&
      argumentsList.every((argument) => {
        const arg = object(argument);
        return (
          typeof arg.name === "string" &&
          arg.name.length > 0 &&
          (arg.required === undefined || typeof arg.required === "boolean")
        );
      }) &&
      new Set(argumentsList.map((argument) => object(argument).name)).size ===
        argumentsList.length;
    add(
      finding(
        `MCP-PROMPT:${prompt.name}`,
        "Prompt identifier and arguments",
        "tools",
        prompt.name && !promptNames.has(prompt.name) && validArguments
          ? "Passed"
          : "Failed",
        `prompt:${prompt.name}`,
        `${argumentsList.length} argument definitions inspected.`,
        "Use unique names and boolean required flags.",
        `${BASE}/server/prompts`,
      ),
    );
    promptNames.add(prompt.name);
  }
  const endpoint = records.find(
    (record) => record.httpStatus !== undefined,
  )?.endpoint;
  add(
    finding(
      "MCP-SECURITY-001",
      "Transport encryption",
      "security",
      endpoint
        ? endpoint.startsWith("https:")
          ? "Passed"
          : "Warning"
        : "Not Tested",
      "server",
      endpoint
        ? `Accessible HTTP response over ${endpoint.split(":")[0]}. Browser TLS validation is used for HTTPS.`
        : "No HTTP response accessible. A configured HTTPS URL alone does not verify transport security.",
      "Use HTTPS for remote endpoints.",
      `${BASE}/basic/transports/streamable-http#security--endpoint`,
    ),
  );
  add(
    finding(
      "MCP-SECURITY-002",
      "Authentication enforcement",
      "security",
      "Not Tested",
      "server",
      "Authentication requirements cannot be inferred from successful discovery. Anonymous and invalid-token probes require explicit authorization.",
      "Run an authorized authentication probe and verify intended access policy. Public discovery may be intentional.",
      `${BASE}/basic/authorization`,
    ),
  );
  add(
    finding(
      "MCP-SECURITY-003",
      "Origin and CORS policy enforcement",
      "security",
      "Not Tested",
      "server",
      "Fetch cannot inspect preflight details or spoof another Origin. Accessible responses only prove this origin could read that response.",
      "Review allowed origins and preflight policy on the server; use browser DevTools.",
      `${BASE}/basic/transports/streamable-http#security--endpoint`,
    ),
  );
  const sensitive = responses.some((record) =>
    /"(?:password|secret|access_token|refresh_token|api[_-]?key)"\s*:/i.test(
      JSON.stringify(record.response),
    ),
  );
  add(
    finding(
      "MCP-SECURITY-004",
      "Sensitive field review",
      "security",
      responses.length ? (sensitive ? "Warning" : "Passed") : "Not Tested",
      "server",
      sensitive
        ? "Sensitive-looking field names occur in accessible responses. Values are redacted; this is a heuristic."
        : "No configured sensitive-field patterns found in accessible responses; this is not proof of absence.",
      "Review payloads for credentials and personal data; return only required fields.",
      `${BASE}#security-and-trust--safety`,
      { heuristic: true },
    ),
  );
  add(
    finding(
      "MCP-SECURITY-005",
      "Controlled invalid-argument handling",
      "security",
      "Not Tested",
      "server",
      "No malformed tools/call request was generated. Invalid inputs can still trigger side effects, and read-only annotations are untrusted.",
      "Test deliberately invalid arguments against an isolated test server with explicit authorization and controlled fixtures. The inspector validates arguments locally before manual execution.",
      `${BASE}/server/tools#error-handling`,
    ),
  );
  const observedMetrics = metrics(records);
  add(
    finding(
      "MCP-PERFORMANCE-001",
      "Browser round-trip latency",
      "performance",
      observedMetrics.samples
        ? observedMetrics.samples < 5
          ? "Warning"
          : "Passed"
        : "Not Tested",
      "server",
      observedMetrics.samples
        ? `${observedMetrics.samples} successful network samples; average ${observedMetrics.average?.toFixed(1)} ms, p50 ${observedMetrics.p50?.toFixed(1)} ms, p95 ${observedMetrics.p95?.toFixed(1)} ms. Includes network, preflight, browser scheduling, transfer and server time.`
        : "No successful network timings available.",
      "Use repeated controlled samples. Browser timings do not isolate server execution.",
      `${BASE}/basic/transports/streamable-http`,
      { heuristic: true },
    ),
  );
  add(
    finding(
      "MCP-PERFORMANCE-002",
      "Observed transport errors",
      "performance",
      records.length
        ? observedMetrics.errors
          ? "Warning"
          : "Passed"
        : "Not Tested",
      "server",
      `${observedMetrics.errors} errors, ${observedMetrics.timeouts} timeouts, ${observedMetrics.cancelled} cancellations.`,
      "Inspect failed request evidence; network or CORS failures do not establish an MCP server defect.",
      `${BASE}/basic/transports/streamable-http`,
      {
        scoreEligible: records.some(
          (record) => record.httpStatus !== undefined,
        ),
      },
    ),
  );
  return tests;
}

function validContent(value: unknown): boolean {
  const block = object(value);
  if (block.type === "text") return typeof block.text === "string";
  if (block.type === "image" || block.type === "audio")
    return base64(block.data) && typeof block.mimeType === "string";
  if (block.type === "resource_link")
    return absoluteUri(block.uri) && typeof block.name === "string";
  if (block.type === "resource") return validResourceContent(block.resource);
  return false;
}
function validResourceContent(value: unknown): boolean {
  const content = object(value);
  return (
    absoluteUri(content.uri) &&
    (typeof content.text === "string" || base64(content.blob)) &&
    (content.mimeType === undefined || typeof content.mimeType === "string")
  );
}

export function validateToolResult(
  toolName: string,
  result: ToolResult,
  outputSchema?: unknown,
): TestResult[] {
  const contentValid =
    Array.isArray(result.content) &&
    result.content.every(validContent) &&
    (result.isError === undefined || typeof result.isError === "boolean");
  const tests = [
    finding(
      `MCP-RESULT:${toolName}`,
      "Tool result content",
      "tools",
      contentValid ? "Passed" : "Failed",
      `tool:${toolName}`,
      contentValid
        ? `${result.content?.length ?? 0} valid content blocks returned${result.isError ? "; tool reported isError" : ""}.`
        : "The complete result must contain valid MCP content blocks and an optional boolean isError.",
      "Return content as an array of MCP content blocks.",
      `${BASE}/server/tools`,
    ),
  ];
  const untestedOutput = (reason: string) =>
    finding(
      `MCP-OUTPUT:${toolName}`,
      "Structured output validation",
      "tools",
      "Not Tested",
      `tool:${toolName}`,
      reason,
      "Complete a successful operation before validating structured output.",
      `${BASE}/server/tools`,
    );
  if (result.resultType === "input_required")
    return [
      finding(
        `MCP-RESULT:${toolName}`,
        "Additional client input requested",
        "tools",
        "Not Tested",
        `tool:${toolName}`,
        "The operation has not completed; output cannot be validated yet.",
        "Continue with a client supporting the requested input capability.",
        `${BASE}/basic/message-patterns`,
      ),
      ...(outputSchema !== undefined
        ? [
            untestedOutput(
              "Additional client input is required; no completed output was returned.",
            ),
          ]
        : []),
    ];
  if (outputSchema !== undefined && result.isError)
    tests.push(
      untestedOutput(
        "The tool reported an execution error; this is not a successful structured result.",
      ),
    );
  if (outputSchema !== undefined && !result.isError) {
    const changedByRedaction = /\[REDACTED\]/i.test(
      JSON.stringify(result.structuredContent) ?? "",
    );
    const checked = changedByRedaction
      ? {
          valid: false,
          limited: true,
          errors: [
            "Sensitive values were redacted before inspection. The original output cannot be validated from this evidence.",
          ],
        }
      : validateJsonSchema(outputSchema, result.structuredContent);
    tests.push(
      finding(
        `MCP-OUTPUT:${toolName}`,
        "Structured output validation",
        "tools",
        checked.limited ? "Not Tested" : checked.valid ? "Passed" : "Failed",
        `tool:${toolName}`,
        checked.errors.join("; ") ||
          "structuredContent conforms to outputSchema.",
        "Return structuredContent matching the advertised outputSchema.",
        `${BASE}/server/tools`,
      ),
    );
  }
  return tests;
}

export function validateResourceResult(
  uri: string,
  result: ResourceResult,
): TestResult[] {
  return [
    finding(
      `MCP-RESOURCE-RESULT:${uri}`,
      "Resource content structure",
      "tools",
      result.resultType === "input_required"
        ? "Not Tested"
        : Array.isArray(result.contents) &&
            result.contents.every(validResourceContent)
          ? "Passed"
          : "Failed",
      `resource:${uri}`,
      result.resultType === "input_required"
        ? "The resource requested additional client input."
        : `${result.contents?.length ?? 0} resource content items inspected.`,
      "Return a contents array whose items have a URI and text or base64 blob.",
      `${BASE}/server/resources`,
    ),
  ];
}

export function validatePromptResult(
  name: string,
  result: PromptResult,
): TestResult[] {
  return [
    finding(
      `MCP-PROMPT-RESULT:${name}`,
      "Prompt message structure",
      "tools",
      result.resultType === "input_required"
        ? "Not Tested"
        : Array.isArray(result.messages) &&
            result.messages.every(
              (message) =>
                ["user", "assistant"].includes(string(object(message).role)) &&
                validContent(object(message).content),
            )
          ? "Passed"
          : "Failed",
      `prompt:${name}`,
      result.resultType === "input_required"
        ? "The prompt requested additional client input."
        : `${result.messages?.length ?? 0} messages inspected.`,
      "Use user or assistant roles and valid MCP content blocks.",
      `${BASE}/server/prompts`,
    ),
  ];
}
