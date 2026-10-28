import { Check, LoaderCircle, Minus, Circle } from "lucide-react";
import { useInspector } from "@/stores/inspector";
import { useI18n } from "@/i18n/react";
export function TestProgress() {
  const { t } = useI18n();
  const { busy, tests } = useInspector();
  const steps = tests.filter((test) => test.id.startsWith("RUN-"));
  if (!busy || !steps.length) return null;
  return (
    <section
      className="test-progress"
      aria-label={t("Safe test progress")}
      aria-live="polite"
    >
      <div className="eyebrow">
        {t("SAFE INSPECTION · SEQUENTIAL REQUESTS")}
      </div>
      {steps.map((step) => {
        const running = step.evidence.startsWith("Running");
        return (
          <div key={step.id}>
            {running ? (
              <LoaderCircle size={13} className="spin" />
            ) : step.status === "Passed" ? (
              <Check size={13} />
            ) : step.status === "Not Applicable" ? (
              <Minus size={13} />
            ) : (
              <Circle size={11} />
            )}
            <span>{t(step.label)}</span>
            <small>{t(running ? "Running" : step.status)}</small>
          </div>
        );
      })}
    </section>
  );
}
