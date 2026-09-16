import test from "node:test";
import assert from "node:assert/strict";
import { closeOrder, getTabTargetIndexes } from "../src/ui/tab-actions.mjs";

test("batch close processes original tab indexes from right to left", () => {
  assert.deepEqual(closeOrder([0, 1, 2, 3]), [3, 2, 1, 0]);
  assert.deepEqual(closeOrder([3, 1, 3, -1, 2]), [3, 2, 1]);
});

test("context menu targets are relative to the selected tab", () => {
  assert.deepEqual(getTabTargetIndexes(5, 2), {
    all: [0, 1, 2, 3, 4],
    others: [0, 1, 3, 4],
    left: [0, 1],
    right: [3, 4],
  });
});

test("edge tabs have no targets on the missing side", () => {
  assert.deepEqual(getTabTargetIndexes(3, 0).left, []);
  assert.deepEqual(getTabTargetIndexes(3, 2).right, []);
});
