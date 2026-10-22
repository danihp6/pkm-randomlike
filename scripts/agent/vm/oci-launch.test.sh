#!/usr/bin/env bash

# Offline checks for `oci-launch.sh`: a fake `oci` on PATH, no network and no credentials.
# It exists because the interesting part of that script is the branch a live run only
# reaches once in a while — the throttle backoff, the time budget, the missing key — and
# each of those was learned the expensive way. `ci.yml` runs it on every gate; by hand:
#
#   bash scripts/agent/vm/oci-launch.test.sh
#
# The real `launch` call is never made: the fake answers from `FAKE_PLAN`, one outcome per
# attempt ("capacity", "throttle", "ok", "boom").

set -u

here=$(cd "$(dirname "$0")" && pwd)
launch=$here/oci-launch.sh
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin"

cat > "$work/bin/oci" <<'FAKE'
#!/usr/bin/env bash
echo "$*" >> "$FAKE_LOG"
case $3 in
  list)       [ "${FAKE_RUNNING:-0}" = 1 ] && echo "ocid1.instance.oc1.running" || echo "null"; exit 0 ;;
  get)        case "$*" in *ocpus*) echo 4 ;; *memoryInGBs*) echo 24 ;; *) echo RUNNING ;; esac; exit 0 ;;
  list-vnics) echo "203.0.113.7"; exit 0 ;;
esac
if [ "$3" = launch ]; then
  n=$(( $(cat "$FAKE_COUNT" 2>/dev/null || echo 0) + 1 ))
  echo "$n" > "$FAKE_COUNT"
  outcome=$(printf '%s\n' "${FAKE_PLAN:-capacity}" | cut -d' ' -f"$n")
  case ${outcome:-capacity} in
    ok) echo "ocid1.instance.oc1.new"; exit 0 ;;
    throttle)
      printf '%s\n' 'ServiceError: {     "code": "TooManyRequests",     "message": "Too many requests for the user" }' >&2
      exit 1 ;;
    boom)
      printf '%s\n' 'ServiceError: {     "code": "NotAuthorizedOrNotFound",     "message": "no such subnet" }' >&2
      exit 1 ;;
    *)
      printf '%s\n' 'ServiceError: {     "code": "InternalError",     "message": "Out of host capacity." }' >&2
      exit 1 ;;
  esac
fi
exit 0
FAKE
chmod +x "$work/bin/oci"

failures=0
fail() { echo "FAIL [$label] $*"; failures=$((failures + 1)); }
want() { printf '%s' "$output" | grep -qF -- "$1" || fail "missing: $1"; }
nope() { printf '%s' "$output" | grep -qF -- "$1" && fail "unexpected: $1"; }

# run <label> <plan> [attempts] [attempt_sleep] [budget] [running] [start_delay]
run() {
  label=$1 plan=$2 attempts=${3:-2} sleep_s=${4:-0} budget=${5:-2400} running=${6:-0} delay=${7:-0}
  : > "$work/out"; : > "$work/summary"; rm -f "$work/count" "$work/calls"
  output=$(env PATH="$work/bin:$PATH" \
    FAKE_LOG=$work/calls FAKE_COUNT=$work/count FAKE_PLAN="$plan" FAKE_RUNNING="$running" \
    GITHUB_OUTPUT=$work/out GITHUB_STEP_SUMMARY=$work/summary \
    OCI_CLI_USER=u OCI_CLI_FINGERPRINT=f OCI_CLI_TENANCY=t OCI_CLI_REGION=r \
    OCI_CLI_KEY_CONTENT=k COMPARTMENT_ID=c SUBNET_ID=s IMAGE_ID=i AD=ad \
    SSH_PUBLIC_KEY="ssh-ed25519 AAAAtest pkm-autopilot" \
    ATTEMPTS="$attempts" ATTEMPT_SLEEP="$sleep_s" THROTTLE_SLEEP=0 BUDGET="$budget" \
    START_DELAY="$delay" \
    bash "$launch" 2>&1)
  status=$?
}

run "capacity only" "capacity capacity capacity" 3
[ "$status" -eq 0 ] || fail "exit $status, expected 0"
want "attempt 1/3"
want "attempt 3/3"
want "4 OCPU / 24 GB"
want "2 OCPU / 12 GB"
want "1 OCPU / 6 GB"
want "no capacity in 3 attempt(s), 0 of them throttled"
nope "rate-limited"
grep -q ssh_authorized_keys "$work/calls" || fail "the launch carried no ssh_authorized_keys"
grep -q '"ssh_authorized_keys":"ssh-ed25519 AAAAtest pkm-autopilot"' "$work/calls" || fail "the key was mangled"

run "throttled then capacity" "throttle capacity" 2
[ "$status" -eq 0 ] || fail "exit $status, expected 0"
want "rate-limited by Oracle"
want "TooManyRequests"
want "no capacity in 2 attempt(s), 1 of them throttled"

run "a slot opens" "capacity ok" 2
[ "$status" -eq 0 ] || fail "exit $status, expected 0"
want "launched ocid1.instance.oc1.new"
want "ip=203.0.113.7"
[ "$(grep -c '^id=ocid1.instance.oc1.new$' "$work/out")" -eq 1 ] || fail "outputs: $(cat "$work/out")"
[ "$(grep -cE '^shape=[1-4]/(6|12|24)$' "$work/out")" -eq 1 ] || fail "shape output: $(cat "$work/out")"
[ "$(grep -c '^ip=203.0.113.7$' "$work/out")" -eq 1 ] || fail "ip output: $(cat "$work/out")"
grep -q "A slot opened" "$work/summary" || fail "no step summary"
grep -q "instance get" "$work/calls" || fail "never waited for the state"

run "already running" "capacity" 2 0 2400 1
[ "$status" -eq 0 ] || fail "exit $status, expected 0"
want "already running: ocid1.instance.oc1.running"
grep -q "shape=4/24" "$work/out" || fail "a parked run did not re-read the size: $(cat "$work/out")"
grep -q "ip=203.0.113.7" "$work/out" || fail "a parked run did not re-read the address"
grep -q launch "$work/calls" && fail "launched again over a running instance"

run "budget stops the loop" "capacity capacity" 5 5 2
[ "$status" -eq 0 ] || fail "exit $status, expected 0"
want "budget spent after 1 attempt(s)"

run "a chained run waits before its first attempt" "capacity" 1 0 2400 0 1
[ "$status" -eq 0 ] || fail "exit $status, expected 0"
want "waiting 1s before the first attempt"

run "an error that is not a wait" "boom" 2
[ "$status" -eq 1 ] || fail "exit $status, expected 1"
want "NotAuthorizedOrNotFound"
nope "no capacity"

label="missing key"
output=$(env PATH="$work/bin:$PATH" FAKE_LOG=$work/calls FAKE_COUNT=$work/count \
  OCI_CLI_USER=u OCI_CLI_FINGERPRINT=f OCI_CLI_TENANCY=t OCI_CLI_REGION=r \
  OCI_CLI_KEY_CONTENT=k COMPARTMENT_ID=c SUBNET_ID=s IMAGE_ID=i AD=ad \
  bash "$launch" 2>&1)
status=$?
[ "$status" -eq 2 ] || fail "exit $status, expected 2"
want "SSH_PUBLIC_KEY is empty"

if [ "$failures" -ne 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "oci-launch.sh: all checks passed"
