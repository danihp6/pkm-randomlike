#!/usr/bin/env bash

# Attempts at the Always Free Ampere instance, for the GitHub driver to call on a
# schedule. It is deliberately dumb: no state, no bookkeeping, one `launch` call per
# attempt, and an exit code. The wait is the workflow's job.
#
# A run makes several attempts by itself (`ATTEMPTS`, `ATTEMPT_SLEEP`, `THROTTLE_SLEEP`,
# `BUDGET`) because the schedule is only a request: measured on this repository a `*/30`
# cron fired three times in six hours, so a run that attempts once is a run that mostly
# did nothing. The cadence that matters lives inside the job; the cron only restarts it.
#
# The spacing is not taste. Oracle answers `TooManyRequests` ("too many requests for the
# user") when launch attempts come faster than its rate limiter likes: measured here, one
# attempt every ~2 min 30 s got 5 of 10 throttled, and the practical floor reported by
# people doing the same wait is ~5 minutes between launches. So a capacity answer costs
# `ATTEMPT_SLEEP` (~3 min plus the call's own ~100 s) and a throttle costs
# `THROTTLE_SLEEP` (5 min) instead of hammering the limiter back.
#
# Auth is the environment form the OCI CLI understands, so nothing is written to disk:
#   OCI_CLI_USER, OCI_CLI_FINGERPRINT, OCI_CLI_TENANCY, OCI_CLI_REGION,
#   OCI_CLI_KEY_CONTENT
# the placement:
#   COMPARTMENT_ID, SUBNET_ID, IMAGE_ID, AD
# and the only thing that makes the instance usable once it exists:
#   SSH_PUBLIC_KEY  the public half, injected as `ssh_authorized_keys` metadata. Without it
#                   the slot would be spent on a box nobody can log into, so it is
#                   required and the run fails loudly instead of launching blind.
#
# Knobs, all optional:
#   ATTEMPTS        attempts this invocation makes (default 1 — the laptop loop calls it
#                   once per wake-up and brings its own cadence)
#   ATTEMPT_SLEEP   seconds to wait after a capacity answer (default 60)
#   THROTTLE_SLEEP  seconds to wait after a `TooManyRequests` (default 300)
#   START_DELAY     seconds before the first attempt (default 0). A chained run starts the
#                   moment the previous one ends, so without it the last attempt of one run
#                   and the first of the next land ~1 minute apart and the limiter sees two
#                   launches back to back — the exact pattern that earns a 429.
#   BUDGET          seconds the attempt loop may spend before handing the wait back to the
#                   schedule, so a job is never killed mid-launch (default 2400)

set -uo pipefail
export SUPPRESS_LABEL_WARNING=True

need() {
  local name
  for name in "$@"; do
    [ -n "${!name:-}" ] || { echo "error: $name is empty" >&2; exit 2; }
  done
}

need OCI_CLI_USER OCI_CLI_FINGERPRINT OCI_CLI_TENANCY OCI_CLI_REGION OCI_CLI_KEY_CONTENT \
  COMPARTMENT_ID SUBNET_ID IMAGE_ID AD
if [ -z "${SSH_PUBLIC_KEY:-}" ]; then
  echo "error: SSH_PUBLIC_KEY is empty — set the repository variable OCI_SSH_PUBLIC_KEY to" >&2
  echo "the public half of the key you will log in with; a slot without it is unusable." >&2
  exit 2
fi
command -v oci >/dev/null || { echo "error: the OCI CLI is not installed" >&2; exit 2; }

