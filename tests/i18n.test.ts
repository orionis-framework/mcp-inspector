import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import ts from "typescript";
import {
  DEFAULT_LOCALE,
  spanishMessages,
  translate,
  translateGenerated,
} from "../src/i18n";
import { diagnosticTemplatesEs } from "../src/i18n/diagnostics";
import { useLanguage } from "../src/i18n/react";
import { exportReportHtml, exportReportJson } from "../src/core/reporting";

beforeEach(() => useLanguage.setState({ locale: DEFAULT_LOCALE }));

describe("local language presentation", () => {
  it("starts in English and changes only the explicit tab preference", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(useLanguage.getState().locale).toBe("en");
    expect(translate("Connect")).toBe("Connect");
    useLanguage.getState().setLocale("es");
    expect(translate("Connect", useLanguage.getState().locale)).toBe(
      "Conectar",
    );
    useLanguage.getState().setLocale("en");
    expect(translate("Connect", useLanguage.getState().locale)).toBe("Connect");
  });
  it("interpolates data literally without interpreting dollars or braces as replacements", () => {
    const name = "customer_$&_{untouched}";
    expect(translate("Required argument: {name}", "es", { name })).toBe(
      "Argumento obligatorio: " + name,
    );
    expect(translate("Required argument: {name}", "en", { name })).toBe(
      "Required argument: " + name,
    );
    expect(translate("unknown.server.identifier", "es")).toBe(
      "unknown.server.identifier",
    );
  });
  it("translates generated findings and nested local errors without rewriting protocol values", () => {
    expect(translateGenerated("Advertised: 2026-07-28", "es")).toBe(
      "Declaradas: 2026-07-28",
    );
    expect(translateGenerated("Required argument: customer_id", "es")).toBe(
      "Argumento obligatorio: customer_id",
    );
    expect(
      translateGenerated("timeout: Request timed out after 15000 ms", "es"),
    ).toBe(
      "tiempo agotado: La solicitud agotó el tiempo de espera tras 15000 ms",
    );
    expect(
      translateGenerated("/name must have required property 'id': id", "es"),
    ).toBe("/name debe incluir la propiedad obligatoria 'id': id");
    expect(translateGenerated("JSON-RPC -32000: Request cancelled", "es")).toBe(
      "JSON-RPC -32000: Request cancelled",
    );
    expect(translateGenerated("Unknown server-specific wording", "es")).toBe(
      "Unknown server-specific wording",
    );
  });
  it("retains interpolation parameters in every Spanish message", () => {
    const parameters = (message: string) =>
      [...message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)]
        .map((m) => m[1])
        .sort();
    for (const [english, spanish] of Object.entries({
      ...spanishMessages,
      ...diagnosticTemplatesEs,
    })) {
      expect(parameters(spanish), english).toEqual(parameters(english));
    }
  });
  it("has translations for statically named interface messages", () => {
    const root = fileURLToPath(new URL("../src/", import.meta.url));
    const walk = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? walk(join(directory, entry.name))
          : entry.name.endsWith(".tsx")
            ? [join(directory, entry.name)]
            : [],
      );
    const missing: string[] = [];
    const technical = new Set([
      "JSON",
      "HTTP",
      "POST",
      "MCP",
      "cURL",
      "Fetch",
      "—",
    ]);
    for (const filename of [
      ...walk(join(root, "app")),
      ...walk(join(root, "components")),
    ]) {
      const source = ts.createSourceFile(
        filename,
        readFileSync(filename, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      function visit(node: ts.Node) {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "t" &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const key = node.arguments[0].text;
          if (!technical.has(key) && !Object.hasOwn(spanishMessages, key))
            missing.push(key);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    expect([...new Set(missing)]).toEqual([]);
  });
  it("keeps canonical JSON and server content while localizing readable report presentation", () => {
    const original = {
      endpoint: "https://example.test/mcp",
      tools: [{ name: "lookup", description: "Request cancelled" }],
      tests: [
        {
          id: "RUN-DISCOVERY",
          status: "Blocked",
          label: "Connectivity and discovery",
          evidence: "Discovery has not completed.",
        },
      ],
      score: { score: null, classification: "Not Verified" },
    };
    const originalCopy = structuredClone(original);
    const json = JSON.parse(exportReportJson(original, [], "es"));
    expect(json.language).toBe("es");
    expect(json.tests[0].status).toBe("Blocked");
    expect(json.tools[0].description).toBe("Request cancelled");
    const html = exportReportHtml(original, [], "es");
    expect(html).toContain('<html lang="es">');
    expect(html).toContain("<h1>Informe de inspección</h1>");
    expect(html).toContain("Bloqueada");
    expect(html).toContain("Request cancelled");
    expect(original).toEqual(originalCopy);
    expect(exportReportHtml(original)).toContain('<html lang="en">');
  });
});
