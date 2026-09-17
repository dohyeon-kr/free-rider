import assert from "node:assert/strict";
import test from "node:test";

import { shouldConfirmDialogOnEnter } from "../src/ui/dialog-enter.mjs";

test("Enter confirms reversible text input dialogs", () => {
  assert.equal(
    shouldConfirmDialogOnEnter({
      key: "Enter",
      targetTagName: "INPUT",
      targetType: "text",
      confirmLabel: "Create",
    }),
    true,
  );

  assert.equal(
    shouldConfirmDialogOnEnter({
      key: "Enter",
      targetTagName: "INPUT",
      targetType: "text",
      confirmLabel: "Save",
    }),
    true,
  );
});

test("Enter does not confirm destructive dialogs", () => {
  assert.equal(
    shouldConfirmDialogOnEnter({
      key: "Enter",
      targetTagName: "INPUT",
      targetType: "text",
      confirmLabel: "Delete",
    }),
    false,
  );
});

test("Enter does not hijack textarea or IME composition", () => {
  assert.equal(
    shouldConfirmDialogOnEnter({
      key: "Enter",
      targetTagName: "TEXTAREA",
      targetType: "text",
      confirmLabel: "Save",
    }),
    false,
  );

  assert.equal(
    shouldConfirmDialogOnEnter({
      key: "Enter",
      isComposing: true,
      targetTagName: "INPUT",
      targetType: "text",
      confirmLabel: "Save",
    }),
    false,
  );
});
