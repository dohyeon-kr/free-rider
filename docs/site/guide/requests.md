# 요청과 저장

## 컬렉션, 폴더, 요청

사이드바의 `+`로 컬렉션을 만들고 요청을 추가합니다. 컬렉션과 폴더는 접고 펼칠 수 있으며 컬렉션 제목 옆 선택 메뉴에서 현재 컬렉션을 바꿉니다.

요청 편집기는 다음 탭을 제공합니다.

| 탭 | 용도 |
| --- | --- |
| Params | URL query parameter |
| Headers | 요청 헤더 |
| Body | 문자열 또는 multipart 본문 |
| Auth | Bearer / Basic 인증 |
| Vars | 요청 범위 변수 |
| Tests | 응답 assertion |
| Docs | 요청 설명 |

## URL과 HTTP 메서드

요청 URL은 `http://` 또는 `https://` 절대 주소여야 합니다. `{{BASE_URL}}` 같은 변수를 먼저 치환한 뒤 URL을 검증합니다.

지원 범위는 `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `QUERY`와 유효한 사용자 정의 HTTP 메서드입니다.

- `CONNECT`는 지원하지 않습니다.
- `TRACE`, `TRACK`은 지원하지 않습니다.
- URL에 `user:password@host` 형식의 인증정보를 넣을 수 없습니다. Auth 또는 `Authorization` 헤더를 사용하세요.
- `GET`과 `HEAD`에서는 Body를 전송하지 않습니다.

## Params와 Headers

활성화된 항목만 전송합니다. Params 값이 빈 문자열이면 해당 query parameter를 추가하지 않습니다.

키와 값에 변수를 사용할 수 있는 위치는 기능마다 다릅니다. 현재 요청 실행 시 URL, query 값, header 값, body와 Auth 값의 `{{NAME}}`를 해석합니다.

## Body와 파일 첨부

일반 Body는 변수 치환 후 문자열로 전송합니다. multipart Body에서는 text part와 file part를 함께 보낼 수 있습니다.

- multipart text 값에도 변수를 사용할 수 있습니다.
- multipart 파일의 총 크기는 요청당 **50MB 이하**입니다.
- multipart 전송 시 `Content-Type`은 런타임이 boundary를 붙일 수 있도록 Free Rider가 직접 제거하고 `FormData`에 맡깁니다.
- 파일 슬롯을 더 이상 해석할 수 없는 경우 파일을 다시 선택해야 합니다.

## Auth

컬렉션, 폴더, 요청 범위에서 Auth를 상속할 수 있습니다. 요청에서 명시한 Auth가 상위 범위보다 우선합니다.

### Bearer

```text
Bearer {{accessToken}}
```

### Basic

사용자명과 비밀번호를 합쳐 Base64 Basic Authorization 헤더를 생성합니다. Auth 값에도 변수를 사용할 수 있습니다.

## 저장과 탭

저장 버튼 또는 <kbd>Cmd</kbd> + <kbd>S</kbd>로 암호화된 로컬 워크스페이스에 저장합니다.

탭을 닫을 때 변경 내용이 있으면 저장 / 버리기 / 취소를 선택할 수 있습니다. 탭 우클릭 메뉴에서는 현재 탭, 다른 탭, 저장된 탭, 모든 탭을 닫을 수 있습니다.

컬렉션 메뉴에서는 컬렉션 전체를 삭제할 수 있습니다. 마지막 컬렉션 하나는 유지합니다.

## 응답과 콘솔

Body 영역에는 서버 응답을 표시하고 전송 오류와 스크립트 로그는 응답 콘솔에 표시합니다. 응답은 최대 **10MB**까지 읽습니다.

요청 자체의 네트워크 타임아웃은 **30초**이며 HTTP redirect는 자동으로 따라가지 않고 오류로 처리합니다.
