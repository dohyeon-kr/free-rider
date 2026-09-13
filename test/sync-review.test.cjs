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
