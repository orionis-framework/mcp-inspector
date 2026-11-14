import { validateEndpoint } from "../mcp/client";

export interface InitialConnection {
  endpoint?: string;
  notice: string;
}

/** Read once at startup. URLSearchParams decodes the outer query exactly once. */
export function connectionFromQuery(search: string): InitialConnection {
  const value = new URLSearchParams(search).get("mcp");
  if (value === null) return { notice: "" };
  if (!value.trim()) {
    return {
      notice:
        "The mcp query parameter is empty. Enter an MCP endpoint to connect.",
    };
  }
  try {
    return {
      endpoint: validateEndpoint(value),
      notice:
        "MCP endpoint loaded from the link. Review it, then select Connect.",
    };
  } catch {
    return {
      notice:
        "The mcp query parameter is invalid. Use a complete HTTP or HTTPS URL without credentials or a fragment.",
    };
  }
}
