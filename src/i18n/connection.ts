export const connectionEs: Record<string, string> = {
  "HTTP 404: endpoint path not found. An HTTP service responded; check the MCP URL and route.":
    "HTTP 404: no se encontró la ruta del endpoint. Un servicio HTTP respondió; revisa la URL y la ruta MCP.",
  "HTTP 410: this endpoint is no longer available. Check the current MCP URL.":
    "HTTP 410: este endpoint ya no está disponible. Revisa la URL MCP actual.",
  "HTTP 405: this endpoint does not allow POST. Check the MCP route and transport.":
    "HTTP 405: este endpoint no permite POST. Revisa la ruta y el transporte MCP.",
  "HTTP {status}: the server or gateway failed to handle the request. MCP validity could not be verified.":
    "HTTP {status}: el servidor o gateway no pudo procesar la solicitud. No se pudo verificar la validez del MCP.",
  "HTTP {status}: the endpoint rejected the request. Inspect the response and endpoint configuration.":
    "HTTP {status}: el endpoint rechazó la solicitud. Revisa la respuesta y la configuración del endpoint.",
  "HTTP {status}: the response contains a FortiGuard network restriction page. Ask the network administrator to review access to this endpoint; MCP validity could not be verified.":
    "HTTP {status}: la respuesta contiene una página de restricción de red de FortiGuard. Solicita al administrador de red que revise el acceso a este endpoint; no se pudo verificar la validez del MCP.",
  "HTTP {status}: not a valid MCP response. Expected application/json or text/event-stream; received {contentType}.":
    "HTTP {status}: la respuesta no es MCP válida. Se esperaba application/json o text/event-stream; se recibió {contentType}.",
  "Not a valid MCP response: the response body is not valid JSON.":
    "La respuesta no es MCP válida: el cuerpo no es JSON válido.",
  "Not a valid MCP response: expected a JSON-RPC 2.0 envelope with one result or error.":
    "La respuesta no es MCP válida: se esperaba un mensaje JSON-RPC 2.0 con un único resultado o error.",
  "Not a valid MCP discovery response: supportedVersions and capabilities are required.":
    "La respuesta de descubrimiento MCP no es válida: se requieren supportedVersions y capabilities.",
  "No accessible HTTP response. The browser cannot distinguish DNS, TLS certificate, firewall, CORS, mixed content or redirect failures. Check the browser network panel or analyze terminal output; MCP validity and endpoint existence are unverified.":
    "No se pudo obtener una respuesta HTTP. El navegador no puede distinguir fallos de DNS, certificado TLS, firewall, CORS, contenido mixto o redirecciones. Revisa el panel de red del navegador o analiza la salida de terminal; no se verificaron la validez del MCP ni la existencia del endpoint.",
  "HTTP {status}: the connection was interrupted while reading the response. MCP validity could not be verified.":
    "HTTP {status}: la conexión se interrumpió al leer la respuesta. No se pudo verificar la validez del MCP.",
  "Connection diagnostics": "Diagnóstico de conexión",
  "No accessible HTTP response": "No se pudo obtener una respuesta HTTP",
  "HTTP response received": "Respuesta HTTP recibida",
  "Review browser access and CORS": "Revisar el acceso desde el navegador y CORS",
  "The browser did not expose an HTTP response. DNS, TLS certificates, firewall restrictions, CORS, mixed content or redirects may prevent access. This does not prove a CORS problem, a 404 or an invalid MCP server. Use the terminal check below to gather evidence.":
    "El navegador no expuso una respuesta HTTP. DNS, certificados TLS, restricciones del firewall, CORS, contenido mixto o redirecciones pueden impedir el acceso. Esto no demuestra un problema de CORS, un 404 ni un servidor MCP inválido. Usa la comprobación de terminal para obtener evidencia.",
  "An HTTP response is available. Its status, content type and JSON-RPC discovery result are checked before MCP catalog tests. An HTTP response alone does not establish a valid MCP server.":
    "Hay una respuesta HTTP disponible. Se comprueban su estado, tipo de contenido y resultado de descubrimiento JSON-RPC antes de probar los catálogos MCP. Una respuesta HTTP por sí sola no confirma un servidor MCP válido.",
  "A 404 means the requested route was not found on a responding server. A hostname that cannot be resolved is a DNS failure, not an HTTP 404.":
    "Un 404 significa que no se encontró la ruta solicitada en un servidor que respondió. Un nombre de host que no se puede resolver es un fallo de DNS, no un HTTP 404.",
  "HTTP 200 and Allow: OPTIONS, POST are not sufficient for CORS. The response must include the Access-Control-Allow-* headers shown here.":
    "HTTP 200 y Allow: OPTIONS, POST no son suficientes para CORS. La respuesta debe incluir las cabeceras Access-Control-Allow-* indicadas aquí.",
  "Checking HTTP response and MCP discovery…": "Comprobando la respuesta HTTP y el descubrimiento MCP…",
  "Inspect the browser network panel and terminal diagnostics for DNS, TLS certificates, network restrictions and CORS. The failure alone does not establish the cause.":
    "Revisa el panel de red del navegador y el diagnóstico de terminal para comprobar DNS, certificados TLS, restricciones de red y CORS. El fallo por sí solo no establece la causa.",
  "Copy PowerShell command": "Copiar comando de PowerShell",
  "Command copied.": "Comando copiado.",
  "Copy failed. Select and copy the command manually.": "No se pudo copiar. Selecciona y copia el comando manualmente.",
  "Command for macOS / Linux": "Comando para macOS / Linux",
};
