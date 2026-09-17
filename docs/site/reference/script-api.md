# Script API Reference

전역 전처리와 후처리는 별도 Worker의 QuickJS 런타임에서 실행됩니다. 코드는 함수 본문처럼 작성하며 Free Rider가 `req`, `res`, `ctx`를 제공합니다.

## 빠른 참조

<!-- free-rider-app-reference:start -->
```text
req.method / req.url / req.body
req.headers.get / set / delete
res.status / res.statusText / res.headers.get
res.text() / res.json()
ctx.env.get("KEY")
ctx.vars.get / set / delete
ctx.log("실행 로그")
```
<!-- free-rider-app-reference:end -->

앱의 전역 전후처리 화면은 이 블록을 HTTP GET으로 불러와 표시합니다. 네트워크가 불가능하면 앱에 포함된 기본 요약을 계속 표시합니다.

## `req`

전처리와 후처리에서 현재 요청을 나타냅니다. 전처리에서 변경한 값은 실제 네트워크 요청에 반영됩니다.

### `req.method: string`

HTTP 메서드입니다. 직접 대입할 수 있습니다.

```js
req.method = 'POST'
```

전처리 종료 후 대문자로 정규화하고 유효한 HTTP token인지 다시 검증합니다. `CONNECT`, `TRACE`, `TRACK`은 허용하지 않습니다.

### `req.url: string`

최종 요청 URL입니다. 직접 대입할 수 있습니다.

```js
req.url = req.url.replace('/v1/', '/v2/')
```

전처리 종료 후 인증정보가 없는 HTTP/HTTPS URL인지 다시 검증합니다.

### `req.body`

요청 Body입니다. 일반 요청에서는 문자열 또는 `undefined`이며 multipart 요청은 내부 FormData 설정 객체입니다.

`GET`, `HEAD`로 메서드를 바꾸면 전처리 종료 후 Body를 제거합니다.

### `req.headers.get(name)`

헤더 이름은 대소문자를 구분하지 않습니다. 없으면 `undefined`를 반환합니다.

```js
const contentType = req.headers.get('content-type')
```

### `req.headers.set(name, value)`

헤더를 추가하거나 덮어씁니다. 값은 문자열로 변환됩니다.

```js
req.headers.set('Authorization', 'Bearer ' + ctx.vars.get('accessToken'))
```

### `req.headers.delete(name)`

헤더를 제거합니다.

```js
req.headers.delete('X-Debug')
```

## `res`

`res`는 **후처리에서만** 제공되는 읽기 전용 응답 객체입니다.

### `res.status: number`

HTTP status code입니다.

### `res.statusText: string`

HTTP status text입니다.

### `res.headers.get(name)`

응답 헤더를 대소문자 구분 없이 읽습니다.

```js
const requestId = res.headers.get('x-request-id')
```

응답 header의 `set` / `delete`를 호출하면 오류가 발생합니다.

### `res.text(): string`

응답 Body 원문을 반환합니다.

### `res.json(): unknown`

응답 Body를 `JSON.parse`해서 반환합니다. JSON이 아니면 예외가 발생합니다.

```js
const data = res.json()
ctx.vars.set('userId', data.id)
```

### 기타 응답 필드

| 필드 | 설명 |
| --- | --- |
| `res.body` | UTF-8 응답 문자열 |
| `res.bytes` | 읽은 응답 byte 수 |
| `res.setCookies` | 런타임이 수집한 `Set-Cookie` 값 배열 |
| `res.timing.waiting` | 헤더 수신까지 걸린 시간(ms) |
| `res.timing.download` | Body 다운로드 시간(ms) |
| `res.timing.total` | fetch 전체 시간(ms) |

## `ctx.env`

Environment는 스크립트에서 읽기 전용입니다.

### `ctx.env.get(key)`

```js
const apiKey = ctx.env.get('API_KEY')
```

값이 없으면 `undefined`를 반환합니다.

## `ctx.vars`

런타임 Vars를 읽고 변경합니다.

### `ctx.vars.get(key)`

```js
const token = ctx.vars.get('accessToken')
```

### `ctx.vars.set(key, value)`

현재 실행 컨텍스트에 값을 저장합니다. 다음 요청에서도 사용할 수 있습니다.

```js
ctx.vars.set('accessToken', res.json().accessToken)
```

`__proto__`, `constructor`, `prototype`은 변수 이름으로 사용할 수 없습니다.

### `ctx.vars.delete(key)`

런타임 값을 삭제합니다.

```js
ctx.vars.delete('accessToken')
```

## `ctx.log(...args)`

응답 콘솔에 로그를 남깁니다.

```js
ctx.log('HTTP', res.status, { url: req.url })
```

문자열이 아닌 값은 JSON 직렬화를 시도합니다. 한 스크립트 실행에서 최대 **100개**의 로그를 수집하고 각 로그는 최대 **4,000자**로 자릅니다.

## 실행 환경

스크립트 런타임은 파일 시스템, 셸, 직접 네트워크 접근을 노출하지 않습니다. Node.js의 `require`, `process`, `fetch`를 API로 제공하지 않습니다.

| 제한 | 값 |
| --- | --- |
| QuickJS memory | 32MB |
| QuickJS stack | 512KB |
| QuickJS interrupt deadline | 약 1.5초 |
| Worker hard timeout | 3초 |

전처리 오류는 요청 전송을 중단합니다. 후처리 오류는 응답 자체와 분리해 `scriptError`로 표시합니다.
