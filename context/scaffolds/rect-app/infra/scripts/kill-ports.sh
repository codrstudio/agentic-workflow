#!/usr/bin/env bash
# Kill processes listening on FRONTEND_PORT and BACKEND_PORT
for p in $FRONTEND_PORT $BACKEND_PORT; do
  pid=$(netstat -ano 2>/dev/null | grep ":$p " | grep LISTEN | awk '{print $5}' | head -1)
  if [ -n "$pid" ] && [ "$pid" != "0" ]; then
    taskkill //F //PID "$pid" > /dev/null 2>&1 && echo "killed :$p (PID $pid)"
  else
    echo "free :$p"
  fi
done
