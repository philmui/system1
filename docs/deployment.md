# Build the frontend for Vercel

The deployment topology has a Vite frontend on Vercel and one persistent FastAPI backend. Browsers send commands, uploads, and SSE requests directly to that backend over HTTPS. The backend retains SQLite databases, checkpoints, and generated file storage on an attached persistent disk.

This guide configures the deployment. A successful local build is recorded separately from an actual hosted deployment in [evaluation](evaluation.md). No deployment is implied by the repository configuration.

## Frontend settings

| Vercel setting | Value |
| --- | --- |
| Project root | `frontend` |
| Framework preset | Vite |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Public build variable | `VITE_API_BASE_URL=https://<your-protected-backend-origin>` |

`frontend/vercel.json` records the build and SPA fallback configuration. Keep API requests at the external backend origin. The SPA rewrite sends frontend deep links to `index.html`; it is not a backend proxy. These settings follow the current [Vercel Vite guide](https://vercel.com/docs/frameworks/frontend/vite).

Set `VITE_API_BASE_URL` separately for development, preview, and production environments as needed. Vite embeds public environment values at build time, so changing the value requires a rebuild. Never expose provider credentials through `VITE_` names or spread the entire process environment into the bundle. See [Vite environment variables](https://vite.dev/guide/env-and-mode).

Local Vite may read the repository root `.env`. Vercel builds use deployment variables and must not require `../.env`: a project root limits access to files outside that directory. The Vite configuration accounts for this boundary. [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build) and [Vite envDir](https://vite.dev/config/shared-options.html#envdir) describe these behaviors.

From the repository root, check that boundary before deploying:

```sh
npm ci --prefix frontend
VERCEL=1 VITE_API_BASE_URL=https://backend.example.invalid npm run build --prefix frontend
```

Replace the illustrative backend origin in the actual deployment environment. The build-only `.invalid` address demonstrates that secrets and local API connectivity are not build prerequisites.

## Backend requirements

Use a host that can run Python 3.14.6 and one long-lived process with a writable persistent disk. Install from the root project and its lockfile, then start:

```sh
uv sync --frozen --no-dev
uv run --frozen --no-dev doc-discovery init
uv run --frozen --no-dev uvicorn doc_discovery.api:app --host 0.0.0.0 --port 8000
```

Set `APP_DATA_DIR` to the mounted persistent directory. Set `APP_MODE=live`, the required TypeSafe/OpenAI keys, the selected models, and optional LangSmith configuration in the host's secret environment. Set `CORS_ORIGINS` to the exact allowed frontend origins, with no wildcard, URL path, query, or fragment. The backend permits credentialed browser requests from those explicit origins, and the frontend sends cookies for an authenticating proxy. CORS controls browser origin access; it does not authenticate a user.

Keep one process. The demo's in-process jobs do not constitute a durable queue, and separate replicas cannot coordinate their active jobs through process-local locks. SQLite, file storage, and checkpoint ownership should remain together on local persistent storage. Plan restarts: awaiting-review runs persist, while active jobs become interrupted and require eligible recovery. Do not claim exactly-once remote calls.

A future multi-user service should move metadata/checkpoints to an appropriate managed database, files to controlled object storage, and scheduling to a durable worker queue. The current demo deliberately does not implement those systems.

Vercel supports [Python functions](https://vercel.com/docs/functions/runtimes/python) and [streaming workloads](https://vercel.com/docs/functions/streaming-functions). Request duration and filesystem lifecycle motivate this separate backend. Limits are plan-dependent and can change; consult [function duration](https://vercel.com/docs/functions/configuring-functions/duration) and [function limits](https://vercel.com/docs/functions/limitations) for any later proxy design. Direct backend uploads still enforce the application's own size limit.

## Protect the single-user backend

The application is a local single-user demonstration and has no tenant model or built-in login. Before allowing private uploads through a public frontend, put the backend behind an access boundary that authenticates every HTTP and SSE request. A concrete option is a private network or identity-aware reverse proxy configured to permit only the intended user, with the API unreachable around that proxy. Verify authentication on command routes, document and passage routes, and event streams, not only `/`.

If that boundary is unavailable, keep the demonstration local or restrict a hosted demonstration to fictional public sample data. Do not treat an unguessable URL, a CORS allowlist, or a frontend deployment password as backend authentication. Keep the browser/backend transport HTTPS to avoid mixed-content failures.

The app uses the direct TypeSafe credential path. AI Gateway and Vercel Connect remain optional provider-access and credential-management alternatives, discussed in [architecture](architecture.md); they are not deployment prerequisites.

## Check streaming and persistence after deployment

With your actual backend origin and a run ID from a start response, inspect the stream:

```sh
curl -N 'https://your-backend.example/api/runs/YOUR_RUN_ID/events?after=0'
```

Substitute those two values; this is an endpoint shape rather than a working hosted URL. The response should be `text/event-stream`, with `id`, `event: execution`, JSON `data`, and heartbeat comments while idle. Reconnect after a known sequence and verify that only later events arrive. Disable reverse-proxy buffering and use timeouts that permit the stream to remain open; terminal streams close deliberately.

Open the frontend, check readiness, run the three-document fixture walkthrough, resolve review, and open an anchored citation. Reload during an active run and during review. Restart the backend while awaiting review, then confirm the same run can resume from its persistent checkpoint. Verify that trace delivery failure changes telemetry status without replacing the local run result.

Back up the data directory consistently, including application and checkpoint databases plus stored files. Stop writes or use SQLite-aware backup operations; copying a database file during a write is not a tested backup procedure. This guide does not provision a host, domain, certificate, identity proxy, or backup service.
