# MCP 서버

Free Rider는 앱이 실행 중일 때 로컬 MCP 서버를 열 수 있습니다. 별도 MCP 프로세스가 워크스페이스 파일을 직접 읽거나 복호화하지 않고, Free Rider 앱의 기존 요청 실행 경로를 그대로 사용합니다.

## 켜기와 끄기

앱 하단의 `MCP 꺼짐` 버튼을 누르면 서버가 켜집니다.

- 기본 상태: 꺼짐
- 주소: `http://127.0.0.1:48173/mcp`
- 바인딩: localhost 전용
- 다시 버튼을 누르면 즉시 종료

서버가 켜지면 버튼에 `MCP :48173`이 표시됩니다.

::: tip 저장 후 사용
MCP는 저장된 워크스페이스를 기준으로 컬렉션, 요청, 환경, Interceptor 설정을 읽습니다. 편집 중인 변경 내용을 AI에서 바로 사용하거나 MCP로 Interceptor/OpenAPI 변경을 반영하려면 먼저 워크스페이스를 저장하세요.
:::

## 제공 도구

| Tool | 설명 |
| --- | --- |
| `list_collections` | 컬렉션과 환경 이름, Interceptor 활성화 여부 조회 |
| `list_requests` | 컬렉션의 요청 목록 조회 |
| `get_request` | 저장된 요청 상세 조회 |
| `get_collection_interceptors` | 컬렉션의 Before Request / After Response Interceptor 설정과 코드 조회 |
| `set_collection_interceptors` | 컬렉션 Interceptor 활성화 여부와 코드를 부분 수정 후 저장 |
| `get_openapi_spec` | 연결된 OpenAPI 소스와 생성될 operation 요약 조회 |
| `set_openapi_source` | HTTP/HTTPS OpenAPI 명세 URL을 검증 후 연결/변경 - 요청 변경은 아직 반영하지 않음 |
| `unlink_openapi` | 저장된 요청은 유지한 채 OpenAPI 명세 연결만 해제 |
| `review_openapi` | 연결된 OpenAPI 명세와 저장된 요청의 변경·충돌을 검토하고 임시 `reviewId` 발급 |
| `apply_openapi_review` | 검토 결과에서 선택한 엔드포인트만 반영하고 충돌 처리 방식을 명시적으로 적용 |
| `send_request` | 저장된 요청 실행 |
| `list_network_history` | Network 탭의 최근 기록을 필터링해서 요약 조회 |
| `get_network_entry` | Network 탭 기록 상세를 민감값 마스킹 후 조회 |

`list_collections`는 환경 변수 값이나 Interceptor 코드를 반환하지 않습니다. `send_request`는 Free Rider 본체의 요청 실행 핸들러를 사용하므로 앱과 같은 쿠키 세션, 컬렉션 Interceptor, assertion 실행 흐름을 탑니다.

## Interceptor 조회와 설정

`get_collection_interceptors`는 해당 컬렉션의 현재 저장 설정을 반환합니다.

```json
{
  "enabled": true,
  "before": "req.headers.set(\"Authorization\", \"Bearer \" + ctx.vars.get(\"accessToken\"));",
  "after": "if (res.status === 200) ctx.vars.set(\"lastStatus\", res.status);"
}
```

`set_collection_interceptors`는 전달한 필드만 수정합니다. 예를 들어 기존 After Response 코드는 유지하면서 Before Request만 바꾸고 활성화할 수 있습니다.

```json
{
  "collectionId": "collection-id",
  "enabled": true,
  "before": "req.headers.set(\"X-Client\", \"free-rider\");"
}
```

- `enabled`: Interceptor 전체 활성화 여부
- `before`: Before Request Interceptor 코드
- `after`: After Response Interceptor 코드
- 생략한 필드는 기존 값을 유지

쓰기 전에 앱에 미저장 변경이 있으면 `set_collection_interceptors`는 저장 충돌을 막기 위해 실패합니다. 먼저 Free Rider 워크스페이스를 저장한 뒤 다시 호출하세요. MCP에서 저장이 성공하면 앱 화면은 저장된 상태를 다시 읽도록 새로고침됩니다.

Interceptor 코드에서 사용할 수 있는 `req`, `res`, `ctx` API는 [Script API Reference](/reference/script-api)를 참고하세요.

::: warning Interceptor 코드와 비밀값
`get_collection_interceptors`는 저장된 Interceptor 코드 원문을 반환합니다. 토큰이나 비밀번호를 코드에 직접 넣지 말고 Environment/Vars를 사용하세요.
:::

## OpenAPI 명세 연결 관리

`get_openapi_spec`으로 컬렉션에 현재 연결된 명세를 조회할 수 있습니다. 소스 종류와 위치, 파싱된 title/base URL, 생성될 operation 요약을 반환하며 저장된 요청은 변경하지 않습니다.

```json
{
  "collectionId": "collection-id"
}
```

HTTP/HTTPS 명세 URL을 새로 연결하거나 바꾸려면 `set_openapi_source`를 사용합니다.

```json
{
  "collectionId": "collection-id",
  "source": "https://api.example.com/openapi.json"
}
```

