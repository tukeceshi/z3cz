#!/usr/bin/env bash
# Run from a visible terminal; the user supplies the domain or empty Enter.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
test_dir="$(mktemp -d /tmp/z3cz-manual-interactive.XXXXXX)"
trap 'rm -rf -- "$test_dir"' EXIT
mkdir -p "$test_dir/docker-host"
cp "$ROOT/docker-host/dafthunk-setup" "$test_dir/docker-host/dafthunk-setup"
unset DAFTHUNK_NON_INTERACTIVE DAFTHUNK_HOSTNAME DAFTHUNK_FROM_INSTALL
printf '仅测试交互：不会启动容器或修改现有部署。请在下面的域名提示处亲自按 Enter。\n'
bash "$test_dir/docker-host/dafthunk-setup" --no-rebuild
test -s "$test_dir/docker-host/containers/app.yml"
printf '\nPASS：交互已返回，配置文件已生成。临时配置将在退出时删除。\n'
