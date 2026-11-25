import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { McpClient } from "../../src/core/mcp/client";
import type { JsonObject, StreamEvent } from "../../src/types/mcp";

let fixture: ChildProcess;
let endpoint: string;
let client: McpClient;
let fixtureErrors = "";

beforeAll(async () => {
  const framework = resolve(process.env.ORIONIS_FRAMEWORK_PATH ?? "../framework");
  const useCheckout = Boolean(process.env.ORIONIS_FRAMEWORK_PATH) || !process.env.ORIONIS_PYTHON;
  const python = process.env.ORIONIS_PYTHON ?? resolve(
    framework,
    process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python",
  );
  if (useCheckout && !existsSync(resolve(framework, "orionis/mcp")))
    throw new Error("Orionis checkout missing. Set ORIONIS_PYTHON to test an installed release, or ORIONIS_FRAMEWORK_PATH to test a checkout.");
  if (!existsSync(python))
    throw new Error("Set ORIONIS_PYTHON to the Python executable in the Orionis environment.");
  const args = ["-I", "-B", resolve("tests/integration/orionis_server.py")];
  if (useCheckout) args.push(framework);
  fixture = spawn(python, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  endpoint = await new Promise<string>((resolveEndpoint, reject) => {
    let output = "";
    fixture.stderr!.on("data", (part: Buffer) => { fixtureErrors += part.toString(); });
    fixture.on("error", reject);
    fixture.on("exit", (code) => reject(new Error(`Orionis fixture exited (${code}): ${fixtureErrors}`)));
    fixture.stdout!.on("data", (part: Buffer) => {
      output += part.toString();
      if (output.includes("\n")) {
        try {
          resolveEndpoint((JSON.parse(output.split("\n")[0]) as { endpoint: string }).endpoint);
        } catch (error) { reject(error); }
      }
    });
  });
  client = new McpClient({ endpoint });
});

afterAll(async () => {
  client?.disconnect();
  if (fixture && fixture.exitCode === null) {
    const exited = new Promise<void>((done) => fixture.once("exit", () => done()));
    fixture.kill();
    await exited;
  }
  expect(fixtureErrors).not.toContain("Traceback");
});

describe.sequential("real Orionis HTTP transport", () => {
  it("discovers stateless capabilities and follows native pagination", async () => {
    const discovery = await client.discover();
    expect(discovery.supportedVersions).toEqual(["2026-07-28"]);
    expect(discovery.capabilities).toMatchObject({
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true },
      completions: {},
    });
    expect(discovery._meta?.["io.modelcontextprotocol/serverInfo"]).toMatchObject({
      name: "Orionis real transport fixture",
    });
    const tools = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(["deferred", "echo", "eu", "not-found", "slow", "stream", "unavailable"]);
    expect(client.rejectedTools).toEqual([]);
    expect(client.records.filter((record) => record.method === "tools/list")).toHaveLength(tools.length);
    expect(client.records.every((record) => record.error === undefined)).toBe(true);
    expect(client.records.some((record) => "Mcp-Session-Id" in record.configuredHeaders)).toBe(false);
  });

  it("mirrors UTF-8 argument headers and accepts structured array output", async () => {
    const result = await client.callTool("echo", { text: "Bogotá ☀" });
    expect(result.structuredContent).toEqual(["Bogotá ☀"]);
    expect(result.isError).not.toBe(true);
    const record = client.records.at(-1)!;
    expect(record.configuredHeaders["MCP-Name"]).toBe("echo");
    expect(record.httpStatus).toBe(200);
  });

  it("preserves operational tool names and enum values matching endpoint query values", async () => {
    const regional = new McpClient({ endpoint: `${endpoint}?region=eu` });
    try {
      await regional.discover();
      const tool = (await regional.listTools()).find((entry) => entry.name === "eu");
      expect(tool?.inputSchema.properties?.region.enum).toEqual(["eu", "us"]);
      let rawOutput: unknown;
      const result = await regional.callTool("eu", { region: "eu" }, {
        validateResult: (raw) => { rawOutput = raw.structuredContent; },
      });
      expect(result.isError).not.toBe(true);
      expect(rawOutput).toEqual(["eu"]);
      expect(regional.records.at(-1)?.endpoint).not.toContain("=eu");
    } finally {
      regional.disconnect();
    }
  });

  it("reads exact and template resources and reuses real cache hints", async () => {
    expect(await client.listResources()).toMatchObject([{ name: "guide", uri: "docs://guide" }]);
    expect(await client.listResourceTemplates()).toMatchObject([{ name: "profile", uriTemplate: "users://{user_id}/profile" }]);
    expect(await client.readResource("users://42/profile")).toMatchObject({ contents: [{ text: "42" }] });
    expect(await client.readResource("docs://guide")).toMatchObject({ contents: [{ text: "Orionis integration guide" }] });
    await client.readResource("docs://guide");
    expect(client.records.at(-1)?.cached).toBe(true);
  });

  it("retrieves prompts and completes prompt and resource arguments", async () => {
    expect(await client.listPrompts()).toMatchObject([{ name: "describe", arguments: [{ name: "tone", required: true }] }]);
    const prompt = await client.getPrompt("describe", { tone: "friendly" });
    expect(prompt.messages.map((message) => message.role)).toEqual(["assistant", "user"]);
    expect(prompt.messages[1].content).toMatchObject({ text: "friendly" });
    expect(await client.complete({ type: "ref/prompt", name: "describe" }, { name: "tone", value: "f" })).toMatchObject({ completion: { values: ["formal", "friendly"] } });
    expect(await client.complete({ type: "ref/resource", uri: "users://{user_id}/profile" }, { name: "user_id", value: "4" })).toMatchObject({ completion: { values: ["42", "43"] } });
  });

  it("preserves an explicitly empty prompt argument while rejecting a missing one", async () => {
    const prompt = await client.getPrompt("describe", { tone: "" });
    expect(prompt.messages[1].content).toMatchObject({ type: "text", text: "" });
    await expect(client.getPrompt("describe", {})).rejects.toMatchObject({ kind: "protocol", code: -32602 });
  });

  it("returns a native MRTR continuation without replay or completed-output validation", async () => {
    let validated = false;
    const result = await client.callTool("deferred", {}, {
      validateResult: () => { validated = true; },
    });
    expect(result).toMatchObject({ resultType: "input_required", requestState: "fixture-continuation" });
    expect(validated).toBe(false);
    expect(result.content).toBeUndefined();
    const calls = client.records.filter((record) => record.method === "tools/call" && record.request.params.name === "deferred");
    expect(calls).toHaveLength(1);
  });

  it("distinguishes execution errors from protocol errors", async () => {
    expect(await client.callTool("echo", {})).toMatchObject({ isError: true, content: [{ text: "Invalid tool arguments" }] });
    await expect(client.getPrompt("describe", {})).rejects.toMatchObject({ kind: "protocol", code: -32602 });
    await expect(client.readResource("missing://resource")).rejects.toMatchObject({ kind: "protocol" });
    expect(client.records.at(-1)?.error?.code).toBeTypeOf("number");
    await expect(client.callTool("not-found", {})).rejects.toMatchObject({ kind: "protocol", code: -32601 });
    expect(client.records.at(-1)?.httpStatus).toBe(404);
  });

  it("preserves a native JSON-RPC error returned with HTTP 503", async () => {
    await expect(client.callTool("unavailable", {})).rejects.toMatchObject({
      kind: "protocol", code: -32603, message: "Service temporarily unavailable",
    });
    expect(client.records.at(-1)?.httpStatus).toBe(503);
  });

  it("reports a real Orionis Origin-policy rejection as authentication failure", async () => {
    const rejected = new McpClient({
      endpoint,
      fetchImpl: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("Origin", "https://untrusted.example");
        return fetch(input, { ...init, headers });
      },
    });
    await expect(rejected.discover()).rejects.toMatchObject({ kind: "authentication" });
    expect(rejected.records.at(-1)?.httpStatus).toBe(403);
    rejected.disconnect();
  });

  it("consumes real SSE progress and its final response", async () => {
    const events: StreamEvent[] = [];
    const result = await client.callTool("stream", {}, { onEvent: (event) => events.push(event) });
    expect(result.content).toMatchObject([{ type: "text", text: "finished" }]);
    const progress = events.filter((event) => (event.data as JsonObject).method === "notifications/progress");
    expect(progress.map((event) => ((event.data as JsonObject).params as JsonObject).progress)).toEqual([1, 2]);
    expect(client.records.at(-1)?.accessibleHeaders["content-type"]).toContain("text/event-stream");
  });

  it("cancels a running SSE operation without poisoning the next request", async () => {
    const abort = new AbortController();
    await expect(client.callTool("slow", {}, {
      signal: abort.signal,
      onEvent: () => abort.abort(),
    })).rejects.toMatchObject({ kind: "cancelled" });
    expect(await client.discover({ bypassCache: true })).toHaveProperty("capabilities");
  });

  it("handles subscriptions, invalidation and graceful native completion", async () => {
    const methods: string[] = [];
    let controls: Promise<Response> = Promise.resolve(new Response());
    const result = await client.listen({ resourceSubscriptions: ["docs://guide"] }, {
      timeoutMs: 5000,
      onEvent: (event) => {
        const method = (event.data as JsonObject).method;
        if (typeof method !== "string") return;
        methods.push(method);
        if (method === "notifications/subscriptions/acknowledged")
          controls = fetch(new URL("/__publish", endpoint), { method: "POST" });
        if (method === "notifications/resources/updated")
          controls = fetch(new URL("/__finish", endpoint), { method: "POST" });
      },
    });
    await controls;
    expect(methods).toEqual(["notifications/subscriptions/acknowledged", "notifications/resources/updated"]);
    expect(result.resultType).toBe("complete");
    await client.readResource("docs://guide");
    expect(client.records.at(-1)?.cached).not.toBe(true);
  });
});
