import { describe, expect, it, vi } from "vitest";
import { McpClient, validateEndpoint } from "../src/core/mcp/client";
import {
  encodeHeader,
  headerBindings,
  parameterHeaders,
} from "../src/core/mcp/headers";
import {
  MCP_VERSION,
  type RpcRequest,
  type RequestRecord,
} from "../src/types/mcp";

const endpoint = "https://mcp.example.test/rpc";
const discovery = {
  resultType: "complete",
  supportedVersions: [MCP_VERSION],
  capabilities: { tools: {}, resources: {}, prompts: {}, completions: {} },
  ttlMs: 0,
  cacheScope: "private",
};
function mockServer(results: Record<string, unknown> = {}) {
  const requests: { body: RpcRequest; init: RequestInit }[] = [];
  const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as RpcRequest;
    requests.push({
      body,
      init: { ...init, headers: new Headers(init?.headers) },
    });
    const result = results[body.method] ?? discovery;
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: body.id, result }),
      { headers: { "Content-Type": "application/json" } },
    );
  });
  return {
    fetchImpl,
    requests,
    client: new McpClient({ endpoint, fetchImpl }),
  };
}
const tool = {
  name: "lookup",
  description: "Read a customer by identifier.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string", "x-mcp-header": "Customer" } },
  },
};

