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

## Quick Mocking from a request

Each HTTP request editor has a **Mocking** button in its header. Click it to create a default Mock rule and jump directly to that operation in the Mock Server tab. If the default rule already exists, it is reused (and switched from Proxy to Mock when necessary) without deleting conditional responses or named scenario overrides.

An OpenAPI JSON schema uses **Generated** responses; endpoints without one begin in **Custom** JSON mode. Unsaved edits to that request are saved before creating the rule. Save the workspace to persist subsequent Mock changes. If the Mock server is already running for this collection, Free Rider attempts to refresh it immediately.

Use the search field above **Endpoint Rules / Scenario Rules** to filter by HTTP method, path, request name or folder. The matching count updates as you type; **Clear** shows all endpoints. Searching does not modify any rules.

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


## Named Mock scenarios and Courses

Create a named profile in **Scenario Profiles**. The **default rules** apply to all profiles; rules edited under a named scenario override defaults for the same route while that profile is selected.

1. Enter a name and click **Create scenario**.
2. Select the profile to edit endpoint rules, conditions and delay/error settings. **Inherit** means use the default endpoint rule.
3. Click **Apply to running server** to temporarily switch the active profile. Server restart resets it to defaults.
4. In **Ride**, bind the profile under **Course Mock Scenario** and save.
5. Executing the Course applies the bound profile and restores the previous profile afterward.

A scenario-bound Course requires the Mock server to be running for the **same collection**. Switching profiles while a Course is running is locked to avoid concurrent mutation. Stopping the server mid-ride invalidates the active lease.

### MCP tools

| Tool | Purpose |
| --- | --- |
| `get_mock_server` | Status and saved profile summaries |
| `list_mock_rules` | Rule summaries without raw JSON bodies or condition values |
| `start_mock_server` / `stop_mock_server` | Start/stop the local server using saved settings |
| `select_mock_scenario` | Switch the active runtime profile, or empty ID for defaults |
| `set_mock_scenario` | Create or rename a named profile |
| `set_mock_rule` | Append or replace a saved Mock rule by index |
| `delete_mock_scenario` / `delete_mock_rule` | Remove a saved scenario (including its Course bindings) or one indexed rule |

`set_course` accepts `mockScenarioId`; `ride_course` activates that profile and restores the old one after completion. Save pending UI edits before MCP writes; the server starts only with the saved local upstream and port, not arbitrary remote targets. Do not embed secrets or private user data in shared response bodies.
