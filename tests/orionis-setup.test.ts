import { describe, expect, it } from "vitest";
import { INSPECTOR_ORIGIN, orionisEnvironment } from "../src/core/connection/orionis-setup";

describe("copyable Orionis environment configuration", () => {
  it("configures the public origin, POST preflight and MCP request headers", () => {
    expect(orionisEnvironment(INSPECTOR_ORIGIN)).toBe([
      'CORS_ALLOW_ORIGINS="list:[\'https://inspector.orionis-framework.com\']"',
      'CORS_ALLOW_METHODS="list:[\'POST\', \'OPTIONS\']"',
      'CORS_ALLOW_HEADERS="list:[\'*\']"',
    ].join("\n"));
  });
  it.each(["http://127.0.0.1:4173", "http://localhost:5173", "http://[::1]:4173"])(
    "also permits the exact local inspector origin %s",
    (origin) => {
      expect(orionisEnvironment(origin).split("\n")[0]).toBe(
        `CORS_ALLOW_ORIGINS="list:['${INSPECTOR_ORIGIN}', '${origin}']"`,
      );
    },
  );
  it.each([
    "null", "file:///tmp/inspector", "https://example.com/path",
    "https://user:secret@example.com", "https://example.com\nOTHER=value",
    "https://evil'host.example", "https://example.com#fragment",
  ])("does not inject a non-origin value into dotenv: %s", (origin) => {
    expect(orionisEnvironment(origin)).toBe(orionisEnvironment(INSPECTOR_ORIGIN));
  });
});
