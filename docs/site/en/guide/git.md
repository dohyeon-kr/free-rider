# Git Integration

Free Rider provides a workflow for managing collection files together with a local Git repository.

## Create a repository in a new folder

Choose **새 저장소 만들기** (Create repository) in the Git view to create a folder and a local repository together.

1. Select the parent directory using **상위 폴더 선택**.
2. Enter the new folder name in **새 폴더명** and check the full path preview.
3. Click **Create**, or press Enter while editing an input.

For example, parent `/Users/me/Projects` and folder name `my-api` create `/Users/me/Projects/my-api` with an empty `main` branch. The new repository is immediately connected to the current collection's Git view.

Existing files, folders and symlinks are never overwritten. Folder names cannot contain path separators, traversal components or operating-system reserved names. Unicode names and spaces within the name are supported.

Creating a repository does not save a collection or make a commit. Continue with **Save collection to repository** → **View Diff** → **Commit collection**. Missing Git or permission errors leave the previous connection intact. If initialization fails after files were created, the non-empty directory is preserved to avoid deleting user files.

This creates a local repository only, not a hosted GitHub repository or a remote Push / Pull connection.

## Optional commit after synchronization

After OpenAPI changes are actually applied to a collection with a connected Git repository, Free Rider asks whether to commit the result. Both URL and local-spec synchronization use this flow. Preview-only operations, unchanged results, and failed workspace saves do not trigger the offer.

The dialog shows the repository, branch, change counts, and an editable commit message. **저장 후 커밋** (Save and commit) exports the shareable collection and commits only `open-api.collection.json`. **건너뛰기** (Skip), or Escape, preserves the applied sync without running the unapproved Git save/commit. Enter in the message input does not automatically approve a commit.

When a `baseUrl` registration dialog is needed, it finishes first; either confirming or canceling it proceeds to the commit offer. Connections belonging to other collections do not trigger a prompt.

::: warning The whole saved collection is committed
This can include earlier uncommitted collection changes, not just the synchronization changes. Environment values are excluded using the existing sharing rules, but credentials written directly in requests can be included. Other staged files are preserved and no remote push is performed.
:::

If the saved file matches HEAD, no empty commit is created. A commit failure never rolls back the applied workspace synchronization. The dialog preserves the message and allows retry; any collection file already saved or staged remains intact. If the connected repository or branch changed after the prompt, refresh the Git view and commit there instead.

## Basic flow

1. Select a local Git repository.
2. Save the collection file.
3. Review the diff in Free Rider.
4. Commit the collection changes.

Free Rider Git operations only commit `open-api.collection.json`. Other files already staged in the repository are not included.

Recent collection commits are also visible in the UI.

## Push and Pull

Free Rider focuses on local diff and commit operations. Use your existing Git client or CLI for remote Push / Pull.

## Values excluded from shared files

The following values are not included in collaboration-oriented collection files:

- Actual Environment values
- Local file paths
- Global pre/post-processing scripts
- Restore backups

::: danger Secrets written directly into requests
Tokens or passwords written directly in request Headers or Bodies can be included in the collection file. For shared requests, use variables such as `{{TOKEN}}` and keep actual values in an Environment.
:::
