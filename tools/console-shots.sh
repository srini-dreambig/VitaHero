#!/usr/bin/env bash
# Screenshots of the real admin console, so a change to how it looks can be
# looked at rather than reasoned about.
#
#   ./tools/console-shots.sh <out-dir>
#
# Same stubbed backend as tools/console-smoke: what is rendered is the console
# built by functions/portal.ts, with the API answered from a fixture. Uses its
# own port so it can run while the smoke suite is running.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
out="${1:?usage: console-shots.sh <out-dir>}"
mkdir -p "$out"
work="$(mktemp -d)"
trap 'rm -rf "$work"; kill "${srv:-}" 2>/dev/null || true' EXIT

pwdir=""
for cand in "$root/node_modules/playwright" "$root/functions/node_modules/playwright" \
            /opt/node22/lib/node_modules/playwright /usr/lib/node_modules/playwright; do
  [ -d "$cand" ] && pwdir="$cand" && break
done
if [ -z "$pwdir" ]; then
  echo "playwright not found — cannot take console screenshots" >&2
  exit 0
fi

bun -e "
  import { PORTAL_HTML } from '$root/functions/portal.ts';
  await Bun.write('$work/portal.html', PORTAL_HTML);
"

port=8098
python3 "$here/console-smoke/serve.py" "$work" "$port" >/dev/null 2>&1 &
srv=$!
for _ in $(seq 1 40); do
  curl -sf --noproxy '*' "http://127.0.0.1:$port/admin" >/dev/null && break
  sleep 0.25
done

PW_DIR="$pwdir" PORTAL_URL="http://127.0.0.1:$port/admin" OUT="$out" \
  node "$here/console-smoke/shots.mjs"
