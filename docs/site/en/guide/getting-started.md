# Getting Started

Free Rider is a macOS Electron API client that works without a server or account.

## Installation

### Homebrew

Homebrew Cask is the recommended installation method if you already use Homebrew. The Free Rider repository doubles as its tap, so you only need to connect the explicit Git URL once.

```sh
brew tap dohyeon-kr/free-rider https://github.com/dohyeon-kr/free-rider.git
brew install --cask dohyeon-kr/free-rider/free-rider
```

Homebrew 6 requires explicit trust for non-official taps. Installing the **fully qualified Cask name** as shown above trusts only the Free Rider Cask instead of the entire tap.

Upgrade through the normal Homebrew flow when a new Free Rider release is published:

```sh
brew update
brew upgrade --cask free-rider
```

To uninstall:

```sh
brew uninstall --cask free-rider
```

After each published release, Free Rider's release workflow automatically updates the version and the Apple Silicon / Intel DMG SHA-256 values in `Casks/free-rider.rb`.

### Direct download

You can also download the DMG or ZIP for your Mac architecture from [GitHub Releases](https://github.com/dohyeon-kr/free-rider/releases/latest).

| Mac | Architecture |
| --- | --- |
| Apple Silicon | `arm64` |
| Intel Mac | `x64` |

Free Rider uses Electron 44 and therefore requires macOS 13 Ventura or later. Automatic updates for distribution builds are enabled only for Developer ID signed and notarized builds. Ad-hoc and development builds do not use automatic updates because macOS Squirrel requires valid signing.

## Send your first request

1. Create a collection with `+` in the sidebar.
2. Add a request with `+ Request` at the top or `+` in the tab bar.
3. Enter an HTTP method and absolute URL.
4. Configure Params / Headers / Body / Auth / Vars / Tests / Docs as needed.
5. Run the current editor state with `Send`.
6. Save the workspace with the save button or <kbd>Cmd</kbd> + <kbd>S</kbd>.

::: warning Send vs. Runner
A single `Send` uses the **currently edited content**. The Collection Runner uses the **saved request**. If Runner results differ from the editor, first check whether you saved the request.
:::

## Use variables

Create a value such as `BASE_URL=https://api.example.com` in the Environment screen and reference it in URLs or headers using braces.

```text
{{BASE_URL}}/v1/users
```

Variable names are case-sensitive. Missing values cause an error before the request is sent.

## Run in development mode

When running directly from the repository:

```sh
npm ci
npm start
```

See [Development and Docs Build](/en/development) for tests and macOS builds.

## Next steps

- [Requests and Saving](/en/guide/requests) — request editing, multipart, Auth, tabs, and responses
- [Environments and Vars](/en/guide/variables-and-scripts) — variable precedence and pre/post-processing
- [OpenAPI Sync](/en/guide/openapi-sync) — review and selectively apply specification changes
