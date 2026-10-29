# Protocol implementation notes

Contract reviewed on 2026-10-28 against:

- [MCP 2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28)
- [Base protocol and JSON Schema dialects](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [HTTP binding and header encoding](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)
- [Completions](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/completion)
- [Orionis MCP](https://docs.orionis-framework.com/en/mcp/)
- [Orionis HTTP and clients](https://docs.orionis-framework.com/en/mcp/http-and-clients/)
- [Orionis advanced workflows](https://docs.orionis-framework.com/en/mcp/advanced-workflows/)

## Stateless requests

`McpClient` has no server session. Each operation sends one POST directly to the selected endpoint, including the protocol revision, client identity and an empty client-capabilities object in `params._meta`. Method, version and selected name/URI are mirrored in the HTTP headers. No `initialize`, session header, legacy negotiation, GET stream or protocol cancellation notification is emitted.

The client advertises no elicitation, sampling, roots or third-party extensions. An `input_required` result is displayed as evidence and never automatically retried. It does not imply successful execution. Legacy servers are not automatically negotiated. Missing `resultType` is accepted under the specification's compatibility rule; validation can still identify missing modern fields.

## Method mapping

| Operation | Parameters | Result data |
| --- | --- | --- |
| `server/discover` | standard metadata | `supportedVersions`, `capabilities`, `_meta` identity |
| `tools/list` | optional `cursor` | `tools`, optional `nextCursor` |
| `tools/call` | `name`, `arguments` | `content`, `structuredContent`, `isError` |
| `resources/list` | optional `cursor` | `resources` |
| `resources/templates/list` | optional `cursor` | `resourceTemplates` |
| `resources/read` | `uri` | `contents` |
| `prompts/list` | optional `cursor` | `prompts` |
| `prompts/get` | `name`, string-valued `arguments` | `messages` |
| `completion/complete` | `ref`, `argument`, optional `context.arguments` | `completion` |
| `subscriptions/listen` | explicit `notifications` filter | SSE notifications, optional final result |

The safe suite calls discovery and declared catalog methods. It does not call tools, read arbitrary resources, obtain prompts or open indefinite subscriptions. Optional capabilities are not mandatory conformance requirements.

## HTTP and browser evidence

Configured request headers are distinct from response headers exposed through Fetch. Browser-added headers, OPTIONS exchanges, TLS and TCP details are not available to this client. The browser performs any necessary preflight. A rejected Fetch without an exposed response is classified as an unverified connection failure, never proof of CORS, a nonexistent host, a network restriction or an MCP server defect.

Discovery is the first read-only protocol request. Exposed HTTP statuses are evaluated separately from media type and MCP response validity: a 404 identifies a missing route, while a successful HTML response does not establish an MCP endpoint. Missing unexposed headers are not grounds for rejecting an otherwise valid server. No GET or HEAD probe is substituted for discovery, since a valid MCP POST endpoint may not support either method.

The connection help accepts terminal output as separate, user-supplied diagnostic evidence. A certificate trust error such as `SEC_E_UNTRUSTED_ROOT` does not establish CORS or firewall blocking. A block page explicitly naming a network filter can identify a network restriction. A successful OPTIONS response must still include the required `Access-Control-Allow-*` headers; `Allow` is not CORS permission. Terminal evidence is processed locally and never upgrades server verification or quality scores.

The copyable Orionis `.env` example configures explicit `CORS_ALLOW_ORIGINS`, `CORS_ALLOW_METHODS` and request `CORS_ALLOW_HEADERS`. Standard `config/mcp.py` Origin validation and `config/http.py` CORS both read the origin variable, but enforce distinct parts of the browser-access policy. Existing environment values override Python fallbacks, and the application must restart to load changed configuration.

`fetch` uses CORS mode, omits ambient cookies, rejects redirects and sends no referrer. Redirects therefore cannot forward credentials to another origin. Credentials in URL userinfo and manually overridden protocol/browser headers are rejected. Authentication headers and their known values are removed from recorded payloads and returned display data. No proxy, analytics, remote JSON Schema resolution or external runtime loader is used.

## Streams, cancellation and bounds

Finite JSON and request-scoped SSE are supported. The parser handles fragmented UTF-8 data, line-ending boundaries, comments and multi-line data events. Notifications and final responses are recorded; server-initiated JSON-RPC requests are rejected. A stream ending without a final response is incomplete evidence, not success. Subscription notifications require matching subscription IDs, an initial acknowledgment and an explicitly requested event type.

AbortController cancels Fetch and body reading. HTTP cancellation does not guarantee a server rolled back business effects. Requests are never automatically replayed. The default finite timeout is 15 seconds. Subscriptions have no automatic timeout by default and must be cancelled explicitly. Inspection is bounded at 5 MB per response/stream, 500 retained events, 500 retained request records, 100 catalog pages and 10,000 catalog entries. Limits produce visible errors.

## Header annotations

`x-mcp-header` is validated before a tool becomes executable. Annotated fields must be statically reachable through `properties`, have a unique token name and use string, integer or boolean types. Number fields, array/composition paths and unsafe integers are rejected. Invalid tools are excluded from execution and retained in `rejectedTools` and catalog response evidence. Exact nested values are mirrored as `Mcp-Param-*`; absent/null values are omitted. Non-ASCII, control characters, surrounding whitespace and sentinel-like values use the specified UTF-8 Base64 sentinel representation.

## Cache isolation

Only documented cacheable methods with valid positive `ttlMs` and a declared cache scope are cached. Each client instance owns its endpoint and authentication context; private results never cross instances. Keys include method and parameters, and each page is cached independently. Continuation results and requests with continuation fields are not cached. Change notifications invalidate the cache, and safe tests explicitly bypass it. Cache use is labeled in request history and excluded from network latency evidence.

## Deliberate limits

This is a browser inspector, not a certification authority. It cannot prove Origin validation, authentication policy, session independence across server workers, rollback semantics, TLS configuration or denial-of-service resilience. Observed requests demonstrate only their own behavior. It supports the documented modern core operations and does not implement OAuth acquisition, STDIO, MRTR interaction handlers, extension-specific contracts or automatic retries. Authentication may be supplied as temporary headers in memory.
