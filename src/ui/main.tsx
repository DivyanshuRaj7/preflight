import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./tokens.css";
import { App } from "./App.js";
import { ScholarshipPortal } from "../portal/scholarship/ScholarshipPortal.js";

// Pathname entry demultiplexes two independent products sharing one Vite
// build: the Preflight console (/) and the synthetic external portal
// (/portal/*). No shared state, no shared domain logic — later Playwright
// will operate the portal as an external application.
const isPortalRoute =
  typeof window !== "undefined" && window.location.pathname.startsWith("/portal/");

const root = document.getElementById("root");
if (!root) throw new Error("Preflight UI requires a #root element.");
createRoot(root).render(
  <StrictMode>{isPortalRoute ? <ScholarshipPortal /> : <App />}</StrictMode>,
);
