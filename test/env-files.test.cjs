const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path");
const {EnvironmentFiles}=require("../src/modules/env/files.cjs");
const {shareableEnvironments}=require("../src/modules/env/index.cjs");
test("linked environment files detect outside edits and exclude local content from sharing",async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),"fr-env-"));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const filename=path.join(dir,".env.dev");await fs.writeFile(filename,"KEY=one");
 const store=new EnvironmentFiles();
 await assert.rejects(store.read(filename),/먼저 연결/);
 store.allow(filename);const first=await store.read(filename);
 await fs.writeFile(filename,"KEY=outside");
 await assert.rejects(store.save(filename,"KEY=two",first.revision),/외부/);
 const current=await store.read(filename);await store.save(filename,"KEY=two",current.revision);
 assert.equal(await fs.readFile(filename,"utf8"),"KEY=two");
 const shared=shareableEnvironments([{id:"dev",name:"dev",values:{KEY:"two"},file:{path:filename,text:"KEY=two"}}]);
 assert.deepEqual(shared,[{id:"dev",name:"dev",values:{KEY:""}}]);
});
