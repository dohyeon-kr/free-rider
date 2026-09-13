const test = require("node:test");
const assert = require("node:assert/strict");
test("request drafts isolate edits, discard, and selected saves", async () => {
  const { RequestDrafts } = await import("../src/ui/drafts.mjs");
  const drafts = new RequestDrafts();
  const state = {collections:[{id:"c", requests:[{id:"a",url:"/a"},{id:"b",url:"/b"}]}]};
  const [a,b] = state.collections[0].requests;
  drafts.get("c",a).url = "/edited";
  drafts.get("c",b).url = "/pending";
  assert.equal(a.url,"/a");
  assert.equal(drafts.changed("c",a),true);
  const saved = drafts.snapshot(state,{cid:"c",id:"a"});
  assert.equal(saved.collections[0].requests[0].url,"/edited");
  assert.equal(saved.collections[0].requests[1].url,"/b");
  assert.equal(drafts.get("c",b).url,"/pending");
  drafts.discard("c","a");
  assert.equal(drafts.get("c",a).url,"/a");
  assert.equal(drafts.snapshot(state).collections[0].requests[1].url,"/pending");
});
