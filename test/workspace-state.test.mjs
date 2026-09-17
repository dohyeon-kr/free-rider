import test from "node:test";
import assert from "node:assert/strict";
import {
  commitWorkspaceMutation,
  getWorkspaceState,
  trackWorkspaceState,
} from "../src/ui/workspace-state.mjs";

test("commitWorkspaceMutation mutates the tracked live state before persisting", async () => {
  const state = {
    collections: [{ id: "a" }, { id: "b" }],
    activeCollection: "a",
    tabs: [{ cid: "a", kind: "overview", id: null }],
  };
  trackWorkspaceState(state);
  let persisted = null;

  await commitWorkspaceMutation((live) => {
    live.collections = live.collections.filter((collection) => collection.id !== "a");
    live.activeCollection = "b";
    live.tabs = [];
  }, async () => {
    persisted = structuredClone(getWorkspaceState());
  });

  assert.deepEqual(state, {
    collections: [{ id: "b" }],
    activeCollection: "b",
    tabs: [],
  });
  assert.deepEqual(persisted, state);
});

test("commitWorkspaceMutation restores the same live state object when persistence fails", async () => {
  const state = {
    collections: [{ id: "a" }],
    activeCollection: "a",
    tabs: [],
  };
  const originalReference = trackWorkspaceState(state);

  await assert.rejects(
    commitWorkspaceMutation((live) => {
      live.collections = [];
      live.activeCollection = null;
    }, async () => {
      throw new Error("disk failed");
    }),
    /disk failed/,
  );

  assert.equal(getWorkspaceState(), originalReference);
  assert.deepEqual(state, {
    collections: [{ id: "a" }],
    activeCollection: "a",
    tabs: [],
  });
});
