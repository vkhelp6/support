#!/usr/bin/env python3
"""busredis.py — Redis (Upstash REST) bus helper for the VK coordinator.

Bus keys:
  bus:pending        LIST   task ids (LPUSH left, take from right => RPOP) FIFO
  bus:task:<id>      STRING JSON task {id,title,prompt,created_by,created_at}
  bus:claimed        LIST   ids taken into work
  bus:claim:<id>     STRING {agent,ts}  EX 1800 (expires => task stalled)
  bus:result:<id>    STRING JSON result {status,output,files_changed}
  bus:done           LIST   finished ids
  bus:agent:<aid>    STRING heartbeat   EX 120 (dead agent disappears)
  bus:control:stop   STRING "1"/"0"     global stop switch

Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

CLI:
  add "<title>" "<prompt>" [--id ID]   create task -> prints id
  result <id>                          print result JSON (or empty)
  stop [0|1]                           set/read global stop switch
  peek                                 snapshot of the whole bus
  claim <agent_id>                     claim next task -> prints task JSON
  done <id> <status> "<output>"        post result + push to bus:done
  heartbeat <agent_id> [ttl]           refresh bus:agent:<aid>
  worker <agent_id>                    loop: claim -> print task (executor runs it)
"""
import json
import os
import sys
import time
import urllib.request

URL = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")


def r(*cmd):
    """Run a single Redis command over the Upstash REST API."""
    if not URL or not TOKEN:
        raise SystemExit("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set")
    body = json.dumps(list(cmd)).encode()
    req = urllib.request.Request(
        URL,
        data=body,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode())
    if "error" in data:
        raise RuntimeError(data["error"])
    return data.get("result")


def now():
    return int(time.time())


def add(title, prompt, task_id=None):
    task_id = task_id or f"t-{now()}-{os.getpid()}"
    task = {
        "id": task_id,
        "title": title,
        "prompt": prompt,
        "created_by": "main",
        "created_at": now(),
    }
    r("SET", f"bus:task:{task_id}", json.dumps(task, ensure_ascii=False))
    r("LPUSH", "bus:pending", task_id)
    return task_id


def get_result(task_id):
    return r("GET", f"bus:result:{task_id}")


def set_stop(val=None):
    if val is None:
        return r("GET", "bus:control:stop")
    r("SET", "bus:control:stop", str(val))
    return str(val)


def claim(agent_id):
    """Take the oldest pending task and mark it claimed (EX 1800)."""
    task_id = r("RPOP", "bus:pending")
    if not task_id:
        return None
    r("LPUSH", "bus:claimed", task_id)
    r(
        "SET",
        f"bus:claim:{task_id}",
        json.dumps({"agent": agent_id, "ts": now()}),
        "EX",
        "1800",
    )
    raw = r("GET", f"bus:task:{task_id}")
    return json.loads(raw) if raw else {"id": task_id}


def done(task_id, status, output, files_changed=None):
    result = {
        "status": status,
        "output": output,
        "files_changed": files_changed or [],
        "finished_at": now(),
    }
    r("SET", f"bus:result:{task_id}", json.dumps(result, ensure_ascii=False))
    r("LPUSH", "bus:done", task_id)
    r("DEL", f"bus:claim:{task_id}")
    return result


def heartbeat(agent_id, ttl=120):
    r("SET", f"bus:agent:{agent_id}", str(now()), "EX", str(ttl))


def progress(task_id, line, ttl=900):
    """Append a human-readable progress line for a task (main relays it to VK)."""
    r("RPUSH", f"bus:progress:{task_id}", line)
    r("EXPIRE", f"bus:progress:{task_id}", str(ttl))
    return line


def read_progress(task_id, start=0):
    """Return progress lines from index `start` onward (chronological)."""
    return r("LRANGE", f"bus:progress:{task_id}", str(start), "-1") or []


def renew_claim(task_id, agent_id, ttl=1800):
    """Extend a claim on a long-running task so it is not considered stalled."""
    r(
        "SET",
        f"bus:claim:{task_id}",
        json.dumps({"agent": agent_id, "ts": now()}),
        "EX",
        str(ttl),
    )


def peek():
    snap = {
        "stop": r("GET", "bus:control:stop"),
        "pending": r("LRANGE", "bus:pending", "0", "-1") or [],
        "claimed": r("LRANGE", "bus:claimed", "0", "-1") or [],
        "done": r("LRANGE", "bus:done", "0", "-1") or [],
        "agents": r("KEYS", "bus:agent:*") or [],
    }
    return snap


def requeue_stalled():
    """Re-queue claimed ids whose claim expired and have no result."""
    requeued = []
    for task_id in r("LRANGE", "bus:claimed", "0", "-1") or []:
        if r("GET", f"bus:claim:{task_id}"):
            continue
        if r("GET", f"bus:result:{task_id}"):
            continue
        r("LPUSH", "bus:pending", task_id)
        requeued.append(task_id)
    return requeued


def worker(agent_id, idle_sleep=5):
    """Claim tasks in a loop and print them for an external executor.

    This helper does NOT run the task itself — the subagent/executor that
    invokes it is responsible for doing the work and calling `done`.
    """
    print(f"worker {agent_id} online", flush=True)
    while True:
        if str(r("GET", "bus:control:stop") or "0") == "1":
            print("stop switch set, worker exiting", flush=True)
            return
        heartbeat(agent_id)
        task = claim(agent_id)
        if task:
            print(json.dumps(task, ensure_ascii=False), flush=True)
            return  # hand one task to the executor; relaunch for the next
        time.sleep(idle_sleep)


def _main(argv):
    if not argv:
        print(__doc__)
        return
    cmd, rest = argv[0], argv[1:]
    if cmd == "add":
        task_id = None
        if "--id" in rest:
            i = rest.index("--id")
            task_id = rest[i + 1]
            rest = rest[:i] + rest[i + 2:]
        title, prompt = rest[0], rest[1]
        print(add(title, prompt, task_id))
    elif cmd == "result":
        print(get_result(rest[0]) or "")
    elif cmd == "stop":
        print(set_stop(rest[0] if rest else None))
    elif cmd == "peek":
        print(json.dumps(peek(), ensure_ascii=False, indent=2))
    elif cmd == "claim":
        print(json.dumps(claim(rest[0]), ensure_ascii=False))
    elif cmd == "done":
        print(json.dumps(done(rest[0], rest[1], rest[2]), ensure_ascii=False))
    elif cmd == "heartbeat":
        heartbeat(rest[0], int(rest[1]) if len(rest) > 1 else 120)
        print("ok")
    elif cmd == "progress":
        print(progress(rest[0], rest[1]))
    elif cmd == "renew":
        renew_claim(rest[0], rest[1])
        print("ok")
    elif cmd == "requeue":
        print(json.dumps(requeue_stalled(), ensure_ascii=False))
    elif cmd == "worker":
        worker(rest[0])
    else:
        print(f"unknown command: {cmd}")
        print(__doc__)


if __name__ == "__main__":
    _main(sys.argv[1:])
