# Git 연동

Free Rider는 컬렉션 파일을 로컬 Git 저장소와 함께 관리하는 흐름을 제공합니다.

## 기본 흐름

1. 로컬 Git 저장소를 선택합니다.
2. 컬렉션 파일을 저장합니다.
3. Free Rider에서 diff를 확인합니다.
4. 컬렉션 변경을 commit합니다.

Free Rider의 Git 작업은 `open-api.collection.json`만 commit 대상으로 다룹니다. 이미 stage된 다른 파일은 포함하지 않습니다.

최근 컬렉션 commit도 화면에서 확인할 수 있습니다.

## Push와 Pull

Free Rider는 로컬 diff와 commit에 집중합니다. 원격 저장소의 Push / Pull은 기존 Git 클라이언트나 CLI를 사용합니다.

## 공유 파일에 포함하지 않는 값

다음 값은 협업용 컬렉션 파일에 포함하지 않습니다.

- Environment 실제 값
- 로컬 파일 경로
- 전역 전후처리 스크립트
- 복원용 백업

::: danger 요청에 직접 적은 비밀값
요청 Header나 Body에 토큰, 비밀번호 등을 직접 적으면 컬렉션 파일에 포함될 수 있습니다. 공유할 요청은 `{{TOKEN}}` 같은 변수로 작성하고 실제 값은 Environment에 두세요.
:::
