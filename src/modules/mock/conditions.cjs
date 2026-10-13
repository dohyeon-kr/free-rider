"use strict";

// Conditions are exact (query, header) or JSON-object subset (body) matches.
// Rules in the same route favor more conditions; ties preserve saved order.
const MAX_CONDITION_BYTES=8192;
const MAX_CONDITION_KEYS=32;
const MAX_CONDITION_DEPTH=8;
function plain(value) {
  return value!==null && typeof value==="object" && !Array.isArray(value);
}
function checkJson(value,depth=0) {
  if(depth>MAX_CONDITION_DEPTH)throw Error("Mock body condition is too deep");
  if(typeof value==="string" && value.length>2048)throw Error("Mock condition value is too long");
  if(typeof value==="number" && !Number.isFinite(value))throw Error("Mock condition number must be finite");
  if(Array.isArray(value)) {
    if(value.length>32)throw Error("Mock condition array is too large");
    for(const item of value)checkJson(item,depth+1);
  }else if(plain(value)){
    const entries=Object.entries(value);
    if(entries.length>MAX_CONDITION_KEYS)throw Error("Too many Mock condition fields");
    for(const [key,item] of entries) {
      if(key.length>128 || ["__proto__","prototype","constructor"].includes(key))throw Error("Invalid Mock condition field");
      checkJson(item,depth+1);
    }
  }else if(value!==null && !["string","number","boolean"].includes(typeof value)) {
    throw Error("Mock body condition must be JSON");
  }
}
function validateWhen(when){
  if(when===undefined || when===null)return;
  if(!plain(when)||Object.keys(when).some(x=>!["query","headers","body"].includes(x)))
    throw Error("Mock conditions support only query, headers and body");
  if(JSON.stringify(when).length>MAX_CONDITION_BYTES)throw Error("Mock conditions exceed 8KB");
  for(const name of ["query","headers"]){
    if(when[name]===undefined)continue;
    if(!plain(when[name])||Object.keys(when[name]).length>MAX_CONDITION_KEYS)
      throw Error("Mock "+name+" conditions must be an object with up to 32 fields");
    for(const [key,value] of Object.entries(when[name])){
      if(!key || key.length>128 || ["__proto__","prototype","constructor"].includes(key))
        throw Error("Invalid Mock "+name+" key");
      if(name==="headers" && !/^[!#$%&'*+\-.^_\x60|~0-9A-Za-z]+$/.test(key))
        throw Error("Invalid Mock header key");
      if(typeof value!=="string"||value.length>2048)throw Error("Mock "+name+" values must be strings");
    }
  }
  if(when.body!==undefined) {
    if(!plain(when.body))throw Error("Mock body condition must be a JSON object");
    checkJson(when.body);
  }
}
function conditionCount(when) {
  if(!when)return 0;
  return Object.keys(when.query||{}).length+Object.keys(when.headers||{}).length+
    Object.keys(when.body||{}).length;
}
function subset(actual, expected, depth=0) {
  if(depth>MAX_CONDITION_DEPTH)return false;
  if(Array.isArray(expected))return Array.isArray(actual)&&actual.length===expected.length&&
    expected.every((v,i)=>subset(actual[i],v,depth+1));
  if(plain(expected))return plain(actual)&&Object.entries(expected).every(([k,v])=>
    Object.hasOwn(actual,k)&&subset(actual[k],v,depth+1));
  return Object.is(actual,expected);
}
function matchWhen(when,context) {
  if(!when||!conditionCount(when))return true;
  const url=new URL(context.url||"/","http://127.0.0.1");
  for(const [key,expected] of Object.entries(when.query||{}))
    if(!url.searchParams.getAll(key).includes(expected))return false;
  for(const [key,expected] of Object.entries(when.headers||{})) {
    const actual=Object.entries(context.headers||{}).find(([name])=>name.toLowerCase()===key.toLowerCase());
    if(!actual || (Array.isArray(actual[1])?actual[1].join(", "):String(actual[1]))!==expected)return false;
  }
  if(when.body!==undefined){
    let actual;
    try{actual=JSON.parse(Buffer.isBuffer(context.body)?context.body.toString("utf8"):String(context.body||""));}
    catch{return false;}
    if(!subset(actual,when.body))return false;
  }
  return true;
}
function ruleWeight(rule){
  return rule.path.split("/").filter(x=>x&&!x.startsWith(":")&&!x.startsWith("{")).length;
}
function pickRule(rules,method,path,context={},matchesPath,scenarioId="") {
  return (rules||[]).map((rule,index)=>({rule,index}))
    .filter(({rule})=>rule.enabled!==false&&rule.method===method&&
      (!rule.scenarioId||rule.scenarioId===scenarioId)&&matchesPath(rule.path,path)&&matchWhen(rule.when,context))
    .sort((a,b)=>ruleWeight(b.rule)-ruleWeight(a.rule) ||
      b.rule.path.length-a.rule.path.length ||
      Number(b.rule.scenarioId===scenarioId && !!scenarioId)-Number(a.rule.scenarioId===scenarioId && !!scenarioId) ||
      conditionCount(b.rule.when)-conditionCount(a.rule.when) ||
      a.index-b.index)[0]?.rule||null;
}
function validateBehavior(rule){
  validateWhen(rule.when);
  const delay=rule.delayMs??0;
  if(!Number.isInteger(delay)||delay<0||delay>30000)throw Error("Mock delay must be 0-30000 ms");
  if(![undefined,"none","timeout","disconnect"].includes(rule.fault))
    throw Error("Unsupported Mock fault mode");
}
module.exports={validateWhen,validateBehavior,matchWhen,conditionCount,pickRule,subset};
