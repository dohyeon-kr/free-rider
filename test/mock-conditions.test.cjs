const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const {matchRule,createMockServer,requireConfig}=require("../src/modules/mock/server.cjs");
const {matchWhen,validateWhen,conditionCount}=require("../src/modules/mock/conditions.cjs");

const base={method:"GET",path:"/users/{id}",mode:"mock",responseMode:"custom",status:200,body:'{"case":"default"}'};
function fixture(rules){return {id:"fixture",title:"Conditions",mock:{rules},requests:[]};}
async function freePort(){
  const s=http.createServer();
  await new Promise(resolve=>s.listen(0,"127.0.0.1",resolve));
  const port=s.address().port;
  await new Promise(resolve=>s.close(resolve));
  return port;
}
test("query and header matching are exact, case-insensitive for header names",()=>{
  const when={query:{scenario:"error"},headers:{"X-Debug":"on"}};
  assert.equal(conditionCount(when),2);
  assert.equal(matchWhen(when,{url:"/users/1?scenario=ok&scenario=error",
    headers:{"x-debug":"on"},body:""}),true);
  assert.equal(matchWhen(when,{url:"/users/1?scenario=error",
    headers:{"x-debug":"OFF"},body:""}),false);
  assert.equal(matchWhen(when,{url:"/users/1?scenario=ok",
    headers:{"x-debug":"on"},body:""}),false);
});
test("nested JSON body subset conditions and invalid JSON",()=>{
  const when={body:{data:{id:42,opts:{active:true}},tags:["a","b"]}};
  const matching={data:{id:42,opts:{active:true,name:"extra"}},tags:["a","b"],extra:"ok"};
  assert.equal(matchWhen(when,{body:JSON.stringify(matching)}),true);
  assert.equal(matchWhen(when,{body:JSON.stringify({...matching,tags:["a"]})}),false);
  assert.equal(matchWhen(when,{body:"{invalid"}),false);
});
test("static paths win, then more specific conditions, then insertion order",()=>{
  const rules=[
    {...base,body:'{"case":"fallback"}'},
    {...base,when:{query:{scenario:"slow"}},body:'{"case":"conditional"}'},
    {...base,when:{query:{scenario:"slow"},headers:{"x-demo":"yes"}},body:'{"case":"more"}'},
    {...base,path:"/users/me",body:'{"case":"static"}'}
  ];
  assert.equal(matchRule(rules,"GET","/users/5",{url:"/users/5?scenario=slow",headers:{"x-demo":"yes"}}).body,'{"case":"more"}');
  assert.equal(matchRule(rules,"GET","/users/5",{url:"/users/5?scenario=slow"}).body,'{"case":"conditional"}');
  assert.equal(matchRule(rules,"GET","/users/me",{url:"/users/me?scenario=slow"}).body,'{"case":"static"}');
  assert.equal(matchRule(rules,"GET","/users/5",{url:"/users/5"}).body,'{"case":"fallback"}');
  assert.equal(matchRule(rules.filter(x=>x.when),"GET","/users/5",{url:"/users/5"}),null);
});
test("invalid conditions and delays are rejected before server start",()=>{
  const config=rules=>({port:4010,collection:fixture(rules)});
  assert.throws(()=>requireConfig(config([{...base,delayMs:30001}])),/delay/);
  assert.throws(()=>requireConfig(config([{...base,delayMs:-1}])),/delay/);
  assert.throws(()=>requireConfig(config([{...base,fault:"crash"}])),/fault/);
  assert.throws(()=>requireConfig(config([{...base,when:{query:{n:123}}}])),/values must be strings/);
  assert.throws(()=>validateWhen({headers:{"bad name":"x"}}),/header key/);
  assert.throws(()=>validateWhen({body:["not-object"]}),/JSON object/);
  assert.throws(()=>validateWhen({query:{"__proto__":"x"},cookies:{foo:"bar"}}),/only query/);
});
test("HTTP conditional variants, delayed error and fallthrough proxy",async t=>{
  const upstream=http.createServer((_req,res)=>{res.setHeader("content-type","application/json");res.end('{"case":"real"}');});
  await new Promise(resolve=>upstream.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>upstream.close(resolve)));
  const events=[];
  const server=createMockServer({onEntry:e=>events.push(e)});
  t.after(()=>server.stop());
  const rules=[
    {...base,when:{query:{scenario:"http"}},status:503,body:'{"case":"unavailable"}',delayMs:40},
    {...base,when:{query:{scenario:"timeout"}},fault:"timeout",delayMs:10},
    {...base,when:{query:{scenario:"disconnect"}},fault:"disconnect"},
    {...base,when:{headers:{"X-Flavor":"special"}},body:'{"case":"header"}'},
    {...base,when:{body:{mode:"test"}},method:"POST",body:'{"case":"body"}'}
  ];
  const port=await freePort();
  await server.start({port,collection:fixture(rules),upstream:"http://127.0.0.1:"+upstream.address().port});
  const root="http://127.0.0.1:"+port+"/users/12";
  const started=Date.now();
  const fail=await fetch(root+"?scenario=http");
  assert.equal(fail.status,503);
  assert.deepEqual(await fail.json(),{case:"unavailable"});
  assert.ok(Date.now()-started>=35,"expected simulated delay");
  const timeout=await fetch(root+"?scenario=timeout");
  assert.equal(timeout.status,504);
  assert.equal((await timeout.json()).error,"Simulated upstream timeout");
  const header=await fetch(root,{headers:{"X-Flavor":"special"}});
  assert.equal((await header.json()).case,"header");
  const body=await fetch(root,{method:"POST",headers:{"Content-Type":"application/json"},body:'{"mode":"test","other":1}'});
  assert.equal((await body.json()).case,"body");
  const passthrough=await fetch(root+"?unknown=true");
  assert.equal((await passthrough.json()).case,"real");
  await assert.rejects(fetch(root+"?scenario=disconnect"));
  assert.deepEqual(events.map(e=>e.mode),["mock","mock","mock","mock","proxy","mock"]);
  const dropped=events.at(-1);
  assert.equal(dropped.response.status,0);
  assert.match(dropped.response.error,/Simulated connection drop/);
  await server.stop();
});
