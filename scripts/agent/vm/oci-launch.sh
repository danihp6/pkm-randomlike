#!/usr/bin/env bash

# One attempt at the Always Free Ampere instance, for the GitHub driver to call on a
# schedule. It is deliberately dumb: no state, no retries of its own, one API call and
# an exit code. The cadence lives in the workflow, the decision to keep waiting lives
# with whoever owns the brake.
#
# Auth is the environment form the OCI CLI understands, so nothing is written to disk:
#   OCI_CLI_USER, OCI_CLI_FINGERPRINT, OCI_CLI_TENANCY, OCI_CLI_REGION,
#   OCI_CLI_KEY_CONTENT
# and the placement:
#   COMPARTMENT_ID, SUBNET_ID, IMAGE_ID, AD

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

emit() {
  [ "$out" = /dev/null ] || printf '%s=%s\n' "$1" "$2" >> "$out"
}

existing=$(oci compute instance list --compartment-id "$COMPARTMENT_ID" \
  --display-name "$name" --lifecycle-state RUNNING \
  --query 'data[0].id' --raw-output 2>/dev/null || true)
if [ -n "$existing" ] && [ "$existing" != null ]; then
  echo "already running: $existing"
  emit id "$existing"
  exit 0
fi

# The request rotates with the minute, so a */10 schedule covers all three sizes in
# half an hour: a smaller shape fits on a host that a 4-OCPU request cannot.
case $((10#$(date -u +%M) % 3)) in
  0) ocpus=4; gb=24 ;;
  1) ocpus=2; gb=12 ;;
  *) ocpus=1; gb=6 ;;
esac
echo "attempting ${ocpus} OCPU / ${gb} GB in $AD"

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
      exit 0
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

# The IP is what makes the instance usable, so the job waits for it rather than
# handing back an id somebody has to chase.
for _ in $(seq 1 30); do
  state=$(oci compute instance get --instance-id "$id" --query 'data."lifecycle-state"' --raw-output 2>/dev/null || true)
  [ "$state" = RUNNING ] && break
  sleep 10
done
ip=$(oci compute instance list-vnics --instance-id "$id" --query 'data[0]."public-ip"' --raw-output 2>/dev/null || true)
echo "state=$state ip=${ip:-unknown} shape=${ocpus}/${gb}"
emit ip "$ip"
emit shape "${ocpus}/${gb}"

{ echo "### A slot opened"; echo; echo "- instance: \`$id\`"; echo "- shape: ${ocpus} OCPU / ${gb} GB"; echo "- ip: \`${ip:-unknown}\`"; } >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
