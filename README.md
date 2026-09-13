# Free Rider

서버·계정 없이 사용하는 Electron API 클라이언트입니다. 요청 작성과 실행, 환경별 변수, 전역 전후처리, OpenAPI 변경 검토와 선택 반영, 로컬 Git 작업을 제공합니다.

## 실행

```sh
npm ci
npm start
```

macOS Apple Silicon 검토용 설치본은 `dist/Free-Rider-0.2.0-arm64.dmg`, 앱은 `dist/mac-arm64/Free Rider.app`에 생성됩니다. 배포용 서명·공증은 별도입니다.

## 요청과 저장

- 사이드바의 +로 컬렉션을 만들고, 상단 + 요청 또는 탭의 +로 요청을 추가합니다.
- 컬렉션·폴더는 화살표로 접고 펼칩니다. 컬렉션 제목 옆 화살표는 컬렉션 선택 메뉴입니다.
- Params / Headers / Body / Auth / Vars / Tests에서 요청을 편집합니다.
- 단일 전송은 현재 편집본을 사용합니다. 컬렉션 실행은 저장된 요청을 사용합니다.
- 탭을 닫을 때 변경이 있으면 저장·버리기·취소를 선택합니다.
- 저장 버튼 또는 Cmd/Ctrl+S로 암호화된 로컬 워크스페이스에 보관합니다.
- 전송 오류와 실행 로그는 응답 영역의 콘솔에 표시합니다. Body에는 서버 응답만 표시합니다.
- GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, QUERY와 사용자 메서드를 입력할 수 있습니다. CONNECT 터널과 TRACE/TRACK은 현재 전송 엔진에서 지원하지 않습니다.

## 환경변수

환경 화면에서 여러 환경을 만들거나 .env 파일을 연결합니다. 요청에 `{{BASE_URL}}`, `{{accessToken}}`처럼 사용합니다. 이름은 대소문자를 구분합니다.

변수 우선순위: 컬렉션·폴더 기본값 < 선택 환경 < 요청별 Vars < 실행 중 변수.

연결된 파일은 원문을 편집하고 ‘편집 내용 적용’ 또는 ‘파일 저장’을 누릅니다. 다시 읽기는 디스크의 최신 내용을 불러옵니다. 파일이 외부에서 바뀌면 저장을 차단하므로 먼저 다시 읽어 확인하세요. 환경 표는 적용된 값의 확인용입니다.

## 전역 전후처리

사이드바 ‘전역 전후처리’에서 활성화합니다. 모든 컬렉션에 적용하며 실행 시작 시 설정을 고정합니다. 코드는 각 편집기에 함수 본문으로 작성합니다. 저장 요청 원본은 변경하지 않습니다.

전처리 예:

```js
const token = ctx.vars.get("accessToken");
if (token) req.headers.set("Authorization", "Bearer " + token);
req.headers.set("X-Environment", ctx.env.get("ENV"));
```

후처리 예:

```js
if (req.url.includes("/login") && res.status === 200) {
  ctx.vars.set("accessToken", res.json().accessToken);
}
ctx.log("HTTP", res.status);
```

API:
- `req.method`, `req.url`, `req.body`, `req.headers.get/set/delete`
- `res.status`, `res.headers.get`, `res.text()`, `res.json()`
- `ctx.env.get`, `ctx.vars.get/set/delete`, `ctx.log`

환경 값은 읽기 전용입니다. 런타임 값은 같은 컬렉션·환경에서 이어서 사용하며 앱 종료 또는 초기화 시 지워집니다. 파일·셸·직접 네트워크 접근은 제공하지 않습니다. 스크립트는 별도 Worker의 QuickJS에서 시간·메모리 제한으로 실행합니다.

## 컬렉션 실행

‘엔드포인트 추가’로 저장된 요청을 선택합니다. 실행 목록에서 제외해도 원본 요청은 남습니다. 순서를 변경하고 선택한 요청을 실행합니다. 실패 시 중단, 수동 중지, 요청별 결과 확인을 지원합니다. 실행 목록 설정은 저장 버튼으로 보관합니다.

## 명세 동기화

1. OpenAPI 3.x JSON/YAML 파일 또는 URL을 연결합니다.
2. 동기화하면 변경 검토 목록이 열립니다. 이 시점에는 요청이 바뀌지 않습니다.
3. 엔드포인트를 펼쳐 이전 명세·현재 요청·새 명세를 비교합니다.
4. 충돌 항목은 현재 값 유지 또는 명세 값 반영을 선택합니다. 미해결 충돌은 반영할 수 없습니다.
5. 체크한 엔드포인트만 반영합니다. 삭제 후보는 기본 미선택입니다.
6. 반영 결과는 저장 성공 후 적용됩니다. 직전 반영은 복원할 수 있습니다.

선택하지 않은 변경은 다음 동기화에서도 남습니다. Headers·Query·응답 스키마는 항목별로 비교하고, 문자열 Body와 배열은 한 값으로 비교합니다. 외부 $ref는 명세를 bundle한 후 가져옵니다. 연결한 파일은 ‘다시 읽기’로 재검토합니다.

선택 환경에 baseUrl이 비어 있으면 명세 서버 주소 등록을 제안합니다. URL 명세의 상대 서버 주소는 명세 URL 기준으로 해석합니다.

## Git

로컬 저장소를 선택하고 컬렉션 파일 저장 → diff 확인 → commit 순서로 사용합니다. `open-api.collection.json`만 커밋하므로 다른 staged 파일은 포함하지 않습니다. 최근 컬렉션 커밋을 표시합니다. Push/Pull은 외부 Git 클라이언트를 사용합니다.

환경 실값·파일 경로·전역 스크립트·복원 백업은 공유 파일에 포함하지 않습니다. 요청에 직접 적은 값은 포함되므로 공유할 값은 변수로 작성하세요.

## 검증과 빌드

```sh
npm test
npm run test:electron
npm run dist:mac -- --config.mac.identity=null
```

Electron smoke는 임시 파일·저장소·HTTP 서버로 테스트하며 사용자 워크스페이스를 사용하지 않습니다. 화면 캡처는 `test-results/`에 생성됩니다.

구현 및 검증 기록은 `docs/implementation-plan.md`, `docs/completion-audit.md`에 있습니다.
