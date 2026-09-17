---
layout: home

hero:
  name: Free Rider
  text: Keep API work close to files and Git.
  tagline: A macOS API client for writing requests, environment variables, pre/post-processing, OpenAPI change review, and local Git workflows without a server or account.
  image:
    src: /free-rider-app-icon.png
    alt: Free Rider rider character
  actions:
    - theme: brand
      text: Get Started
      link: /en/guide/getting-started
    - theme: alt
      text: Download Latest
      link: https://github.com/dohyeon-kr/free-rider/releases/latest

features:
  - title: Local-first
    details: Store workspaces locally and use them without a separate server or account.
  - title: Git-friendly
    details: Keep shareable collection files in diffs and commits while separating local secrets.
  - title: OpenAPI review
    details: Review endpoint changes and conflicts before selectively applying specification updates.
  - title: Environment & Vars
    details: Combine environment values, request-scoped Vars, and runtime-captured values hierarchically.
  - title: Scriptable
    details: Control requests and runtime variables with req, res, and ctx APIs in QuickJS pre/post-processing scripts.
  - title: Collection Runner
    details: Run saved requests in sequence with stop-on-failure, manual stop, and per-request results.
---

## What Free Rider covers

Free Rider writes and runs API requests like Postman or Bruno, but focuses on **local files and Git-based collaboration** rather than server synchronization.

- Write and run requests — Params, Headers, Body, Auth, Vars, Tests, Docs
- Multiple Environments and linked `.env` files
- Global pre-processing and post-processing scripts
- Collection Runner based on saved requests
- Review and selectively apply OpenAPI 3.x JSON/YAML changes
- Collection file diff / commit workflow
- macOS arm64 / x64 distribution and automatic updates

::: tip New to Free Rider?
Start with [Getting Started](/en/guide/getting-started), then continue with [Environments and Vars](/en/guide/variables-and-scripts) and [OpenAPI Sync](/en/guide/openapi-sync).
:::
