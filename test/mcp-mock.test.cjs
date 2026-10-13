const test=require("node:test");
const assert=require("node:assert/strict");
const {createMcpServer}=require("../src/modules/mcp/server.cjs");
function fixture(){
 return {
  mockServer:{port:4010,upstreams:{col:"http://127.0.0.1:7000"}},
  collections:[{id:"col",title:"Fixture",
   mock:{scenarios:[{id:"error",name:"Error"}],rules:[{method:"GET",path:"/users",mode:"mock",
     status:200,responseMode:"custom",body:'{"ok":true}'}]},
   requests:[{id:"one",method:"GET",url:"http://127.0.0.1:4010/users"}],
   environments:[{id:"dev",name:"Local",values:{baseUrl:"http://127.0.0.1:4010"}}],
   rides:[{id:"ride1",name:"Smoke",stopOnFailure:true,steps:[{id:"s1",requestId:"one"}],mockScenarioId:"error"}]
  }]
 };
}
function harness(overrides={}){
 let state=fixture(),stored=null,reloads=0,unsaved=false,runtime={enabled:false,collectionId:"",scenarioId:""};
 let lease=null;const selections=[];
 const bridge={
  loadWorkspace:async()=>structuredClone(state),
  saveWorkspace:async next=>{stored=structuredClone(next);state=structuredClone(next);return true;},
  reloadWorkspace:async()=>{reloads++;},
  hasUnsavedChanges:()=>unsaved,
  runSavedRequest:async()=>({status:200}),
  loadNetworkHistory:async()=>[],
  saveCollectionInterceptors:async({interceptors})=>interceptors,
  mockState:async()=>structuredClone(runtime),
  mockStart:async config=>{runtime={enabled:true,collectionId:config.collection.id,scenarioId:""};return runtime;},
  mockStop:async()=>{runtime={enabled:false,collectionId:"",scenarioId:""};return runtime;},
  mockSelectScenario:async id=>{if(!runtime.enabled)throw Error("Not running");runtime.scenarioId=id;selections.push(id);return runtime;},
  mockUpdate:async()=>runtime,
  mockAcquireScenario:async id=>{
    if(lease)throw Error("busy");
    lease={token:"lease1",previous:runtime.scenarioId};
    runtime.scenarioId=id;selections.push(id);
    return {...runtime,token:lease.token};
  },
  mockReleaseScenario:async token=>{
    if(!lease||token!==lease.token)throw Error("invalid lease");
    runtime.scenarioId=lease.previous;lease=null;selections.push(runtime.scenarioId);
    return runtime;
  },
  ...overrides
 };
 const rpc=createMcpServer(bridge);
 async function call(name,args={}){
  const reply=await rpc.handle({jsonrpc:"2.0",id:1,method:"tools/call",params:{name,arguments:args}});
  if(reply.result.isError)throw Error(reply.result.content[0].text);
  return JSON.parse(reply.result.content[0].text);
 }
 return {call,setUnsaved:v=>{unsaved=v;},start:async()=>bridge.mockStart({collection:state.collections[0]}),
   get stored(){return stored;},get runtime(){return runtime;},get selections(){return selections;},get reloads(){return reloads;}};
}
test("MCP tools list Mock server status and rules without exposing response body",async()=>{
 const m=harness();
 const info=await m.call("get_mock_server",{collectionId:"col"});
 assert.equal(info.enabled,false);
 assert.deepEqual(info.scenarios,[{id:"error",name:"Error"}]);
 assert.equal(info.upstreamConfigured,true);
 const rules=await m.call("list_mock_rules",{collectionId:"col"});
 assert.equal(rules.length,1);
 assert.equal(rules[0].index,0);
 assert.ok(!JSON.stringify(rules).includes('{"ok":true}'));
});
test("MCP can start, select and stop the local Mock server",async()=>{
 const m=harness();
 const started=await m.call("start_mock_server",{collectionId:"col"});
 assert.equal(started.enabled,true);
 const selected=await m.call("select_mock_scenario",{collectionId:"col",scenarioId:"error"});
 assert.equal(selected.scenarioId,"error");
 assert.equal((await m.call("stop_mock_server")).enabled,false);
 await assert.rejects(m.call("select_mock_scenario",{collectionId:"col",scenarioId:"error"}),/Start the Mock server/);
});
test("MCP scenario and rule writes persist and validate the saved workspace",async()=>{
 const m=harness();
 const created=await m.call("set_mock_scenario",{collectionId:"col",name:"Offline"});
 assert.equal(created.name,"Offline");
 assert.equal(m.stored.collections[0].mock.scenarios.length,2);
 const rule={method:"GET",path:"/users",mode:"mock",scenarioId:created.id,
   status:503,responseMode:"custom",body:'{"error":"offline"}'};
 const inserted=await m.call("set_mock_rule",{collectionId:"col",rule});
 assert.equal(inserted.index,1);
 assert.equal(m.stored.collections[0].mock.rules.length,2);
 await assert.rejects(m.call("set_mock_rule",{collectionId:"col",
   rule:{...rule,scenarioId:"not-found"}}),/unknown scenario/);
 await assert.rejects(m.call("set_mock_rule",{collectionId:"col",
   rule:{...rule,delayMs:99999}}),/delay/);
 assert.equal(m.stored.collections[0].mock.rules.length,2);
 assert.ok(m.reloads>=2);
});
test("MCP Mock mutation refuses unsaved UI changes",async()=>{
 const m=harness();m.setUnsaved(true);
 await assert.rejects(m.call("set_mock_scenario",{collectionId:"col",name:"Uncommitted"}),/Save the Free Rider workspace/);
 await assert.rejects(m.call("start_mock_server",{collectionId:"col"}),/Save Free Rider workspace/);
 assert.equal(m.stored,null);
});
test("MCP ride_course applies the bound Mock scenario then restores previous selection",async()=>{
 const m=harness();
 await m.start();
 const result=await m.call("ride_course",{collectionId:"col",courseId:"ride1"});
 assert.equal(result.state,"passed");
 assert.deepEqual(m.selections,["error",""]);
 assert.equal(m.runtime.scenarioId,"");
 const course=await m.call("get_course",{collectionId:"col",courseId:"ride1"});
 assert.equal(course.mockScenarioId,"error");
 const changed=await m.call("set_course",{collectionId:"col",courseId:"ride1",requestIds:["one"],mockScenarioId:""});
 assert.equal(changed.mockScenarioId,"");
});
test("MCP ride_course releases lease even when request execution throws",async()=>{
 const m=harness({runSavedRequest:async()=>{throw Error("bad request");}});
 await m.start();
 const result=await m.call("ride_course",{collectionId:"col",courseId:"ride1"});
 assert.equal(result.state,"failed");
 assert.deepEqual(m.selections,["error",""]);
});

test("MCP mutation does not persist during a scenario-bound Course",async()=>{
 const m=harness({mockState:async()=>({enabled:true,collectionId:"col",scenarioId:"error",scenarioLocked:true})});
 await assert.rejects(m.call("set_mock_scenario",{collectionId:"col",name:"Nope"}),/during a scenario-bound Course/);
 await assert.rejects(m.call("set_mock_rule",{collectionId:"col",
   rule:{method:"GET",path:"/users",mode:"proxy"}}),/during a scenario-bound Course/);
 assert.equal(m.stored,null);
});
