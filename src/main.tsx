import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { connectionFromQuery } from "./core/connection/query";
import { useInspector } from "./stores/inspector";
import "./styles/index.css";
// Configure only the initial field before React mounts; connecting remains explicit.
const initialConnection = connectionFromQuery(window.location.search);
if (initialConnection.endpoint !== undefined)
  useInspector.getState().setEndpoint(initialConnection.endpoint);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App initialNotice={initialConnection.notice} />
  </StrictMode>,
);
