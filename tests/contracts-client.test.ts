import { describe, expect, it, vi } from "vitest";
import { McpClient } from "../src/core/mcp/client";
import {
  MCP_VERSION,
  type RpcRequest,
  type SubscriptionFilter,
} from "../src/types/mcp";

const capabilities = {
  tools: { listChanged: true },
  resources: { listChanged: true, subscribe: true },
  prompts: { listChanged: true },
  completions: {},
};
const discovery = {
  resultType: "complete",
  supportedVersions: [MCP_VERSION],
  capabilities,
  ttlMs: 0,
  cacheScope: "private",
};

function result(request: RpcRequest, payload: unknown) {
  return { jsonrpc: "2.0", id: request.id, result: payload };
}

function notification(request: RpcRequest, method: string, params: object = {}) {
  return {
    jsonrpc: "2.0",
    method,
    params: {
      _meta: { "io.modelcontextprotocol/subscriptionId": request.id },
      ...params,
    },
  };
}

function ack(request: RpcRequest, accepted: unknown) {
  return notification(request, "notifications/subscriptions/acknowledged", {
    notifications: accepted,
  });
}

function completion(request: RpcRequest) {
  return result(request, {
    resultType: "complete",
    _meta: { "io.modelcontextprotocol/subscriptionId": request.id },
  });
}

function sse(messages: unknown[]) {
  return new Response(
    messages.map((message) => `data: ${JSON.stringify(message)}\n\n`).join(""),
    { headers: { "Content-Type": "text/event-stream" } },
  );
}

function fixture(respond: (request: RpcRequest) => Response) {
  const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
    const request = JSON.parse(String(init?.body)) as RpcRequest;
    if (request.method === "server/discover")
      return Response.json(result(request, discovery));
    return respond(request);
  });
  const client = new McpClient({
    endpoint: "https://mcp.example.test/mcp",
    fetchImpl,
  });
  return { client, fetchImpl };
}

