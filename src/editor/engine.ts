import "monaco-editor/features/register.all.js";
import * as monaco from "monaco-editor/editor/editor.api.js";
import { jsonDefaults } from "monaco-editor/languages/features/json/register.js";
import editorWorker from "monaco-editor/editor/editor.worker.js?worker";
import jsonWorker from "monaco-editor/language/json/json.worker.js?worker";
import { MAX_EDITOR_CHARACTERS, type EditorState } from "./protocol";

self.MonacoEnvironment = {
  getWorker: (_id, label) =>
    label === "json" ? new jsonWorker() : new editorWorker(),
};
// Untrusted argument schemas must never trigger network schema resolution.
jsonDefaults.setDiagnosticsOptions({
  validate: true,
  enableSchemaRequest: false,
  schemaRequest: "ignore",
});
monaco.editor.defineTheme("orionis-light", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#ffffff",
    "editor.foreground": "#182433",
    "editorLineNumber.foreground": "#626e7f",
    "editorCursor.foreground": "#206bc4",
    "editor.selectionBackground": "#dbeafa",
    "editor.lineHighlightBackground": "#f6f8fb",
  },
});
monaco.editor.defineTheme("orionis-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#101e30",
    "editor.foreground": "#e3ebf5",
    "editorLineNumber.foreground": "#9bacbf",
    "editorCursor.foreground": "#79c8ff",
    "editor.selectionBackground": "#293b50",
    "editor.lineHighlightBackground": "#182a40",
  },
});

export interface EditorController {
  update: (state: EditorState) => void;
  dispose: () => void;
}
export function createEditor(
  element: HTMLElement,
  initial: EditorState,
  locale: "en" | "es",
  callbacks: { change: (value: string) => void; limit: () => void },
): EditorController {
  let previous = initial.value;
  let updating = false;
  let dark = initial.dark;
  document.documentElement.classList.toggle("dark", dark);
  const editor = monaco.editor.create(element, {
    value: initial.value,
    language: "json",
    theme: dark ? "orionis-dark" : "orionis-light",
    ariaLabel:
      locale === "es" ? "Editor de argumentos JSON" : "JSON arguments editor",
    minimap: { enabled: false },
    fontSize: 13,
    fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    tabSize: 2,
    automaticLayout: true,
    wordWrap: "on",
    formatOnPaste: true,
    accessibilitySupport: "on",
  });
  const changes = editor.onDidChangeModelContent(() => {
    if (updating) return;
    const next = editor.getValue();
    if (next.length > MAX_EDITOR_CHARACTERS) {
      // Reject an oversized edit rather than leaving a visible value that differs
      // from the arguments the parent would execute.
      updating = true;
      editor.setValue(previous);
      updating = false;
      callbacks.limit();
      return;
    }
    previous = next;
    callbacks.change(next);
  });
  return {
    update(state) {
      if (state.dark !== dark) {
        dark = state.dark;
        document.documentElement.classList.toggle("dark", dark);
        monaco.editor.setTheme(dark ? "orionis-dark" : "orionis-light");
      }
      if (state.value !== editor.getValue()) {
        updating = true;
        editor.setValue(state.value);
        updating = false;
      }
      previous = state.value;
    },
    dispose() {
      changes.dispose();
      const model = editor.getModel();
      editor.dispose();
      model?.dispose();
    },
  };
}
