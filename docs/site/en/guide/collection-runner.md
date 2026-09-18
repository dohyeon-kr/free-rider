# Ride

A Ride is a **test scenario** that executes saved HTTP requests in order.

A collection can contain multiple Rides, so login flows, CRUD scenarios, and regression checks can be stored as separate execution sequences.

## Create multiple Rides

Use the Ride selector to switch scenarios and `New Ride` to create another sequence.

Each Ride stores its own:

- Name
- Ordered endpoint steps
- Stop-on-failure setting

## Insert endpoints

Ride uses a search-and-insert palette instead of checkbox selection.

Choose `Insert endpoint`, search by request name, method, or URL, then click a result or press Enter.

The same endpoint can appear multiple times, which makes macro-style flows possible:

```text
POST Login
GET Current user
PATCH Profile
GET Current user
```

Use the `+` control before a step to insert a new endpoint at that exact position.

## Run tests

Choose `Run Ride` to execute every step from top to bottom.

A step passes when the HTTP status is below 400 and request scripts complete without errors. If any step fails, the whole Ride is FAIL.

Enable `Stop on failure` to stop at the first failed step. Manual cancellation is reported as STOPPED.

::: warning Ride uses saved requests
Ride executes the last saved request, not the draft currently in the editor. Save with <kbd>Cmd</kbd> + <kbd>S</kbd> before running.
:::

## Pass values between requests

Runtime Vars stored by response extraction or After Response scripts are available to later steps.

```js
const body = res.json()
ctx.vars.set('accessToken', body.accessToken)
```

```text
Authorization: Bearer {{accessToken}}
```
