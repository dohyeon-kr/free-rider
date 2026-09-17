# Execution Rules and Limits

These are the network, Body, and security rules applied by the request execution engine.

## Variable substitution

Values are substituted using the `{{NAME}}` syntax. Whitespace around the variable name is ignored.

```text
{{ BASE_URL }}/users
```

If the variable does not exist, the request is not sent and an error is shown.

## URL

- Only HTTP/HTTPS are allowed.
- Username/password in the URL are not allowed.
- Invalid or non-absolute URLs are not sent.
- Redirects are not followed automatically.

## Methods and Body

- Method names in RFC token format are allowed.
- `CONNECT`, `TRACE`, and `TRACK` are blocked.
- Bodies are removed from `GET` and `HEAD` requests.
- Total multipart file size must be 50MB or less.

## Response

| Item | Limit |
| --- | --- |
| Request timeout | 30 seconds |
| Response Body | Up to 10MB |
| Response decoding | UTF-8 string |

If a response exceeds 10MB, the download is stopped and an error is returned.

## Extract response values

Configured extract mappings can be applied to successful responses (2xx). Free Rider follows a dot path in the JSON Body and stores the result in runtime Vars.

```text
accessToken -> data.auth.accessToken
```

A missing value or an object value is treated as an error. `__proto__`, `constructor`, and `prototype` cannot be used as extracted variable names.

## Script and request order

Execution order:

1. Prepare the request by applying variable substitution and Auth
2. Run pre-processing
3. Revalidate the URL / method after pre-processing
4. Send the HTTP request
5. Process extract mappings for 2xx responses
6. Run post-processing
7. Apply extracted values and script Vars changes to the execution result

Pre-processing modifies only the current execution request, not the saved request source.