저장 전에 실제 URL을 가져와 파싱까지 검증합니다. 이 호출은 **명세 연결만 변경**하며 엔드포인트 변경을 즉시 반영하지 않습니다. 이후 `review_openapi`로 차이를 확인하세요. `unlink_openapi`는 저장된 요청을 그대로 둔 채 명세 연결만 제거합니다.

앱에 미저장 변경이 있으면 명세 연결 쓰기는 거절됩니다. OpenAPI UI의 Basic Auth 값은 원래대로 세션에만 존재하며 MCP에 노출하지 않습니다. 따라서 해당 인증이 필요한 비공개 명세는 앱에서 관리해야 합니다. 이미 연결된 로컬 명세 파일은 조회할 수 있지만 새 로컬 파일 연결은 파일 선택 권한이 필요한 UI 작업으로 유지합니다.

## OpenAPI 변경 검토

MCP에서 OpenAPI 동기화는 **검토와 반영을 분리한 2단계 흐름**입니다. 연결된 명세를 읽었다고 요청이 바로 바뀌지 않습니다.

먼저 `review_openapi`에 컬렉션 ID를 전달합니다.

```json
{
  "collectionId": "collection-id"
}
```

응답에는 약 10분 동안 유효한 `reviewId`, 추가·수정·삭제·충돌 개수, 엔드포인트별 변경 필드가 포함됩니다. 기존 요청을 로컬에서 수정한 필드와 새 명세가 동시에 바뀌면 `conflict: true`로 표시됩니다.

반영할 때는 `apply_openapi_review`에 **선택한 엔드포인트 ID만** 전달합니다.

```json
{
  "reviewId": "review-id",
  "selectedIds": ["GET /users", "POST /users"],
  "resolutions": [
    {
      "requestId": "GET /users",
      "field": "description",
      "choice": "incoming"
    }
  ]
}
```

- 선택하지 않은 추가·수정·삭제는 반영하지 않음
- 선택한 변경에 충돌이 있으면 각 필드마다 `local` 또는 `incoming`을 명시해야 함
- 검토 뒤 워크스페이스가 바뀌었거나 `reviewId`가 만료되면 다시 검토해야 함
- 앱에 저장하지 않은 편집이 있으면 검토와 반영 모두 중단됨
- 명세의 `baseUrl`이 필요하면 `suggestedBaseUrl`로만 반환하며 Environment를 자동 수정하지 않음
- 반영에 성공하면 직전 명세 반영 상태를 `syncUndo`로 보관하고 앱을 저장된 상태로 다시 읽음

연결된 로컬 OpenAPI 파일이 있으면 해당 파일을 우선 사용하고, 아니면 컬렉션에 저장된 Specification URL을 사용합니다. UI에서 일시적으로 입력한 인증 정보가 필요한 명세 URL은 MCP에 인증 값을 노출하지 않으므로 앱의 OpenAPI 화면에서 검토하세요.

## Network 탭 히스토리 조회

`list_network_history`는 앱 Network 탭과 같은 영속 히스토리를 읽습니다. `limit` 외에도 `collectionId`, `requestId`, `method`, 정확한 `status`, 최소 시각 `since`(밀리초), 자유 검색 `search`로 필터할 수 있습니다.

```json
{
  "collectionId": "collection-id",
  "method": "GET",
  "status": 200,
  "since": 1789693200000,
  "search": "/users",
  "limit": 50
}
```

목록에서 받은 `id`를 `get_network_entry`에 전달하면 요청/응답 body, headers, cookies, timing, error를 확인할 수 있습니다.

MCP 응답에서는 일반적인 비밀값을 자동으로 마스킹합니다. Authorization/Cookie/Set-Cookie/API key 계열 헤더, 쿠키 값, token·secret·password 같은 쿼리 파라미터와 JSON 필드가 대상입니다. 정말 원문 값 확인이 필요한 경우에는 로컬 앱의 Network 탭에서 직접 확인하도록 범위를 분리했습니다.

## MCP 연결 handoff prompt

다른 AI 에이전트나 IDE에게 **Free Rider MCP 연결 작업 자체**를 맡길 때 아래 프롬프트를 그대로 전달하세요.

<McpHandoffPrompt locale="ko" />

::: tip 로컬 실행 환경 확인
Free Rider MCP는 `127.0.0.1`에만 열립니다. AI 에이전트나 IDE가 별도 VM, 컨테이너, 원격 서버에서 실행된다면 그 환경의 `127.0.0.1`은 Free Rider가 실행 중인 Mac을 가리키지 않으므로 직접 연결되지 않습니다.
:::

## 보안 범위

서버는 `127.0.0.1`에만 바인딩되며 외부 웹 Origin 요청을 거절합니다. 현재 버전은 로컬 개발 도구 연결을 전제로 하며 별도 사용자 인증은 제공하지 않습니다.

## 프로토콜

2026-07-28 MCP 요청과 initialize 기반의 이전 MCP 클라이언트를 함께 처리합니다. HTTP endpoint는 JSON 응답을 사용하는 stateless Streamable HTTP 방식입니다.
