# 시작하기

Free Rider는 서버와 계정 없이 동작하는 macOS Electron API 클라이언트입니다.

## 설치

[GitHub Releases](https://github.com/dohyeon-kr/free-rider/releases/latest)에서 Mac 아키텍처에 맞는 DMG 또는 ZIP을 받습니다.

| Mac | 아키텍처 |
| --- | --- |
| Apple Silicon | `arm64` |
| Intel Mac | `x64` |

배포용 자동 업데이트는 Developer ID로 서명·공증된 빌드에서만 활성화됩니다. ad-hoc 또는 개발 빌드에서는 macOS Squirrel의 서명 요구사항 때문에 자동 업데이트를 사용하지 않습니다.

## 첫 요청 보내기

1. 사이드바의 `+`로 컬렉션을 만듭니다.
2. 상단 `+ 요청` 또는 탭의 `+`로 요청을 추가합니다.
3. HTTP 메서드와 절대 URL을 입력합니다.
4. 필요하면 Params / Headers / Body / Auth / Vars / Tests / Docs를 설정합니다.
5. `Send`로 현재 편집본을 실행합니다.
6. 저장 버튼 또는 <kbd>Cmd</kbd> + <kbd>S</kbd>로 워크스페이스를 저장합니다.

::: warning Send와 Runner의 차이
단일 `Send`는 **현재 편집 중인 내용**을 사용합니다. 컬렉션 Runner는 **저장된 요청**을 사용합니다. Runner 결과가 편집 화면과 다르면 먼저 요청을 저장했는지 확인하세요.
:::

## 변수 사용하기

환경 화면에서 `BASE_URL=https://api.example.com` 같은 값을 만들고 URL이나 헤더에서 중괄호 문법으로 참조합니다.

```text
{{BASE_URL}}/v1/users
```

변수 이름은 대소문자를 구분합니다. 값이 없으면 요청 실행 전에 오류가 발생합니다.

## 개발 모드로 실행

저장소에서 직접 실행할 때는 다음 명령을 사용합니다.

```sh
npm ci
npm start
```

테스트와 macOS 빌드는 [개발과 문서 빌드](/development)에서 확인할 수 있습니다.

## 다음 단계

- [요청과 저장](/guide/requests) — 요청 편집, multipart, Auth, 탭과 응답
- [Environment와 Vars](/guide/variables-and-scripts) — 변수 우선순위와 전후처리
- [OpenAPI 동기화](/guide/openapi-sync) — 명세 변경 검토와 선택 반영
