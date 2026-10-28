// The starting point of the React app.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Fonts are installed from npm (no external font servers)
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import App from "./App.jsx";
import { applyTheme, getTheme } from "./theme.js";
import "./styles.css";

applyTheme(getTheme());

// Register the service worker (for notifications + "install app")
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("SW failed:", err));
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
