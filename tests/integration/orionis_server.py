"""Loopback test adapter around the real Orionis compiler, dispatcher and HTTP transport.

This is test infrastructure, not a production HTTP server. It does not import an
application's bootstrap, environment file, routes, secrets or business handlers.
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(sys.argv[1]).resolve()))

from orionis.container.container import Container
from orionis.http.adapters.request.asgi import ASGITransportAdapter
from orionis.http.adapters.response.asgi import ASGIResponseAdapter
from orionis.http.enums.interfaces import Interface
from orionis.http.request import Request
from orionis.mcp.config import McpConfig
from orionis.mcp.context import McpRequest
from orionis.mcp.exceptions import McpProtocolException
from orionis.mcp.protocol.metadata import CacheHint, PromptArgument, ToolAnnotations
from orionis.mcp.protocol.results import Completion, InputRequiredResult
from orionis.mcp.responses import McpResponse
from orionis.mcp.server.compiler import compile_server
from orionis.mcp.server.primitives import Prompt, Resource, Server, Tool
from orionis.mcp.subscriptions.event_bus import InMemoryMcpEventBus
from orionis.mcp.transport.http import McpHttpTransport
from orionis.schemas import Schema
from orionis.schemas.fields import Field
from orionis.schemas.metadata import ExtraJsonSchema


class EchoInput(Schema):
    text: Field[str, ExtraJsonSchema({"x-mcp-header": "Text"})]


class Echo(Tool[EchoInput, list[str]]):
    name = "echo"
    description = "Return the supplied text as a structured array."
    annotations = ToolAnnotations(read_only=True, destructive=False)

    async def handle(self, payload: EchoInput):
        return McpResponse.structured([payload.text])


class RegionInput(Schema):
    region: Literal["eu", "us"]


class Region(Tool[RegionInput, list[str]]):
    name = "eu"

    async def handle(self, payload: RegionInput):
        return McpResponse.structured([payload.region])


class NotFound(Tool):
    name = "not-found"

    async def handle(self):
        raise McpProtocolException(-32601, "Method not found", status=404)


class Deferred(Tool):
    name = "deferred"

    async def handle(self):
        return InputRequiredResult(requestState="fixture-continuation")


class Stream(Tool):
    name = "stream"

    async def handle(self):
        yield McpResponse.progress(1, 2)
        yield McpResponse.progress(2, 2)
        yield McpResponse.text("finished")


class Slow(Tool):
    name = "slow"

    async def handle(self):
        yield McpResponse.progress(0, 1)
        await asyncio.sleep(30)
        yield McpResponse.text("finished")


class Guide(Resource):
    name = "guide"
    uri = "docs://guide"
    cache = CacheHint(ttl_ms=60000, scope="private")

    async def handle(self):
        return McpResponse.text("Orionis integration guide")


class Profile(Resource):
    name = "profile"
    uri_template = "users://{user_id}/profile"

    async def handle(self, request: McpRequest):
        return McpResponse.text(request.params["user_id"])

    async def complete(self):
        return Completion(values=("42", "43"))


class Describe(Prompt):
    name = "describe"
    arguments = (PromptArgument(name="tone", required=True),)

    async def handle(self, tone: str):
        return [McpResponse.text("Explain").asAssistant(), McpResponse.text(tone)]

    async def complete(self):
        return Completion(values=("formal", "friendly"))


class FixtureServer(Server):
    name = "Orionis real transport fixture"
    tools = (Deferred, Echo, Region, NotFound, Stream, Slow)
    resources = (Guide, Profile)
    prompts = (Describe,)
    list_changed = True
    resource_subscriptions = True


class FixtureContainer(Container):
    pass


async def main():
    bus = InMemoryMcpEventBus()
    app = FixtureContainer()
    transport = McpHttpTransport(
        app,
        compile_server(FixtureServer),
        McpConfig(default_page_size=1, allowed_origins=["http://127.0.0.1:4173"]),
        bus,
    )

    async def handle(reader, writer):
        try:
            header_bytes = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), 5)
            lines = header_bytes.decode("latin-1").split("\r\n")
            method, target, _ = lines[0].split(" ", 2)
            headers = [tuple(line.split(":", 1)) for line in lines[1:] if line]
            fields = {key.lower(): value.strip() for key, value in headers}
            body = await reader.readexactly(int(fields.get("content-length", "0")))
            url = urlsplit(target)

            # Explicit test-control routes never participate in MCP dispatch.
            if url.path == "/__publish":
                await bus.publish(FixtureServer, "notifications/resources/updated", "docs://guide")
                writer.write(b"HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n")
                await writer.drain()
                return
            if url.path == "/__finish":
                await bus.shutdown()
                writer.write(b"HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n")
                await writer.drain()
                return

            consumed = False

            async def receive():
                nonlocal consumed
                if not consumed:
                    consumed = True
                    return {"type": "http.request", "body": body, "more_body": False}
                await reader.read()
                return {"type": "http.disconnect"}

            adapter = ASGITransportAdapter({
                "type": "http",
                "method": method,
                "path": url.path,
                "scheme": "http",
                "query_string": url.query.encode(),
                "http_version": "1.1",
                "headers": [(key.lower().encode(), value.strip().encode("latin-1")) for key, value in headers],
            })
            request = Request(Interface.ASGI, adapter, receive_or_protocol=receive)

            async def send(message):
                if message["type"] == "http.response.start":
                    writer.write(f"HTTP/1.1 {message['status']} Response\r\n".encode())
                    for name, value in message["headers"]:
                        writer.write(name + b": " + value + b"\r\n")
                    writer.write(b"Connection: close\r\n\r\n")
                else:
                    writer.write(message.get("body", b""))
                await writer.drain()

            async with app.beginScope():
                response = await transport.handle(request)
                await ASGIResponseAdapter().send(adapter, response, receive, send)
        except (ConnectionError, asyncio.IncompleteReadError):
            pass
        finally:
            writer.close()
            await writer.wait_closed()

    server = await asyncio.start_server(handle, "127.0.0.1", 0)
    port = server.sockets[0].getsockname()[1]
    print(json.dumps({"endpoint": f"http://127.0.0.1:{port}/nested/mcp"}), flush=True)
    async with server:
        await server.serve_forever()


asyncio.run(main())
