const YAML = require('yaml');
const METHODS = ['get','post','put','patch','delete','head','options','trace'];
function parseSpec(text) {
  const doc = YAML.parse(text, {maxAliasCount: 50});
  if (!/^3\./.test(doc?.openapi || '') || !doc.paths) throw Error('OpenAPI 3.x JSON/YAML 명세가 필요합니다.');
  return doc;
}
function resolve(doc, value) {
  const seen = new Set();
  while (value?.$ref) {
    const ref = value.$ref;
    if (!ref.startsWith('#/')) throw Error('외부 $ref는 지원하지 않습니다. 명세를 bundle한 뒤 가져오세요.');
    if (seen.has(ref)) throw Error('순환 $ref를 해석할 수 없습니다.');
    seen.add(ref);
    value = ref.slice(2).split('/').reduce((v,k)=>v?.[k.replace(/~1/g,'/').replace(/~0/g,'~')],doc);
    if (!value) throw Error(`해석할 수 없는 $ref: ${ref}`);
  }
  return value;
}
function sample(doc, schema, depth=0) {
  if (depth>5) return null;
  schema=resolve(doc,schema)||{};
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum) return schema.enum[0];
  if (schema.allOf) return Object.assign({},...schema.allOf.map(s=>sample(doc,s,depth+1)));
  if (schema.oneOf || schema.anyOf) return sample(doc,(schema.oneOf||schema.anyOf)[0],depth+1);
  if (schema.type==='object'||schema.properties) return Object.fromEntries(Object.entries(schema.properties||{}).map(([k,s])=>[k,sample(doc,s,depth+1)]));
  if (schema.type==='array') return [sample(doc,schema.items,depth+1)];
  if (['number','integer'].includes(schema.type)) return 0;
  if (schema.type==='boolean') return false;
  return '';
}
function operations(doc) {
  const out=[];
  for (const [path, raw] of Object.entries(doc.paths)) {
    const item=resolve(doc,raw);
    for (const method of METHODS) {
      const op=item[method]; if (!op) continue;
      const params = new Map();
      for (const rawP of [...(item.parameters||[]),...(op.parameters||[])]) {const p=resolve(doc,rawP);params.set(`${p.in}:${p.name}`,p);}
      const query={},headers={}; let url='{{baseUrl}}'+path;
      for (const p of params.values()) {
        const val=p.example ?? sample(doc,p.schema);
        if(p.in==='query') query[p.name]=String(val ?? '');
        if(p.in==='header') headers[p.name]=String(val ?? '');
        if(p.in==='path') url=url.replace('{'+p.name+'}','{{'+p.name+'}}');
      }
      const content=resolve(doc,op.requestBody)?.content||{};
      const mime=Object.keys(content).find(k=>k.includes('json'))||Object.keys(content)[0];
      let body='';
      if(mime) {headers['Content-Type']=mime; body=JSON.stringify(content[mime].example ?? sample(doc,content[mime].schema),null,2);}
      out.push({id:method.toUpperCase()+' '+path,name:op.summary||op.operationId||path,group:op.tags?.[0]||'General',description:op.description||'',method:method.toUpperCase(),url,query,headers,body,auth:(op.security ?? doc.security)?.length ? true : false,extract:{}});
    }
  }
  return out;
}
function synchronize(old, generated) {
  const before=new Map(old.map(r=>[r.id,r]));
  const counts={added:0,updated:0,removed:0};
  const requests=generated.map(next=>{
    const prev=before.get(next.id); before.delete(next.id);
    if(!prev) {counts.added++;return {...next,baseline:structuredClone(next)};}
    if(JSON.stringify(prev.baseline)!==JSON.stringify(next)) counts.updated++;
    const merged={...next,baseline:structuredClone(next)};
    for(const k of ['url','query','headers','body','auth','extract']) if(JSON.stringify(prev[k])!==JSON.stringify(prev.baseline?.[k])) merged[k]=prev[k];
    return merged;
  });
  for(const prev of before.values()) {if(prev.manual){requests.push(prev);continue;} counts.removed++;requests.push({...prev,removed:true});}
  return {requests,counts};
}
module.exports={parseSpec,operations,synchronize};
