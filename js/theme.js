// Theme persistence + application. Two independent choices — which
// palette (colorTheme) and which brightness (mode) — CSS does the actual
// swapping via data attributes on <html>; this just persists the choice
// and keeps the browser-chrome meta color in sync.
//
// index.html also carries a tiny inline copy of the read+apply half of
// this (before the stylesheet loads) so the right theme is already set
// by first paint — a module script runs too late for that and would
// flash the default theme first. Keep the two in sync if this changes.

const COLOR_KEY = "buddy-color-theme";
const MODE_KEY = "buddy-mode";
const FONT_KEY = "buddy-font-scale";

// Not exported — only read inside this module. app.js gets at the same
// choices through the getter/setter functions below instead.
const COLOR_THEMES = ["buddy", "ocean", "blossom"];
const MODES = ["system", "light", "dark"];
const FONT_SCALES = { small: 0.9, medium: 1, large: 1.15 };

function readStored(key, allowed, fallback) {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : fallback;
  } catch (e) {
    return fallback; // private browsing / storage disabled — just use the default for this load
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // theme still applies for this load, it just won't be remembered
  }
}

// The page has no tinted header of its own, so the closest thing each
// theme has to a "brand" color is the buddy's own gradient — that's what
// the address bar / status bar tints to. getComputedStyle forces a
// synchronous style recalc, so this reads the value correctly right after
// the attribute change with no frame to wait for — which matters because
// requestAnimationFrame never fires on a backgrounded tab, and a PWA
// reopened from a notification or the home screen often starts hidden.
function syncMetaThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--grad-a").trim();
  if (accent) meta.setAttribute("content", accent);
}

// Default (nothing chosen yet) is Ocean + Light — cooler and airier than
// the bare :root values (the warm Buddy palette, dark-first). index.html's
// own inline pre-paint copy of this logic needs to keep matching, or first
// paint and this would disagree.
export function getColorTheme() {
  return readStored(COLOR_KEY, COLOR_THEMES, "ocean");
}
export function getMode() {
  return readStored(MODE_KEY, MODES, "light");
}
export function getFontScale() {
  return readStored(FONT_KEY, Object.keys(FONT_SCALES), "medium");
}

export function setColorTheme(theme) {
  if (!COLOR_THEMES.includes(theme)) return;
  const root = document.documentElement;
  if (theme === "buddy") delete root.dataset.colorTheme; // the bare :root values already are Buddy
  else root.dataset.colorTheme = theme;
  persist(COLOR_KEY, theme);
  syncMetaThemeColor();
}

export function setMode(mode) {
  if (!MODES.includes(mode)) return;
  const root = document.documentElement;
  if (mode === "system") delete root.dataset.theme; // let prefers-color-scheme decide
  else root.dataset.theme = mode;
  persist(MODE_KEY, mode);
  syncMetaThemeColor();
}

export function setFontScale(size) {
  if (!FONT_SCALES[size]) return;
  document.documentElement.style.setProperty("--font-scale", String(FONT_SCALES[size]));
  persist(FONT_KEY, size);
}

export function initTheme() {
  setColorTheme(getColorTheme());
  setMode(getMode());
  setFontScale(getFontScale());
}
