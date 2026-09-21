# Ride

**코스(Course)**는 저장된 HTTP 요청의 실행 순서이고, **Ride**는 그 코스를 실제로 실행하는 동작입니다.

로그인 → 사용자 조회 → 프로필 수정처럼 반복해서 검증할 흐름을 코스로 저장해 두고, 필요할 때 Ride하면 됩니다. 하나의 컬렉션에 여러 코스를 만들 수 있습니다.

## 코스 만들기

Ride 화면의 코스 선택기에서 현재 코스를 바꾸고 `새 코스`로 별도 실행 경로를 추가합니다.

각 코스는 다음 정보를 독립적으로 보관합니다.

- 코스 이름
- 엔드포인트 step 순서
- 실패 시 중단 여부

## 엔드포인트 삽입

기존 체크박스 선택 방식 대신 검색 팔레트에서 엔드포인트를 삽입합니다.

`엔드포인트 삽입`을 누른 뒤 이름, 메서드, URL을 검색하고 결과를 클릭하거나 Enter를 누릅니다.

같은 엔드포인트를 여러 번 넣을 수 있으므로 다음과 같은 매크로형 코스를 만들 수 있습니다.

```text
POST Login
GET Current user
PATCH Profile
GET Current user
```

각 step 앞의 `+` 버튼으로 원하는 위치에 새 엔드포인트를 끼워 넣을 수도 있습니다.

## Ride 실행

`Ride 실행`을 누르면 선택한 코스의 모든 step을 위에서 아래로 실행합니다.

각 step은 HTTP 상태 코드가 400 미만이고 스크립트 오류가 없으면 PASS입니다. 하나라도 실패하면 Ride 결과는 FAIL입니다.

`실패 시 중단`을 켜면 첫 실패에서 실행을 멈춥니다. 직접 중지한 실행은 STOPPED로 표시합니다.

::: warning 저장된 요청을 사용합니다
Ride는 편집 중인 draft가 아니라 마지막으로 저장한 요청을 실행합니다. 실행 전에 <kbd>Cmd</kbd> + <kbd>S</kbd>로 저장하세요.
:::

## MCP에서 코스 설정하고 Ride하기

Free Rider MCP를 켜면 AI 에이전트도 코스를 조회·설정하고 실행할 수 있습니다.

- `list_courses`: 컬렉션의 코스 목록 조회
- `get_course`: 코스의 순서와 엔드포인트 확인
- `set_course`: 요청 ID 배열로 코스 생성/수정
- `delete_course`: 코스 삭제
- `ride_course`: 선택한 코스를 Ride

`set_course`의 `requestIds`는 순서를 그대로 보존하며 같은 요청 ID를 여러 번 넣을 수 있습니다.

## 요청 사이에서 값 넘기기

응답 추출이나 After Response 스크립트에서 저장한 Runtime Vars는 다음 step에서 사용할 수 있습니다.

```js
const body = res.json()
ctx.vars.set('accessToken', body.accessToken)
```

```text
Authorization: Bearer {{accessToken}}
```
