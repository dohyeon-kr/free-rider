# Ride 테스트

Free Rider에서 테스트의 단위는 개별 Request가 아니라 **Ride 시나리오**입니다.

Ride에 저장된 HTTP 엔드포인트를 원하는 순서로 삽입하고 실행하면 각 step과 전체 시나리오의 성공 여부를 확인할 수 있습니다.

## 테스트 시나리오 만들기

하나의 컬렉션에 여러 Ride를 만들 수 있습니다.

1. Ride 화면에서 새 Ride를 만듭니다.
2. `엔드포인트 삽입`을 눌러 이름, 메서드, URL로 저장된 요청을 검색합니다.
3. 검색 결과를 클릭하거나 Enter를 눌러 현재 위치에 삽입합니다.
4. 같은 엔드포인트를 여러 번 삽입해도 됩니다.
5. 위/아래 버튼으로 실행 순서를 조정합니다.

예를 들어 다음처럼 상태를 검증하는 흐름을 만들 수 있습니다.

```text
Login
→ Current user
→ Update profile
→ Current user
```

응답 추출이나 After Response 스크립트가 저장한 Runtime Vars는 다음 step에서 그대로 사용할 수 있습니다.

## PASS / FAIL

각 step은 다음 조건을 모두 만족하면 PASS입니다.

- HTTP 응답을 정상적으로 수신
- 상태 코드가 400 미만
- Before Request / After Response 스크립트 오류가 없음

한 step이라도 실패하면 Ride 전체 결과는 FAIL입니다.

`실패 시 중단`이 켜져 있으면 첫 실패에서 시나리오 실행을 멈춥니다. 사용자가 직접 중지하면 결과는 STOPPED로 표시됩니다.

## Request Tests 제거

개별 Request의 Tests 탭과 response assertion은 사용하지 않습니다.

단일 요청의 응답은 Body, Headers, Schema, History, Console에서 확인하고, 반복 가능한 검증 흐름은 Ride로 구성합니다.
