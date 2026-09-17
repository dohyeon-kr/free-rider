const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise the real applySync orchestration, without starting Electron or the
// rest of the workspace UI. Other modules have their own Git and DOM tests.
async function fixture({ connected = true, baseUrl = "https://old.example", failSave = false } = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../src/ui/app.js"), "utf8");
  const start = source.indexOf("async function applySync(");
  const end = source.indexOf("function endpointPicker(", start);
  assert.ok(start >= 0 && end > start, "applySync boundary must exist");
  const { hasSyncChanges } = await import("../src/ui/git-sync-commit.mjs");
  const collection = { id: "c1", title: "API", requests: [{ id: "r1", name: "old", url: "/api" }],
    environments: [{ id: "dev", name: "Development", values: { baseUrl } }] };
  const result = { title: "API", requests: [{ id: "r1", name: "new", url: "/api" }],
    counts: { added: 0, updated: 1, removed: 0 }, baseUrl: "https://new.example" };
  const events = [], offers = [];
  const dialog = new EventTarget(); dialog.open = false;
  const state = { collections: [collection] };
  const gitInfo = new Map(connected ? [["c1", { root: "/repo", branch: "main" }]] : []);
  let confirmBase;
  const context = {
    structuredClone, URL, hasSyncChanges, state, gitInfo, api: {},
    drafts: { discard() {} }, syncReviews: new Map(), render() {}, mark() {}, status() {},
    env: col => col.environments[0], $: () => dialog,
    action: async fn => fn(),
    el: (tag, attrs, ...children) => ({ tag, attrs, children }),
    input: (value, onChange, attrs) => ({ value, onChange, attrs }), field: (label, input) => ({ label, input }),
    saveCollectionTransaction: async (col, next) => {
      if (failSave) throw Error("disk full");
      Object.assign(col, next); events.push("persisted");
    },
    modal(title, content, confirm) { events.push(title); confirmBase = confirm; dialog.open = true; },
    offerSyncCommit(options) { events.push("offer"); offers.push(options); },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + "\nthis.applySyncUnderTest=applySync;", context);
  return { collection, result, events, offers, state, gitInfo,
    apply: () => context.applySyncUnderTest(collection, result, ["r1"]),
    async closeBase(confirm = false) {
      if (confirm) confirmBase();
      dialog.open = false; dialog.dispatchEvent(new Event("close"));
      await new Promise(resolve => setImmediate(resolve));
    },
  };
}

test("sync changes are durable before the connected repository offer", async () => {
  const f = await fixture(); await f.apply();
  assert.deepEqual(f.events, ["persisted", "offer"]);
  assert.equal(f.offers[0].collection.requests[0].name, "new");
  assert.equal(f.offers[0].repository.root, "/repo");
});

test("a failed sync persistence never opens a commit prompt", async () => {
  const f = await fixture({ failSave: true });
  await assert.rejects(f.apply(), /disk full/);
  assert.deepEqual(f.events, []); assert.equal(f.collection.requests[0].name, "old");
});

test("no effective OpenAPI change means no commit offer even when selected counts are nonzero", async () => {
  const f = await fixture(); f.result.requests = structuredClone(f.collection.requests);
  await f.apply(); assert.deepEqual(f.events, ["persisted"]);
});

test("another collection's connected repository cannot trigger the offer", async () => {
  const f = await fixture({ connected: false });
  f.gitInfo.set("other", { root: "/other", branch: "main" });
  await f.apply(); assert.deepEqual(f.events, ["persisted"]);
});

for (const confirm of [false, true]) {
  test(`baseUrl ${confirm ? "confirmation" : "cancellation"} completes before the single commit offer`, async () => {
    const f = await fixture({ baseUrl: "" }); await f.apply();
    assert.deepEqual(f.events, ["persisted", "baseUrl 등록"]);
    await f.closeBase(confirm);
    assert.deepEqual(f.events, ["persisted", "baseUrl 등록", "offer"]);
    assert.equal(f.collection.environments[0].values.baseUrl, confirm ? "https://new.example" : "");
    await f.closeBase(); assert.equal(f.offers.length, 1);
  });
}

test("a deleted collection is not offered a late commit after baseUrl closes", async () => {
  const f = await fixture({ baseUrl: "" }); await f.apply();
  f.state.collections.length = 0; await f.closeBase();
  assert.equal(f.offers.length, 0);
});
