#!/usr/bin/env bash
# Source this file in GitHub Actions. It configures token-based HTTPS auth
# without placing the Gitee token in a remote URL or command output.
set -euo pipefail
: "${GITEE_ACCESS_TOKEN:?GITEE_ACCESS_TOKEN is required}"
GITEE_ASKPASS="${RUNNER_TEMP:-/tmp}/z3cz-gitee-askpass.sh"
cat >"$GITEE_ASKPASS" <<'EOF'
#!/usr/bin/env bash
case "${1:-}" in
  *Username*) printf '%s\n' "daotuke" ;;
  *) printf '%s\n' "$GITEE_ACCESS_TOKEN" ;;
esac
EOF
chmod 700 "$GITEE_ASKPASS"
export GIT_ASKPASS="$GITEE_ASKPASS"
export GIT_TERMINAL_PROMPT=0
export GITEE_REPOSITORY_URL="https://gitee.com/daotuke/z3cz.git"

