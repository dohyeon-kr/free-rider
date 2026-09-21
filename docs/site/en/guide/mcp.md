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
| `get_openapi_spec` | Read the linked OpenAPI source and generated operation summaries |
| `set_openapi_source` | Validate and link/change an HTTP/HTTPS OpenAPI specification URL without applying endpoint changes |
| `unlink_openapi` | Disconnect the linked OpenAPI specification without deleting saved requests |
| `review_openapi` | Review changes and conflicts between saved requests and the linked OpenAPI specification, then issue a temporary `reviewId` |
| `apply_openapi_review` | Apply only explicitly selected endpoints from a prior review with explicit conflict resolutions |
| `send_request` | Execute a saved request |
| `list_courses` | List saved Courses in a collection |
| `get_course` | Read one Course and its ordered endpoint steps |
| `set_course` | Create or replace a Course from an ordered request ID list |
| `delete_course` | Delete a saved Course |
| `ride_course` | Ride a Course by executing its saved HTTP requests in order |
| `list_network_history` | List and filter recent Network-tab history summaries |
| `get_network_entry` | Read a redacted Network-tab history entry |

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

## Configure Courses and Ride through MCP

A **Course** is a saved ordered sequence of HTTP requests. A **Ride** is the execution of that Course.

Use `list_courses` and `get_course` to inspect existing Courses. Use `set_course` with an ordered `requestIds` array to create a Course or replace an existing one. Order is preserved and duplicate request IDs are allowed.

```json
{
  "collectionId": "collection-1",
  "name": "Login and verify",
  "requestIds": ["login", "me", "me"],
  "stopOnFailure": true
}
```

Pass the returned `courseId` to `ride_course` to execute the Course. You may optionally specify a saved `environmentId`; otherwise Free Rider uses the collection's selected/default Environment.

Course writes are rejected while the app has unsaved editor changes. Save the workspace first so the renderer cannot overwrite MCP changes with stale state.

## Manage the linked OpenAPI specification

Use `get_openapi_spec` to inspect the source currently linked to a collection. It returns the source type, source location, parsed title/base URL, and generated operation summaries without changing saved requests.

```json
{
  "collectionId": "collection-id"
}
```

Use `set_openapi_source` to link or change an HTTP/HTTPS specification URL.

```json
{
  "collectionId": "collection-id",
  "source": "https://api.example.com/openapi.json"
}
```

The URL is fetched and parsed before it is saved. This only changes the linked specification source; it does **not** apply endpoint changes. Run `review_openapi` afterwards to inspect the diff. `unlink_openapi` disconnects the source while keeping the collection's saved requests intact.

Source writes are rejected while the app has unsaved edits. Basic Auth credentials used by the OpenAPI UI are intentionally session-only and are not exposed through MCP, so protected specifications that need those credentials must still be managed from the app. Local specification files can be read when already linked, but linking a new local file remains an explicit file-picker action in the UI.

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

## Read Network-tab history

`list_network_history` reads the same persisted history shown in the app's Network tab. In addition to `limit`, it can filter by `collectionId`, `requestId`, `method`, exact `status`, minimum timestamp `since` (milliseconds), and free-text `search`.

```json
{
  "collectionId": "collection-id",
  "method": "GET",
  "status": 200,
  "since": 1789693200000,
  "search": "/users",
  "limit": 50
}
```

Use the returned `id` with `get_network_entry` for request/response bodies, headers, cookies, timing, and error details.

For MCP output, common credentials are redacted: Authorization/Cookie/Set-Cookie/API-key style headers, cookie values, credential-like URL query parameters, and credential-like JSON fields such as `password`, `token`, and `secret`. The app's Network tab remains the place to inspect the original local entry when a raw value is genuinely required.

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
