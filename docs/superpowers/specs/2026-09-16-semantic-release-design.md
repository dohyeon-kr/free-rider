# Semantic Release Automation Design

## Goal

Replace the manual `package.json` version bump and custom release planning logic with semantic-release while preserving the existing macOS release safety rule: a GitHub Release is public only after both arm64 and x64 builds finish successfully.

## Current problems

- `package.json` must be bumped manually before a release.
- `package-lock.json` can drift from `package.json`; it currently still carries an older root package version.
- `.github/workflows/macos.yml` reimplements version/tag/release planning with shell and GitHub CLI.
- A release can fail in the final publish step for workflow-specific reasons unrelated to the app build, as happened when `gh release edit` ran outside a checked-out repository without `--repo`.

## Release semantics

Semantic-release is the single authority for choosing the next application version on `main`.

- `feat:` -> minor release.
- `fix:` and `perf:` -> patch release.
- `BREAKING CHANGE:` / breaking Conventional Commit -> major release.
- Commits that semantic-release does not consider release-worthy do not create a tag, GitHub Release, or macOS release build.

The existing `v<version>` tag format remains unchanged, so `v0.4.0` stays a valid semantic-release baseline.

## Version files

During semantic-release `prepare`, run:

```sh
npm version ${nextRelease.version} --no-git-tag-version --allow-same-version
```

This updates both `package.json` and the root package version recorded in `package-lock.json` without creating an npm-generated Git tag.

`@semantic-release/git` then commits only these two release assets with:

```text
chore(release): <version> [skip ci]
```

The semantic-release core creates `v<version>` on that release commit. `[skip ci]` prevents the release commit pushed by the workflow from starting a duplicate Actions run.

## GitHub Release lifecycle

`@semantic-release/github` creates the GitHub Release with `draftRelease: true` and semantic-release-generated release notes.

The existing macOS matrix then:

1. checks out the semantic-release tag rather than the original `main` workflow SHA,
2. builds arm64 and x64 from the exact tagged release commit,
3. validates each packaged app,
4. uploads DMG, ZIP, and SHA256 files to the draft release.

Only after both matrix jobs succeed does `publish-release` change the draft to a public/latest release using an explicit repository:

```sh
gh release edit "$RELEASE_TAG" --repo "$GITHUB_REPOSITORY" --draft=false --latest
```

If either architecture fails, the release remains draft and can be inspected or retried without exposing an incomplete public release.

## Workflow shape

Keep a single `.github/workflows/macos.yml` because test, semantic versioning, native builds, and release publication are one release transaction.

### `test`

Runs for pull requests and `main` pushes. It keeps the current Node test suite as the first gate.

### `release`

Runs only outside pull requests and after `test` passes. It checks out full Git history (`fetch-depth: 0`), invokes pinned semantic-release packages through `npx`, and exposes two job outputs:

- `released`: `true` only when semantic-release created a new tag.
- `tag`: the new `v<version>` tag.

The semantic-release packages are installed ephemerally by `npx` rather than added to application devDependencies. This avoids coupling release tooling to the packaged Electron application and avoids a large dependency-only `package-lock.json` change.

Pinned tooling:

- `semantic-release@25.0.9`
- `@semantic-release/commit-analyzer@13.0.1`
- `@semantic-release/release-notes-generator@14.1.1`
- `@semantic-release/github@12.0.9`
- `@semantic-release/git@11.0.1`
- `@semantic-release/exec@7.1.0`

The workflow uses Node 24; these versions are selected for that environment.

### `build`

For pull requests, it continues to run unsigned package validation from the PR SHA.

For `main`, it runs only when `release.released == 'true'` and checks out `release.tag`. Therefore docs/chore-only pushes that do not produce a semantic release do not spend macOS matrix build time.

### `publish-release`

Runs only for a new semantic release and only after both build matrix entries succeed. It publishes the draft release with `--repo "$GITHUB_REPOSITORY"` so the job does not depend on a local Git checkout.

## Configuration

Add `release.config.mjs` at repository root. It contains:

- `branches: ["main"]`
- `tagFormat: "v${version}"`
- commit analyzer
- release notes generator
- exec plugin for `npm version` and writing the produced tag to `.semantic-release-tag`
- git plugin for `package.json` and `package-lock.json`
- GitHub plugin with `draftRelease: true`

`.semantic-release-tag` is a transient CI file and is not committed.

## Failure handling

- No release-worthy commit: semantic-release exits normally, `released=false`, macOS release builds are skipped.
- semantic-release failure: no build starts.
- one macOS architecture fails: draft release stays draft.
- asset upload failure: matrix job fails, draft stays draft.
- final publish failure: all assets remain available on the draft release and the publish job can be retried.
- manual `workflow_dispatch`: semantic-release still follows commit history and will not force a release if there is no release-worthy commit.

## Testing

- Add a Node test that imports `release.config.mjs` and asserts the release branch, tag format, draft GitHub release setting, version prepare command, release commit assets, and `[skip ci]` release commit message.
- Existing `npm test` must pass.
- Pull-request macOS native smoke/package validation must pass for arm64 and x64.
- After merge, observe semantic-release produce the next release only if commit history since `v0.4.0` contains a release-worthy commit, then verify both assets are uploaded before the draft is published.

## Non-goals

- npm registry publishing.
- prerelease channels such as beta/next.
- Windows/Linux packaging.
- maintaining a committed CHANGELOG file; GitHub Release notes remain the release-note surface.
