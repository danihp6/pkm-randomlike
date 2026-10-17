# `.github/workflows/`

The CI half of the build. Each file is one pipeline; the roles it plays are in
`AGENTS.md` (the batch lifecycle) and `docs/agent-ci.md` (the autopilot's own
rules, once written). A workflow that can write to `main` is named as such below.

- `ci.yml` — the repo's gate (`npm test` + `npm run build`) on `main` and on pull
  requests. Read-only; it is the required check.
- `agent-smoke.yml` — dispatch-only probe that the credential, the CLI and the
  `opencode-go` model ids work on a clean runner. Read-only, no repo side effects.
- `agent-role-smoke.yml` — dispatch-only probe of the pieces the cycle rests on: a
  roled agent starts headless and loads its prompt, `--auto` lets it use tools, the
  job pushes a throwaway `smoke/role-probe-<run>` branch (deleted at the end), and
  the private asset store is cloned with the deploy key at `ASSETS_COMMIT`. Writes
  only that throwaway branch.
