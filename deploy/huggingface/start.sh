#!/bin/bash
# Runs all four services in one container. If any exits, the container exits
# so the platform restarts it.
export AUTH_SERVICE="http://127.0.0.1:8001"
export CHAT_SERVICE="http://127.0.0.1:8002"
export AGENT_SERVICE="http://127.0.0.1:8003"

(cd /app/services/auth  && PORT=8001 exec node index.js) &
(cd /app/services/chat  && PORT=8002 exec node index.js) &
(cd /app/services/agent && PORT=8003 exec node index.js) &
(cd /app/gateway        && PORT=8000 exec node index.js) &

# Block until the first child exits (bash 4.3+), then stop everything.
wait -n
code=$?
echo "A service exited with code $code, stopping container" >&2
kill 0 2>/dev/null
exit "$code"
