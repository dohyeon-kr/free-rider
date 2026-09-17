const test=require("node:test"), assert=require("node:assert/strict");
test("review preserves unselected baseline and requires explicit conflict resolution",async()=>{
 const {preview,applyReview}=await import("../src/modules/sync/review.mjs");
 const base={id:"GET /a",url:"/a",body:"old"}, next={...base,body:"new"};
 const old=[{...base,body:"mine",assertions:[{value:200}],baseline:base},{id:"GET /b",baseline:{id:"GET /b"}},{id:"manual",manual:true}];
 const generated=[next,{id:"GET /c",url:"/c"}], review=preview(old,generated);
 assert.equal(review.changes[0].fields[0].conflict,true);
 assert.deepEqual(applyReview(old,review,[]),old);
 assert.throws(()=>applyReview(old,review,[base.id]),/충돌/);
 const kept=applyReview(old,review,[base.id],{[JSON.stringify([base.id,"body"])]:"local"});
 assert.equal(kept[0].body,"mine");assert.deepEqual(kept[0].baseline,next);
 assert.deepEqual(kept[0].assertions,[{value:200}]);
 assert.equal(preview(kept,generated).changes.some(c=>c.id===base.id),false);
 assert.equal(preview(kept,generated).changes.some(c=>c.id==="GET /c"),true);
 const deleted=applyReview(old,review,["GET /b"]);
 assert.equal(deleted.some(r=>r.id==="GET /b"),false);
 assert.equal(deleted.some(r=>r.id==="manual"),true);
 assert.throws(()=>applyReview([...old,{id:"x"}],review,[]),/再|다시/);
});
test("incoming fields update while user-only edits remain and JSON ordering is stable",async()=>{
 const {preview,applyReview}=await import("../src/modules/sync/review.mjs");
 const base={id:"a",body:"old",name:"old",headers:{a:1,b:2}};
 const old=[{...base,name:"custom",baseline:base}], incoming=[{...base,body:"new",headers:{b:2,a:1}}];
 const review=preview(old,incoming);assert.equal(review.changes[0].fields.length,1);
 const result=applyReview(old,review,["a"]);
 assert.equal(result[0].name,"custom");assert.equal(result[0].body,"new");
});
test("independent query edits merge and nested schema changes are reviewed separately",async()=>{
 const {preview,applyReview}=await import("../src/modules/sync/review.mjs");
 const base={id:"GET /x",query:{limit:"20",page:"1"},responses:{"200":{type:"object",description:"old"}}};
 const local={...base,query:[{key:"limit",value:"20",enabled:true},{key:"page",value:"7",enabled:true}],baseline:base};
 const next={...base,query:{limit:"50",page:"1"},responses:{"200":{type:"object",description:"new"}}};
 const review=preview([local],[next]);
 assert.deepEqual(review.changes[0].fields.map(f=>f.key),["query/limit","responses/200/description"]);
 assert.equal(review.changes[0].fields.some(f=>f.conflict),false);
 const result=applyReview([local],review,[base.id])[0];
 assert.equal(result.query.find(r=>r.key==="limit").value,"50");
 assert.equal(result.query.find(r=>r.key==="page").value,"7");
});

test("removed operations are classified as breaking changes",async()=>{
 const {preview}=await import("../src/modules/sync/review.mjs");
 const base={id:"GET /users",method:"GET",openapi:{path:"/users",parameters:[]}};
 const review=preview([{...base,baseline:base}],[]);
 assert.equal(review.breakingCount,1);
 assert.equal(review.changes[0].breaking,true);
 assert.equal(review.changes[0].breakingReasons[0].code,"operation-removed");
});

test("new required request inputs are breaking while optional inputs are not",async()=>{
 const {preview}=await import("../src/modules/sync/review.mjs");
 const base={id:"GET /users",openapi:{path:"/users",parameters:[{name:"page",in:"query",required:false,schema:{type:"integer"}}]}};
 const required={...base,openapi:{...base.openapi,parameters:[...base.openapi.parameters,{name:"tenant",in:"header",required:true,schema:{type:"string"}}]}};
 const optional={...base,openapi:{...base.openapi,parameters:[...base.openapi.parameters,{name:"sort",in:"query",required:false,schema:{type:"string"}}]}};
 const requiredReview=preview([{...base,baseline:base}],[required]);
 const optionalReview=preview([{...base,baseline:base}],[optional]);
 assert.equal(requiredReview.breakingCount,1);
 assert.equal(requiredReview.changes[0].breakingReasons.some(r=>r.code==="required-parameter-added"),true);
 assert.equal(optionalReview.breakingCount,0);
});

test("request schema narrowing and required body changes are classified as breaking",async()=>{
 const {preview}=await import("../src/modules/sync/review.mjs");
 const base={id:"POST /users",openapi:{path:"/users",parameters:[{name:"role",in:"query",required:false,schema:{type:"string",enum:["admin","member"]}}],requestBody:{required:false,contentType:"application/json",content:{"application/json":{schema:{type:"object",properties:{name:{type:"string"}},required:[]}}}}}};
 const next=structuredClone(base);
 next.openapi.parameters[0].schema.enum=["admin"];
 next.openapi.requestBody.required=true;
 next.openapi.requestBody.content["application/json"].schema.required=["name"];
 const review=preview([{...base,baseline:base}],[next]);
 const codes=review.changes[0].breakingReasons.map(r=>r.code);
 assert.equal(review.breakingCount,1);
 assert.equal(codes.includes("parameter-enum-narrowed"),true);
 assert.equal(codes.includes("request-body-became-required"),true);
 assert.equal(codes.includes("request-property-became-required"),true);
});

test("removed success responses and incompatible response schemas are breaking",async()=>{
 const {preview}=await import("../src/modules/sync/review.mjs");
 const base={id:"GET /users",responses:{"200":{description:"ok",content:{"application/json":{schema:{type:"object",properties:{id:{type:"string"},name:{type:"string"}}}}}},"404":{description:"not found"}},openapi:{path:"/users",parameters:[]}};
 const removed=structuredClone(base); delete removed.responses["200"];
 const changed=structuredClone(base); delete changed.responses["200"].content["application/json"].schema.properties.name;
 const removedReview=preview([{...base,baseline:base}],[removed]);
 const changedReview=preview([{...base,baseline:base}],[changed]);
 assert.equal(removedReview.changes[0].breakingReasons.some(r=>r.code==="success-response-removed"),true);
 assert.equal(changedReview.changes[0].breakingReasons.some(r=>r.code==="response-property-removed"),true);
});

test("description-only OpenAPI changes are not classified as breaking",async()=>{
 const {preview}=await import("../src/modules/sync/review.mjs");
 const base={id:"GET /users",description:"old",responses:{"200":{description:"old"}},openapi:{path:"/users",parameters:[]}};
 const next={...base,description:"new",responses:{"200":{description:"new"}}};
 const review=preview([{...base,baseline:base}],[next]);
 assert.equal(review.breakingCount,0);
 assert.equal(review.changes[0].breaking,false);
});
