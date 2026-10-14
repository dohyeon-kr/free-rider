import { test } from "node:test";
import assert from "node:assert/strict";
import { nextTabIndex, numberedTabIndex } from "./tab-actions.mjs";

test("tab cycling wraps and supports an unset active tab", () => {
  assert.equal(nextTabIndex(3, 0, -1), 2);
  assert.equal(nextTabIndex(3, 2, 1), 0);
  assert.equal(nextTabIndex(3, 1, 1), 2);
  assert.equal(nextTabIndex(3, -1, 1), 0);
  assert.equal(nextTabIndex(3, -1, -1), 2);
  assert.equal(nextTabIndex(0, 0, 1), -1);
});

test("tab number 9 always selects last tab", () => {
  assert.equal(numberedTabIndex(12, 9), 11);
  assert.equal(numberedTabIndex(5, 3), 2);
  assert.equal(numberedTabIndex(5, 9), 4);
  assert.equal(numberedTabIndex(5, 6), -1);
  assert.equal(numberedTabIndex(0, 1), -1);
  assert.equal(numberedTabIndex(3, 0), -1);
});
