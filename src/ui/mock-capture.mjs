function endpointPath(request) {
  if(request?.openapi?.path) return request.openapi.path;
  let raw=String(request?.url||"").replace(/^\{\{baseUrl\}\}/,"");
  try {raw=new URL(raw).pathname;} catch {raw=raw.split("?")[0];}
  return raw.replace(/\{\{([^}]+)\}\}/g,"{$1}");
}
function routeRegex(path) {
  const escaped=path.split("/").map(part=>{
    if(/^\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(part))return "[^/]+";
    return part.replace(/[.*+?^$|()[\]{}\\]/g,"\\$&");
  });
  return new RegExp("^"+escaped.join("/")+"/?$");
}
export function matchRequest(collection,candidate) {
  const method=String(candidate.method||"GET").toUpperCase();
  const eligible=(collection.requests||[]).filter(r=>
    String(r.method||"GET").toUpperCase()===method &&
    (!r.type||r.type==="http"));
  const exact=eligible.find(r=>r.id===candidate.requestId && endpointPath(r).startsWith("/") && routeRegex(endpointPath(r)).test(candidate.path));
  if(exact) return exact;
  const matches=eligible.filter(r=>{
    const path=endpointPath(r);
    return path.startsWith("/")&&routeRegex(path).test(candidate.path);
  });
  matches.sort((a,b)=>{
    const rank=r=>endpointPath(r).split("/").filter(part=>part&&!part.startsWith("{")).length;
    return rank(b)-rank(a);
  });
  return matches[0]||null;
}
function unconditional(rule) {
  if(!rule.when)return true;
  return ["query","headers","body"].every(key=>!Object.keys(rule.when[key]||{}).length);
}
export function prepareCapturedRule(collection,candidate,body=candidate.body) {
  if(!collection||!candidate||!candidate.path?.startsWith("/"))
    throw Error("Invalid captured endpoint");
  const request=matchRequest(collection,candidate);
  const path=request ? endpointPath(request) : candidate.path;
  const rule={
    method:candidate.method,
    path,
    mode:"mock",
    enabled:true,
    status:candidate.status,
    responseMode:"custom",
    contentType:candidate.contentType,
    body,
    headers:{},
  };
  const old=collection.mock?.rules?.find(r=>r.method===rule.method&&r.path===rule.path&&unconditional(r));
  return {rule,request,overwriting:!!old};
}
export function applyCapturedRule(collection,rule) {
  collection.mock||={rules:[]};
  collection.mock.rules||=[];
  const index=collection.mock.rules.findIndex(r=>r.method===rule.method&&r.path===rule.path&&unconditional(r));
  if(index===-1)collection.mock.rules.push(structuredClone(rule));
  else collection.mock.rules.splice(index,1,structuredClone(rule));
}
