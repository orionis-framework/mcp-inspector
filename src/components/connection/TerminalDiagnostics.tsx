import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/react";
import { analyzeTerminalOutput, MAX_TERMINAL_CHARS, type TerminalFinding } from "@/core/connection/terminal";

export function TerminalDiagnostics({ origin, requestedHeaders }: { origin: string; requestedHeaders: string[] }) {
  const { t } = useI18n();
  const inputId = useId();
  const completeId = useId();
  const [output, setOutput] = useState("");
  const [complete, setComplete] = useState(false);
  const [result, setResult] = useState<TerminalFinding>();
  return (
    <details className="terminal-diagnostics">
      <summary>{t("Analyze terminal connection evidence")}</summary>
      <p>{t("When the browser hides a response, paste the preflight command output to distinguish TLS, DNS, network filtering, HTTP errors and missing CORS headers. Analysis stays in this tab and does not change the MCP score.")}</p>
      <label htmlFor={inputId}>{t("Preflight terminal output")}</label>
      <textarea
        id={inputId}
        rows={7}
        maxLength={MAX_TERMINAL_CHARS}
        value={output}
        spellCheck={false}
        autoComplete="off"
        placeholder={t("Paste the most recent curl OPTIONS output, without credentials.")}
        onChange={(event) => { setOutput(event.target.value); setResult(undefined); }}
      />
      <label className="terminal-complete" htmlFor={completeId}>
        <input id={completeId} type="checkbox" checked={complete} onChange={(event) => { setComplete(event.target.checked); setResult(undefined); }} />
        {t("I pasted the complete preflight response (including all response headers).")}
      </label>
      <div className="terminal-actions">
        <Button type="button" size="sm" disabled={!output.trim()} onClick={() => setResult(analyzeTerminalOutput(output, { origin, requestedHeaders, completeOutput: complete }))}>{t("Analyze output locally")}</Button>
        <Button type="button" size="sm" variant="ghost" disabled={!output && !result} onClick={() => { setOutput(""); setResult(undefined); setComplete(false); }}>{t("Clear terminal evidence")}</Button>
      </div>
      {result && (
        <div className="terminal-result" role="status" aria-live="polite">
          <h4>{t(result.title)}</h4>
          {result.httpStatus !== undefined && <p>{t("Observed HTTP status: {status}", { status: result.httpStatus })}</p>}
          <p>{t(result.evidence)}</p>
          <p>{t(result.recommendation)}</p>
          <small>{t("Based on the pasted output, not an independent network measurement. If several attempts are present, the latest recognized attempt is used.")}</small>
        </div>
      )}
    </details>
  );
}
