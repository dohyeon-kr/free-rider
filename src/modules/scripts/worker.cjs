const {parentPort,workerData}=require("node:worker_threads");
const {getQuickJS}=require("quickjs-emscripten");
(async()=>{
 const QuickJS=await getQuickJS(), runtime=QuickJS.newRuntime();
 runtime.setMemoryLimit(32*1024*1024);runtime.setMaxStackSize(512*1024);
 const deadline=Date.now()+1500;runtime.setInterruptHandler(()=>Date.now()>deadline);
 const vm=runtime.newContext();
 try {
  const input=JSON.stringify(workerData.input), source=workerData.source;
  const code=`const input=${input};
const values=Object.assign(Object.create(null),input.vars), changes=Object.create(null), deleted=[], logs=[];
const headers=(raw,readonly=false)=>{
 const data=Object.fromEntries(Object.entries(raw||{}).map(([k,v])=>[k.toLowerCase(),String(v)]));
 return {get:k=>data[String(k).toLowerCase()],set:(k,v)=>{if(readonly)throw Error("응답은 읽기 전용입니다.");data[String(k).toLowerCase()]=String(v);},delete:k=>{if(readonly)throw Error("응답은 읽기 전용입니다.");delete data[String(k).toLowerCase()];},toJSON:()=>data};
};
const req={...input.req,headers:headers(input.req?.headers)};
const res=input.res ? Object.freeze({...input.res,headers:headers(input.res.headers,true),text:()=>input.res.body,json:()=>JSON.parse(input.res.body)}) : undefined;
const ctx={env:{get:k=>input.env[k]},vars:{get:k=>values[k],set:(k,v)=>{if(["__proto__","constructor","prototype"].includes(k))throw Error("잘못된 변수 이름");values[k]=v;changes[k]=v;const i=deleted.indexOf(k);if(i>=0)deleted.splice(i,1);},delete:k=>{delete values[k];delete changes[k];deleted.push(k);}},log:(...args)=>{if(logs.length<100)logs.push(args.map(v=>typeof v==="string"?v:JSON.stringify(v)).join(" ").slice(0,4000));}};
globalThis.done=false;
(async()=>{${source}\n})().then(()=>{globalThis.output=JSON.stringify({req:{...req,headers:req.headers.toJSON()},changes,deleted,logs});globalThis.done=true;},e=>{globalThis.failure=String(e);globalThis.done=true;});`;
  let result=vm.evalCode(code);
  if(result.error){const error=vm.dump(result.error);result.error.dispose();throw Error(error.message||String(error));}
  result.value.dispose();
  while(runtime.hasPendingJob()) {const jobs=runtime.executePendingJobs();if(jobs.error){const error=vm.dump(jobs.error);jobs.error.dispose();throw Error(error.message||String(error));}}
  const read=name=>{const handle=vm.getProp(vm.global,name);const value=vm.dump(handle);handle.dispose();return value;};
  if(!read("done"))throw Error("스크립트의 비동기 작업이 완료되지 않았습니다.");
  if(read("failure"))throw Error(read("failure"));
  parentPort.postMessage({value:JSON.parse(read("output"))});
 } finally {vm.dispose();runtime.dispose();}
})().catch(error=>parentPort.postMessage({error:error.message}));
