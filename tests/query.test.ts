import { describe, expect, it } from "vitest";
import { connectionFromQuery } from "../src/core/connection/query";

describe("initial MCP connection query", () => {
  it.each(["", "?utm_source=docs", "?MCP=https%3A%2F%2Fexample.com"])(
    "does not configure or notify when mcp is absent: %s",
    (query) => expect(connectionFromQuery(query)).toEqual({ notice: "" }),
  );

  it.each(["?mcp", "?mcp=", "?mcp=%20%20", "?mcp=%09"])(
    "handles an empty parameter: %s",
    (query) => {
      const result = connectionFromQuery(query);
      expect(result.endpoint).toBeUndefined();
      expect(result.notice).toContain("is empty");
    },
  );

  it.each([
    "https://example.com/mcp",
    "http://localhost:8000/api/mcp",
    "http://127.0.0.1:9000/mcp",
    "http://[::1]:8080/mcp",
    "https://example.com:8443/api/mcp?tenant=a%2Fb&filter=one+two&token=a%2Bb%3D",
    "https://example.com/mcp/ni%C3%B1o?next=https%3A%2F%2Fexample.net%2Fa%3Fx%3D1",
  ])("preserves the endpoint and its internal encoding: %s", (endpoint) => {
    const result = connectionFromQuery("?mcp=" + encodeURIComponent(endpoint));
    expect(result.endpoint).toBe(endpoint);
    expect(result.notice).toContain("select Connect");
  });

  it("accepts an unencoded URL when it has no nested query separators", () => {
    expect(connectionFromQuery("?mcp=https://example.com:8443/mcp").endpoint)
      .toBe("https://example.com:8443/mcp");
  });

  it.each([
    "not a URL",
    "/mcp",
    "//example.com/mcp",
    "ftp://example.com/mcp",
    "file:///tmp/mcp",
    "javascript:alert(1)",
    "data:text/html,<h1>MCP</h1>",
    "https://user:password@example.com/mcp",
    "https://example.com/mcp#fragment",
    "https://example.com:99999/mcp",
    "https%3A%2F%2Fexample.com%2Fmcp",
    "%ZZ",
  ])("rejects unsupported or invalid input without throwing: %s", (endpoint) => {
    const result = connectionFromQuery("?mcp=" + encodeURIComponent(endpoint));
    expect(result.endpoint).toBeUndefined();
    expect(result.notice).toContain("is invalid");
    expect(result.notice).not.toContain(endpoint);
  });

  it("uses the first mcp value consistently when the parameter is repeated", () => {
    expect(connectionFromQuery("?mcp=https://first.test/mcp&mcp=https://second.test/mcp").endpoint)
      .toBe("https://first.test/mcp");
  });
});
