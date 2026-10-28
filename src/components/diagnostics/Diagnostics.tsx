import {
  ShieldCheck,
  TriangleAlert,
  CircleCheck,
  ArrowUpRight,
} from "lucide-react";
import { useInspector } from "@/stores/inspector";
import type { TestResult } from "@/core/validation/types";
import { useI18n } from "@/i18n/react";
import { translateGenerated } from "@/i18n";

export function Finding({ test }: { test: TestResult }) {
  const { t, locale } = useI18n();
  return (
    <article className={"finding " + test.severity}>
      <div className="finding-head">
        <span>
          {test.status === "Passed" ? (
            <CircleCheck size={14} />
          ) : (
            <TriangleAlert size={14} />
          )}{" "}
          {t(test.status)}
          {test.severity !== "info" ? " · " + t(test.severity) : ""}
        </span>
        <code>{test.id}</code>
      </div>
      <h4>{translateGenerated(test.label, locale)}</h4>
      <small className="muted tiny">
        {t(test.category)} · {t(test.component)}
      </small>
      <p>{translateGenerated(test.issue, locale)}</p>
      <details>
        <summary>{t("Evidence & recommendation")}</summary>
        <pre>{translateGenerated(test.evidence, locale)}</pre>
        <p>{translateGenerated(test.recommendation, locale)}</p>
        <a href={test.reference} target="_blank" rel="noreferrer">
          {t("Protocol reference")} <ArrowUpRight size={12} />
        </a>
      </details>
      {test.heuristic && (
        <small className="heuristic">{t("Heuristic · advisory")}</small>
      )}
    </article>
  );
}
export function Diagnostics() {
  const { t } = useI18n();
  const { tests, selection } = useInspector();
  const selected = selection.name;
  const findings = tests.filter(
    (test) =>
      ["Failed", "Warning", "Blocked"].includes(test.status) &&
      (!selected ||
        selection.kind === "diagnostics" ||
        test.component === selection.kind + ":" + selected ||
        test.component === "server"),
  );
  return (
    <aside className="diagnostics">
      <div className="panel-title">
        <span>
          <ShieldCheck size={15} /> {t("VALIDATION")}
        </span>
        <span className="count">{findings.length}</span>
      </div>
      <div className="panel-body">
        <div className="diagnostic-intro">
          <span className="eyebrow">{t("EVIDENCE, NOT ASSUMPTIONS")}</span>
          <h3>{t("Know what to improve.")}</h3>
          <p>
            {t("Protocol checks and clearly marked quality recommendations.")}
          </p>
        </div>
        {findings.length ? (
          findings.map((test) => <Finding key={test.id} test={test} />)
        ) : (
          <div className="empty-small">
            <ShieldCheck size={29} />
            <h4>
              {t(
                tests.length
                  ? "No findings for this selection"
                  : "Awaiting an inspection",
              )}
            </h4>
            <p>
              {t(
                tests.length
                  ? "Open Diagnostics to review coverage and untested checks."
                  : "Connect a server to start collecting real evidence.",
              )}
            </p>
          </div>
        )}
        <div className="privacy-note">
          <ShieldCheck size={16} />
          <p>
            {t(
              "Credentials stay in memory. Logs and exports redact sensitive fields.",
            )}
          </p>
        </div>
      </div>
    </aside>
  );
}
