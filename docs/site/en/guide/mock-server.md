# Mock Server (Selective Proxy)

Free Rider runs a local HTTP server that returns OpenAPI-based mock JSON for selected endpoints while forwarding other requests to an upstream API.

## Getting started

1. Open a collection and select **Mock** in the toolbar.
2. Enter the real **Upstream URL** (e.g. https://api.example.com/v1).
3. Switch endpoints to **Mock** or keep them as **Proxy**.
4. Select Generated, OpenAPI Example or Custom response mode; preview and validate the response.
5. Start the server and point your frontend base URL to http://127.0.0.1:4010 (or the displayed local URL).
6. Save the workspace to persist rules and local configuration.

Endpoints without explicit rules proxy by default.

## Response modes

- **Generated:** create and validate data from the selected OpenAPI response schema.
- **Example:** use response-level OpenAPI example values.
- **Custom:** return your own JSON, status and headers with schema validation when available.
- **Custom path:** manually register a mock path even without OpenAPI.
- Unsupported or impossible schema constraints cause errors, not invalid successful responses.

## Network history and security

Mock and Proxy calls from external clients are logged with origin labels. Authentication and cookie headers as well as sensitive-looking JSON fields are redacted.

- The server starts disabled and never auto-starts; it listens only on 127.0.0.1.
- Default port: 4010. Stop before changing the port or active collection.
- Only explicit HTTP(S) upstreams are allowed; self/MCP proxy loops are blocked.
- Request and response bodies: maximum 8MB. Logged bodies: maximum 512KB.
- No SSE/WebSocket proxy, HTTPS interception, system proxy or stateful mock database.
- Browser CORS allows local development origins, not arbitrary remote websites.
- Cookie Domain/Secure/SameSite restrictions may differ from the real API host.
- Compressed responses may be decoded before forwarding; not intended for large binary/streaming responses.
- Mock rules are shareable via Git. Do not embed real secrets or personal data in custom response bodies.

Course/MCP scenario integration remains planned.

## Promote a Network response to a Mock rule

1. Send an API request or generate traffic through the local Mock Proxy.
2. In **Network**, select a JSON response and choose **Mock this response**.
3. Choose a target collection. Matching OpenAPI operations use their route template (for example, /users/{id}) instead of a recorded literal ID path.
4. Review the sanitized JSON and edit it if needed. Credential-looking keys are replaced with [redacted]; inspect other personal or secret values manually.
5. Use **Validate against DTO** before adding. Replacing an existing rule requires an explicit overwrite checkbox.
6. Click **Add Mock Rule**, then use the application's main **Save** button to persist workspace changes. Active rules in the same collection are refreshed immediately when possible.

Truncated, non-JSON, invalid or bodyless responses are not captured. The original Network entry is never modified; URL query parameters are excluded from the new rule.


## Conditional responses and failure simulation

Choose **+ Add condition** on an endpoint to configure additional responses for the same method and path. Enter JSON under **Match JSON**, for example:

```json
{
  "query": { "scenario": "unavailable" },
  "headers": { "X-Debug": "yes" },
  "body": { "user": { "type": "test" } }
}
```

- Query values use exact matching. Repeated query parameters match when any occurrence matches.
- Header names are case insensitive; header values are exact.
- JSON body conditions match **subsets of object fields**, recursively. Arrays must match exactly.
- Multiple conditions are ANDed. More specific rules win within the same route. Static paths take precedence over parameterized routes, with stable saved order for ties.
- Unmatched conditions fall back to the endpoint's default Mock/Proxy rule, or upstream Proxy if no default exists.
- Existing rules without conditions keep their prior behavior. Network → Mock only creates or replaces an unconditional default rule.

Configure **Delay (ms)** from 0 to 30,000 for each Mock response. **Failure simulation** supports:

| Mode | Result |
|---|---|
| Normal response | Return the configured status/body, including 4xx/5xx JSON errors |
| HTTP 504 timeout | After the configured delay, return a simulated HTTP 504 JSON error. This is not a real socket timeout |
| Disconnect socket | After the delay, destroy the connection without an HTTP response to test client network-error handling |

Disconnects are recorded as failures in Network history. OpenAPI schema validation applies to normal JSON responses; synthetic timeout/disconnect modes do not return DTO responses.
