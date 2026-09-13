const test=require("node:test"),assert=require("node:assert/strict");
const {runScript}=require("../src/modules/scripts/index.cjs");
test("isolated adapters expose req/res and variables without host access",async()=>{
 const result=await runScript('await Promise.resolve(); req.headers.set("X-Test",ctx.env.get("NAME"));ctx.vars.set("token",res.json().token);ctx.log(typeof process,typeof fetch);',
 {req:{url:"https://example.com",method:"GET",headers:{}},res:{status:200,headers:{},body:'{"token":"abc"}'},vars:{},env:{NAME:"dev"}});
 assert.equal(result.req.headers["x-test"],"dev");assert.equal(result.changes.token,"abc");
 assert.deepEqual(result.logs,["undefined undefined"]);
});
test("infinite scripts and cancellation terminate",async()=>{
 await assert.rejects(runScript("while(true){}",{req:{headers:{}},vars:{},env:{}}));
 const abort=new AbortController();const result=runScript("while(true){}",{req:{headers:{}},vars:{},env:{}},abort.signal);
 abort.abort();await assert.rejects(result,/취소/);
});
test("request pipeline applies headers, captures arbitrary response data and preserves post-error body",async t=>{
 const http=require("node:http"),{execute}=require("../src/modules/runner/index.cjs");
 const server=http.createServer((req,res)=>res.end(JSON.stringify({value:req.headers["x-before"]})));
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const request={method:"GET",url:"http://127.0.0.1:"+server.address().port,headers:{}};
 const result=await execute(request,{},null,{enabled:true,before:'req.headers.set("X-Before","yes");',after:'ctx.vars.set("custom",res.json().value);'});
 assert.equal(result.variables.custom,"yes");assert.deepEqual(request.headers,{});
 const failed=await execute(request,{},null,{enabled:true,after:'throw Error("after failed");'});
 assert.equal(failed.status,200);assert.match(failed.scriptError,/after failed/);assert.equal(failed.body,"{}");
});
test("variable deletion survives pre/post processing and legacy extraction errors preserve response",async t=>{
 const http=require("node:http"),{execute}=require("../src/modules/runner/index.cjs");
 const server=http.createServer((req,res)=>res.end('{"token":"new"}'));
 await new Promise(r=>server.listen(0,"127.0.0.1",r));t.after(()=>{server.closeAllConnections();server.close();});
 const request={method:"GET",url:"http://127.0.0.1:"+server.address().port,headers:{}};
 const deleted=await execute(request,{token:"old"},null,{enabled:true,before:'ctx.vars.set("token","pre");',after:'ctx.vars.delete("token");'});
 assert.deepEqual(deleted.deleted,["token"]);assert.equal(Object.hasOwn(deleted.variables,"token"),false);
 const reset=await execute(request,{token:"old"},null,{enabled:true,before:'ctx.vars.delete("token");',after:'if(ctx.vars.get("token")!==undefined)throw Error("not deleted");ctx.vars.set("token","after");'});
 assert.deepEqual(reset.deleted,[]);assert.equal(reset.variables.token,"after");
 const failed=await execute({...request,extract:{token:"missing"}},{});
 assert.equal(failed.status,200);assert.match(failed.scriptError,/응답 추출/);assert.equal(failed.body,'{"token":"new"}');
});
