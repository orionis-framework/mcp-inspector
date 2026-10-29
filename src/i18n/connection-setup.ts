export const connectionSetupEs: Record<string, string> = {
  "Orionis server setup": "Configurar el servidor Orionis",
  "Add these variables to your Orionis application's .env, then restart the application. Keep any other origins and HTTP methods your application needs.":
    "Añade estas variables al .env de tu aplicación Orionis y reiníciala. Conserva los demás orígenes y métodos HTTP que tu aplicación necesite.",
  "Copy .env example": "Copiar ejemplo .env",
  "Environment example copied.": "Ejemplo de entorno copiado.",
  "Copy unavailable. Select and copy the example manually.":
    "No se pudo copiar. Selecciona y copia el ejemplo manualmente.",
  "This example includes the public inspector and this preview's origin. Retain only the origins you use.":
    "Este ejemplo incluye el inspector público y el origen de esta vista previa. Conserva únicamente los orígenes que utilices.",
  "The wildcard permits request headers, including MCP parameter headers. CORS_ALLOW_ORIGINS must contain explicit HTTP(S) origins; MCP does not accept a wildcard origin.":
    "El comodín permite los headers de las solicitudes, incluidos los de parámetros MCP. CORS_ALLOW_ORIGINS debe contener orígenes HTTP(S) explícitos; MCP no acepta un origen comodín.",
  "config/mcp.py validates allowed_origins; config/http.py configures HTTP CORS. Both read CORS_ALLOW_ORIGINS in the standard Orionis configuration. A value already set in .env, even list:[], overrides the default passed to Env.get(...). Changing only the fallback in config/mcp.py does not configure HTTP CORS.":
    "config/mcp.py valida allowed_origins; config/http.py configura CORS HTTP. Ambos leen CORS_ALLOW_ORIGINS en la configuración estándar de Orionis. Un valor definido en .env, incluso list:[], prevalece sobre el valor por defecto de Env.get(...). Cambiar solo el valor por defecto de config/mcp.py no configura CORS HTTP.",
  "The inspector sends no cookies. You do not need to enable CORS_ALLOW_CREDENTIALS for it. In the standard Orionis HTTP pipeline, CORS handles OPTIONS; no separate MCP OPTIONS route is needed.":
    "El inspector no envía cookies. No necesitas activar CORS_ALLOW_CREDENTIALS para usarlo. En el flujo HTTP estándar de Orionis, CORS atiende OPTIONS; no necesitas registrar una ruta MCP OPTIONS adicional.",
  "What a successful preflight must include": "Qué debe incluir un preflight correcto",
  "HTTP 200 or 204 and Allow: OPTIONS, POST only show that an HTTP server responded. The response must also include Access-Control-Allow-Origin for this inspector, Access-Control-Allow-Methods permitting POST, and Access-Control-Allow-Headers permitting the requested headers. The POST response needs Access-Control-Allow-Origin too.":
    "HTTP 200 o 204 y Allow: OPTIONS, POST solo muestran que un servidor HTTP respondió. La respuesta también debe incluir Access-Control-Allow-Origin para este inspector, Access-Control-Allow-Methods que permita POST y Access-Control-Allow-Headers que permita los headers solicitados. La respuesta POST también necesita Access-Control-Allow-Origin.",
  "CORS settings cannot fix an untrusted TLS certificate, an unresolved hostname or a firewall restriction. Compare the browser's network details with the credential-free terminal preflight and analyze its output in the connection diagnostics.":
    "Configurar CORS no corrige un certificado TLS no confiable, un dominio que no resuelve o una restricción del firewall. Compara los detalles de red del navegador con el preflight de terminal sin credenciales y analiza su salida en los diagnósticos de conexión.",
  "Orionis MCP configuration reference": "Referencia de configuración MCP de Orionis",
};
