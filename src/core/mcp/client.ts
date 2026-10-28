import { redact, redactUrl } from "../../utils/redact";
import {
  MCP_VERSION,
  type CompletionReference,
  type CompletionResult,
  type DiscoveryResult,
  type ErrorKind,
  type JsonObject,
  type McpResult,
  type Prompt,
  type PromptResult,
  type RequestOptions,
  type RequestRecord,
  type Resource,
  type ResourceResult,
  type ResourceTemplate,
  type RpcRequest,
  type SubscriptionFilter,
  type Tool,
  type ToolResult,
} from "../../types/mcp";
import { encodeHeader, headerBindings, parameterHeaders } from "./headers";
import { consumeSse } from "./sse";

export class McpError extends Error {
  constructor(
    public kind: ErrorKind,
    message: string,
    public code?: number,
    public data?: unknown,
  ) {
    super(message);
    this.name = "McpError";
  }
}
export interface ClientOptions {
  endpoint: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  onRecord?: (record: RequestRecord) => void;
  fetchImpl?: typeof fetch;
}
const cacheable = new Set([
  "server/discover",
  "tools/list",
  "resources/list",
  "resources/templates/list",
  "prompts/list",
  "resources/read",
]);
const supported = new Set([
  ...cacheable,
  "tools/call",
  "prompts/get",
  "completion/complete",
  "subscriptions/listen",
]);
const object = (value: unknown): value is JsonObject =>
  !!value && typeof value === "object" && !Array.isArray(value);
const MAX_BYTES = 5_000_000;

export function validateEndpoint(endpoint: string): string {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new McpError(
      "validation",
      "Enter a complete HTTP or HTTPS MCP endpoint URL",
    );
  }
  if (!["http:", "https:"].includes(url.protocol))
    throw new McpError(
      "validation",
      "Only HTTP and HTTPS endpoints are supported",
    );
  if (url.username || url.password)
    throw new McpError(
      "validation",
      "Credentials in endpoint URLs are not allowed. Use authentication settings.",
    );
  if (url.hash)
    throw new McpError("validation", "Endpoint URLs cannot contain fragments");
  return url.href;
}

