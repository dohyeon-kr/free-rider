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
MCP는 저장된 워크스페이스를 기준으로 컬렉션, 요청, 환경, Interceptor 설정을 읽습니다. 편집 중인 변경 내용을 AI에서 바로 사용하거나 MCP로 Interceptor를 변경하려면 먼저 워크스페이스를 저장하세요.
:::

## 제공 도구

| Tool | 설명 |
| --- | --- |
| `list_collections` | 컬렉션과 환경 이름, Interceptor 활성화 여부 조회 |
| `list_requests` | 컬렉션의 요청 목록 조회 |
| `get_request` | 저장된 요청 상세 조회 |
| `get_collection_interceptors` | 컬렉션의 Before Request / After Response Interceptor 설정과 코드 조회 |
| `set_collection_interceptors` | 컬렉션 Interceptor 활성화 여부와 코드를 부분 수정 후 저장 |
| `send_request` | 저장된 요청 실행 |
| `list_network_history` | 최근 네트워크 기록 요약 조회 |
| `get_network_entry` | 네트워크 기록 상세 조회 |

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
