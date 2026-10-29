import { describe, expect, it, vi } from "vitest";
import {
  calculateScore,
  evaluate,
  finding,
  inspectSchema,
  metrics,
  validateJsonSchema,
  validateToolResult,
  validatePromptResult,
  validateResourceResult,
  validUriTemplate,
} from "../src/core/validation";
import type { Snapshot, TestResult } from "../src/core/validation";
import {
  runSafeTests,
  runAuthenticationProbe,
} from "../src/core/testing/runner";
import { McpClient } from "../src/core/mcp/client";
import { MCP_VERSION } from "../src/types/mcp";
import type { RequestRecord, Tool, RpcRequest } from "../src/types/mcp";

const tool: Tool = {
  name: "find_orders",
  description:
    "Find orders by customer and return their current fulfillment status.",
  inputSchema: {
    type: "object",
    properties: {
      customer: { type: "string", description: "Customer identifier" },
      limit: { type: "integer", minimum: 1 },
    },
    required: ["customer"],
  },
};
const empty = (): Snapshot => ({
  tools: [],
  resources: [],
  templates: [],
  prompts: [],
  records: [],
});
const result = (
  status: TestResult["status"],
  category: TestResult["category"] = "protocol",
): TestResult =>
  finding(`${category}:${status}`, status, category, status, "server", "test");
