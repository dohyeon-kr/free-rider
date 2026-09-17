from pathlib import Path

def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if text.count(old) != 1:
        raise RuntimeError(f"Expected exactly one anchor in {path}: {old[:100]!r}; found {text.count(old)}")
    p.write_text(text.replace(old, new, 1))

replace('src/main.cjs',
    'const { serverUrl } = require("./modules/sync/server.cjs");',
    'const { serverUrl } = require("./modules/sync/server.cjs");\nconst { readSpecSource } = require("./modules/sync/source.cjs");')
replace('src/main.cjs', '''handle("sync-spec", async (source, old) => {
  const r = await fetchText(source);
  if (r.status < 200 || r.status >= 300) throw Error(`명세 HTTP ${r.status}`);
  const doc = parseSpec(r.body);''', '''handle("sync-spec", async (source, old, auth) => {
  const doc = parseSpec(await readSpecSource(source, auth, fetchText));''')
replace('src/ui/app.js', 'const syncReviews = new Map();', '''const syncReviews = new Map();
import { specAuthEditor } from "./spec-auth.js";
import { SpecAuthSession } from "./spec-auth-state.mjs";
const specAuths = new SpecAuthSession();''')
replace('src/ui/app.js', '''function specView(col) {
  const root = el("div", { class: "view-inner", "data-view": "spec" });''', '''function specView(col) {
  const auth = specAuthEditor(specAuths.get(col.id, col.source), value => specAuths.set(col.id, col.source, value));
  const root = el("div", { class: "view-inner", "data-view": "spec" });''')
replace('src/ui/app.js', '''          col.source = v;
          mark(col);''', '''          const changed = String(col.source || "").trim() !== v.trim();
          col.source = v;
          if (changed) auth.reset();
          mark(col);''')
replace('src/ui/app.js', '''    button(
      "↻ Synchronize",''', '''    auth.element,
    button(
      "↻ Synchronize",''')
replace('src/ui/app.js', 'api["sync-spec"](col.source, col.requests)', 'api["sync-spec"](col.source, col.requests, auth.value())')
replace('src/ui/app.js', '''function startOpenApiCollection() {
  let source = "";''', '''function startOpenApiCollection() {
  let source = "";
  const auth = specAuthEditor();''')
replace('src/ui/app.js', '''        input(source, (value) => (source = value), {''', '''        input(source, (value) => {
          if (source.trim() !== value.trim()) auth.reset();
          source = value;
        }, {''')
replace('src/ui/app.js', '''      el(
        "div",
        { class: "actions" },
        button("OpenAPI 파일 선택",''', '''      auth.element,
      el(
        "div",
        { class: "actions" },
        button("OpenAPI 파일 선택",''')
replace('src/ui/app.js', 'api["sync-spec"](source, [])', 'api["sync-spec"](source, [], auth.value())')
replace('src/ui/app.js', '''      col.source = source;
      addCollection(col, "spec");''', '''      col.source = source;
      specAuths.set(col.id, source, auth.value());
      addCollection(col, "spec");''')
replace('src/smoke.cjs', '    if (req.url === "/spec")', '    if (require("./spec-auth-smoke.cjs").serve(req, res)) return;\n    if (req.url === "/spec")')
replace('src/smoke.cjs', '  server.close();', '  await require("./spec-auth-smoke.cjs").run({ js, poll, baseUrl, win });\n  server.close();')
for filename, text in [
    ('docs/site/guide/openapi-sync.md', '''\n## Basic Auth로 보호된 명세 가져오기\n\n새 컬렉션의 **OpenAPI로 시작하기** 또는 기존 컬렉션의 **OpenAPI / API Specifications**에서 URL을 입력한 다음, **Specification authentication → Basic Auth**를 선택하고 Username과 Password를 입력하세요. **URL로 시작** 또는 **Synchronize**로 JSON/YAML 명세를 불러옵니다. 비밀번호 옆 눈 버튼으로 값을 확인할 수 있습니다.\n\n이 인증은 **명세 파일 다운로드 전용**이며, 생성된 API 요청의 Auth와 별개입니다. 인증 정보는 같은 컬렉션과 URL에서 앱 실행 중에만 재사용하고, URL 변경 또는 앱 종료 시 삭제합니다. 워크스페이스 저장, 컬렉션 Export, Git 공유에는 포함되지 않습니다. 재실행 후에는 다시 입력하세요.\n\nHTTP 401은 아이디/비밀번호를, HTTP 403은 명세 접근 권한을 확인하세요. URL에 `user:password@`를 넣지 말고 인증 입력란을 사용하세요. HTTPS 사용을 권장하며, 리다이렉트는 기존과 동일하게 허용하지 않습니다.\n'''),
    ('docs/site/en/guide/openapi-sync.md', '''\n## Import a specification protected by Basic Auth\n\nIn **Start with OpenAPI** for a new collection, or **OpenAPI / API Specifications** for an existing collection, enter the URL, select **Specification authentication → Basic Auth**, and enter Username and Password. Use **Start from URL** or **Synchronize** to load a JSON/YAML specification. The eye button reveals or hides the password.\n\nThis authentication is **only for downloading the specification**, separate from generated API request authentication. Credentials are reused for the same collection and URL during the current app session only. Changing the URL or closing the app clears them. They are not included in saved workspaces, collection exports, or Git sharing. Enter them again after restarting.\n\nFor HTTP 401, check the username/password; for HTTP 403, check specification access permissions. Use the authentication fields rather than embedding `user:password@` in the URL. HTTPS is recommended. Redirects remain disabled.\n''')]:
    p = Path(filename)
    p.write_text(p.read_text().rstrip() + '\n' + text)
