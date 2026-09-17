const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync } = require("node:fs");
const path = require("node:path");

async function moduleUnderTest() {
  assert.ok(existsSync(path.join(__dirname, "../src/ui/git-sync-commit.mjs")), "sync commit prompt must exist");
  return import("../src/ui/git-sync-commit.mjs");
}
class Element extends EventTarget {
  constructor(tag, document) {
    super(); this.tagName = tag.toUpperCase(); this.document = document;
    this.children = []; this.value = ""; this.textContent = ""; this.disabled = false;
    this.open = false; this.attrs = {};
  }
  setAttribute(key, value) { this.attrs[key] = value; if (key === "id") this.document.nodes.set(value, this); }
  append(...children) { this.children.push(...children); }
  focus() { this.document.focused = this; }
  querySelectorAll(selector) {
    const tags = selector.split(",").map(s => s.trim().toUpperCase());
    return this.children.flatMap(c => typeof c === "string" ? [] : [
      ...(tags.includes(c.tagName) ? [c] : []), ...c.querySelectorAll(selector),
    ]);
  }
  close() { this.open = false; this.dispatchEvent(new Event("close")); }
}
async function fixture({ repository = { root: "/repo", branch: "main" }, call, occupied = false } = {}) {
  const { offerSyncCommit } = await moduleUnderTest();
  const document = { nodes: new Map(), createElement(tag) { return new Element(tag, this); },
    getElementById(id) { return this.nodes.get(id); } };
  global.document = document;
  const get = id => document.getElementById(id);
  for (const [id, tag] of [["dialog", "dialog"], ["dialogConfirm", "button"], ["dialogCancel", "button"]]) {
    const element = document.createElement(tag); element.setAttribute("id", id);
    if (id !== "dialog") get("dialog").append(element);
  }
  get("dialogCancel").textContent = "Cancel";
  get("dialog").open = occupied;
  let submit, shown = 0;
  const calls = [], messages = [], committed = [];
  const collection = { id: "c1", title: "API", requests: [{ id: "one", url: "/synced" }] };
  const result = offerSyncCommit({ collection, repository, counts: { added: 1, updated: 2, removed: 3 },
    api: { "git-sync-commit": async (...args) => {
      calls.push(args); return call ? call(...args) : { committed: true, info: { root: "/repo", branch: "main" } };
    } },
    modal(title, content, confirm, label) {
      shown++; assert.equal(title, "동기화 결과를 커밋할까요?");
      submit = confirm; get("dialog").append(content); get("dialog").open = true;
      get("dialogConfirm").textContent = label;
    },
    onCommitted: info => committed.push(info), status: text => messages.push(text),
  });
  return { get, result, shown, submit, calls, messages, committed, collection,
    changeMessage(value) { get("syncCommitMessage").value = value; get("syncCommitMessage").dispatchEvent(new Event("input")); } };
}

test("sync metadata alone and keeping all local values do not count as applied changes", async () => {
  const { hasSyncChanges } = await moduleUnderTest();
  const old = { title: "API", requests: [{ id: "r", name: "Keep me" }], lastSync: "old" };
  assert.equal(hasSyncChanges(old, { ...structuredClone(old), lastSync: "new", syncUndo: {} }), false);
  assert.equal(hasSyncChanges(old, { ...structuredClone(old), requests: [] }), true);
  assert.equal(hasSyncChanges(old, { ...structuredClone(old), title: "Renamed" }), true);
});

test("an unconnected collection never prompts or writes to Git", async () => {
  const empty = await fixture({ repository: null });
  assert.equal(empty.shown, 0); assert.equal(empty.result, false); assert.deepEqual(empty.calls, []);
});

test("an existing modal is not replaced by a late commit offer", async () => {
  const f = await fixture({ occupied: true });
  assert.equal(f.shown, 0); assert.equal(f.result, false);
});

test("the prompt previews target, summary and editable message without Git writes", async () => {
  const f = await fixture();
  assert.equal(f.shown, 1);
  assert.match(f.get("syncCommitRepository").textContent, /\/repo/);
  assert.match(f.get("syncCommitSummary").textContent, /1 추가.*2 수정.*3 삭제/);
  assert.match(f.get("syncCommitMessage").value, /Sync OpenAPI/);
  assert.equal(f.get("dialogCancel").textContent, "건너뛰기");
  assert.equal(f.get("dialogConfirm").textContent, "저장 후 커밋");
  assert.deepEqual(f.calls, []);
});

test("skipping keeps the sync result and performs no file write or commit", async () => {
  const f = await fixture();
  f.get("dialog").close();
  assert.deepEqual(f.calls, []);
  assert.equal(f.collection.requests[0].url, "/synced");
  assert.equal(f.get("dialogCancel").textContent, "Cancel");
  assert.match(f.messages.at(-1), /동기화.*유지/);
});

test("approval commits the prompt snapshot using the edited message and expected repository", async () => {
  const f = await fixture();
  f.changeMessage("  Update endpoints  ");
  f.collection.requests[0].url = "/later-edit";
  assert.equal(await f.submit(), true);
  assert.equal(f.calls[0][0].requests[0].url, "/synced");
  assert.equal(f.calls[0][1], "Update endpoints");
  assert.deepEqual(f.calls[0][2], { root: "/repo", branch: "main" });
  assert.equal(f.committed.length, 1);
  f.get("dialog").close();
  assert.match(f.messages.at(-1), /커밋했습니다/);
});

test("blank commit messages leave the prompt open without Git calls", async () => {
  const f = await fixture(); f.changeMessage("   ");
  assert.equal(await f.submit(), false);
  assert.match(f.get("syncCommitError").textContent, /메시지/);
  assert.deepEqual(f.calls, []);
});

test("commit failure keeps sync and input intact, supports retry and does not mark success", async () => {
  let fail = true;
  const f = await fixture({ call: async () => {
    if (fail) throw Error("user.email is missing");
    return { committed: true, info: { root: "/repo", branch: "main" } };
  } });
  f.changeMessage("Retry me");
  assert.equal(await f.submit(), false);
  assert.match(f.get("syncCommitError").textContent, /동기화.*반영.*user.email/s);
  assert.equal(f.get("syncCommitMessage").value, "Retry me");
  assert.equal(f.get("dialogConfirm").disabled, false);
  assert.equal(f.committed.length, 0);
  assert.equal(f.collection.requests[0].url, "/synced");
  fail = false; assert.equal(await f.submit(), true);
});

test("no Git diff is reported as a successful no-op, not a failed commit", async () => {
  const f = await fixture({ call: async () => ({ committed: false, info: { root: "/repo", branch: "main" } }) });
  assert.equal(await f.submit(), true);
  f.get("dialog").close();
  assert.match(f.messages.at(-1), /커밋할 변경.*없/);
});

test("busy confirmation blocks double submits and Escape, then restores controls", async () => {
  let finish;
  const f = await fixture({ call: () => new Promise(resolve => { finish = resolve; }) });
  const first = f.submit();
  assert.equal(f.get("dialogConfirm").disabled, true);
  assert.equal(f.get("dialogCancel").disabled, true);
  assert.equal(await f.submit(), false);
  const cancel = new Event("cancel", { cancelable: true });
  f.get("dialog").dispatchEvent(cancel); assert.equal(cancel.defaultPrevented, true);
  finish({ committed: true, info: { root: "/repo", branch: "main" } });
  assert.equal(await first, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.get("dialogCancel").disabled, false);
  f.get("dialog").close();
  const later = new Event("cancel", { cancelable: true });
  f.get("dialog").dispatchEvent(later); assert.equal(later.defaultPrevented, false);
});
