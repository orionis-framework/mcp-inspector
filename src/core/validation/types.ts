import type {
  DiscoveryResult,
  Tool,
  Resource,
  ResourceTemplate,
  Prompt,
  RequestRecord,
} from "../../types/mcp";

export type Category = "protocol" | "tools" | "security" | "performance" | "ai";
export type TestStatus =
  | "Passed"
  | "Failed"
  | "Warning"
  | "Not Applicable"
  | "Not Tested"
  | "Blocked";
export type Severity = "critical" | "error" | "warning" | "info";
export interface TestResult {
  id: string;
  label: string;
  category: Category;
  status: TestStatus;
  severity: Severity;
  component: string;
  issue: string;
  evidence: string;
  recommendation: string;
  reference: string;
  heuristic?: boolean;
  /** False for diagnostics that cannot establish server quality. */
  scoreEligible?: boolean;
}
export interface Snapshot {
  discovery?: DiscoveryResult;
  tools: Tool[];
  resources: Resource[];
  templates: ResourceTemplate[];
  prompts: Prompt[];
  records: RequestRecord[];
}
export interface ScoreSummary {
  score: number | null;
  reason: string | null;
  classification:
    | "Excellent"
    | "Needs Improvement"
    | "Critical"
    | "Not Verified";
  readiness: "Ready" | "Ready with Warnings" | "Not Ready" | "Not Verified";
  coverage: number;
  evaluated: number;
  applicable: number;
  byCategory: Record<
    Category,
    {
      weight: number;
      score: number | null;
      coverage: number;
      evaluated: number;
      applicable: number;
    }
  >;
}
export interface SchemaResult {
  valid: boolean;
  schemaValid: boolean;
  errors: string[];
  limited?: boolean;
}
