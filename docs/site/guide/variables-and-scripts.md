# Environment와 Vars

Free Rider는 바뀌는 실행 환경과 실행 중 상태를 분리합니다.

## Environment와 Vars 차이

| 종류 | 용도 | Script API |
| --- | --- | --- |
| Environment | dev / staging / prod처럼 실행 환경에 따라 바뀌는 읽기 전용 값 | `ctx.env.get("KEY")` |
| Vars | 컬렉션·폴더·요청 범위 값과 실행 중 캡처한 값 | `ctx.vars.get/set/delete("KEY")` |

요청에서는 다음처럼 사용합니다.

```text
{{BASE_URL}}/v1/users/{{userId}}
```

변수 이름은 대소문자를 구분합니다.

## 변수 우선순위

낮은 우선순위부터 다음 순서로 합쳐집니다.

1. 컬렉션 / 폴더 기본값
2. 선택한 Environment
3. 요청별 Vars
4. 실행 중 Vars

실행 중 Vars는 같은 컬렉션과 Environment에서 다음 요청으로 이어지며 앱 종료 또는 런타임 값 초기화 시 사라집니다.

## `.env` 파일 연결

환경 화면에서 여러 Environment를 만들거나 `.env` 파일을 연결할 수 있습니다.

연결한 파일은 원문을 편집한 뒤 `편집 내용 적용` 또는 `파일 저장`을 사용합니다. `다시 읽기`는 디스크의 최신 내용을 불러옵니다.

파일이 Free Rider 밖에서 바뀌었다면 실수로 덮어쓰지 않도록 저장을 차단합니다. 먼저 다시 읽어 변경 내용을 확인하세요.

## 전역 전후처리

사이드바의 `전역 전후처리`에서 활성화합니다. 모든 컬렉션에 적용되며 컬렉션 Runner를 시작할 때 현재 스크립트 설정을 고정합니다.

### 전처리 예시

```js
const token = ctx.vars.get('accessToken')

if (token) {
  req.headers.set('Authorization', 'Bearer ' + token)
}

req.headers.set('X-Environment', ctx.env.get('ENV'))
```

전처리에서 바꾼 `req.method`, `req.url`, `req.body`, `req.headers`는 실제 전송 요청에 반영됩니다.

### 후처리 예시

```js
if (req.url.includes('/login') && res.status === 200) {
  ctx.vars.set('accessToken', res.json().accessToken)
}

ctx.log('HTTP', res.status)
```

Environment는 읽기 전용입니다. Vars만 `set`과 `delete`로 변경할 수 있습니다.

자세한 메서드와 실행 제한은 [Script API Reference](/reference/script-api)를 참고하세요.
