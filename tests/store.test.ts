import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInspector, getScore } from "../src/stores/inspector";
import { evaluate, finding } from "../src/core/validation";
import type { Snapshot } from "../src/core/validation";
import { MCP_VERSION } from "../src/types/mcp";
import type { RequestRecord } from "../src/types/mcp";
import { exportReportJson } from "../src/core/reporting";

const record = (
  id: string,
  extra: Partial<RequestRecord> = {},
): RequestRecord => ({
  id,
  endpoint: "https://example.com/mcp",
  method: "tools/call",
  startedAt: "2026-10-28T00:00:00Z",
  durationMs: 25,
  request: {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": MCP_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  },
  configuredHeaders: {
    "MCP-Protocol-Version": MCP_VERSION,
    "MCP-Method": "tools/call",
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  },
  accessibleHeaders: {},
  bytes: 45,
  events: [],
  httpStatus: 200,
  response: {
    jsonrpc: "2.0",
    id,
    result: { resultType: "complete", content: [] },
  },
  ...extra,
});
const snapshot = (records: RequestRecord[]): Snapshot => ({
  discovery: { supportedVersions: [MCP_VERSION], capabilities: { tools: {} } },
  tools: [],
  resources: [],
  templates: [],
  prompts: [],
  records,
});

beforeEach(() => useInspector.setState(useInspector.getInitialState(), true));
afterEach(() => {
  useInspector.getState().client?.disconnect();
  vi.unstubAllGlobals();
});

describe("manual evidence refresh in the workspace store", () => {
  it("replaces a previous protocol pass after a malformed manual response", () => {
    const initial = snapshot([record("initial")]);
    useInspector.setState({ snapshot: initial, tests: evaluate(initial) });
    expect(
      useInspector
        .getState()
        .tests.find((test) => test.id === "MCP-PROTOCOL-004")?.status,
    ).toBe("Passed");
    useInspector.getState().record(
      record("manual", {
        response: { jsonrpc: "2.0", id: "wrong-id", result: {} },
        error: { kind: "protocol", message: "Response ID does not match" },
      }),
    );
    const tests = useInspector.getState().tests;
    expect(tests.filter((test) => test.id === "MCP-PROTOCOL-004")).toHaveLength(
      1,
    );
    expect(tests.find((test) => test.id === "MCP-PROTOCOL-004")?.status).toBe(
      "Failed",
    );
    expect(getScore().readiness).toBe("Not Ready");
  });

  it("preserves safe-run, output validation and authorized probe evidence", () => {
    const initial = snapshot([record("initial")]);
    const retained = [
      finding(
        "RUN-TOOLS",
        "Tools listing",
        "tools",
        "Passed",
        "server",
        "Listed",
      ),
      finding(
        "MCP-OUTPUT:lookup",
        "Structured output",
        "tools",
        "Failed",
        "tool:lookup",
        "Output mismatch",
      ),
      finding(
        "MCP-RESULT:lookup",
        "Tool result",
        "tools",
        "Passed",
        "tool:lookup",
        "Valid content",
      ),
      finding(
        "MCP-SECURITY-PROBE:anonymous",
        "Authorized probe",
        "security",
        "Passed",
        "server",
        "HTTP 401",
      ),
    ];
    useInspector.setState({
      snapshot: initial,
      tests: [...evaluate(initial), ...retained],
    });
    useInspector.getState().record(record("manual"));
    for (const test of retained)
      expect(
        useInspector.getState().tests.find((entry) => entry.id === test.id),
      ).toEqual(test);
    expect(useInspector.getState().snapshot.records).toHaveLength(2);
  });

  it("does not refresh derived findings from pending requests or an active safe suite", () => {
    const initial = snapshot([record("initial")]);
    const tests = evaluate(initial);
    useInspector.setState({ snapshot: initial, tests });
    useInspector.getState().record(
      record("pending", {
        response: undefined,
        httpStatus: undefined,
        durationMs: 0,
      }),
    );
    expect(useInspector.getState().tests).toBe(tests);
    useInspector.setState({ busy: true });
    useInspector.getState().record(
      record("during-suite", {
        response: { jsonrpc: "2.0", id: "wrong", result: {} },
      }),
    );
    expect(useInspector.getState().tests).toBe(tests);
  });

  it("removes derived warnings no longer present when a record is replaced", () => {
    const initial = snapshot([
      record("replace", {
        response: { jsonrpc: "2.0", id: "replace", result: { content: [] } },
      }),
    ]);
    useInspector.setState({ snapshot: initial, tests: evaluate(initial) });
    expect(
      useInspector
        .getState()
        .tests.some((test) => test.id === "MCP-PROTOCOL-008"),
    ).toBe(true);
    useInspector.getState().record(record("replace"));
    expect(
      useInspector
        .getState()
        .tests.some((test) => test.id === "MCP-PROTOCOL-008"),
    ).toBe(false);
    expect(useInspector.getState().snapshot.records).toHaveLength(1);
  });
});

it("clears the previous server score when a new endpoint cannot create a client", async () => {
  const initial = snapshot([record("initial")]);
  useInspector.setState({
    snapshot: initial,
    tests: evaluate(initial),
    connected: true,
    endpoint: "not-a-valid-url",
  });
  expect(getScore().score).not.toBeNull();

  await useInspector.getState().connect({}, 15000);

  expect(useInspector.getState().connected).toBe(false);
  expect(useInspector.getState().snapshot.discovery).toBeUndefined();
  expect(useInspector.getState().tests).toEqual([]);
  expect(getScore()).toMatchObject({
    score: null,
    classification: "Not Verified",
    readiness: "Not Verified",
    evaluated: 0,
    coverage: 0,
  });
});

it("keeps query-matching catalogs usable while sanitizing exports and retained disconnect evidence", async () => {
  const queryValue = "private-catalog-marker";
  const credential = "private-header-marker";
  const endpoint = `https://example.com/mcp?region=eu&opaque=${queryValue}`;
  const sent: { method: string; params: Record<string, unknown> }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
    const request = JSON.parse(String(init.body)) as {
      method: string;
      params: Record<string, unknown>;
      id: string;
    };
    sent.push(request);
    const result: Record<string, unknown> = {
      resultType: "complete",
      _meta: { "io.modelcontextprotocol/serverInfo": { name: "Controlled store fixture", version: "1.0.0" } },
      ...(request.method === "server/discover"
        ? { supportedVersions: [MCP_VERSION], capabilities: { tools: {} }, ttlMs: 0, cacheScope: "private" }
        : request.method === "tools/list"
          ? {
              ttlMs: 0,
              cacheScope: "private",
              tools: [{
                name: "eu",
                description: `${queryValue} ${credential}`,
                inputSchema: {
                  type: "object",
                  properties: { region: { type: "string", enum: ["eu", "us"] } },
                  required: ["region"],
                },
              }],
            }
          : { content: [{ type: "text", text: "Executed with exact arguments" }] }),
    };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }), {
      headers: { "content-type": "application/json" },
    });
  }));
  useInspector.getState().setEndpoint(endpoint);
  await useInspector.getState().connect({ Authorization: `Bearer ${credential}` }, 15000);
  const active = useInspector.getState();
  expect(active.connected).toBe(true);
  expect(active.snapshot.tools[0].name).toBe("eu");
  expect(active.snapshot.tools[0].inputSchema.properties?.region.enum).toEqual(["eu", "us"]);
  expect(active.snapshot.tools[0].description).toContain(queryValue);
  await active.client!.callTool("eu", { region: "eu" });
  expect(sent.at(-1)?.params).toMatchObject({ name: "eu", arguments: { region: "eu" } });
  expect(JSON.stringify(active.client!.records)).not.toContain(queryValue);
  expect(JSON.stringify(active.client!.records)).not.toContain(credential);

  const activeReport = exportReportJson(active.client!.sanitize({
    endpoint,
    tools: active.snapshot.tools,
    history: active.snapshot.records,
  }));
  expect(activeReport).not.toContain(queryValue);
  expect(activeReport).not.toContain(credential);
  expect(activeReport).not.toContain('"eu"');
  useInspector.setState({
    tests: [finding("custom", "Catalog evidence", "tools", "Warning", "tool:eu", `${queryValue} ${credential}`)],
  });
  useInspector.getState().disconnect();
  const disconnected = useInspector.getState();
  expect(disconnected.client).toBeUndefined();
  expect(disconnected.connected).toBe(false);
  const retained = JSON.stringify({ snapshot: disconnected.snapshot, tests: disconnected.tests });
  expect(retained).not.toContain(queryValue);
  expect(retained).not.toContain(credential);
  expect(disconnected.snapshot.tools[0].name).toBe("[REDACTED]");
  const disconnectedReport = exportReportJson({
    endpoint,
    tools: disconnected.snapshot.tools,
    tests: disconnected.tests,
    history: disconnected.snapshot.records,
  });
  expect(disconnectedReport).not.toContain(queryValue);
  expect(disconnectedReport).not.toContain(credential);
});

it.each(["Passed", "protocol", "tools", "client", "2"])(
  "retains scores and protocol identity after disconnect with query value %s",
  async (queryValue) => {
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init: RequestInit) => {
      const request = JSON.parse(String(init.body)) as { id: string };
      return Response.json({
        jsonrpc: "2.0",
        id: request.id,
        result: { resultType: "complete", supportedVersions: [MCP_VERSION], capabilities: {} },
      });
    }));
    useInspector.getState().setEndpoint("https://example.com/mcp?v=" + queryValue);
    await useInspector.getState().connect({}, 15000);
    const score = getScore();
    const records = useInspector.getState().snapshot.records;
    useInspector.getState().disconnect();
    expect(getScore()).toEqual(score);
    expect(useInspector.getState().snapshot.records).toEqual(records);
    expect(useInspector.getState().snapshot.discovery?.supportedVersions).toEqual([MCP_VERSION]);
    expect(useInspector.getState().selection).toEqual({ kind: "overview" });
  },
);
