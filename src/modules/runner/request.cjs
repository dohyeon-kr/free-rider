const { rows } = require("./context.cjs");

function interpolate(value, variables) {
  return String(value).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key) => {
    if (!Object.hasOwn(variables, key))
      throw Error(`환경변수 ${key}를 설정하세요.`);
    return String(variables[key]);
  });
}
function prepare(request, variables) {
  const resolvedUrl = interpolate(request.url, variables);
  let url;
  try { url = new URL(resolvedUrl); }
  catch { throw Error("요청 URL이 올바르지 않습니다. URL 또는 baseUrl 환경변수를 https://호스트 형태의 절대 주소로 설정하세요."); }
  if (!["http:", "https:"].includes(url.protocol))
    throw Error("HTTP/HTTPS URL만 사용할 수 있습니다.");
  if (url.username || url.password)
    throw Error("URL 대신 Authorization 헤더를 사용하세요.");
  for (const [k, v] of rows(request.query))
    if (v !== "") url.searchParams.append(k, interpolate(v, variables));
  const headers = Object.fromEntries(
    rows(request.headers).map(([k, v]) => [k, interpolate(v, variables)]),
  );
  if (
    request.auth &&
    !Object.keys(headers).some((k) => k.toLowerCase() === "authorization")
  ) {
    if (!variables.token)
      throw Error(
        "먼저 인증 요청으로 token을 추출하거나 환경변수에 설정하세요.",
      );
    headers.Authorization = `Bearer ${variables.token}`;
  }
  const auth = request.authConfig;
  if (auth?.type === "bearer")
    headers.Authorization =
      "Bearer " + interpolate(auth.token || "{{token}}", variables);
  if (auth?.type === "basic")
    headers.Authorization =
      "Basic " +
      Buffer.from(
        interpolate(auth.username || "", variables) +
          ":" +
          interpolate(auth.password || "", variables),
      ).toString("base64");
  const method = String(request.method).toUpperCase();
  if (!/^[!#$%&'*+.^_`|~0-9A-Z-]+$/.test(method))
    throw Error("올바른 HTTP 메서드를 입력하세요.");
  if (["CONNECT", "TRACE", "TRACK"].includes(method))
    throw Error(method + "는 현재 전송 엔진에서 지원하지 않습니다.");
  return {
    url: url.toString(),
    method,
    headers,
    body: ["GET", "HEAD"].includes(method)
      ? undefined
      : interpolate(request.body || "", variables),
  };
}
function extract(body, mapping) {
  const result = {};
  const json = JSON.parse(body);
  for (const [key, path] of Object.entries(mapping || {})) {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw Error("잘못된 변수 이름입니다.");
    const value = String(path)
      .split(".")
      .reduce((v, k) => v?.[k], json);
    if (value === undefined || typeof value === "object")
      throw Error(`응답에서 ${path} 값을 찾을 수 없습니다.`);
    result[key] = String(value);
  }
  return result;
}
module.exports = { interpolate, prepare, extract };
