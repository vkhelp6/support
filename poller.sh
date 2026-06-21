#!/bin/bash
# VK poller v2: detects unanswered messages, INSTANTLY acks the sender (so the
# user gets feedback within one poll), stores mid/peer for edit-in-place, then
# exits to wake the coordinator. ~4s cadence, ~20 min window.
G=239562234
ACK="🤔 Принял, думаю над ответом… (обновлю это сообщение)"
for i in $(seq 1 300); do
  resp=$(curl -s -m 15 "https://api.vk.com/method/messages.getConversations?filter=unanswered&count=10&group_id=$G&access_token=$VK_TOKEN&v=5.199")
  cnt=$(echo "$resp" | python3 -c "import sys,json;print(json.load(sys.stdin).get('response',{}).get('count','ERR'))" 2>/dev/null)
  ts=$(date '+%H:%M:%S')
  if [ "$cnt" != "0" ] && [ -n "$cnt" ] && [ "$cnt" != "ERR" ]; then
    peer=$(echo "$resp" | python3 -c "import sys,json;print(json.load(sys.stdin)['response']['items'][0]['last_message']['from_id'])")
    echo "[$ts] NEW_MESSAGES count=$cnt"
    echo "$resp" | python3 -c "import sys,json;[print('PEER',it['last_message']['from_id'],'TEXT',it['last_message']['text']) for it in json.load(sys.stdin)['response']['items']]"
    mid=$(curl -s -m 15 -G "https://api.vk.com/method/messages.send" \
      --data-urlencode "peer_id=$peer" --data-urlencode "random_id=$RANDOM$RANDOM" \
      --data-urlencode "group_id=$G" --data-urlencode "message=$ACK" \
      --data-urlencode "access_token=$VK_TOKEN" --data-urlencode "v=5.199" \
      | python3 -c "import sys,json;print(json.load(sys.stdin).get('response',''))")
    echo "ACK_MID $mid PEER $peer"
    echo "$mid" > /tmp/vk_reply_mid; echo "$peer" > /tmp/vk_reply_peer
    exit 0
  fi
  if [ "$cnt" = "ERR" ]; then echo "[$ts] API_ERR $resp"; fi
  echo "[$ts] poll $i count=$cnt"
  sleep 4
done
echo "POLLER_DONE_NO_NEW"
