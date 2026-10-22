# The VM host of the autopilot

One always-on Linux box runs the loop the GitHub workflows used to run. Start with
`docs/agent-vm.md`; this folder is only the code.

| File | Role |
| --- | --- |
| `run-driver.sh` | The loop: gate, then a cycle, then a short breath; runs as the systemd service. |
| `run-cycle.sh` | One cycle end to end, under a lock: fetch, reset, assets, recon, orchestrator, gate, verdict, ledger. |
| `gate.mjs` | Pure decision: brake, window, backlog, red streak, cap. |
| `verdict.mjs` | Pure outcome: red gate fails, a moved `main` or an opened issue is green. |
| `brake.sh` | The brake by hand or by window, plus `status` and `reset`. |
| `prompt.md` | The Orchestrator's prompt, shared verbatim with `agent-cycle.yml`. |
| `install.sh` | Bootstrap of the host and the systemd unit. |
| `oci-launch.sh` | Attempts at the Always Free instance for the CI retry: `ATTEMPTS` attempts, `ATTEMPT_SLEEP` apart, env-var auth, no state. |
| `pkm-agent-driver.service.in` | The unit template `install.sh` fills in. |
| `agent.env.example` | The credentials and paths template, copied to `$PKM_AGENT_STATE/env`. |
| `gate.test.mjs`, `verdict.test.mjs` | The unit tests behind both decisions. |
