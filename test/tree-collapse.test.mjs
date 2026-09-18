import test from "node:test";
import assert from "node:assert/strict";
import {
  collapsibleTreeIds,
  collapseEntireTree,
  expandEntireTree,
  isTreeFullyCollapsed,
} from "../src/ui/tree-collapse.mjs";

const collections = [
  {
    id: "collection-a",
    folders: [{ path: "users/admin" }],
    requests: [
      { group: "users/profile" },
      { group: "billing/invoices" },
      { group: "" },
    ],
  },
  {
    id: "collection-b",
    folders: [],
    requests: [],
  },
];

test("collapsibleTreeIds includes collections and every nested folder prefix", () => {
  assert.deepEqual(
    [...collapsibleTreeIds(collections)].sort(),
    [
      "collection-a",
      "collection-a:billing",
      "collection-a:billing/invoices",
      "collection-a:users",
      "collection-a:users/admin",
      "collection-a:users/profile",
      "collection-b",
    ].sort(),
  );
});

test("collapseEntireTree collapses all collection and folder nodes", () => {
  const collapsed = new Set(["stale-node"]);
  collapseEntireTree(collections, collapsed);

  assert.equal(isTreeFullyCollapsed(collections, collapsed), true);
  assert.equal(collapsed.has("stale-node"), true);

  collapsed.delete("collection-a:users");
  assert.equal(isTreeFullyCollapsed(collections, collapsed), false);
});

test("expandEntireTree clears every collapsed node", () => {
  const collapsed = new Set(["collection-a", "collection-a:users"]);
  assert.equal(expandEntireTree(collapsed), collapsed);
  assert.equal(collapsed.size, 0);
});
