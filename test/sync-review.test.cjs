const test=require("node:test"), assert=require("node:assert/strict");
test("review preserves unselected baseline and requires explicit conflict resolution",async()=>{
 const {preview,applyReview}=await import("../src/modules/sync/review.mjs");
 const base={id:"GET /a",method:"GET",openapi:{path:"/a",method:"GET",parameters:[{name:"page",in:"query",required:false,schema:{type:"integer"}}]}};
 const next=structuredClone(base);next.openapi.parameters[0].schema.type="string";
 const local=structuredClone(base);local.openapi.parameters[0].schema.type="boolean";local.assertions=[{value:200}];local.baseline=base;
 const old=[local,{id:"GET /b",baseline:{id:"GET /b"}},{id:"manual",manual:true}];
 const generated=[next,{id:"GET /c",method:"GET",openapi:{path:"/c",method:"GET",parameters:[]}}], review=preview(old,generated);
 const change=review.changes.find(c=>c.id===base.id), field=change.fields.find(f=>f.key==="openapi/parameters");
 assert.equal(field.conflict,true);
 assert.equal(field.local[0].schema.type,"boolean");
 assert.deepEqual(applyReview(old,review,[]),old);
 assert.throws(()=>applyReview(old,review,[base.id]),/충돌/);
 const kept=applyReview(old,review,[base.id],{[JSON.stringify([base.id,field.key])]:"local"});
 assert.equal(kept[0].openapi.parameters[0].schema.type,"boolean");assert.deepEqual(kept[0].baseline,next);
 assert.deepEqual(kept[0].assertions,[{value:200}]);
 assert.equal(preview(kept,generated).changes.some(c=>c.id===base.id),false);
 assert.equal(preview(kept,generated).changes.some(c=>c.id==="GET /c"),true);
 const deleted=applyReview(old,review,["GET /b"]);
 assert.equal(deleted.some(r=>r.id==="GET /b"),false);
 assert.equal(deleted.some(r=>r.id==="manual"),true);
 assert.throws(()=>applyReview([...old,{id:"x"}],review,[]),/再|다시/);
});
test("incoming structural fields update while user-only edits remain",async()=>{
 const {preview,applyReview}=await import("../src/modules/sync/review.mjs");
 const base={id:"a",name:"old",openapi:{path:"/a",method:"GET",parameters:[{name:"page",in:"query",required:false,schema:{type:"integer"}}]}};
 const old=[{...structuredClone(base),name:"custom",baseline:base}], incoming=[structuredClone(base)];
 incoming[0].openapi.parameters[0].schema.type="string";
 const review=preview(old,incoming);assert.equal(review.changes[0].fields.length,1);
 const result=applyReview(old,review,["a"]);
 assert.equal(result[0].name,"custom");assert.equal(result[0].openapi.parameters[0].schema.type,"string");
});
test("query value edits are ignored while nested schema changes are reviewed",async()=>{
 const {preview,applyReview}=await import("../src/modules/sync/review.mjs");
 const base={id:"GET /x",query:{limit:"20",page:"1"},responses:{"200":{description:"ok",content:{"application/json":{schema:{type:"object",properties:{name:{type:"string"}}}}}}},openapi:{path:"/x",method:"GET",parameters:[{name:"limit",in:"query",required:false,schema:{type:"integer"}},{name:"page",in:"query",required:false,schema:{type:"integer"}}]}};
 const local={...structuredClone(base),query:[{key:"limit",value:"20",enabled:true},{key:"page",value:"7",enabled:true}],baseline:base};
 const next=structuredClone(base);next.query.limit="50";next.responses["200"].content["application/json"].schema.properties.name.type="number";
 const review=preview([local],[next]);
 assert.equal(review.changes[0].fields.some(f=>f.key.startsWith("query/")),false);
 assert.equal(review.changes[0].fields.some(f=>f.key.endsWith("/properties/name/type")),true);
 assert.equal(review.changes[0].fields.some(f=>f.conflict),false);
 const result=applyReview([local],review,[base.id])[0];
 assert.equal(result.query.find(r=>r.key==="limit").value,"20");
 assert.equal(result.query.find(r=>r.key==="page").value,"7");
 assert.equal(result.responses["200"].content["application/json"].schema.properties.name.type,"number");
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
 assert.equal(codes.includes("parameter-enum-narrowed"),false);
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

test("description-only OpenAPI changes pass structural review",async()=>{
 const {preview}=await import("../src/modules/sync/review.mjs");
 const base={id:"GET /users",description:"old",responses:{"200":{description:"old"}},openapi:{path:"/users",parameters:[]}};
 const next={...base,description:"new",responses:{"200":{description:"new"}}};
 const review=preview([{...base,baseline:base}],[next]);
 assert.equal(review.changes.length,0);
 assert.equal(review.breakingCount,0);
});

test("parameter values examples defaults and enums pass when keys and types stay the same",async()=>{
 const {preview}=await import("../src/modules/sync/review.mjs");
 const base={id:"GET /users",method:"GET",query:{page:"1"},headers:{"X-Trace":"alpha"},body:"",openapi:{path:"/users",method:"GET",parameters:[{name:"page",in:"query",required:false,example:1,schema:{type:"integer",default:1,enum:[1,2]}}]}};
 const next=structuredClone(base);
 next.query.page="20";
 next.headers["X-Trace"]="beta";
 next.openapi.parameters[0].example=20;
 next.openapi.parameters[0].schema.default=20;
 next.openapi.parameters[0].schema.enum=[20,30];
 const review=preview([{...base,query:[{key:"page",value:"7",enabled:true}],headers:[{key:"X-Trace",value:"mine",enabled:true}],baseline:base}],[next]);
 assert.equal(review.changes.length,0);
});

test("parameter key changes are reviewed while unrelated user values are preserved",async()=>{
 const {preview,applyReview}=await import("../src/modules/sync/review.mjs");
 const base={id:"GET /users",method:"GET",query:{page:"1"},openapi:{path:"/users",method:"GET",parameters:[{name:"page",in:"query",required:false,schema:{type:"integer"}}]}};
 const local={...base,query:[{key:"page",value:"7",enabled:true},{key:"debug",value:"mine",enabled:true}],baseline:base};
 const next={...base,query:{cursor:"start"},openapi:{...base.openapi,parameters:[{name:"cursor",in:"query",required:false,schema:{type:"string"}}]}};
 const review=preview([local],[next]);
 assert.equal(review.changes.length,1);
 assert.equal(review.changes[0].fields.some(field=>field.key==="query/page"),true);
 assert.equal(review.changes[0].fields.some(field=>field.key==="query/cursor"),true);
 const result=applyReview([local],review,[base.id])[0];
 assert.equal(result.query.some(row=>row.key==="page"),false);
 assert.equal(result.query.find(row=>row.key==="cursor").value,"start");
 assert.equal(result.query.find(row=>row.key==="debug").value,"mine");
});

test("parameter type changes are reviewed without overwriting the current value",async()=>{
 const {preview,applyReview}=await import("../src/modules/sync/review.mjs");
 const base={id:"GET /users",method:"GET",query:{page:"1"},openapi:{path:"/users",method:"GET",parameters:[{name:"page",in:"query",required:false,schema:{type:"integer"}}]}};
 const local={...base,query:[{key:"page",value:"77",enabled:true}],baseline:base};
 const next=structuredClone(base);
 next.query.page="sample";
 next.openapi.parameters[0].schema.type="string";
 const review=preview([local],[next]);
 assert.equal(review.changes.length,1);
 assert.equal(review.changes[0].breakingReasons.some(reason=>reason.code==="parameter-type-changed"),true);
 const result=applyReview([local],review,[base.id])[0];
 assert.equal(result.query.find(row=>row.key==="page").value,"77");
 assert.equal(result.openapi.parameters[0].schema.type,"string");
});
