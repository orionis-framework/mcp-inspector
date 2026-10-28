const sensitive =
  /authorization|cookie|token|secret|password|passwd|api.?key|credential|private.?key/i;
export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()])
      url.searchParams.set(key, "[REDACTED]");
    url.hash = "";
    return url.href;
  } catch {
    return value;
  }
}
export function redact<T>(value: T, secrets: string[] = []): T {
  const clean = (v: unknown, depth = 0): unknown => {
    if (depth > 40) return "[DEPTH LIMIT]";
    if (typeof v === "string") {
      let s = v;
      for (const secret of secrets
        .filter(Boolean)
        .sort((a, b) => b.length - a.length))
        s = s.split(secret).join("[REDACTED]");
      return s
        .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [REDACTED]")
        .replace(
          /((?:api[_-]?key|token|password|secret)=)[^&\s"']+/gi,
          "$1[REDACTED]",
        )
        .replace(
          /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
          "[REDACTED JWT]",
        );
    }
    if (Array.isArray(v)) return v.map((x) => clean(x, depth + 1));
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [
          k,
          sensitive.test(k) ? "[REDACTED]" : clean(x, depth + 1),
        ]),
      );
    return v;
  };
  return clean(value) as T;
}
