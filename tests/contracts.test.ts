import { describe, expect, it } from "vitest";
import {
  validateCompletionResult,
  validateDiscoveryResult,
  validateServerCapabilities,
  validateSubscriptionAcknowledgement,
  validateSubscriptionFilter,
} from "../src/core/mcp/contracts";

describe("discovery capability contracts", () => {
  it("accepts Orionis catalogs and open capability extensions without changing data", () => {
    const discovery = {
      supportedVersions: ["2026-07-28"],
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: false, subscribe: true },
        prompts: {},
        completions: {},
        extensions: { "example.org/custom": { enabled: true } },
        experimental: { something: {} },
        "example.org/future": { modes: ["custom"] },
      },
      instructions: "Inspect the advertised primitives.",
    };
    const original = structuredClone(discovery);
    expect(() => validateDiscoveryResult(discovery)).not.toThrow();
    expect(discovery).toEqual(original);
    expect(() => validateDiscoveryResult({ supportedVersions: [], capabilities: {} })).not.toThrow();
  });

  it.each([null, [], { supportedVersions: "2026-07-28", capabilities: {} },
    { supportedVersions: [1], capabilities: {} },
    { supportedVersions: ["2026-07-28"], capabilities: null },
    { supportedVersions: ["2026-07-28"], capabilities: {}, instructions: 4 },
  ])("rejects malformed discovery: %j", (value) => {
    expect(() => validateDiscoveryResult(value)).toThrow();
  });

  it.each([
    { tools: true }, { resources: null }, { prompts: [] }, { completions: "yes" },
    { tools: { listChanged: "true" } }, { resources: { subscribe: 1 } },
    { prompts: { listChanged: null } }, { resources: { listChanged: [] } },
    { logging: false }, { extensions: [] }, { extensions: { "example.org/custom": true } },
    { experimental: { feature: null } },
  ])("rejects known invalid capability shapes: %j", (value) => {
    expect(() => validateServerCapabilities(value)).toThrow();
  });

  it("does not interpret additional fields of known or future capabilities", () => {
    expect(() => validateServerCapabilities({
      tools: { listChanged: false, futureOption: "supported" },
      completions: { "example.org/options": ["custom"] },
      "example.org/future": { anything: null },
    })).not.toThrow();
  });
});

describe("completion result contracts", () => {
  it.each([
    { completion: { values: [] } },
    { completion: { values: ["", "niño"], total: 0, hasMore: false } },
    { completion: { values: Array.from({ length: 100 }, (_, i) => String(i)), total: 250, hasMore: true } },
  ])("accepts the Orionis shape without inventing extra consistency rules", (value) => {
    expect(() => validateCompletionResult(value)).not.toThrow();
  });

  it.each([
    null, {}, { completion: null }, { completion: [] },
    { completion: { values: "one" } }, { completion: { values: [1] } },
    { completion: { values: Array(101).fill("value") } },
    { completion: { values: [], total: -1 } }, { completion: { values: [], total: 1.5 } },
    { completion: { values: [], total: Infinity } }, { completion: { values: [], total: "1" } },
    { completion: { values: [], total: null } }, { completion: { values: [], hasMore: 1 } },
  ])("rejects malformed completion results: %j", (value) => {
    expect(() => validateCompletionResult(value)).toThrow();
  });
});

describe("subscription filter and acknowledgement contracts", () => {
  it.each([{}, { toolsListChanged: false, resourceSubscriptions: [] },
    { toolsListChanged: true, resourcesListChanged: true, promptsListChanged: true,
      resourceSubscriptions: ["resource://one", "https://example.com/two"], ignored: "extension" },
  ])("allows empty and typed filters with optional unknown fields: %j", (value) => {
    expect(() => validateSubscriptionFilter(value)).not.toThrow();
  });

  it.each([null, [], { toolsListChanged: "true" }, { promptsListChanged: 1 },
    { resourcesListChanged: null }, { resourceSubscriptions: "resource://one" },
    { resourceSubscriptions: ["resource://one", 1] },
  ])("rejects malformed filter fields: %j", (value) => {
    expect(() => validateSubscriptionFilter(value)).toThrow();
  });

  it("accepts reduced and empty acknowledgements without mutating the requested filter", () => {
    const requested = {
      toolsListChanged: true,
      resourcesListChanged: true,
      resourceSubscriptions: ["resource://allowed", "resource://denied", "resource://allowed"],
    };
    const original = structuredClone(requested);
    expect(() => validateSubscriptionAcknowledgement({
      toolsListChanged: true,
      resourcesListChanged: false,
      resourceSubscriptions: ["resource://allowed"],
    }, requested)).not.toThrow();
    expect(() => validateSubscriptionAcknowledgement({}, requested)).not.toThrow();
    expect(() => validateSubscriptionAcknowledgement({}, {})).not.toThrow();
    expect(requested).toEqual(original);
  });

  it.each([
    [{ toolsListChanged: true }, {}],
    [{ resourcesListChanged: true }, { resourcesListChanged: false }],
    [{ promptsListChanged: true }, { toolsListChanged: true }],
    [{ resourceSubscriptions: ["resource://other"] }, { resourceSubscriptions: ["resource://one"] }],
    [{ resourceSubscriptions: ["resource://other"] }, {}],
    [{ toolsListChanged: "true" }, { toolsListChanged: true }],
    [null, {}],
  ])("rejects an invalid or broader acknowledgement", (accepted, requested) => {
    expect(() => validateSubscriptionAcknowledgement(accepted, requested)).toThrow();
  });
});
