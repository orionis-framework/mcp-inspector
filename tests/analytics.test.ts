import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const script = readFileSync(new URL("../public/google-analytics.js", import.meta.url), "utf8");

function load(search: string) {
  const window = { location: { search } };
  const appendChild = vi.fn();
  runInNewContext(script, {
    window,
    URLSearchParams,
    document: { createElement: () => ({}), head: { appendChild } },
  });
  return { window, appendChild };
}

describe("analytics on shared endpoint links", () => {
  it.each(["?mcp=", "?mcp=invalid", "?mcp=https%3A%2F%2Fprivate.test%2Fmcp%3Ftoken%3Dsecret", "?%6dcp=https://localhost:8000/mcp"])(
    "never loads or configures analytics for %s",
    (search) => {
      const { window, appendChild } = load(search);
      expect(window).not.toHaveProperty("dataLayer");
      expect(appendChild).not.toHaveBeenCalled();
    },
  );
  it("preserves the existing analytics configuration without mcp", () => {
    const { window, appendChild } = load("");
    expect(window).toHaveProperty("dataLayer");
    expect(appendChild).toHaveBeenCalledExactlyOnceWith({
      async: true,
      src: "https://www.googletagmanager.com/gtag/js?id=G-00KY9GMZQ0",
    });
  });
});
