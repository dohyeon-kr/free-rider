export const MCP_HANDOFF_PROMPTS = Object.freeze({
  ko: `현재 로컬에서 Free Rider 앱의 MCP 서버를 켜 둔 상태다. 이 환경에서 Free Rider MCP를 현재 사용 중인 AI 에이전트/IDE에 연결해줘.

연결 정보:
- 이름: free-rider
- transport: Streamable HTTP
- URL: http://127.0.0.1:48173/mcp
- 인증: 없음
- 네트워크 범위: localhost only

요구사항:
1. 현재 클라이언트가 사용하는 MCP 설정 방식과 설정 파일 위치를 먼저 확인한다.
2. 클라이언트별 설정 형식을 추측하지 말고, 현재 환경에서 지원하는 Streamable HTTP MCP 설정 형식으로 직접 추가한다.
3. 이 서버는 이미 실행 중인 HTTP MCP 서버이므로 stdio, npx, 별도 MCP 서버 프로세스를 만들지 않는다.
4. 설정 변경 권한이 있다면 직접 반영하고, 필요한 경우 MCP 설정 reload 또는 클라이언트 재시작 단계까지 수행한다.
5. 연결 후 tools/list 또는 클라이언트의 MCP 도구 목록에서 Free Rider 도구가 노출되는지 확인한다.
6. 가능하면 읽기 전용 검증으로 list_collections까지 호출해 연결을 확인한다. 연결 테스트만을 위해 send_request나 set_collection_interceptors를 실행하지 않는다.
7. 연결에 실패하면 URL 접근 가능 여부, transport 지원 여부, MCP protocol 협상 결과를 순서대로 확인한다.
8. 작업이 끝나면 변경한 설정 파일/설정 항목과 연결 검증 결과를 짧게 알려준다.

Free Rider에서 기대되는 도구:
- list_collections
- list_requests
- get_request
- get_collection_interceptors
- set_collection_interceptors
- send_request
- list_network_history
- get_network_entry`,
  en: `The Free Rider app's MCP server is already running locally. Connect Free Rider MCP to the AI agent/IDE currently in use in this environment.

Connection information:
- Name: free-rider
- Transport: Streamable HTTP
- URL: http://127.0.0.1:48173/mcp
- Authentication: none
- Network scope: localhost only

Requirements:
1. First identify how the current client configures MCP and where its MCP configuration is stored.
2. Do not guess a client-specific format. Add the server using the Streamable HTTP MCP configuration format supported by the current environment.
3. This is an already-running HTTP MCP server. Do not create a stdio, npx, or separate MCP server process.
4. If you have permission to change settings, apply the configuration directly and perform any required MCP reload or client restart step.
5. After connecting, verify that Free Rider tools appear through tools/list or the client's MCP tool list.
6. When possible, perform a read-only validation by calling list_collections. Do not call send_request only to test the connection.
7. If the connection fails, check URL reachability, transport support, and MCP protocol negotiation in that order.
8. At the end, briefly report the configuration file/setting changed and the connection verification result.

Expected Free Rider tools:
- list_collections
- list_requests
- get_request
- send_request
- list_network_history
- get_network_entry`
})

export function resolveMcpHandoffLocale(value = 'ko') {
  return /^en(?:-|$)/i.test(String(value)) ? 'en' : 'ko'
}

export function getMcpHandoffPrompt(locale = 'ko') {
  return MCP_HANDOFF_PROMPTS[resolveMcpHandoffLocale(locale)]
}
