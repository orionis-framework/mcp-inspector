import { lazy, Suspense } from "react";
import { ProductInfo } from "./ProductInfo";
import { useI18n } from "@/i18n/react";
import {
  Activity,
  ArrowRight,
  Check,
  FileJson2,
  LockKeyhole,
  Server,
  Workflow,
} from "lucide-react";
const LatencyChart = lazy(() => import("./LatencyChart"));
import { useInspector } from "@/stores/inspector";
import { calculateScore, metrics } from "@/core/validation";
import { Button } from "@/components/ui/button";
export function Overview() {
  const { t } = useI18n();
  const { snapshot, tests, connected, select } = useInspector();
  const score = calculateScore(tests, snapshot);
  const m = metrics(snapshot.records);
  const info = snapshot.discovery?._meta?.[
    "io.modelcontextprotocol/serverInfo"
  ] as Record<string, unknown> | undefined;
  const chart = snapshot.records
    .filter((r) => !r.cached && (r.response !== undefined || r.error))
    .map((r, i) => ({ n: i + 1, ms: Math.round(r.durationMs) }));
  return (
    <div className="overview">
      <div className="breadcrumb">
        <Server size={14} /> {t("Server")} <span>/</span> {t("Overview")}
      </div>
      <div className="overview-heading">
        <div>
          <div className="eyebrow">{t("YOUR MCP WORKSPACE")}</div>
          <h1>
            {connected
              ? String(info?.title ?? info?.name ?? t("Server overview"))
              : "Orionis MCP Inspector"}
          </h1>
          <p>
            {connected
              ? t(
                  "Inspect capabilities. Verify contracts. Understand every response.",
                )
              : t(
                  "Connect your MCP server and turn protocol traffic into actionable insight.",
                )}
          </p>
        </div>
        <span className={"connection-label " + (connected ? "live" : "")}>
          <span className="status-dot" />
          {t(connected ? "Connected" : "Awaiting connection")}
        </span>
      </div>
      {!connected && (
        <div className="welcome-card">
          <div className="orbit-visual">
            <div />
            <img
              className="hero-logo"
              src="/favicon.svg"
              alt=""
              width={88}
              height={88}
            />
            <span className="orbit-node one" />
            <span className="orbit-node two" />
            <span className="orbit-node three" />
          </div>
          <div>
            <span className="badge">{t("MCP 2026-07-28 · STATELESS")}</span>
            <h2>
              {t("Your server.")}
              <br />
              {t("Understood.")}
            </h2>
            <p>
              {t(
                "Explore tools, validate schemas and inspect requests in one focused workspace. Everything runs in your browser.",
              )}
            </p>
            <div className="welcome-features">
              <span>
                <Check /> {t("No backend")}
              </span>
              <span>
                <Check /> {t("No proxy")}
              </span>
              <span>
                <Check /> {t("Local reports")}
              </span>
            </div>
            <label className="start-hint" htmlFor="endpoint">
              {t("Enter your endpoint above to get started")}{" "}
              <ArrowRight size={16} />
            </label>
          </div>
        </div>
      )}
      <div className="overview-cards">
        <article className="info-card">
          <span className="card-icon">
            <Workflow size={18} />
          </span>
          <div className="eyebrow">{t("PROTOCOL")}</div>
          <h3>
            {snapshot.discovery?.supportedVersions.join(", ") ??
              t("Stateless by design")}
          </h3>
          <p>
            {t(
              "Self-contained requests with per-request version and capability metadata.",
            )}
          </p>
          <button
            className="text-link"
            onClick={() => select({ kind: "capabilities" })}
          >
            {t("Inspect capabilities")} <ArrowRight size={13} />
          </button>
        </article>
        <article className="info-card">
          <span className="card-icon">
            <LockKeyhole size={18} />
          </span>
          <div className="eyebrow">{t("PRODUCTION READINESS")}</div>
          <h3>{t(score.readiness)}</h3>
          <p>
            {score.reason
              ? t(score.reason)
              : tests.length
                ? t(
                    "{evaluated} of {applicable} applicable checks evaluated.",
                    {
                      evaluated: score.evaluated,
                      applicable: score.applicable,
                    },
                  )
                : t(
                    "Readiness is based on collected evidence. Untested checks never count as passed.",
                  )}
          </p>
          <button
            className="text-link"
            onClick={() => select({ kind: "diagnostics", name: "Security" })}
          >
            {t("Review evidence")} <ArrowRight size={13} />
          </button>
        </article>
      </div>
      <div className="info-card latency-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{t("OBSERVED PERFORMANCE")}</span>
            <h3>
              <Activity size={17} /> {t("Request latency")}
            </h3>
          </div>
          <div className="latency-numbers">
            <span>
              p50 <b>{m.p50 === null ? "—" : Math.round(m.p50) + " ms"}</b>
            </span>
            <span>
              p95 <b>{m.p95 === null ? "—" : Math.round(m.p95) + " ms"}</b>
            </span>
          </div>
        </div>
        {chart.length ? (
          <Suspense fallback={<div style={{ height: 125 }} aria-busy="true" />}>
            <LatencyChart chart={chart} />
          </Suspense>
        ) : (
          <div className="empty-chart">
            <span />
            {t("Latency data appears after your first request.")}
          </div>
        )}
        <p className="tiny muted">
          {t("Browser round trip includes network, preflight and server work.")}{" "}
          {t(
            "{errors} errors · {timeouts} timeouts · {cancelled} cancellations.",
            { errors: m.errors, timeouts: m.timeouts, cancelled: m.cancelled },
          )}
        </p>
      </div>
      {!connected && (
        <div className="getting-started">
          <FileJson2 size={20} />
          <div>
            <strong>{t("Server connection requirements")}</strong>
            <p>
              {t(
                "Use an HTTP(S) endpoint that supports MCP 2026-07-28 and permits this origin through CORS.",
              )}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <a
              href="https://docs.orionis-framework.com/en/mcp/http-and-clients/"
              target="_blank"
              rel="noreferrer"
            >
              {t("Read guide")} <ArrowRight size={14} />
            </a>
          </Button>
        </div>
      )}
      {!connected && <ProductInfo />}
    </div>
  );
}
