---
layout: home

hero:
  name: Free Rider
  text: API 작업을 파일과 Git 가까이에.
  tagline: 서버와 계정 없이 요청 작성, 환경별 변수, 전후처리, OpenAPI 변경 검토와 로컬 Git 작업까지 처리하는 macOS API 클라이언트입니다.
  image:
    src: /free-rider-hero.webp
    alt: Free Rider 라이더 캐릭터
  actions:
    - theme: brand
      text: 시작하기
      link: /guide/getting-started
    - theme: alt
      text: 최신 버전 받기
      link: https://github.com/dohyeon-kr/free-rider/releases/latest

features:
  - title: Local-first
    details: 워크스페이스를 로컬에 저장하고 별도 서버나 계정 없이 사용합니다.
  - title: Git-friendly
    details: 공유 가능한 컬렉션 파일만 diff와 commit 대상으로 다루고 로컬 비밀값은 분리합니다.
  - title: OpenAPI review
    details: 명세 변경을 바로 덮어쓰지 않고 엔드포인트와 충돌을 검토한 뒤 선택적으로 반영합니다.
  - title: Environment & Vars
    details: 환경값, 요청별 Vars, 실행 중 캡처 값을 계층적으로 조합합니다.
  - title: Scriptable
    details: QuickJS 기반 전후처리에서 req, res, ctx API를 사용해 요청과 런타임 변수를 제어합니다.
  - title: Collection Runner
    details: 저장된 요청을 순서대로 실행하고 실패 중단, 수동 중지, 요청별 결과 확인을 지원합니다.
---

## Free Rider가 다루는 범위

Free Rider는 Postman이나 Bruno처럼 API 요청을 작성하고 실행하는 도구지만, 서버 동기화보다 **로컬 파일과 Git 기반 협업**에 초점을 둡니다.

- 요청 작성과 실행 — Params, Headers, Body, Auth, Vars, Tests, Docs
- 여러 Environment와 `.env` 파일 연결
- 전역 전처리 / 후처리 스크립트
- 저장된 요청 기반 컬렉션 Runner
- OpenAPI 3.x JSON/YAML 변경 검토와 선택 반영
- 컬렉션 파일 diff / commit
- macOS arm64 / x64 배포와 자동 업데이트

::: tip 처음 사용한다면
[시작하기](/guide/getting-started)에서 첫 컬렉션과 요청을 만든 뒤 [Environment와 Vars](/guide/variables-and-scripts), [OpenAPI 동기화](/guide/openapi-sync) 순서로 보는 것이 빠릅니다.
:::
