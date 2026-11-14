import { afterEach, describe, expect, it, vi } from "vitest";
import { McpClient } from "../src/core/mcp/client";
import { runSafeTests } from "../src/core/testing/runner";
import { MCP_VERSION, type RequestRecord } from "../src/types/mcp";

afterEach(() => vi.restoreAllMocks());

describe("redacted protocol evidence", () => {
  it.each(["2", "complete", "application/json", "server/discover", MCP_VERSION])(
    "does not change protocol verdicts or record identity when credentials contain %s",
    async (value) => {
      vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000002");
      const published: RequestRecord[] = [];
      const client = new McpClient({
        endpoint: "https://example.com/mcp?v=" + encodeURIComponent(value),
        headers: { "X-Access": value },
        onRecord: (record) => published.push(record),
        fetchImpl: async (_url, init) => {
          const request = JSON.parse(String(init?.body)) as { id: string };
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            result: {
              resultType: "complete",
              supportedVersions: [MCP_VERSION],
              capabilities: {},
              instructions: value,
              ttlMs: 0,
              cacheScope: "private",
            },
          }), { headers: { "content-type": "application/json" } });
        },
      });
      try {
        const result = await runSafeTests(client);
        expect(result.snapshot.discovery).toBeDefined();
        for (const id of ["MCP-PROTOCOL-002", "MCP-PROTOCOL-003", "MCP-PROTOCOL-004"])
          expect(result.tests.find((test) => test.id === id)?.status).toBe("Passed");
        expect(result.tests.filter((test) => test.status === "Failed")).toEqual([]);
        expect(client.records).toHaveLength(1);
        const record = client.records[0];
        expect(new Set(published.map((entry) => entry.id)).size).toBe(1);
        expect(record.id).toBe(record.request.id);
        expect(record.response).toMatchObject({
          jsonrpc: "2.0",
          id: record.id,
          result: { resultType: "complete", instructions: "[REDACTED]" },
        });
        expect(record.configuredHeaders["X-Access"]).toBe("[REDACTED]");
        expect(record.configuredHeaders.Accept).toBe("application/json, text/event-stream");
        expect(record.endpoint).not.toContain("?v=" + encodeURIComponent(value));
      } finally {
        client.disconnect();
      }
    },
  );
});
