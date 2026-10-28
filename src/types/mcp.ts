export const MCP_VERSION = "2026-07-28" as const;
export type JsonObject = Record<string, unknown>;
export interface JsonSchema extends JsonObject {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
  default?: unknown;
}
export interface RpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params: JsonObject;
}
export interface McpResult extends JsonObject {
  resultType?: "complete" | "input_required";
  _meta?: JsonObject;
  ttlMs?: number;
  cacheScope?: "public" | "private";
}
export interface ServerCapabilities extends JsonObject {
  tools?: { listChanged?: boolean };
  resources?: { listChanged?: boolean; subscribe?: boolean };
  prompts?: { listChanged?: boolean };
  completions?: JsonObject;
  extensions?: Record<string, JsonObject>;
}
export interface DiscoveryResult extends McpResult {
  supportedVersions: string[];
  capabilities: ServerCapabilities;
  instructions?: string;
}
export interface Tool extends JsonObject {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}
export interface Resource extends JsonObject {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
}
export interface ResourceTemplate extends JsonObject {
  uriTemplate: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
}
export interface Prompt extends JsonObject {
  name: string;
  title?: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
}
export interface ToolResult extends McpResult {
  content?: JsonObject[];
  structuredContent?: unknown;
  isError?: boolean;
}
export interface ResourceResult extends McpResult {
  contents: JsonObject[];
}
export interface PromptResult extends McpResult {
  description?: string;
  messages: { role: "user" | "assistant"; content: JsonObject }[];
}
export type CompletionReference =
  | { type: "ref/prompt"; name: string }
  | { type: "ref/resource"; uri: string };
export interface CompletionResult extends McpResult {
  completion: { values: string[]; total?: number; hasMore?: boolean };
}
export interface SubscriptionFilter {
  toolsListChanged?: boolean;
  promptsListChanged?: boolean;
  resourcesListChanged?: boolean;
  resourceSubscriptions?: string[];
}
export type ErrorKind =
  | "network"
  | "authentication"
  | "http"
  | "protocol"
  | "timeout"
  | "cancelled"
  | "validation";
export interface StreamEvent {
  at: string;
  event: string;
  data: unknown;
  id?: string;
}
export interface RequestRecord {
  id: string;
  endpoint: string;
  method: string;
  startedAt: string;
  durationMs: number;
  request: RpcRequest;
  configuredHeaders: Record<string, string>;
  accessibleHeaders: Record<string, string>;
  response?: unknown;
  httpStatus?: number;
  bytes: number;
  events: StreamEvent[];
  error?: { kind: ErrorKind; message: string; code?: number };
  cached?: boolean;
}
export interface RequestOptions {
  signal?: AbortSignal;
  bypassCache?: boolean;
  timeoutMs?: number;
  onEvent?: (event: StreamEvent) => void;
  /** Validate a completed raw result synchronously; retain verdicts, never raw payloads. */
  validateResult?: (result: McpResult) => void;
}
