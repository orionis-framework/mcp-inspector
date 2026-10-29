export const INSPECTOR_ORIGIN = "https://inspector.orionis-framework.com";

/** Only canonical HTTP(S) origins enter this copyable dotenv literal. */
export function orionisEnvironment(inspectorOrigin: string): string {
  const origins = [INSPECTOR_ORIGIN];
  try {
    const parsed = new URL(inspectorOrigin);
    if (
      ["http:", "https:"].includes(parsed.protocol) &&
      parsed.origin === inspectorOrigin &&
      /^[a-z\d.:[\]-]+$/i.test(parsed.host) &&
      !origins.includes(parsed.origin)
    ) {
      origins.push(parsed.origin);
    }
  } catch {
    // An unavailable or invalid preview origin cannot alter the production example.
  }
  return [
    `CORS_ALLOW_ORIGINS="list:[${origins.map((origin) => `'${origin}'`).join(", ")}]"`,
    'CORS_ALLOW_METHODS="list:[\'POST\', \'OPTIONS\']"',
    'CORS_ALLOW_HEADERS="list:[\'*\']"',
  ].join("\n");
}
