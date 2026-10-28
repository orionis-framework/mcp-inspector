import type { Category, ScoreSummary, Snapshot, TestResult } from "./types";

export const CATEGORY_WEIGHTS: Record<Category, number> = {
  protocol: 30,
  tools: 25,
  security: 20,
  performance: 15,
  ai: 10,
};
const evaluated = (test: TestResult): boolean =>
  ["Passed", "Failed", "Warning"].includes(test.status);

/** Client configuration is useful diagnostic evidence, but does not establish server quality.
 * A successful discovery is required to attribute a quality score to this inspection.
 * Retained discovery evidence remains valid after an explicit manual disconnect.
 */
export function calculateScore(
  tests: TestResult[],
  snapshot: Snapshot,
): ScoreSummary {
  const serverChecks = tests.filter(
    (test) => test.component !== "client" && test.scoreEligible !== false,
  );
  const hasDiscovery = snapshot.discovery !== undefined;
  const byCategory = {} as ScoreSummary["byCategory"];
  let totalWeight = 0;
  let weightedScore = 0;
  for (const category of Object.keys(CATEGORY_WEIGHTS) as Category[]) {
    const applicable = serverChecks.filter(
      (test) => test.category === category && test.status !== "Not Applicable",
    );
    const checked = applicable.filter(evaluated);
    const score =
      hasDiscovery && checked.length
        ? Math.round(
            (100 *
              checked.reduce(
                (sum, test) =>
                  sum +
                  (test.status === "Passed"
                    ? 1
                    : test.status === "Warning"
                      ? 0.5
                      : 0),
                0,
              )) /
              checked.length,
          )
        : null;
    const weight = CATEGORY_WEIGHTS[category];
    byCategory[category] = {
      weight,
      score,
      coverage: applicable.length
        ? Math.round((checked.length / applicable.length) * 100)
        : 0,
      evaluated: checked.length,
      applicable: applicable.length,
    };
    if (score !== null) {
      totalWeight += weight;
      weightedScore += score * weight;
    }
  }
  const applicable = serverChecks.filter(
    (test) => test.status !== "Not Applicable",
  ).length;
  const checked = serverChecks.filter(evaluated).length;
  const coverage = applicable ? Math.round((checked / applicable) * 100) : 0;
  const score = totalWeight ? Math.round(weightedScore / totalWeight) : null;
  const failed = tests.some((test) => test.status === "Failed");
  const insufficient =
    !hasDiscovery ||
    checked === 0 ||
    checked < applicable ||
    byCategory.protocol.evaluated === 0 ||
    byCategory.security.evaluated === 0;
  return {
    score,
    reason: !hasDiscovery
      ? "No successful discovery response. Server quality has not been verified."
      : checked === 0
        ? "No server checks have been evaluated."
        : null,
    classification:
      score === null
        ? "Not Verified"
        : score >= 90
          ? "Excellent"
          : score >= 75
            ? "Needs Improvement"
            : "Critical",
    readiness: failed
      ? "Not Ready"
      : insufficient
        ? "Not Verified"
        : tests.some((test) => test.status === "Warning")
          ? "Ready with Warnings"
          : "Ready",
    coverage,
    evaluated: checked,
    applicable,
    byCategory,
  };
}
