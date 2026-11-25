import type {
  CompletionResult,
  DiscoveryResult,
  ServerCapabilities,
  SubscriptionFilter,
} from "../../types/mcp";

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function optionalBoolean(value: Record<string, unknown>, field: string, label: string) {
  if (field in value && typeof value[field] !== "boolean")
    throw new Error(`${label}.${field} must be a boolean`);
}

/** The capability set is open; only the known shapes are interpreted here. */
export function validateServerCapabilities(
  value: unknown,
): asserts value is ServerCapabilities {
  if (!object(value)) throw new Error("Server capabilities must be an object");
  for (const name of [
    "tools",
    "resources",
    "prompts",
    "completions",
    "logging",
    "experimental",
    "extensions",
  ]) {
    if (!(name in value)) continue;
    const capability = value[name];
    if (!object(capability))
      throw new Error(`Server capability ${name} must be an object`);
    if (name === "tools" || name === "resources" || name === "prompts")
      optionalBoolean(capability, "listChanged", `capabilities.${name}`);
    if (name === "resources")
      optionalBoolean(capability, "subscribe", "capabilities.resources");
    if (
      (name === "extensions" || name === "experimental") &&
      Object.values(capability).some((entry) => !object(entry))
    )
      throw new Error(`Each ${name} capability must be an object`);
  }
}

/** Version compatibility is checked by the caller, after validating discovery. */
export function validateDiscoveryResult(
  value: unknown,
): asserts value is DiscoveryResult {
  if (
    !object(value) ||
    !Array.isArray(value.supportedVersions) ||
    !value.supportedVersions.every((version) => typeof version === "string") ||
    !object(value.capabilities)
  )
    throw new Error(
      "Not a valid MCP discovery response: supportedVersions and capabilities are required.",
    );
  validateServerCapabilities(value.capabilities);
  if ("instructions" in value && typeof value.instructions !== "string")
    throw new Error("Discovery instructions must be a string");
}

/** This client advertises no roots, sampling or elicitation capabilities. */
export function validateInputRequiredResult(method: string, result: Record<string, unknown>): void {
  if (!["tools/call", "resources/read", "prompts/get"].includes(method))
    throw new Error("This method cannot request additional input");
  if (!("requestState" in result) && !("inputRequests" in result))
    throw new Error("Input-required result needs inputRequests or requestState");
  if ("requestState" in result && typeof result.requestState !== "string")
    throw new Error("requestState must be a string");
  if ("inputRequests" in result) {
    if (!object(result.inputRequests)) throw new Error("inputRequests must be an object");
    if (Object.keys(result.inputRequests).length > 0)
      throw new Error("The server requested input capabilities that the client did not advertise");
  }
}

/** Mirrors Orionis protocol/results.py and protocol/validation.py bounds. */
export function validateCompletionResult(
  value: unknown,
): asserts value is CompletionResult {
  if (!object(value) || !object(value.completion))
    throw new Error("Completion result must contain a completion object");
  const completion = value.completion;
  if (
    !Array.isArray(completion.values) ||
    completion.values.length > 100 ||
    !completion.values.every((entry) => typeof entry === "string")
  )
    throw new Error("Completion values must be an array of at most 100 strings");
  if (
    "total" in completion &&
    (typeof completion.total !== "number" ||
      !Number.isInteger(completion.total) ||
      completion.total < 0)
  )
    throw new Error("Completion total must be a nonnegative integer");
  optionalBoolean(completion, "hasMore", "completion");
}

const subscriptionFlags = [
  "toolsListChanged",
  "promptsListChanged",
  "resourcesListChanged",
] as const;

/** Empty filters are valid; Orionis ignores unknown fields during decoding. */
export function validateSubscriptionFilter(
  value: unknown,
): asserts value is SubscriptionFilter {
  if (!object(value)) throw new Error("Subscription filter must be an object");
  for (const flag of subscriptionFlags)
    optionalBoolean(value, flag, "notifications");
  if (
    "resourceSubscriptions" in value &&
    (!Array.isArray(value.resourceSubscriptions) ||
      !value.resourceSubscriptions.every((uri) => typeof uri === "string"))
  )
    throw new Error("notifications.resourceSubscriptions must be an array of strings");
}

/** Orionis may reduce filters when capabilities, resources or access are unavailable. */
export function validateSubscriptionAcknowledgement(
  accepted: unknown,
  requested: unknown,
): asserts accepted is SubscriptionFilter {
  validateSubscriptionFilter(accepted);
  validateSubscriptionFilter(requested);
  for (const flag of subscriptionFlags) {
    if (accepted[flag] === true && requested[flag] !== true)
      throw new Error("Subscription acknowledgment accepts an unrequested notification type");
  }
  const requestedUris = new Set(requested.resourceSubscriptions ?? []);
  if (accepted.resourceSubscriptions?.some((uri) => !requestedUris.has(uri)))
    throw new Error("Subscription acknowledgment accepts an unrequested resource URI");
}
