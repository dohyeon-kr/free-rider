# Ride Tests

In Free Rider, the test unit is a **Ride scenario**, not an individual request.

Insert saved HTTP endpoints into a Ride in the order you want to execute them. Free Rider reports the result of each step and the overall scenario.

## Build a test scenario

A collection can contain multiple Rides.

1. Create a new Ride.
2. Choose `Insert endpoint` and search saved requests by name, method, or URL.
3. Click a result or press Enter to insert it at the current position.
4. The same endpoint can be inserted more than once.
5. Reorder steps with the up/down controls.

For example:

```text
Login
→ Current user
→ Update profile
→ Current user
```

Runtime Vars captured by response extraction or After Response scripts are available to later steps.

## PASS / FAIL

A step passes when all of these conditions are true:

- An HTTP response is received successfully
- The status code is below 400
- Before Request and After Response scripts complete without errors

If any step fails, the Ride result is FAIL.

When `Stop on failure` is enabled, execution stops at the first failed step. A manual stop is reported as STOPPED.

## Request Tests removed

Request-level Tests tabs and response assertions are no longer used.

Inspect a single request through Body, Headers, Schema, History, and Console. Use Ride for repeatable test flows.
