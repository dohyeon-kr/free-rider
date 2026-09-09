# Open API Client

A local-first Electron API client with OpenAPI synchronization. Inspired by [our Bruno collaboration workflow](https://blog.dohyeon.kr/peuronteuendeuwa-baegendeu-gaebalja-hyeobeobhagi/).

## v0.2 workspace

The desktop layout follows familiar Bruno workflows: collection/folder tree, closable request and settings tabs, collection overview/documentation, top-right environment selection, and resizable request/response panes. Neutral dark colors, compact controls and gold active-tab accents follow the supplied reference. This is an independent application, not a Bruno distribution or a `.bru` compatibility layer.

### Daily workflow

1. Create a collection with **+** in Collections, or open an existing Open API Client JSON file with **…**.
2. Open **API Specs** to import OpenAPI 3.x JSON/YAML or synchronize a URL. Existing request edits survive synchronization; removed operations remain marked.
3. Open **Environments** with the top-right environment icon. Create, rename or duplicate environments; edit key/value rows or import `.env`. Select the active environment from the adjacent dropdown.
4. Create a request with **+ Request** or the collection/folder menu. Configure **Params, Body, Headers, Auth, Vars, Assert, Docs**.
5. Set common Headers/Vars/Auth in the **Collection** tab or folder settings. Requests can inherit auth, explicitly use No Auth, Bearer Token or Basic Auth.
6. For login, map `token` → `data.accessToken` in **Vars → Post-response extraction**. Following requests can use `{{token}}`. Rerun login when a token expires.
7. Use **Run** to select and reorder requests. Login and authenticated requests execute sequentially using an environment snapshot. Stop cancels the active request and remaining run. Status/timing/assertions appear for each result.
8. **Save** / Cmd+S persists the workspace encrypted locally, including environments and open tabs. Closing with unsaved changes prompts to keep editing or discard. Runtime tokens and response history are not persisted.
9. Export a collection from its menu, or connect an existing repository in **Git**, save `open-api.collection.json`, inspect the diff and commit that file. Environment values are removed from shared files. Use a Git client for push/pull.

### Shortcuts

| Action | macOS / Windows/Linux |
|---|---|
| Send current request | Cmd / Ctrl + Enter |
| Save workspace | Cmd / Ctrl + S |
| New request | Cmd / Ctrl + N |
| Close tab (keeps request edits) | Cmd / Ctrl + W |
| Search requests | Cmd / Ctrl + K |

### Data and inheritance

- OS-backed Electron safeStorage encrypts the local workspace file in application userData. No cloud service is used. If encryption is unavailable, saving fails explicitly.
- Shared collection files include environment variable names with empty values. Secrets typed directly into request URLs/headers/bodies or collection/folder variables are still exported: use environment placeholders for secrets.
- Runtime variables are isolated by collection and environment. Variable precedence: runtime > request > nearest folder > environment > collection. Request/folder headers override ancestor headers case-insensitively.
- Request query rows support repeated keys and enabled/disabled state. Assertions support `equals`, `notEquals`, `contains`, `exists`, `lessThan` against status, elapsed milliseconds, JSON body paths and response headers.
- Sync uses HTTP method + OpenAPI path identity and a baseline of generated fields. User changes to names, groups, descriptions, request values, auth, vars and assertions survive; unedited fields update. Query/header merge granularity is the whole field.
- Git connections are scoped to each collection. Commits use `--only` to preserve unrelated staged files. System Git and its existing user configuration are used.

## Modules

| Module | Path | Responsibility |
|---|---|---|
| Sync | `src/modules/sync` | OpenAPI parsing, request generation, baseline-aware synchronization |
| Request / Response Runner | `src/modules/runner` | HTTP, auth/header inheritance, response extraction and assertions |
| Env | `src/modules/env` | dotenv parsing, runtime isolation and shareable variable definitions |
| Git | `src/modules/git` | Repository status, collection save/diff/commit |
| Workspace | `src/modules/workspace` | Serialized, encrypted local persistence |
| UI | `src/ui` | Workspace model, reusable form/table controls and application views |
| Electron adapter | `src/main.cjs`, `src/preload.cjs` | Validated IPC, native dialogs and window lifecycle |

## Development and builds

```sh
npm ci
npm start
npm test
npm run test:electron
```

Use Node 24. Distribution builds run in GitHub Actions on `main` pushes, PRs and manual dispatch. CI executes module/integration tests and a real native Electron workflow (login → inherited authenticated request → assertion), then packages DMG/ZIP for Apple Silicon and Intel. Signature verification and SHA-256 checksums are required. Native UI screenshots are uploaded separately. Build artifacts are retained for 30 days.

## macOS signing

GitHub repository → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `CSC_LINK` | Base64 Developer ID Application `.p12`, including private key |
| `CSC_KEY_PASSWORD` | Certificate export password |
| `APPLE_ID` | Apple Developer account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific notarization password |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

All five enable Developer ID signing, Apple notarization, stapling and Gatekeeper verification. Partial configuration fails the build. With none configured, the workflow creates **ad-hoc signed test artifacts**, marked `adhoc`; these are not Apple-notarized and Gatekeeper may block them until locally allowed. Do not put certificate material in source code or chat.

## Scope and references

Bruno documentation used for interaction design:
- [Quick Start](https://docs.usebruno.com/introduction/quick-start)
- [Environment variables](https://docs.usebruno.com/variables/environment-variables)
- [Authentication](https://docs.usebruno.com/auth/overview)
- [Assertions](https://docs.usebruno.com/testing/tests/assertions)

Implemented: multi-collection workspace, folders, tabs, request editing, shared settings, environment management, Basic/Bearer/no-auth, extraction, assertions, selected sequential runs, response history in-session, Git save/diff/commit and repeatable OpenAPI sync.

Not yet implemented: arbitrary JavaScript pre/post scripts, full Bruno script API, `.bru` import, OAuth browser flows, auto token refresh, cookie jar, multipart file upload, GraphQL/gRPC/WebSocket, proxy/client certificate configuration, Git network operations and full Markdown rendering. These are not presented as functional tabs. Documentation editing is plain text. Only OpenAPI 3.x and internal `$ref` are supported; bundle external refs first. Responses are text-only, redirects are not followed automatically, and requests have a 30-second / 10MB limit.
