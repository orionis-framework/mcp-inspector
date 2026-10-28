import { describe, it, expect } from "vitest";
import { redact, redactUrl } from "../src/utils/redact";
describe("secret hygiene", () => {
  it("redacts bearer credentials and JWTs embedded in free text", () => {
    expect(redact("Received Bearer abc.def-123")).toBe(
      "Received Bearer [REDACTED]",
    );
    expect(redact("JWT eyJheader.payload.signature")).toBe(
      "JWT [REDACTED JWT]",
    );
    expect(redact("url?token=abc&safe=ok")).toBe(
      "url?token=[REDACTED]&safe=ok",
    );
  });
  it("redacts nested headers, keys and echoed secrets", () => {
    const r = redact(
      {
        Authorization: "Bearer hi",
        nested: { apiKey: "abc", text: "echo very-secret" },
      },
      ["very-secret"],
    );
    expect(JSON.stringify(r)).not.toContain("very-secret");
    expect(r.Authorization).toBe("[REDACTED]");
    expect(r.nested.apiKey).toBe("[REDACTED]");
  });
  it("redacts URL userinfo and all query values", () =>
    expect(
      redactUrl("https://user:pass@example.com/mcp?custom=credential#secret"),
    ).toBe("https://example.com/mcp?custom=%5BREDACTED%5D"));
});
