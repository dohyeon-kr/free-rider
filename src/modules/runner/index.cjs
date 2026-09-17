const {runScript}=require("../scripts/index.cjs");
const { prepare, extract, MULTIPART_MARKER } = require("./request.cjs");
async function fetchText(url, options = {}, fetcher = fetch) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol))
    throw Error("HTTP/HTTPS만 지원합니다.");
  const started = performance.now();
  const response = await fetcher(url, {
    ...options,
    redirect: "error",
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)])
      : AbortSignal.timeout(30000),
  });
  const headersAt = performance.now();
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body || []) {
    bytes += chunk.length;
    if (bytes > 10 * 1024 * 1024) throw Error("응답이 10MB 제한을 넘었습니다.");
    chunks.push(chunk);
  }
  const finishedAt = performance.now();
  return {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers),
    setCookies:
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : [],
    body: Buffer.concat(chunks).toString("utf8"),
    bytes,
    timing: {
      waiting: Math.round(headersAt - started),
      download: Math.round(finishedAt - headersAt),
      total: Math.round(finishedAt - started),
    },
  };
}
function isMultipartBody(body) {
  return body?.[MULTIPART_MARKER] === 1 && Array.isArray(body.parts);
}
async function multipartForm(body, resolveFile) {
  if (!isMultipartBody(body)) return body;
  const form = new FormData();
  let totalBytes = 0;
  for (const part of body.parts) {
    if (part.kind !== "file") {
      form.append(part.key, String(part.value ?? ""));
      continue;
    }
    if (typeof resolveFile !== "function")
      throw Error(`${part.name || part.key} 파일을 다시 선택하세요.`);
    const file = await resolveFile(part.id, part);
    if (!file?.data)
      throw Error(`${part.name || part.key} 파일을 다시 선택하세요.`);
    const data =
      file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    totalBytes += data.byteLength;
    if (totalBytes > 50 * 1024 * 1024)
      throw Error("한 요청에 첨부할 수 있는 파일은 합계 50MB 이하여야 합니다.");
    form.append(
      part.key,
      new Blob([data], {
        type: file.type || part.type || "application/octet-stream",
      }),
      file.name || part.name || "file",
    );
  }
  return form;
}
function fetchHeaders(headers, body) {
  const next = { ...(headers || {}) };
  if (isMultipartBody(body))
    for (const key of Object.keys(next))
      if (key.toLowerCase() === "content-type") delete next[key];
  return next;
}
async function execute(request, variables, signal, interceptors = {}, environment = variables, resolveFile, fetcher = fetch) {
  let p = prepare(request, variables);
  const
    start = performance.now();
  const logs=[],changes={},deleted=new Set();
  const capture=result=>{
    for(const key of result.deleted) {delete changes[key];deleted.add(key);}
    for(const [key,value] of Object.entries(result.changes)) {changes[key]=value;deleted.delete(key);}
    logs.push(...result.logs);
  };
  if(interceptors.enabled) {
    try {
      const before=await runScript(interceptors.before,{req:p,vars:variables,env:environment},signal);
      p=before.req;
      const target=new URL(p.url);
      if(!["http:","https:"].includes(target.protocol) || target.username || target.password) throw Error("전처리 URL은 인증정보 없는 HTTP/HTTPS 주소여야 합니다.");
      p.method=String(p.method).toUpperCase();
      if(!/^[!#$%&'*+.^_`|~0-9A-Z-]+$/.test(p.method) || ["CONNECT","TRACE","TRACK"].includes(p.method)) throw Error("지원하지 않는 HTTP 메서드입니다.");
      if(["GET","HEAD"].includes(p.method)) p.body=undefined;
      capture(before);
    } catch(error) {throw Error("Before Request interceptor: "+error.message);}
  }
  const requestHeaders = fetchHeaders(p.headers, p.body);
  const response = await fetchText(p.url, {
    method: p.method,
    headers: requestHeaders,
    body: await multipartForm(p.body, resolveFile),
    signal,
  }, fetcher);
  let scriptError;
  let values={};
  try { values =
    response.status >= 200 &&
    response.status < 300 &&
    Object.keys(request.extract || {}).length
      ? extract(response.body, request.extract)
      : {};
  } catch(error) {scriptError="응답 추출: "+error.message;}
  if(interceptors.enabled) {
    try {
      const afterVars={...variables,...changes,...values};
      for(const key of deleted)delete afterVars[key];
      const after=await runScript(interceptors.after,{req:p,res:response,vars:afterVars,env:environment},signal);
      capture(after);
    } catch(error) {scriptError="After Response interceptor: "+error.message;}
  }
  return {
    ...response,
    request: {
      url: p.url,
      method: p.method,
      headers: requestHeaders,
      body: p.body,
    },
    scriptError,logs,deleted:[...deleted],
    elapsed: Math.round(performance.now() - start),
    variables: Object.fromEntries(Object.entries({...values,...changes}).filter(([key])=>!deleted.has(key))),
  };
}
module.exports = { fetchText, execute, multipartForm, isMultipartBody };