describe("stateless browser MCP transport", () => {
  it("discovers without initialization, with per-request version/capabilities/identity", async () => {
    const { client, requests } = mockServer();
    expect((await client.discover()).supportedVersions).toContain(MCP_VERSION);
    await client.discover({ bypassCache: true });
    expect(requests).toHaveLength(2);
    for (const { body, init } of requests) {
      expect(body.method).toBe("server/discover");
      expect(body.params._meta).toMatchObject({
        "io.modelcontextprotocol/protocolVersion": MCP_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      });
      const headers = new Headers(init.headers);
      expect(headers.get("MCP-Protocol-Version")).toBe(MCP_VERSION);
      expect(headers.get("MCP-Method")).toBe("server/discover");
      expect(headers.get("Accept")).toBe("application/json, text/event-stream");
      expect(headers.has("Mcp-Session-Id")).toBe(false);
      expect(init).toMatchObject({
        method: "POST",
        mode: "cors",
        credentials: "omit",
        redirect: "error",
      });
    }
    expect(requests[0]!.body.id).not.toBe(requests[1]!.body.id);
  });
  it("lists each primitive with the documented result field", async () => {
    const { client } = mockServer({
      "tools/list": { tools: [tool] },
      "resources/list": { resources: [{ uri: "test://one", name: "one" }] },
      "resources/templates/list": {
        resourceTemplates: [{ uriTemplate: "test://{id}", name: "one" }],
      },
      "prompts/list": { prompts: [{ name: "review" }] },
    });
    expect(await client.listTools()).toHaveLength(1);
    expect(await client.listResources()).toHaveLength(1);
    expect(await client.listResourceTemplates()).toHaveLength(1);
    expect(await client.listPrompts()).toHaveLength(1);
  });
  it("preserves input schema properties named password or token", async () => {
    const credentialTool = {
      ...tool,
      inputSchema: {
        type: "object",
        properties: {
          password: { type: "string", minLength: 8 },
          token: { type: "string" },
        },
      },
    };
    const { client } = mockServer({
      "tools/list": {
        tools: [credentialTool],
        ttlMs: 60000,
        cacheScope: "private",
      },
    });
    expect((await client.listTools())[0]?.inputSchema).toEqual(
      credentialTool.inputSchema,
    );
    expect((await client.listTools())[0]?.inputSchema).toEqual(
      credentialTool.inputSchema,
    );
  });
  it("calls a manually selected tool with mirrored headers and progress metadata", async () => {
    const { client, requests } = mockServer({
      "tools/list": { tools: [tool] },
      "tools/call": {
        content: [{ type: "text", text: "ok" }],
        structuredContent: { ok: true },
      },
    });
    await client.listTools();
    expect(await client.callTool("lookup", { id: "東京" })).toMatchObject({
      structuredContent: { ok: true },
    });
    const call = requests[1]!;
    expect(new Headers(call.init.headers).get("MCP-Name")).toBe("lookup");
    expect(new Headers(call.init.headers).get("Mcp-Param-Customer")).toBe(
      encodeHeader("東京"),
    );
    expect(call.body.params._meta).toHaveProperty(
      "progressToken",
      call.body.id,
    );
  });
  it("validates raw tool output before redaction and returns only sanitized output", async () => {
    const secret = "private-output-value";
    const { fetchImpl } = mockServer({
      "tools/list": { tools: [tool] },
      "tools/call": {
        content: [],
        structuredContent: { password: 123, value: secret },
      },
    });
    const validateResult = vi.fn();
    const client = new McpClient({
      endpoint,
      fetchImpl,
      headers: { Authorization: `Bearer ${secret}` },
    });
    await client.listTools();
    const result = await client.callTool(
      "lookup",
      { id: "1" },
      { validateResult },
    );
    expect(validateResult).toHaveBeenCalledWith({
      content: [],
      structuredContent: { password: 123, value: secret },
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.structuredContent).toMatchObject({ password: "[REDACTED]" });
  });
  it("reads a resource and gets a prompt using exact standard headers", async () => {
    const { client, requests } = mockServer({
      "resources/read": { contents: [] },
      "prompts/get": { messages: [] },
    });
    await client.readResource("test://世界");
    await client.getPrompt("review", { language: "python" });
    expect(new Headers(requests[0]!.init.headers).get("MCP-Name")).toBe(
      encodeHeader("test://世界"),
    );
    expect(new Headers(requests[1]!.init.headers).get("MCP-Name")).toBe(
      "review",
    );
  });
  it("gates completions on declaration and passes reference, argument and context", async () => {
    const { client, requests } = mockServer({
      "completion/complete": { completion: { values: ["python"] } },
    });
    await expect(
      client.complete(
        { type: "ref/prompt", name: "review" },
        { name: "lang", value: "py" },
      ),
    ).rejects.toMatchObject({ kind: "validation" });
    await client.discover();
    await client.complete(
      { type: "ref/prompt", name: "review" },
      { name: "lang", value: "py" },
      { arguments: { platform: "linux" } },
    );
    expect(requests[1]!.body.params).toMatchObject({
      ref: { type: "ref/prompt" },
      argument: { value: "py" },
      context: { arguments: { platform: "linux" } },
    });
  });
  it("paginates opaque cursors without inventing page size", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const req = JSON.parse(String(init?.body)) as RpcRequest;
      expect(req.params).not.toHaveProperty("limit");
      return Response.json({
        jsonrpc: "2.0",
        id: req.id,
        result: req.params.cursor
          ? { tools: [{ ...tool, name: "second" }] }
          : { tools: [tool], nextCursor: "opaque+/=" },
      });
    });
    const client = new McpClient({ endpoint, fetchImpl });
    expect(await client.listTools()).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(String(fetchImpl.mock.calls[1]![1]?.body)).params.cursor,
    ).toBe("opaque+/=");
  });
  it("bounds repeated pagination cursors", async () => {
    const { client } = mockServer({
      "tools/list": { tools: [], nextCursor: "repeat" },
    });
    await expect(client.listTools()).rejects.toMatchObject({
      kind: "protocol",
    });
  });
  it("caches hinted results per client and allows bypass", async () => {
    const { client, fetchImpl } = mockServer({
      "server/discover": { ...discovery, ttlMs: 60000 },
    });
    await client.discover();
    await client.discover();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(client.records[1]?.cached).toBe(true);
    await client.discover({ bypassCache: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    client.clearCache();
    await client.discover();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
  it("does not share cache across authorization contexts", async () => {
    const { fetchImpl } = mockServer({
      "server/discover": { ...discovery, ttlMs: 60000 },
    });
    await new McpClient({
      endpoint,
      headers: { Authorization: "Bearer one" },
      fetchImpl,
    }).discover();
    await new McpClient({
      endpoint,
      headers: { Authorization: "Bearer two" },
      fetchImpl,
    }).discover();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("assigns unique request identifiers across clients and authentication probes", async () => {
    const { fetchImpl, requests } = mockServer();
    const main = new McpClient({ endpoint, fetchImpl });
    const probe = new McpClient({ endpoint, fetchImpl });
    await main.discover();
    await probe.discover();
    await main.discover();
    expect(new Set(requests.map((request) => request.body.id)).size).toBe(3);
    expect(main.records[0]?.id).toMatch(/^orionis-[0-9a-f-]{36}-1$/);
  });
  it("rejects mismatching JSON-RPC IDs and unknown result types", async () => {
    const mismatch = new McpClient({
      endpoint,
      fetchImpl: vi.fn(async () =>
        Response.json({ jsonrpc: "2.0", id: "wrong", result: {} }),
      ),
    });
    await expect(mismatch.discover()).rejects.toMatchObject({
      kind: "protocol",
    });
    const { client } = mockServer({
      "server/discover": { ...discovery, resultType: "magic" },
    });
    await expect(client.discover()).rejects.toMatchObject({ kind: "protocol" });
  });
  it("preserves JSON-RPC error codes from HTTP errors", async () => {
    const client = new McpClient({
      endpoint,
      fetchImpl: vi.fn(async (_url, init) =>
        Response.json(
          {
            jsonrpc: "2.0",
            id: JSON.parse(String(init?.body)).id,
            error: {
              code: -32022,
              message: "Unsupported protocol version",
              data: { supported: ["old"] },
            },
          },
          { status: 400 },
        ),
      ),
    });
    await expect(client.discover()).rejects.toMatchObject({
      kind: "protocol",
      code: -32022,
    });
    expect(client.records[0]?.httpStatus).toBe(400);
  });
  it("classifies authentication and ambiguous CORS/network failures accurately", async () => {
    const auth = new McpClient({
      endpoint,
      fetchImpl: vi.fn(async () => new Response("Denied", { status: 401 })),
    });
    await expect(auth.discover()).rejects.toMatchObject({
      kind: "authentication",
    });
    const blocked = new McpClient({
      endpoint,
      fetchImpl: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });
    await expect(blocked.discover()).rejects.toMatchObject({
      kind: "network",
      message: expect.stringContaining(
        "Possible CORS block or connectivity issue",
      ),
    });
    expect(blocked.records[0]?.httpStatus).toBeUndefined();
  });
  it("redacts credentials from configured headers, echoed responses and logs", async () => {
    const records: RequestRecord[] = [];
    const secret = "super-secret-token-123";
    const client = new McpClient({
      endpoint: `${endpoint}?api_key=${secret}`,
      headers: { Authorization: `Bearer ${secret}` },
      onRecord: (r) => records.push(r),
      fetchImpl: vi.fn(async (_url, init) =>
        Response.json({
          jsonrpc: "2.0",
          id: JSON.parse(String(init?.body)).id,
          result: { ...discovery, instructions: `echo ${secret}` },
        }),
      ),
    });
    const result = await client.discover();
    expect(JSON.stringify(records)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("times out independently and supports explicit cancellation", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          ),
        ),
    );
    const client = new McpClient({ endpoint, fetchImpl, timeoutMs: 10 });
    await expect(client.discover()).rejects.toMatchObject({ kind: "timeout" });
    const controller = new AbortController();
    const operation = client.discover({
      signal: controller.signal,
      timeoutMs: 10000,
    });
    controller.abort();
    await expect(operation).rejects.toMatchObject({ kind: "cancelled" });
  });
  it("disconnect cancels outstanding Fetch requests", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        ),
    );
    const client = new McpClient({ endpoint, fetchImpl });
    const operation = client.discover();
    client.disconnect();
    await expect(operation).rejects.toMatchObject({ kind: "cancelled" });
  });
  it("disconnect drops credentials and query values and rejects later use", async () => {
    const secret = "highly-confidential-key";
    const { fetchImpl } = mockServer();
    const client = new McpClient({
      endpoint: `${endpoint}?custom_auth=${secret}`,
      headers: { "X-Custom-Access": secret },
      fetchImpl,
    });
    await client.discover();
    client.disconnect();
    expect(JSON.stringify(client)).not.toContain(secret);
    expect(client.endpoint).not.toContain(secret);
    await expect(client.discover()).rejects.toMatchObject({
      kind: "cancelled",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("cannot leak an echoed credential from a late response after disconnect", async () => {
    const secret = "late-response-secret";
    let respond!: (value: Response) => void;
    let requestId = "";
    const records: RequestRecord[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      requestId = JSON.parse(String(init?.body)).id as string;
      return new Promise<Response>((resolve) => {
        respond = resolve;
      });
    });
    const client = new McpClient({
      endpoint,
      headers: { "X-Custom-Access": secret },
      fetchImpl,
      onRecord: (record) => records.push(record),
    });
    const operation = client.discover();
    client.disconnect();
    respond(
      Response.json({
        jsonrpc: "2.0",
        id: requestId,
        result: { ...discovery, instructions: secret },
      }),
    );
    await expect(operation).rejects.toMatchObject({ kind: "cancelled" });
    expect(JSON.stringify(records)).not.toContain(secret);
    expect(JSON.stringify(client)).not.toContain(secret);
  });
  it("redacts all query values regardless of parameter name from response and error evidence", async () => {
    const secret = "opaque-query-credential";
    const { fetchImpl } = mockServer({
      "server/discover": { ...discovery, instructions: secret },
    });
    const client = new McpClient({
      endpoint: `${endpoint}?custom=${secret}`,
      fetchImpl,
    });
    expect(JSON.stringify(await client.discover())).not.toContain(secret);
    expect(JSON.stringify(client.records)).not.toContain(secret);
    const failing = new McpClient({
      endpoint: `${endpoint}?custom=${secret}`,
      fetchImpl: vi.fn(async () => {
        throw new Error(`Connection error: ${secret}`);
      }),
    });
    const failure = await failing.discover().catch((error) => error as Error);
    expect(failure.message).not.toContain(secret);
    expect(failure.stack).not.toContain(secret);
    expect(JSON.stringify(failing.records)).not.toContain(secret);
  });
  it("parses fragmented SSE, ignores comments, records notifications and stops at final result", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const id = JSON.parse(String(init?.body)).id as string;
      const data = `: heartbeat\r\n\r\nevent: message\r\ndata: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/progress", params: { progress: 1 } })}\r\n\r\ndata: ${JSON.stringify({ jsonrpc: "2.0", id, result: discovery })}\r\n\r\n`;
      const stream = new ReadableStream({
        start(controller) {
          for (let i = 0; i < data.length; i += 7)
            controller.enqueue(new TextEncoder().encode(data.slice(i, i + 7)));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream" },
      });
    });
    const client = new McpClient({ endpoint, fetchImpl });
    expect((await client.discover()).supportedVersions).toEqual([MCP_VERSION]);
    expect(client.records[0]?.events).toHaveLength(2);
    expect(client.records[0]?.bytes).toBeGreaterThan(0);
  });
  it("rejects a server request sent over SSE", async () => {
    const client = new McpClient({
      endpoint,
      fetchImpl: vi.fn(
        async () =>
          new Response(
            'data: {"jsonrpc":"2.0","id":1,"method":"sampling/createMessage"}\n\n',
            { headers: { "Content-Type": "text/event-stream" } },
          ),
      ),
    });
    await expect(client.discover()).rejects.toMatchObject({ kind: "protocol" });
  });
  it("requires advertised subscription capabilities and validates acknowledgment", async () => {
    const { client } = mockServer();
    await client.discover();
    await expect(
      client.listen({ toolsListChanged: true }),
    ).rejects.toMatchObject({ kind: "validation" });
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const req = JSON.parse(String(init?.body)) as RpcRequest;
      if (req.method === "server/discover")
        return Response.json({
          jsonrpc: "2.0",
          id: req.id,
          result: {
            ...discovery,
            capabilities: { tools: { listChanged: true } },
          },
        });
      const meta = { "io.modelcontextprotocol/subscriptionId": req.id };
      const messages = [
        {
          jsonrpc: "2.0",
          method: "notifications/subscriptions/acknowledged",
          params: { _meta: meta, notifications: { toolsListChanged: true } },
        },
        {
          jsonrpc: "2.0",
          id: req.id,
          result: { resultType: "complete", _meta: meta },
        },
      ];
      return new Response(
        messages.map((m) => `data: ${JSON.stringify(m)}\n\n`).join(""),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    });
    const subscribed = new McpClient({ endpoint, fetchImpl });
    await subscribed.discover();
    await subscribed.listen({ toolsListChanged: true });
    expect(subscribed.records[1]?.events).toHaveLength(2);
  });
  it("excludes invalid header annotations from executable tools and keeps evidence", async () => {
    const invalid = {
      ...tool,
      name: "bad",
      inputSchema: {
        type: "object",
        properties: { amount: { type: "number", "x-mcp-header": "Amount" } },
      },
    };
    const { client } = mockServer({ "tools/list": { tools: [tool, invalid] } });
    expect(await client.listTools()).toEqual([tool]);
    expect(client.rejectedTools[0]?.name).toBe("bad");
    await expect(client.callTool("bad", {})).rejects.toMatchObject({
      kind: "validation",
    });
  });
  it("rejects malformed catalog entries before they reach the UI", async () => {
    const { client } = mockServer({
      "resources/list": { resources: [null] },
      "resources/templates/list": { resourceTemplates: [{}] },
      "prompts/list": { prompts: [{ name: "bad", arguments: [null] }] },
    });
    await expect(client.listResources()).rejects.toMatchObject({
      kind: "protocol",
    });
    await expect(client.listResourceTemplates()).rejects.toMatchObject({
      kind: "protocol",
    });
    await expect(client.listPrompts()).rejects.toMatchObject({
      kind: "protocol",
    });
  });
  it("excludes ambiguous duplicate tool names from execution", async () => {
    const { client } = mockServer({ "tools/list": { tools: [tool, tool] } });
    expect(await client.listTools()).toEqual([]);
    expect(client.rejectedTools).toHaveLength(2);
    await expect(client.callTool("lookup", {})).rejects.toMatchObject({
      kind: "validation",
    });
  });
});

