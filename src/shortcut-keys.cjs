"use strict";

// Keep native accelerators and the renderer's fallback keyboard handler in sync.
function resolveShortcut(input) {
  if (input.type && input.type !== "keyDown") return null;
  const key = String(input.key || "").toLowerCase();

  if (input.control && !input.meta && !input.alt && key === "tab")
    return input.shift ? "tab-previous" : "tab-next";

  // Browser-style macOS tab switching.
  if (input.meta && input.alt && !input.control && !input.shift) {
    if (key === "arrowleft") return "tab-previous";
    if (key === "arrowright") return "tab-next";
  }

  if (!(input.meta || input.control) || input.alt) return null;
  if (key === "s") return input.shift ? "save-workspace" : "save-request";
  if (key === "t") return input.shift ? "restore-tab" : "new-tab";
  if (input.shift) return null;

  if (key === "n") return "new-request";
  if (key === "w") return "close-tab";
  if (key === "k") return "search";
  if (key === "enter") return "send-request";
  if (/^[1-9]$/.test(key)) return `select-tab-${key}`;
  return null;
}

module.exports = { resolveShortcut };
