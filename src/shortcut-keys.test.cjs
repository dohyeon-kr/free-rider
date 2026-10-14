"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resolveShortcut } = require("./shortcut-keys.cjs");

const shortcut = (key, modifiers = {}) => resolveShortcut({
  type: "keyDown", key, meta: true, control: false, shift: false, alt: false, ...modifiers,
});

test("separates request save and full workspace save", () => {
  assert.equal(shortcut("s"), "save-request");
  assert.equal(shortcut("S", { shift: true }), "save-workspace");
  assert.equal(shortcut("s", { meta: false, control: true, shift: true }), "save-workspace");
});

test("supports browser-style tab shortcuts", () => {
  assert.equal(shortcut("t"), "new-tab");
  assert.equal(shortcut("T", { shift: true }), "restore-tab");
  assert.equal(shortcut("w"), "close-tab");
  assert.equal(shortcut("n"), "new-request");
  assert.equal(shortcut("1"), "select-tab-1");
  assert.equal(shortcut("9"), "select-tab-9");
  assert.equal(shortcut("tab", { meta: false, control: true }), "tab-next");
  assert.equal(shortcut("Tab", { meta: false, control: true, shift: true }), "tab-previous");
  assert.equal(shortcut("ArrowLeft", { alt: true }), "tab-previous");
  assert.equal(shortcut("ArrowRight", { alt: true }), "tab-next");
});

test("ignores other modifiers and key-up events", () => {
  assert.equal(shortcut("w", { shift: true }), null);
  assert.equal(shortcut("w", { alt: true }), null);
  assert.equal(shortcut("z"), null); // Renderer handles request undo/redo.
  assert.equal(shortcut("s", { type: "keyUp" }), null);
  assert.equal(shortcut("t", { meta: false }), null);
  assert.equal(shortcut("Tab", { shift: true }), null);
  assert.equal(shortcut("Tab", { meta: false, control: true, alt: true }), null);
});
