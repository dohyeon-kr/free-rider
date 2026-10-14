// Redirect a Course to the local Mock Proxy without mutating its saved requests.
// Fail closed for URLs that cannot be safely mapped to the configured upstream.
// Match the same environment variable rules as the Mock Server for absolute URLs.
export function resolveRideUpstream(template, values = {}) {
  return String(template || "").replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, key) => {
    const alias=key==="baseUrl"?"baseURL":key==="baseURL"?"baseUrl":null;
    const value=Object.hasOwn(values,key)?values[key]:(alias?values[alias]:undefined);
    if(value===undefined||value===null||value==="")throw Error("Mock Proxy Upstream 변수 "+key+"를 설정하세요.");
    return String(value);
  });
}

export function proxyRequestUrl(value, proxyUrl, upstreamUrl = "") {
  let proxy;
  try { proxy = new URL(proxyUrl); } catch { throw Error("Mock Proxy 주소가 올바르지 않습니다."); }
  if (proxy.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(proxy.hostname))
    throw Error("Ride는 로컬 Mock Proxy에만 연결할 수 있습니다.");

  const source = String(value || "");
  if (/^\{\{\s*(?:baseUrl|baseURL)\s*\}\}(?=\/|\?|#|$)/.test(source))
    return source.replace(/^\{\{\s*(?:baseUrl|baseURL)\s*\}\}/, proxy.origin);

  let target;
  try { target = new URL(source); }
  catch { throw Error("Mock Proxy Ride는 {{baseUrl}} 또는 Upstream과 일치하는 절대 URL 요청만 지원합니다."); }
  if (!["http:", "https:"].includes(target.protocol))
    throw Error("Mock Proxy Ride는 HTTP(S) 요청만 지원합니다.");
  if (!upstreamUrl)
    throw Error("절대 URL 요청을 프록시로 보내려면 Mock Proxy의 Upstream URL을 설정하세요.");

  let upstream;
  try { upstream = new URL(upstreamUrl); }
  catch { throw Error("Mock Proxy Upstream URL이 올바르지 않습니다."); }
  const prefix = upstream.pathname.replace(/\/$/, "");
  if (target.origin !== upstream.origin ||
      (prefix && target.pathname !== prefix && !target.pathname.startsWith(prefix + "/")))
    throw Error("요청 주소가 Mock Proxy Upstream과 일치하지 않습니다: " + target.origin);
  target.pathname = target.pathname.slice(prefix.length) || "/";
  target.protocol = proxy.protocol;
  target.host = proxy.host;
  return target.href;
}

export function routeRideThroughMockProxy(request, { url, upstream = "" }) {
  return { ...request, url: proxyRequestUrl(request.url, url, upstream) };
}
