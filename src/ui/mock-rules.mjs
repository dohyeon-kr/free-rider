import {endpointPath} from "./mock-capture.mjs";

export function filterMockEndpoints(endpoints, query) {
  const terms=String(query||"").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if(!terms.length)return endpoints;
  return endpoints.filter(({method,path,request})=>{
    const text=[method,path,request?.name,request?.group].filter(Boolean).join(" ").toLocaleLowerCase();
    return terms.every(term=>text.includes(term));
  });
}

function unconditional(rule){
  return !["query","headers","body"].some(key=>Object.keys(rule.when?.[key]||{}).length);
}

export function ensureEndpointMockRule(col, request) {
  if(!request || (request.type && request.type!=="http"))
    throw Error("HTTP 요청에서만 Mock 규칙을 만들 수 있습니다.");
  const method=String(request.method||"GET").toUpperCase();
  const path=endpointPath(request);
  if(!path.startsWith("/") || path.startsWith("//") || /\s/.test(path) || path.includes("{{"))
    throw Error("먼저 요청 URL을 유효한 API 경로로 설정하세요.");

  col.mock||={rules:[]};
  col.mock.rules||=[];
  const existing=col.mock.rules.find(rule=>
    rule.method===method && rule.path===path &&
    !rule.scenarioId && unconditional(rule)
  );
  if(existing) {
    if(existing.mode!=="mock")existing.mode="mock";
    return {method,path,rule:existing,created:false};
  }
  const candidates=Object.entries(request.responses||{}).filter(([status,response])=>
    /^[2-5]\d\d$/.test(status) &&
    Object.entries(response?.content||{}).some(([type,content])=>type.includes("json") && content?.schema)
  );
  const selected=candidates.find(([status])=>status==="200")
    ||candidates.find(([status])=>Number(status)<300)
    ||candidates[0];
  const status=selected?Number(selected[0]):200;
  const contentType=selected?Object.keys(selected[1].content).find(type=>
    type.includes("json")&&selected[1].content[type]?.schema):"application/json";
  const rule={
    method,path,mode:"mock",status,
    responseMode:selected?"generated":"custom",
    contentType:contentType||"application/json",
    ...(selected?{}:{body:"{}"})
  };
  col.mock.rules.push(rule);
  return {method,path,rule,created:true};
}
