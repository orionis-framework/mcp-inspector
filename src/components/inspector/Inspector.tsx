import { lazy, Suspense, useState, useEffect } from "react";
import { Braces, Play, Download, Square, TriangleAlert } from "lucide-react";
import { useInspector } from "@/stores/inspector";
import { useI18n } from "@/i18n/react";
import { translateGenerated } from "@/i18n";
import { McpError } from "@/core/mcp/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Overview } from "./Overview";
import { SchemaForm } from "./SchemaForm";
import { Finding } from "@/components/diagnostics/Diagnostics";
import {
  inspectSchema,
  validateJsonSchema,
  validateToolResult,
  validateResourceResult,
  validatePromptResult,
} from "@/core/validation";
import type { TestResult } from "@/core/validation/types";
import type {
  JsonObject,
  CompletionReference,
  SubscriptionFilter,
} from "@/types/mcp";
import { downloadBlob } from "@/core/reporting";
import { redact, redactUrl } from "@/utils/redact";
const JsonEditor = lazy(() => import("./JsonEditor"));
const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const safeJson = (text: string) => {
  try {
    return pretty(redact(JSON.parse(text)));
  } catch {
    return undefined;
  }
};
export function Inspector() {
  const { selection } = useInspector();
  if (selection.kind === "overview") return <Overview />;
  return <Detail key={selection.kind + selection.name} />;
}
function Detail() {
  const { t, locale } = useI18n();
  const {
    selection,
    snapshot,
    client,
    dark,
    tests,
    connected,
    endpoint,
    activeRecord,
    setActiveRecord,
  } = useInspector();
  const [json, setJson] = useState("{}");
  const [tab, setTab] = useState("JSON");
  const [result, setResult] = useState<unknown>();
  const [error, setError] = useState("");
  const [errorIsServer, setErrorIsServer] = useState(false);
  const captureError = (value: unknown) => {
    setErrorIsServer(value instanceof McpError && value.code !== undefined);
    setError(
      value instanceof SyntaxError
        ? "Invalid JSON: " + value.message
        : value instanceof Error
          ? value.message
          : String(value),
    );
  };
  const [executing, setExecuting] = useState(false);
  const [controller, setController] = useState<AbortController>();
  const [confirm, setConfirm] = useState(false);
  const [checks, setChecks] = useState<TestResult[]>([]);
  const [resourceUri, setResourceUri] = useState(selection.name ?? "");
  const [completionType, setCompletionType] = useState("prompt");
  const [refName, setRefName] = useState("");
  const [argument, setArgument] = useState("");
  const [value, setValue] = useState("");
  const [streamEvents, setStreamEvents] = useState<unknown[]>([]);
  const tool = snapshot.tools.find((t) => t.name === selection.name);
  const resource = snapshot.resources.find((r) => r.uri === selection.name);
  const template = snapshot.templates.find(
    (r) => r.uriTemplate === selection.name,
  );
  const prompt = snapshot.prompts.find((p) => p.name === selection.name);
  useEffect(() => () => controller?.abort(), [controller]);
  const saveTests = (additional: TestResult[]) => {
    setChecks(additional);
    useInspector.setState((s) => ({
      tests: [
        ...s.tests.filter((t) => !additional.some((a) => a.id === t.id)),
        ...additional,
      ],
    }));
  };
  const execute = async () => {
    if (!client) return;
    setConfirm(false);
    setError("");
    setErrorIsServer(false);
    setResult(undefined);
    setChecks([]);
    // A new execution invalidates prior result verdicts for this component.
    const component = selection.kind + ":" + selection.name;
    useInspector.setState((state) => ({
      tests: state.tests.filter(
        (test) =>
          !(
            test.component === component &&
            /^(MCP-RESULT:|MCP-OUTPUT:|MCP-RESOURCE-RESULT:|MCP-PROMPT-RESULT:)/.test(
              test.id,
            )
          ),
      ),
    }));
    const abort = new AbortController();
    setController(abort);
    setExecuting(true);
    try {
      let data;
      const opts = { signal: abort.signal };
      if (selection.kind === "tool" && tool) {
        const args = JSON.parse(json) as JsonObject;
        const validation = validateJsonSchema(tool.inputSchema, args);
        if (!validation.valid) throw new Error(validation.errors.join("\n"));
        data = await client.callTool(tool.name, args, {
          ...opts,
          validateResult: (raw) =>
            saveTests(validateToolResult(tool.name, raw, tool.outputSchema)),
        });
        if (data.resultType === "input_required") {
          saveTests(validateToolResult(tool.name, data, tool.outputSchema));
        }
      } else if (
        selection.kind === "resource" ||
        selection.kind === "template"
      ) {
        data = await client.readResource(resourceUri, opts);
        saveTests(validateResourceResult(resourceUri, data));
      } else if (selection.kind === "prompt" && prompt) {
        const args = JSON.parse(json) as Record<string, string>;
        if (
          !args ||
          Array.isArray(args) ||
          typeof args !== "object" ||
          Object.values(args).some((v) => typeof v !== "string")
        )
          throw new Error(
            "Prompt arguments must be an object of string values.",
          );
        for (const a of prompt.arguments ?? [])
          if (a.required && !args[a.name])
            throw new Error("Required argument: " + a.name);
        data = await client.getPrompt(prompt.name, args, opts);
        saveTests(validatePromptResult(prompt.name, data));
      } else if (selection.kind === "completions") {
        const ref: CompletionReference =
          completionType === "prompt"
            ? { type: "ref/prompt", name: refName }
            : { type: "ref/resource", uri: refName };
        data = await client.complete(
          ref,
          { name: argument, value },
          undefined,
          opts,
        );
      } else if (selection.kind === "subscriptions") {
        setStreamEvents([]);
        data = await client.listen(JSON.parse(json) as SubscriptionFilter, {
          ...opts,
          timeoutMs: 60000,
          onEvent: (event) =>
            setStreamEvents((prev) => [...prev.slice(-99), event]),
        });
      }
      setResult(redact(data));
    } catch (e) {
      captureError(e);
    } finally {
      setExecuting(false);
      setController(undefined);
    }
  };
  const prepare = () => {
    if (selection.kind === "tool") {
      try {
        const validation = validateJsonSchema(
          tool?.inputSchema,
          JSON.parse(json),
        );
        if (!validation.valid) {
          setError(validation.errors.join("\n"));
          setErrorIsServer(false);
          return;
        }
        setError("");
        setErrorIsServer(false);
        setConfirm(true);
      } catch (e) {
        captureError(e);
      }
    } else void execute();
  };
  if (selection.kind === "diagnostics") {
    const categories: Record<string, string> = {
      Protocol: "protocol",
      Schemas: "tools",
      Security: "security",
      Performance: "performance",
      "AI Readiness": "ai",
    };
    const filtered = tests.filter(
      (t) => t.category === categories[selection.name ?? "Protocol"],
    );
    return (
      <div className="detail">
        <div className="breadcrumb">
          {t("Diagnostics")} / {t(selection.name ?? "Protocol")}
        </div>
        <h1>{t(selection.name ?? "Protocol")}</h1>
        <p className="muted">
          {t(
            "Every status carries evidence. “Not Tested” and “Blocked” are never counted as successful.",
          )}
        </p>
        {filtered.length ? (
          filtered.map((t) => <Finding key={t.id} test={t} />)
        ) : (
          <div className="empty-small">
            {t("Connect a server, then run safe tests to gather evidence.")}
          </div>
        )}
      </div>
    );
  }
  if (selection.kind === "history")
    return (
      <div className="detail">
        <div className="breadcrumb">{t("Workspace / History")}</div>
        <h1>{t("Execution history")}</h1>
        <p className="muted">
          {t("Last 250 requests, held in memory for this tab.")}
        </p>
        {snapshot.records.length === 0 ? (
          <p>{t("No requests yet.")}</p>
        ) : (
          [...snapshot.records].reverse().map((r) => (
            <button
              key={r.id}
              className={
                "history-row " + (r.id === activeRecord ? "selected" : "")
              }
              onClick={() => setActiveRecord(r.id)}
            >
              <code>{r.method}</code>
              <span>
                {r.error ? t(r.error.kind) : (r.httpStatus ?? t("pending"))}
              </span>
              <span>{Math.round(r.durationMs)} ms</span>
              <time>{new Date(r.startedAt).toLocaleTimeString(locale)}</time>
            </button>
          ))
        )}
      </div>
    );
  if (selection.kind === "capabilities")
    return (
      <div className="detail">
        <div className="breadcrumb">{t("Server / Capabilities")}</div>
        <h1>{t("Declared capabilities")}</h1>
        <p className="muted">
          {t(
            "Optional capabilities are available only when advertised. Extensions are displayed without implicitly enabling them.",
          )}
        </p>
        <pre className="data-block">
          {snapshot.discovery
            ? pretty(snapshot.discovery)
            : t("Not discovered")}
        </pre>
      </div>
    );
  const title =
    tool?.title ??
    tool?.name ??
    resource?.name ??
    template?.name ??
    prompt?.name ??
    (selection.kind === "completions"
      ? t("Argument completions")
      : t("Subscriptions"));
  const capability =
    selection.kind === "completions"
      ? snapshot.discovery?.capabilities.completions
      : selection.kind === "subscriptions"
        ? snapshot.discovery?.capabilities
        : true;
  const subscriptionAvailable = !!(
    snapshot.discovery?.capabilities.tools?.listChanged ||
    snapshot.discovery?.capabilities.prompts?.listChanged ||
    snapshot.discovery?.capabilities.resources?.listChanged ||
    snapshot.discovery?.capabilities.resources?.subscribe
  );
  return (
    <div className="detail">
      <div className="breadcrumb">
        <Braces size={14} />
        {t(selection.kind)} / {selection.name ?? t("Inspector")}
      </div>
      <div className="section-heading">
        <h1>{String(title)}</h1>
        <span className="badge">{t(selection.kind)}</span>
      </div>
      <p className="description">
        {String(
          tool?.description ??
            resource?.description ??
            template?.description ??
            prompt?.description ??
            t("Explore this optional server capability."),
        )}
      </p>
      {tool && (
        <>
          <div className="annotation-row">
            <span className="badge">
              {tool.annotations?.readOnlyHint
                ? t("Read-only hint")
                : t("May change data")}
            </span>
            {tool.annotations?.destructiveHint && (
              <span className="badge warn">{t("Destructive hint")}</span>
            )}
            <span className="muted tiny">
              {t("Annotations are untrusted server hints.")}
            </span>
          </div>
          <div className="tabs">
            <button
              onClick={() => setTab("JSON")}
              className={tab === "JSON" ? "active" : ""}
            >
              {t("Arguments · JSON")}
            </button>
            <button
              disabled={!inspectSchema(tool.inputSchema).valid}
              onClick={() => setTab("Form")}
              className={tab === "Form" ? "active" : ""}
            >
              {t("Form")}
            </button>
            <button
              onClick={() => setTab("Schema")}
              className={tab === "Schema" ? "active" : ""}
            >
              {t("Schemas & annotations")}
            </button>
          </div>
          {tab === "Form" ? (
            <SchemaForm
              schema={tool.inputSchema}
              onApply={(value) => {
                setJson(pretty(value));
                setTab("JSON");
              }}
            />
          ) : tab === "Schema" ? (
            <pre className="data-block">
              {pretty({
                inputSchema: tool.inputSchema,
                outputSchema: tool.outputSchema,
                annotations: tool.annotations,
              })}
            </pre>
          ) : (
            <Suspense fallback={<p>{t("Loading local editor…")}</p>}>
              <JsonEditor value={json} onChange={setJson} dark={dark} />
            </Suspense>
          )}
        </>
      )}
      {prompt && (
        <>
          <pre className="data-block">{pretty(prompt.arguments ?? [])}</pre>
          <label className="field">
            <span>{t("Arguments (JSON object of string values)")}</span>
            <textarea
              aria-label={t("Prompt arguments")}
              rows={6}
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
          </label>
        </>
      )}
      {(resource || template) && (
        <>
          <label className="field">
            <span>
              {t("Resource URI")}{" "}
              {template && t("(expand the template before reading)")}
            </span>
            <input
              value={resourceUri}
              onChange={(e) => setResourceUri(e.target.value)}
            />
          </label>
          <p className="muted">
            {t("MIME type:")}{" "}
            {String(
              resource?.mimeType ?? template?.mimeType ?? t("Not declared"),
            )}
          </p>
        </>
      )}
      {selection.kind === "completions" && (
        <>
          <p className="muted">
            {t(
              "Requires the declared completions capability. References identify an advertised prompt or resource template.",
            )}
          </p>
          <label className="field">
            <span>{t("Reference type")}</span>
            <select
              value={completionType}
              onChange={(e) => setCompletionType(e.target.value)}
            >
              <option value="prompt">{t("Prompt name")}</option>
              <option value="resource">{t("Resource template URI")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("Reference")}</span>
            <input
              value={refName}
              onChange={(e) => setRefName(e.target.value)}
            />
          </label>
          <div className="field-grid">
            <label className="field">
              <span>{t("Argument name")}</span>
              <input
                value={argument}
                onChange={(e) => setArgument(e.target.value)}
              />
            </label>
            <label className="field">
              <span>{t("Value to complete")}</span>
              <input value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
          </div>
        </>
      )}
      {selection.kind === "subscriptions" && (
        <>
          <p className="muted">
            {t(
              "Request-scoped SSE notifications. Select only declared filters. This manual listener closes after 60 seconds or on cancellation.",
            )}
          </p>
          <pre className="data-block">
            {pretty({
              toolsListChanged:
                snapshot.discovery?.capabilities.tools?.listChanged ?? false,
              promptsListChanged:
                snapshot.discovery?.capabilities.prompts?.listChanged ?? false,
              resourcesListChanged:
                snapshot.discovery?.capabilities.resources?.listChanged ??
                false,
              resourceSubscriptions: snapshot.discovery?.capabilities.resources
                ?.subscribe
                ? ["resource://uri"]
                : [],
            })}
          </pre>
          <label className="field">
            <span>{t("Subscription filters JSON")}</span>
            <textarea
              rows={5}
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
          </label>
          {streamEvents.length > 0 && (
            <pre className="data-block">{pretty(streamEvents)}</pre>
          )}
        </>
      )}
      <div className="execute-bar">
        <div>
          <span className="eyebrow">{t("DESTINATION")}</span>
          <code>
            {redactUrl(client?.endpoint ?? endpoint) ||
              t("No endpoint connected")}
          </code>
        </div>
        {executing ? (
          <Button variant="destructive" onClick={() => controller?.abort()}>
            <Square size={14} />
            {t("Cancel")}
          </Button>
        ) : (
          <Button
            disabled={
              !connected ||
              !capability ||
              (selection.kind === "subscriptions" && !subscriptionAvailable)
            }
            onClick={prepare}
          >
            <Play size={14} />
            {selection.kind === "tool"
              ? t("Execute tool")
              : selection.kind === "subscriptions"
                ? t("Listen")
                : t("Execute request")}
          </Button>
        )}
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {errorIsServer ? error : translateGenerated(error, locale)}
        </div>
      )}
      {checks.map((c) => (
        <Finding key={c.id} test={c} />
      ))}
      {result !== undefined && (
        <div className="result">
          <div className="section-heading">
            <h3>{t("Result")}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                downloadBlob(
                  new Blob([pretty(result)], { type: "application/json" }),
                  "mcp-result.json",
                )
              }
            >
              <Download size={13} />
              {t("Export result")}
            </Button>
          </div>
          <pre className="data-block">{pretty(result)}</pre>
        </div>
      )}
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("Execute this tool?")}
        description={t(
          "Tool calls may read or modify real data. Review the endpoint and arguments before sending.",
        )}
      >
        <div className="confirmation">
          <TriangleAlert size={22} />
          <p>
            {tool?.annotations?.readOnlyHint
              ? t(
                  "The server declares a read-only hint. This hint is not a security guarantee.",
                )
              : t(
                  "This tool may have side effects, including creating, changing or deleting data.",
                )}
          </p>
        </div>
        <code className="destination">
          {redactUrl(client?.endpoint ?? endpoint)}
        </code>
        <pre className="data-block">
          {safeJson(json) ?? t("Invalid JSON")}
        </pre>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            {t("Cancel")}
          </Button>
          <Button onClick={() => void execute()}>
            {t("Confirm execution")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
