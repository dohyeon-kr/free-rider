const canonical = value => value && typeof value === "object"
  ? Array.isArray(value) ? value.map(canonical) : Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]))
  : value;
export const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const object = v => v && typeof v==="object" && !Array.isArray(v);
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
  fields.push({key:path.map(k=>k.replaceAll("~","~0").replaceAll("/","~1")).join("/"),path,
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
export function preview(old, generated) {
  const incoming = new Map(generated.map(r=>[r.id,r])), changes=[];
  for (const local of old) {
    const next=incoming.get(local.id); incoming.delete(local.id);
    if (!next) { if (!local.manual) changes.push({id:local.id,type:"removed",local,fields:[]}); continue; }
    const base=comparable(local.baseline || {}), current=comparable(local), normalizedNext=comparable(next);
    const fields=[];
    for(const key of new Set([...Object.keys(base),...Object.keys(normalizedNext)]))
      if(!["id","baseline","manual","removed"].includes(key))
        differences(base[key],current[key],normalizedNext[key],[key],fields);
    if(fields.length) changes.push({id:local.id,type:"updated",local,incoming:next,fields});
  }
  for(const next of incoming.values()) changes.push({id:next.id,type:"added",incoming:next,fields:[]});
  return {revision:structuredClone(old),generated:structuredClone(generated),changes};
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
