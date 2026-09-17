# Development and Docs Build

## Run the application

```sh
npm ci
npm start
```

## Tests

```sh
npm test
npm run test:electron
```

Electron smoke tests use temporary files, a temporary repository, and a temporary HTTP server. They do not use the real user workspace. Screenshots are written to `test-results/`.

## macOS build

To check a local build without signing:

```sh
npm run dist:mac -- --config.mac.identity=null
```

The distribution pipeline produces DMG/ZIP artifacts for Apple Silicon (`arm64`) and Intel (`x64`).

## VitePress docs

Documentation source lives in `docs/site/`. VitePress is isolated as a docs-only package so it does not affect application runtime dependencies.

```sh
cd docs/site
npm install
npm run dev
```

Production build:

```sh
cd docs/site
npm run build
npm run preview
```

GitHub Pages deploys under the repository subpath, so the VitePress `base` is set to `/free-rider/`.

The Korean docs remain at the root paths, while English docs mirror the same structure under `/en/`. VitePress locale routing connects corresponding pages through the language menu.

## Docs deployment

`.github/workflows/docs.yml` watches changes to `docs/site/**` on `main`, builds VitePress, and deploys `docs/site/.vitepress/dist` to GitHub Pages.

Docs URL: <https://dohyeon-kr.github.io/free-rider/>
