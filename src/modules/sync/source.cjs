// Authentication for downloading a specification, not for generated API requests.
function specFetchOptions(auth) {
  if (auth == null || auth.type === "none") return {};
  if (auth.type !== "basic") throw Error("지원하지 않는 명세 인증 방식입니다.");
  const { username, password } = auth;
  if (typeof username !== "string" || typeof password !== "string")
    throw Error("Basic Auth 아이디와 비밀번호는 문자열이어야 합니다.");
  if (username.includes(":")) throw Error("Basic Auth 아이디에는 콜론(:)을 사용할 수 없습니다.");
  if (/[\u0000-\u001f\u007f]/.test(username + password))
    throw Error("Basic Auth 아이디와 비밀번호에는 제어 문자를 사용할 수 없습니다.");
  return {
    headers: {
      Authorization: "Basic " + Buffer.from(`${username}:${password}`, "utf8").toString("base64"),
    },
  };
}

async function readSpecSource(source, auth, fetchText) {
  let url;
  try { url = new URL(String(source).trim()); }
  catch { throw Error("올바른 OpenAPI HTTP/HTTPS URL을 입력하세요."); }
  if (!["http:", "https:"].includes(url.protocol))
    throw Error("OpenAPI 명세는 HTTP/HTTPS URL만 지원합니다.");
  if (url.username || url.password)
    throw Error("URL에 인증 정보를 넣지 말고 명세의 Basic Auth 입력란을 사용하세요.");
  // Keep the existing transport's timeout, size limit and redirect rejection.
  const result = await fetchText(url.href, specFetchOptions(auth));
  if (result.status === 401)
    throw Error("명세 HTTP 401: Basic Auth 아이디와 비밀번호를 확인하세요.");
  if (result.status === 403)
    throw Error("명세 HTTP 403: 이 계정에 OpenAPI 명세 접근 권한이 있는지 확인하세요.");
  if (result.status < 200 || result.status >= 300)
    throw Error(`명세 HTTP ${result.status}`);
  return result.body;
}

module.exports = { specFetchOptions, readSpecSource };
