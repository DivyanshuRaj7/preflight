import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./tokens.css";
import { App } from "./App.js";

const root = document.getElementById("root");
if (!root) throw new Error("Preflight UI requires a #root element.");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
