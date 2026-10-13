import {test} from "node:test";
import assert from "node:assert/strict";
import {ensureEndpointMockRule,filterMockEndpoints} from "../src/ui/mock-rules.mjs";

const request=(extra={})=>({
  id:"users",name:"사용자 조회",group:"Accounts",
  method:"GET",url:"{{baseUrl}}/users/{{userId}}?include=profile",
  openapi:{path:"/users/{userId}"},...extra
});

test("quick mocking creates a base HTTP rule with a generated DTO response",()=>{
  const col={mock:{rules:[],scenarios:[{id:"slow",name:"Slow"}]}};
  const result=ensureEndpointMockRule(col,request({responses:{"201":{content:{"application/json":{schema:{type:"object"}}}}}}));
  assert.equal(result.created,true);
  assert.equal(result.path,"/users/{userId}");
  assert.equal(result.rule.method,"GET");
  assert.equal(result.rule.status,201);
  assert.equal(result.rule.responseMode,"generated");
  assert.equal(result.rule.scenarioId,undefined);
  assert.equal(col.mock.rules.length,1);
  assert.equal(ensureEndpointMockRule(col,request()).created,false);
  assert.equal(col.mock.rules.length,1);
});

test("quick mocking enables an existing proxy without replacing its settings or conditional/scene rules",()=>{
  const proxy={method:"GET",path:"/users/{userId}",mode:"proxy",status:418,body:'{"x":1}'};
  const conditional={method:"GET",path:proxy.path,mode:"mock",when:{query:{case:"error"}}};
  const scene={method:"GET",path:proxy.path,mode:"mock",scenarioId:"demo"};
  const col={mock:{rules:[conditional,scene,proxy]}};
  const result=ensureEndpointMockRule(col,request());
  assert.equal(result.created,false);
  assert.equal(result.rule,proxy);
  assert.equal(proxy.mode,"mock");
  assert.equal(proxy.status,418);
  assert.equal(col.mock.rules.length,3);
  assert.equal(col.mock.rules[0],conditional);
  assert.equal(col.mock.rules[1],scene);
});

test("quick mocking falls back to custom JSON when no schema and ignores query strings",()=>{
  const col={mock:{rules:[]}};
  const result=ensureEndpointMockRule(col,request({openapi:undefined,url:"https://api.example.com/items?limit=5",responses:{}}));
  assert.equal(result.path,"/items");
  assert.equal(result.rule.responseMode,"custom");
  assert.equal(result.rule.body,"{}");
});

test("quick mocking rejects realtime protocols and malformed paths without modifying collection",()=>{
  const col={mock:{rules:[]}};
  assert.throws(()=>ensureEndpointMockRule(col,request({type:"ws"})),/HTTP/);
  assert.throws(()=>ensureEndpointMockRule(col,request({openapi:undefined,url:"{{host}}/users"})),/URL/);
  assert.equal(col.mock.rules.length,0);
});

test("mock rule search handles case-insensitive method, URL, request name and group",()=>{
  const endpoints=[
    {method:"GET",path:"/users/{id}",request:request()},
    {method:"POST",path:"/orders",request:{name:"주문 생성",group:"Sales"}},
    {method:"GET",path:"/admin/roles",request:null},
  ];
  assert.equal(filterMockEndpoints(endpoints,""),endpoints);
  assert.deepEqual(filterMockEndpoints(endpoints,"GET user"),[endpoints[0]]);
  assert.deepEqual(filterMockEndpoints(endpoints,"sales post"),[endpoints[1]]);
  assert.deepEqual(filterMockEndpoints(endpoints,"ROLES"),[endpoints[2]]);
  assert.deepEqual(filterMockEndpoints(endpoints,"404"),[]);
});
