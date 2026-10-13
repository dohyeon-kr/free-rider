"use strict";

// OpenAPI response contracts have already had local $refs expanded during sync.
// Do not silently accept unresolved refs or unsatisfied generation constraints.
const MAX_DEPTH = 18;
function equal(a,b) { return JSON.stringify(a) === JSON.stringify(b); }
function error(path, detail) { return path + ": " + detail; }
function typeOf(value) { return value === null ? "null" : Array.isArray(value) ? "array" : typeof value; }
function matchesType(value, type) {
  if (Array.isArray(type)) return type.some(t => matchesType(value,t));
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeOf(value) === type;
}
function validate(schema, value, path="$", depth=0) {
  if (depth > MAX_DEPTH) return [error(path,"schema depth exceeded")];
  if (!schema || typeof schema !== "object") return [];
  if (schema.$ref) return [error(path,"unresolved $ref: " + schema.$ref)];
  if (schema.nullable === true && value === null) return [];
  let problems = [];
  if (schema.type && !matchesType(value,schema.type))
    return [error(path,"expected " + JSON.stringify(schema.type) + ", got " + typeOf(value))];
  if (schema.const !== undefined && !equal(value,schema.const)) problems.push(error(path,"const mismatch"));
  if (schema.enum && !schema.enum.some(item=>equal(item,value))) problems.push(error(path,"enum mismatch"));
  if (schema.allOf) for (const s of schema.allOf) problems.push(...validate(s,value,path,depth+1));
  if (schema.anyOf?.length && !schema.anyOf.some(s=>!validate(s,value,path,depth+1).length))
    problems.push(error(path,"no anyOf branch matches"));
  if (schema.oneOf?.length && schema.oneOf.filter(s=>!validate(s,value,path,depth+1).length).length !== 1)
    problems.push(error(path,"expected exactly one matching oneOf branch"));
  if (typeof value === "string") {
    if (value.length < (schema.minLength ?? 0)) problems.push(error(path,"below minLength"));
    if (schema.maxLength !== undefined && value.length > schema.maxLength) problems.push(error(path,"above maxLength"));
    if (schema.pattern) {
      try {
        if (schema.pattern.length > 200 || value.length > 4000 || !new RegExp(schema.pattern,"u").test(value))
          problems.push(error(path,"pattern mismatch/unsupported"));
      } catch { problems.push(error(path,"invalid pattern")); }
    }
    if (schema.format === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) problems.push(error(path,"invalid email"));
    if (schema.format === "uuid" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) problems.push(error(path,"invalid uuid"));
    if (schema.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) problems.push(error(path,"invalid date"));
    if (schema.format === "date-time" && (!Number.isFinite(Date.parse(value)) || !/T/.test(value))) problems.push(error(path,"invalid date-time"));
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) problems.push(error(path,"below minimum"));
    if (schema.maximum !== undefined && value > schema.maximum) problems.push(error(path,"above maximum"));
    if (schema.exclusiveMinimum !== undefined) {
      if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum ||
          schema.exclusiveMinimum === true && schema.minimum !== undefined && value <= schema.minimum)
        problems.push(error(path,"below exclusiveMinimum"));
    }
    if (schema.exclusiveMaximum !== undefined) {
      if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum ||
          schema.exclusiveMaximum === true && schema.maximum !== undefined && value >= schema.maximum)
        problems.push(error(path,"above exclusiveMaximum"));
    }
    if (schema.multipleOf && Math.abs(value/schema.multipleOf-Math.round(value/schema.multipleOf))>1e-9)
      problems.push(error(path,"multipleOf mismatch"));
  }
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems??0)) problems.push(error(path,"below minItems"));
    if (schema.maxItems !== undefined && value.length>schema.maxItems) problems.push(error(path,"above maxItems"));
    if (schema.uniqueItems && new Set(value.map(JSON.stringify)).size !== value.length) problems.push(error(path,"items must be unique"));
    if (schema.items) value.forEach((item,index)=>problems.push(...validate(schema.items,item,path+"["+index+"]",depth+1)));
  }
  if (value && !Array.isArray(value) && typeof value === "object") {
    for(const key of schema.required||[]) if(!Object.hasOwn(value,key)) problems.push(error(path+"."+key,"required"));
    for(const [key,item] of Object.entries(value)) {
      if (Object.hasOwn(schema.properties||{},key)) problems.push(...validate(schema.properties[key],item,path+"."+key,depth+1));
      else if (schema.additionalProperties === false) problems.push(error(path+"."+key,"unexpected property"));
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object")
        problems.push(...validate(schema.additionalProperties,item,path+"."+key,depth+1));
    }
    if (Object.keys(value).length < (schema.minProperties??0)) problems.push(error(path,"below minProperties"));
    if (schema.maxProperties !== undefined && Object.keys(value).length > schema.maxProperties) problems.push(error(path,"above maxProperties"));
  }
  return problems;
}
function generate(schema, depth=0, seed=0) {
  if (!schema || typeof schema !== "object" || depth > MAX_DEPTH)
    throw Error("Unsupported schema or maximum depth exceeded");
  if (schema.$ref) throw Error("Unresolved $ref: " + schema.$ref);
  if (schema.example !== undefined) return structuredClone(schema.example);
  if (schema.default !== undefined) return structuredClone(schema.default);
  if (schema.const !== undefined) return structuredClone(schema.const);
  if (schema.enum?.length) return structuredClone(schema.enum[seed%schema.enum.length]);
  if (schema.allOf?.length) {
    const parts=schema.allOf.map(s=>generate(s,depth+1,seed));
    if (parts.every(x=>x && typeof x==="object" && !Array.isArray(x)))
      return Object.assign({},...parts);
    return parts.at(-1);
  }
  if (schema.oneOf?.length || schema.anyOf?.length)
    return generate((schema.oneOf||schema.anyOf)[0],depth+1,seed);
  const t=Array.isArray(schema.type)?schema.type.find(x=>x!=="null"):schema.type;
  if (t==="object" || schema.properties) {
    const obj={};
    for(const [key,item] of Object.entries(schema.properties||{})) obj[key]=generate(item,depth+1,seed+1);
    return obj;
  }
  if(t==="array" || schema.items) {
    const n=Math.max(schema.minItems??1,1);
    if(n>100) throw Error("Array generation would exceed 100 items");
    return Array.from({length:n},(_,i)=>generate(schema.items||{},depth+1,seed+i));
  }
  if(t==="integer"||t==="number") {
    let value=Math.max(schema.minimum??0,typeof schema.exclusiveMinimum==="number"?schema.exclusiveMinimum+1e-6:0);
    if(schema.exclusiveMinimum===true && schema.minimum !== undefined) value=schema.minimum+1;
    if (t==="integer") value=Math.ceil(value);
    if(schema.multipleOf) value=Math.ceil(value/schema.multipleOf)*schema.multipleOf;
    return value;
  }
  if(t==="boolean") return false;
  if(t==="null") return null;
  if(schema.format==="email") return "user@example.com";
  if(schema.format==="uuid") return "00000000-0000-4000-8000-000000000001";
  if(schema.format==="date") return "2026-01-01";
  if(schema.format==="date-time") return "2026-01-01T00:00:00.000Z";
  if(schema.format==="uri" || schema.format==="url") return "https://example.com";
  return "x".repeat(Math.max(1,schema.minLength??1));
}
function responseFor(request, rule) {
  const status=String(rule.status??200);
  const response=request?.responses?.[status];
  const content=response?.content||{};
  const mediaType=rule.contentType||Object.keys(content).find(x=>x.includes("json"))||Object.keys(content)[0]||"application/json";
  const media=content[mediaType];
  const schema=media?.schema;
  const mode=rule.responseMode||"generated";
  if (!["generated","example","custom"].includes(mode)) throw Error("Invalid response mode");
  let body;
  if(mode==="custom") {
    if(typeof rule.body!=="string") throw Error("Custom response body must be text");
    try { body=JSON.parse(rule.body); } catch { throw Error("Custom response is not valid JSON"); }
  } else {
    if (!schema || !Object.keys(schema).length) throw Error("This response does not have an OpenAPI schema");
    if(mode==="example") {
      const examples=media.examples||{};
      const first=Object.values(examples)[0];
      const choice=media.example??(first && (first.value??first));
      if(choice===undefined) throw Error("No OpenAPI response example exists");
      body=structuredClone(choice);
    } else body=generate(schema,0,rule.seed??0);
  }
  if(schema) {
    const problems=validate(schema,body);
    if(problems.length) throw Error("Response violates OpenAPI: "+problems.slice(0,4).join("; "));
  }
  return {status:Number(status),mediaType,body:JSON.stringify(body),headers:rule.headers||{}};
}
module.exports={validate,generate,responseFor};
