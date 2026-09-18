const test = require("node:test");
const assert = require("node:assert/strict");
test("execution list is ordered independently and excludes without deleting requests", async () => {
  const {runPlan,addToRun,executionRequests} = await import("../src/ui/run-plan.mjs");
  const col={requests:[{id:"a",url:"/a"},{id:"b",url:"/b"}]};
  const plan=runPlan(col);
  plan.reverse(); plan.forEach(x=>x.enabled=true);
  assert.deepEqual(executionRequests(col).map(x=>x.id),["b","a"]);
  assert.deepEqual(col.requests.map(x=>x.id),["a","b"]);
  col.runPlan=plan.filter(x=>x.id!=="a");
  assert.equal(col.requests.length,2);
  addToRun(col,["a","a","missing"]);
  assert.deepEqual(col.runPlan.map(x=>x.id),["b","a"]);
  const snapshot=executionRequests(col);
  col.requests[0].url="/changed";
  assert.equal(snapshot[1].url,"/a");
  const restored=JSON.parse(JSON.stringify(col));
  assert.deepEqual(executionRequests(restored).map(x=>x.id),["b","a"]);
  col.requests=col.requests.filter(x=>x.id!=="a");
  assert.deepEqual(runPlan(col).map(x=>x.id),["b"]);
});


test("runner excludes SSE and WebSocket requests", async () => {
  const {runPlan,addToRun,executionRequests} = await import("../src/ui/run-plan.mjs");
  const col={requests:[
    {id:"http",type:"http",url:"/"},
    {id:"sse",type:"sse",url:"/events"},
    {id:"ws",type:"websocket",url:"ws://localhost"},
  ]};
  assert.deepEqual(runPlan(col).map(x=>x.id),["http"]);
  addToRun(col,["sse","ws"]);
  assert.deepEqual(col.runPlan.map(x=>x.id),["http"]);
  col.runPlan[0].enabled=true;
  assert.deepEqual(executionRequests(col).map(x=>x.id),["http"]);
});
