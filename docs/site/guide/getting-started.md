# 시작하기

Free Rider는 서버와 계정 없이 동작하는 macOS Electron API 클라이언트입니다.

## 설치

### Homebrew (권장)

Homebrew를 사용한다면 Cask 설치를 권장합니다. Free Rider 저장소 자체를 tap으로 사용하므로 처음 한 번만 명시적으로 연결하면 됩니다.

```sh
brew tap dohyeon-kr/free-rider https://github.com/dohyeon-kr/free-rider.git
brew install --cask dohyeon-kr/free-rider/free-rider
```

Homebrew 6부터 비공식 tap은 명시적인 신뢰가 필요합니다. 위처럼 **fully-qualified Cask 이름**으로 설치하면 전체 tap이 아니라 Free Rider Cask만 신뢰합니다.

새 릴리즈가 나오면 일반 Homebrew 흐름으로 갱신할 수 있습니다.

```sh
brew update
brew upgrade --cask dohyeon-kr/free-rider/free-rider
```

삭제는 다음과 같습니다.

```sh
brew uninstall --cask free-rider
```

Free Rider 릴리즈 워크플로는 새 버전을 배포한 뒤 `Casks/free-rider.rb`의 버전과 Apple Silicon / Intel DMG SHA-256을 자동으로 갱신합니다.

### 직접 다운로드

[GitHub Releases](https://github.com/dohyeon-kr/free-rider/releases/latest)에서 Mac 아키텍처에 맞는 DMG 또는 ZIP을 받을 수도 있습니다.

| Mac | 아키텍처 |
| --- | --- |
| Apple Silicon | `arm64` |
| Intel Mac | `x64` |

Free Rider는 Electron 44를 사용하므로 macOS 13 Ventura 이상이 필요합니다. 배포용 자동 업데이트는 Developer ID로 서명·공증된 빌드에서만 활성화됩니다. ad-hoc 또는 개발 빌드에서는 macOS Squirrel의 서명 요구사항 때문에 자동 업데이트를 사용하지 않습니다.

## 첫 요청 보내기

1. 사이드바의 `+`에서 빈 컬렉션 또는 `OpenAPI로 시작하기`를 선택합니다.
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
- [Environment와 Vars](/guide/variables-and-scripts) — 변수 우선순위와 컬렉션 Interceptors
- [OpenAPI 동기화](/guide/openapi-sync) — 명세 변경 검토와 선택 반영
