# Collection Runner

Use the Collection Runner to execute multiple saved requests in a defined order.

## Build a run list

Select saved requests with `Add endpoint`. Excluding a request from the run list or changing its order does not delete the original request.

Save the run list configuration with the save button.

## Execution behavior

Runner supports:

- Sequential execution of selected requests
- Per-request result inspection
- Stop on failure
- Manual stop
- Pre/post-processing scripts and runtime Vars propagation

::: warning Runner uses saved requests
Runner executes the last saved request, not the draft currently in the editor. Saving with <kbd>Cmd</kbd> + <kbd>S</kbd> before a run is the safest workflow.
:::

## Pass values between requests

Runtime Vars stored by response extraction or post-processing scripts are available to later requests.

```js
// Post-processing for a login request
const body = res.json()
ctx.vars.set('accessToken', body.accessToken)
```

```text
Authorization: Bearer {{accessToken}}
```

Global scripts use the configuration captured when Runner starts, so editing them during an active run does not affect that run.
