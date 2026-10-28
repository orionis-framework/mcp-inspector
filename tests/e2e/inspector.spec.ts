import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { connect, endpoint, mockMcp } from "./fixtures";

test("static workspace loads without remote services or internal API routes", async ({
  page,
}, testInfo) => {
  const urls: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Orionis MCP Inspector", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Not Verified", { exact: true }).first(),
  ).toBeVisible();
  expect(
    urls.every((url) => new URL(url).origin === "http://127.0.0.1:4173"),
  ).toBe(true);
  expect(urls.some((url) => new URL(url).pathname.startsWith("/api/"))).toBe(
    false,
  );
  expect(errors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("desktop-workspace.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({
    path: testInfo.outputPath("desktop-dark.png"),
    fullPage: true,
  });
});

test("discovery, pagination and manual tool calls carry stateless headers and metadata", async ({
  page,
}, testInfo) => {
  const requests = await mockMcp(page);
  const networkUrls: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => networkUrls.push(request.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  await connect(page);
  await expect(
    page.getByRole("button", { name: "get_status", exact: true }),
  ).toBeVisible();
  expect(
    requests.filter((request) => request.method === "tools/list"),
  ).toHaveLength(2);
  expect(requests.find((request) => request.params.cursor)?.params.cursor).toBe(
    "opaque-page-2",
  );
  expect(requests.some((request) => request.method === "tools/call")).toBe(
    false,
  );
  await page
    .getByRole("button", { name: "greet_customer", exact: true })
    .click();
  await expect(
    page.frameLocator(".json-editor iframe").locator(".monaco-editor"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Execute tool", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /required/ }),
  ).toBeVisible();
  expect(requests.some((request) => request.method === "tools/call")).toBe(
    false,
  );
  await page
    .frameLocator(".json-editor iframe")
    .locator(".monaco-editor")
    .click({ position: { x: 120, y: 35 } });
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText("{ invalid JSON");
  await page.getByRole("button", { name: "Execute tool", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /JSON|SyntaxError/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "greet_customer", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Form", exact: true }).click();
  await page.getByLabel(/^name/).fill("Ada");
  await page.getByRole("button", { name: "Apply to JSON editor" }).click();
  await page.getByRole("button", { name: "Execute tool", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(requests.some((request) => request.method === "tools/call")).toBe(
    false,
  );
  await page
    .getByRole("button", { name: "Confirm execution", exact: true })
    .click();
  await expect(page.locator(".result")).toContainText("Hello, Ada!");
  expect(
    requests.filter((request) => request.method === "tools/call"),
  ).toHaveLength(1);
  const call = requests.find((request) => request.method === "tools/call")!;
  expect(call.params.arguments).toEqual({ name: "Ada" });
  expect(call.headers["mcp-name"]).toBe("greet_customer");
  for (const request of requests) {
    expect(request.jsonrpc).toBe("2.0");
    expect(request.headers["mcp-protocol-version"]).toBe("2026-07-28");
    expect(request.headers["mcp-method"]).toBe(request.method);
    expect(request.headers["mcp-session-id"]).toBeUndefined();
    expect(request.params._meta).toMatchObject({
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
    });
    expect(["initialize", "notifications/initialized"]).not.toContain(
      request.method,
    );
  }
  expect(
    networkUrls.every(
      (url) =>
        url === endpoint ||
        new URL(url).origin === "http://127.0.0.1:4173" ||
        url.startsWith("blob:"),
    ),
  ).toBe(true);
  await page.locator(".result").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("tool-result.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("safe suite gathers evidence without executing tools", async ({
  page,
}) => {
  const requests = await mockMcp(page);
  await connect(page);
  const initialCount = requests.length;
  await page
    .getByRole("button", { name: "Run All Safe Tests", exact: true })
    .click();
  await expect(
    page.getByText("Safe checks complete. Tool execution remains manual."),
  ).toBeVisible();
  expect(requests.length).toBeGreaterThan(initialCount);
  expect(
    requests.every((request) =>
      [
        "server/discover",
        "tools/list",
        "resources/list",
        "resources/templates/list",
        "prompts/list",
      ].includes(request.method),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Security", exact: true }).click();
  await expect(page.locator(".detail")).toContainText(
    /Not Tested|Not Verified/,
  );
});

test("missing optional capabilities remain usable and gate advanced operations", async ({
  page,
}) => {
  const requests = await mockMcp(page, { empty: true });
  await connect(page);
  expect(requests.map((request) => request.method)).toEqual([
    "server/discover",
  ]);
  await page.getByRole("button", { name: "Completions", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Execute request", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Run All Safe Tests", exact: true })
    .click();
  await expect(
    page.getByText("Safe checks complete. Tool execution remains manual."),
  ).toBeVisible();
  expect(
    requests.every((request) => request.method === "server/discover"),
  ).toBe(true);
});

test("resources, prompts and completions execute only after user selection", async ({
  page,
}) => {
  const requests = await mockMcp(page);
  await connect(page);
  await page
    .getByRole("button", { name: "service_guide", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Execute request", exact: true })
    .click();
  await expect(page.locator(".result")).toContainText(
    "Read this controlled service guide.",
  );
  expect(
    requests.find((request) => request.method === "resources/read")?.headers[
      "mcp-name"
    ],
  ).toBe("guide://service");
  await page
    .getByRole("button", { name: "support_reply", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Prompt arguments" })
    .fill('{"topic":"shipping"}');
  await page
    .getByRole("button", { name: "Execute request", exact: true })
    .click();
  await expect(page.locator(".result")).toContainText(
    "Create a reply about shipping.",
  );
  expect(
    requests.find((request) => request.method === "prompts/get")?.params
      .arguments,
  ).toEqual({ topic: "shipping" });
  await page.getByRole("button", { name: "Completions", exact: true }).click();
  await page.getByLabel("Reference", { exact: true }).fill("support_reply");
  await page.getByLabel("Argument name", { exact: true }).fill("topic");
  await page.getByLabel("Value to complete", { exact: true }).fill("shi");
  await page
    .getByRole("button", { name: "Execute request", exact: true })
    .click();
  await expect(page.locator(".result")).toContainText("shipment");
  expect(
    requests.find((request) => request.method === "completion/complete")?.params
      .ref,
  ).toEqual({ type: "ref/prompt", name: "support_reply" });
});

test("ambiguous network errors do not claim confirmed CORS failure and preserve exportable evidence", async ({
  page,
}, testInfo) => {
  await page.route(endpoint, (route) => route.abort("failed"));
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "MCP server endpoint" })
    .fill(endpoint);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByText(/Possible CORS block or connectivity problem/).first(),
  ).toBeVisible();
  await expect(page.locator(".cors-help")).toContainText(
    "http://127.0.0.1:4173",
  );
  await expect(page.locator(".cors-help")).toContainText(
    "Access-Control-Request-Method: POST",
  );

  const quality = page.locator(".metric").filter({ hasText: "QUALITY SCORE" });
  await expect(quality.locator("strong")).toHaveText("—");
  await expect(quality).toContainText("Not Verified");
  await expect(quality).toContainText("0% coverage");

  await page.screenshot({
    path: testInfo.outputPath("cors-diagnostic.png"),
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download request", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("mcp-request.json");
  await expect(
    page.getByRole("button", { name: "Run All Safe Tests", exact: true }),
  ).toBeDisabled();

  await page
    .getByRole("button", { name: "Export report", exact: true })
    .click();
  const reportDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON report", exact: true }).click();
  const report = await reportDownload;
  const reportPath = await report.path();
  expect(reportPath).not.toBeNull();
  const exported = JSON.parse(await readFile(reportPath!, "utf8"));
  expect(exported.score).toMatchObject({
    score: null,
    classification: "Not Verified",
    readiness: "Not Verified",
    evaluated: 0,
    coverage: 0,
  });
  expect(exported.coverage).toBe(0);
  expect(
    Object.values(exported.score.byCategory).every(
      (category) => (category as { score: number | null }).score === null,
    ),
  ).toBe(true);
});

test("a successful score is retained on manual disconnect but cleared by a failed new inspection", async ({
  page,
}) => {
  await mockMcp(page);
  await connect(page);
  const quality = page.locator(".metric").filter({ hasText: "QUALITY SCORE" });
  await expect(quality.locator("strong")).toHaveText(/^\s*\d+\/100\s*$/);
  const verifiedScore = (await quality.locator("strong").innerText()).trim();

  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(quality.locator("strong")).toHaveText(verifiedScore);

  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByText("Connected. Each request is independent."),
  ).toBeVisible();
  await expect(quality.locator("strong")).toHaveText(/^\s*\d+\/100\s*$/);

  await page.route(endpoint, (route) => route.abort("failed"));
  await page
    .getByRole("button", { name: "Run All Safe Tests", exact: true })
    .click();
  await expect(page.locator(".cors-help")).toBeVisible();
  await expect(quality.locator("strong")).toHaveText("—");
  await expect(quality).toContainText("Not Verified");
  await expect(quality).toContainText("0% coverage");

  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.locator(".cors-help")).toBeVisible();
  await expect(quality.locator("strong")).toHaveText("—");
  await expect(quality).toContainText("0% coverage");
});

test("mobile workspace remains inside the viewport", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "MCP server endpoint" }),
  ).toBeVisible();
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(layout.width).toBeLessThanOrEqual(layout.viewport + 1);
  await page.screenshot({
    path: testInfo.outputPath("mobile-workspace.png"),
    fullPage: true,
  });
});

test("authentication is sent only to the endpoint and excluded from local downloads and storage", async ({
  page,
}) => {
  const requests = await mockMcp(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Authentication", exact: true })
    .click();
  await page.getByLabel("Authentication mode").selectOption("bearer");
  await page
    .getByLabel("Credential", { exact: true })
    .fill("controlled-private-token");
  await page
    .getByLabel("Additional headers (JSON)")
    .fill('{"X-API-Key":"controlled-private-key"}');
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("textbox", { name: "MCP server endpoint" })
    .fill(endpoint);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByText("Connected. Each request is independent."),
  ).toBeVisible();
  expect(requests[0].headers.authorization).toBe(
    "Bearer controlled-private-token",
  );
  expect(requests[0].headers["x-api-key"]).toBe("controlled-private-key");
  await page.getByRole("tab", { name: "Headers", exact: true }).click();
  await expect(page.locator(".console-code")).toContainText("[REDACTED]");
  await expect(page.locator(".console-code")).not.toContainText(
    "controlled-private-token",
  );
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length]),
  ).toEqual([0, 0]);
  await page
    .getByRole("button", { name: "Export report", exact: true })
    .click();
  for (const format of ["JSON", "HTML", "PDF"]) {
    const downloading = page.waitForEvent("download");
    await page
      .getByRole("button", { name: `${format} report`, exact: true })
      .click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(
      `orionis-inspection.${format.toLowerCase()}`,
    );
    const path = await download.path();
    expect(path).not.toBeNull();
    const bytes = await readFile(path!);
    expect(bytes.length).toBeGreaterThan(100);
    if (format === "PDF") expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    else {
      expect(bytes.toString()).not.toContain("controlled-private-token");
      expect(bytes.toString()).not.toContain("controlled-private-key");
      if (format === "JSON")
        expect(JSON.parse(bytes.toString()).history.length).toBeGreaterThan(0);
    }
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page
    .getByRole("button", { name: "Authentication", exact: true })
    .click();
  await expect(page.getByLabel("Credential", { exact: true })).toHaveValue("");
});

for (const phase of ["before discovery", "after discovery"] as const) {
  test(`a running safe suite can be cancelled ${phase} without invoking tools`, async ({
    page,
  }) => {
    const discoveryCompleted = phase === "after discovery";
    const heldMethod = discoveryCompleted ? "tools/list" : "server/discover";
    let armed = false;
    let requestHeld = false;
    let releaseRequest: (() => void) | undefined;
    const heldResponse = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    const requests = await mockMcp(page, {
      beforeRespond: async (request) => {
        if (armed && request.method === heldMethod) {
          requestHeld = true;
          await heldResponse;
        }
      },
    });
    try {
      await connect(page);
      const initialRequestCount = requests.length;
      armed = true;
      await page
        .getByRole("button", { name: "Run All Safe Tests", exact: true })
        .click();
      // The response stays pending until cancellation is observed. No timing delay
      // can move this assertion to the other side of the discovery boundary.
      await expect.poll(() => requestHeld).toBe(true);
      const progress = page.getByRole("region", { name: "Safe test progress" });
      await expect(
        progress
          .getByText("Connectivity and discovery", { exact: true })
          .locator(".."),
      ).toContainText(discoveryCompleted ? "Passed" : "Running");
      if (discoveryCompleted) {
        await expect(
          progress.getByText("Tools listing", { exact: true }).locator(".."),
        ).toContainText("Running");
      }
      await page
        .getByRole("button", { name: "Cancel tests", exact: true })
        .click();
      await expect(
        page.getByText("Safe checks cancelled; completed evidence retained."),
      ).toBeVisible();
      await expect(progress).toHaveCount(0);

      const runButton = page.getByRole("button", {
        name: "Run All Safe Tests",
        exact: true,
      });
      const status = page
        .locator(".metric")
        .filter({ hasText: "SERVER STATUS" })
        .locator("strong");
      const version = page
        .locator(".metric")
        .filter({ hasText: "MCP VERSION" })
        .locator("strong");
      if (discoveryCompleted) {
        await expect(runButton).toBeEnabled();
        await expect(status).toHaveText("Connected");
        await expect(version).toHaveText("2026-07-28");
      } else {
        await expect(runButton).toBeDisabled();
        await expect(
          page.getByRole("button", { name: "Connect", exact: true }),
        ).toBeEnabled();
        await expect(status).toHaveText("Disconnected");
        await expect(version).toHaveText("—");
        const quality = page
          .locator(".metric")
          .filter({ hasText: "QUALITY SCORE" });
        await expect(quality.locator("strong")).toHaveText("—");
        await expect(quality).toContainText("Not Verified");
        await expect(quality).toContainText("0% coverage");
      }
      await page.getByRole("tab", { name: "Logs", exact: true }).click();
      await expect(page.locator(".console-code")).toContainText("cancelled");
      expect(
        requests.slice(initialRequestCount).map((request) => request.method),
      ).toEqual(
        discoveryCompleted
          ? ["server/discover", "tools/list"]
          : ["server/discover"],
      );
      expect(requests.some((request) => request.method === "tools/call")).toBe(
        false,
      );
    } finally {
      releaseRequest?.();
    }
  });
}

test("Monaco does not fetch external schemas embedded in tool arguments", async ({
  page,
}) => {
  const requests = await mockMcp(page);
  const remoteSchemaRequests: string[] = [];
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  await page.route("https://schema.example.test/**", async (route) => {
    remoteSchemaRequests.push(route.request().url());
    // Interception ensures even a regression never reaches an external service.
    await route.fulfill({
      contentType: "application/json",
      body: '{"type":"object"}',
    });
  });
  await connect(page);
  await page
    .getByRole("button", { name: "greet_customer", exact: true })
    .click();
  await expect(
    page.frameLocator(".json-editor iframe").locator(".monaco-editor"),
  ).toBeVisible();
  await page
    .frameLocator(".json-editor iframe")
    .locator(".monaco-editor")
    .click({ position: { x: 120, y: 35 } });
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(
    '{"$schema":"https://schema.example.test/private.json","name":"Ada"}',
  );
  await expect.poll(() => workers.length).toBeGreaterThan(0);
  // Observe Monaco's debounced validation window after its local JSON worker starts.
  await page.waitForTimeout(1500);
  expect(remoteSchemaRequests).toEqual([]);
  expect(
    workers.every(
      (url) =>
        new URL(url).origin === "http://127.0.0.1:4173" ||
        url.startsWith("blob:"),
    ),
  ).toBe(true);
  expect(requests.some((request) => request.method === "tools/call")).toBe(
    false,
  );
});

test("authentication probes require explicit opt-in and can be cancelled", async ({
  page,
}) => {
  let releaseProbe: (() => void) | undefined;
  let probeStarted = false;
  const heldProbe = new Promise<void>((resolve) => {
    releaseProbe = resolve;
  });
  const requests = await mockMcp(page, {
    beforeRespond: async (request) => {
      if (
        request.headers.authorization ===
        "Bearer orionis-inspector-invalid-credential"
      ) {
        probeStarted = true;
        await heldProbe;
      }
    },
  });
  try {
    await connect(page);
    const initialRecordCount = await page
      .locator(".request-console .count")
      .textContent();
    await page
      .getByRole("button", { name: "Authentication", exact: true })
      .click();
    await page
      .getByText("Optional authentication probes", { exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Probe anonymous", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Probe invalid token", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("checkbox", {
        name: "I authorize authentication probes against this endpoint.",
      })
      .check();
    await page
      .getByRole("button", { name: "Probe invalid token", exact: true })
      .click();
    // The mock cannot finish until cancellation has been observed, regardless of UI timing.
    await expect.poll(() => probeStarted).toBe(true);
    await page
      .getByRole("button", { name: "Cancel probe", exact: true })
      .click();
    await expect(
      page.getByText("Authentication probe cancelled.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Probe invalid token", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(page.locator(".request-console .count")).toHaveText(
      String(Number(initialRecordCount) + 1),
    );
    await page.getByRole("tab", { name: "Logs", exact: true }).click();
    await expect(page.locator(".console-code")).toContainText("cancelled");
    await page.getByRole("button", { name: "Security", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        name: "invalid-token discovery authentication probe",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(requests.some((request) => request.method === "tools/call")).toBe(
      false,
    );
  } finally {
    releaseProbe?.();
  }
});
