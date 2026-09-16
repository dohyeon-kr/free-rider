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
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
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
