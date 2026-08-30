#!/usr/bin/env bash
# Loads the real admin console in Chromium and drives it, so a screen that
# throws on render fails here rather than in a school hall.
#
# The console is a single HTML string built by functions/portal.ts with no build
# step, so this renders that exact string. The backend is stubbed inside the
# page: what is under test is the console's own JavaScript, not the API.
#
#   ./tools/console-smoke/run.sh
#
# Needs Chromium via Playwright. On a machine without it, skip these — the bun
# suite still covers everything server-side.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"; kill "${srv:-}" 2>/dev/null || true' EXIT

# Playwright is usually installed globally in these environments rather than in
# the project, so find it either way.
pwdir=""
for cand in "$root/node_modules/playwright" "$root/functions/node_modules/playwright" \
            /opt/node22/lib/node_modules/playwright /usr/lib/node_modules/playwright; do
  [ -d "$cand" ] && pwdir="$cand" && break
done
if [ -z "$pwdir" ]; then
  echo "playwright not found — skipping the console smoke tests" >&2
  exit 0
fi

bun -e "
  import { PORTAL_HTML } from '$root/functions/portal.ts';
  await Bun.write('$work/portal.html', PORTAL_HTML);
"

port=8099
python3 -m http.server "$port" --directory "$work" --bind 127.0.0.1 >/dev/null 2>&1 &
srv=$!
for _ in $(seq 1 40); do
  curl -sf --noproxy '*' "http://127.0.0.1:$port/portal.html" >/dev/null && break
  sleep 0.25
done

status=0
for f in "$here"/screens.mjs "$here"/photo-gating.mjs "$here"/phone.mjs "$here"/dashboard.mjs "$here"/oversight.mjs "$here"/doctor-camp.mjs "$here"/navigation.mjs; do
  echo "── $(basename "$f")"
  PW_DIR="$pwdir" PORTAL_URL="http://127.0.0.1:$port/portal.html" node "$f" || status=1
done
exit $status
