#!/usr/bin/env bash

# Attempts at the Always Free Ampere instance, for the GitHub driver to call on a
# schedule. It is deliberately dumb: no state, no bookkeeping, one `launch` call per
# attempt, and an exit code. The wait is the workflow's job.
#
# A run makes several attempts by itself (`ATTEMPTS`, `ATTEMPT_SLEEP`) because the
# schedule is only a request: measured on this repository a `*/30` cron fired three times
# in six hours, so a run that attempts once is a run that mostly did nothing. The cadence
# that matters lives inside the job; the cron only restarts it.
#
# Auth is the environment form the OCI CLI understands, so nothing is written to disk:
#   OCI_CLI_USER, OCI_CLI_FINGERPRINT, OCI_CLI_TENANCY, OCI_CLI_REGION,
#   OCI_CLI_KEY_CONTENT
# and the placement:
#   COMPARTMENT_ID, SUBNET_ID, IMAGE_ID, AD
#
# Knobs, both optional:
#   ATTEMPTS        attempts this invocation makes (default 1 — the laptop loop calls it
#                   once per wake-up and brings its own cadence)
#   ATTEMPT_SLEEP   seconds between failed attempts (default 60)

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
command -v oci >/dev/null || { echo "error: the OCI CLI is not installed" >&2; exit 2; }

name=${INSTANCE_NAME:-pkm-autopilot}
out=${GITHUB_OUTPUT:-/dev/null}
attempts=${ATTEMPTS:-1}
pause=${ATTEMPT_SLEEP:-60}

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

for attempt in $(seq 1 "$attempts"); do
  existing=$(oci compute instance list --compartment-id "$COMPARTMENT_ID" \
    --display-name "$name" --lifecycle-state RUNNING \
    --query 'data[0].id' --raw-output 2>/dev/null || true)
  if [ -n "$existing" ] && [ "$existing" != null ]; then
    park "$existing"
  fi

  # The request rotates, so a run of attempts covers all three sizes: a smaller shape fits
  # on a host that a 4-OCPU request cannot. The attempt number is folded in because the
  # launch call can outlast the minute it started in.
  case $(( (10#$(date -u +%M) + attempt - 1) % 3 )) in
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
    --query 'data.id' --raw-output 2>"$err")
  status=$?

  if [ "$status" -ne 0 ] || [ -z "$id" ] || [ "$id" = null ]; then
    detail=$(tr '\n' ' ' < "$err" | cut -c1-300)
    rm -f "$err"
    case "$detail" in
      *OutOfHostCapacity* | *"Out of host capacity"* | *TooManyRequests* | *InternalError*)
        echo "no capacity yet: $detail"
        [ "$attempt" -lt "$attempts" ] && sleep "$pause"
        continue
        ;;
      *)
        echo "error: $detail" >&2
        exit 1
        ;;
    esac
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
echo "no capacity in $attempts attempt(s); the next run picks the wait up"
exit 0
