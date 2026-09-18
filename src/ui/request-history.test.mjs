import test from "node:test";
import assert from "node:assert/strict";
import { RequestHistory } from "./request-history.mjs";

const request = (url = "/one") => ({
  id: "request-1",
  method: "GET",
  url,
  headers: [],
});

test("undo and redo request snapshots", () => {
  const history = new RequestHistory();
  const initial = request();
  history.ensure("collection-1", initial.id, initial);

  const changed = request("/two");
  history.record("collection-1", initial.id, changed);

  assert.deepEqual(
    history.undo("collection-1", initial.id, changed),
    initial,
  );
  assert.deepEqual(
    history.redo("collection-1", initial.id, initial),
    changed,
  );
});

test("new edits after undo clear redo history", () => {
  const history = new RequestHistory();
  const initial = request();
  const changed = request("/two");
  history.record("collection-1", initial.id, initial);
  history.record("collection-1", initial.id, changed);
  history.undo("collection-1", initial.id, changed);

  const replacement = request("/three");
  history.record("collection-1", initial.id, replacement);

  assert.equal(
    history.redo("collection-1", initial.id, replacement),
    null,
  );
});

test("typing snapshots with the same group are coalesced", () => {
  const history = new RequestHistory({ coalesceMs: 1000 });
  const initial = request("");
  history.ensure("collection-1", initial.id, initial);

  history.record(
    "collection-1",
    initial.id,
    request("/a"),
    { group: "url", at: 100 },
  );
  history.record(
    "collection-1",
    initial.id,
    request("/abc"),
    { group: "url", at: 500 },
  );

  assert.deepEqual(
    history.undo("collection-1", initial.id, request("/abc")),
    initial,
  );
  assert.deepEqual(
    history.redo("collection-1", initial.id, initial),
    request("/abc"),
  );
});
