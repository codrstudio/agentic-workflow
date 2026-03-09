import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Apply persisted theme before first render to prevent flash
try {
  const stored = JSON.parse(localStorage.getItem("ab-hub-ui") ?? "{}") as { state?: { theme?: string } };
  const theme = stored.state?.theme ?? "system";
  const prefersDark = theme === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : theme === "dark";
  document.documentElement.classList.toggle("dark", prefersDark);
} catch {
  // ignore parse errors
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
