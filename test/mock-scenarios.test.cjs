const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const {createMockServer,matchRule,requireConfig}=require("../src/modules/mock/server.cjs");

const rule=(body,scenarioId,when)=>({method:"GET",path:"/users/{id}",mode:"mock",status:200,
  responseMode:"custom",body:JSON.stringify({result:body}),...(scenarioId?{scenarioId}:{}),...(when?{when}:{})});
const collection=()=>({id:"col",title:"Course fixture",requests:[],mock:{
  scenarios:[{id:"error",name:"Failure"},{id:"slow",name:"Slow"}],
  rules:[rule("default"),rule("failure","error"),rule("slow","slow"),
    rule("specific","error",{query:{flavor:"special"}})]}});
async function freePort() {
 const server=http.createServer();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 return port;
}
test("default and active scenario override with conditional precedence",()=>{
 const rules=collection().mock.rules;
 const ctx=(url)=>({url});
 assert.equal(JSON.parse(matchRule(rules,"GET","/users/42",ctx("/users/42")).body).result,"default");
 assert.equal(JSON.parse(matchRule(rules,"GET","/users/42",ctx("/users/42"),"error").body).result,"failure");
 assert.equal(JSON.parse(matchRule(rules,"GET","/users/42",ctx("/users/42?flavor=special"),"error").body).result,"specific");
 assert.equal(JSON.parse(matchRule(rules,"GET","/users/42",ctx("/users/42"),"slow").body).result,"slow");
});
test("invalid scenario references and duplicate IDs are rejected",()=>{
 assert.throws(()=>requireConfig({collection:{...collection(),mock:{...collection().mock,
   rules:[rule("no","unknown")]}}}),/unknown scenario/);
 assert.throws(()=>requireConfig({collection:{...collection(),mock:{...collection().mock,
   scenarios:[{id:"error",name:"A"},{id:"error",name:"B"}]}}}),/duplicate/);
});
test("HTTP scenario lease restores previous state and blocks concurrent changes",async t=>{
 const port=await freePort(),events=[];
 const server=createMockServer({onEntry:entry=>events.push(entry)});
 t.after(()=>server.stop());
 await server.start({port,collection:collection()});
 const url="http://127.0.0.1:"+port+"/users/99";
 assert.equal((await (await fetch(url)).json()).result,"default");
 server.selectScenario("slow");
 assert.equal((await (await fetch(url)).json()).result,"slow");
 const lease=server.acquireScenario("error");
 assert.equal(server.status().scenarioId,"error");
 assert.equal((await (await fetch(url)).json()).result,"failure");
 assert.equal((await (await fetch(url+"?flavor=special")).json()).result,"specific");
 assert.throws(()=>server.selectScenario("slow"),/locked/);
 assert.throws(()=>server.acquireScenario("slow"),/Another scenario/);
 assert.throws(()=>server.configure({port,collection:collection()}),/during a scenario-bound Ride/);
 assert.throws(()=>server.releaseScenario("incorrect"),/invalid or expired/);
 server.releaseScenario(lease.token);
 assert.equal(server.status().scenarioId,"slow");
 assert.equal((await (await fetch(url)).json()).result,"slow");
 assert.equal(events[2].scenarioId,"error");
 await server.stop();
 assert.equal(server.status().scenarioId,"");
});
