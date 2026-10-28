import { useI18n } from "@/i18n/react";
import { useState } from "react";
import { Copy, Download, Terminal, ChevronDown } from "lucide-react";
import { useInspector } from "@/stores/inspector";
import { Button } from "@/components/ui/button";
import {
  requestAsCurl,
  requestAsFetch,
  requestAsJson,
  downloadBlob,
} from "@/core/reporting";
export function RequestConsole({ onCollapse }: { onCollapse: () => void }) {
  const { t } = useI18n();
  const { snapshot, activeRecord, setActiveRecord } = useInspector();
  const [tab, setTab] = useState("Request");
  const [notice, setNotice] = useState<{
    message: string;
    values?: Record<string, string>;
  }>({ message: "" });
  const r =
    snapshot.records.find((r) => r.id === activeRecord) ??
    snapshot.records.at(-1);
  const data = !r
    ? null
    : tab === "Request"
      ? { url: r.endpoint, method: "POST", payload: r.request }
      : tab === "Response"
        ? (r.response ?? r.error)
        : tab === "Headers"
          ? {
              configured: r.configuredHeaders,
              accessibleByCors: r.accessibleHeaders,
              note: t(
                "The browser controls preflight, Origin and transport headers. Unexposed response headers are unavailable.",
              ),
            }
          : tab === "JSON-RPC"
            ? { request: r.request, response: r.response }
            : tab === "Timeline"
              ? {
                  started: r.startedAt,
                  durationMs: r.durationMs,
                  approximateBytes: r.bytes,
                  httpStatus: r.httpStatus,
                  events: r.events,
                }
              : (r.error ?? {
                  message: t(r.cached ? "Cache hit" : "Response recorded"),
                  events: r.events,
                });
  const copy = async (type: string) => {
    if (!r) return;
    try {
      await navigator.clipboard.writeText(
        type === "cURL"
          ? requestAsCurl(r)
          : type === "Fetch"
            ? requestAsFetch(r)
            : requestAsJson(r),
      );
      setNotice({ message: "{type} copied (redacted)", values: { type } });
    } catch {
      setNotice({
        message: "Clipboard unavailable. Download the request instead.",
      });
    }
  };
  return (
    <section className="request-console">
      <div className="console-toolbar">
        <div className="console-title">
          <Terminal size={15} />
          <b>{t("Request Inspector")}</b>
          <span className="count">{snapshot.records.length}</span>
        </div>
        <select
          aria-label={t("Select request")}
          value={r?.id ?? ""}
          onChange={(e) => setActiveRecord(e.target.value)}
        >
          <option value="" disabled>
            {t("Choose a request")}
          </option>
          {snapshot.records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.method} · {Math.round(r.durationMs)} ms{" "}
              {r.error ? "· " + t(r.error.kind) : ""}
            </option>
          ))}
        </select>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("Collapse console")}
          onClick={onCollapse}
        >
          <ChevronDown size={16} />
        </Button>
      </div>
      <div className="console-tabs" role="tablist">
        {["Request", "Response", "Headers", "JSON-RPC", "Timeline", "Logs"].map(
          (tabName) => (
            <button
              key={tabName}
              role="tab"
              aria-selected={tabName === tab}
              onClick={() => setTab(tabName)}
            >
              {t(tabName)}
            </button>
          ),
        )}
        <div className="console-actions">
          {["JSON", "cURL", "Fetch"].map((type) => (
            <Button
              key={type}
              size="sm"
              variant="ghost"
              disabled={!r}
              onClick={() => void copy(type)}
            >
              <Copy size={12} />
              {type}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            aria-label={t("Download request")}
            disabled={!r}
            onClick={() =>
              r &&
              downloadBlob(
                new Blob([requestAsJson(r)], { type: "application/json" }),
                "mcp-request.json",
              )
            }
          >
            <Download size={13} />
          </Button>
        </div>
      </div>
      {notice.message && (
        <small role="status">{t(notice.message, notice.values)}</small>
      )}
      <pre className="console-code">
        {data
          ? JSON.stringify(data, null, 2)
          : t(
              "// Your requests, responses and events will appear here.\n// Connect an MCP endpoint to begin.",
            )}
      </pre>
    </section>
  );
}
