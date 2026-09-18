const { rows } = require("./context.cjs");
const MULTIPART_MARKER = "__freeRiderMultipart";

const VARIABLE_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

function interpolateWith(value, resolve) {
  return String(value).replace(VARIABLE_PATTERN, (_, key) =>
    String(resolve(key)),
  );
}
function interpolate(value, variables = {}) {
  return interpolateWith(value, (key) => {
    if (!Object.hasOwn(variables, key))
      throw Error(`환경변수 ${key}를 설정하세요.`);
    return variables[key];
  });
}
function parameterLocations(request) {
  return new Map(
    (request?.openapi?.parameters || [])
      .filter((parameter) => parameter?.name)
      .map((parameter) => [String(parameter.name), parameter.in || "query"]),
  );
}
function urlTemplateKeys(request) {
  const keys = new Set();
  const target = String(request?.url || "").split(/[?#]/, 1)[0];
  for (const match of target.matchAll(VARIABLE_PATTERN)) keys.add(match[1]);
  return keys;
}
function resolveRequestVariables(request, variables = {}) {
  const raw = new Map(
    rows(request?.query).filter(([, value]) => value !== ""),
  );
  const resolved = Object.create(null);
  const resolving = new Set();

  function resolveParameter(key) {
    if (Object.hasOwn(resolved, key)) return resolved[key];
    if (!raw.has(key)) {
      if (!Object.hasOwn(variables, key))
        throw Error(`환경변수 ${key}를 설정하세요.`);
      return variables[key];
    }
    if (resolving.has(key))
      throw Error(`파라미터 ${key}에 순환 참조가 있습니다.`);
    resolving.add(key);
    const value = interpolateWith(raw.get(key), (nested) =>
      raw.has(nested) ? resolveParameter(nested) : interpolate(`{{${nested}}}`, variables),
    );
    resolving.delete(key);
    resolved[key] = value;
    return value;
  }

  for (const key of raw.keys()) resolveParameter(key);
  return { ...variables, ...resolved };
}
function resolveRequestTarget(request, variables = {}) {
  const scopedVariables = resolveRequestVariables(request, variables);
  const locations = parameterLocations(request);
  const templateKeys = urlTemplateKeys(request);
  return {
    url: interpolate(request?.url || "", scopedVariables),
    variables: scopedVariables,
    parameters: rows(request?.query)
      .filter(([, value]) => value !== "")
      .map(([key, value]) => ({
        key,
        value: interpolate(value, scopedVariables),
        location: locations.get(key) || (templateKeys.has(key) ? "path" : "query"),
      })),
  };
}
function prepareMultipart(body, variables) {
  let config;
  try {
    config = JSON.parse(body || "{}");
  } catch {
    throw Error("multipart 본문 설정을 읽을 수 없습니다.");
  }
  if (config?.[MULTIPART_MARKER] !== 1 || !Array.isArray(config.parts))
    throw Error("multipart 본문 설정이 올바르지 않습니다.");
  return {
    [MULTIPART_MARKER]: 1,
    parts: config.parts
      .filter((part) => part?.enabled !== false)
      .map((part) => {
        const key = interpolate(part.key ?? "", variables).trim();
        if (!key) throw Error("multipart 필드 이름을 입력하세요.");
        if (part.kind === "file") {
          if (!part.id) throw Error(`${key} 파일 슬롯이 올바르지 않습니다.`);
          return {
            kind: "file",
            key,
            id: String(part.id),
            name: String(part.file?.name || part.name || "file"),
            type: String(
              part.file?.type || part.type || "application/octet-stream",
            ),
          };
        }
        return {
          kind: "text",
          key,
          value: interpolate(part.value ?? "", variables),
        };
      }),
  };
}
function prepare(request, variables) {
  const target = resolveRequestTarget(request, variables);
  const scopedVariables = target.variables;
  let url;
  try { url = new URL(target.url); }
  catch { throw Error("요청 URL이 올바르지 않습니다. URL 또는 baseUrl 환경변수를 https://호스트 형태의 절대 주소로 설정하세요."); }
  if (!["http:", "https:"].includes(url.protocol))
    throw Error("HTTP/HTTPS URL만 사용할 수 있습니다.");
  if (url.username || url.password)
    throw Error("URL 대신 Authorization 헤더를 사용하세요.");
  for (const parameter of target.parameters)
    if (parameter.location !== "path")
      url.searchParams.append(parameter.key, parameter.value);
  const headers = Object.fromEntries(
    rows(request.headers).map(([k, v]) => [k, interpolate(v, scopedVariables)]),
  );
  if (
    request.auth &&
    !Object.keys(headers).some((k) => k.toLowerCase() === "authorization")
  ) {
    if (!scopedVariables.token)
      throw Error(
        "먼저 인증 요청으로 token을 추출하거나 환경변수에 설정하세요.",
      );
    headers.Authorization = `Bearer ${scopedVariables.token}`;
  }
  const auth = request.authConfig;
  if (auth?.type === "bearer")
    headers.Authorization =
      "Bearer " + interpolate(auth.token || "{{token}}", scopedVariables);
  if (auth?.type === "basic")
    headers.Authorization =
      "Basic " +
      Buffer.from(
        interpolate(auth.username || "", scopedVariables) +
          ":" +
          interpolate(auth.password || "", scopedVariables),
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
      : request.bodyType === "multipart"
        ? prepareMultipart(request.body, scopedVariables)
        : interpolate(request.body || "", scopedVariables),
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
module.exports = {
  interpolate,
  resolveRequestVariables,
  resolveRequestTarget,
  prepare,
  prepareMultipart,
  extract,
  MULTIPART_MARKER,
};
