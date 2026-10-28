import { useI18n } from "@/i18n/react";
import { useState } from "react";
import {
  ChevronDown,
  Server,
  Wrench,
  FileText,
  Braces,
  MessageSquare,
  Activity,
  History,
  Search,
  Radio,
} from "lucide-react";
import { useInspector, type Selection } from "@/stores/inspector";
export function Explorer() {
  const { t } = useI18n();
  const { snapshot, selection, select } = useInspector();
  const [query, setQuery] = useState("");
  const match = (name: string) =>
    name.toLowerCase().includes(query.toLowerCase());
  const item = (label: string, target: Selection, icon?: React.ReactNode) => (
    <button
      key={target.kind + label}
      className={
        "tree-item " +
        (selection.kind === target.kind && selection.name === target.name
          ? "selected"
          : "")
      }
      onClick={() => select(target)}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="explorer" aria-label={t("MCP Explorer")}>
      <div className="panel-title">
        {t("EXPLORER")} <span className="tiny muted">MCP</span>
      </div>
      <label className="search-field">
        <Search size={14} />
        <input
          aria-label={t("Filter explorer")}
          placeholder={t("Find a capability…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <kbd>⌕</kbd>
      </label>
      <div className="tree">
        <details open>
          <summary>
            <ChevronDown />
            <Server /> {t("Server")}
          </summary>
          {item(t("Overview"), { kind: "overview" })}
          {item(t("Capabilities"), { kind: "capabilities" })}
        </details>
        <details open>
          <summary>
            <ChevronDown />
            <Wrench /> {t("Tools")} <span>{snapshot.tools.length}</span>
          </summary>
          {snapshot.tools
            .filter((t) => match(t.name))
            .map((t) => item(t.name, { kind: "tool", name: t.name }))}
          {!snapshot.tools.length && (
            <small className="tree-empty">{t("No tools discovered")}</small>
          )}
        </details>
        <details open>
          <summary>
            <ChevronDown />
            <FileText /> {t("Resources")}{" "}
            <span>{snapshot.resources.length}</span>
          </summary>
          {snapshot.resources
            .filter((t) => match(t.name))
            .map((t) => item(t.name, { kind: "resource", name: t.uri }))}
        </details>
        <details>
          <summary>
            <ChevronDown />
            <Braces /> {t("Resource Templates")}{" "}
            <span>{snapshot.templates.length}</span>
          </summary>
          {snapshot.templates
            .filter((t) => match(t.name))
            .map((t) =>
              item(t.name, { kind: "template", name: t.uriTemplate }),
            )}
        </details>
        <details open>
          <summary>
            <ChevronDown />
            <MessageSquare /> {t("Prompts")}{" "}
            <span>{snapshot.prompts.length}</span>
          </summary>
          {snapshot.prompts
            .filter((t) => match(t.name))
            .map((t) => item(t.name, { kind: "prompt", name: t.name }))}
        </details>
        {item(t("Completions"), { kind: "completions" }, <Braces size={15} />)}
        {item(
          t("Subscriptions"),
          { kind: "subscriptions" },
          <Radio size={15} />,
        )}
        <details open>
          <summary>
            <ChevronDown />
            <Activity /> {t("Diagnostics")}
          </summary>
          {[
            "Protocol",
            "Schemas",
            "Security",
            "Performance",
            "AI Readiness",
          ].map((name) => item(t(name), { kind: "diagnostics", name }))}
        </details>
        {item(t("History"), { kind: "history" }, <History size={15} />)}
      </div>
      <div className="explorer-footer">
        <span className="status-dot" /> {t("Browser-only workspace")}
        <br />
        <small>{t("Requests go directly to your endpoint.")}</small>
      </div>
    </nav>
  );
}
