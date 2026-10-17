# `.github/workflows/`

The CI half of the build. Each file is one pipeline; the roles it plays are in
`AGENTS.md` (the batch lifecycle) and `docs/agent-ci.md` (the autopilot's own
rules). A workflow that can write to `main` is named as such below.

- `ci.yml` — the repo's gate (`npm test` + `npm run build`) on `main` and on pull
  requests. Read-only; it is the required check.
- `agent-smoke.yml` — dispatch-only probe that the credential, the CLI and the
  `opencode-go` model id work on a clean runner. Read-only, no repo side effects.
