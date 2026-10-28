import { McpClient, McpError } from "../mcp/client";
import { calculateScore, evaluate, finding } from "../validation";
import type { Snapshot, TestResult, ScoreSummary } from "../validation";

export interface SafeRunOptions {
  signal?: AbortSignal;
  onProgress?: (tests: TestResult[]) => void;
}
export interface SafeRunResult {
  snapshot: Snapshot;
  tests: TestResult[];
  score: ScoreSummary;
}

/** Sequential requests bound automatic concurrency to one. No tools/call or resource reads. */
export async function runSafeTests(
  client: McpClient,
  options: SafeRunOptions = {},
): Promise<SafeRunResult> {
  const previousRecordIds = new Set(client.records.map((record) => record.id));
  const snapshot: Snapshot = {
    tools: [],
    resources: [],
    templates: [],
    prompts: [],
    records: [],
  };
  const steps = [
    finding(
      "RUN-DISCOVERY",
      "Connectivity and discovery",
      "protocol",
      "Not Tested",
      "server",
      "Waiting to run.",
    ),
    finding(
      "RUN-TOOLS",
      "Tools listing",
      "tools",
      "Not Tested",
      "server",
      "Waiting for capabilities.",
    ),
    finding(
      "RUN-RESOURCES",
      "Resources listing",
      "tools",
      "Not Tested",
      "server",
      "Waiting for capabilities.",
    ),
    finding(
      "RUN-TEMPLATES",
      "Resource templates listing",
      "tools",
      "Not Tested",
      "server",
      "Waiting for capabilities.",
    ),
    finding(
      "RUN-PROMPTS",
      "Prompts listing",
      "tools",
      "Not Tested",
      "server",
      "Waiting for capabilities.",
    ),
  ];
  const publish = () =>
    options.onProgress?.(steps.map((test) => ({ ...test })));
  async function run(
    index: number,
    operation: () => Promise<void>,
    applicable = true,
  ): Promise<void> {
    const step = steps[index];
    if (!applicable) {
      Object.assign(step, {
        status: "Not Applicable",
        evidence: "The server does not advertise this optional capability.",
      });
      publish();
      return;
    }
    if (options.signal?.aborted) {
      Object.assign(step, {
        status: "Not Tested",
        evidence: "Cancelled before this check ran.",
      });
      publish();
      return;
    }
    Object.assign(step, {
      evidence:
        "Running a read-only MCP request directly against the selected endpoint.",
    });
    publish();
    try {
      await operation();
      Object.assign(step, {
        status: "Passed",
        evidence: "The request completed and its result shape was accepted.",
      });
    } catch (error) {
      const kind = error instanceof McpError ? error.kind : "protocol";
      const status =
        kind === "cancelled"
          ? "Not Tested"
          : ["network", "authentication", "timeout", "http"].includes(kind)
            ? "Blocked"
            : "Failed";
      Object.assign(step, {
        status,
        severity: status === "Failed" ? "error" : "info",
        evidence: error instanceof McpError && error.code !== undefined
          ? `JSON-RPC ${error.code}: ${error.message}`
          : `${kind}: ${error instanceof Error ? error.message : "Request failed."}`,
        recommendation:
          kind === "network"
            ? "Possible CORS block or connectivity issue. Inspect the browser network panel; no server defect is established."
            : "Inspect the request record for details.",
      });
    }
    publish();
  }
  publish();
  await run(0, async () => {
    snapshot.discovery = await client.discover({
      signal: options.signal,
      bypassCache: true,
    });
  });
  if (snapshot.discovery) {
    const capabilities = snapshot.discovery.capabilities;
    await run(
      1,
      async () => {
        snapshot.tools = await client.listTools({
          signal: options.signal,
          bypassCache: true,
        });
      },
      capabilities.tools !== undefined,
    );
    await run(
      2,
      async () => {
        snapshot.resources = await client.listResources({
          signal: options.signal,
          bypassCache: true,
        });
      },
      capabilities.resources !== undefined,
    );
    await run(
      3,
      async () => {
        snapshot.templates = await client.listResourceTemplates({
          signal: options.signal,
          bypassCache: true,
        });
      },
      capabilities.resources !== undefined,
    );
    await run(
      4,
      async () => {
        snapshot.prompts = await client.listPrompts({
          signal: options.signal,
          bypassCache: true,
        });
      },
      capabilities.prompts !== undefined,
    );
  } else {
    for (const step of steps.slice(1))
      Object.assign(step, {
        status: options.signal?.aborted ? "Not Tested" : "Blocked",
        evidence:
          "No discovery capabilities available; capability-dependent checks were not executed.",
      });
    publish();
  }
  snapshot.records = client.records.filter(
    (record) => !previousRecordIds.has(record.id),
  );
  const rejected = (
    steps[1].status === "Passed" ? client.rejectedTools : []
  ).map((tool) =>
    finding(
      `MCP-HEADER:${tool.name}`,
      "Invalid parameter header mapping",
      "tools",
      "Failed",
      `tool:${tool.name}`,
      tool.reason,
      "Correct x-mcp-header annotations. The client excludes this tool as required by the HTTP binding.",
      "https://modelcontextprotocol.io/specification/2026-07-28/server/tools#x-mcp-header",
    ),
  );
  const tests = [...steps, ...evaluate(snapshot), ...rejected];
  options.onProgress?.(tests);
  return { snapshot, tests, score: calculateScore(tests, snapshot) };
}

export interface AuthenticationProbeOptions {
  authorized: boolean;
  mode: "anonymous" | "invalid-token";
  headerName?: string;
  signal?: AbortSignal;
}

/** Explicitly authorized discovery-only probe; public discovery is not a security failure. */
export async function runAuthenticationProbe(
  endpoint: string,
  options: AuthenticationProbeOptions,
): Promise<{ test: TestResult; records: McpClient["records"] }> {
  if (!options.authorized)
    throw new Error(
      "Explicit authorization is required for authentication probes.",
    );
  const headers: Record<string, string> =
    options.mode === "invalid-token"
      ? {
          [options.headerName ?? "Authorization"]:
            options.headerName &&
            options.headerName.toLowerCase() !== "authorization"
              ? "orionis-inspector-invalid-credential"
              : "Bearer orionis-inspector-invalid-credential",
        }
      : {};
  const client = new McpClient({ endpoint, headers, timeoutMs: 10_000 });
  let status: TestResult["status"] = "Warning";
  let evidence =
    "Discovery succeeded. Public discovery may be intentional; this does not establish whether tools are protected.";
  try {
    await client.discover({ signal: options.signal, bypassCache: true });
  } catch (error) {
    status =
      error instanceof McpError && error.kind === "authentication"
        ? client.records.at(-1)?.httpStatus === 401
          ? "Passed"
          : "Warning"
        : "Blocked";
    evidence = error instanceof McpError && error.code !== undefined
      ? `JSON-RPC ${error.code}: ${error.message}`
      : error instanceof Error ? error.message : "Probe failed.";
    if (client.records.at(-1)?.httpStatus === 403)
      evidence +=
        " A 403 may reflect authentication, authorization or Origin policy; authentication enforcement is not confirmed.";
  }
  return {
    test: finding(
      `MCP-SECURITY-PROBE:${options.mode}`,
      `${options.mode} discovery authentication probe`,
      "security",
      status,
      "server",
      evidence,
      "Verify the intended authorization policy for each operation. This result covers only discovery.",
      "https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization",
    ),
    records: client.records,
  };
}
