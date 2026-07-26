# Persist Worker

Pull-based Linux worker for server-side generation job persist.

## Environment

- `API_BASE_URL` — API origin, e.g. `https://api.example.com`
- `WORKER_ID` — worker id from Admin → Persist Workers
- `WORKER_SECRET` — secret shown once at worker creation
- `POLL_INTERVAL_MS` — optional, default `5000`

## Run

```bash
pnpm --filter @dafthunk/persist-worker start
```

## systemd example

```ini
[Service]
Environment=API_BASE_URL=https://api.example.com
Environment=WORKER_ID=tokyo-1
Environment=WORKER_SECRET=...
ExecStart=/usr/bin/node /opt/dafthunk/apps/persist-worker/src/index.ts
Restart=always
```

Use `tsx` or compile to JS for production.
