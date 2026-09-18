# 컬렉션 실행

컬렉션 Runner는 여러 저장 요청을 정해진 순서로 실행할 때 사용합니다.

## 실행 목록 만들기

`엔드포인트 추가`에서 저장된 **HTTP 요청**을 선택합니다. 실행 목록에서 요청을 제외하거나 순서를 바꿔도 원본 요청은 삭제되지 않습니다. SSE와 WebSocket은 종료 시점이 정해진 단일 응답 요청이 아니므로 현재 Collection Runner 대상에서 제외합니다.

실행 목록 설정은 저장 버튼으로 보관합니다.

## 실행 동작

Runner는 다음을 지원합니다.

- 선택된 요청의 순차 실행
- 요청별 결과 확인
- 실패 시 실행 중단
- 사용자의 수동 중지
- 전후처리 스크립트와 런타임 Vars 전달

::: warning 저장된 요청을 사용합니다
편집 중인 draft가 아니라 마지막으로 저장한 요청을 실행합니다. Runner 전에 <kbd>Cmd</kbd> + <kbd>S</kbd>로 저장하는 습관이 안전합니다.
:::

## 요청 사이에서 값 넘기기

응답 추출이나 후처리 스크립트에서 저장한 런타임 Vars는 다음 요청에서 사용할 수 있습니다.

```js
// login 요청의 후처리
const body = res.json()
ctx.vars.set('accessToken', body.accessToken)
```

```text
Authorization: Bearer {{accessToken}}
```

전역 스크립트는 Runner 시작 시점의 설정을 사용하므로 실행 도중 편집해도 현재 실행 중인 Runner에는 영향을 주지 않습니다.
