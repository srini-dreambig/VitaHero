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

# Syntax-check the console's own script before driving it.
#
# A missing bracket makes every test in every file fail with something that
# looks unrelated — seventeen assertions about dashboard numbers, none of which
# mention a syntax error. One line here names it instead.
node -e "
  const fs = require('fs');
  const html = fs.readFileSync('$work/portal.html', 'utf8');
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) { console.error('console-smoke: no script block in the portal HTML'); process.exit(1); }
  fs.writeFileSync('$work/app.js', m[1]);
" || exit 1
if ! node --check "$work/app.js"; then
  echo "console-smoke: the console's script does not parse — fix that first" >&2
  exit 1
fi

port=8099
python3 "$here/serve.py" "$work" "$port" >/dev/null 2>&1 &
srv=$!
for _ in $(seq 1 40); do
  curl -sf --noproxy '*' "http://127.0.0.1:$port/admin" >/dev/null && break
  sleep 0.25
done

status=0
for f in "$here"/screens.mjs "$here"/photo-gating.mjs "$here"/phone.mjs "$here"/dashboard.mjs "$here"/oversight.mjs "$here"/doctor-camp.mjs "$here"/navigation.mjs "$here"/actions.mjs "$here"/school-lifecycle.mjs "$here"/manage.mjs "$here"/admin-panel.mjs "$here"/state.mjs; do
  echo "── $(basename "$f")"
  PW_DIR="$pwdir" PORTAL_URL="http://127.0.0.1:$port/admin" node "$f" || status=1
done
exit $status
