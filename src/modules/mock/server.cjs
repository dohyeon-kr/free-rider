"use strict";
const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { responseFor } = require("./schema.cjs");
const { pickRule, validateBehavior } = require("./conditions.cjs");
const { setTimeout: wait } = require("node:timers/promises");
const HOST = "127.0.0.1", DEFAULT_PORT = 4010, MAX_BODY = 8 * 1024 * 1024, MAX_CAPTURE = 512 * 1024;
const HOP = new Set(["host","connection","keep-alive","transfer-encoding","te","trailer","upgrade","proxy-authorization","proxy-authenticate","content-length"]);
const PRIVATE = /authorization|(?:^|[_-])auth(?:$|[_-])|cookie|token|secret|password|api[-_]?key|client[-_]?secret|session|credential/i;
function scrub(value, depth=0) {
  if (depth > 10) return "[omitted]";
  if (typeof value === "string" && value.length <= MAX_CAPTURE && /^\s*[\[{]/.test(value)) {
    try { return JSON.stringify(scrub(JSON.parse(value),depth+1)); } catch {}
  }
  if (Array.isArray(value)) return value.map(v=>scrub(v,depth+1));
  if (value && typeof value==="object") return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,PRIVATE.test(k)?"[redacted]":scrub(v,depth+1)]));
  return value;
}
function safeBody(buffer,type) {
  if (!/json/i.test(type||"")) return "[non-JSON body omitted]";
  if (buffer.length>MAX_CAPTURE) return "[body truncated]";
  try { return JSON.stringify(scrub(JSON.parse(buffer.toString("utf8")))); }
  catch { return "[invalid JSON body omitted]"; }
}
function safeHeaders(headers) {
  return Object.fromEntries(Object.entries(headers||{}).map(([name,value])=>[name,PRIVATE.test(name)?"[redacted]":String(value)]));
}
function safeUrl(raw,port) {
  const url=new URL(raw,"http://"+HOST+":"+port);
  for(const key of [...url.searchParams.keys()]) if(PRIVATE.test(key))url.searchParams.set(key,"[redacted]");
  return url.href;
}
function trustedClient(req) {
  try{
    const authority=new URL("http://"+(req.headers.host||""));
    if(!["localhost","127.0.0.1","[::1]"].includes(authority.hostname))return false;
    if(!req.headers.origin)return true;
    const origin=new URL(req.headers.origin);
    return ["http:","https:"].includes(origin.protocol)&&
      ["localhost","127.0.0.1","[::1]"].includes(origin.hostname);
  }catch{return false;}
}
function routePattern(path) {
  if (typeof path!=="string"||!path.startsWith("/")||path.length>1024) throw Error("Invalid Mock path");
  const escaped=path.split("/").map(piece=>{
    if (/^\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(piece)||/^:[A-Za-z_][A-Za-z0-9_]*$/.test(piece)) return "[^/]+";
    return piece.replace(/[.*+?^$|()[\]{}\\]/g,"\\$&");
  });
  return new RegExp("^"+escaped.join("/")+"/?$");
}
function matchRule(rules,method,path,context={}) {
  return pickRule(rules,method,path,{
    url:context.url||path,
    headers:context.headers||{},
    body:context.body||Buffer.alloc(0),
  },(pattern,candidate)=>routePattern(pattern).test(candidate));
}
function requireConfig(value) {
  const port=Number(value.port??DEFAULT_PORT);
  if (!Number.isInteger(port)||port<1024||port>65535||port===48173) throw Error("Invalid Mock port");
  const collection=value.collection;
  if (!collection||typeof collection.id!=="string"||!Array.isArray(collection.requests)) throw Error("Select a collection");
  let upstream="";
  if (value.upstream) {
    const url=new URL(String(value.upstream));
    if (!["http:","https:"].includes(url.protocol)||url.username||url.password||url.search||url.hash)
      throw Error("Upstream must be an HTTP(S) base URL with no credentials, query or fragment");
    if (["localhost","127.0.0.1","[::1]"].includes(url.hostname)&&[String(port),"48173"].includes(url.port))
      throw Error("Upstream cannot point to Mock or MCP server");
    upstream=url.href.replace(/\/$/,"");
  }
  const rules=collection.mock?.rules||[];
  if (!Array.isArray(rules)||rules.length>500) throw Error("Too many Mock rules");
  for(const r of rules) {
    if(!["mock","proxy"].includes(r.mode)||!/^[A-Z]+$/.test(r.method||"")) throw Error("Invalid rule");
    routePattern(r.path);
    validateBehavior(r);
    if(r.mode==="mock"&&(Number(r.status??200)<200||Number(r.status??200)>599||!Number.isInteger(Number(r.status??200))))
      throw Error("Invalid Mock status");
  }
  return {port,collection:structuredClone(collection),upstream};
}
async function limitedBody(stream) {
  const parts=[];let size=0;
  for await(const chunk of stream) {
    const bytes=Buffer.from(chunk);size+=bytes.length;
    if(size>MAX_BODY) throw Object.assign(Error("Body exceeds 8MB"),{status:413});
    parts.push(bytes);
  }
  return Buffer.concat(parts);
}
async function fetchBody(response) {
  if(!response.body)return Buffer.alloc(0);
  const chunks=[];let size=0;
  for await (const bytes of response.body) {
    size+=bytes.byteLength;
    if(size>MAX_BODY) throw Object.assign(Error("Upstream response exceeds 8MB"),{status:502});
    chunks.push(Buffer.from(bytes));
  }
  return Buffer.concat(chunks);
}
function allowCors(req,res) {
  if(!req.headers.origin)return;
  try{
    const origin=new URL(req.headers.origin);
    if(["localhost","127.0.0.1","[::1]"].includes(origin.hostname)&&["http:","https:"].includes(origin.protocol)){
      res.setHeader("Access-Control-Allow-Origin",req.headers.origin);
      res.setHeader("Access-Control-Allow-Credentials","true");
      res.setHeader("Vary","Origin");
    }
  }catch{}
}
function copyResponseHeaders(headers,res){
  for(const [name,value] of headers.entries())
    if(!HOP.has(name)&&!["content-encoding","set-cookie","access-control-allow-origin","access-control-allow-credentials","vary"].includes(name))
      res.setHeader(name,value);
  const cookies=headers.getSetCookie?.()||[];
  if(cookies.length)res.setHeader("Set-Cookie",cookies);
}
function upstreamUrl(base,rawUrl) {
  const local=new URL(rawUrl,"http://127.0.0.1");
  const remote=new URL(base);
  remote.pathname=remote.pathname.replace(/\/$/,"")+local.pathname;
  remote.search=local.search;
  return remote;
}
function findRequest(collection,method,path,rule) {
  return collection.requests.find(r=>
    String(r.method||"GET").toUpperCase()===method &&
    (r.openapi?.path===rule?.path||r.openapi?.path===path||
      (r.url||"").replace(/^\{\{baseUrl\}\}/,"")===rule?.path));
}
function createMockServer({onEntry=()=>{},fetchImpl=fetch}={}) {
  let config=null,server=null,activePort=null;
  function status(){return {enabled:!!server,host:HOST,port:activePort??config?.port??DEFAULT_PORT,
    url:server?"http://"+HOST+":"+activePort:"",collectionId:config?.collection.id||""};}
  function configure(next) {
    const value=requireConfig(next);
    if(server&&value.port!==activePort)throw Error("Stop the Mock server before changing its port");
    config=value;return status();
  }
  async function handle(req,res) {
    const started=Date.now(), current=config, method=String(req.method||"GET").toUpperCase();
    const path=new URL(req.url||"/","http://127.0.0.1").pathname;
    let mode="proxy",responseBody=Buffer.alloc(0),requestBody=Buffer.alloc(0),statusCode=0,mediaType="",responseHeaders={},failureReason="";
    if(!trustedClient(req)) {res.writeHead(403);res.end("Forbidden origin or host");return;}
    allowCors(req,res);
    if(method==="OPTIONS"&&req.headers["access-control-request-method"]) {
      res.writeHead(204,{"Access-Control-Allow-Methods":"GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":req.headers["access-control-request-headers"]||"Content-Type, Authorization"});
      res.end();return;
    }
    try {
      requestBody=await limitedBody(req);
      const rule=matchRule(current.collection.mock?.rules,method,path,{url:req.url,headers:req.headers,body:requestBody});
      mode=rule?.mode||"proxy";
      if(mode==="mock") {
        if(rule.delayMs)await wait(rule.delayMs);
        if(res.destroyed)return;
        if(rule.fault==="disconnect") {
          statusCode=0;
          failureReason="Simulated connection drop";
          res.destroy();
          return;
        }
        if(rule.fault==="timeout") {
          statusCode=504;
          failureReason="Simulated timeout";
          mediaType="application/json";
          responseBody=Buffer.from(JSON.stringify({error:"Simulated upstream timeout"}));
          res.statusCode=statusCode;
          res.setHeader("Content-Type",mediaType);
        } else {
          const output=responseFor(findRequest(current.collection,method,path,rule),rule);
          responseBody=Buffer.from(output.body);
          if(responseBody.length>MAX_BODY)throw Object.assign(Error("Mock body exceeds 8MB"),{status:502});
          statusCode=output.status;mediaType=output.mediaType;res.statusCode=statusCode;
          res.setHeader("Content-Type",mediaType);
          for(const [name,value] of Object.entries(output.headers))
            if(!/^(content-length|transfer-encoding|connection|access-control-allow-origin)$/i.test(name))
              res.setHeader(name,String(value));
        }
      } else {
        if(!current.upstream)throw Object.assign(Error("Upstream URL is not set"),{status:502});
        const target=upstreamUrl(current.upstream,req.url||"/");
        if(["localhost","127.0.0.1","[::1]"].includes(target.hostname)&&[String(activePort),"48173"].includes(target.port))
          throw Object.assign(Error("Proxy loop is forbidden"),{status:502});
        const headers={};
        for(const [name,value] of Object.entries(req.headers))
          if(!HOP.has(name)&&name!=="accept-encoding")headers[name]=value;
        const upstream=await fetchImpl(target,{method,headers,
          body:["GET","HEAD"].includes(method)?undefined:requestBody,
          signal:AbortSignal.timeout(30000),redirect:"manual"});
        statusCode=upstream.status;
        copyResponseHeaders(upstream.headers,res);
        mediaType=upstream.headers.get("content-type")||"";
        responseBody=await fetchBody(upstream);res.statusCode=statusCode;
      }
      responseHeaders={...res.getHeaders()};
      if(method==="HEAD"||statusCode===204||statusCode===304)res.end();
      else res.end(responseBody);
    }catch(err) {
      statusCode=err.status||(err.name==="TimeoutError"?504:502);
      responseBody=Buffer.from(JSON.stringify({error:err.message}));mediaType="application/json";
      if(!res.headersSent){res.statusCode=statusCode;res.setHeader("content-type",mediaType);}
      res.end(responseBody);
      responseHeaders={...res.getHeaders()};
    }finally {
      try {
        onEntry({id:randomUUID(),at:started,source:"mock-proxy",mode,
          collectionId:current.collection.id,collectionTitle:current.collection.title||"",
          name:method+" "+path,replayable:false,
          request:{method,url:safeUrl(req.url||"/",activePort),
            headers:safeHeaders(req.headers),body:safeBody(requestBody,req.headers["content-type"])},
          response:{status:statusCode,statusText:http.STATUS_CODES[statusCode]||"",
            headers:safeHeaders(responseHeaders),body:safeBody(responseBody,mediaType),
            bodyTruncated:responseBody.length>MAX_CAPTURE,bytes:responseBody.length,
            elapsed:Date.now()-started,error:failureReason||(statusCode>=500?"HTTP "+statusCode:"")},
          cookies:{request:[],current:[],setCookie:[]},
          timing:{total:Date.now()-started,waiting:0,download:0}});
      }catch{}
    }
  }
  async function start(options) {
    if(server){
      if(options&&options.collection?.id!==config.collection.id)
        throw Error("Stop the active Mock server before changing collections");
      if(options)configure(options);
      return status();
    }
    if(options)configure(options);
    if(!config)throw Error("Mock server is not configured");
    const next=http.createServer((req,res)=>{handle(req,res).catch(err=>{
      if(!res.headersSent)res.writeHead(500);res.end(String(err.message));
    });});
    try{await new Promise((resolve,reject)=>{next.once("error",reject);next.listen(config.port,HOST,resolve);});}
    catch(err){next.close();throw err;}
    server=next;activePort=config.port;return status();
  }
  async function stop() {
    if(!server)return status();
    const previous=server;server=null;activePort=null;
    previous.closeAllConnections?.();
    await new Promise((resolve,reject)=>previous.close(err=>err?reject(err):resolve()));
    return status();
  }
  return {start,stop,configure,status};
}
module.exports={createMockServer,matchRule,upstreamUrl,safeHeaders,safeBody,safeUrl,requireConfig};