async function readBody(
  response: Response,
  signal: AbortSignal,
): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  const abort = () => {
    void reader.cancel();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const part = await reader.read();
      signal.throwIfAborted();
      if (part.done) return text + decoder.decode();
      size += part.value.byteLength;
      if (size > MAX_BYTES)
        throw new McpError(
          "protocol",
          "Response exceeds the 5 MB inspection limit",
        );
      text += decoder.decode(part.value, { stream: true });
    }
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** One immutable endpoint/authentication context. All caches and credentials die with this instance. */
export class McpClient {
  private endpointValue: string;
  get endpoint(): string {
    return this.endpointValue;
  }
  readonly records: RequestRecord[] = [];
  readonly rejectedTools: { name: string; reason: string }[] = [];
  private readonly headers: Record<string, string>;
  private readonly secrets: string[];
  private readonly fetchImpl: typeof fetch;
  private readonly cache = new Map<
    string,
    { expires: number; value: McpResult }
  >();
  private readonly controllers = new Set<AbortController>();
  private readonly activeHeaders = new Set<Record<string, string>>();
  private readonly tools = new Map<string, Tool>();
  private readonly config: Pick<ClientOptions, "timeoutMs" | "onRecord">;
  private readonly instanceId = crypto.randomUUID();
  private discovery?: DiscoveryResult;
  private sequence = 0;
  private disconnected = false;
  constructor(config: ClientOptions) {
    // Never retain the caller's config or its original credential headers.
    this.config = { timeoutMs: config.timeoutMs, onRecord: config.onRecord };
    this.endpointValue = validateEndpoint(config.endpoint);
    this.headers = { ...config.headers };
    for (const key of Object.keys(this.headers)) {
      if (
        /^(mcp-|content-type$|accept$|host$|origin$|cookie$|referer$|sec-|proxy-)/i.test(
          key,
        )
      )
        throw new McpError(
          "validation",
          `Header ${key} is controlled by the transport or browser`,
        );
    }
    try {
      new Headers(this.headers);
    } catch {
      throw new McpError(
        "validation",
        "Authentication headers contain an invalid name or value",
      );
    }
    const querySecrets = [...new URL(this.endpoint).searchParams.values()];
    this.secrets = [
      ...Object.values(this.headers).flatMap((value) => [
        value,
        value.replace(/^Bearer\s+/i, ""),
      ]),
      ...querySecrets,
    ].filter(Boolean);
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }
  clearCache(): void {
    this.cache.clear();
  }
  disconnect(): void {
    this.disconnected = true;
    this.controllers.forEach((controller) => controller.abort());
    for (const headers of [this.headers, ...this.activeHeaders])
      for (const key of Object.keys(headers)) delete headers[key];
    this.activeHeaders.clear();
    this.secrets.length = 0;
    this.endpointValue = redactUrl(this.endpointValue);
    this.discovery = undefined;
    this.cache.clear();
    this.tools.clear();
  }
  private safe<T>(value: T): T {
    return redact(value, this.secrets) as T;
  }
  private safeCatalog<T>(value: T): T {
    const visit = (item: unknown, depth = 0): unknown => {
      if (depth > 64)
        throw new McpError(
          "protocol",
          "Catalog exceeds the schema depth inspection limit",
        );
      if (typeof item === "string") return this.safe(item);
      if (Array.isArray(item))
        return item.map((child) => visit(child, depth + 1));
      if (object(item))
        return Object.fromEntries(
          Object.entries(item).map(([key, child]) => [
            key,
            visit(child, depth + 1),
          ]),
        );
      return item;
    };
    return visit(value) as T;
  }
  private publish(record: RequestRecord): void {
    const safe = this.safe(record);
    const index = this.records.findIndex((item) => item.id === record.id);
    if (index < 0) this.records.push(safe);
    else this.records[index] = safe;
    if (this.records.length > 500) this.records.shift();
    this.config.onRecord?.(safe);
  }
  async request<T extends McpResult = McpResult>(
    method: string,
    params: JsonObject = {},
    options: RequestOptions = {},
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    if (this.disconnected)
      throw new McpError(
        "cancelled",
        "Client is disconnected. Create a new connection before sending requests.",
      );
    if (!supported.has(method))
      throw new McpError("validation", "Unsupported MCP method");
    options.signal?.throwIfAborted();
    const id = `orionis-${this.instanceId}-${++this.sequence}`;
    const request: RpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": MCP_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
          "io.modelcontextprotocol/clientInfo": {
            name: "orionis-mcp-inspector",
            version: "1.0.0",
          },
          ...(method === "tools/call" ? { progressToken: id } : {}),
        },
      },
    };
    const headers: Record<string, string> = {
      ...this.headers,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": MCP_VERSION,
      "MCP-Method": method,
      ...extraHeaders,
    };
    if (["tools/call", "prompts/get", "resources/read"].includes(method))
      headers["MCP-Name"] = encodeHeader(
        String(method === "resources/read" ? params.uri : params.name),
      );
    const record: RequestRecord = {
      id,
      endpoint: redactUrl(this.endpoint),
      method,
      startedAt: new Date().toISOString(),
      durationMs: 0,
      request: this.safe(request),
      configuredHeaders: this.safe(headers),
      accessibleHeaders: {},
      bytes: 0,
      events: [],
    };
    const key = JSON.stringify([method, params]);
    const hit = this.cache.get(key);
    if (
      !options.bypassCache &&
      !options.validateResult &&
      hit &&
      hit.expires > Date.now()
    ) {
      record.cached = true;
      record.response = { jsonrpc: "2.0", id, result: hit.value };
      this.publish(record);
      return structuredClone(hit.value) as T;
    }
    const controller = new AbortController();
    this.controllers.add(controller);
    this.activeHeaders.add(headers);
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    let timedOut = false;
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs ?? 15000;
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, timeoutMs)
        : undefined;
    const started = performance.now();
    this.publish(record);
    try {
      // The only application data network boundary. Browser handles OPTIONS preflight automatically.
      const response = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
        mode: "cors",
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      record.httpStatus = response.status;
      controller.signal.throwIfAborted();
      record.accessibleHeaders = this.safe(
        Object.fromEntries(response.headers.entries()),
      );
      const contentType = response.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim();
      let envelope: unknown;
      if (contentType === "text/event-stream") {
        let acknowledged = false;
        record.bytes = await consumeSse(
          response,
          (event) => {
            const data = event.data;
            if (!object(data) || data.jsonrpc !== "2.0")
              throw new McpError("protocol", "Invalid JSON-RPC SSE message");
            if ("id" in data) {
              if ("method" in data)
                throw new McpError(
                  "protocol",
                  "Server-initiated requests are not supported by the stateless protocol",
                );
              envelope = data;
            } else {
              if (
                typeof data.method !== "string" ||
                !data.method.startsWith("notifications/")
              )
                throw new McpError(
                  "protocol",
                  "Expected a JSON-RPC notification",
                );
              if (method === "subscriptions/listen") {
                const p = object(data.params) ? data.params : {};
                const meta = object(p._meta) ? p._meta : {};
                if (meta["io.modelcontextprotocol/subscriptionId"] !== id)
                  throw new McpError(
                    "protocol",
                    "Subscription notification ID does not match",
                  );
                if (
                  !acknowledged &&
                  data.method !== "notifications/subscriptions/acknowledged"
                )
                  throw new McpError(
                    "protocol",
                    "Subscription stream must begin with acknowledgment",
                  );
                acknowledged = true;
                const filter = params.notifications as SubscriptionFilter;
                const allowed: Record<string, boolean> = {
                  "notifications/subscriptions/acknowledged": true,
                  "notifications/tools/list_changed":
                    filter.toolsListChanged === true,
                  "notifications/prompts/list_changed":
                    filter.promptsListChanged === true,
                  "notifications/resources/list_changed":
                    filter.resourcesListChanged === true,
                  "notifications/resources/updated":
                    typeof p.uri === "string" &&
                    !!filter.resourceSubscriptions?.includes(p.uri),
                };
                if (!allowed[data.method])
                  throw new McpError(
                    "protocol",
                    "Received an unrequested subscription notification",
                  );
              }
              if (
                data.method.endsWith("/list_changed") ||
                data.method === "notifications/resources/updated"
              )
                this.clearCache();
            }
            record.events.push(this.safe(event));
            if (record.events.length > 500) record.events.shift();
            options.onEvent?.(this.safe(event));
            record.durationMs = performance.now() - started;
            this.publish(record);
            return envelope !== undefined;
          },
          controller.signal,
        );
        if (envelope === undefined)
          throw new McpError(
            "protocol",
            "SSE stream ended before a final JSON-RPC response",
          );
      } else {
        const body = await readBody(response, controller.signal);
        record.bytes = new TextEncoder().encode(body).byteLength;
        record.response = this.safe(body);
        if (response.status === 401 || response.status === 403) {
          try {
            envelope = JSON.parse(body);
            record.response = this.safe(envelope);
          } catch {
            /* Preserve readable HTTP evidence. */
          }
          const rpcError =
            object(envelope) && object(envelope.error)
              ? envelope.error
              : undefined;
          throw new McpError(
            "authentication",
            `HTTP ${response.status}: authentication, authorization or Origin policy rejected the request`,
            typeof rpcError?.code === "number" ? rpcError.code : undefined,
          );
        }
        if (contentType !== "application/json")
          throw new McpError(
            response.ok ? "protocol" : "http",
            `HTTP ${response.status}: expected application/json or text/event-stream; received ${contentType ?? "no Content-Type"}`,
          );
        try {
          envelope = JSON.parse(body);
        } catch {
          throw new McpError("protocol", "Response is not valid JSON");
        }
      }
      record.response = this.safe(envelope);
      if (response.status === 401 || response.status === 403)
        throw new McpError(
          "authentication",
          `HTTP ${response.status}: authentication, authorization or Origin policy rejected the request`,
        );
      if (
        !object(envelope) ||
        envelope.jsonrpc !== "2.0" ||
        "result" in envelope === "error" in envelope
      )
        throw new McpError("protocol", "Invalid JSON-RPC response envelope");
      if (
        envelope.id !== id &&
        !(!response.ok && envelope.id === undefined && "error" in envelope)
      )
        throw new McpError(
          "protocol",
          "Response ID does not match the request",
        );
      if ("error" in envelope) {
        const error = envelope.error;
        if (
          !object(error) ||
          !Number.isInteger(error.code) ||
          typeof error.message !== "string"
        )
          throw new McpError("protocol", "Malformed JSON-RPC error");
        throw new McpError(
          "protocol",
          this.safe(error.message),
          error.code as number,
          this.safe(error.data),
        );
      }
      if (!response.ok) throw new McpError("http", `HTTP ${response.status}`);
      if (!object(envelope.result))
        throw new McpError("protocol", "JSON-RPC result must be an object");
      const result = envelope.result as McpResult;
      if (
        result.resultType !== undefined &&
        !["complete", "input_required"].includes(result.resultType)
      )
        throw new McpError(
          "protocol",
          `Unrecognized resultType: ${String(result.resultType)}`,
        );
      if (
        method === "subscriptions/listen" &&
        (!object(result._meta) ||
          result._meta["io.modelcontextprotocol/subscriptionId"] !== id)
      )
        throw new McpError(
          "protocol",
          "Subscription completion ID does not match",
        );
      if (result.resultType !== "input_required")
        options.validateResult?.(result);
      controller.signal.throwIfAborted();
      if (
        cacheable.has(method) &&
        result.resultType !== "input_required" &&
        !("inputResponses" in params) &&
        !("requestState" in params) &&
        Number.isSafeInteger(result.ttlMs) &&
        (result.ttlMs ?? 0) > 0 &&
        ["public", "private"].includes(result.cacheScope ?? "")
      ) {
        this.cache.set(key, {
          expires: Date.now() + Math.min(result.ttlMs!, 86400000),
          value:
            method === "tools/list"
              ? this.safeCatalog(structuredClone(result))
              : this.safe(structuredClone(result)),
        });
        if (this.cache.size > 200)
          this.cache.delete(this.cache.keys().next().value!);
      }
      return (
        method === "tools/list" ? this.safeCatalog(result) : this.safe(result)
      ) as T;
    } catch (error) {
      let failure: McpError;
      if (controller.signal.aborted)
        failure = new McpError(
          timedOut ? "timeout" : "cancelled",
          timedOut
            ? `Request timed out after ${timeoutMs} ms`
            : "Request cancelled",
        );
      else if (error instanceof McpError) failure = error;
      else if (error instanceof SyntaxError)
        failure = new McpError("protocol", "Invalid JSON in SSE event");
      else if (error instanceof TypeError)
        failure = new McpError(
          "network",
          "Possible CORS block or connectivity issue. The browser did not expose a response; check CORS, TLS, DNS, mixed content, redirects and endpoint availability. Redirects are intentionally rejected to avoid forwarding credentials.",
        );
      else
        failure = new McpError(
          "protocol",
          error instanceof Error ? error.message : String(error),
        );
      // Construct a fresh error so a stack created from an untrusted raw message cannot retain credentials.
      failure = new McpError(
        failure.kind,
        this.safe(failure.message),
        failure.code,
        this.safe(failure.data),
      );
      record.error = {
        kind: failure.kind,
        message: failure.message,
        ...(failure.code === undefined ? {} : { code: failure.code }),
      };
      throw failure;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      this.controllers.delete(controller);
      this.activeHeaders.delete(headers);
      for (const key of Object.keys(headers)) delete headers[key];
      record.durationMs = performance.now() - started;
      this.publish(record);
    }
  }
  async discover(options?: RequestOptions): Promise<DiscoveryResult> {
    const result = await this.request<DiscoveryResult>(
      "server/discover",
      {},
      options,
    );
    if (
      !Array.isArray(result.supportedVersions) ||
      !result.supportedVersions.every((v) => typeof v === "string") ||
      !object(result.capabilities)
    )
      throw new McpError(
        "protocol",
        "Discovery requires supportedVersions and capabilities",
      );
    if (!result.supportedVersions.includes(MCP_VERSION))
      throw new McpError(
        "protocol",
        `Server does not advertise MCP ${MCP_VERSION}`,
      );
    this.discovery = result;
    return result;
  }
  private async list<T>(
    method: string,
    field: string,
    options?: RequestOptions,
  ): Promise<T[]> {
    const entries: T[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 100; page++) {
      const result = await this.request(
        method,
        cursor === undefined ? {} : { cursor },
        options,
      );
      if (!Array.isArray(result[field]))
        throw new McpError(
          "protocol",
          `${method} result must contain an array: ${field}`,
        );
      entries.push(...(result[field] as T[]));
      if (entries.length > 10000)
        throw new McpError(
          "protocol",
          "Catalog exceeds the 10,000 item inspection limit",
        );
      if (result.nextCursor === undefined) return entries;
      if (typeof result.nextCursor !== "string" || seen.has(result.nextCursor))
        throw new McpError("protocol", "Invalid or repeated pagination cursor");
      cursor = result.nextCursor;
      seen.add(cursor);
    }
    throw new McpError(
      "protocol",
      "Pagination exceeds the 100 page inspection limit",
    );
  }
  async listTools(options?: RequestOptions): Promise<Tool[]> {
    const tools = await this.list<Tool>("tools/list", "tools", options);
    this.rejectedTools.length = 0;
    this.tools.clear();
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const tool of tools) {
      if (object(tool) && typeof tool.name === "string") {
        if (seen.has(tool.name)) duplicates.add(tool.name);
        seen.add(tool.name);
      }
    }
    return tools.filter((tool) => {
      try {
        if (
          !object(tool) ||
          typeof tool.name !== "string" ||
          !object(tool.inputSchema)
        )
          throw new Error("Tool name and inputSchema are required");
        if (duplicates.has(tool.name))
          throw new Error(
            "Duplicate tool name is ambiguous and cannot be executed",
          );
        headerBindings(tool.inputSchema);
        this.tools.set(tool.name, tool);
        return true;
      } catch (error) {
        this.rejectedTools.push({
          name: String(tool?.name ?? "(unnamed)"),
          reason: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    });
  }
  async listResources(options?: RequestOptions): Promise<Resource[]> {
    const items = await this.list<Resource>(
      "resources/list",
      "resources",
      options,
    );
    if (
      items.some(
        (item) =>
          !object(item) ||
          typeof item.name !== "string" ||
          typeof item.uri !== "string",
      )
    )
      throw new McpError(
        "protocol",
        "Resource catalog entries require string name and uri fields",
      );
    return items;
  }
  async listResourceTemplates(
    options?: RequestOptions,
  ): Promise<ResourceTemplate[]> {
    const items = await this.list<ResourceTemplate>(
      "resources/templates/list",
      "resourceTemplates",
      options,
    );
    if (
      items.some(
        (item) =>
          !object(item) ||
          typeof item.name !== "string" ||
          typeof item.uriTemplate !== "string",
      )
    )
      throw new McpError(
        "protocol",
        "Resource template entries require string name and uriTemplate fields",
      );
    return items;
  }
  async listPrompts(options?: RequestOptions): Promise<Prompt[]> {
    const items = await this.list<Prompt>("prompts/list", "prompts", options);
    if (
      items.some(
        (item) =>
          !object(item) ||
          typeof item.name !== "string" ||
          (item.arguments !== undefined &&
            (!Array.isArray(item.arguments) ||
              item.arguments.some(
                (arg) => !object(arg) || typeof arg.name !== "string",
              ))),
      )
    )
      throw new McpError(
        "protocol",
        "Prompt catalog entries require a string name and valid argument descriptors",
      );
    return items;
  }
  callTool(
    name: string,
    args: JsonObject,
    options?: RequestOptions,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool)
      return Promise.reject(
        new McpError(
          "validation",
          "List and select a valid tool before executing it",
        ),
      );
    try {
      return this.request(
        "tools/call",
        { name, arguments: args },
        options,
        parameterHeaders(tool.inputSchema, args),
      );
    } catch (error) {
      return Promise.reject(
        new McpError(
          "validation",
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }
  readResource(uri: string, options?: RequestOptions): Promise<ResourceResult> {
    return this.request("resources/read", { uri }, options);
  }
  getPrompt(
    name: string,
    args: Record<string, string>,
    options?: RequestOptions,
  ): Promise<PromptResult> {
    return this.request("prompts/get", { name, arguments: args }, options);
  }
  complete(
    ref: CompletionReference,
    argument: { name: string; value: string },
    context?: { arguments: Record<string, string> },
    options?: RequestOptions,
  ): Promise<CompletionResult> {
    if (!this.discovery?.capabilities.completions)
      return Promise.reject(
        new McpError(
          "validation",
          "Server has not declared completions support",
        ),
      );
    return this.request(
      "completion/complete",
      { ref, argument, ...(context ? { context } : {}) },
      options,
    );
  }
  listen(
    notifications: SubscriptionFilter,
    options?: RequestOptions,
  ): Promise<McpResult> {
    const caps = this.discovery?.capabilities;
    if (
      !caps ||
      (notifications.toolsListChanged && !caps.tools?.listChanged) ||
      (notifications.promptsListChanged && !caps.prompts?.listChanged) ||
      (notifications.resourcesListChanged && !caps.resources?.listChanged) ||
      (notifications.resourceSubscriptions?.length &&
        !caps.resources?.subscribe)
    )
      return Promise.reject(
        new McpError(
          "validation",
          "Subscription filter requires capabilities advertised by this server",
        ),
      );
    return this.request(
      "subscriptions/listen",
      { notifications },
      { timeoutMs: 0, ...options },
    );
  }
}
