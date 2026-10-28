import { beforeEach, describe, expect, it } from "vitest";
import { useInspector, getScore } from "../src/stores/inspector";
import { evaluate, finding } from "../src/core/validation";
import type { Snapshot } from "../src/core/validation";
import { MCP_VERSION } from "../src/types/mcp";
import type { RequestRecord } from "../src/types/mcp";

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
