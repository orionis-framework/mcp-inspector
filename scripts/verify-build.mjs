// Build-time only: this script is never bundled or shipped as a runtime server.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const read = (path) => readFileSync(path, "utf8");
const walk = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

assert.ok(existsSync(join(dist, "index.html")), "dist/index.html must exist");
assert.equal(
  read(join(dist, "CNAME")).trim(),
  "inspector.orionis-framework.com",
);
assert.ok(
  existsSync(join(dist, "editor.html")),
  "Local editor entry must exist",
);
for (const entry of ["index.html", "es/index.html", "editor.html"]) {
  assert.ok(existsSync(join(dist, entry)), "Missing static HTML: " + entry);
  const html = read(join(dist, entry));
  // Navigation/canonical links and the Google Analytics loader may be absolute.
  for (const [tag] of html.matchAll(
    /<(?:script|link|img|iframe|source)\b[^>]*>/gi,
  )) {
    if (/\brel="(?:canonical|alternate)"/i.test(tag)) continue;
    const href = /(?:src|href)="([^"]+)"/.exec(tag)?.[1];
    if (!href || href.startsWith("#") || href.startsWith("data:")) continue;
    if (
      entry !== "editor.html" &&
      /^<script\b/i.test(tag) &&
      href === "https://www.googletagmanager.com/gtag/js?id=G-00KY9GMZQ0"
    ) continue;
    assert.ok(
      !/^https?:/.test(href),
      entry + " must use local runtime assets: " + href,
    );
    assert.ok(
      href.startsWith("/"),
      "Expected root-based custom-domain asset: " + href,
    );
    assert.ok(
      existsSync(join(dist, href.split(/[?#]/)[0])),
      "Missing built asset " + href,
    );
  }
}
for (const entry of [
  "robots.txt",
  "sitemap.xml",
  "images/orionis-mcp-inspector.png",
])
  assert.ok(existsSync(join(dist, entry)), "Missing discovery asset: " + entry);
const files = walk(dist);
const allowedExtensions = new Set([
  ".html",
  ".js",
  ".css",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".json",
  ".xml",
  ".txt",
  ".map",
]);
for (const file of files) {
  const name = file.slice(dist.length + 1);
  if (["CNAME", ".nojekyll"].includes(name)) continue;
  assert.ok(
    allowedExtensions.has(extname(file)),
    `Unexpected nonstatic artifact: ${name}`,
  );
  if (extname(file) === ".js") {
    const body = read(file);
    assert.ok(
      !body.includes("__vite-browser-external"),
      `Browser bundle contains unresolved Node dependency: ${name}`,
    );
    assert.ok(
      !/(?:from\s*|import\s*\(|require\s*\()\s*["']node:/.test(body),
      `Browser bundle imports Node: ${name}`,
    );
  }
}
for (const file of walk(join(root, "src")).filter((path) =>
  /\.[cm]?[jt]sx?$/.test(path),
)) {
  const body = read(file);
  assert.ok(
    !/(?:from\s*|import\s*\(|require\s*\()\s*["'](?:node:|fs["']|path["']|http["']|https["'])/.test(
      body,
    ),
    `Runtime source imports a Node module: ${file}`,
  );
  assert.ok(
    !/["'`]\/api(?:\/|["'`])/.test(body),
    `Runtime source depends on an internal API route: ${file}`,
  );
  assert.ok(
    !/mode\s*:\s*["']no-cors/.test(body),
    `Runtime source uses opaque CORS mode: ${file}`,
  );
}
assert.ok(
  files.some((path) => path.endsWith(".js")),
  "Missing compiled JavaScript",
);
assert.ok(
  files.some((path) => path.endsWith(".css")),
  "Missing compiled CSS",
);
console.log(
  `Static artifact verified: ${files.length} files, custom-domain assets, no unresolved Node imports or internal API routes.`,
);
