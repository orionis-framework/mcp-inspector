import "./frame.css";
import {
  EDITOR_CHANNEL,
  MAX_EDITOR_CHARACTERS,
  isEditorInput,
  type EditorOutput,
  type EditorState,
} from "./protocol";
import type { EditorController } from "./engine";

const locale =
  new URLSearchParams(location.search).get("lang") === "es" ? "es" : "en";
document.documentElement.lang = locale;
document.title =
  locale === "es"
    ? "Editor de argumentos JSON — Orionis"
    : "JSON arguments editor — Orionis";

const send = (message: EditorOutput) => {
  if (window.parent !== window)
    window.parent.postMessage(message, location.origin);
};
let pending: EditorState | undefined;
let controller: EditorController | undefined;
let create: typeof import("./engine").createEditor | undefined;
const startOrUpdate = () => {
  if (!pending || !create) return;
  if (controller) {
    controller.update(pending);
    return;
  }
  const root = document.getElementById("editor");
  if (!root) throw new Error("Editor container unavailable");
  controller = create(root, pending, locale, {
    change: (value) => send({ channel: EDITOR_CHANNEL, type: "change", value }),
    limit: () =>
      send({ channel: EDITOR_CHANNEL, type: "error", code: "limit" }),
  });
  send({ channel: EDITOR_CHANNEL, type: "ready" });
};
window.addEventListener("message", (event: MessageEvent<unknown>) => {
  // NLS isolation is not a different service: only this exact parent may send content.
  if (
    event.origin !== location.origin ||
    event.source !== window.parent ||
    window.parent === window
  )
    return;
  if (!isEditorInput(event.data)) {
    if (
      event.data &&
      typeof event.data === "object" &&
      "channel" in event.data &&
      event.data.channel === EDITOR_CHANNEL &&
      "value" in event.data &&
      typeof event.data.value === "string" &&
      event.data.value.length > MAX_EDITOR_CHARACTERS
    )
      send({ channel: EDITOR_CHANNEL, type: "error", code: "limit" });
    return;
  }
  pending = { value: event.data.value, dark: event.data.dark };
  try {
    startOrUpdate();
  } catch {
    send({ channel: EDITOR_CHANNEL, type: "error", code: "load" });
  }
});
window.addEventListener("pagehide", () => controller?.dispose());

async function boot() {
  // Monaco localizes action registrations at module initialization. A fresh iframe
  // lets each locale load its catalog before those modules run, without reloading
  // the inspector, losing credentials, or sending arguments to another origin.
  if (locale === "es") await import("monaco-editor/nls/lang/es.js");
  const engine = await import("./engine");
  create = engine.createEditor;
  startOrUpdate();
}
void boot().catch(() =>
  send({ channel: EDITOR_CHANNEL, type: "error", code: "load" }),
);
