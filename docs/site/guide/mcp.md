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
MCP는 저장된 워크스페이스를 기준으로 컬렉션, 요청, 환경을 읽습니다. 편집 중인 변경 내용을 AI에서 바로 사용하려면 먼저 워크스페이스를 저장하세요.
:::

## 제공 도구

| Tool | 설명 |
| --- | --- |
| `list_collections` | 컬렉션과 환경 이름 조회 |
| `list_requests` | 컬렉션의 요청 목록 조회 |
| `get_request` | 저장된 요청 상세 조회 |
| `send_request` | 저장된 요청 실행 |
| `list_network_history` | 최근 네트워크 기록 요약 조회 |
| `get_network_entry` | 네트워크 기록 상세 조회 |

`list_collections`는 환경 변수 값을 반환하지 않습니다. `send_request`는 Free Rider 본체의 요청 실행 핸들러를 사용하므로 앱과 같은 쿠키 세션, 전후처리, assertion 실행 흐름을 탑니다.

## 보안 범위

서버는 `127.0.0.1`에만 바인딩되며 외부 웹 Origin 요청을 거절합니다. 현재 버전은 로컬 개발 도구 연결을 전제로 하며 별도 사용자 인증은 제공하지 않습니다.

## 프로토콜

2026-07-28 MCP 요청과 initialize 기반의 이전 MCP 클라이언트를 함께 처리합니다. HTTP endpoint는 JSON 응답을 사용하는 stateless Streamable HTTP 방식입니다.
