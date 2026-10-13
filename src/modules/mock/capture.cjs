"use strict";

// Convert a recorded HTTP response into an editable, secret-redacted Mock draft.
// Keep the original record intact; the caller must explicitly confirm any write.
const { safeBody } = require("./server.cjs");
const MAX_BYTES = 512 * 1024;
const ALLOWED_METHOD = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/;
const SECRET_PATTERN = /\bBearer\s+[^\s"',}]+|\bsk-[A-Za-z0-9_-]{12,}|\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function redactTokens(value, depth=0) {
  if (depth > 12) return "[omitted]";
  if (typeof value === "string") return value.replace(SECRET_PATTERN, "[redacted]");
  if (Array.isArray(value)) return value.map(x=>redactTokens(x,depth+1));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redactTokens(v,depth+1)]));
  return value;
}
function contentType(headers) {
  for(const [name,value] of Object.entries(headers||{}))
    if(name.toLowerCase()==="content-type")
      return String(Array.isArray(value)?value[0]:value).split(";")[0].trim().toLowerCase();
  return "";
}
function captureCandidate(entry) {
  if(!entry || typeof entry.id !== "string" || !entry.id) throw Error("Select a Network entry");
  const response=entry.response||{}, request=entry.request||{};
  const method=String(request.method||"GET").toUpperCase();
  if(!ALLOWED_METHOD.test(method))throw Error("Only HTTP requests can be mocked");
  const status=Number(response.status);
  if(!Number.isInteger(status)||status<200||status>599||[204,205,304].includes(status))
    throw Error("Only HTTP responses with a JSON body can be captured");
  if(response.bodyTruncated)throw Error("Truncated responses cannot become Mock rules");
  const body=response.body;
  if(typeof body!=="string"||!body.trim()||Buffer.byteLength(body,"utf8")>MAX_BYTES)
    throw Error("Response is empty or exceeds the Network capture limit");
  const type=contentType(response.headers);
  if(type && type!=="application/json" && !type.endsWith("+json"))
    throw Error("Only JSON responses can become Mock rules");
  let parsed;
  try { parsed=JSON.parse(body); }
  catch { throw Error("Response is not valid JSON"); }
  // safeBody reuses the existing key-based redaction policy for nested data.
  const cleaned=safeBody(Buffer.from(JSON.stringify(parsed)),"application/json");
  let redacted;
  try { redacted=JSON.parse(cleaned); }
  catch { throw Error("Response could not be safely sanitized"); }
  redacted=redactTokens(redacted);
  let url;
  try {url=new URL(String(request.url));}
  catch{throw Error("The recorded request URL is not absolute");}
  if(!["http:","https:"].includes(url.protocol)) throw Error("Only HTTP(S) URLs can be mocked");
  const path=url.pathname;
  if(!path.startsWith("/")||path.length>1024)throw Error("Invalid endpoint path");
  return {
    entryId:entry.id,
    collectionId:String(entry.collectionId||""),
    requestId:String(entry.requestId||""),
    method,path,status,
    contentType:type||"application/json",
    body:JSON.stringify(redacted,null,2),
    warning:"응답 데이터에 개인 정보가 남을 수 있습니다. 저장 전 JSON과 경로를 검토하세요.",
  };
}
module.exports={captureCandidate,contentType,redactTokens};
