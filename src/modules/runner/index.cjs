const {runScript}=require("../scripts/index.cjs");
const { prepare, extract } = require("./request.cjs");
async function fetchText(url, options = {}) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol))
    throw Error("HTTP/HTTPS만 지원합니다.");
  const response = await fetch(url, {
    ...options,
    redirect: "error",
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body || []) {
    bytes += chunk.length;
    if (bytes > 10 * 1024 * 1024) throw Error("응답이 10MB 제한을 넘었습니다.");
    chunks.push(chunk);
  }
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers),
    body: Buffer.concat(chunks).toString("utf8"),
    bytes,
  };
}
async function execute(request, variables, signal, scripts = {}, environment = variables) {
  let p = prepare(request, variables);
  const
    start = performance.now();
  const logs=[],changes={},deleted=new Set();
  const capture=result=>{
    for(const key of result.deleted) {delete changes[key];deleted.add(key);}
    for(const [key,value] of Object.entries(result.changes)) {changes[key]=value;deleted.delete(key);}
    logs.push(...result.logs);
  };
  if(scripts.enabled) {
    try {
      const before=await runScript(scripts.before,{req:p,vars:variables,env:environment},signal);
      p=before.req;
      const target=new URL(p.url);
      if(!["http:","https:"].includes(target.protocol) || target.username || target.password) throw Error("전처리 URL은 인증정보 없는 HTTP/HTTPS 주소여야 합니다.");
      p.method=String(p.method).toUpperCase();
      if(!/^[!#$%&'*+.^_`|~0-9A-Z-]+$/.test(p.method) || ["CONNECT","TRACE","TRACK"].includes(p.method)) throw Error("지원하지 않는 HTTP 메서드입니다.");
      if(["GET","HEAD"].includes(p.method)) p.body=undefined;
      capture(before);
    } catch(error) {throw Error("전처리: "+error.message);}
  }
  const response = await fetchText(p.url, {
    method: p.method,
    headers: p.headers,
    body: p.body,
    signal,
  });
  let scriptError;
  let values={};
  try { values =
    response.status >= 200 &&
    response.status < 300 &&
    Object.keys(request.extract || {}).length
      ? extract(response.body, request.extract)
      : {};
  } catch(error) {scriptError="응답 추출: "+error.message;}
  if(scripts.enabled) {
    try {
      const afterVars={...variables,...changes,...values};
      for(const key of deleted)delete afterVars[key];
      const after=await runScript(scripts.after,{req:p,res:response,vars:afterVars,env:environment},signal);
      capture(after);
    } catch(error) {scriptError="후처리: "+error.message;}
  }
  return {
    ...response,
    scriptError,logs,deleted:[...deleted],
    elapsed: Math.round(performance.now() - start),
    variables: Object.fromEntries(Object.entries({...values,...changes}).filter(([key])=>!deleted.has(key))),
  };
}
module.exports = { fetchText, execute };
