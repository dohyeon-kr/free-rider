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
