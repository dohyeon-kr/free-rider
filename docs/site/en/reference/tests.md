# Tests Reference

The Tests tab checks response values with expressions and operators. Disabled rules and rules with an empty expression are not executed.

## Expression

| Expression | Value |
| --- | --- |
| `res.status` | HTTP status code |
| `res.responseTime` | Total request duration (ms) |
| `res.body` | Parsed value for JSON, otherwise a string |
| `res.body.foo.bar` | Nested property in a JSON Body |
| `res.headers.content-type` | Lowercase response header |

Body paths are separated by dots (`.`).

```text
res.body.data.user.id
```

## Operator

| Operator | Evaluation |
| --- | --- |
| `equals` | JSON-serialized values are equal |
| `notEquals` | JSON-serialized values are different |
| `exists` | Actual value is not `undefined` |
| `contains` | String form of actual value contains the expected value |
| `lessThan` | Numeric actual value is less than the expected value |

Saved expected values are passed through `JSON.parse` when possible. For example, `200`, `true`, and `{"ok":true}` are compared as a number, boolean, and object respectively, while ordinary text is compared as a string.