describe("runtime MCP contract failures", () => {
  it.each([
    {},
    { requestState: 42 },
    { inputRequests: null },
    { inputRequests: { roots: { method: "roots/list" } } },
  ])("records an invalid input-required result without replaying the request: %j", async (fields) => {
    const { client, fetchImpl } = fixture((request) =>
      Response.json(result(request, { resultType: "input_required", ...fields })),
    );
    await expect(client.readResource("docs://guide")).rejects.toMatchObject({ kind: "protocol" });
    expect(client.records.at(-1)?.error?.kind).toBe("protocol");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([{ requestState: "opaque" }, { inputRequests: {} }])(
    "accepts input-required responses compatible with empty client capabilities: %j",
    async (fields) => {
      const payload = { resultType: "input_required", ...fields };
      const { client, fetchImpl } = fixture((request) => Response.json(result(request, payload)));
      await expect(client.readResource("docs://guide")).resolves.toMatchObject(payload);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { tools: true },
    { resources: { subscribe: "true" } },
    { prompts: { listChanged: 1 } },
    { completions: [] },
    { extensions: { "example.org/broken": null } },
  ])("records malformed discovery capabilities as a controlled protocol error: %j", async (invalid) => {
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const request = JSON.parse(String(init?.body)) as RpcRequest;
      return Response.json(result(request, { ...discovery, capabilities: invalid }));
    });
    const client = new McpClient({ endpoint: "https://mcp.example.test/mcp", fetchImpl });
    await expect(client.discover()).rejects.toMatchObject({ kind: "protocol" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(client.records.at(-1)?.error?.kind).toBe("protocol");
    expect(client.records.at(-1)?.httpStatus).toBe(200);
    await expect(client.complete(
      { type: "ref/prompt", name: "review" },
      { name: "topic", value: "or" },
    )).rejects.toMatchObject({ kind: "validation" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    {},
    { completion: { values: [false] } },
    { completion: { values: Array(101).fill("option") } },
    { completion: { values: [], total: -1 } },
    { completion: { values: [], total: 0.5 } },
    { completion: { values: [], hasMore: "false" } },
  ])("rejects malformed completion responses before consumers receive them: %j", async (invalid) => {
    const { client } = fixture((request) => Response.json(result(request, invalid)));
    await client.discover();
    const validateResult = vi.fn();
    await expect(client.complete(
      { type: "ref/prompt", name: "review" },
      { name: "topic", value: "or" },
      undefined,
      { validateResult },
    )).rejects.toMatchObject({ kind: "protocol" });
    expect(validateResult).not.toHaveBeenCalled();
    expect(client.records.at(-1)?.error?.kind).toBe("protocol");
  });

  it.each([
    null,
    [],
    { toolsListChanged: "true" },
    { resourcesListChanged: 1 },
    { resourceSubscriptions: "resource://one" },
    { resourceSubscriptions: [1] },
  ])("rejects malformed subscription filters without making a request: %j", async (invalid) => {
    const { client, fetchImpl } = fixture(() => {
      throw new Error("A malformed filter must never reach Fetch");
    });
    await client.discover();
    fetchImpl.mockClear();
    await expect(client.listen(invalid as unknown as SubscriptionFilter))
      .rejects.toMatchObject({ kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(client.records).toHaveLength(1);
  });
});

describe("subscription acknowledgment and accepted filters", () => {
  const requested: SubscriptionFilter = {
    toolsListChanged: true,
    promptsListChanged: true,
    resourceSubscriptions: ["resource://allowed", "resource://denied"],
  };
  const accepted: SubscriptionFilter = {
    toolsListChanged: true,
    resourceSubscriptions: ["resource://allowed"],
  };

  it("accepts Orionis reducing the requested filters and delivers only accepted notifications", async () => {
    const { client } = fixture((request) => sse([
      ack(request, accepted),
      notification(request, "notifications/tools/list_changed"),
      notification(request, "notifications/resources/updated", { uri: "resource://allowed" }),
      completion(request),
    ]));
    await client.discover();
    const onEvent = vi.fn();
    await expect(client.listen(requested, { onEvent }))
      .resolves.toMatchObject({ resultType: "complete" });
    expect(onEvent).toHaveBeenCalledTimes(4);
    expect(client.records.at(-1)?.events).toHaveLength(4);
    expect(client.records.at(-1)?.error).toBeUndefined();
  });

  it.each([{}, requested])("accepts an empty acknowledged subset for filter %j", async (filter) => {
    const { client } = fixture((request) => sse([ack(request, {}), completion(request)]));
    await client.discover();
    await expect(client.listen(filter)).resolves.toMatchObject({ resultType: "complete" });
  });

  it.each([
    { method: "notifications/prompts/list_changed", params: {} },
    { method: "notifications/resources/updated", params: { uri: "resource://denied" } },
  ])("rejects requested but unaccepted events: $method", async ({ method, params }) => {
    const { client } = fixture((request) => sse([
      ack(request, accepted),
      notification(request, method, params),
      completion(request),
    ]));
    await client.discover();
    const onEvent = vi.fn();
    await expect(client.listen(requested, { onEvent })).rejects.toMatchObject({
      kind: "protocol",
      message: "Received an unrequested subscription notification",
    });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(client.records.at(-1)?.events).toHaveLength(1);
  });

  it("rejects an acknowledgment that accepts an unrequested type", async () => {
    const { client } = fixture((request) => sse([
      ack(request, { resourcesListChanged: true }),
      completion(request),
    ]));
    await client.discover();
    await expect(client.listen(requested)).rejects.toMatchObject({
      kind: "protocol",
      message: "Subscription acknowledgment accepts an unrequested notification type",
    });
  });

  it("rejects duplicate acknowledgments, including a previously empty filter", async () => {
    const { client } = fixture((request) => sse([
      ack(request, {}),
      ack(request, accepted),
      completion(request),
    ]));
    await client.discover();
    await expect(client.listen(requested)).rejects.toMatchObject({
      kind: "protocol",
      message: "Duplicate subscription acknowledgment",
    });
  });

  it("rejects a successful SSE completion before the mandatory acknowledgment", async () => {
    const { client } = fixture((request) => sse([completion(request)]));
    await client.discover();
    await expect(client.listen(requested)).rejects.toMatchObject({
      kind: "protocol",
      message: "Subscription stream must begin with acknowledgment",
    });
  });

  it("rejects a notification before the acknowledgment", async () => {
    const { client } = fixture((request) => sse([
      notification(request, "notifications/tools/list_changed"),
      ack(request, accepted),
      completion(request),
    ]));
    await client.discover();
    await expect(client.listen(requested)).rejects.toMatchObject({
      kind: "protocol",
      message: "Subscription stream must begin with acknowledgment",
    });
  });

  it("rejects malformed acknowledgment filters as protocol errors", async () => {
    const { client } = fixture((request) => sse([
      ack(request, { resourceSubscriptions: [42] }),
      completion(request),
    ]));
    await client.discover();
    await expect(client.listen(requested)).rejects.toMatchObject({
      kind: "protocol",
      message: "notifications.resourceSubscriptions must be an array of strings",
    });
  });

  it("rejects a JSON-only successful subscription because it cannot carry the acknowledgment", async () => {
    const { client } = fixture((request) => Response.json(completion(request)));
    await client.discover();
    await expect(client.listen(requested)).rejects.toMatchObject({ kind: "protocol" });
  });

  it.each(["application/json", "text/event-stream"])(
    "retains the original JSON-RPC error if the server rejects listen before acknowledging over %s",
    async (contentType) => {
      const { client } = fixture((request) => {
        const failure = {
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32603, message: "Subscription capacity unavailable" },
        };
        return contentType === "text/event-stream" ? sse([failure]) : Response.json(failure);
      });
      await client.discover();
      await expect(client.listen(requested)).rejects.toMatchObject({
        kind: "protocol",
        code: -32603,
        message: "Subscription capacity unavailable",
      });
    },
  );
});
