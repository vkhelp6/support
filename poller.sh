#!/bin/bash
for i in $(seq 1 120); do
  resp=$(curl -s -m 15 "https://api.vk.com/method/messages.getConversations?filter=unanswered&count=10&group_id=239562234&access_token=$VK_TOKEN&v=5.199")
  cnt=$(echo "$resp" | python3 -c "import sys,json;print(json.load(sys.stdin).get('response',{}).get('count','ERR'))" 2>/dev/null)
  ts=$(date '+%H:%M:%S')
  if [ "$cnt" != "0" ] && [ -n "$cnt" ] && [ "$cnt" != "ERR" ]; then
    echo "[$ts] NEW_MESSAGES count=$cnt"
    echo "$resp" | python3 -c "import sys,json;[print('PEER',it['last_message']['from_id'],'TEXT',it['last_message']['text']) for it in json.load(sys.stdin)['response']['items']]"
    exit 0
  fi
  if [ "$cnt" = "ERR" ]; then echo "[$ts] API_ERR $resp"; fi
  echo "[$ts] poll $i count=$cnt"
  sleep 5
done
echo "POLLER_DONE_NO_NEW"
