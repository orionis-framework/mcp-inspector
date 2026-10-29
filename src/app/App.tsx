import { useEffect, useState, useRef } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  ArrowUpRight,
  Languages,
  Cable,
  Download,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  Moon,
  PanelLeft,
  PanelRight,
  Play,
  Shield,
  Square,
  Sun,
  Terminal,
  Unplug,
  X,
} from "lucide-react";
import { useInspector } from "@/stores/inspector";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Explorer } from "@/components/explorer/Explorer";
import { Inspector } from "@/components/inspector/Inspector";
import { Diagnostics } from "@/components/diagnostics/Diagnostics";
import { TestProgress } from "@/components/diagnostics/TestProgress";
import { RequestConsole } from "@/components/console/RequestConsole";
import { CorsHelp } from "@/components/connection/CorsHelp";
import { OrionisSetup } from "@/components/connection/OrionisSetup";
import { calculateScore, metrics } from "@/core/validation";
import { runAuthenticationProbe } from "@/core/testing/runner";
import {
  exportReportJson,
  exportReportHtml,
  exportReportPdf,
  downloadBlob,
  hermesConfig,
  type ReportSnapshot,
} from "@/core/reporting";
import { useI18n } from "@/i18n/react";
import { translateGenerated, type Locale } from "@/i18n";
import { updatePageMetadata, localeFromPath } from "@/seo/browser";
import { APP_VERSION } from "@/version";
export default function App() {
  const { t, locale, setLocale } = useI18n();
  useEffect(() => {
    updatePageMetadata(locale);
  }, [locale]);
  useEffect(() => {
    const syncLocation = () =>
      setLocale(localeFromPath(window.location.pathname));
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, [setLocale]);
  const s = useInspector();
  const [auth, setAuth] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [mode, setMode] = useState("none");
  const [token, setToken] = useState("");
  const [header, setHeader] = useState("X-API-Key");
  const [custom, setCustom] = useState("{}");
  const [timeout, setTimeoutMs] = useState(15000);
  const [approved, setApproved] = useState(false);
  const [probeBusy, setProbeBusy] = useState(false);
  const probeController = useRef<AbortController | null>(null);
  useEffect(() => () => probeController.current?.abort(), []);
  const [notice, setNotice] = useState("");
  const [explorer, setExplorer] = useState(true);
  const [diagnostics, setDiagnostics] = useState(true);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [mobile, setMobile] = useState(() => window.innerWidth < 1050);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", s.dark);
  }, [s.dark]);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 1050);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  const score = calculateScore(s.tests, s.snapshot);
  const metric = metrics(s.snapshot.records);
  const connect = async () => {
    setNotice("");
    try {
      const extra = JSON.parse(custom) as Record<string, unknown>;
      if (
        !extra ||
        typeof extra !== "object" ||
        Array.isArray(extra) ||
        Object.values(extra).some((v) => typeof v !== "string")
      )
        throw new Error(
          "Custom headers must be a JSON object of string values.",
        );
      const headers = { ...extra } as Record<string, string>;
      if (mode === "bearer" && token) headers.Authorization = "Bearer " + token;
      if (mode === "key" && token) headers[header] = token;
      await s.connect(headers, timeout);
    } catch (e) {
      setNotice(String(e));
    }
  };
  const disconnect = () => {
    probeController.current?.abort();
    s.disconnect();
    setToken("");
    setCustom("{}");
    setApproved(false);
  };
  const data = (): ReportSnapshot => ({
    endpoint:
      s.snapshot.records[0]?.endpoint ?? s.client?.endpoint ?? s.endpoint,
    protocolVersion: s.snapshot.discovery?.supportedVersions.join(", "),
    discovery: s.snapshot.discovery,
    serverInfo:
      s.snapshot.discovery?._meta?.["io.modelcontextprotocol/serverInfo"],
    capabilities: s.snapshot.discovery?.capabilities,
    tools: s.snapshot.tools,
    resources: s.snapshot.resources,
    resourceTemplates: s.snapshot.templates,
    prompts: s.snapshot.prompts,
    tests: s.tests,
    score,
    coverage: score.coverage,
    diagnostics: s.tests.filter((t) => t.status !== "Passed"),
    metrics: metric,
    history: s.snapshot.records,
  });
  const exportReport = async (format: string) => {
    try {
      const snapshot = data();
      const secrets = [
        token,
        ...Object.values(JSON.parse(custom) as Record<string, string>),
      ].filter(Boolean);
      const blob =
        format === "pdf"
          ? await exportReportPdf(snapshot, secrets, locale)
          : new Blob(
              [
                format === "json"
                  ? exportReportJson(snapshot, secrets, locale)
                  : exportReportHtml(snapshot, secrets, locale),
              ],
              { type: format === "json" ? "application/json" : "text/html" },
            );
      downloadBlob(blob, "orionis-inspection." + format);
      setNotice("Report generated locally. Sensitive values were redacted.");
    } catch (e) {
      setNotice(String(e));
    }
  };
  const probe = async (probeMode: "anonymous" | "invalid-token") => {
    const client = s.client;
    if (!client) return;
    const controller = new AbortController();
    probeController.current = controller;
    setProbeBusy(true);
    try {
      const result = await runAuthenticationProbe(
        s.client?.endpoint ?? s.endpoint,
        {
          authorized: approved,
          signal: controller.signal,
          mode: probeMode,
          headerName: mode === "key" ? header : "Authorization",
        },
      );
      if (useInspector.getState().client !== client) return;
      result.records.forEach(s.record);
      if (controller.signal.aborted) {
        setNotice("Authentication probe cancelled.");
        return;
      }

      useInspector.setState((state) => ({
        tests: [
          ...state.tests.filter((t) => t.id !== result.test.id),
          result.test,
        ],
      }));
      setNotice(result.test.status + ": " + result.test.evidence);
    } catch (e) {
      setNotice(String(e));
    } finally {
      setProbeBusy(false);
      probeController.current = null;
    }
  };
  const editor = (
    <>
      <TestProgress />
      <OrionisSetup />
      <CorsHelp />
      <Inspector />
    </>
  );
  const workspace = mobile ? (
    <div className="mobile-workspace">
      {explorer && <Explorer />}
      <main className="inspector-main">{editor}</main>
      {diagnostics && <Diagnostics />}
    </div>
  ) : (
    <Group orientation="horizontal" className="workbench">
      {explorer && (
        <>
          <Panel defaultSize="19%" minSize="14%" maxSize="30%">
            <Explorer />
          </Panel>
          <Separator className="resize-handle" />
        </>
      )}
      <Panel minSize="34%">
        <main className="inspector-main">{editor}</main>
      </Panel>
      {diagnostics && (
        <>
          <Separator className="resize-handle" />
          <Panel defaultSize="24%" minSize="17%" maxSize="35%">
            <Diagnostics />
          </Panel>
        </>
      )}
    </Group>
  );
  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#" aria-label="Orionis MCP Inspector">
          <img
            className="brand-logo"
            src="/favicon.svg"
            alt=""
            width={43}
            height={43}
          />
          <span className="brand-wordmark">
            <strong>ORIONIS</strong>
            <small>FRAMEWORK</small>
          </span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-product">
            <strong>MCP Inspector</strong>
            <small>{t("Inspect, Test & Validate Your MCP Servers")}</small>
          </span>
        </a>
        <div className="header-actions">
          <label className="language-switch">
            <Languages size={15} aria-hidden="true" />
            <select
              aria-label={t("Language")}
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </label>
          <span className="local-label">
            <Shield size={13} />
            {t("LOCAL & PRIVATE")}
          </span>
          <a
            className="docs-link"
            href="https://docs.orionis-framework.com/en/mcp/"
            target="_blank"
            rel="noreferrer"
          >
            {t("Docs")}
            <ArrowUpRight size={13} />
          </a>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t(
              s.dark ? "Switch to light theme" : "Switch to dark theme",
            )}
            onClick={s.toggleTheme}
          >
            {s.dark ? <Sun size={17} /> : <Moon size={17} />}
          </Button>
        </div>
      </header>
      <div className="connection-bar">
        <form
          className="endpoint-form"
          onSubmit={(e) => {
            e.preventDefault();
            void connect();
          }}
        >
          <div className="endpoint-input">
            <Cable size={17} />
            <span>POST</span>
            <input
              id="endpoint"
              aria-label={t("MCP server endpoint")}
              placeholder="https://your-server.com/mcp"
              value={s.endpoint}
              disabled={s.connected || s.busy}
              onChange={(e) => s.setEndpoint(e.target.value)}
              required
              type="url"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button type="submit" disabled={!s.endpoint || s.connected || s.busy}>
            {s.busy ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Cable size={15} />
            )}
            {t("Connect")}
          </Button>
        </form>
        <Button
          variant="secondary"
          size="icon"
          title={t("Disconnect")}
          aria-label={t("Disconnect")}
          disabled={!s.client}
          onClick={disconnect}
        >
          <Unplug size={16} />
        </Button>
        <Button
          variant="secondary"
          onClick={() => setAuth(true)}
          aria-label={t("Authentication")}
        >
          <KeyRound size={15} />
          <span>{t("Auth")}</span>
          {mode !== "none" && <i className="status-dot" />}
        </Button>
        <div className="toolbar-spacer" />
        {s.busy ? (
          <Button variant="secondary" onClick={s.cancel}>
            <Square size={13} />
            {t("Cancel tests")}
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => void s.run()}
            disabled={!s.connected}
          >
            <Play size={14} />
            {t("Run All Safe Tests")}
          </Button>
        )}
        <Button
          variant="ghost"
          aria-label={t("Export report")}
          onClick={() => setReportOpen(true)}
        >
          <Download size={16} />
          <span>{t("Export")}</span>
        </Button>
      </div>
      <div className="metrics-bar">
        {[
          ["MCP VERSION", s.snapshot.discovery?.supportedVersions[0] ?? "—"],
          [
            "SERVER STATUS",
            s.connected ? "Connected" : s.busy ? "Connecting" : "Disconnected",
          ],
          ["TOOLS", s.snapshot.discovery ? s.snapshot.tools.length : "—"],
          [
            "RESOURCES",
            s.snapshot.discovery ? s.snapshot.resources.length : "—",
          ],
          ["PROMPTS", s.snapshot.discovery ? s.snapshot.prompts.length : "—"],
          ["QUALITY SCORE", score.score === null ? "—" : score.score + "/100"],
          [
            "AVG. LATENCY",
            metric.average === null ? "—" : Math.round(metric.average) + " ms",
          ],
        ].map(([label, value]) => (
          <div
            className="metric"
            key={label}
            title={
              label === "QUALITY SCORE"
                ? t(
                    score.reason ??
                      "Based on evaluated server checks; see coverage.",
                  )
                : undefined
            }
          >
            <span>{t(String(label))}</span>
            <strong
              className={
                label === "SERVER STATUS" && s.connected ? "accent" : ""
              }
            >
              {label === "SERVER STATUS" && (
                <i
                  className={"status-dot " + (s.connected ? "green" : "gray")}
                />
              )}{" "}
              {label === "SERVER STATUS" ? t(String(value)) : value}
            </strong>
            {label === "QUALITY SCORE" && (
              <small>
                {t(score.classification)} ·{" "}
                {t("{coverage}% coverage", { coverage: score.coverage })}
              </small>
            )}
          </div>
        ))}
      </div>
      <div className="workspace-toolbar">
        <div>
          <span className="status-dot" />
          <b>{t("Workspace")}</b>
          <span className="muted">/</span>
          <span className="tiny muted">{t("HTTP · Stateless")}</span>
        </div>
        <div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Toggle explorer")}
            aria-pressed={explorer}
            onClick={() => setExplorer(!explorer)}
          >
            <PanelLeft size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Toggle diagnostics")}
            aria-pressed={diagnostics}
            onClick={() => setDiagnostics(!diagnostics)}
          >
            <PanelRight size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Toggle request inspector")}
            aria-pressed={consoleOpen}
            onClick={() => setConsoleOpen(!consoleOpen)}
          >
            <Terminal size={15} />
          </Button>
        </div>
      </div>
      <div className={"workspace " + (mobile ? "mobile" : "")}>
        {mobile ? (
          <>
            {workspace}
            {consoleOpen && (
              <RequestConsole onCollapse={() => setConsoleOpen(false)} />
            )}
          </>
        ) : (
          <Group orientation="vertical">
            <Panel minSize="35%">{workspace}</Panel>
            {consoleOpen && (
              <>
                <Separator className="resize-handle horizontal" />
                <Panel defaultSize="26%" minSize="15%" maxSize="60%">
                  <RequestConsole onCollapse={() => setConsoleOpen(false)} />
                </Panel>
              </>
            )}
          </Group>
        )}
      </div>
      <footer className="statusbar">
        <span role="status">
          {translateGenerated(
            notice ||
              s.message ||
              "Ready to inspect. Connect an endpoint to begin.",
            locale,
          )}
        </span>
        <span>
          {t(s.tests.length > 0 ? score.readiness : "No evidence collected")}
          <i /> v{APP_VERSION}
        </span>
      </footer>
      <Dialog
        open={auth}
        onOpenChange={setAuth}
        title={t("Connection & authentication")}
        description={t(
          "Credentials are held only in this tab’s memory and cleared when you disconnect. No cookies are sent.",
        )}
      >
        <fieldset disabled={s.connected || s.busy}>
          <label className="field">
            <span>{t("Authentication mode")}</span>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="none">{t("No authentication")}</option>
              <option value="bearer">{t("Bearer token")}</option>
              <option value="key">{t("API key header")}</option>
            </select>
          </label>
          {mode === "key" && (
            <label className="field">
              <span>{t("Header name")}</span>
              <input
                value={header}
                onChange={(e) => setHeader(e.target.value)}
              />
            </label>
          )}
          {mode !== "none" && (
            <label className="field">
              <span>{t("Credential")}</span>
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
          )}
          <label className="field">
            <span>{t("Additional headers (JSON)")}</span>
            <textarea
              value={custom}
              rows={3}
              onChange={(e) => setCustom(e.target.value)}
              spellCheck={false}
            />
            <small>
              {t(
                "Protocol and browser-controlled headers cannot be overridden.",
              )}
            </small>
          </label>
          <label className="field">
            <span>{t("Request timeout (ms)")}</span>
            <input
              type="number"
              min={1000}
              max={120000}
              value={timeout}
              onChange={(e) =>
                setTimeoutMs(
                  Math.min(120000, Math.max(1000, Number(e.target.value))),
                )
              }
            />
          </label>
        </fieldset>
        {s.connected && (
          <p className="muted">
            {t("Disconnect to change credentials or headers.")}
          </p>
        )}
        <details className="auth-probes">
          <summary>{t("Optional authentication probes")}</summary>
          {probeBusy && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => probeController.current?.abort()}
            >
              {t("Cancel probe")}
            </Button>
          )}
          <p>
            {t(
              "Send discovery without credentials or with an invalid credential. Public discovery can be intentional; this does not test tool authorization.",
            )}
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />{" "}
            {t("I authorize authentication probes against this endpoint.")}
          </label>
          <div className="dialog-actions">
            <Button
              size="sm"
              variant="secondary"
              disabled={!approved || !s.connected || probeBusy}
              onClick={() => void probe("anonymous")}
            >
              {t("Probe anonymous")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!approved || !s.connected || probeBusy}
              onClick={() => void probe("invalid-token")}
            >
              {t("Probe invalid token")}
            </Button>
          </div>
        </details>
        <div className="dialog-actions">
          <Button onClick={() => setAuth(false)}>{t("Done")}</Button>
        </div>
      </Dialog>
      <Dialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        title={t("Export inspection")}
        description={t(
          "Reports are generated locally and contain redacted evidence from this tab. Review business data before sharing.",
        )}
      >
        <div className="export-options">
          {["json", "html", "pdf"].map((format) => (
            <Button
              key={format}
              variant="secondary"
              disabled={!s.snapshot.records.length}
              onClick={() => void exportReport(format)}
            >
              <Download size={16} />
              {t("{format} report", { format: format.toUpperCase() })}
            </Button>
          ))}
        </div>
        <div className="hermes-config">
          <h3>Hermes Agent</h3>
          <p className="muted">
            {t(
              "Native YAML configuration for a stateless-compatible release. No credentials included.",
            )}
          </p>
          {s.endpoint && (
            <pre className="data-block">
              {(() => {
                try {
                  return hermesConfig(s.endpoint);
                } catch {
                  return t("Enter a valid HTTP(S) endpoint.");
                }
              })()}
            </pre>
          )}
          <Button
            variant="secondary"
            disabled={!s.endpoint}
            onClick={() => {
              try {
                downloadBlob(
                  new Blob([hermesConfig(s.endpoint)], { type: "text/yaml" }),
                  "hermes-mcp.yaml",
                );
              } catch (e) {
                setNotice(String(e));
              }
            }}
          >
            {t("Download Hermes config")}
          </Button>
          <a
            href="https://docs.orionis-framework.com/en/mcp/http-and-clients/"
            target="_blank"
            rel="noreferrer"
            className="text-link"
          >
            {t("Configuration reference")}
            <ExternalLink size={13} />
          </a>
        </div>
      </Dialog>
      {notice && (
        <button
          className="dismiss-notice"
          aria-label={t("Dismiss notice")}
          onClick={() => setNotice("")}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}
