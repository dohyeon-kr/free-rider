const canonical = value => value && typeof value === "object"
  ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]))
  : value;
export const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const object = v => v && typeof v==="object" && !Array.isArray(v);
const pointer = parts => parts.map(k=>String(k).replaceAll("~","~0").replaceAll("/","~1")).join("/");
function addReason(reasons,code,key,message) {
  if(!reasons.some(reason=>reason.code===code&&reason.key===key&&reason.message===message)) reasons.push({code,key,message});
}
function parameterMap(request) {
  return new Map((request?.openapi?.parameters || []).map(parameter=>[`${parameter.in || ""}:${parameter.name || ""}`,parameter]));
}
function removedEnumValues(before,after) {
  if(!Array.isArray(before?.enum)||!Array.isArray(after?.enum)) return [];
  return before.enum.filter(value=>!after.enum.some(next=>equal(value,next)));
}
function requestSchemaBreaks(before,after,path,reasons,context="request") {
  if(!object(before)||!object(after)) return;
  if(before.type&&after.type&&before.type!==after.type)
    addReason(reasons,context==="parameter"?"parameter-type-changed":"request-schema-type-changed",pointer(path),`요청 스키마 타입이 ${before.type}에서 ${after.type}(으)로 변경됩니다.`);
  const removed=removedEnumValues(before,after);
  if(removed.length)
    addReason(reasons,context==="parameter"?"parameter-enum-narrowed":"request-enum-narrowed",pointer(path),`허용 값이 줄어듭니다: ${removed.map(value=>JSON.stringify(value)).join(", ")}`);
  const beforeRequired=new Set(Array.isArray(before.required)?before.required:[]);
  for(const name of Array.isArray(after.required)?after.required:[]) if(!beforeRequired.has(name))
    addReason(reasons,"request-property-became-required",pointer([...path,"required"]),`요청 속성 ${name}이(가) 필수가 됩니다.`);
  const beforeProps=object(before.properties)?before.properties:{};
  const afterProps=object(after.properties)?after.properties:{};
  for(const name of Object.keys(beforeProps)) if(Object.hasOwn(afterProps,name))
    requestSchemaBreaks(beforeProps[name],afterProps[name],[...path,"properties",name],reasons,context);
}
function responseSchemaBreaks(before,after,path,reasons) {
  if(!object(before)||!object(after)) return;
  if(before.type&&after.type&&before.type!==after.type)
    addReason(reasons,"response-schema-type-changed",pointer(path),`응답 스키마 타입이 ${before.type}에서 ${after.type}(으)로 변경됩니다.`);
  const beforeProps=object(before.properties)?before.properties:{};
  const afterProps=object(after.properties)?after.properties:{};
  for(const name of Object.keys(beforeProps)) {
    if(!Object.hasOwn(afterProps,name)) {
      addReason(reasons,"response-property-removed",pointer([...path,"properties",name]),`응답 속성 ${name}이(가) 제거됩니다.`);
      continue;
    }
    responseSchemaBreaks(beforeProps[name],afterProps[name],[...path,"properties",name],reasons);
  }
}
function mediaSchema(media) { return object(media?.schema)?media.schema:null; }
function classifyBreaking(before,next) {
  const reasons=[];
  if(!next) {
    addReason(reasons,"operation-removed","",`작업 ${before?.id || ""}이(가) 명세에서 제거됩니다.`);
    return reasons;
  }
  if(!before) return reasons;
  const beforeParams=parameterMap(before), afterParams=parameterMap(next);
  for(const [key,after] of afterParams) {
    const previous=beforeParams.get(key);
    if(!previous) {
      if(after.required===true) addReason(reasons,"required-parameter-added","openapi/parameters",`필수 ${after.in || "request"} 파라미터 ${after.name}이(가) 추가됩니다.`);
      continue;
    }
    if(previous.required!==true&&after.required===true)
      addReason(reasons,"parameter-became-required","openapi/parameters",`${after.in || "request"} 파라미터 ${after.name}이(가) 필수가 됩니다.`);
    requestSchemaBreaks(previous.schema,after.schema,["openapi","parameters"],reasons,"parameter");
  }
  const beforeBody=before.openapi?.requestBody, afterBody=next.openapi?.requestBody;
  if(afterBody?.required===true&&beforeBody?.required!==true)
    addReason(reasons,"request-body-became-required","openapi/requestBody/required","요청 본문이 필수가 됩니다.");
  if(object(beforeBody?.content)&&object(afterBody?.content)) {
    for(const mime of Object.keys(beforeBody.content)) if(Object.hasOwn(afterBody.content,mime))
      requestSchemaBreaks(mediaSchema(beforeBody.content[mime]),mediaSchema(afterBody.content[mime]),["openapi","requestBody","content",mime,"schema"],reasons);
  }
  const beforeResponses=object(before.responses)?before.responses:{}, afterResponses=object(next.responses)?next.responses:{};
  for(const status of Object.keys(beforeResponses)) {
    if(/^2(?:\d{2}|xx)$/i.test(status)&&!Object.hasOwn(afterResponses,status)) {
      addReason(reasons,"success-response-removed",pointer(["responses",status]),`성공 응답 ${status}이(가) 제거됩니다.`);
      continue;
    }
    if(!Object.hasOwn(afterResponses,status)) continue;
    const beforeContent=object(beforeResponses[status]?.content)?beforeResponses[status].content:{};
    const afterContent=object(afterResponses[status]?.content)?afterResponses[status].content:{};
    for(const mime of Object.keys(beforeContent)) {
      if(!Object.hasOwn(afterContent,mime)) {
        if(/^2(?:\d{2}|xx)$/i.test(status)) addReason(reasons,"response-media-type-removed",pointer(["responses",status,"content",mime]),`성공 응답 ${status}에서 ${mime} 표현이 제거됩니다.`);
        continue;
      }
      responseSchemaBreaks(mediaSchema(beforeContent[mime]),mediaSchema(afterContent[mime]),["responses",status,"content",mime,"schema"],reasons);
    }
  }
  return reasons;
}
function comparable(request) {
  const value=structuredClone(request);
  for(const name of ["headers","query"]) if(value[name]) {
    const groups={};
    const rows=Array.isArray(value[name]) ? value[name] : Object.entries(value[name]).map(([key,value])=>({key,value,enabled:true}));
    for(const row of rows) {
      const key=name==="headers"?row.key.toLowerCase():row.key;
      if(!Object.hasOwn(groups,key)) Object.defineProperty(groups,key,{value:[],enumerable:true,writable:true,configurable:true});
      groups[key].push({value:String(row.value??""),enabled:row.enabled!==false});
    }
    value[name]=groups;
  }
  return value;
}
function differences(base,local,next,path,fields) {
  if(equal(base,next)) return;
  if(object(base) && object(next) && object(local)) {
    for(const key of new Set([...Object.keys(base),...Object.keys(next)]))
      differences(base[key],local[key],next[key],[...path,key],fields);
    return;
  }
  fields.push({key:pointer(path),path,
    before:base,local,incoming:next,conflict:!equal(local,base)&&!equal(local,next)});
}
function put(value,path,next) {
  let target=value;
  for(const key of path.slice(0,-1)) {
    if(!Object.hasOwn(target,key)||!object(target[key]))
      Object.defineProperty(target,key,{value:{},enumerable:true,writable:true,configurable:true});
    target=target[key];
  }
  const key=path.at(-1);
  if(next===undefined)delete target[key];
  else Object.defineProperty(target,key,{value:structuredClone(next),enumerable:true,writable:true,configurable:true});
}
function withBreaking(change,reasons) {
  return {...change,breaking:reasons.length>0,breakingReasons:reasons};
}
export function preview(old, generated) {
  const incoming = new Map(generated.map(r=>[r.id,r])), changes=[];
  for (const local of old) {
    const next=incoming.get(local.id); incoming.delete(local.id);
    if (!next) {
      if (!local.manual) changes.push(withBreaking({id:local.id,type:"removed",local,fields:[]},classifyBreaking(local.baseline || local,null)));
      continue;
    }
    const base=comparable(local.baseline || {}), current=comparable(local), normalizedNext=comparable(next);
    const fields=[];
    for(const key of new Set([...Object.keys(base),...Object.keys(normalizedNext)]))
      if(!["id","baseline","manual","removed"].includes(key))
        differences(base[key],current[key],normalizedNext[key],[key],fields);
    if(fields.length) changes.push(withBreaking({id:local.id,type:"updated",local,incoming:next,fields},local.baseline?classifyBreaking(local.baseline,next):[]));
  }
  for(const next of incoming.values()) changes.push(withBreaking({id:next.id,type:"added",incoming:next,fields:[]},[]));
  return {revision:structuredClone(old),generated:structuredClone(generated),changes,breakingCount:changes.filter(change=>change.breaking).length};
}
export function applyReview(current, review, selected, choices={}) {
  if(!equal(current,review.revision)) throw Error("검토 이후 요청이 변경되었습니다. 명세를 다시 확인하세요.");
  const changes=new Map(review.changes.filter(c=>selected.includes(c.id)).map(c=>[c.id,c]));
  const result=[];
  for(const local of current) {
    const change=changes.get(local.id);
    if(!change) {result.push(structuredClone(local));continue;}
    if(change.type==="removed") continue;
    const merged=comparable(local), touched=new Set();
    for(const field of change.fields) {
      const choice=choices[JSON.stringify([change.id,field.key])];
      if(field.conflict && !["local","incoming"].includes(choice)) throw Error("충돌 처리 방식을 선택하세요.");
      if(!field.conflict || choice==="incoming") {put(merged,field.path,field.incoming);touched.add(field.path[0]);}
    }
    for(const name of ["headers","query"]) {
      if(!touched.has(name)) {merged[name]=structuredClone(local[name]);continue;}
      merged[name]=Object.entries(merged[name] || {}).flatMap(([key,rows])=>rows.map(row=>({key,...row})));
    }
    merged.baseline=structuredClone(change.incoming); delete merged.removed;
    result.push(merged);
  }
  for(const change of changes.values()) if(change.type==="added")
    result.push({...structuredClone(change.incoming),baseline:structuredClone(change.incoming)});
  return result;
}
