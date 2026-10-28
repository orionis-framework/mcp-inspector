import type { Page } from "@playwright/test";

export const endpoint = "https://mcp.example.test/mcp";
export interface ObservedRequest {
  method: string;
  params: Record<string, unknown>;
  id: string;
  jsonrpc: string;
  headers: Record<string, string>;
}

export async function mockMcp(
  page: Page,
  options: {
    empty?: boolean;
    delayMs?: number;
    beforeRespond?: (request: ObservedRequest) => Promise<void>;
  } = {},
) {
  const requests: ObservedRequest[] = [];
  await page.route(endpoint, async (route) => {
    if (options.delayMs)
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "*",
        },
      });
      return;
    }
    const request = route.request().postDataJSON() as Omit<
      ObservedRequest,
      "headers"
    >;
    const observed = {
      ...request,
      headers: await route.request().allHeaders(),
    };
    requests.push(observed);
    await options.beforeRespond?.(observed);
    let result: Record<string, unknown> = { resultType: "complete" };
    switch (request.method) {
      case "server/discover":
        result = {
          ...result,
          supportedVersions: ["2026-07-28"],
          capabilities: options.empty
            ? {}
            : { tools: {}, resources: {}, prompts: {}, completions: {} },
          _meta: {
            "io.modelcontextprotocol/serverInfo": {
              name: "Controlled MCP fixture",
              version: "1.0.0",
            },
          },
        };
        break;
      case "tools/list":
        result = {
          ...result,
          tools: request.params.cursor
            ? [
                {
                  name: "get_status",
                  description:
                    "Return the current service status without changing stored data.",
                  inputSchema: { type: "object", properties: {} },
                  annotations: { readOnlyHint: true },
                },
              ]
            : [
                {
                  name: "greet_customer",
                  description:
                    "Create a customer greeting using the supplied customer name.",
                  inputSchema: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        minLength: 1,
                        description: "Customer display name.",
                      },
                    },
                    required: ["name"],
                    additionalProperties: false,
                  },
                  outputSchema: {
                    type: "object",
                    properties: { greeting: { type: "string" } },
                    required: ["greeting"],
                  },
                  annotations: { readOnlyHint: false, destructiveHint: true },
                },
              ],
          ...(request.params.cursor ? {} : { nextCursor: "opaque-page-2" }),
        };
        break;
      case "resources/list":
        result = {
          ...result,
          resources: [
            {
              name: "service_guide",
              uri: "guide://service",
              mimeType: "text/plain",
              description: "Service guide for support staff.",
            },
          ],
        };
        break;
      case "resources/templates/list":
        result = {
          ...result,
          resourceTemplates: [
            {
              name: "customer_profile",
              uriTemplate: "customer://{id}",
              description: "Look up a customer profile by its identifier.",
            },
          ],
        };
        break;
      case "prompts/list":
        result = {
          ...result,
          prompts: [
            {
              name: "support_reply",
              description:
                "Draft a customer support reply about a supplied topic.",
              arguments: [
                {
                  name: "topic",
                  required: true,
                  description: "Customer support topic.",
                },
              ],
            },
          ],
        };
        break;
      case "tools/call":
        result = {
          ...result,
          content: [{ type: "text", text: "Greeting created." }],
          structuredContent: {
            greeting: `Hello, ${(request.params.arguments as { name: string }).name}!`,
          },
        };
        break;
      case "resources/read":
        result = {
          ...result,
          contents: [
            {
              uri: request.params.uri,
              mimeType: "text/plain",
              text: "Read this controlled service guide.",
            },
          ],
        };
        break;
      case "prompts/get":
        result = {
          ...result,
          messages: [
            {
              role: "user",
              content: { type: "text", text: "Create a reply about shipping." },
            },
          ],
        };
        break;
      case "completion/complete":
        result = {
          ...result,
          completion: {
            values: ["shipping", "shipment"],
            total: 2,
            hasMore: false,
          },
        };
        break;
      default:
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32601,
              message: `Unexpected test method ${request.method}`,
            },
          }),
        });
        return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "MCP-Protocol-Version",
        "MCP-Protocol-Version": "2026-07-28",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: request.id, result }),
    });
  });
  return requests;
}

export async function connect(page: Page) {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "MCP server endpoint" })
    .fill(endpoint);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.getByText("Connected. Each request is independent.").waitFor();
}
