const {Worker}=require("node:worker_threads");
const path=require("node:path");
function runScript(source,input,signal) {
 if(!source?.trim())return Promise.resolve({req:input.req,changes:{},deleted:[],logs:[]});
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(Error("실행이 취소되었습니다."));
  const worker=new Worker(path.join(__dirname,"worker.cjs"),{workerData:{source,input}});
  let settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener("abort",abort);worker.terminate();error?reject(error):resolve(value);};
  const abort=()=>finish(Error("실행이 취소되었습니다."));
  const timer=setTimeout(()=>finish(Error("스크립트 실행 시간 제한을 초과했습니다.")),3000);
  signal?.addEventListener("abort",abort,{once:true});
  worker.on("message",message=>finish(message.error?Error(message.error):null,message.value));
  worker.on("error",error=>finish(error));
  worker.on("exit",code=>{if(!settled)finish(Error("스크립트 실행기가 종료되었습니다: "+code));});
 });
}
module.exports={runScript};
