export const workspaceEs: Record<string, string> = {
  "MCP Explorer": "Explorador MCP",
  EXPLORER: "EXPLORADOR",
  "Filter explorer": "Filtrar explorador",
  "Find a capability…": "Buscar una capacidad…",
  Server: "Servidor",
  Overview: "Resumen",
  Capabilities: "Capacidades",
  Tools: "Herramientas",
  "No tools discovered": "No se han descubierto herramientas",
  Resources: "Recursos",
  "Resource Templates": "Plantillas de recursos",
  Prompts: "Prompts",
  Completions: "Autocompletado",
  Subscriptions: "Suscripciones",
  Diagnostics: "Diagnósticos",
  Protocol: "Protocolo",
  Schemas: "Esquemas",
  Security: "Seguridad",
  Performance: "Rendimiento",
  "AI Readiness": "Preparación para IA",
  History: "Historial",
  "Browser-only workspace": "Espacio de trabajo en el navegador",
  "Requests go directly to your endpoint.":
    "Las solicitudes van directamente a tu endpoint.",
  "Request Inspector": "Inspector de solicitudes",
  "Select request": "Seleccionar solicitud",
  "Choose a request": "Elige una solicitud",
  "Collapse console": "Contraer consola",
  Request: "Solicitud",
  Response: "Respuesta",
  Headers: "Encabezados",
  Timeline: "Cronología",
  Logs: "Registros",
  "Download request": "Descargar solicitud",
  "{type} copied (redacted)": "{type} copiado (datos sensibles ocultos)",
  "Clipboard unavailable. Download the request instead.":
    "El portapapeles no está disponible. Descarga la solicitud.",
  "The browser controls preflight, Origin and transport headers. Unexposed response headers are unavailable.":
    "El navegador controla el preflight, Origin y los headers de transporte. Los headers de respuesta no expuestos no están disponibles.",
  "Cache hit": "Respuesta de caché",
  "Response recorded": "Respuesta registrada",
  "// Your requests, responses and events will appear here.\n// Connect an MCP endpoint to begin.":
    "// Tus solicitudes, respuestas y eventos aparecerán aquí.\n// Conecta un endpoint MCP para comenzar.",
  network: "red",
  authentication: "autenticación",
  timeout: "tiempo agotado",
  cancelled: "cancelada",
  protocol: "protocolo",
  validation: "validación",
  "YOUR MCP WORKSPACE": "TU ESPACIO DE TRABAJO MCP",
  "Server overview": "Resumen del servidor",
  "Clarity for every connection.": "Claridad en cada conexión.",
  "Inspect capabilities. Verify contracts. Understand every response.":
    "Inspecciona capacidades. Verifica contratos. Comprende cada respuesta.",
  "Connect your MCP server and turn protocol traffic into actionable insight.":
    "Conecta tu servidor MCP y convierte el tráfico del protocolo en información útil.",
  Connected: "Conectado",
  "Awaiting connection": "Esperando conexión",
  "MCP 2026-07-28 · STATELESS": "MCP 2026-07-28 · SIN ESTADO",
  "Your server.": "Tu servidor.",
  "Understood.": "Sin dudas.",
  "Explore tools, validate schemas and inspect requests in one focused workspace. Everything runs in your browser.":
    "Explora herramientas, valida esquemas e inspecciona solicitudes en un solo lugar. Todo funciona en tu navegador.",
  "No backend": "Sin backend",
  "No proxy": "Sin proxy",
  "Local reports": "Reportes locales",
  "Enter your endpoint above to get started":
    "Introduce tu endpoint arriba para comenzar",
  PROTOCOL: "PROTOCOLO",
  "Stateless by design": "Sin estado por diseño",
  "Self-contained requests with per-request version and capability metadata.":
    "Solicitudes independientes con metadata de versión y capacidades en cada petición.",
  "Inspect capabilities": "Inspeccionar capacidades",
  "PRODUCTION READINESS": "PREPARACIÓN PARA PRODUCCIÓN",
  "{evaluated} of {applicable} applicable checks evaluated.":
    "{evaluated} de {applicable} comprobaciones aplicables evaluadas.",
  "Readiness is based on collected evidence. Untested checks never count as passed.":
    "La preparación se basa en evidencia recopilada. Las comprobaciones no ejecutadas nunca cuentan como aprobadas.",
  "Review evidence": "Revisar evidencia",
  "OBSERVED PERFORMANCE": "RENDIMIENTO OBSERVADO",
  "Request latency": "Latencia de solicitudes",
  "Round trip": "Ida y vuelta",
  "Latency data appears after your first request.":
    "Los datos de latencia aparecerán después de tu primera solicitud.",
  "Browser round trip includes network, preflight and server work.":
    "El tiempo de ida y vuelta incluye red, preflight y trabajo del servidor.",
  "{errors} errors · {timeouts} timeouts · {cancelled} cancellations.":
    "{errors} errores · {timeouts} tiempos agotados · {cancelled} cancelaciones.",
  "Server connection requirements": "Requisitos de conexión del servidor",
  "Use an HTTP(S) endpoint that supports MCP 2026-07-28 and permits this origin through CORS.":
    "Usa un endpoint HTTP(S) compatible con MCP 2026-07-28 que permita este origen mediante CORS.",
  "Read guide": "Leer guía",
  "Close dialog": "Cerrar diálogo",
  "Possible CORS block or connectivity problem":
    "Posible bloqueo CORS o problema de conectividad",
  "Fetch cannot confirm the cause. Check DNS, TLS, connectivity, mixed content, redirects and the browser network console. The inspector rejects redirects to avoid forwarding credentials. A network error does not establish an MCP server defect.":
    "Fetch no permite confirmar la causa. Revisa DNS, TLS, conectividad, contenido mixto, redirecciones y la consola de red del navegador. El inspector rechaza redirecciones para no reenviar credenciales. Un error de red no demuestra un fallo del servidor MCP.",
  "Current inspector origin:": "Origen actual del inspector:",
  "The server policy must allow this exact origin.":
    "La política del servidor debe permitir este origen exacto.",
  "For public deployment, also allow":
    "Para el despliegue público, permite también",
  "in the server's origin allowlist. Return a single allowed origin in Access-Control-Allow-Origin, never a list.":
    "en la lista de orígenes autorizados del servidor. Responde con un solo origen permitido en Access-Control-Allow-Origin, nunca con una lista.",
  "The browser automatically sends OPTIONS before POST because the request uses JSON and MCP headers. The preflight must return a 2xx status and allow the origin, POST and requested headers. Rejected OPTIONS or a missing Access-Control-Allow-Origin prevents the browser from sending POST. The POST response also needs Access-Control-Allow-Origin.":
    "El navegador envía OPTIONS automáticamente antes del POST porque se usan JSON y headers MCP. El preflight debe responder con estado 2xx y permitir el origen, POST y los headers solicitados. Un OPTIONS rechazado o sin Access-Control-Allow-Origin impide que el navegador envíe el POST. La respuesta POST también necesita Access-Control-Allow-Origin.",
  "Illustrative MCP server configuration using this request's header names. OPTIONS must respond before requiring POST credentials. For tools, also allow their x-mcp-header mappings. Preflight details and unexposed headers are unavailable to this application.":
    "Configuración orientativa para el servidor MCP con los nombres de headers de esta solicitud. OPTIONS debe responder antes de exigir las credenciales del POST. Para herramientas, autoriza también sus mappings x-mcp-header. Los detalles del preflight y los headers no expuestos no están disponibles para esta aplicación.",
  "Check the preflight from a terminal":
    "Comprobar el preflight desde una terminal",
  "Inspect that response's status and Access-Control-Allow-* headers. This command sends no credentials and executes no MCP operation. A successful POST with cURL does not confirm browser access: cURL does not enforce CORS.":
    "Revisa el estado y los headers Access-Control-Allow-* de esa respuesta. Este comando no envía credenciales ni ejecuta una operación MCP. Que el POST funcione con cURL no confirma acceso desde el navegador: cURL no aplica CORS.",
  "Equivalent POST request": "Solicitud POST equivalente",
  "Export request": "Exportar solicitud",
};
