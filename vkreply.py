#!/usr/bin/env python3
"""vkreply.py — manage ONE VK reply message that goes ack -> status -> answer.
Uses /tmp/vk_reply_mid and /tmp/vk_reply_peer (written by the poller on detect).
  ack  "<text>"   send a fresh ack message, store mid/peer, print mid
  edit "<text>"   edit the stored message (status update or final answer)
"""
import os, sys, json, random, urllib.request, urllib.parse

VK = os.environ["VK_TOKEN"]
GROUP = os.environ.get("VK_GROUP", "239562234")
MID_F = "/tmp/vk_reply_mid"
PEER_F = "/tmp/vk_reply_peer"


def vk(method, **p):
    p.update({"access_token": VK, "v": "5.199", "group_id": GROUP})
    return json.loads(urllib.request.urlopen(
        f"https://api.vk.com/method/{method}?{urllib.parse.urlencode(p)}", timeout=20).read())


def main():
    cmd, text = sys.argv[1], sys.argv[2]
    if cmd == "ack":
        peer = int(open(PEER_F).read()) if os.path.exists(PEER_F) else int(os.environ.get("VK_PEER", "855180634"))
        m = vk("messages.send", peer_id=peer, random_id=random.randint(1, 2**31), message=text)
        open(MID_F, "w").write(str(m["response"]))
        print(m["response"])
    elif cmd == "edit":
        peer = int(open(PEER_F).read())
        mid = int(open(MID_F).read())
        print(vk("messages.edit", peer_id=peer, message_id=mid, message=text, keep_forward_messages=1))


if __name__ == "__main__":
    main()
