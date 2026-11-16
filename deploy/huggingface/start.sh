#!/bin/sh
# Runs all four services in one container. If any exits, the container exits
# so the platform restarts it.
export AUTH_SERVICE="http://127.0.0.1:8001"
export CHAT_SERVICE="http://127.0.0.1:8002"
export AGENT_SERVICE="http://127.0.0.1:8003"

(cd /app/services/auth  && PORT=8001 node index.js) &
(cd /app/services/chat  && PORT=8002 node index.js) &
(cd /app/services/agent && PORT=8003 node index.js) &
(cd /app/gateway        && PORT=8000 node index.js) &

# POSIX sh has no `wait -n`; poll until any child dies.
while [ "$(jobs -p | wc -l)" -ge 4 ]; do sleep 5; done
echo "A service exited, stopping container" >&2
exit 1