const record = (
  durationMs: number,
  extra: Partial<RequestRecord> = {},
): RequestRecord => ({
  id: "1",
  endpoint: "https://example.com/mcp",
  method: "tools/list",
  startedAt: "2026-10-28T00:00:00Z",
  durationMs,
  request: {
    jsonrpc: "2.0",
    id: "1",
    method: "tools/list",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": MCP_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  },
  configuredHeaders: {
    "MCP-Protocol-Version": MCP_VERSION,
    "MCP-Method": "tools/list",
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  },
  accessibleHeaders: {},
  bytes: 50,
  events: [],
  response: {
    jsonrpc: "2.0",
    id: "1",
    result: { resultType: "complete", tools: [] },
  },
  ...extra,
});

describe("JSON Schema validation", () => {
  it("validates nested objects, integer, boolean, enum and arrays", () => {
    const schema = {
      type: "object",
      required: ["settings"],
      properties: {
        settings: {
          type: "object",
          required: ["enabled", "count", "tags"],
          properties: {
            enabled: { type: "boolean" },
            count: { type: "integer", minimum: 1 },
            tags: { type: "array", items: { enum: ["a", "b"] } },
          },
        },
      },
    };
    expect(
      validateJsonSchema(schema, {
        settings: { enabled: true, count: 1, tags: ["a"] },
      }).valid,
    ).toBe(true);
    const invalid = validateJsonSchema(schema, {
      settings: { enabled: "true", count: 1.2, tags: ["x"] },
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBe(3);
  });
  it("does not coerce arguments or insert defaults", () => {
    const data = { count: "3" };
    expect(
      validateJsonSchema(
        { type: "object", properties: { count: { type: "integer" } } },
        data,
      ).valid,
    ).toBe(false);
    expect(data.count).toBe("3");
  });
  it("uses draft2020-12 by default, including prefixItems", () => {
    const schema = {
      type: "array",
      prefixItems: [{ type: "integer" }],
      items: false,
    };
    expect(validateJsonSchema(schema, [1]).valid).toBe(true);
    expect(validateJsonSchema(schema, [1, 2]).valid).toBe(false);
  });
  it("supports explicitly declared draft7", () => {
    expect(
      validateJsonSchema(
        {
          $schema: "http://json-schema.org/draft-07/schema#",
          type: "array",
          items: [{ type: "number" }],
          additionalItems: false,
        },
        [1],
      ).valid,
    ).toBe(true);
  });
  it("supports the HTTPS draft7 metaschema alias without fetching it", () => {
    expect(
      validateJsonSchema(
        { $schema: "https://json-schema.org/draft-07/schema#", type: "string" },
        "valid",
      ).valid,
    ).toBe(true);
  });
  it("reports unsupported dialects as limited rather than a server failure", () => {
    expect(
      inspectSchema({ $schema: "https://example.com/custom", type: "object" }),
    ).toMatchObject({ valid: false, limited: true });
  });
  it("rejects malformed schemas and missing required data", () => {
    expect(inspectSchema({ type: "strangetype" }).schemaValid).toBe(false);
    expect(validateJsonSchema(tool.inputSchema, {}).errors.join(" ")).toContain(
      "customer",
    );
  });
  it("does not fetch external references", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(
      inspectSchema({ $ref: "https://example.com/schema.json" }).limited,
    ).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it("supports local references", () => {
    expect(
      validateJsonSchema(
        {
          $defs: { name: { type: "string" } },
          type: "object",
          properties: { name: { $ref: "#/$defs/name" } },
        },
        { name: "Orionis" },
      ).valid,
    ).toBe(true);
  });
  it("bounds schema depth and high-risk regular expressions", () => {
    let deep: unknown = { type: "string" };
    for (let i = 0; i < 40; i++) deep = { type: "array", items: deep };
    expect(inspectSchema(deep).limited).toBe(true);
    expect(inspectSchema({ type: "string", pattern: "(a+)+$" }).limited).toBe(
      true,
    );
    expect(
      inspectSchema({
        type: "object",
        patternProperties: { "a+a+a+$": { type: "number" } },
      }).limited,
    ).toBe(true);
  });
});

describe("score and coverage", () => {
  const discovered = (): Snapshot => ({
    ...empty(),
    discovery: { supportedVersions: [MCP_VERSION], capabilities: {} },
    records: [record(25, { httpStatus: 200 })],
  });

  it("does not assign a score or readiness without evidence", () => {
    expect(
      calculateScore(
        [result("Not Tested"), result("Blocked", "security")],
        empty(),
      ),
    ).toMatchObject({
      score: null,
      classification: "Not Verified",
      coverage: 0,
      readiness: "Not Verified",
      evaluated: 0,
    });
  });

  it("requires discovery before showing an overall or category score", () => {
    const summary = calculateScore(
      [result("Passed"), result("Passed", "security")],
      empty(),
    );
    expect(summary.score).toBeNull();
    expect(summary.classification).toBe("Not Verified");
    expect(summary.readiness).toBe("Not Verified");
    expect(
      Object.values(summary.byCategory).every(
        (category) => category.score === null,
      ),
    ).toBe(true);
  });

  it("excludes local request checks and non-scoring diagnostics from server quality", () => {
    const baseline = [result("Failed"), result("Not Tested", "security")];
    const localPasses = Array.from({ length: 20 }, (_, index) => ({
      ...result("Passed"),
      id: "client-check-" + index,
      component: "client",
    }));
    const diagnostic = {
      ...result("Warning", "performance"),
      scoreEligible: false,
    };
    expect(
      calculateScore([...baseline, ...localPasses, diagnostic], discovered()),
    ).toEqual(calculateScore(baseline, discovered()));
    const localOnly = calculateScore(localPasses, discovered());
    expect(localOnly).toMatchObject({
      score: null,
      evaluated: 0,
      coverage: 0,
      classification: "Not Verified",
    });
  });

  it("excludes optional checks from coverage, not unexecuted checks", () => {
    expect(
      calculateScore(
        [
          result("Passed"),
          result("Not Applicable", "tools"),
          result("Not Tested", "security"),
        ],
        discovered(),
      ),
    ).toMatchObject({
      score: 100,
      coverage: 50,
      applicable: 2,
      evaluated: 1,
      readiness: "Not Verified",
    });
  });
  it("uses the requested category weights", () => {
    const summary = calculateScore(
      [
        result("Passed"),
        result("Passed", "tools"),
        result("Failed", "security"),
        result("Passed", "performance"),
        result("Warning", "ai"),
      ],
      discovered(),
    );
    expect(summary.score).toBe(75);
    expect(summary.classification).toBe("Needs Improvement");
    expect(summary.readiness).toBe("Not Ready");
  });
  it("critical failures block readiness despite a high score", () => {
    const tests = Array.from({ length: 100 }, () => result("Passed"));
    tests.push(
      { ...result("Failed"), severity: "critical" },
      result("Passed", "security"),
    );
    const summary = calculateScore(tests, discovered());
    expect(summary.score).toBeGreaterThan(90);
    expect(summary.readiness).toBe("Not Ready");
  });
  it("reports readiness when all applicable server evidence passes", () => {
    expect(
      calculateScore(
        [result("Passed"), result("Passed", "security")],
        discovered(),
      ).readiness,
    ).toBe("Ready");
    expect(
      calculateScore(
        [result("Passed"), result("Warning", "security")],
        discovered(),
      ).readiness,
    ).toBe("Ready with Warnings");
  });
});

describe("evidence diagnostics", () => {
  it("distinguishes heuristic warnings from normative failures", () => {
    const checks = evaluate({
      ...empty(),
      tools: [
        {
          ...tool,
          description: "Get data",
          inputSchema: { type: "invalid-type" },
        },
      ],
    });
    expect(
      checks.find((check) => check.id.startsWith("MCP-TOOL-014")),
    ).toMatchObject({ status: "Warning", heuristic: true });
    expect(checks.find((check) => check.id.endsWith(":input"))).toMatchObject({
      status: "Failed",
      category: "tools",
    });
  });
  it("detects identifier mismatch and does not mark absent envelopes passed", () => {
    expect(
      evaluate(empty()).find((check) => check.id === "MCP-PROTOCOL-004")
        ?.status,
    ).toBe("Blocked");
    const checks = evaluate({
      ...empty(),
      records: [
        record(1, { response: { jsonrpc: "2.0", id: "other", result: {} } }),
      ],
    });
    expect(
      checks.find((check) => check.id === "MCP-PROTOCOL-004"),
    ).toMatchObject({ status: "Failed", severity: "critical" });
  });
  it("rejects non-object MCP results and unknown discriminators", () => {
    for (const result of [null, [], 1, { resultType: "surprise" }]) {
      const checks = evaluate({
        ...empty(),
        records: [record(1, { response: { jsonrpc: "2.0", id: "1", result } })],
      });
      expect(
        checks.find((check) => check.id === "MCP-PROTOCOL-004")?.status,
      ).toBe("Failed");
    }
  });
  it("does not label HTTP authentication bodies as malformed MCP responses", () => {
    const checks = evaluate({
      ...empty(),
      records: [
        record(1, {
          httpStatus: 401,
          response: "<html>Unauthorized</html>",
          error: { kind: "authentication", message: "HTTP 401" },
        }),
      ],
    });
    expect(
      checks.find((check) => check.id === "MCP-PROTOCOL-004")?.status,
    ).toBe("Blocked");
  });
  it("accepts missing error IDs for request rejection by HTTP", () => {
    const checks = evaluate({
      ...empty(),
      records: [
        record(1, {
          httpStatus: 400,
          response: {
            jsonrpc: "2.0",
            error: { code: -32600, message: "Invalid request" },
          },
          error: { kind: "protocol", message: "Invalid request" },
        }),
      ],
    });
    expect(
      checks.find((check) => check.id === "MCP-PROTOCOL-004")?.status,
    ).toBe("Passed");
  });
  it("does not claim server-independent TCP sessions were verified", () => {
    const checks = evaluate({ ...empty(), records: [record(1)] });
    expect(
      checks.find((check) => check.id === "MCP-PROTOCOL-006")?.status,
    ).toBe("Not Tested");
    expect(
      checks.find((check) => check.id === "MCP-SECURITY-003")?.status,
    ).toBe("Not Tested");
  });
  it("reports invalid-argument server probes as unexecuted", () => {
    expect(
      evaluate(empty()).find((check) => check.id === "MCP-SECURITY-005")
        ?.status,
    ).toBe("Not Tested");
  });
  it("validates output against structuredContent", () => {
    expect(
      validateToolResult(
        "find_orders",
        {
          resultType: "complete",
          content: [{ type: "text", text: "{}" }],
          structuredContent: { count: "wrong" },
        },
        { type: "object", properties: { count: { type: "integer" } } },
      ).find((check) => check.id.startsWith("MCP-OUTPUT"))?.status,
    ).toBe("Failed");
  });
  it("does not validate input_required as completed output", () => {
    expect(
      validateToolResult("find_orders", { resultType: "input_required" })[0]
        .status,
    ).toBe("Not Tested");
    expect(
      validateToolResult(
        "find_orders",
        { resultType: "input_required" },
        { type: "object" },
      ).find((check) => check.id === "MCP-OUTPUT:find_orders")?.status,
    ).toBe("Not Tested");
    expect(
      validateToolResult(
        "find_orders",
        { content: [], isError: true },
        { type: "object" },
      ).find((check) => check.id === "MCP-OUTPUT:find_orders")?.status,
    ).toBe("Not Tested");
  });
  it("does not falsely fail output that has been redacted", () => {
    expect(
      validateToolResult(
        "test",
        { content: [], structuredContent: { token: "[REDACTED]" } },
        { type: "object", properties: { token: { type: "number" } } },
      ).find((check) => check.id.startsWith("MCP-OUTPUT"))?.status,
    ).toBe("Not Tested");
  });
  it("excludes pending requests from performance observations", () => {
    expect(metrics([record(0, { response: undefined })])).toMatchObject({
      count: 0,
      samples: 0,
      average: null,
    });
    expect(
      evaluate({
        ...empty(),
        records: [record(0, { response: undefined })],
      }).find((check) => check.id === "MCP-PROTOCOL-005")?.status,
    ).toBe("Not Tested");
  });
  it("diagnoses malformed catalog definitions without throwing", () => {
    const snapshot = {
      ...empty(),
      tools: [
        null,
        {
          ...tool,
          description: 4,
          inputSchema: { properties: { customer: null } },
        },
      ],
      resources: [null],
      templates: [null],
      prompts: [null, { name: "bad", arguments: [null] }],
    } as unknown as Snapshot;
    expect(() => evaluate(snapshot)).not.toThrow();
    expect(
      evaluate(snapshot).filter((check) => check.status === "Failed").length,
    ).toBeGreaterThan(3);
  });
  it("rejects invalid content blocks and prompt roles", () => {
    expect(
      validateToolResult("test", { content: [{ type: "text", text: 12 }] })[0]
        .status,
    ).toBe("Failed");
    expect(
      validatePromptResult("test", {
        messages: [{ role: "user", content: { type: "text", text: "Hi" } }],
      })[0].status,
    ).toBe("Passed");
    expect(
      validateResourceResult("x://y", { contents: [{ uri: "x://y" }] })[0]
        .status,
    ).toBe("Failed");
  });
  it("checks RFC6570 templates without requiring a fixed URI scheme", () => {
    expect(validUriTemplate("{+path}{?search,limit}")).toBe(true);
    expect(validUriTemplate("data://items/{id:3}{?fields*}")).toBe(true);
    expect(validUriTemplate("data://items/{id**}")).toBe(false);
    expect(validUriTemplate("data://items/}id{")).toBe(false);
    expect(validUriTemplate("data://items/{id:0}")).toBe(false);
  });
  it("calculates nearest-rank browser percentiles and excludes cache hits", () => {
    expect(
      metrics([
        record(10),
        record(20),
        record(30),
        record(1, { cached: true }),
        record(500, { error: { kind: "timeout", message: "Timeout" } }),
      ]),
    ).toMatchObject({
      count: 4,
      samples: 3,
      average: 20,
      p50: 20,
      p95: 30,
      errors: 1,
      timeouts: 1,
    });
  });
});

describe("safe automatic runner", () => {
  const fixture = (
    capabilities: Record<string, unknown> = {
      tools: {},
      resources: {},
      prompts: {},
    },
  ) => {
    const methods: string[] = [];
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as RpcRequest;
        methods.push(request.method);
        const results: Record<string, unknown> = {
          "server/discover": { supportedVersions: [MCP_VERSION], capabilities },
          "tools/list": { tools: [tool] },
          "resources/list": {
            resources: [{ uri: "info://orders", name: "orders" }],
          },
          "resources/templates/list": { resourceTemplates: [] },
          "prompts/list": { prompts: [{ name: "summarize" }] },
        };
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            result: {
              resultType: "complete",
              ...(results[request.method] as object),
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    );
    return {
      methods,
      client: new McpClient({ endpoint: "https://example.com/mcp", fetchImpl }),
    };
  };
  it("discovers and lists only declared features without executing tools", async () => {
    const { client, methods } = fixture();
    const progress = vi.fn();
    const output = await runSafeTests(client, { onProgress: progress });
    expect(methods).toEqual([
      "server/discover",
      "tools/list",
      "resources/list",
      "resources/templates/list",
      "prompts/list",
    ]);
    expect(output.snapshot.tools).toHaveLength(1);
    expect(output.score.score).not.toBeNull();
    expect(output.snapshot.records).toHaveLength(5);
    expect(output.score.readiness).toBe("Not Verified");
    expect(progress).toHaveBeenCalled();
  });
  it("does not penalize optional capabilities that are absent", async () => {
    const { client, methods } = fixture({});
    const output = await runSafeTests(client);
    expect(methods).toEqual(["server/discover"]);
    expect(
      output.tests.find((test) => test.id === "RUN-RESOURCES")?.status,
    ).toBe("Not Applicable");
    expect(output.tests.find((test) => test.id === "RUN-TOOLS")?.status).toBe(
      "Not Applicable",
    );
  });
  it("preserves ambiguous network errors as blocked checks", async () => {
    const client = new McpClient({
      endpoint: "https://example.com/mcp",
      fetchImpl: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    });
    const output = await runSafeTests(client);
    expect(
      output.tests.find((test) => test.id === "RUN-DISCOVERY"),
    ).toMatchObject({ status: "Blocked" });
    expect(
      output.tests.find((test) => test.id === "RUN-DISCOVERY")?.recommendation,
    ).toContain("terminal diagnostics");
    expect(output.tests.find((test) => test.id === "RUN-TOOLS")?.status).toBe(
      "Blocked",
    );
  });
  it("does not count cancellation as success", async () => {
    const { client, methods } = fixture();
    const controller = new AbortController();
    controller.abort();
    const output = await runSafeTests(client, { signal: controller.signal });
    expect(methods).toHaveLength(0);
    expect(output.score).toMatchObject({
      score: null,
      coverage: 0,
      evaluated: 0,
      readiness: "Not Verified",
    });
    expect(
      output.tests.find((test) => test.id === "RUN-DISCOVERY")?.status,
    ).toBe("Not Tested");
  });

  it("does not treat an HTTPS URL as TLS evidence when no response is accessible", async () => {
    const client = new McpClient({
      endpoint: "https://example.com/mcp",
      fetchImpl: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    });
    const output = await runSafeTests(client);
    expect(
      output.tests.find((test) => test.id === "MCP-SECURITY-001")?.status,
    ).toBe("Not Tested");
    expect(
      output.tests.find((test) => test.id === "MCP-PERFORMANCE-002"),
    ).toMatchObject({
      status: "Warning",
      scoreEligible: false,
    });
    expect(
      output.tests.find((test) => test.id === "MCP-PROTOCOL-002")?.status,
    ).toBe("Passed");
    expect(output.score).toMatchObject({
      score: null,
      classification: "Not Verified",
      readiness: "Not Verified",
      evaluated: 0,
      coverage: 0,
    });
    expect(
      Object.values(output.score.byCategory).every(
        (category) => category.score === null,
      ),
    ).toBe(true);
  });

  it("withholds the score after a discovery timeout", async () => {
    const client = new McpClient({
      endpoint: "https://example.com/mcp",
      timeoutMs: 1,
      fetchImpl: vi.fn(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    });
    const output = await runSafeTests(client);
    expect(output.snapshot.records[0].error?.kind).toBe("timeout");
    expect(output.score).toMatchObject({
      score: null,
      coverage: 0,
      evaluated: 0,
      readiness: "Not Verified",
    });
  });

  it("does not score the MCP server from an HTTP authentication rejection", async () => {
    const client = new McpClient({
      endpoint: "https://example.com/mcp",
      fetchImpl: vi.fn().mockResolvedValue(
        new Response("Unauthorized", {
          status: 401,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    });
    const output = await runSafeTests(client);
    expect(output.snapshot.records[0].httpStatus).toBe(401);
    expect(output.score).toMatchObject({
      score: null,
      classification: "Not Verified",
      readiness: "Not Verified",
    });
  });

  it("refuses authentication probes without explicit authorization", async () => {
    await expect(
      runAuthenticationProbe("https://example.com/mcp", {
        authorized: false,
        mode: "invalid-token",
      }),
    ).rejects.toThrow("Explicit authorization");
  });
});
