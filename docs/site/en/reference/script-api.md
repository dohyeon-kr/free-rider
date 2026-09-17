# Script API Reference

Global pre-processing and post-processing scripts run in a QuickJS runtime inside a separate Worker. Write code as a function body; Free Rider provides `req`, `res`, and `ctx`.

## `req`

Represents the current request in both pre-processing and post-processing. Changes made during pre-processing are applied to the actual network request.

### `req.method: string`

The HTTP method. It can be assigned directly.

```js
req.method = 'POST'
```

After pre-processing, the method is normalized to uppercase and validated again as an HTTP token. `CONNECT`, `TRACE`, and `TRACK` are not allowed.

### `req.url: string`

The final request URL. It can be assigned directly.

```js
req.url = req.url.replace('/v1/', '/v2/')
```

After pre-processing, Free Rider validates again that it is an HTTP/HTTPS URL without embedded credentials.

### `req.body`

The request Body. For regular requests it is a string or `undefined`; multipart requests use an internal FormData configuration object.

If the method is changed to `GET` or `HEAD`, the Body is removed after pre-processing.

### `req.headers.get(name)`

Header names are case-insensitive. Returns `undefined` when the header does not exist.

```js
const contentType = req.headers.get('content-type')
```

### `req.headers.set(name, value)`

Adds or overwrites a header. The value is converted to a string.

```js
req.headers.set('Authorization', 'Bearer ' + ctx.vars.get('accessToken'))
```

### `req.headers.delete(name)`

Removes a header.

```js
req.headers.delete('X-Debug')
```

## `res`

`res` is a read-only response object available **only during post-processing**.

### `res.status: number`

HTTP status code.

### `res.statusText: string`

HTTP status text.

### `res.headers.get(name)`

Reads a response header case-insensitively.

```js
const requestId = res.headers.get('x-request-id')
```

Calling `set` / `delete` on response headers throws an error.

### `res.text(): string`

Returns the raw response Body as text.

### `res.json(): unknown`

Returns the response Body parsed with `JSON.parse`. Throws if the Body is not JSON.

```js
const data = res.json()
ctx.vars.set('userId', data.id)
```

### Other response fields

| Field | Description |
| --- | --- |
| `res.body` | UTF-8 response string |
| `res.bytes` | Number of response bytes read |
| `res.setCookies` | Array of `Set-Cookie` values collected by the runtime |
| `res.timing.waiting` | Time until response headers arrive (ms) |
| `res.timing.download` | Body download time (ms) |
| `res.timing.total` | Total fetch duration (ms) |

## `ctx.env`

Environment values are read-only in scripts.

### `ctx.env.get(key)`

```js
const apiKey = ctx.env.get('API_KEY')
```

Returns `undefined` when no value exists.

## `ctx.vars`

Reads and changes runtime Vars.

### `ctx.vars.get(key)`

```js
const token = ctx.vars.get('accessToken')
```

### `ctx.vars.set(key, value)`

Stores a value in the current execution context. It can be used by subsequent requests.

```js
ctx.vars.set('accessToken', res.json().accessToken)
```

`__proto__`, `constructor`, and `prototype` cannot be used as variable names.

### `ctx.vars.delete(key)`

Deletes a runtime value.

```js
ctx.vars.delete('accessToken')
```

## `ctx.log(...args)`

Writes a log entry to the response console.

```js
ctx.log('HTTP', res.status, { url: req.url })
```

Non-string values are JSON-serialized when possible. A single script execution collects at most **100** log entries, and each entry is truncated to **4,000 characters**.

## Execution environment

The script runtime does not expose the file system, shell, or direct network access. Node.js `require`, `process`, and `fetch` are not provided as APIs.

| Limit | Value |
| --- | --- |
| QuickJS memory | 32MB |
| QuickJS stack | 512KB |
| QuickJS interrupt deadline | about 1.5 seconds |
| Worker hard timeout | 3 seconds |

A pre-processing error stops the request before it is sent. A post-processing error is reported separately from the response as `scriptError`.
