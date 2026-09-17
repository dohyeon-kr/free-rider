# OpenAPI Sync

Free Rider does not immediately overwrite requests from an OpenAPI document. It **reviews changes first and applies selected changes afterward**.

## Supported input

- OpenAPI 3.x JSON files
- OpenAPI 3.x YAML files
- HTTP/HTTPS URLs

Bundle specifications that contain external `$ref` references before importing them.

## Sync flow

1. **Connect** — connect an OpenAPI file or URL.
2. **Sync** — build a change review list. Requests are not modified at this stage.
3. **Compare** — expand an endpoint and compare the previous specification / current request / new specification.
4. **Check compatibility** — changes that can break existing callers or response handling are marked `BREAKING`.
5. **Resolve conflicts** — choose whether to keep the current value or apply the specification value.
6. **Apply selected changes** — apply only checked endpoints. Deletion candidates are unchecked by default.
7. **Save and restore** — changes are committed after a successful save, and the previous applied state can be restored.

Changes cannot be applied while unresolved conflicts remain.

## Breaking change detection

The sync review flags compatibility risks before they are applied, including:

- removal of an existing operation
- a newly required parameter or an optional parameter becoming required
- request parameter / body schema type changes or narrowed enum values
- a request body or object property becoming required
- removal of an existing 2xx success response or response media type
- removal of an existing response property or a response schema type change

A `BREAKING` marker is a review warning, not an automatic block. Inspect the reasons and apply only the endpoints you intend to update. Deletion candidates remain unchecked by default.

## Comparison granularity

Headers, Query parameters, and response schemas are compared item by item. String Bodies and arrays are compared as a single value.

Unselected changes remain in future sync reviews, so you do not need to process every change at once.

## Reload the specification file

If a connected file was modified in an external editor, use `Reload` to read and review the latest content.

## Server address and Environment

If the selected Environment has an empty `baseUrl`, Free Rider can suggest registering the specification's server URL.

When a specification imported from a URL uses a relative server URL, it is resolved **relative to the specification URL**.

## Import a specification protected by Basic Auth

In **Start with OpenAPI** for a new collection, or **OpenAPI / API Specifications** for an existing collection, enter the URL, select **Specification authentication → Basic Auth**, and enter Username and Password. Use **Start from URL** or **Synchronize** to load a JSON/YAML specification. The eye button reveals or hides the password.

This authentication is **only for downloading the specification**, separate from generated API request authentication. Credentials are reused for the same collection and URL during the current app session only. Changing the URL or closing the app clears them. They are not included in saved workspaces, collection exports, or Git sharing. Enter them again after restarting.

For HTTP 401, check the username/password; for HTTP 403, check specification access permissions. Use the authentication fields rather than embedding `user:password@` in the URL. HTTPS is recommended. Redirects remain disabled.
