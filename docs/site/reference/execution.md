# 실행 규칙과 제한

요청 실행 엔진에서 적용하는 네트워크, Body, 보안 규칙입니다.

## 변수 치환

`{{NAME}}` 형식으로 값을 치환합니다. 변수 이름 앞뒤 공백은 무시합니다.

```text
{{ BASE_URL }}/users
```

해당 이름의 변수가 없으면 요청을 보내지 않고 오류를 표시합니다.

## URL

- HTTP/HTTPS만 허용합니다.
- URL의 username/password는 허용하지 않습니다.
- URL이 유효한 절대 주소가 아니면 전송하지 않습니다.
- redirect는 자동으로 따라가지 않습니다.

## 메서드와 Body

- RFC token 형식의 메서드 이름을 허용합니다.
- `CONNECT`, `TRACE`, `TRACK`은 차단합니다.
- `GET`, `HEAD`의 Body는 제거합니다.
- multipart file 총합은 50MB 이하입니다.

## 응답

| 항목 | 제한 |
| --- | --- |
| 요청 timeout | 30초 |
| 응답 Body | 최대 10MB |
| 응답 디코딩 | UTF-8 문자열 |

응답 크기가 10MB를 넘으면 다운로드를 중단하고 오류를 반환합니다.

## 응답 값 추출

성공 응답(2xx)에서 설정된 extract mapping을 적용할 수 있습니다. JSON Body의 dot path를 따라 값을 찾고 런타임 Vars로 넘깁니다.

```text
accessToken -> data.auth.accessToken
```

추출값이 없거나 객체인 경우 오류로 처리합니다. 추출 변수 이름으로 `__proto__`, `constructor`, `prototype`은 사용할 수 없습니다.

## 스크립트와 요청 순서

실행 순서는 다음과 같습니다.

1. 변수 치환과 Auth를 적용해 요청 준비
2. 전처리 실행
3. 전처리 결과 URL / method 재검증
4. HTTP 요청 전송
5. 2xx 응답의 extract mapping 처리
6. 후처리 실행
7. extract 값과 스크립트 Vars 변경을 실행 결과에 반영

전처리에서 저장된 요청 원본을 수정하지 않고 현재 실행 요청만 변경합니다.
