# Semantic Release Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically calculate, commit, tag, build, and publish Free Rider releases from Conventional Commits without manual `package.json` version bumps.

**Architecture:** `release.config.mjs` delegates version analysis to semantic-release, uses `npm version` to synchronize package metadata, creates a release commit/tag and a draft GitHub Release, then exposes the tag back to the existing macOS matrix. The matrix checks out that tag, uploads both architectures to the draft, and publishes only after both succeed.

**Tech Stack:** GitHub Actions, Node.js 24, semantic-release 25.0.9, @semantic-release/exec 7.1.0, @semantic-release/git 11.0.1, @semantic-release/github 12.0.9, Electron Builder.

**Spec:** `docs/superpowers/specs/2026-09-16-semantic-release-design.md`

## Global Constraints

- Release branch is exactly `main`.
- Tag format stays `v<version>`.
- `feat:` produces minor, `fix:`/`perf:` patch, breaking commits major using semantic-release defaults.
- `package.json` and `package-lock.json` must be updated together via `npm version ${nextRelease.version} --no-git-tag-version --allow-same-version`.
- GitHub Release must remain draft until both macOS architectures finish successfully.
- npm registry publishing is disabled/not configured.
- Release tooling is installed ephemerally in CI, not added to application dependencies.
- PRs still run unsigned arm64/x64 package validation.

---

### Task 1: Semantic-release configuration contract

**Files:**
- Create: `release.config.mjs`
- Create: `test/release-config.test.mjs`

**Interfaces:**
- Consumes: semantic-release plugin names and template variables such as `${nextRelease.version}`.
- Produces: default export consumed by `semantic-release`; transient `.semantic-release-tag` file written by the exec success hook.

- [ ] **Step 1: Write the failing config test**

Create `test/release-config.test.mjs` that imports the config and asserts:

```js
import test from "node:test";
import assert from "node:assert/strict";
import config from "../release.config.mjs";

test("semantic release keeps package metadata and draft release lifecycle aligned", () => {
  assert.deepEqual(config.branches, ["main"]);
  assert.equal(config.tagFormat, "v${version}");

  const exec = config.plugins.find(([name]) => name === "@semantic-release/exec");
  assert.match(exec[1].prepareCmd, /npm version \$\{nextRelease\.version\}/);
  assert.match(exec[1].prepareCmd, /--no-git-tag-version/);
  assert.match(exec[1].successCmd, /\.semantic-release-tag/);

  const git = config.plugins.find(([name]) => name === "@semantic-release/git");
  assert.deepEqual(git[1].assets, ["package.json", "package-lock.json"]);
  assert.match(git[1].message, /\[skip ci\]/);

  const github = config.plugins.find(([name]) => name === "@semantic-release/github");
  assert.equal(github[1].draftRelease, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```sh
