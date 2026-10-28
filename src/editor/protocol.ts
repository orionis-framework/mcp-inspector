/** Private, same-origin communication with the bundled editor document. */
export const EDITOR_CHANNEL = "orionis-json-editor/v1";
export const MAX_EDITOR_CHARACTERS = 1_000_000;

export interface EditorState {
  value: string;
  dark: boolean;
}
export interface EditorInput extends EditorState {
  channel: typeof EDITOR_CHANNEL;
  type: "init" | "update";
}
export type EditorOutput =
  | { channel: typeof EDITOR_CHANNEL; type: "ready" }
  | { channel: typeof EDITOR_CHANNEL; type: "change"; value: string }
  | { channel: typeof EDITOR_CHANNEL; type: "error"; code: "load" | "limit" };

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function isEditorInput(value: unknown): value is EditorInput {
  return (
    object(value) &&
    value.channel === EDITOR_CHANNEL &&
    (value.type === "init" || value.type === "update") &&
    typeof value.value === "string" &&
    value.value.length <= MAX_EDITOR_CHARACTERS &&
    typeof value.dark === "boolean"
  );
}

export function isEditorOutput(value: unknown): value is EditorOutput {
  if (!object(value) || value.channel !== EDITOR_CHANNEL) return false;
  if (value.type === "ready") return true;
  if (value.type === "error")
    return value.code === "load" || value.code === "limit";
  return (
    value.type === "change" &&
    typeof value.value === "string" &&
    value.value.length <= MAX_EDITOR_CHARACTERS
  );
}
