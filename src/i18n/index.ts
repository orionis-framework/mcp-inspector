import { appEs } from "./app";
import { inspectorEs } from "./inspector";
import { workspaceEs } from "./workspace";
import { diagnosticsEs, diagnosticTemplatesEs } from "./diagnostics";

export type Locale = "en" | "es";
export type TranslationParams = Record<string, string | number>;
export const DEFAULT_LOCALE: Locale = "en";
export const spanishMessages: Record<string, string> = {
  ...appEs,
  ...workspaceEs,
  ...inspectorEs,
  ...diagnosticsEs,
};
function interpolate(template: string, params: TranslationParams): string {
  return template.replace(
    /\{([A-Za-z][A-Za-z0-9_]*)\}/g,
    (match, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}
/** UI messages only. Protocol identifiers and server content never pass through this function. */
export function translate(
  message: string,
  locale: Locale = DEFAULT_LOCALE,
  params: TranslationParams = {},
): string {
  return interpolate(
    locale === "es" ? (spanishMessages[message] ?? message) : message,
    params,
  );
}

const escapePattern = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const generatedTemplates = Object.entries({
  ...Object.fromEntries(
    Object.entries(spanishMessages).filter(([key]) =>
      /\{[A-Za-z][A-Za-z0-9_]*\}/.test(key),
    ),
  ),
  ...diagnosticTemplatesEs,
})
  .map(([template, translated]) => {
    const names: string[] = [];
    let pattern = "";
    let offset = 0;
    for (const match of template.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)) {
      pattern += escapePattern(template.slice(offset, match.index));
      pattern += "([\\s\\S]*?)";
      names.push(match[1]);
      offset = (match.index ?? 0) + match[0].length;
    }
    pattern += escapePattern(template.slice(offset));
    return {
      template,
      translated,
      names,
      pattern: new RegExp("^" + pattern + "$"),
    };
  })
  .sort((a, b) => b.template.length - a.template.length);

/** Presentation of inspector-generated evidence only; raw requests/responses stay unchanged. */
export function translateGenerated(
  message: string,
  locale: Locale = DEFAULT_LOCALE,
  depth = 0,
): string {
  if (locale === "en" || /^JSON-RPC -?\d+:/.test(message)) return message;
  if (Object.hasOwn(spanishMessages, message)) return spanishMessages[message];
  // Bound work when a schema error embeds unusually large untrusted values.
  if (message.length > 12000 || depth >= 8) return message;
  const prefix =
    /^(network|protocol|validation|timeout|cancelled|authentication|http|rpc|Passed|Failed|Warning|Not Applicable|Not Tested|Blocked): ([\s\S]*)$/.exec(
      message,
    );
  if (prefix)
    return (
      translate(prefix[1], locale) +
      ": " +
      (prefix[1] === "rpc"
        ? prefix[2]
        : translateGenerated(prefix[2], locale, depth + 1))
    );
  const joined = message.split("; ");
  if (joined.length > 1 && joined.length <= 40) {
    const translated = joined.map((part) =>
      translateGenerated(part, locale, depth + 1),
    );
    if (translated.every((part, i) => part !== joined[i]))
      return translated.join("; ");
  }
  for (const { translated, names, pattern } of generatedTemplates) {
    const match = pattern.exec(message);
    if (match)
      return interpolate(
        translated,
        Object.fromEntries(names.map((name, i) => [name, match[i + 1]])),
      );
  }
  if (message.startsWith("Error: "))
    return "Error: " + translateGenerated(message.slice(7), locale, depth + 1);
  return message;
}
