# Ride

A **Course** is a saved ordered sequence of HTTP requests. A **Ride** is the action of executing that Course.

Store repeatable flows such as login → current user → profile update as Courses, then Ride them whenever you need to verify the flow. A collection can contain multiple Courses.

## Create Courses

Use the Course selector on the Ride screen to switch the current Course, and choose `New Course` to add another execution path.

Each Course stores its own:

- Course name
- Ordered endpoint steps
- Stop-on-failure setting

## Insert endpoints

Use the search-and-insert palette instead of checkbox selection.

Choose `Insert endpoint`, search by request name, method, or URL, then click a result or press Enter.

The same endpoint can appear multiple times, which makes macro-style Courses possible:

```text
POST Login
GET Current user
PATCH Profile
GET Current user
```

Use the `+` control before a step to insert a new endpoint at that exact position.

## Ride a Course

Choose `Run Ride` to execute every step in the selected Course from top to bottom.

A step passes when the HTTP status is below 400 and request scripts complete without errors. If any step fails, the Ride result is FAIL.

Enable `Stop on failure` to stop at the first failed step. Manual cancellation is reported as STOPPED.

::: warning Ride uses saved requests
Ride executes the last saved request, not the draft currently in the editor. Save with <kbd>Cmd</kbd> + <kbd>S</kbd> before running.
:::

## Configure and Ride Courses through MCP

When Free Rider MCP is enabled, an AI agent can inspect, configure, and execute Courses.

- `list_courses`: list Courses in a collection
- `get_course`: inspect ordered endpoint steps
- `set_course`: create or replace a Course from request IDs
- `delete_course`: delete a Course
- `ride_course`: Ride a saved Course

`set_course.requestIds` preserves order and may contain the same request ID more than once.

## Pass values between requests

Runtime Vars stored by response extraction or After Response scripts are available to later steps.

```js
const body = res.json()
ctx.vars.set('accessToken', body.accessToken)
```

```text
Authorization: Bearer {{accessToken}}
```
