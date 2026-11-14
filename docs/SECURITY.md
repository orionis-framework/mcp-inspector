# Browser security and data handling

## Trust boundary

The inspector is a public static client. MCP requests originate in the user's browser and go to the explicitly selected HTTP(S) endpoint. There is no inspector backend, shared proxy, remote model inference or credential vault. GitHub Pages serves files and does not execute MCP requests on the user's behalf. Ordinary visits load Google Analytics; visits containing `mcp` do not load or configure analytics, including empty or invalid parameters.

Server metadata, descriptions, schemas, result text, SSE messages and error messages are untrusted data. The UI renders data as text/JSON. Generated HTML reports escape server content and include a restrictive Content Security Policy; they do not embed executable payloads or fetch remote content. JSON Schema references do not cause arbitrary remote schema downloads. Network requests and redirects must remain under the client's endpoint policy.

## Credentials

- Authentication input belongs only in live session memory. No token belongs in localStorage, sessionStorage, IndexedDB, URLs, the repository or public Vite environment values.
- Configured authentication headers and known credential values are redacted before adding records to visible history and exports. Common secret-like keys in nested payloads are also redacted.
- HTTP cookies are omitted from MCP Fetch calls; endpoint changes create a new client scope. Redirects are rejected to avoid silently forwarding requests to another target.
- Disconnecting ends browser activity and releases the active connection state. Reloading discards in-memory history and credentials.
- Redaction cannot identify every sensitive business field. Users should inspect reports before sharing. The application cannot redact credentials that were never identified as credentials and appear under an innocuous field name.

Operational catalog names, schemas, URIs and opaque cursors remain exact in active
connection memory. Redacting substrings there would change valid MCP calls or
schema enums when a query value happens to match catalog data. Recorded traffic,
exports and evidence retained after disconnect are sanitized separately using the
connection's credentials and all endpoint query values. Catalogs are rendered as
data, never executed as page code; review business metadata before sharing.

## Endpoint links

`?mcp=` is read once before the UI mounts and uses the ordinary endpoint validator.
It only prefills the field: the user must select Connect, and can change the URL.
Absolute HTTP(S), ports, loopback and private addresses are supported; userinfo,
fragments and other schemes are rejected. No backend request is performed, so this
feature introduces no server-side SSRF executor. Browser CORS and local-network
policies remain authoritative.

The outer query is decoded once. Use `encodeURIComponent(endpoint)` for nested
query strings. The parameter survives reload and language changes but is excluded
from canonical/social metadata. The page's `no-referrer` policy prevents navigation
referrer leakage, and the analytics loader returns before importing any third-party
code when `mcp` is present. A shared URL still belongs to browser history and may
reach static hosting logs; authentication should be entered in the session UI.

## Safe execution

Safe automated runs inspect discovery, catalogs and declared schemas. They do not invoke tools indiscriminately. `readOnlyHint` and other annotations come from the server and do not constitute a security guarantee. Manual operations show their destination; potentially destructive tools require confirmation.

Optional authentication probes require explicit user selection. They must be limited to discovery and never reuse a real credential as an “invalid” token. This application is not a penetration-testing or load-testing platform. Concurrency and response/pagination limits bound browser work. Aborting an HTTP stream closes the client request; a server might already have performed a side effect, so cancellation is not a rollback guarantee.

## CORS, local networks and response visibility

Browser enforcement is authoritative. Do not add `mode: no-cors`, public CORS proxies or browser-security bypass instructions. A failed Fetch alone cannot establish that CORS is the cause. DNS, TLS, offline state, mixed content and local network permissions can present similarly. The app reports this uncertainty and exposes an equivalent sanitized request for independent troubleshooting.

The browser performs OPTIONS preflights. JavaScript cannot reliably inspect their complete exchange. Only CORS-accessible response headers can be displayed. The absence of a header in the visible response is not proof that the server omitted it. Server logs and browser developer tools are required for stronger conclusions.

## Network audit surface

1. Static application HTML, scripts, styles, fonts and Monaco workers: the GitHub Pages origin.
2. MCP POST requests and their JSON/SSE response stream: the user's configured endpoint through the MCP transport.
3. Links to documentation: navigation initiated by the user; payloads are not appended to those links.
4. Google Analytics on ordinary visits only; no analytics code or request is loaded
   for a visit with the `mcp` query parameter.

There are no hidden `/api/*` routes, credential verification servers, external PDF generators or mandatory CDNs. Development-only Vite and Playwright processes are not production services. The build verifier checks for unresolved Node imports and internal API dependencies; integration tests exercise the compiled static app.

## Scoring limitations

Readiness is based on observed checks and coverage, not an audit certificate. Unknown or blocked tests remain unevaluated. Browser timing contains client and network effects. Heuristic AI Readiness suggestions are labeled separately from normative protocol violations. No score supersedes a critical finding.

## Reporting vulnerabilities

Do not include live tokens, production request bodies or personal data in public issues. Use the repository's private security reporting facility when its owner enables it; otherwise contact the repository owner through an appropriate private channel. The repository is maintained by the Orionis Framework organization.

Dependency policy: pnpm-workspace.yaml overrides DOMPurify to the patched 3.4.17+ release for editor/PDF transitive dependencies. Keep the lockfile and re-run pnpm audit --prod when updating. Monaco remote JSON Schema fetching is explicitly disabled, including untrusted document-level schema URLs.
