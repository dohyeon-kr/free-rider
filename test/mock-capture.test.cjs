const test=require("node:test");
const assert=require("node:assert/strict");
const {captureCandidate,contentType}=require("../src/modules/mock/capture.cjs");
const {responseFor}=require("../src/modules/mock/schema.cjs");

function entry(overrides={}) {
  return {
    id:"entry-1",collectionId:"collection-1",requestId:"req-1",
    request:{method:"GET",url:"https://example.com/users/42?accessToken=secret"},
    response:{status:200,headers:{"Content-Type":"application/json; charset=utf-8"},
      body:JSON.stringify({id:42,name:"Sample",accessToken:"abc",nested:{password:"hidden"},
        detail:'{"session":"session-secret","ok":true}',auth:"Bearer high-secret"})},
    ...overrides,
  };
}
test("Network candidate is JSON-only, sanitized, and drops query parameters",()=>{
  const result=captureCandidate(entry());
  assert.equal(result.path,"/users/42");
  assert.equal(result.status,200);
  assert.equal(result.method,"GET");
  assert.equal(result.contentType,"application/json");
  assert.equal(result.requestId,"req-1");
  assert.ok(!result.body.includes("session-secret"));
  assert.ok(!result.body.includes("high-secret"));
  assert.ok(!result.body.includes('"abc"'));
  const parsed=JSON.parse(result.body);
  assert.equal(parsed.accessToken,"[redacted]");
  assert.equal(parsed.nested.password,"[redacted]");
  assert.equal(parsed.auth,"[redacted]");
});
test("reject non-JSON, truncated, empty, abnormal status and non-HTTP",()=>{
  assert.throws(()=>captureCandidate(entry({response:{status:200,body:"anything",headers:{"content-type":"text/plain"}}})),/JSON/);
  assert.throws(()=>captureCandidate(entry({response:{status:200,body:"{}",bodyTruncated:true}})),/Truncated/);
  assert.throws(()=>captureCandidate(entry({response:{status:204,body:"{}"}})),/JSON body/);
  assert.throws(()=>captureCandidate(entry({response:{status:0,body:"{}"}})),/JSON body/);
  assert.throws(()=>captureCandidate(entry({response:{status:200,body:"invalid"}})),/not valid JSON/);
  assert.throws(()=>captureCandidate(entry({request:{method:"CONNECT",url:"https://example.com/users"}})),/HTTP requests/);
});
test("custom capture can be validated against an OpenAPI DTO",()=>{
  const candidate=captureCandidate(entry({response:{status:200,headers:{"content-type":"application/problem+json"},
    body:JSON.stringify({id:42,name:"Sample"})}}));
  assert.equal(candidate.contentType,"application/problem+json");
  const request={responses:{"200":{content:{"application/problem+json":{
    schema:{type:"object",required:["id","name"],properties:{id:{type:"integer"},name:{type:"string"}}}
  }}}}};
  const output=responseFor(request,{status:200,responseMode:"custom",body:candidate.body,contentType:candidate.contentType});
  assert.equal(JSON.parse(output.body).name,"Sample");
});
test("capture handles content types in case insensitive headers",()=>{
  assert.equal(contentType({"content-type":"Application/JSON; Charset=UTF-8"}),"application/json");
  assert.equal(contentType({"CONTENT-TYPE":["application/problem+json","other"]}),"application/problem+json");
});
