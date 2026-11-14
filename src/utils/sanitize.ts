import { MCP_VERSION, type RequestRecord } from "../types/mcp";
import { APP_VERSION } from "../version";

export type Sanitizer = <T>(value: T) => T;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const findingFields: Record<string, readonly string[]> = {
  status: ["Passed", "Failed", "Warning", "Not Applicable", "Not Tested", "Blocked"],
  category: ["protocol", "tools", "security", "performance", "ai"],
  severity: ["critical", "error", "warning", "info"],
  component: ["client", "server"],
};
const findingCodes = new Set([
  "RUN-DISCOVERY", "RUN-TOOLS", "RUN-RESOURCES", "RUN-TEMPLATES", "RUN-PROMPTS",
  "MCP-HEADER", "MCP-SECURITY-PROBE", "MCP-TOOL-MALFORMED", "MCP-TOOL-NAME",
  "MCP-TOOL-OUTPUT", "MCP-TOOL-SCHEMA", "MCP-TOOL-014", "MCP-AI-ARGUMENTS",
  "MCP-AI-COMPLEXITY", "MCP-AI-NAME", "MCP-AI-AMBIGUOUS", "MCP-resource-MALFORMED",
  "MCP-template-MALFORMED", "MCP-RESOURCE-ID", "MCP-TEMPLATE-ID", "MCP-MIME",
  "MCP-PROMPT-MALFORMED", "MCP-PROMPT", "MCP-RESULT", "MCP-OUTPUT",
  "MCP-RESOURCE-RESULT", "MCP-PROMPT-RESULT",
]);

/** Preserve inspector-owned discriminators; redact text and server-derived identifiers. */
export function sanitizeFinding<T>(value: T, sanitize: Sanitizer): T {
  const safe = sanitize(value);
  if (!object(value) || !object(safe)) return safe;
  const output: Record<string, unknown> = safe;
  for (const [field, allowed] of Object.entries(findingFields))
    if (typeof value[field] === "string" && allowed.includes(value[field]))
      output[field] = value[field];
  if (typeof value.id === "string") {
    const colon = value.id.indexOf(":");
    const code = colon < 0 ? value.id : value.id.slice(0, colon);
    if (findingCodes.has(code) || /^MCP-(?:PROTOCOL|SECURITY|PERFORMANCE)-\d{3}$/.test(code))
      output.id = code + (colon < 0 ? "" : ":" + sanitize(value.id.slice(colon + 1)));
  }
  return safe;
}

export function sanitizeScore<T>(value: T, sanitize: Sanitizer): T {
  const safe = sanitize(value);
  if (!object(value) || !object(safe)) return safe;
  const output: Record<string, unknown> = safe;
  for (const [field, allowed] of Object.entries({
    classification: ["Excellent", "Needs Improvement", "Critical", "Not Verified"],
    readiness: ["Ready", "Ready with Warnings", "Not Ready", "Not Verified"],
  }))
    if (typeof value[field] === "string" && allowed.includes(value[field]))
      output[field] = value[field];
  return safe;
}

const methods = new Set([
  "server/discover", "tools/list", "tools/call", "resources/list",
  "resources/templates/list", "resources/read", "prompts/list", "prompts/get",
  "completion/complete", "subscriptions/listen",
]);
const notifications = new Set([
  "notifications/progress", "notifications/message", "notifications/tools/list_changed",
  "notifications/prompts/list_changed", "notifications/resources/list_changed",
  "notifications/resources/updated", "notifications/subscriptions/acknowledged",
]);
const errorKinds = new Set([
  "network", "authentication", "http", "protocol", "timeout", "cancelled", "validation",
]);

function preserveEnvelope(value: unknown, safe: unknown, clientId?: string) {
  if (!object(value) || !object(safe)) return;
  if (value.jsonrpc === "2.0") safe.jsonrpc = "2.0";
  if (clientId && value.id === clientId) safe.id = clientId;
  if (typeof value.method === "string" && notifications.has(value.method))
    safe.method = value.method;
  if (object(value.result) && object(safe.result)) {
    if (value.result.resultType === "complete" || value.result.resultType === "input_required")
      safe.result.resultType = value.result.resultType;
    if (value.result.cacheScope === "private" || value.result.cacheScope === "public")
      safe.result.cacheScope = value.result.cacheScope;
  }
  for (const field of ["params", "result"]) {
    const content = value[field];
    const safeContent = safe[field];
    if (!object(content) || !object(safeContent)) continue;
    const meta = content._meta;
    const safeMeta = safeContent._meta;
    if (clientId && object(meta) && object(safeMeta) &&
        meta["io.modelcontextprotocol/subscriptionId"] === clientId)
      safeMeta["io.modelcontextprotocol/subscriptionId"] = clientId;
  }
}

/** Re-redaction of history must not change valid wire discriminators or client identity. */
export function sanitizeRecord(record: RequestRecord, sanitize: Sanitizer): RequestRecord {
  const safe = sanitize(record);
  const clientId = /^orionis-[\da-f-]{36}-\d+$/i.test(record.id) ? record.id : undefined;
  if (clientId) safe.id = clientId;
  if (methods.has(record.method)) safe.method = record.method;
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(record.startedAt))
    safe.startedAt = record.startedAt;
  preserveEnvelope(record.request, safe.request, clientId);
  if (methods.has(record.request.method)) safe.request.method = record.request.method;
  const meta = record.request.params._meta;
  const safeMeta = safe.request.params._meta;
  if (object(meta) && object(safeMeta)) {
    if (meta["io.modelcontextprotocol/protocolVersion"] === MCP_VERSION)
      safeMeta["io.modelcontextprotocol/protocolVersion"] = MCP_VERSION;
    if (clientId && meta.progressToken === clientId) safeMeta.progressToken = clientId;
    const info = meta["io.modelcontextprotocol/clientInfo"];
    const safeInfo = safeMeta["io.modelcontextprotocol/clientInfo"];
    if (object(info) && object(safeInfo)) {
      if (info.name === "orionis-mcp-inspector") safeInfo.name = info.name;
      if (info.version === APP_VERSION) safeInfo.version = APP_VERSION;
    }
  }
  for (const [name, value] of Object.entries(record.configuredHeaders)) {
    const lower = name.toLowerCase();
    if (
      (lower === "mcp-method" && methods.has(value)) ||
      (lower === "mcp-protocol-version" && value === MCP_VERSION) ||
      (lower === "content-type" && value === "application/json") ||
      (lower === "accept" && value === "application/json, text/event-stream")
    ) safe.configuredHeaders[name] = value;
  }
  if (record.error && safe.error && errorKinds.has(record.error.kind))
    safe.error.kind = record.error.kind;
  preserveEnvelope(record.response, safe.response, clientId);
  for (let index = 0; index < record.events.length; index++)
    preserveEnvelope(record.events[index].data, safe.events[index]?.data, clientId);
  return safe;
}
