import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./presentacion/App";
import "./presentacion/styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
