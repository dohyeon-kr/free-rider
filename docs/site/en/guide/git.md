# Git Integration

Free Rider provides a workflow for managing collection files together with a local Git repository.

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
