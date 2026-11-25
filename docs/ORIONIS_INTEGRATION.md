# Integration with the real Orionis implementation

The optional integration suite exercises the Inspector's production `McpClient`
against an installed Orionis Framework package or a source checkout. MCP
responses are not mocked. The fixture compiles its own harmless tools, resources
and prompts using `compile_server`, dispatches requests through
`McpHttpTransport` and the real dispatcher, and serializes native responses with
`ASGIResponseAdapter`. Native container scopes remain open for each response,
including streams.

The fixture binds only `127.0.0.1` on an ephemeral port. Its small HTTP adapter is
test infrastructure; it is not a production server. It never loads an Orionis
application's bootstrap, `.env`, routes, credentials or business handlers.

## Run

Install this repository's locked Node dependencies. To test the published release,
create a Python 3.14 environment with Orionis 1.9.0 and set `ORIONIS_PYTHON`
to its executable. Leave `ORIONIS_FRAMEWORK_PATH` unset in this mode.

```sh
uv venv --python 3.14 .venv
uv pip install --python .venv 'orionis==1.9.0'
ORIONIS_PYTHON="$PWD/.venv/bin/python" pnpm test:orionis
```

```powershell
uv venv --python 3.14 .venv
uv pip install --python .venv 'orionis==1.9.0'
$env:ORIONIS_PYTHON = (Resolve-Path .venv/Scripts/python.exe).Path
pnpm test:orionis
```

For a source checkout, set `ORIONIS_FRAMEWORK_PATH`. The fixture imports that
checkout and uses its project's interpreter unless `ORIONIS_PYTHON` is also set.
With both variables unset, `pnpm test:orionis` uses the sibling `../framework`
checkout and its `.venv`.

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

The integration tests cover the following behaviors.

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
- Tool execution errors, invalid parameters and native JSON-RPC errors carried by
  HTTP 404 (`-32601`) and HTTP 503 (`-32603`).
- A real Orionis Origin-policy rejection reported as HTTP 403.
- Native SSE progress notifications and a final tool response.
- Cancellation of a running SSE request followed by a successful new request,
  with no unhandled rejection.
- Subscription acknowledgment, resource-change delivery, cache invalidation and
  graceful stream completion from the native event bus.

The test-control routes `/__publish` and `/__finish` only drive event-bus changes
and shutdown in this loopback fixture. They are not MCP methods or production
features.

The suite passed with Python 3.14.6 and the Orionis 1.9.0 distribution from PyPI.

## Browser check with the published Slim MCP skeleton

The release check also used Chrome with the built Inspector and a separate
application created by `orionis-installer==1.1.0` from `slim_mcp_1.x`. The
skeleton served its standard `/mcp` route. With the local Inspector origin in
`CORS_ALLOW_ORIGINS`, Chrome discovered the server and its catalogs, executed
`echo`, read `docs://example/guide` and retrieved `greeting` with its default
style. All eight MCP POSTs returned HTTP 200.

## Boundaries

The automated transport suite uses Node Fetch. The browser check exercises CORS
on loopback, and the Playwright suite covers the interface with controlled
fixtures. Production TLS, deployment availability and reverse proxies require
verification in the target environment.
