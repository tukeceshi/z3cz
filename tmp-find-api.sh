#!/bin/sh
for d in /proc/[0-9]*; do
  cmd=$(tr '\0' ' ' < "$d/cmdline" 2>/dev/null) || continue
  case "$cmd" in
    *tsx*|*server.ts*|*watch*)
      echo "$d $cmd"
      ;;
  esac
done
