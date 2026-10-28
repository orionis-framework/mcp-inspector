/** Spanish presentation copy for inspector-owned diagnostics. Protocol data is never translated. */
export const diagnosticsEs: Record<string, string> = {
  Passed: "Aprobada",
  Failed: "Fallida",
  Warning: "Advertencia",
  "Not Applicable": "No aplica",
  "Not Tested": "Sin probar",
  Blocked: "Bloqueada",
  Running: "En ejecución",
  Excellent: "Excelente",
  "Needs Improvement": "Necesita mejoras",
  Critical: "Crítico",
  "Not Verified": "Sin verificar",
  Ready: "Listo",
  "Ready with Warnings": "Listo con advertencias",
  "Not Ready": "No listo",
  critical: "crítico",
  error: "error",
  warning: "advertencia",
  info: "información",
  protocol: "protocolo",
  tools: "herramientas",
  security: "seguridad",
  performance: "rendimiento",
  ai: "preparación para IA",
  server: "servidor",
  client: "cliente",
  network: "red",
  authentication: "autenticación",
  timeout: "tiempo agotado",
  cancelled: "cancelado",
  validation: "validación",
  http: "HTTP",
  "Evidence & recommendation": "Evidencia y recomendación",
  "Protocol reference": "Referencia del protocolo",
  "Heuristic · advisory": "Heurística · orientación",
  VALIDATION: "VALIDACIÓN",
  "EVIDENCE, NOT ASSUMPTIONS": "EVIDENCIA, SIN SUPOSICIONES",
  "Know what to improve.": "Identifica qué mejorar.",
  "Protocol checks and clearly marked quality recommendations.":
    "Comprobaciones del protocolo y recomendaciones de calidad claramente identificadas.",
  "No findings for this selection": "Sin hallazgos para esta selección",
  "Awaiting an inspection": "Esperando una inspección",
  "Open Diagnostics to review coverage and untested checks.":
    "Abre Diagnósticos para revisar la cobertura y las comprobaciones pendientes.",
  "Connect a server to start collecting real evidence.":
    "Conecta un servidor para recopilar evidencia real.",
  "Credentials stay in memory. Logs and exports redact sensitive fields.":
    "Las credenciales permanecen en memoria. Los registros y las exportaciones ocultan los campos sensibles.",
  "Safe test progress": "Progreso de las pruebas seguras",
  "SAFE INSPECTION · SEQUENTIAL REQUESTS":
    "INSPECCIÓN SEGURA · SOLICITUDES SECUENCIALES",
  "Connectivity and discovery": "Conectividad y descubrimiento",
  "Tools listing": "Listado de herramientas",
  "Resources listing": "Listado de recursos",
  "Resource templates listing": "Listado de plantillas de recursos",
  "Prompts listing": "Listado de prompts",
  "Waiting to run.": "Esperando la ejecución.",
  "Waiting for capabilities.": "Esperando las capacidades.",
  "The server does not advertise this optional capability.":
    "El servidor no declara esta capacidad opcional.",
  "Cancelled before this check ran.":
    "Cancelada antes de ejecutar esta comprobación.",
  "Running a read-only MCP request directly against the selected endpoint.":
    "Ejecutando una solicitud MCP de solo lectura directamente contra el endpoint seleccionado.",
  "The request completed and its result shape was accepted.":
    "La solicitud finalizó y se aceptó la estructura del resultado.",
  "Request failed.": "La solicitud falló.",
  "Inspect the request record for details.":
    "Consulta el registro de la solicitud para ver los detalles.",
  "No discovery capabilities available; capability-dependent checks were not executed.":
    "No hay capacidades de descubrimiento disponibles; no se ejecutaron las comprobaciones que dependen de ellas.",
  "Invalid parameter header mapping": "Mapeo inválido de parámetros a headers",
  "Correct x-mcp-header annotations. The client excludes this tool as required by the HTTP binding.":
    "Corrige las anotaciones x-mcp-header. El cliente excluye esta herramienta según lo exige el transporte HTTP.",
  "Explicit authorization is required for authentication probes.":
    "Se requiere autorización explícita para las pruebas de autenticación.",
  "Discovery succeeded. Public discovery may be intentional; this does not establish whether tools are protected.":
    "El descubrimiento se completó. Puede ser público intencionalmente; esto no demuestra si las herramientas están protegidas.",
  "Probe failed.": "La prueba falló.",
  "Verify the intended authorization policy for each operation. This result covers only discovery.":
    "Verifica la política de autorización prevista para cada operación. Este resultado solo cubre el descubrimiento.",
  "Protocol version": "Versión del protocolo",
  "Discovery has not completed.": "El descubrimiento no se ha completado.",
  "Advertise and implement the requested protocol revision.":
    "Declara e implementa la versión del protocolo solicitada.",
  "Self-contained request metadata": "Metadatos completos por solicitud",
  "Include protocolVersion and clientCapabilities metadata on every request.":
    "Incluye los metadatos protocolVersion y clientCapabilities en cada solicitud.",
  "Configured HTTP headers": "Headers HTTP configurados",
  "Checks client-configured headers, not a packet capture or browser-managed headers.":
    "Comprueba los headers configurados por el cliente; no una captura de paquetes ni los headers gestionados por el navegador.",
  "Mirror metadata and method headers; accept JSON and SSE.":
    "Haz coincidir los metadatos y los headers de método; acepta JSON y SSE.",
  "JSON-RPC envelopes and identifiers":
    "Estructuras e identificadores JSON-RPC",
  "Return one result or error with the matching request ID.":
    "Devuelve un resultado o error con el ID de la solicitud correspondiente.",
  "Requests without session initialization":
    "Solicitudes sin inicialización de sesión",
  "Accept independently authenticated requests without a session identifier.":
    "Acepta solicitudes autenticadas de forma independiente sin un identificador de sesión.",
  "Cross-connection session independence":
    "Independencia de sesión entre conexiones",
  "Fetch does not expose control over TCP connection reuse. Internal session independence cannot be proven by this browser.":
    "Fetch no permite controlar la reutilización de conexiones TCP. Este navegador no puede demostrar la independencia interna de sesiones.",
  "Verify with an external integration test using separate connections.":
    "Verifica mediante una prueba de integración externa con conexiones separadas.",
  "Observed JSON-RPC errors": "Errores JSON-RPC observados",
  "No error response observed. No invalid tool was executed to manufacture an error.":
    "No se observó ninguna respuesta de error. No se ejecutó una herramienta inválida para provocar un error.",
  "Review an explicitly authorized error response.":
    "Revisa una respuesta de error autorizada explícitamente.",
  "Result discriminator missing": "Falta el discriminador del resultado",
  "Return resultType: complete for modern complete results.":
    "Devuelve resultType: complete para los resultados completos del protocolo actual.",
  "Malformed tool definition": "Definición de herramienta mal formada",
  "Tool catalog contains a non-object value.":
    "El catálogo de herramientas contiene un valor que no es un objeto.",
  "Return tool definitions as objects.":
    "Devuelve las definiciones de herramientas como objetos.",
  "Tool identifier": "Identificador de herramienta",
  "Use a unique, descriptive name of 1–128 ASCII letters, digits, dots, underscores or hyphens.":
    "Usa un nombre único y descriptivo de 1 a 128 caracteres ASCII: letras, dígitos, puntos, guiones bajos o guiones.",
  "Optional output schema": "Esquema de salida opcional",
  "No output schema declared; this is optional.":
    "No se ha declarado un esquema de salida; es opcional.",
  "Input schema": "Esquema de entrada",
  "Output schema": "Esquema de salida",
  "Schema compiled using its declared dialect (2020-12 by default).":
    "El esquema se compiló con el dialecto declarado (2020-12 por defecto).",
  "Use a valid, self-contained JSON Schema; resolve inspection limits offline.":
    "Usa un JSON Schema válido y autónomo; resuelve los límites de inspección fuera del navegador.",
  "Tool description clarity": "Claridad de la descripción de la herramienta",
  "No description supplied.": "No se proporcionó una descripción.",
  "Describe the business entity, supported inputs, side effects, and returned result. Length is a heuristic, not proof of clarity.":
    "Describe la entidad de negocio, las entradas admitidas, los efectos secundarios y el resultado. La longitud es una heurística, no una prueba de claridad.",
  "Argument documentation": "Documentación de argumentos",
  "All declared properties have descriptions.":
    "Todas las propiedades declaradas tienen descripción.",
  "Document argument meaning, constraints, and units.":
    "Documenta el significado, las restricciones y las unidades de los argumentos.",
  "Schema complexity": "Complejidad del esquema",
  "Consider smaller, well-documented tools when arguments become hard to select.":
    "Considera herramientas más pequeñas y bien documentadas cuando resulte difícil seleccionar argumentos.",
  "Tool name is broad": "El nombre de la herramienta es demasiado general",
  "Include an operation and entity, for example search_orders.":
    "Incluye una operación y una entidad, por ejemplo search_orders.",
  "Descriptions overlap": "Las descripciones se solapan",
  "Explain when to select each tool and how their results differ.":
    "Explica cuándo elegir cada herramienta y en qué se diferencian sus resultados.",
  "Malformed resource definition": "Definición de recurso mal formada",
  "Malformed template definition": "Definición de plantilla mal formada",
  "Catalog contains a non-object value.":
    "El catálogo contiene un valor que no es un objeto.",
  "Return catalog entries as objects.":
    "Devuelve las entradas del catálogo como objetos.",
  "Resource URI and name": "URI y nombre del recurso",
  "Template URI and name": "URI y nombre de la plantilla",
  "Supply a unique URI or valid RFC 6570 template and a string name. Existence requires a manual resource read.":
    "Proporciona una URI única o una plantilla RFC 6570 válida y un nombre de texto. Para comprobar su existencia es necesario leer el recurso manualmente.",
  "Declared media type": "Tipo de contenido declarado",
  "Use a registered media type or a valid custom MIME type.":
    "Usa un tipo de contenido registrado o un tipo MIME personalizado válido.",
  "Malformed prompt definition": "Definición de prompt mal formada",
  "Prompt catalog contains a non-object value.":
    "El catálogo de prompts contiene un valor que no es un objeto.",
  "Return prompt definitions as objects.":
    "Devuelve las definiciones de prompts como objetos.",
  "Prompt identifier and arguments": "Identificador y argumentos del prompt",
  "Use unique names and boolean required flags.":
    "Usa nombres únicos y valores booleanos para required.",
  "Transport encryption": "Cifrado del transporte",
  "No HTTP response accessible. A configured HTTPS URL alone does not verify transport security.":
    "No hay una respuesta HTTP accesible. Una URL HTTPS configurada no basta para verificar la seguridad del transporte.",
  "Use HTTPS for remote endpoints.": "Usa HTTPS para endpoints remotos.",
  "Authentication enforcement": "Aplicación de la autenticación",
  "Authentication requirements cannot be inferred from successful discovery. Anonymous and invalid-token probes require explicit authorization.":
    "No se pueden deducir los requisitos de autenticación de un descubrimiento correcto. Las pruebas anónimas y con tokens inválidos requieren autorización explícita.",
  "Run an authorized authentication probe and verify intended access policy. Public discovery may be intentional.":
    "Ejecuta una prueba de autenticación autorizada y verifica la política de acceso prevista. El descubrimiento puede ser público intencionalmente.",
  "Origin and CORS policy enforcement":
    "Aplicación de las políticas de origen y CORS",
  "Fetch cannot inspect preflight details or spoof another Origin. Accessible responses only prove this origin could read that response.":
    "Fetch no puede inspeccionar los detalles del preflight ni suplantar otro Origin. Una respuesta accesible solo demuestra que este origen pudo leerla.",
  "Review allowed origins and preflight policy on the server; use browser DevTools.":
    "Revisa los orígenes permitidos y la política de preflight del servidor; usa las herramientas de desarrollo del navegador.",
  "Sensitive field review": "Revisión de campos sensibles",
  "Sensitive-looking field names occur in accessible responses. Values are redacted; this is a heuristic.":
    "Las respuestas accesibles incluyen nombres de campos que parecen sensibles. Sus valores están ocultos; esta comprobación es heurística.",
  "No configured sensitive-field patterns found in accessible responses; this is not proof of absence.":
    "No se encontraron los patrones de campos sensibles configurados en las respuestas accesibles; esto no demuestra su ausencia.",
  "Review payloads for credentials and personal data; return only required fields.":
    "Revisa los datos para detectar credenciales e información personal; devuelve solo los campos necesarios.",
  "Controlled invalid-argument handling":
    "Manejo controlado de argumentos inválidos",
  "No malformed tools/call request was generated. Invalid inputs can still trigger side effects, and read-only annotations are untrusted.":
    "No se generó una solicitud tools/call mal formada. Las entradas inválidas pueden producir efectos secundarios y las anotaciones de solo lectura no son confiables.",
  "Test deliberately invalid arguments against an isolated test server with explicit authorization and controlled fixtures. The inspector validates arguments locally before manual execution.":
    "Prueba argumentos deliberadamente inválidos contra un servidor aislado, con autorización explícita y datos controlados. El inspector valida los argumentos localmente antes de la ejecución manual.",
  "Browser round-trip latency": "Latencia de ida y vuelta del navegador",
  "No successful network timings available.":
    "No hay mediciones de red exitosas disponibles.",
  "Use repeated controlled samples. Browser timings do not isolate server execution.":
    "Usa muestras controladas repetidas. Los tiempos del navegador no aíslan la ejecución del servidor.",
  "Observed transport errors": "Errores de transporte observados",
  "Inspect failed request evidence; network or CORS failures do not establish an MCP server defect.":
    "Inspecciona la evidencia de las solicitudes fallidas; los fallos de red o CORS no demuestran un defecto del servidor MCP.",
  "Tool result content": "Contenido del resultado de la herramienta",
  "The complete result must contain valid MCP content blocks and an optional boolean isError.":
    "El resultado completo debe contener bloques de contenido MCP válidos y un campo isError booleano opcional.",
  "Return content as an array of MCP content blocks.":
    "Devuelve content como un array de bloques de contenido MCP.",
  "Structured output validation": "Validación de salida estructurada",
  "Complete a successful operation before validating structured output.":
    "Completa una operación correctamente antes de validar la salida estructurada.",
  "Additional client input requested":
    "Se solicita información adicional del cliente",
  "The operation has not completed; output cannot be validated yet.":
    "La operación no ha finalizado; todavía no se puede validar la salida.",
  "Continue with a client supporting the requested input capability.":
    "Continúa con un cliente que admita la capacidad de entrada solicitada.",
  "Additional client input is required; no completed output was returned.":
    "Se requiere información adicional del cliente; no se devolvió una salida completa.",
  "The tool reported an execution error; this is not a successful structured result.":
    "La herramienta informó de un error de ejecución; no es un resultado estructurado exitoso.",
  "Sensitive values were redacted before inspection. The original output cannot be validated from this evidence.":
    "Los valores sensibles se ocultaron antes de la inspección. No se puede validar la salida original con esta evidencia.",
  "structuredContent conforms to outputSchema.":
    "structuredContent cumple con outputSchema.",
  "Return structuredContent matching the advertised outputSchema.":
    "Devuelve structuredContent de acuerdo con el outputSchema declarado.",
  "Resource content structure": "Estructura del contenido del recurso",
  "The resource requested additional client input.":
    "El recurso solicitó información adicional del cliente.",
  "Return a contents array whose items have a URI and text or base64 blob.":
    "Devuelve un array contents cuyos elementos tengan una URI y texto o un blob en base64.",
  "Prompt message structure": "Estructura de los mensajes del prompt",
  "The prompt requested additional client input.":
    "El prompt solicitó información adicional del cliente.",
  "Use user or assistant roles and valid MCP content blocks.":
    "Usa roles user o assistant y bloques de contenido MCP válidos.",
  "No successful discovery response. Server quality has not been verified.":
    "No hay una respuesta de descubrimiento exitosa. La calidad del servidor no se ha verificado.",
  "No server checks have been evaluated.":
    "No se han evaluado comprobaciones del servidor.",
  "Cyclic or non-JSON input cannot be inspected.":
    "No se pueden inspeccionar entradas cíclicas o que no sean JSON.",
  "Inspection depth or node limit exceeded.":
    "Se excedió el límite de profundidad o nodos de inspección.",
  "MCP schemas must be JSON Schema objects.":
    "Los esquemas MCP deben ser objetos JSON Schema.",
  "External schema references are not fetched. Supply a self-contained schema.":
    "No se descargan referencias externas de esquemas. Proporciona un esquema autónomo.",
  "Complex regular expressions require offline validation; browser execution is limited.":
    "Las expresiones regulares complejas requieren validación fuera del navegador; su ejecución está limitada.",
  "Schema composition or reference complexity exceeds browser inspection limits.":
    "La complejidad de composición o referencias del esquema excede los límites de inspección del navegador.",
  "Invalid JSON Schema.": "JSON Schema inválido.",
  "Validation could not finish.": "No se pudo completar la validación.",
  "Enter a complete HTTP or HTTPS MCP endpoint URL":
    "Introduce una URL completa HTTP o HTTPS del endpoint MCP",
  "Only HTTP and HTTPS endpoints are supported":
    "Solo se admiten endpoints HTTP y HTTPS",
  "Credentials in endpoint URLs are not allowed. Use authentication settings.":
    "No se permiten credenciales en la URL del endpoint. Usa la configuración de autenticación.",
  "Endpoint URLs cannot contain fragments":
    "Las URL de endpoints no pueden contener fragmentos",
  "Response exceeds the 5 MB inspection limit":
    "La respuesta supera el límite de inspección de 5 MB",
  "Authentication headers contain an invalid name or value":
    "Los headers de autenticación contienen un nombre o valor inválido",
  "Catalog exceeds the schema depth inspection limit":
    "El catálogo supera el límite de profundidad de esquemas",
  "Client is disconnected. Create a new connection before sending requests.":
    "El cliente está desconectado. Crea una nueva conexión antes de enviar solicitudes.",
  "Unsupported MCP method": "Método MCP no compatible",
  "Invalid JSON-RPC SSE message": "Mensaje SSE JSON-RPC inválido",
  "Server-initiated requests are not supported by the stateless protocol":
    "El protocolo sin estado no admite solicitudes iniciadas por el servidor",
  "Expected a JSON-RPC notification": "Se esperaba una notificación JSON-RPC",
  "Subscription notification ID does not match":
    "El ID de la notificación de suscripción no coincide",
  "Subscription stream must begin with acknowledgment":
    "El stream de suscripción debe comenzar con una confirmación",
  "Received an unrequested subscription notification":
    "Se recibió una notificación de suscripción no solicitada",
  "SSE stream ended before a final JSON-RPC response":
    "El stream SSE terminó antes de la respuesta JSON-RPC final",
  "Response is not valid JSON": "La respuesta no es JSON válido",
  "Invalid JSON-RPC response envelope":
    "Estructura de respuesta JSON-RPC inválida",
  "Response ID does not match the request":
    "El ID de respuesta no coincide con la solicitud",
  "Malformed JSON-RPC error": "Error JSON-RPC mal formado",
  "JSON-RPC result must be an object":
    "El resultado JSON-RPC debe ser un objeto",
  "Subscription completion ID does not match":
    "El ID de finalización de suscripción no coincide",
  "Request cancelled": "Solicitud cancelada",
  "Invalid JSON in SSE event": "JSON inválido en un evento SSE",
  "Discovery requires supportedVersions and capabilities":
    "El descubrimiento requiere supportedVersions y capabilities",
  "Catalog exceeds the 10,000 item inspection limit":
    "El catálogo supera el límite de inspección de 10.000 elementos",
  "Invalid or repeated pagination cursor":
    "Cursor de paginación inválido o repetido",
  "Pagination exceeds the 100 page inspection limit":
    "La paginación supera el límite de inspección de 100 páginas",
  "Tool name and inputSchema are required":
    "Se requieren el nombre y el inputSchema de la herramienta",
  "Duplicate tool name is ambiguous and cannot be executed":
    "Un nombre de herramienta duplicado es ambiguo y no se puede ejecutar",
  "Resource catalog entries require string name and uri fields":
    "Las entradas del catálogo de recursos requieren los campos name y uri de tipo texto",
  "Resource template entries require string name and uriTemplate fields":
    "Las plantillas de recursos requieren los campos name y uriTemplate de tipo texto",
  "Prompt catalog entries require a string name and valid argument descriptors":
    "Las entradas del catálogo de prompts requieren un nombre de texto y descriptores de argumentos válidos",
  "List and select a valid tool before executing it":
    "Lista y selecciona una herramienta válida antes de ejecutarla",
  "Server has not declared completions support":
    "El servidor no ha declarado soporte para completado",
  "Subscription filter requires capabilities advertised by this server":
    "El filtro de suscripción requiere capacidades declaradas por este servidor",
  "SSE response has no readable body":
    "La respuesta SSE no tiene un cuerpo legible",
  "x-mcp-header must be a nonempty HTTP token on a statically reachable property":
    "x-mcp-header debe ser un token HTTP no vacío en una propiedad accesible estáticamente",
  "x-mcp-header requires integer, string or boolean":
    "x-mcp-header requiere integer, string o boolean",
  "x-mcp-header names must be case-insensitively unique":
    "Los nombres x-mcp-header deben ser únicos sin distinguir mayúsculas",
  "Schema exceeds inspection limits":
    "El esquema supera los límites de inspección",
  "Possible CORS block or connectivity issue. The browser did not expose a response; check CORS, TLS, DNS, mixed content, redirects and endpoint availability. Redirects are intentionally rejected to avoid forwarding credentials.":
    "Posible bloqueo CORS o problema de conectividad. El navegador no expuso una respuesta; revisa CORS, TLS, DNS, contenido mixto, redirecciones y disponibilidad del endpoint. Las redirecciones se rechazan para evitar reenviar credenciales.",
  "Possible CORS block or connectivity issue. Inspect the browser network panel; no server defect is established.":
    "Posible bloqueo CORS o problema de conectividad. Inspecciona el panel de red del navegador; no se ha demostrado un defecto del servidor.",
  "Observations are limited to this browser, endpoint, credentials and execution window.":
    "Las observaciones se limitan a este navegador, endpoint, credenciales y período de ejecución.",
  "An ambiguous Fetch failure does not confirm CORS. Preflight details and unexposed headers cannot be inspected by this application.":
    "Un fallo ambiguo de Fetch no confirma un bloqueo CORS. Esta aplicación no puede inspeccionar los detalles de preflight ni los headers no expuestos.",
  "Latency includes browser, network and server work; it is not exclusive server processing time.":
    "La latencia incluye el trabajo del navegador, la red y el servidor; no es solo el tiempo de procesamiento del servidor.",
  "Unexecuted, blocked and optional checks are distinguished from successful checks. Heuristics are not protocol requirements.":
    "Las comprobaciones no ejecutadas, bloqueadas y opcionales se distinguen de las exitosas. Las heurísticas no son requisitos del protocolo.",
  "Sensitive keys and known credentials are redacted. Review business data before sharing this report.":
    "Se ocultan los campos sensibles y las credenciales conocidas. Revisa los datos de negocio antes de compartir este informe.",
  "Not evaluated": "Sin evaluar",
  "Orionis MCP Inspector — local report":
    "Orionis MCP Inspector — informe local",
  "Inspection report": "Informe de inspección",
  "Generated locally in the browser": "Generado localmente en el navegador",
  "Server identity & discovery": "Identidad del servidor y descubrimiento",
  "Quality score & coverage": "Puntuación de calidad y cobertura",
  Tools: "Herramientas",
  Resources: "Recursos",
  "Resource templates": "Plantillas de recursos",
  Prompts: "Prompts",
  Tests: "Pruebas",
  "Findings & recommendations": "Hallazgos y recomendaciones",
  "Browser-observed metrics": "Métricas observadas en el navegador",
  "Request evidence": "Evidencia de solicitudes",
  "Scope & limitations": "Alcance y limitaciones",
  "Orionis MCP Inspector report": "Informe de Orionis MCP Inspector",
  "Orionis MCP Inspector (local browser)":
    "Orionis MCP Inspector (navegador local)",
  "Local evidence report. Unicode evidence uses JSON escapes.":
    "Informe local de evidencias. El texto Unicode se representa con escapes JSON.",
  "anonymous discovery authentication probe":
    "Prueba de autenticación de descubrimiento anónimo",
  "invalid-token discovery authentication probe":
    "Prueba de autenticación de descubrimiento con token inválido",
};

