# Classify page connection failure

The failure was reproduced at `http://127.0.0.1:5175/#explore/review` by choosing **Live requests → Classify page**. The backend at port 8000 was healthy. Its CORS allowlist contained the localhost and 127.0.0.1 origins on port 5173, while the frontend used port 5175. The browser’s preflight received HTTP 400, `Disallowed CORS origin`, and the actual classification handler never ran. Health checks and document loading failed for the same reason.

The API client defaulted to an absolute loopback backend URL and converted all fetch failures to the same unavailable-backend message. It also added a JSON Content-Type to GET requests, causing unnecessary preflights. Browser tests supplied their frontend port to CORS explicitly and therefore concealed the local configuration mismatch.

## Chosen fix

| Approach | Tradeoff |
| --- | --- |
| Add port 5175 to CORS | Repairs this instance but requires another coordinated setting change for every new frontend origin. Still supported for direct API access. |
| Same-origin development proxy | Keeps local browser requests on the frontend’s actual origin and routes `/api` to the backend, including commands, uploads and SSE. Selected as the default. |
| Wildcard CORS or rewriting every Origin | Weakens the live-request boundary. Not used. |

The frontend now defaults to relative API URLs. Vite’s [documented proxy support](https://vite.dev/config/server-options#server-proxy) forwards them to `DEV_API_PROXY_TARGET`, defaulting to port 8000. `VITE_API_BASE_URL` remains an explicit override for a separately hosted API. Hosted builds no longer silently default to the end user’s loopback address.

The local proxy preserves both Host and Origin. Live admission accepts an exact match only when the connection peer and URL host are loopback. External hostnames, remote peers, mismatched origins and forwarded-host substitutions cannot use this local exception. The existing explicit CORS allowlist and origin checks remain in force for direct cross-origin traffic.

An unreachable proxy target returns a readable JSON HTTP 503 identifying the backend address. Provider errors keep their HTTP status and message. HTML or malformed successful API responses produce a configuration/response error, and ambiguous command responses preserve the idempotency key for a deliberate retry. No automatic retry of a paid model request was added.

## Verification

One real **Classify page** request from the original port 5175 returned HTTP 200 and an OpenAI `gpt-5.5-2026-04-23` judgment in about 2.2 seconds, with one provider call, no operational writes and no browser network failures. This is a connectivity check on one fictional page, not a performance benchmark.

Regression coverage exercises the real browser-to-proxy-to-backend route with provider keys absent, so no paid call is needed in CI. The readable missing-key response proves that routing, origin admission and handler execution succeeded. Separate tests cover local IPv4/IPv6 origins, remote and untrusted requests, exact CORS preflights, preserved cookies and Origin headers, streaming before completion, backend shutdown, and command-key retention after lost or malformed responses.

Completed checks:

- 112 Python tests covering live origins, review boundaries, live lessons, classification measurements, settings and API behavior.
- 9 frontend unit/integration tests covering the API client, actual Vite proxy and frontier model selection.
- 3 browser tests covering the real proxy-to-backend route, rejected origins and review navigation.
- TypeScript type checking, targeted ESLint and Ruff checks, and the production build passed. The build reports a large-chunk warning for the learning workspace bundle.
