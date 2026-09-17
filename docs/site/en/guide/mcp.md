# MCP Server

When the app is running, Free Rider can expose a local MCP server. A separate MCP process does not read or decrypt workspace files directly. Instead, the MCP server reuses Free Rider's existing request execution path.

## Turn it on and off

Click the `MCP Off` button at the bottom of the app to start the server.

- Default state: off
- Address: `http://127.0.0.1:48173/mcp`
- Binding: localhost only
- Click the button again to stop it immediately

When enabled, the button displays `MCP :48173`.

::: tip Save before using MCP
MCP reads collections, requests, and Environments from the saved workspace. Save the workspace first if you want an AI client to use edits that are still open in the editor.
:::

## Available tools

| Tool | Description |
| --- | --- |
| `list_collections` | List collection and Environment names |
| `list_requests` | List requests in a collection |
| `get_request` | Read saved request details |
| `send_request` | Execute a saved request |
| `list_network_history` | List recent network history summaries |
| `get_network_entry` | Read details for a network history entry |

`list_collections` does not return Environment variable values. `send_request` uses the same request execution handler as the main Free Rider app, including the same cookie session, pre/post-processing, and assertion flow.

## MCP connection handoff prompt

Give the following prompt to another AI agent or IDE when you want it to **configure the Free Rider MCP connection itself**.

```text
The Free Rider app's MCP server is already running locally. Connect Free Rider MCP to the AI agent/IDE currently in use in this environment.

Connection information:
- Name: free-rider
- Transport: Streamable HTTP
- URL: http://127.0.0.1:48173/mcp
- Authentication: none
- Network scope: localhost only

Requirements:
1. First identify how the current client configures MCP and where its MCP configuration is stored.
2. Do not guess a client-specific format. Add the server using the Streamable HTTP MCP configuration format supported by the current environment.
3. This is an already-running HTTP MCP server. Do not create a stdio, npx, or separate MCP server process.
4. If you have permission to change settings, apply the configuration directly and perform any required MCP reload or client restart step.
5. After connecting, verify that Free Rider tools appear through tools/list or the client's MCP tool list.
6. When possible, perform a read-only validation by calling list_collections. Do not call send_request only to test the connection.
7. If the connection fails, check URL reachability, transport support, and MCP protocol negotiation in that order.
8. At the end, briefly report the configuration file/setting changed and the connection verification result.

Expected Free Rider tools:
- list_collections
- list_requests
- get_request
- send_request
- list_network_history
- get_network_entry
```

::: tip Check where the client is running
Free Rider MCP listens only on `127.0.0.1`. If the AI agent or IDE runs inside a separate VM, container, or remote server, that environment's `127.0.0.1` does not point to the Mac running Free Rider, so it cannot connect directly.
:::

## Security scope

The server binds only to `127.0.0.1` and rejects requests from external web Origins. The current version is intended for local development-tool connections and does not provide separate user authentication.

## Protocol

The server handles MCP requests using the 2026-07-28 protocol as well as older MCP clients that negotiate through `initialize`. The HTTP endpoint uses stateless Streamable HTTP with JSON responses.
