import type { StreamEvent } from "../../types/mcp";

/** Incremental SSE parsing. Does not reconnect or replay requests with possible side effects. */
export async function consumeSse(
  response: Response,
  onEvent: (event: StreamEvent) => boolean,
  signal: AbortSignal,
  maxBytes = 5_000_000,
): Promise<number> {
  if (!response.body) throw new Error("SSE response has no readable body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastChunkEndedInCr = false;
  let bytes = 0;
  let event = "message";
  let id: string | undefined;
  let lines: string[] = [];
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  const dispatch = (): boolean => {
    if (lines.length === 0) {
      event = "message";
      return false;
    }
    const raw = lines.join("\n");
    const data: unknown = JSON.parse(raw);
    const stop = onEvent({
      at: new Date().toISOString(),
      event,
      data,
      ...(id ? { id } : {}),
    });
    event = "message";
    lines = [];
    return stop;
  };
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) {
        // SSE dispatch requires an empty line; trailing incomplete events are intentionally discarded.
        return bytes;
      }
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes)
        throw new Error("Response exceeds the 5 MB inspection limit");
      let text = decoder.decode(chunk.value, { stream: true });
      if (!text) continue;
      if (lastChunkEndedInCr && text.startsWith("\n")) text = text.slice(1);
      lastChunkEndedInCr = text.endsWith("\r");
      buffer += text.replace(/\r\n?/g, "\n");
      while (true) {
        const end = buffer.indexOf("\n");
        if (end < 0) break;
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        if (!line) {
          if (dispatch()) return bytes;
          continue;
        }
        if (line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon < 0 ? line : line.slice(0, colon);
        let value = colon < 0 ? "" : line.slice(colon + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        if (field === "data") lines.push(value);
        else if (field === "event") event = value;
        else if (field === "id" && !value.includes("\0")) id = value;
      }
    }
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
