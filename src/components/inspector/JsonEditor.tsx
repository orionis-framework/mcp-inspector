import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useI18n } from "@/i18n/react";
import {
  EDITOR_CHANNEL,
  MAX_EDITOR_CHARACTERS,
  isEditorOutput,
  type EditorInput,
} from "@/editor/protocol";

interface Props {
  value: string;
  onChange: (value: string) => void;
  dark: boolean;
}

/** Only the editor document remounts on language change; arguments live in its parent. */
export default function JsonEditor(props: Props) {
  const { locale } = useI18n();
  return <EditorFrame key={locale} {...props} locale={locale} />;
}

function EditorFrame({
  value,
  onChange,
  dark,
  locale,
}: Props & { locale: "en" | "es" }) {
  const { t } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef({ value, onChange, dark });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<"load" | "limit" | null>(null);
  useLayoutEffect(() => {
    latest.current = { value, onChange, dark };
  }, [value, onChange, dark]);

  const send = useCallback((type: EditorInput["type"]) => {
    const target = frame.current?.contentWindow;
    if (!target) return;
    const current = latest.current;
    const message: EditorInput = {
      channel: EDITOR_CHANNEL,
      type,
      value: current.value,
      dark: current.dark,
    };
    // The receiver also validates length. Never transfer oversized argument text.
    if (current.value.length > MAX_EDITOR_CHARACTERS) {
      setError("limit");
      return;
    }
    setError((currentError) =>
      currentError === "limit" ? null : currentError,
    );
    target.postMessage(message, window.location.origin);
  }, []);
  useLayoutEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow ||
        !isEditorOutput(event.data)
      )
        return;
      const message = event.data;
      if (message.type === "ready") {
        setReady(true);
        setError(null);
      } else if (message.type === "error") {
        setError(message.code);
      } else {
        setError(null);
        latest.current.onChange(message.value);
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    send(ready ? "update" : "init");
  }, [value, dark, ready, send]);

  return (
    <div className="json-editor" style={{ position: "relative" }}>
      <iframe
        ref={frame}
        src={`/editor.html?lang=${locale}`}
        title={t("JSON arguments editor")}
        onLoad={() => send("init")}
        onError={() => setError("load")}
        referrerPolicy="no-referrer"
        style={{ width: "100%", height: 260, display: "block", border: 0 }}
      />
      {!ready && !error && (
        <div
          role="status"
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            background: "var(--surface)",
            color: "var(--muted)",
          }}
        >
          {t("Loading local JSON editor…")}
        </div>
      )}
      {error && (
        <p role="alert" className="error" style={{ margin: 0, padding: 8 }}>
          {error === "load"
            ? t(
                "The local JSON editor could not load. Reload this panel to try again.",
              )
            : t(
                "The JSON editor accepts up to {limit} characters. Larger edits are rejected.",
                { limit: MAX_EDITOR_CHARACTERS.toLocaleString(locale) },
              )}
        </p>
      )}
    </div>
  );
}
