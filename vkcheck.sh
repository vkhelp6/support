#!/bin/bash
# One-shot status: VK unanswered (with recent history per peer) + bus state.
G=239562234
resp=$(curl -s -m 20 "https://api.vk.com/method/messages.getConversations?filter=unanswered&count=20&group_id=$G&access_token=$VK_TOKEN&v=5.199")
echo "=== VK unanswered ==="
echo "$resp" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if 'error' in d: print('VK_ERR', d['error']); sys.exit()
items=d['response']['items']
print('count=', d['response'].get('count'))
for it in items:
    print('PEER', it['last_message']['from_id'])
"
peers=$(echo "$resp" | python3 -c "import sys,json;d=json.load(sys.stdin);print(' '.join(str(it['last_message']['from_id']) for it in d.get('response',{}).get('items',[])))" 2>/dev/null)
for p in $peers; do
  echo "--- history peer $p ---"
  curl -s -m 20 "https://api.vk.com/method/messages.getHistory?peer_id=$p&count=10&group_id=$G&access_token=$VK_TOKEN&v=5.199" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if 'error' in d: print('ERR', d['error']); sys.exit()
for m in reversed(d['response']['items']):
    who='USER' if m['from_id']>0 else 'GROUP'
    print(who, m['from_id'], '|', repr(m['text']))
"
done
echo "=== bus ==="
echo -n "agents: "; curl -s -X POST "$UPSTASH_REDIS_REST_URL" -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" -d '["KEYS","bus:agent:*"]'; echo
echo -n "pending: "; curl -s -X POST "$UPSTASH_REDIS_REST_URL" -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" -d '["LRANGE","bus:pending","0","-1"]'; echo
echo -n "claimed: "; curl -s -X POST "$UPSTASH_REDIS_REST_URL" -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" -d '["LRANGE","bus:claimed","0","-1"]'; echo
echo -n "done: "; curl -s -X POST "$UPSTASH_REDIS_REST_URL" -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" -d '["LRANGE","bus:done","0","-1"]'; echo
