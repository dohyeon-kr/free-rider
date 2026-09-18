# Requests and Saving

## Collections, folders, and requests

Create a collection with `+` in the sidebar and add requests to it. Collections and folders can be collapsed or expanded, and you can switch the active collection from the selector next to the collection title.

Choose a Request Type when creating a request.

| Type | Execution model | Result surface |
| --- | --- | --- |
| HTTP | One request → one response | Response Inspector |
| SSE | Connect → continuously receive server events | Event Stream |
| WebSocket | Connect → send and receive messages | Message Timeline |

HTTP requests provide Params, Headers, Body, Auth, Vars, Tests, and Docs tabs. SSE and WebSocket use the same saved-request model but switch to protocol-specific settings and dashboards.

## Request Type

Request Type controls both how a saved request executes and which workspace is shown. Requests from v2 collections are migrated to HTTP when loaded.

### SSE

SSE uses an `http://` or `https://` URL. Free Rider resolves Params, Headers, Auth, and Vars before connecting and shows server `event`, `id`, `data`, and `retry` values in the Event Stream.

- Auto reconnect can be enabled or disabled.
- Search by event name or payload text.
- The dashboard shows event count, transferred bytes, and session duration.
- Pause stops UI updates; it does not change the saved request.

### WebSocket

WebSocket uses `ws://` or `wss://`. Entering `http://` or `https://` is normalized to the matching WebSocket scheme.

- Params, Headers, Auth, and Vars are resolved before the opening handshake.
- Bearer / Basic Auth and custom handshake headers are supported.
- Set requested WebSocket subprotocols in the Protocols tab.
- The Message Timeline combines incoming, outgoing, and connection lifecycle events.
- Compose JSON or Text messages and save reusable payloads as Saved Messages inside the request.
- The app network session is reused, including session cookies during the handshake.

Connection state, session IDs, and received events/messages are runtime-only. URL, Params, Headers/Auth, subprotocols, reconnect settings, and Saved Messages are persisted with the request.

## URL and HTTP method

Request URLs must be absolute `http://` or `https://` addresses. Free Rider resolves variables such as `{{BASE_URL}}` before validating the URL.

Supported methods include `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`, `QUERY`, and valid custom HTTP methods.

- `CONNECT` is not supported.
- `TRACE` and `TRACK` are not supported.
- Credentials in URLs such as `user:password@host` are not allowed. Use Auth or the `Authorization` header.
- `GET` and `HEAD` requests do not send a Body.

## Params and Headers

Only enabled entries are sent. A Params entry with an empty string value is not added to the query string.

Variable support differs by feature. During request execution, `{{NAME}}` is resolved in URLs, query values, header values, bodies, and Auth values.

## Body and file attachments

A regular Body is sent as a string after variable substitution. A multipart Body can contain both text and file parts.

- Variables can be used in multipart text values.
- Total multipart file size must be **50MB or less** per request.
- For multipart requests, Free Rider removes `Content-Type` so the runtime can attach the correct boundary through `FormData`.
- If a file slot can no longer be resolved, select the file again.

## Auth

Auth can be inherited from collection, folder, and request scopes. Auth explicitly set on a request takes precedence over parent scopes.

### Bearer

```text
Bearer {{accessToken}}
```

### Basic

Free Rider combines the username and password and creates a Base64 Basic Authorization header. Variables can also be used in Auth values.

## Saving and tabs

Save to the encrypted local workspace with the save button or <kbd>Cmd</kbd> + <kbd>S</kbd>.

When closing a modified tab, you can choose save / discard / cancel. The tab context menu can close the current tab, other tabs, saved tabs, or all tabs.

A collection can be deleted from its menu. Free Rider always keeps at least one collection.

## Responses and console

The Body area displays server responses, while transport errors and script logs appear in the response console. Free Rider reads response bodies up to **10MB**.

The network timeout is **30 seconds**. HTTP redirects are not followed automatically and are treated as errors.
