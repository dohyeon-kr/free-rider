const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const {generate,validate,responseFor}=require("../src/modules/mock/schema.cjs");
const {createMockServer,matchRule,upstreamUrl,safeHeaders,safeBody,requireConfig}=require("../src/modules/mock/server.cjs");

const userSchema={type:"object",required:["id","email","role"],properties:{
  id:{type:"string",format:"uuid"},
  email:{type:"string",format:"email"},
  role:{type:"string",enum:["ADMIN","USER"]},
  age:{type:"integer",minimum:18,maximum:100},
  active:{type:"boolean"}
}};
function collection(rules=[]){
  return {id:"col-1",title:"Fixture",mock:{rules},requests:[{
    id:"GET /users",method:"GET",url:"{{baseUrl}}/users",
    openapi:{path:"/users"},
    responses:{"200":{content:{"application/json":{schema:userSchema,
      example:{id:"00000000-0000-4000-8000-000000000001",email:"x@example.com",role:"USER",age:23,active:true}}}}}
  }]};
}
async function port(){
  const s=http.createServer();
  await new Promise(resolve=>s.listen(0,"127.0.0.1",resolve));
  const n=s.address().port;
  await new Promise(resolve=>s.close(resolve));
  return n;
}
test("generator produces contract-valid data and rejects violations",()=>{
  const data=generate(userSchema);
  assert.deepEqual(validate(userSchema,data),[]);
  assert.equal(data.age,18);
  assert.ok(validate(userSchema,{id:"not-uuid",email:"invalid",role:"NONE",age:3}).length>2);
  assert.ok(validate({type:"array",minItems:2,uniqueItems:true,items:{type:"integer"}},[1,1]).length>0);
  assert.deepEqual(validate({allOf:[{type:"number",minimum:1},{type:"number",maximum:4}]},5),["$: above maximum"]);
});
test("example and custom response get validation",()=>{
  const req=collection().requests[0];
  assert.equal(JSON.parse(responseFor(req,{status:200,responseMode:"generated"}).body).age,18);
  assert.equal(JSON.parse(responseFor(req,{status:200,responseMode:"example"}).body).age,23);
  assert.throws(()=>responseFor(req,{status:200,responseMode:"custom",body:'{"role":"INVALID"}'}),/violates OpenAPI/);
  assert.throws(()=>responseFor(req,{status:200,responseMode:"custom",body:"{oops"}),/not valid JSON/);
});
test("routing favors static paths and keeps query in upstream URL",()=>{
  assert.equal(matchRule([{method:"GET",path:"/users/{id}",mode:"mock"},{method:"GET",path:"/users/me",mode:"proxy"}],"GET","/users/me").mode,"proxy");
  assert.equal(upstreamUrl("https://example.com/v1","/users?page=2").href,"https://example.com/v1/users?page=2");
  assert.throws(()=>requireConfig({port:48173,collection:collection()}),/Invalid/);
  assert.throws(()=>requireConfig({port:4010,collection:collection(),upstream:"http://127.0.0.1:4010"}),/cannot point/);
});
test("secret fields are scrubbed from network history",()=>{
  assert.equal(safeHeaders({Authorization:"Bearer secret",Accept:"application/json"}).Authorization,"[redacted]");
  assert.deepEqual(JSON.parse(safeBody(Buffer.from('{"accessToken":"abc","nested":{"password":"hi"},"id":1}'),"application/json")),
    {accessToken:"[redacted]",nested:{password:"[redacted]"},id:1});
});
test("loopback mock/proxy: selection, passthrough, CORS and network events",async t=>{
  const upstream=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    res.setHeader("content-type","application/json");
    res.end(JSON.stringify({method:req.method,path:req.url,body:Buffer.concat(chunks).toString(),auth:req.headers.authorization}));
  });
  await new Promise(resolve=>upstream.listen(0,"127.0.0.1",resolve));
  t.after(()=>new Promise(resolve=>upstream.close(resolve)));
  const mockPort=await port(),events=[];
  const server=createMockServer({onEntry:e=>events.push(e)});
  t.after(()=>server.stop());
  assert.equal(server.status().enabled,false);
  const rules=[{method:"GET",path:"/users",mode:"mock",status:200,responseMode:"generated"}];
  await server.start({port:mockPort,upstream:"http://127.0.0.1:"+upstream.address().port,
    collection:collection(rules)});
  const local="http://127.0.0.1:"+mockPort;
  const mocked=await fetch(local+"/users");
  assert.equal(mocked.status,200);
  assert.equal((await mocked.json()).role,"ADMIN");
  const passthrough=await fetch(local+"/orders?q=a",{method:"POST",headers:{"Authorization":"Bearer secret","Content-Type":"application/json"},
    body:JSON.stringify({password:"private",id:11})});
  assert.equal(passthrough.status,200);
  const payload=await passthrough.json();
  assert.equal(payload.path,"/orders?q=a");
  assert.equal(payload.auth,"Bearer secret");
  assert.equal(payload.body,'{"password":"private","id":11}');
  const preflight=await fetch(local+"/users",{method:"OPTIONS",headers:{Origin:"http://localhost:3000",
    "Access-Control-Request-Method":"GET"}});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get("access-control-allow-origin"),"http://localhost:3000");
  assert.equal(events.length,2);
  assert.deepEqual(events.map(x=>x.mode),["mock","proxy"]);
  assert.equal(events[1].request.headers.authorization,"[redacted]");
  assert.ok(!JSON.stringify(events).includes("private"));
  assert.equal(server.status().enabled,true);
  await server.stop();
  assert.equal(server.status().enabled,false);
});
test("mock schema failure returns an explicit error without falling back to upstream",async t=>{
  const mockPort=await port();
  const server=createMockServer();
  t.after(()=>server.stop());
  await server.start({port:mockPort,collection:collection([{method:"GET",path:"/users",mode:"mock",
    status:200,responseMode:"custom",body:'{"role":"BAD"}'}])});
  const response=await fetch("http://127.0.0.1:"+mockPort+"/users");
  assert.equal(response.status,502);
  assert.match((await response.json()).error,/violates OpenAPI/);
  const unknown=await fetch("http://127.0.0.1:"+mockPort+"/other");
  assert.equal(unknown.status,502);
  await server.stop();
});
