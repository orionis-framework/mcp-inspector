# Integration with the real Orionis implementation

The optional integration suite exercises the Inspector's production `McpClient`
against Python code imported directly from an Orionis Framework checkout. MCP
responses are not mocked. The fixture compiles its own harmless tools, resources
and prompts using `compile_server`, dispatches requests through
`McpHttpTransport` and the real dispatcher, and serializes native responses with
`ASGIResponseAdapter`. Native container scopes remain open for each response,
including streams.

The fixture binds only `127.0.0.1` on an ephemeral port. Its small HTTP adapter is
test infrastructure; it is not a production server. It never loads an Orionis
application's bootstrap, `.env`, routes, credentials or business handlers.

## Run

Install this repository's locked Node dependencies and provision an Orionis
Framework checkout with its Python 3.14 environment and dependencies. By default,
the suite uses the sibling `../framework` checkout and its `.venv` interpreter.

```sh
pnpm test:orionis
```

For another checkout or interpreter, set `ORIONIS_FRAMEWORK_PATH` and
`ORIONIS_PYTHON`. The latter is the full path to a Python executable with Orionis's
dependencies installed; source imports still come from the selected checkout.

```powershell
$env:ORIONIS_FRAMEWORK_PATH = 'D:\path\to\framework'
$env:ORIONIS_PYTHON = 'D:\path\to\framework\.venv\Scripts\python.exe'
pnpm test:orionis
```

```sh
ORIONIS_FRAMEWORK_PATH=/path/to/framework \
ORIONIS_PYTHON=/path/to/framework/.venv/bin/python \
pnpm test:orionis
```

Missing prerequisites fail explicitly. The suite is separate from `pnpm test`
so the static application's normal CI does not silently depend on a sibling
checkout. A CI job that provisions both repositories can invoke the same command.
The child server is terminated after the suite; Python bytecode generation is
disabled so verification leaves the framework checkout untouched.

## Verified behavior

The twelve integration tests cover:

- Stateless discovery, server metadata, advertised capabilities and native
  multi-page tool discovery.
- UTF-8 `x-mcp-header` mirroring, named request headers and structured array output.
- Operational tool names and enum values that also occur in an endpoint query,
  while recorded URLs remain redacted.
- Resource discovery, URI templates, reads and server-provided cache hints.
- Prompt arguments and roles, and prompt/resource completions.
- Explicitly empty required prompt arguments accepted by Orionis, distinguished
  from omitted arguments that produce a protocol error.
- Native MRTR `requestState` responses retained as incomplete results, without
  automatic replay or completed-output validation.
- Tool execution errors, JSON-RPC invalid-parameter errors and an explicit
  JSON-RPC `-32601` response carried by HTTP 404.
- A real Orionis Origin-policy rejection reported as HTTP 403.
- Native SSE progress notifications and a final tool response.
- Cancellation of a running SSE request followed by a successful new request,
  with no unhandled rejection.
- Subscription acknowledgment, resource-change delivery, cache invalidation and
  graceful stream completion from the native event bus.

The test-control routes `/__publish` and `/__finish` only drive event-bus changes
and shutdown in this loopback fixture. They are not MCP methods or production
features.

Executed successfully during the 2026-11-14 audit against Framework commit
`1e905f4f103d47c61789d877eba472a5bd97681b` using Python 3.14.6: **12 tests passed**.

## Boundaries

This suite uses real HTTP traffic from Node Fetch. It does not prove browser
CORS, production TLS, application authentication middleware, reverse-proxy
configuration, deployment availability or STDIO compatibility. Browser behavior
is covered separately by Playwright's controlled fixtures. Production deployment
verification must be reported separately from these local results.
