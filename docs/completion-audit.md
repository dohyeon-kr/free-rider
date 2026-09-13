# 합의 범위 완료 점검

검증일: 2026-09-13. 대상: 현재 src와 같은 소스로 생성한 Free Rider 0.2.0 macOS arm64 앱.

## 요구사항별 근거

| 요구사항 | 구현 및 검증 근거 | 판정 |
| --- | --- | --- |
| 서버 없는 Electron 클라이언트, 시안의 도구 중심 UI | main/preload 격리, 로컬 HTTP·파일·Git 모듈. 실제 request/scripts/runner/sync/env-file/git 캡처 확인 | 완료 |
| 요청 작성·전송·응답·Tests | core/workflow/methods 테스트, Electron 로그인→인증 조회 및 cURL 전송 | 완료 |
| OPTIONS·QUERY·직접 메서드 | request.prepare 및 methods 실제 QUERY 본문 전송 테스트 | 완료 |
| 컬렉션·폴더 접힘, 탭 추가·닫기, 저장/버리기/취소 | 트리 핸들러·collapsed 저장, drafts 테스트, Electron 취소·버리기·저장·재열기 | 완료 |
| 메뉴 동작과 버튼 클릭 영역 | 컬렉션 선택 popover, 가져오기/내보내기 메뉴, 44px 탭 추가 버튼. Electron 메뉴·취소 검증과 캡처 | 완료 |
| 실행 목록 추가·제외·순서·선택 실행·중단 | run-plan 테스트, Electron 추가·제외·로그인 연속 실행, AbortController 취소 | 완료 |
| 전역 req/res 전후처리 | scripts 테스트 및 Electron X-Global 헤더 수신. 시간 제한·취소·호스트 API 격리 검증 | 완료 |
| 환경별 {{vars}}, .env 여러 파일, 저장·재읽기 | env-files 외부 변경 방지 테스트, Electron 파일 선택·원문 편집·디스크 저장 | 완료 |
| 환경 격리·변수 우선순위·runtime 삭제 | EnvironmentStore와 effectiveRequest, core/scripts 테스트 | 완료 |
| 오류 콘솔·Body 분리 | Electron invalid URL 실행 및 콘솔·Body 검사 | 완료 |
| 명세 URL·파일 연결과 파일 재읽기 | Electron URL 및 임시 파일 연결·변경·재읽기 IPC 검증 | 완료 |
| baseUrl 없을 때 등록 제안 | applySync의 공백 검사·등록/취소 modal, serverUrl 상대 URL/default 변수 테스트 | 완료 |
| 아코디언 diff·충돌 태그·선택 반영 | reviewView, sync-review 테스트, Electron 반영 전 불변·반영 후 생성 | 완료 |
| 미선택 baseline 유지·삭제 기본 미선택·사용자 값 보존 | sync-review 테스트. Headers/Query/중첩 스키마 항목별 비교 | 완료 |
| 저장 실패 시 유지·직전 반영 복원 | saveCollectionTransaction은 await 저장 후 변경. Electron undo, WorkspaceStore 직렬 스냅샷 저장 | 완료 |
| Git 연결·저장·diff·commit·이력 | git 임시 저장소 테스트: 최초 commit, 신규 파일 diff, 다른 staged 파일 보존. Electron 연결 화면 | 완료 |
| 환경 실값·로컬 데이터 공유 제외 | shareCollection 및 shareableEnvironments, env-files 공유 결과 검사 | 완료 |
| 로컬 암호화 저장·기존 형식 호환·복원 | workflow 원본 백업 테스트, Electron 실제 임시 암호화 저장 후 재로드 | 완료 |
| macOS 검토용 앱·설치 파일 | electron-builder DMG/ZIP 성공, 생성된 앱의 --smoke-test 성공 | 완료 |

## 최종 실행 결과

- npm test: 30 passed, 0 failed.
- npm run test:electron: 통과.
- npm run dist:mac -- --config.mac.identity=null: 성공.
- dist/mac-arm64/Free Rider.app/Contents/MacOS/Free Rider --smoke-test: 통과.
- git diff --check: 통과.
- Invalid URL 로그는 오류 콘솔 테스트의 의도된 입력이며 최종 프로세스 종료 코드는 0이다.

## 제공 범위와 제한

자체 서버·계정·기기 간 설정 공유·앱 내 Push/Pull은 제외한다. 외부 $ref는 bundle한 명세를 사용한다. 문자열 Body와 배열은 하나의 변경 값으로 비교한다. CONNECT 터널·TRACE/TRACK은 지원 불가 안내를 제공한다. 서명·공증은 별도 배포 작업이며 현재 산출물은 로컬 검토용이다.

작업은 현재 체크아웃에 반영했으며 커밋·원격 푸시는 하지 않았다.
