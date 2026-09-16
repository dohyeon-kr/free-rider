import test from "node:test";
import assert from "node:assert/strict";
import config from "../release.config.mjs";

test("semantic release keeps package metadata and draft release lifecycle aligned", () => {
  assert.deepEqual(config.branches, ["main"]);
  assert.equal(config.tagFormat, "v${version}");

  const exec = config.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "@semantic-release/exec",
  );
  assert.ok(exec, "exec plugin is configured");
  assert.match(exec[1].prepareCmd, /npm version \$\{nextRelease\.version\}/);
  assert.match(exec[1].prepareCmd, /--no-git-tag-version/);
  assert.match(exec[1].successCmd, /\.semantic-release-tag/);

  const git = config.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "@semantic-release/git",
  );
  assert.ok(git, "git plugin is configured");
  assert.deepEqual(git[1].assets, ["package.json", "package-lock.json"]);
  assert.match(git[1].message, /\[skip ci\]/);

  const github = config.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "@semantic-release/github",
  );
  assert.ok(github, "github plugin is configured");
  assert.equal(github[1].draftRelease, true);
});
