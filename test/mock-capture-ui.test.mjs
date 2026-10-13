import {test} from "node:test";
import assert from "node:assert/strict";
import {matchRequest,prepareCapturedRule,applyCapturedRule} from "../src/ui/mock-capture.mjs";

function collection(){
 return {id:"col",requests:[
  {id:"users-template",method:"GET",url:"{{baseUrl}}/users/{{id}}",openapi:{path:"/users/{id}"},
    responses:{"200":{content:{"application/json":{schema:{type:"object",properties:{id:{type:"integer"}}}}}}}},
  {id:"user-me",method:"GET",openapi:{path:"/users/me"}},
  {id:"orders",method:"POST",openapi:{path:"/orders"}},
 ],mock:{rules:[]}};
}
test("matchRequest resolves OpenAPI templates and prefers static paths",()=>{
 const col=collection();
 assert.equal(matchRequest(col,{method:"GET",path:"/users/123"})?.id,"users-template");
 assert.equal(matchRequest(col,{method:"GET",path:"/users/me"})?.id,"user-me");
 assert.equal(matchRequest(col,{method:"POST",path:"/users/123"}),null);
 assert.equal(matchRequest(col,{method:"GET",path:"/users/me",requestId:"users-template"})?.id,"users-template");
});
test("captured rule preserves response status and shared OpenAPI template",()=>{
 const col=collection();
 const candidate={requestId:"users-template",method:"GET",path:"/users/42",status:200,
   contentType:"application/json",body:'{"id":42}'};
 const result=prepareCapturedRule(col,candidate);
 assert.equal(result.rule.path,"/users/{id}");
 assert.equal(result.rule.responseMode,"custom");
 assert.equal(result.rule.status,200);
 assert.equal(result.overwriting,false);
 applyCapturedRule(col,result.rule);
 assert.equal(col.mock.rules.length,1);
 assert.equal(prepareCapturedRule(col,candidate).overwriting,true);
 applyCapturedRule(col,{...result.rule,body:'{"id":23}'});
 assert.equal(col.mock.rules.length,1);
 assert.equal(col.mock.rules[0].body,'{"id":23}');
});
test("capture creates literal-path rule for unknown endpoint",()=>{
 const col=collection();
 const result=prepareCapturedRule(col,{method:"GET",path:"/unknown/7",status:404,contentType:"application/json",body:'{"ok":false}'});
 assert.equal(result.request,null);
 assert.equal(result.rule.path,"/unknown/7");
 applyCapturedRule(col,result.rule);
 assert.equal(col.mock.rules[0].status,404);
});

test("captured Network response replaces only the unconditional rule",()=>{
  const col=collection();
  col.mock.rules=[
    {method:"GET",path:"/users/{id}",mode:"mock",when:{query:{scenario:"error"}},body:'{"id":1}',status:503},
    {method:"GET",path:"/users/{id}",mode:"mock",body:'{"id":10}',status:200},
  ];
  const candidate={requestId:"users-template",method:"GET",path:"/users/42",status:200,
    contentType:"application/json",body:'{"id":42}'};
  assert.equal(prepareCapturedRule(col,candidate).overwriting,true);
  applyCapturedRule(col,prepareCapturedRule(col,candidate).rule);
  assert.equal(col.mock.rules.length,2);
  assert.equal(col.mock.rules[0].status,503);
  assert.equal(col.mock.rules[0].when.query.scenario,"error");
  assert.equal(col.mock.rules[1].body,'{"id":42}');
  col.mock.rules.splice(1);
  assert.equal(prepareCapturedRule(col,candidate).overwriting,false);
  applyCapturedRule(col,prepareCapturedRule(col,candidate).rule);
  assert.equal(col.mock.rules.length,2);
});
