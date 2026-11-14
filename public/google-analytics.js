/* global window, document */
(() => {
  // Shared MCP links may contain private hosts or endpoint query credentials.
  // Do not load third-party code in these sessions, including invalid/empty links.
  if (new URLSearchParams(window.location.search).has("mcp")) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  gtag("js", new Date());
  gtag("config", "G-00KY9GMZQ0");
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=G-00KY9GMZQ0";
  document.head.appendChild(script);
})();