describe("safe mirrored header values", () => {
  it("encodes Unicode, controls, whitespace and sentinel-like strings", () => {
    expect(encodeHeader("plain")).toBe("plain");
    for (const value of [
      "東京",
      "line\r\ninjection",
      " padded ",
      "=?base64?literal?=",
    ])
      expect(encodeHeader(value)).toMatch(/^=\?base64\?.+\?=$/);
    expect(encodeHeader(false)).toBe("false");
    expect(encodeHeader(42)).toBe("42");
  });
  it("mirrors only exact nested properties and omits null/absent values", () => {
    const schema = {
      type: "object",
      properties: {
        customer: {
          type: "object",
          properties: { id: { type: "integer", "x-mcp-header": "ID" } },
        },
      },
    };
    expect(parameterHeaders(schema, { customer: { id: 4 } })).toEqual({
      "Mcp-Param-ID": "4",
    });
    expect(parameterHeaders(schema, { customer: { id: null } })).toEqual({});
    expect(() =>
      parameterHeaders(schema, {
        customer: { id: Number.MAX_SAFE_INTEGER + 1 },
      }),
    ).toThrow();
  });
  it("rejects duplicate, non-token, composed and array header annotations", () => {
    expect(() =>
      headerBindings({
        properties: {
          a: { type: "string", "x-mcp-header": "ID" },
          b: { type: "string", "x-mcp-header": "id" },
        },
      }),
    ).toThrow();
    expect(() =>
      headerBindings({
        properties: { a: { type: "string", "x-mcp-header": "bad\nname" } },
      }),
    ).toThrow();
    expect(() =>
      headerBindings({ items: { type: "string", "x-mcp-header": "ID" } }),
    ).toThrow();
    expect(() =>
      headerBindings({
        anyOf: [
          { properties: { a: { type: "string", "x-mcp-header": "ID" } } },
        ],
      }),
    ).toThrow();
  });
  it("rejects unsafe endpoints and user-supplied transport headers", () => {
    for (const url of [
      "file:///tmp/a",
      "javascript:alert(1)",
      "https://user:password@example.test/rpc",
      "/api/mcp",
    ])
      expect(() => validateEndpoint(url)).toThrow();
    expect(
      () => new McpClient({ endpoint, headers: { "Mcp-Session-Id": "bad" } }),
    ).toThrow();
  });
});
