# Tests Reference

요청의 Tests 탭에서는 응답 값을 expression과 operator로 검사합니다. 비활성화한 rule이나 expression이 비어 있는 rule은 실행하지 않습니다.

## Expression

| Expression | 값 |
| --- | --- |
| `res.status` | HTTP status code |
| `res.responseTime` | 전체 요청 경과 시간(ms) |
| `res.body` | JSON이면 파싱된 값, 아니면 문자열 |
| `res.body.foo.bar` | JSON Body의 중첩 속성 |
| `res.headers.content-type` | 소문자 기준 응답 header |

Body path는 점(`.`)으로 구분합니다.

```text
res.body.data.user.id
```

## Operator

| Operator | 판정 |
| --- | --- |
| `equals` | JSON 직렬화 결과가 같음 |
| `notEquals` | JSON 직렬화 결과가 다름 |
| `exists` | 실제 값이 `undefined`가 아님 |
| `contains` | 실제 값을 문자열로 바꿨을 때 기대값 포함 |
| `lessThan` | 숫자로 변환한 실제 값이 기대값보다 작음 |

저장한 기대값은 가능한 경우 `JSON.parse`를 먼저 시도합니다. 예를 들어 `200`, `true`, `{"ok":true}`는 숫자, boolean, 객체로 비교하고 일반 텍스트는 문자열로 비교합니다.
