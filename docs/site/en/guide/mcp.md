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
MCP reads collections, requests, and Environments from the saved workspace. Save the workspace first if you want an AI client to use edits that are still open in the editor or apply Interceptor/OpenAPI changes.
:::

## Available tools

| Tool | Description |
| --- | --- |
| `list_collections` | List collection and Environment names |
| `list_requests` | List requests in a collection |
| `get_request` | Read saved request details |
| `get_collection_interceptors` | Read the collection's Before Request / After Response Interceptor configuration and source |
| `set_collection_interceptors` | Patch and save collection Interceptor settings |
| `review_openapi` | Review changes and conflicts between saved requests and the linked OpenAPI specification, then issue a temporary `reviewId` |
| `apply_openapi_review` | Apply only explicitly selected endpoints from a prior review with explicit conflict resolutions |
| `send_request` | Execute a saved request |
| `list_network_history` | List recent network history summaries |
| `get_network_entry` | Read details for a network history entry |

`list_collections` does not return Environment variable values or Interceptor source. `send_request` uses the same request execution handler as the main Free Rider app, including the same cookie session, collection Interceptors, and assertion flow.

## Interceptor settings

`get_collection_interceptors` returns the collection's current saved Interceptor configuration.

```json
{
  "enabled": true,
  "before": "req.headers.set(\"Authorization\", \"Bearer \" + ctx.vars.get(\"accessToken\"));",
  "after": "if (res.status === 200) ctx.vars.set(\"lastStatus\", res.status);"
}
```

`set_collection_interceptors` patches only the fields you provide. For example, you can enable Interceptors and replace Before Request while preserving the existing After Response script.

```json
{
  "collectionId": "collection-id",
  "enabled": true,
  "before": "req.headers.set(\"X-Client\", \"free-rider\");"
}
```

If the app has unsaved edits, MCP rejects Interceptor writes to prevent a stale renderer snapshot from overwriting them. Save the Free Rider workspace and try again. After a successful MCP write, the app reloads the saved state.

See [Script API Reference](/en/reference/script-api) for the `req`, `res`, and `ctx` APIs available to Interceptors.

::: warning Interceptor source and secrets
`get_collection_interceptors` returns the saved script source. Do not hard-code tokens or passwords in scripts; use Environment/Vars instead.
:::

## Review OpenAPI changes

OpenAPI synchronization through MCP uses a **two-step review/apply flow**. Reading a linked specification never changes saved requests by itself.

First call `review_openapi` with the collection ID.

```json
{
  "collectionId": "collection-id"
}
```

The response contains a `reviewId` valid for about 10 minutes, counts for added/updated/removed endpoints and conflicts, plus field-level changes. A field is marked `conflict: true` when both the locally saved request and the new specification changed it from the previous OpenAPI baseline.

Then call `apply_openapi_review` with only the endpoint IDs you actually want to apply.

```json
{
  "reviewId": "review-id",
  "selectedIds": ["GET /users", "POST /users"],
  "resolutions": [
    {
      "requestId": "GET /users",
      "field": "description",
      "choice": "incoming"
    }
  ]
}
```

- Unselected additions, updates, and removals are left unchanged.
- Every selected conflict must explicitly choose `local` or `incoming`.
- If the workspace changed after the review, or the `reviewId` expired, run the review again.
- Both review and apply are rejected while the app has unsaved edits.
- A missing Environment `baseUrl` is returned only as `suggestedBaseUrl`; MCP does not silently edit Environment values.
- A successful apply preserves the previous sync state in `syncUndo` and reloads the app from the saved workspace.

A linked local OpenAPI file takes precedence over the saved Specification URL. If a URL requires credentials entered only in the OpenAPI UI, use the app's OpenAPI review screen because MCP does not expose those transient credentials.

## MCP connection handoff prompt

Give the following prompt to another AI agent or IDE when you want it to **configure the Free Rider MCP connection itself**.

<McpHandoffPrompt locale="en" />

::: tip Check where the client is running
Free Rider MCP listens only on `127.0.0.1`. If the AI agent or IDE runs inside a separate VM, container, or remote server, that environment's `127.0.0.1` does not point to the Mac running Free Rider, so it cannot connect directly.
:::

## Security scope

The server binds only to `127.0.0.1` and rejects requests from external web Origins. The current version is intended for local development-tool connections and does not provide separate user authentication.

## Protocol

The server handles MCP requests using the 2026-07-28 protocol as well as older MCP clients that negotiate through `initialize`. The HTTP endpoint uses stateless Streamable HTTP with JSON responses.
