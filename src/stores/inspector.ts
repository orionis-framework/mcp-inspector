import { create } from "zustand";
import { McpClient } from "@/core/mcp/client";
import { runSafeTests } from "@/core/testing/runner";
import { calculateScore, evaluate } from "@/core/validation";
import type { Snapshot, TestResult } from "@/core/validation/types";
import type { RequestRecord } from "@/types/mcp";

export type Selection = {
  kind:
    | "overview"
    | "capabilities"
    | "tool"
    | "resource"
    | "template"
    | "prompt"
    | "completions"
    | "subscriptions"
    | "diagnostics"
    | "history";
  name?: string;
};
const empty = (): Snapshot => ({
  tools: [],
  resources: [],
  templates: [],
  prompts: [],
  records: [],
});
interface State {
  endpoint: string;
  connected: boolean;
  busy: boolean;
  message: string;
  client?: McpClient;
  controller?: AbortController;
  snapshot: Snapshot;
  tests: TestResult[];
  selection: Selection;
  activeRecord?: string;
  dark: boolean;
  setEndpoint: (value: string) => void;
  select: (value: Selection) => void;
  setActiveRecord: (id: string) => void;
  toggleTheme: () => void;
  connect: (headers: Record<string, string>, timeout: number) => Promise<void>;
  disconnect: () => void;
  run: () => Promise<void>;
  cancel: () => void;
  record: (record: RequestRecord) => void;
}
export const useInspector = create<State>((set, get) => ({
  endpoint: "",
  connected: false,
  busy: false,
  message: "",
  snapshot: empty(),
  tests: [],
  selection: { kind: "overview" },
  dark: false,
  setEndpoint: (endpoint) => set({ endpoint }),
  select: (selection) => set({ selection }),
  setActiveRecord: (activeRecord) => set({ activeRecord }),
  toggleTheme: () => set({ dark: !get().dark }),
  record: (record) =>
    set((state) => {
      const records = [...state.snapshot.records];
      const index = records.findIndex((item) => item.id === record.id);
      if (index >= 0) records[index] = record;
      else records.push(record);
      const snapshot = { ...state.snapshot, records: records.slice(-250) };
      const completed =
        record.response !== undefined || record.error !== undefined;
      if (state.busy || !completed) {
        return { snapshot, activeRecord: record.id };
      }
      // Refresh derived evidence after manual traffic while retaining safe-run
      // statuses, explicit execution validation and authorized probe results.
      const refreshed = evaluate(snapshot);
      const derivedIds = new Set([
        ...evaluate(state.snapshot).map((test) => test.id),
        ...refreshed.map((test) => test.id),
      ]);
      return {
        snapshot,
        tests: [
          ...state.tests.filter((test) => !derivedIds.has(test.id)),
          ...refreshed,
        ],
        activeRecord: record.id,
      };
    }),
  connect: async (headers, timeout) => {
    get().client?.disconnect();
    const controller = new AbortController();
    let client: McpClient;
    try {
      client = new McpClient({
        endpoint: get().endpoint,
        headers,
        timeoutMs: timeout,
        onRecord: (record) => {
          if (get().client === client) get().record(record);
        },
      });
    } catch (error) {
      set({
        message: error instanceof Error ? error.message : String(error),
        connected: false,
        busy: false,
        client: undefined,
        controller: undefined,
        snapshot: empty(),
        tests: [],
      });
      return;
    }
    set({
      client,
      controller,
      busy: true,
      connected: false,
      message: "Checking HTTP response and MCP discovery…",
      snapshot: empty(),
      tests: [],
      selection: { kind: "overview" },
    });
    try {
      const result = await runSafeTests(client, {
        signal: controller.signal,
        onProgress: (tests) => {
          if (get().client === client) set({ tests });
        },
      });
      if (get().client !== client) return;
      const failed = result.tests.find(
        (test) =>
          test.id.startsWith("RUN-") &&
          ["Failed", "Blocked"].includes(test.status),
      );
      set({
        snapshot: result.snapshot,
        tests: result.tests,
        connected: Boolean(result.snapshot.discovery),
        message: controller.signal.aborted
          ? "Connection inspection cancelled; completed evidence retained."
          : failed
            ? failed.evidence
            : "Connected. Each request is independent.",
      });
    } catch (error) {
      if (get().client === client)
        set({
          message: error instanceof Error ? error.message : String(error),
          connected: false,
        });
    } finally {
      if (get().client === client) set({ busy: false, controller: undefined });
    }
  },
  disconnect: () => {
    get().controller?.abort();
    get().client?.disconnect();
    set({
      client: undefined,
      controller: undefined,
      connected: false,
      busy: false,
      message:
        "Disconnected. Credentials cleared; redacted evidence remains in this tab.",
    });
  },
  run: async () => {
    const client = get().client;
    if (!client) return;
    const controller = new AbortController();
    set({ busy: true, controller, message: "Running safe checks…", tests: [] });
    try {
      const result = await runSafeTests(client, {
        signal: controller.signal,
        onProgress: (tests) => {
          if (get().client === client) set({ tests });
        },
      });
      if (get().client === client)
        set((state) => ({
          snapshot: { ...result.snapshot, records: state.snapshot.records },
          connected: Boolean(result.snapshot.discovery),
          tests: result.tests,
          message: controller.signal.aborted
            ? "Safe checks cancelled; completed evidence retained."
            : "Safe checks complete. Tool execution remains manual.",
        }));
    } catch (error) {
      if (get().client === client) set({ message: String(error) });
    } finally {
      if (get().client === client) set({ busy: false, controller: undefined });
    }
  },
  cancel: () => {
    get().controller?.abort();
    set({ message: "Cancellation requested. Completed evidence is retained." });
  },
}));
export const getScore = () => {
  const state = useInspector.getState();
  return calculateScore(state.tests, state.snapshot);
};