/** Anchored templates for messages generated by the local validation engine. */
export const diagnosticTemplatesEs: Record<string, string> = {
  "HTTP {status}: authentication, authorization or Origin policy rejected the request A 403 may reflect authentication, authorization or Origin policy; authentication enforcement is not confirmed.":
    "HTTP {status}: la política de autenticación, autorización u Origin rechazó la solicitud. Un 403 puede indicar una política de autenticación, autorización u Origin; no confirma que se aplique autenticación.",
  "Advertised: {versions}": "Declaradas: {versions}",
  "{count} recorded network requests inspected. This checks configured requests.":
    "Se inspeccionaron {count} solicitudes de red registradas. Esta comprobación revisa las solicitudes configuradas.",
  "{count} accessible MCP response envelopes inspected. HTTP authentication/rejection bodies are excluded.":
    "Se inspeccionaron {count} estructuras de respuesta MCP accesibles. Se excluyen los cuerpos HTTP de autenticación o rechazo.",
  "{count} successful requests made without any client handshake. This does not prove server internals are stateless.":
    "Se realizaron {count} solicitudes exitosas sin handshake del cliente. Esto no demuestra que el servidor sea internamente sin estado.",
  "{count} real error responses inspected.":
    "Se inspeccionaron {count} respuestas de error reales.",
  "{count} results omitted resultType; accepted as complete for compatibility.":
    "{count} resultados omitieron resultType; se aceptaron como complete por compatibilidad.",
  "Identifier: {name}.": "Identificador: {name}.",
  "Description has {count} characters.":
    "La descripción tiene {count} caracteres.",
  "Missing descriptions: {names}": "Descripciones ausentes: {names}",
  "{count} top-level properties; complexity is a heuristic.":
    "{count} propiedades de primer nivel; la complejidad es una heurística.",
  "The name {name} does not identify a business entity.":
    "El nombre {name} no identifica una entidad de negocio.",
  "Same description as {name}.": "La misma descripción que {name}.",
  "{count} argument definitions inspected.":
    "Se inspeccionaron {count} definiciones de argumentos.",
  "Accessible HTTP response over {scheme}. Browser TLS validation is used for HTTPS.":
    "Respuesta HTTP accesible mediante {scheme}. Para HTTPS se usa la validación TLS del navegador.",
  "{count} successful network samples; average {average} ms, p50 {p50} ms, p95 {p95} ms. Includes network, preflight, browser scheduling, transfer and server time.":
    "{count} muestras de red exitosas; promedio {average} ms, p50 {p50} ms y p95 {p95} ms. Incluye red, preflight, planificación del navegador, transferencia y tiempo del servidor.",
  "{errors} errors, {timeouts} timeouts, {cancelled} cancellations.":
    "{errors} errores, {timeouts} tiempos de espera agotados y {cancelled} cancelaciones.",
  "{count} valid content blocks returned; tool reported isError.":
    "Se devolvieron {count} bloques de contenido válidos; la herramienta informó isError.",
  "{count} valid content blocks returned.":
    "Se devolvieron {count} bloques de contenido válidos.",
  "{count} resource content items inspected.":
    "Se inspeccionaron {count} elementos de contenido del recurso.",
  "{count} messages inspected.": "Se inspeccionaron {count} mensajes.",
  "Inspection limit exceeded ({count} characters).":
    "Se excedió el límite de inspección ({count} caracteres).",
  "Unsupported schema dialect: {dialect}. Supported: 2020-12 (default), draft-07.":
    "Dialecto de esquema no compatible: {dialect}. Se admiten 2020-12 (por defecto) y draft-07.",
  "Header {name} is controlled by the transport or browser":
    "El header {name} está controlado por el transporte o el navegador",
  "HTTP {status}: authentication, authorization or Origin policy rejected the request":
    "HTTP {status}: la política de autenticación, autorización u Origin rechazó la solicitud",
  "HTTP {status}: expected application/json or text/event-stream; received {type}":
    "HTTP {status}: se esperaba application/json o text/event-stream; se recibió {type}",
  "Unrecognized resultType: {type}": "resultType no reconocido: {type}",
  "Request timed out after {milliseconds} ms":
    "La solicitud agotó el tiempo de espera tras {milliseconds} ms",
  "Server does not advertise MCP {version}":
    "El servidor no declara MCP {version}",
  "{method} result must contain an array: {field}":
    "El resultado de {method} debe contener un array: {field}",
  "Invalid value for {header}": "Valor inválido para {header}",
  "{path} must have required property '{property}': {name}":
    "{path} debe incluir la propiedad obligatoria '{property}': {name}",
  "{path} must be {type}": "{path} debe ser {type}",
  "{path} must NOT have additional properties":
    "{path} no debe incluir propiedades adicionales",
  "{path} must be equal to one of the allowed values":
    "{path} debe ser uno de los valores permitidos",
  "{path} must NOT have fewer than {count} characters":
    "{path} no debe tener menos de {count} caracteres",
  "{path} must NOT have more than {count} characters":
    "{path} no debe tener más de {count} caracteres",
  '{path} must match pattern "{pattern}"':
    '{path} debe cumplir el patrón "{pattern}"',
  '{path} must match format "{format}"':
    '{path} debe cumplir el formato "{format}"',
  "{path} must be >= {number}": "{path} debe ser >= {number}",
  "{path} must be <= {number}": "{path} debe ser <= {number}",
  "{path} must NOT have fewer than {count} items":
    "{path} no debe tener menos de {count} elementos",
  "{path} must NOT have more than {count} items":
    "{path} no debe tener más de {count} elementos",
};
