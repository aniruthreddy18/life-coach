// =============================================================
// theme.js — Light / Dark / System
// The choice is a per-device convenience, so localStorage is fine.
// index.html applies it BEFORE the page paints (no white flash).
// =============================================================
const KEY = "theme";

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || "system";
  } catch {
    return "system";
  }
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // storage blocked (private mode) — the choice just won't be remembered
  }
  applyTheme(theme);
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light" || theme === "dark") root.dataset.theme = theme;
  else delete root.dataset.theme;
  // keep the phone's status bar colour in sync
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg || "#0e0d0b");
}
