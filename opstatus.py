#!/usr/bin/env python3
"""opstatus.py — drive ONE VK message that is edited in place across an operation.
  init "<header>"        -> send message, store mid; reset steps
  step "<line>"          -> append step, edit message (… выполняется)
  sub  "<task_id>"       -> pull NEW subagent progress lines into the steps, edit
  done "<final>" [file]  -> edit to final (✅), optionally append file content
"""
import os, sys, json, time, random, urllib.request, urllib.parse

U = os.environ["UPSTASH_REDIS_REST_URL"].rstrip("/")
T = os.environ["UPSTASH_REDIS_REST_TOKEN"]
VK = os.environ["VK_TOKEN"]
PEER = int(os.environ.get("VK_PEER", "855180634"))
GROUP = os.environ.get("VK_GROUP", "239562234")
MID_F = "/tmp/opmid"; HDR_F = "/tmp/ophdr"; STEPS_F = "/tmp/opsteps"; SUBN_F = "/tmp/opsubn"


def r(*c):
    req = urllib.request.Request(U, data=json.dumps(list(c)).encode(),
                                 headers={"Authorization": f"Bearer {T}"}, method="POST")
    return json.loads(urllib.request.urlopen(req, timeout=15).read()).get("result")


def vk(method, **p):
    p.update({"access_token": VK, "v": "5.199", "group_id": GROUP})
    return json.loads(urllib.request.urlopen(
        f"https://api.vk.com/method/{method}?{urllib.parse.urlencode(p)}", timeout=20).read())


def steps():
    try:
        return json.load(open(STEPS_F))
    except Exception:
        return []


def save(s):
    json.dump(s, open(STEPS_F, "w"))


def body(tail):
    hdr = open(HDR_F).read() if os.path.exists(HDR_F) else "Операция"
    txt = f"\U0001f6e0 {hdr}\n"
    for s in steps():
        txt += f"\n\u2022 {s}"
    if tail:
        txt += f"\n\n{tail}"
    return txt


def edit(tail):
    mid = int(open(MID_F).read())
    vk("messages.edit", peer_id=PEER, message_id=mid, message=body(tail), keep_forward_messages=1)


def line_of(x):
    try:
        o = json.loads(x); return o.get("msg") or o.get("line") or str(x)
    except Exception:
        return x


def main():
    cmd = sys.argv[1]
    if cmd == "init":
        open(HDR_F, "w").write(sys.argv[2]); save([]); open(SUBN_F, "w").write("0")
        m = vk("messages.send", peer_id=PEER, random_id=random.randint(1, 2**31),
               message=body("\u23f3 запускаю…"))
        open(MID_F, "w").write(str(m["response"]))
        print("mid", m["response"])
    elif cmd == "step":
        s = steps(); s.append(sys.argv[2]); save(s); edit("\u23f3 выполняется…")
    elif cmd == "sub":
        tid = sys.argv[2]; n = int(open(SUBN_F).read()) if os.path.exists(SUBN_F) else 0
        lines = r("LRANGE", f"bus:progress:{tid}", "0", "-1") or [] if r("TYPE", f"bus:progress:{tid}") == "list" else []
        s = steps()
        while n < len(lines):
            s.append("(субагент) " + line_of(lines[n])); n += 1
        save(s); open(SUBN_F, "w").write(str(n)); edit("\u23f3 выполняется…")
    elif cmd == "done":
        tail = "\u2705 " + sys.argv[2]
        if len(sys.argv) > 3 and os.path.exists(sys.argv[3]):
            extra = open(sys.argv[3]).read()
            if len(extra) < 3000:
                tail += "\n\n" + extra
        edit(tail)


if __name__ == "__main__":
    main()
