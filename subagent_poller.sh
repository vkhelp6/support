#!/bin/bash
# subagent_poller.sh <agent_id>
# Mirror of the VK poller, but for subagents: polls the Redis bus for a task.
# On finding one it ATOMICALLY claims it (RPOP), records the claim (EX 1800),
# refreshes its heartbeat (bus:agent:<id> EX 120), prints the task JSON and
# exits 0 -> which wakes the subagent. The subagent then does the work and
# posts the result with:  python3 busredis.py done <id> <status> "<output>"
# Run this right before the subagent's internal pause, then relaunch it after
# handling each task. Respects the global stop switch bus:control:stop.
AID="${1:-sub-$$}"
export AID
for i in $(seq 1 120); do
  out=$(python3 - <<'PY'
import os, json, time, urllib.request
U = os.environ["UPSTASH_REDIS_REST_URL"].rstrip("/")
T = os.environ["UPSTASH_REDIS_REST_TOKEN"]
AID = os.environ["AID"]
def r(*c):
    req = urllib.request.Request(
        U, data=json.dumps(list(c)).encode(),
        headers={"Authorization": f"Bearer {T}"}, method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=15).read()).get("result")
if str(r("GET", "bus:control:stop") or "0") == "1":
    print("STOP"); raise SystemExit
r("SET", f"bus:agent:{AID}", str(int(time.time())), "EX", "120")   # heartbeat
tid = r("RPOP", "bus:pending")                                      # atomic claim
if tid:
    r("LPUSH", "bus:claimed", tid)
    r("SET", f"bus:claim:{tid}", json.dumps({"agent": AID, "ts": int(time.time())}), "EX", "1800")
    print("NEW_TASK " + tid)
    print(r("GET", f"bus:task:{tid}") or "")
else:
    print("notask")
PY
)
  ts=$(date '+%H:%M:%S')
  case "$out" in
    STOP*)     echo "[$ts] STOP switch set, exiting"; exit 0;;
    NEW_TASK*) echo "[$ts] ${out}"; exit 0;;
    *)         echo "[$ts] poll $i no-task";;
  esac
  sleep 10
done
echo "POLLER_DONE_NO_TASK"
