# 개발과 문서 빌드

## 애플리케이션 실행

```sh
npm ci
npm start
```

## 테스트

```sh
npm test
npm run test:electron
```

Electron smoke test는 임시 파일, 임시 저장소, 임시 HTTP 서버를 사용하며 실제 사용자 워크스페이스를 사용하지 않습니다. 화면 캡처는 `test-results/`에 생성됩니다.

## macOS 빌드

서명 없이 로컬 빌드를 확인할 때:

```sh
npm run dist:mac -- --config.mac.identity=null
```

배포 파이프라인은 Apple Silicon(`arm64`)과 Intel(`x64`)용 DMG/ZIP을 생성합니다.

## VitePress 문서

문서 소스는 `docs/site/`에 있습니다. VitePress는 문서 전용 package로 분리되어 애플리케이션 런타임 dependency에 영향을 주지 않습니다.

```sh
cd docs/site
npm install
npm run dev
```

프로덕션 빌드:

```sh
cd docs/site
npm run build
npm run preview
```

GitHub Pages는 저장소 하위 경로에 배포되므로 VitePress `base`는 `/free-rider/`로 설정되어 있습니다.

## 문서 배포

`.github/workflows/docs.yml`이 `main`의 `docs/site/**` 변경을 감지해 VitePress를 빌드하고 `docs/site/.vitepress/dist`를 GitHub Pages에 배포합니다.

문서 URL: <https://dohyeon-kr.github.io/free-rider/>
