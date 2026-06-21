#!/usr/bin/env python3
"""vk_photo.py <peer> <message> <img1> [img2 ...] — send a VK message with photo attachments."""
import os, sys, json, random, urllib.request, urllib.parse, mimetypes, uuid
VK=os.environ["VK_TOKEN"]; GROUP=os.environ.get("VK_GROUP","239562234")
def vk(method, **p):
    p.update({"access_token":VK,"v":"5.199","group_id":GROUP})
    return json.loads(urllib.request.urlopen(f"https://api.vk.com/method/{method}?{urllib.parse.urlencode(p)}", timeout=30).read())
def upload(url, path):
    boundary="----"+uuid.uuid4().hex
    fn=os.path.basename(path); ctype=mimetypes.guess_type(path)[0] or "image/png"
    body=b""
    body+=("--"+boundary+"\r\n").encode()
    body+=(f'Content-Disposition: form-data; name="photo"; filename="{fn}"\r\n').encode()
    body+=(f"Content-Type: {ctype}\r\n\r\n").encode()
    body+=open(path,"rb").read()+b"\r\n"
    body+=("--"+boundary+"--\r\n").encode()
    req=urllib.request.Request(url, data=body, headers={"Content-Type":"multipart/form-data; boundary="+boundary})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())
def main():
    peer=int(sys.argv[1]); msg=sys.argv[2]; imgs=sys.argv[3:]
    atts=[]
    srv=vk("photos.getMessagesUploadServer", peer_id=peer)["response"]["upload_url"]
    for p in imgs:
        up=upload(srv, p)
        saved=vk("photos.saveMessagesPhoto", photo=up["photo"], server=up["server"], hash=up["hash"])["response"][0]
        atts.append(f"photo{saved['owner_id']}_{saved['id']}")
    r=vk("messages.send", peer_id=peer, random_id=random.randint(1,2**31), message=msg, attachment=",".join(atts))
    print(json.dumps(r))
if __name__=="__main__": main()
