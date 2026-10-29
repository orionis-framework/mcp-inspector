import { describe, expect, it } from "vitest";
import {
  exportReportHtml,
  exportReportJson,
  exportReportPdf,
  hermesConfig,
  requestAsCurl,
  requestAsPreflightCurl,
  requestAsPreflightPowerShell,
  requestAsFetch,
  requestAsJson,
} from "../src/core/reporting";
import type { RequestRecord } from "../src/types/mcp";

const record: RequestRecord = {
  id: "test-1",
  endpoint: "https://example.com/mcp?api_key=query-secret",
  method: "tools/call",
  startedAt: "2026-10-28T12:00:00.000Z",
  durationMs: 12,
  bytes: 120,
  events: [],
  configuredHeaders: {
    Authorization: "Bearer private-token",
    "X-Api-Key": "header-secret",
    "MCP-Method": "tools/call",
  },
  accessibleHeaders: { "content-type": "application/json" },
  request: {
    jsonrpc: "2.0",
    id: "test-1",
    method: "tools/call",
    params: {
      name: "lookup",
      arguments: { value: "user's $(secret)", password: "payload-secret" },
    },
  },
};

describe("local report exports", () => {
  it("keeps execution evidence and coverage without credentials", () => {
    const report = exportReportJson(
      {
        endpoint: record.endpoint,
        protocolVersion: "2026-07-28",
        history: [record],
        tests: [{ status: "Not Tested" }],
        score: { value: null },
        coverage: 0,
      },
      ["private-token", "header-secret", "payload-secret", "query-secret"],
    );
    expect(JSON.parse(report)).toMatchObject({
      protocolVersion: "2026-07-28",
      coverage: 0,
      tests: [{ status: "Not Tested" }],
    });
    for (const secret of [
      "private-token",
      "header-secret",
      "payload-secret",
      "query-secret",
    ])
      expect(report).not.toContain(secret);
  });

  it("escapes hostile server content and contains no executable report script", () => {
    const report = exportReportHtml({
      endpoint: "https://example.com/mcp",
      diagnostics: [
        { evidence: "<script>alert(1)</script><img src=x onerror=alert(2)>" },
      ],
    });
    expect(report).toContain("&lt;script&gt;");
    expect(report).not.toContain("<script>");
    expect(report).not.toContain("<img");
    expect(report).toContain("default-src 'none'");
  });

  it("generates a local PDF Blob from evidence", async () => {
    const blob = await exportReportPdf({
      endpoint: "https://example.com/mcp",
      tests: [{ status: "Passed", evidence: "Español 漢字" }],
    });
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(500);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

describe("request exports", () => {
  it.each([requestAsJson, requestAsCurl, requestAsFetch])(
    "redacts authorization, API keys and payload secrets",
    (exporter) => {
      const result = exporter(record, ["query-secret"]);
      for (const secret of [
        "private-token",
        "header-secret",
        "payload-secret",
        "query-secret",
      ])
        expect(result).not.toContain(secret);
      expect(result).toContain("tools/call");
    },
  );

  it("quotes apostrophes safely for POSIX cURL and explains CORS difference", () => {
    const result = requestAsCurl(record);
    expect(result).toContain(`user'"'"'s $(secret)`);
    expect(result).toContain("does not enforce browser CORS");
  });

  it("creates direct Fetch instructions with no proxy, cookies or insecure CORS mode", () => {
    const result = requestAsFetch(record);
    expect(result).toContain('credentials: "omit"');
    expect(result).toContain('redirect: "error"');
    expect(result).not.toContain("no-cors");
    expect(result).not.toContain("/api/");
  });
});

describe("Hermes native configuration", () => {
  it("uses documented native YAML and stateless transport without credentials", () => {
    const output = hermesConfig(
      "https://user:pass@example.com/mcp?token=private-token",
    );
    expect(output).toContain("mcp_servers:");
    expect(output).toContain("protocol: stateless");
    expect(output).toContain("supports_parallel_tool_calls: false");
    expect(output).not.toContain("user:pass");
    expect(output).not.toContain("private-token");
  });

  it("rejects non-HTTP configuration URLs", () => {
    expect(() => hermesConfig("javascript:alert(1)")).toThrow("HTTP(S)");
  });
});

describe("diagnostic preflight exports", () => {
  it("exports literal PowerShell arguments without credentials or certificate bypass", () => {
    const output = requestAsPreflightPowerShell({
      ...record,
      endpoint: "https://example.com/mcp/o'neil$(secret)?token=private-value",
    }, "https://inspector.orionis-framework.com");
    expect(output).toContain("curl.exe --include --max-time 20 --request OPTIONS '");
    expect(output).toContain("o''neil$(secret)");
    expect(output).toContain("Access-Control-Request-Method: POST");
    for (const value of ["private-value", "private-token", "header-secret", "--insecure", "--location", "--data"])
      expect(output).not.toContain(value);
    expect(() => requestAsPreflightPowerShell(record, "file:///tmp/test")).toThrow("HTTP(S)");
  });
  it("uses the current origin and excludes safelisted Accept from required header names", () => {
    const output = requestAsPreflightCurl(
      {
        ...record,
        configuredHeaders: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          "MCP-Protocol-Version": "2026-07-28",
          "MCP-Method": "server/discover",
          Authorization: "Bearer private-token",
        },
      },
      "http://127.0.0.1:4173",
    );
    expect(output).toContain("Origin: http://127.0.0.1:4173");
    expect(output).toContain("Access-Control-Request-Method: POST");
    expect(output).toContain(
      "Access-Control-Request-Headers: authorization, content-type, mcp-method, mcp-protocol-version",
    );
    expect(output).not.toContain("private-token");
    expect(output).not.toContain("--data");
    expect(output).not.toContain("--location");
  });

  it("redacts URL credentials and never exports header values or payloads", () => {
    const output = requestAsPreflightCurl(
      {
        ...record,
        endpoint: "https://user:pass@example.com/mcp?api_key=query-secret",
      },
      "https://inspector.orionis-framework.com",
    );
    for (const secret of [
      "user:pass",
      "query-secret",
      "private-token",
      "header-secret",
      "payload-secret",
    ])
      expect(output).not.toContain(secret);
    expect(output).toContain(
      "Access-Control-Request-Headers: authorization, mcp-method, x-api-key",
    );
    expect(output).not.toContain("tools/call");
  });

  it("quotes hostile URL characters as one shell argument and validates the origin", () => {
    const output = requestAsPreflightCurl(
      {
        ...record,
        endpoint: "https://example.com/mcp/o'neil$(touch-pwned)",
      },
      "http://localhost:4174",
    );
    expect(output).toContain("o'\"'\"'neil$(touch-pwned)");
    expect(() =>
      requestAsPreflightCurl(record, "file:///tmp/index.html"),
    ).toThrow("HTTP(S)");
  });

  it("retains unsafe Accept values and omits ordinary language and text/plain headers", () => {
    const output = requestAsPreflightCurl(
      {
        ...record,
        configuredHeaders: {
          Accept: 'text/html;value="quoted"',
          "Accept-Language": "en-US,en;q=0.9",
          "Content-Type": "text/plain",
          "X-Test": "custom-header-private-value",
        },
      },
      "https://example.com",
    );
    expect(output).toContain("Access-Control-Request-Headers: accept, x-test");
    expect(output).not.toContain("custom-header-private-value");
  });
});
