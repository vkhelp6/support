#!/usr/bin/env python3
"""relay.py <task_id> [header] [timeout_s]

Edit-in-place VK progress relay. Sends ONE VK message and edits it as the
subagent appends steps to bus:progress:<id>, then finalizes it to the result.
Subagent must APPEND steps (RPUSH bus:progress:<id>), per bus:protocol >= 1.3.
"""
import os, sys, json, time, random, urllib.request, urllib.parse

U = os.environ["UPSTASH_REDIS_REST_URL"].rstrip("/")
T = os.environ["UPSTASH_REDIS_REST_TOKEN"]
VK = os.environ["VK_TOKEN"]
PEER = int(os.environ.get("VK_PEER", "855180634"))
GROUP = os.environ.get("VK_GROUP", "239562234")

TID = sys.argv[1]
HEADER = sys.argv[2] if len(sys.argv) > 2 else f"Задача {TID[-6:]}"
TIMEOUT = int(sys.argv[3]) if len(sys.argv) > 3 else 600


def r(*c):
    req = urllib.request.Request(U, data=json.dumps(list(c)).encode(),
                                 headers={"Authorization": f"Bearer {T}"}, method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=15).read()).get("result")


def vk(method, **params):
    params.update({"access_token": VK, "v": "5.199", "group_id": GROUP})
    q = urllib.parse.urlencode(params)
    return json.loads(urllib.request.urlopen(f"https://api.vk.com/method/{method}?{q}", timeout=20).read())


def line_of(x):
    try:
        o = json.loads(x); return o.get("msg") or o.get("line") or str(x)
    except Exception:
        return x


def body(steps, status_line):
    txt = f"\U0001f6e0 {HEADER}\n"
    for s in steps:
        txt += f"\n\u2022 {s}"
    if status_line:
        txt += f"\n\n{status_line}"
    return txt


def main():
    send = vk("messages.send", peer_id=PEER, random_id=random.randint(1, 2**31),
              message=body([], "\u23f3 запущена…"))
    mid = send.get("response")
    if not isinstance(mid, int):
        print("send failed:", send); return
    steps = []
    last_body = None
    deadline = time.time() + TIMEOUT
    while time.time() < deadline:
        if r("TYPE", f"bus:progress:{TID}") == "list":
            cur = [line_of(x) for x in (r("LRANGE", f"bus:progress:{TID}", "0", "-1") or [])]
            steps = cur
        res = r("GET", f"bus:result:{TID}")
        if res:
            d = json.loads(res)
            tail = (d.get("summary") or d.get("status") or "")
            fin = body(steps, f"\u2705 Готово: {tail}")
            out = d.get("output") or ""
            if out and len(fin) + len(out) < 3500:
                fin += f"\n\n{out}"
            vk("messages.edit", peer_id=PEER, message_id=mid, message=fin, keep_forward_messages=1)
            print("FINAL relayed"); return
        nb = body(steps, "\u23f3 выполняется…")
        if nb != last_body:
            vk("messages.edit", peer_id=PEER, message_id=mid, message=nb, keep_forward_messages=1)
            last_body = nb
        time.sleep(5)
    vk("messages.edit", peer_id=PEER, message_id=mid,
       message=body(steps, "\u26a0\ufe0f истёк таймаут ожидания результата"), keep_forward_messages=1)
    print("timeout")


if __name__ == "__main__":
    main()
