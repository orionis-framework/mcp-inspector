# Orionis MCP Inspector & Validator

**Inspect, Test & Validate Your MCP Servers**

An independent React application for inspecting MCP `2026-07-28` stateless HTTP servers directly from a browser. The production artifact is the static `dist/` directory. GitHub Pages serves the application; the browser sends MCP traffic to the endpoint selected by its user. There is no application backend, proxy, database, serverless function, telemetry collector or mandatory hosted service.

Deployment target: **https://inspector.orionis-framework.com/**. Source repository: [orionis-framework/mcp-inspector](https://github.com/orionis-framework/mcp-inspector). The deployment branch is `master`.

## Local development

Use Node.js 24 and pnpm 11.25.0. Node is needed only for development, verification and building. Enable Corepack when supplied by your Node installation, or install the declared pnpm version using the [official pnpm installation instructions](https://pnpm.io/installation).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the URL printed by Vite. The inspector is a single-route workspace, so it requires no history fallback or server rewrites. Enter a full HTTP(S) MCP endpoint, configure authentication if needed, and connect. From an HTTPS deployment, use an HTTPS endpoint: browsers may block insecure mixed content. Loopback/local network access is also subject to browser permissions and network policy.

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm preview
```

On Linux CI, use `pnpm exec playwright install --with-deps chromium`. Commit `pnpm-lock.yaml` when dependencies change. `pnpm build` runs TypeScript, Vite and `scripts/verify-build.mjs`; the latter verifies the static artifact, domain marker, root-based entry assets and absence of unresolved Node imports or internal API routes. Browser tests use controlled MCP mocks; they do not send commands to a real production server.

## Visual identity

The workspace reuses the official Orionis website and documentation palette: blue accents, navy dark surfaces, gold primary actions and the unmodified official SVG in `public/favicon.svg`. Titillium Web (400, 600 and 700, Latin and Latin Extended) is served locally from `public/fonts`; JSON and code use local JetBrains Mono. Font licenses are included alongside the assets. No Google Fonts, font CDN or external branding request is needed. Theme tokens and font declarations live in `src/styles/index.css` and `src/styles/fonts.css`. The official Orionis name and logo identify the project; the code license does not grant trademark rights.

## Languages

The header language selector switches between **English** and **Español**. Every new
page load starts in English regardless of the browser language. The choice lives in
tab memory; changing it preserves the connection, credentials, arguments and results.
Interface labels, inspector-generated diagnostics, confirmations and readable HTML/PDF
reports follow the selected language. JSON exports record the selected language while
keeping canonical statuses and evidence for programmatic use. Names, descriptions,
schemas, errors and payloads returned by MCP servers remain in their original language.

Translations are bundled locally in `src/i18n`. Monaco loads its official local
Spanish catalog in a same-origin static `editor.html` document so its menus can switch
languages without reloading the workspace. No translation service or CDN is used. Some internal JSON language-service diagnostics
remain in English because the installed worker does not include a Spanish catalog.

## Workspace

- **Explorer:** server identity and capabilities, tools, resources, templates, prompts, completions, diagnostics and history.
- **Inspector:** schema-driven arguments and JSON editing; manual tool execution; resource reads and prompt retrieval; capability-gated advanced operations.
- **Diagnostics:** specific findings with evidence, recommendations and source references. AI Readiness rules are heuristics, not MCP compliance claims.
- **Request inspector:** configured request headers, browser-accessible response headers, JSON-RPC body, timing, events and errors. Copy sanitized JSON, cURL or Fetch examples.
- **Reports:** local JSON, HTML and PDF downloads, including evidence, tests, coverage and recommendations. PDF preserves Unicode evidence using JSON escapes because it uses bundled PDF fonts; JSON and HTML retain ordinary Unicode text.

`Run All Safe Tests` performs discovery and metadata/catalog checks, validates schemas and gathers browser timings. It does **not** execute tools automatically. A tool's annotations are untrusted hints; review the endpoint and arguments before confirming potentially state-changing calls. Cancellation aborts the browser request; it cannot guarantee a server has rolled back work already started.

Credentials and request history live in session memory. Do not paste production secrets into argument fields unless the chosen endpoint is entitled to receive them. Exporters redact known credentials and common sensitive keys, but cannot infer every business-specific secret. Review business data before sharing an exported report.

## Protocol support

The client implements stateless per-request protocol metadata, HTTP header mirroring, JSON-RPC request/response identity validation, JSON and Fetch-readable SSE, timeout/cancellation, bounded pagination and memory-only caching. It never sends `initialize`, `notifications/initialized` or `Mcp-Session-Id`.

Implemented operations are `server/discover`, `tools/list`, `tools/call`, `resources/list`, `resources/templates/list`, `resources/read`, `prompts/list`, `prompts/get`, `completion/complete` and `subscriptions/listen`. Optional features are enabled from discovered capabilities. Missing optional tools/resources/prompts are not automatic protocol failures. Each request includes `MCP-Protocol-Version`, `MCP-Method` and required `_meta`; calls and reads include the applicable `MCP-Name`. Documented `x-mcp-header` schema fields are mirrored where supported by browser header rules.

Advanced extensions such as elicitation, tasks and MCP Apps are not negotiated unless implemented. Returned content is treated as data, never executable HTML or instructions. The app cannot use STDIO transports from a static browser environment. Legacy handshake protocols are outside its scope.

Schema validation supports JSON Schema 2020-12 (the default) and draft-07. Remote references are never fetched. Schemas exceeding bounded browser inspection limits or requiring unavailable references are reported as not tested rather than being treated as invalid server schemas. Tool output schemas are checked against the raw response before sensitive values are removed from display and exports.

See [the protocol notes](docs/PROTOCOL.md) and these references, checked during implementation on 2026-10-28:

- [Orionis MCP introduction](https://docs.orionis-framework.com/en/mcp/)
- [Orionis HTTP and clients](https://docs.orionis-framework.com/en/mcp/http-and-clients/)
- [Orionis advanced workflows](https://docs.orionis-framework.com/en/mcp/advanced-workflows/)
- [MCP 2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28)
- [MCP HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)

## CORS and browser limits

The **MCP server** must accept the origin `https://inspector.orionis-framework.com`. The browser automatically performs an OPTIONS preflight when required. The app cannot override preflight, force forbidden headers or read headers that CORS does not expose. It never uses `no-cors` or a CORS proxy.

An indicative server-side response policy is:

```http
Access-Control-Allow-Origin: https://inspector.orionis-framework.com
Vary: Origin
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Accept, Authorization, MCP-Protocol-Version, MCP-Method, MCP-Name, X-API-Key
Access-Control-Expose-Headers: Content-Type, MCP-Protocol-Version, MCP-Method, MCP-Name, Retry-After, Server-Timing
```

Apply that policy to preflight and actual responses, including authentication failures. Add each custom authentication or `x-mcp-header` name your endpoint accepts. Allow the exact development origin separately when testing locally. Do not copy a wildcard allowlist into an authenticated production service. This is illustrative HTTP configuration, not a claimed Orionis configuration API. Use your server framework's documented CORS middleware and Orionis origin validation together.

An opaque Fetch failure is shown as **“Possible CORS block or connectivity problem”** (or **“Posible bloqueo CORS o problema de conectividad”** in Spanish). It may instead mean DNS, TLS, mixed content, connectivity or browser access policy. Confirm CORS using browser developer tools and server logs. cURL exports are useful for comparing server behavior, but cURL does not enforce browser CORS. Hidden response headers are unknown, not absent. Latency includes browser, network, parsing and server work; it is not a server-only benchmark.

## Scoring and coverage

The weighted categories are Protocol Compliance (30%), Tools & Schemas (25%), Security (20%), Performance (15%) and AI Readiness (10%). The score is derived from evaluated evidence, with evaluated coverage reported separately. `Not Tested`, `Blocked` and `Not Applicable` do not become passes. A high score with incomplete evidence does not mean production readiness.

A numeric score requires successful discovery for the inspected run. If Fetch receives no response, the score is absent (`Not Verified`) with 0% server-evidence coverage. Client metadata/header checks remain visible as diagnostics but never award server-quality points. A configured HTTPS URL alone does not prove a successful TLS connection. HTTP authentication rejections may provide limited transport evidence, but do not unlock an MCP quality score. Manual disconnect retains previously verified evidence; a failed new connection or rerun cannot reuse the earlier score.

Quality labels are Excellent (90–100), Needs Improvement (75–89) and Critical (0–74). Production readiness is independently reported as Ready, Ready with Warnings, Not Ready or Not Verified. Critical findings block readiness; insufficient evidence yields Not Verified. Browser testing cannot establish complete authentication/authorization correctness, infrastructure security, server-side cancellation, rollback guarantees or session independence across every deployment path. Such limits must remain visible in test results and reports.

## Hermes configuration

The generator produces native YAML for `~/.hermes/config.yaml`, following the [Orionis client guide](https://docs.orionis-framework.com/en/mcp/http-and-clients/) and [Hermes MCP configuration reference](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/reference/mcp-config-reference.md):

```yaml
mcp_servers:
  ORIONIS_MCP:
    url: "https://your-server.example/mcp"
    protocol: stateless
    supports_parallel_tool_calls: false
```

The endpoint must be reachable from Hermes. Use a Hermes version supporting MCP `2026-07-28`, configure credentials locally, and run `/reload-mcp` after changing its configuration. The inspector does not include credentials in generated files. Parallel tool execution remains disabled in this conservative starting configuration; enabling it requires understanding each tool's effects.

## Deploy to GitHub Pages

1. Use this independent repository, `https://github.com/orionis-framework/mcp-inspector.git`. Push reviewed source changes and the lockfile to `master`. Keep it separate from the Astro documentation repository.
2. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
3. In **Settings → Pages → Custom domain**, save `inspector.orionis-framework.com`. Verify domain ownership at the account/organization level when applicable. The workflow verifies GitHub's configured Pages URL before deployment; a mismatch intentionally fails with an actionable message.
4. In your DNS provider, create a **CNAME** for `inspector` targeting **`orionis-framework.github.io`**. Do not include the repository name or a URL scheme in that DNS target.
5. Wait for GitHub's DNS check and certificate issuance, then enable **Enforce HTTPS** in Pages settings. The production URL must use HTTPS.
6. Push to `master` or manually run **Validate and deploy GitHub Pages**. The workflow installs locked dependencies, runs lint, typecheck, unit tests, a static production build and Playwright integrations, then uploads **only `dist/`** and deploys it with the official GitHub Pages actions.
7. Inspect the Actions deployment and `github-pages` environment result. Open the HTTPS custom domain, verify its certificate and assets, reload the root page, and test an MCP endpoint that explicitly permits the inspector origin. Check the Network panel for unexpected third-party requests and missing assets.

`public/CNAME` is copied to `dist/CNAME` as a domain declaration/reference. **It does not substitute for the custom-domain setting in GitHub Pages for Actions deployments.** Vite uses `base: '/'` for the domain root. There are no deep routes requiring rewrites. This configuration intentionally targets the custom domain rather than a repository subpath.

GitHub setup references: [custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [custom-domain management](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

Only `dist/` is uploaded to Pages. Dependencies, test reports, traces, local screenshots and coverage output are excluded from Git. Tests and build configuration remain in the repository because the deployment workflow requires them.

## Architecture and maintenance

```text
src/core/mcp          Browser transport and MCP contracts
src/core/validation   Schema checks, diagnostics and score calculation
src/core/testing      Safe test orchestration and progress
src/core/reporting    Sanitized local exports and Hermes configuration
src/components       React workspace panels
src/stores           Session state
src/i18n             Local English/Spanish presentation
src/editor           Localized, same-origin Monaco document
src/utils            Shared browser-safe helpers and redaction
tests                Controlled unit and integration tests
scripts              Build-time static artifact verification
.github/workflows    CI and GitHub Pages deployment
```

MCP network calls belong to the HTTP client and go directly to the configured endpoint. Bundled Monaco workers and application assets load from the same static origin. Exports use local Blob/download APIs; PDF creation dynamically loads a bundled browser module. No runtime API key belongs in a `VITE_*` variable: those values are public build output. See [Security](docs/SECURITY.md) for the trust model and the review surface when adding network features.

MIT licensed. Contributions should add tests for observable protocol behavior, preserve the static deployment, and distinguish confirmed failures from browser visibility limits. A future optional AI analysis adapter must be explicit, opt-in and separate from the deterministic rules; no LLM service is used by this version.
