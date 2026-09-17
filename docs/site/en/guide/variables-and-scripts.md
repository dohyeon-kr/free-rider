# Environments and Vars

Free Rider separates values that change by execution environment from values that change during a run.

## Environment vs. Vars

| Type | Purpose | Script API |
| --- | --- | --- |
| Environment | Read-only values that vary across dev / staging / prod | `ctx.env.get("KEY")` |
| Vars | Collection, folder, request-scoped values and values captured at runtime | `ctx.vars.get/set/delete("KEY")` |

Use them in requests like this:

```text
{{BASE_URL}}/v1/users/{{userId}}
```

Variable names are case-sensitive.

## Variable precedence

Values are merged from lowest to highest precedence in this order:

1. Collection / folder defaults
2. Selected Environment
3. Request Vars
4. Runtime Vars

Runtime Vars carry over to subsequent requests within the same collection and Environment. They disappear when the app exits or runtime values are cleared.

## Link `.env` files

You can create multiple Environments or link `.env` files from the Environment screen.

For a linked file, edit the source text and use `Apply edits` or `Save file`. `Reload` reads the latest content from disk.

If the file changed outside Free Rider, saving is blocked to avoid overwriting external changes. Reload first and review the latest content.

## Global pre/post-processing

Enable scripts from `Global pre/post-processing` in the sidebar. They apply to all collections, and the Collection Runner snapshots the current script configuration when a run starts.

### Pre-processing example

```js
const token = ctx.vars.get('accessToken')

if (token) {
  req.headers.set('Authorization', 'Bearer ' + token)
}

req.headers.set('X-Environment', ctx.env.get('ENV'))
```

Changes to `req.method`, `req.url`, `req.body`, and `req.headers` in pre-processing are applied to the actual network request.

### Post-processing example

```js
if (req.url.includes('/login') && res.status === 200) {
  ctx.vars.set('accessToken', res.json().accessToken)
}

ctx.log('HTTP', res.status)
```

Environment values are read-only. Only Vars can be changed with `set` and `delete`.

See the [Script API Reference](/en/reference/script-api) for methods and execution limits.