node --test test/release-config.test.mjs
```

Expected: FAIL because `release.config.mjs` does not exist.

- [ ] **Step 3: Add the minimal release configuration**

Create `release.config.mjs`:

```js
export default {
  branches: ["main"],
  tagFormat: "v${version}",
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/exec",
      {
        prepareCmd:
          "npm version ${nextRelease.version} --no-git-tag-version --allow-same-version",
        successCmd: "printf 'v${nextRelease.version}' > .semantic-release-tag",
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "package-lock.json"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    [
      "@semantic-release/github",
      {
        draftRelease: true,
        releaseNameTemplate: "Free Rider v<%= nextRelease.version %>",
      },
    ],
  ],
};
```

- [ ] **Step 4: Run config and full tests**

Run:

```sh
node --test test/release-config.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add release.config.mjs test/release-config.test.mjs
git commit -m "ci: configure semantic-release"
```

### Task 2: Replace custom release planning with semantic-release

**Files:**
- Modify: `.github/workflows/macos.yml`

**Interfaces:**
- Consumes: `release.config.mjs`, GitHub Actions `GITHUB_TOKEN`, tags created by semantic-release.
- Produces: `release.outputs.released` (`true|false`) and `release.outputs.tag` (`vX.Y.Z` or empty).

- [ ] **Step 1: Replace `release-plan` with a semantic `release` job**

The job must use full Git history and pinned ephemeral release packages:

```yaml
  release:
    if: github.event_name != 'pull_request'
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
    outputs:
      released: ${{ steps.semantic.outputs.released }}
      tag: ${{ steps.semantic.outputs.tag }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: npm
      - run: npm ci --ignore-scripts
      - name: Run semantic-release
        id: semantic
        env:
          GITHUB_TOKEN: ${{ github.token }}
          GH_TOKEN: ${{ github.token }}
        shell: bash
        run: |
          rm -f .semantic-release-tag
          npx --yes \
            --package=semantic-release@25.0.9 \
            --package=@semantic-release/commit-analyzer@13.0.1 \
            --package=@semantic-release/release-notes-generator@14.1.1 \
            --package=@semantic-release/github@12.0.9 \
            --package=@semantic-release/git@11.0.1 \
            --package=@semantic-release/exec@7.1.0 \
            semantic-release
          if [[ -s .semantic-release-tag ]]; then
            TAG=$(cat .semantic-release-tag)
            echo "released=true" >> "$GITHUB_OUTPUT"
            echo "tag=$TAG" >> "$GITHUB_OUTPUT"
            echo "### Semantic release $TAG prepared" >> "$GITHUB_STEP_SUMMARY"
          else
            echo "released=false" >> "$GITHUB_OUTPUT"
            echo "tag=" >> "$GITHUB_OUTPUT"
            echo "### No release-worthy commits" >> "$GITHUB_STEP_SUMMARY"
          fi
```

- [ ] **Step 2: Make the build matrix consume the semantic tag**

Change build dependencies/condition to:

```yaml
    needs: [test, release]
    if: >-
      always() &&
      needs.test.result == 'success' &&
      (github.event_name == 'pull_request' || needs.release.outputs.released == 'true')
```

Configure checkout:

```yaml
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event_name == 'pull_request' && github.sha || needs.release.outputs.tag }}
```

- [ ] **Step 3: Upload only semantic-release assets**

Use the semantic tag and explicit repository:

```yaml
      - name: Upload draft release assets
        if: github.event_name != 'pull_request' && needs.release.outputs.released == 'true'
        env:
          GH_TOKEN: ${{ github.token }}
          RELEASE_TAG: ${{ needs.release.outputs.tag }}
        shell: bash
        run: |
          gh release upload "$RELEASE_TAG" \
            dist/*.dmg \
            dist/*.zip \
            "dist/SHA256SUMS-${{ matrix.arch }}.txt" \
            --repo "$GITHUB_REPOSITORY" \
            --clobber
```

- [ ] **Step 4: Publish only after both builds succeed**

Replace final job dependency with:

```yaml
  publish-release:
    needs: [release, build]
    if: needs.release.outputs.released == 'true' && needs.build.result == 'success'
```

Keep the explicit-repository publish command:

```sh
gh release edit "$RELEASE_TAG" --repo "$GITHUB_REPOSITORY" --draft=false --latest
```

- [ ] **Step 5: Remove the old release planner**

Delete all shell that reads `package.json` to choose a tag, checks for an existing release/tag, creates a draft via `gh release create`, or tells the user to manually bump `package.json`.

- [ ] **Step 6: Commit**

```sh
git add .github/workflows/macos.yml
git commit -m "ci: release from Conventional Commits"
```

### Task 3: Verify release behavior before merge

**Files:**
- Verify: `release.config.mjs`
- Verify: `.github/workflows/macos.yml`
- Verify: `test/release-config.test.mjs`

**Interfaces:**
- Consumes: PR check runs and repository tag/release state.
- Produces: merge-ready PR with no manual version bump requirement.

- [ ] **Step 1: Run Node tests in PR CI**

Expected: `npm test` passes, including the release config contract test.

- [ ] **Step 2: Run both native PR smoke/package builds**

Expected:

- arm64 `Test native Electron window and IPC`: PASS
- x64 `Test native Electron window and IPC`: PASS
- arm64 unsigned package verification: PASS
- x64 unsigned package verification: PASS
- no GitHub Release is created from the pull request

- [ ] **Step 3: Review workflow diff**

Verify there is no remaining `release-plan`, manual `VERSION=$(node -p ...)`, or “Bump package.json version” release branch.

- [ ] **Step 4: Merge and observe first semantic release**

On the first `main` run after merge, semantic-release must use `v0.4.0` as the previous tag. If there are release-worthy commits since it, it should create the corresponding next version; otherwise it should report `released=false` and skip the macOS release matrix.

- [ ] **Step 5: Verify release atomicity**

For a generated release:

1. release exists as draft before macOS uploads finish,
2. both architecture assets and checksums are present,
3. `publish-release` succeeds,
4. release becomes public/latest only after both matrix jobs pass,
5. `package.json` and `package-lock.json` at the release tag contain the same semantic version.
