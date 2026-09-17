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
4. **Resolve conflicts** — choose whether to keep the current value or apply the specification value.
5. **Apply selected changes** — apply only checked endpoints. Deletion candidates are unchecked by default.
6. **Save and restore** — changes are committed after a successful save, and the previous applied state can be restored.

Changes cannot be applied while unresolved conflicts remain.

## Comparison granularity

Headers, Query parameters, and response schemas are compared item by item. String Bodies and arrays are compared as a single value.

Unselected changes remain in future sync reviews, so you do not need to process every change at once.

## Reload the specification file

If a connected file was modified in an external editor, use `Reload` to read and review the latest content.

## Server address and Environment

If the selected Environment has an empty `baseUrl`, Free Rider can suggest registering the specification's server URL.

When a specification imported from a URL uses a relative server URL, it is resolved **relative to the specification URL**.