name=${INSTANCE_NAME:-pkm-autopilot}
out=${GITHUB_OUTPUT:-/dev/null}
attempts=${ATTEMPTS:-1}
pause=${ATTEMPT_SLEEP:-60}
throttle=${THROTTLE_SLEEP:-300}
delay=${START_DELAY:-0}
budget=${BUDGET:-2400}
started=$SECONDS
throttled=0
# Fixed once, so a run of attempts is a strict 4/24 → 2/12 → 1/6 rotation; the wall clock
# still moves the starting point between one-attempt invocations (the laptop's cadence).
start_minute=$((10#$(date -u +%M)))

emit() {
  [ "$out" = /dev/null ] || printf '%s=%s\n' "$1" "$2" >> "$out"
}

public_ip() {
  local ip
  ip=$(oci compute instance list-vnics --instance-id "$1" \
    --query 'data[0]."public-ip"' --raw-output 2>/dev/null || true)
  [ "$ip" = null ] && ip=
  printf '%s' "$ip"
}

shape_of() {
  local ocpus gb
  ocpus=$(oci compute instance get --instance-id "$1" \
    --query 'data."shape-config".ocpus' --raw-output 2>/dev/null || true)
  gb=$(oci compute instance get --instance-id "$1" \
    --query 'data."shape-config".memoryInGBs' --raw-output 2>/dev/null || true)
  [ -n "$ocpus" ] && [ "$ocpus" != null ] && printf '%s/%s' "$ocpus" "$gb"
}

# Parking is by observation, not by state: an instance already RUNNING is the answer this
# run would have produced, so it hands back its id, its address and its size and stops
# attempting. `shape_of` is what a run that arrives *after* the slot opened announces with.
park() {
  echo "already running: $1"
  emit id "$1"
  emit ip "$(public_ip "$1")"
  emit shape "$(shape_of "$1")"
  exit 0
}

running_id() {
  oci compute instance list --compartment-id "$COMPARTMENT_ID" \
    --display-name "$name" --lifecycle-state RUNNING \
    --query 'data[0].id' --raw-output 2>/dev/null || true
}

# A chained run starts seconds after the previous one ended, at the tail of its last
# `launch` call. Waiting here is what keeps the limiter from seeing two launches a minute
# apart; the delay is charged to the budget like any other wait.
first=$(running_id)
if [ -n "$first" ] && [ "$first" != null ]; then
  park "$first"
fi
if [ "$delay" -gt 0 ]; then
  echo "waiting ${delay}s before the first attempt: the previous run may have just launched"
  sleep "$delay"
fi

for attempt in $(seq 1 "$attempts"); do
  existing=$(running_id)
  if [ -n "$existing" ] && [ "$existing" != null ]; then
    park "$existing"
  fi

  # The request rotates per attempt, so every run covers all three sizes: a smaller shape
  # fits on a host that a 4-OCPU request cannot.
  case $(( (start_minute + attempt - 1) % 3 )) in
    0) ocpus=4; gb=24 ;;
    1) ocpus=2; gb=12 ;;
    *) ocpus=1; gb=6 ;;
  esac
  echo "attempt $attempt/$attempts: ${ocpus} OCPU / ${gb} GB in $AD"

  err=$(mktemp)
  id=$(oci compute instance launch --compartment-id "$COMPARTMENT_ID" \
    --availability-domain "$AD" --shape VM.Standard.A1.Flex \
    --shape-config "{\"ocpus\":$ocpus,\"memoryInGBs\":$gb}" \
    --image-id "$IMAGE_ID" --subnet-id "$SUBNET_ID" \
    --assign-public-ip true --display-name "$name" \
    --boot-volume-size-in-gbs 100 \
    --metadata "{\"ssh_authorized_keys\":\"$SSH_PUBLIC_KEY\"}" \
    --query 'data.id' --raw-output 2>"$err")
  status=$?

  if [ "$status" -ne 0 ] || [ -z "$id" ] || [ "$id" = null ]; then
    detail=$(tr '\n' ' ' < "$err" | cut -c1-300)
    code=$(printf '%s' "$detail" | sed -n 's/.*"code": *"\([A-Za-z]*\)".*/\1/p' | head -n 1)
    rm -f "$err"
    case "$code" in
      TooManyRequests)
        throttled=$((throttled + 1))
        echo "rate-limited by Oracle: $detail"
        wait=$throttle
        ;;
      OutOfHostCapacity | InternalError)
        echo "no capacity yet: $detail"
        wait=$pause
        ;;
      *)
        case "$detail" in
          *"Out of host capacity"* | *OutOfHostCapacity*)
            echo "no capacity yet: $detail"
            wait=$pause
            ;;
          *)
            echo "error: $detail" >&2
            exit 1
            ;;
        esac
        ;;
    esac

    # A sleep that would outlive the budget is the schedule's job, not a killed job's: the
    # next run picks the wait up a few minutes later.
    if [ $(( SECONDS - started + wait )) -ge "$budget" ]; then
      echo "budget spent after $attempt attempt(s); the next run picks the wait up"
      exit 0
    fi
    sleep "$wait"
    continue
  fi
  rm -f "$err"
  echo "launched $id (${ocpus} OCPU / ${gb} GB)"
  emit id "$id"
  emit shape "${ocpus}/${gb}"

  # The IP is what makes the instance usable, so the job waits for it rather than
  # handing back an id somebody has to chase.
  for _ in $(seq 1 30); do
    state=$(oci compute instance get --instance-id "$id" --query 'data."lifecycle-state"' --raw-output 2>/dev/null || true)
    [ "$state" = RUNNING ] && break
    sleep 10
  done
  ip=$(public_ip "$id")
  echo "state=$state ip=${ip:-unknown} shape=${ocpus}/${gb}"
  emit ip "$ip"

  { echo "### A slot opened"; echo; echo "- instance: \`$id\`"; echo "- shape: ${ocpus} OCPU / ${gb} GB"; echo "- ip: \`${ip:-unknown}\`"; } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
done

# Running out of attempts is the expected answer for now: the region is full, not broken.
# Exiting non-zero here would paint the runs list red for a wait that is going fine.
echo "no capacity in $attempts attempt(s), $throttled of them throttled; the next run picks the wait up"
{ echo "### No slot yet"; echo; echo "- attempts: $attempts"; echo "- throttled: $throttled"; echo "- the run hands the wait to the next one"; } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
exit 0
