# Open API Client

OpenAPI 명세와 실제 API 요청을 함께 관리하는 macOS Electron 클라이언트.
[Bruno를 활용한 협업 경험](https://blog.dohyeon.kr/peuronteuendeuwa-baegendeu-gaebalja-hyeobeobhagi/)에서 출발했습니다.

## 사용 흐름

1. OpenAPI 3.x JSON/YAML 파일을 가져오거나 명세 URL을 입력하고 **동기화**합니다.
2. **환경 설정**에서 `baseUrl`, 경로 파라미터, 로그인 정보를 입력합니다. `.env` 가져오기도 가능합니다.
3. 로그인 요청의 **Auth & Variables**에서 응답 추출을 설정합니다. 예: `{"token":"data.accessToken"}`.
4. 후속 요청에서 **Bearer 인증**을 켜면 선택한 환경의 토큰을 자동 사용합니다. 토큰 만료 시 로그인 요청을 재실행합니다.
5. **Git용 저장**으로 공유하거나 **Git**에서 기존 로컬 저장소를 선택하고 컬렉션 저장 → 변경 확인 → 커밋합니다.

`Cmd+Enter`: 요청 실행 · `Cmd+S`: 컬렉션 저장.

## 모듈 경계

| 모듈 | 위치 | 책임 |
|---|---|---|
| Sync | `src/modules/sync` | OpenAPI 파싱, 내부 참조 해석, 요청 생성, 3-way 동기화 |
| Request / Response Runner | `src/modules/runner` | 변수 치환, HTTP 실행, 응답/메트릭, 취소·30초 제한·10MB 제한, 응답 변수 추출 |
| Env | `src/modules/env` | dotenv 파싱, 환경별 런타임 토큰 격리, 공유용 변수 이름 보존 |
| Git | `src/modules/git` | 기존 저장소 선택, 상태·diff, 컬렉션 저장과 파일 단위 커밋 |
| Electron adapter | `src/main.cjs`, `src/preload.cjs` | 파일 대화상자·IPC·창 수명 관리 |
| UI | `src/renderer.js` | 편집기·요청 목록·환경 및 Git 화면 |

Sync는 최초 생성 값을 baseline으로 남깁니다. 재동기화 시 수정하지 않은 필드는 새 명세를 따르고, 사용자가 수정한 필드는 유지합니다. 비교 단위는 URL/body/auth 또는 query/headers/extract 객체 전체입니다. 사라진 요청은 표시 후 보존하며 수동 요청도 유지합니다. 매칭 키는 HTTP 메서드 + 경로입니다.

환경변수와 추출 토큰은 메모리에만 보관합니다. 컬렉션 JSON에는 변수 이름과 빈 값만 기록합니다. 요청에 직접 쓴 비밀값은 자동 제거하지 않으므로 반드시 `{{변수}}`를 사용하세요. 저장 후 Git으로 변경 이력을 공유할 수 있습니다. Git push/pull과 자격 증명 설정은 기존 Git 도구에서 진행합니다.

## 개발 및 테스트

```sh
npm ci
npm start
npm test
```

Node 24를 사용합니다. 배포 빌드는 GitHub Actions에서 수행합니다. `main` push, PR, 수동 실행으로 macOS Apple Silicon/Intel DMG와 ZIP을 각각 생성하고 SHA-256 파일과 함께 30일간 아티팩트로 보관합니다.

## macOS 서명

설정: GitHub 저장소 → Settings → Secrets and variables → Actions.

| Secret | 값 |
|---|---|
| `CSC_LINK` | 개인키가 포함된 Developer ID Application `.p12`의 base64 |
| `CSC_KEY_PASSWORD` | `.p12` 내보내기 암호 |
| `APPLE_ID` | Apple Developer 계정 이메일 |
| `APPLE_APP_SPECIFIC_PASSWORD` | 공증용 앱 전용 암호 |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

모두 설정하면 Developer ID 서명, Apple 공증, stapling 및 Gatekeeper 검증을 수행합니다. 일부만 설정하면 잘못된 배포본을 만들지 않도록 빌드가 실패합니다. **모두 없으면 ad-hoc 서명 테스트 빌드**를 생성하며 아티팩트 이름에 `adhoc`가 붙습니다. ad-hoc는 Apple이 신원을 확인한 서명이 아니므로 Gatekeeper가 다운로드한 앱을 차단할 수 있습니다. 인증서와 암호를 소스나 채팅에 넣지 마세요.

## 첫 버전 범위

- OpenAPI 3.x, 내부 `$ref`, JSON 본문 생성, raw body 편집, 헤더/쿼리/경로 변수 지원.
- 외부 `$ref`는 미리 bundle해야 합니다. Swagger 2.0, multipart 파일 업로드, OAuth 브라우저 로그인, 쿠키 jar, 자동 토큰 갱신은 아직 미지원입니다.
- OpenAPI server 변수를 사용하는 URL은 환경에서 실제 `baseUrl`로 바꿔주세요.
- 응답은 텍스트로만 표시하며 HTML을 실행하지 않습니다. HTTP redirect는 토큰의 의도치 않은 전달과 요청 재실행을 막기 위해 자동 추적하지 않습니다.
- 네트워크·파일·Git 접근은 main process에만 있으며 renderer는 sandbox/context isolation 및 제한된 IPC를 사용합니다.
- Git은 시스템에 설치된 Git과 사용자 설정을 사용합니다. 커밋에는 `open-api.collection.json`만 포함합니다. 다른 staged 파일은 보존합니다.
