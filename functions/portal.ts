// Stage A — the school admin portal, served at /admin.
//
// Deliberately dependency-free: no build step, no CDN, no framework. It ships
// with the worker, which means there is one thing to deploy and one place for
// the API contract to live. An admin console for a handful of school offices
// does not need a bundler.
//
// The portal JS below avoids template literals entirely so this file can hold
// it in one without escaping every backtick.

export const PORTAL_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VitaHero — School Administration</title>
<style>
  :root {
    --brand: #F47B20; --brand-dark: #D9641A; --brand-soft: #FDF0E6;
    --blue: #1FA2DD; --blue-soft: #E4F4FC;
    --ink: #14202A; --ink-mid: #4A5A66; --ink-faint: #7C8A95;
    --bg: #F5F7F9; --surface: #FFFFFF; --sunk: #EDF1F4;
    --line: #DCE3E8; --line-soft: #E9EEF2;
    --ok: #12795A; --ok-bg: #E1F1EB;
    --warn: #99670A; --warn-bg: #FAF0DA;
    --err: #B3352A; --err-bg: #FAE6E3;
    --radius: 8px;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  h1,h2,h3 { margin: 0; line-height: 1.25; }
  h1 { font-size: 22px; font-weight: 650; letter-spacing: -.01em; }
  h2 { font-size: 17px; font-weight: 650; }
  h3 { font-size: 14px; font-weight: 650; }
  p { margin: 0 0 12px; }
  a { color: var(--brand-dark); }
  code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

  /* layout */
  .top {
    background: var(--surface); border-bottom: 1px solid var(--line);
    position: sticky; top: 0; z-index: 20;
  }
  .top-in {
    max-width: 1180px; margin: 0 auto; padding: 12px 24px;
    display: flex; align-items: center; gap: 16px;
  }
  .logo { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: -.01em; }
  .logo .dot {
    width: 22px; height: 22px; border-radius: 6px;
    background: linear-gradient(135deg, var(--brand), var(--blue));
  }
  .spacer { flex: 1; }
  .whoami { font-size: 13px; color: var(--ink-faint); text-align: right; line-height: 1.35; }
  .whoami b { display: block; color: var(--ink); font-weight: 600; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 24px; }

  /* controls */
  button, .btn {
    font: inherit; font-weight: 550; cursor: pointer;
    border: 1px solid var(--line); background: var(--surface); color: var(--ink);
    padding: 8px 14px; border-radius: 6px; transition: background .12s, border-color .12s;
  }
  button:hover:not(:disabled) { background: var(--sunk); }
  button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
    outline: 2px solid var(--blue); outline-offset: 1px;
  }
  button:disabled { opacity: .5; cursor: not-allowed; }
  button.primary { background: var(--brand); border-color: var(--brand); color: #fff; }
  button.primary:hover:not(:disabled) { background: var(--brand-dark); border-color: var(--brand-dark); }
  button.danger { color: var(--err); border-color: #E9C4bf; }
  button.danger:hover:not(:disabled) { background: var(--err-bg); }
  button.link {
    border: none; background: none; color: var(--brand-dark);
    padding: 2px 4px; text-decoration: underline; font-weight: 500;
  }
  button.link:hover:not(:disabled) { background: none; color: var(--brand); }
  button.sm { padding: 5px 10px; font-size: 13px; }

  label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 5px; color: var(--ink-mid); }
  input[type=text], input[type=tel], input[type=email], select, textarea {
    font: inherit; width: 100%; padding: 8px 11px;
    border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink);
  }
  textarea { min-height: 72px; resize: vertical; }
  .field { margin-bottom: 16px; }
  .hint { font-size: 12.5px; color: var(--ink-faint); margin-top: 5px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
  @media (max-width: 640px) { .grid2 { grid-template-columns: 1fr; } }

  .checks { display: flex; flex-wrap: wrap; gap: 8px; }
  .check {
    display: flex; align-items: center; gap: 7px; font-size: 13.5px; font-weight: 500;
    border: 1px solid var(--line); border-radius: 20px; padding: 6px 13px 6px 10px;
    cursor: pointer; user-select: none; background: var(--surface);
  }
  .check input { margin: 0; accent-color: var(--brand); }
  .check.on { background: var(--brand-soft); border-color: #F0C39A; }

  /* card */
  .card {
    background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); padding: 20px 22px; margin-bottom: 18px;
  }
  .card-hd {
    display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
    padding-bottom: 14px; border-bottom: 1px solid var(--line-soft);
  }
  .card-hd h2 { flex: 1; }

  /* table */
  .tw { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
  th { background: var(--sunk); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-mid); font-weight: 650; white-space: nowrap; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr.rowerr { background: var(--err-bg); }
  tbody tr.rowwarn { background: var(--warn-bg); }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }

  /* pills + tags */
  .pill {
    display: inline-block; font-size: 11.5px; font-weight: 650; letter-spacing: .04em;
    text-transform: uppercase; padding: 2px 8px; border-radius: 4px; white-space: nowrap;
  }
  .pill.ok { background: var(--ok-bg); color: var(--ok); }
  .pill.warn { background: var(--warn-bg); color: var(--warn); }
  .pill.err { background: var(--err-bg); color: var(--err); }
  .pill.mute { background: var(--sunk); color: var(--ink-faint); }
  .pill.info { background: var(--blue-soft); color: #0F6D96; }
  .code {
    font-family: ui-monospace, Menlo, Consolas, monospace; font-weight: 650;
    background: var(--sunk); border: 1px solid var(--line); border-radius: 5px;
    padding: 3px 8px; letter-spacing: .06em;
  }

  /* stats */
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(112px,1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; margin-bottom: 18px; }
  .stat { background: var(--surface); padding: 13px 16px; }
  .stat b { display: block; font-size: 22px; font-weight: 680; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
  .stat span { display: block; font-size: 12px; color: var(--ink-faint); margin-top: 2px; }
  .stat.ok b { color: var(--ok); } .stat.warn b { color: var(--warn); } .stat.err b { color: var(--err); }

  /* banners */
  .banner { border-radius: 6px; padding: 11px 15px; margin-bottom: 16px; font-size: 14px; border: 1px solid transparent; }
  .banner.err { background: var(--err-bg); color: var(--err); border-color: #EFCDC8; }
  .banner.ok { background: var(--ok-bg); color: var(--ok); border-color: #C3E2D6; }
  .banner.warn { background: var(--warn-bg); color: var(--warn); border-color: #EDDCB4; }
  .banner.info { background: var(--blue-soft); color: #0F6D96; border-color: #BFE3F4; }

  /* tabs */
  .tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--line); margin-bottom: 20px; overflow-x: auto; }
  .tab {
    border: none; background: none; padding: 10px 15px; font-weight: 600; font-size: 14px;
    color: var(--ink-faint); border-bottom: 2px solid transparent; border-radius: 0; white-space: nowrap;
  }
  .tab:hover { background: none; color: var(--ink); }
  .tab.on { color: var(--brand-dark); border-bottom-color: var(--brand); }

  /* sign-in */
  .signin { max-width: 400px; margin: 8vh auto; }
  .signin .card { padding: 26px 28px; }
  .modes { display: flex; gap: 2px; background: var(--sunk); padding: 3px; border-radius: 7px; margin-bottom: 20px; }
  .modes button { flex: 1; border: none; background: none; font-size: 13.5px; padding: 7px; border-radius: 5px; }
  .modes button.on { background: var(--surface); box-shadow: 0 1px 2px rgba(0,0,0,.08); }

  /* misc */
  .rowline { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .muted { color: var(--ink-faint); }
  .empty { text-align: center; padding: 40px 20px; color: var(--ink-faint); }
  .issues { margin: 4px 0 0; padding-left: 16px; font-size: 12.5px; }
  .issues li { margin-bottom: 2px; }
  .issues li.e { color: var(--err); }
  .issues li.w { color: var(--warn); }
  .drop {
    border: 2px dashed var(--line); border-radius: var(--radius); padding: 34px 20px;
    text-align: center; background: var(--surface); transition: border-color .15s, background .15s;
  }
  .drop.over { border-color: var(--brand); background: var(--brand-soft); }
  .steps { display: flex; gap: 8px; align-items: center; margin-bottom: 20px; font-size: 13px; flex-wrap: wrap; }
  .step { display: flex; align-items: center; gap: 7px; color: var(--ink-faint); }
  .step b {
    width: 21px; height: 21px; border-radius: 50%; background: var(--sunk); color: var(--ink-faint);
    display: grid; place-items: center; font-size: 12px; font-weight: 650;
  }
  .step.on { color: var(--ink); font-weight: 600; }
  .step.on b { background: var(--brand); color: #fff; }
  .step.done b { background: var(--ok); color: #fff; }
  .sep { width: 18px; height: 1px; background: var(--line); }
</style>
</head>
<body>
<div id="root"></div>
<script>
(function () {
  "use strict";

  // ── tiny DOM helper ───────────────────────────────────────
  function el(tag, props) {
    var node = document.createElement(tag);
    var p = props || {};
    for (var k in p) {
      if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
      var v = p[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "text") node.textContent = v;
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "value") node.value = v;
      else if (k === "checked" || k === "disabled" || k === "selected") node[k] = !!v;
      else node.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) add(node, arguments[i]);
    return node;
  }
  function add(parent, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { add(parent, c); }); return; }
    parent.appendChild(typeof child === "object" ? child : document.createTextNode(String(child)));
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // ── state ─────────────────────────────────────────────────
  var S = {
    auth: null,           // {mode:'key'|'session', key?, token?, name, role, schoolId}
    view: "schools",      // schools | school | newSchool
    tab: "programme",     // programme | classes | admins | roster | history
    schools: [],
    school: null,
    classes: null,
    admins: null,
    roster: null,
    batches: null,
    upload: null,         // {step, filename, rows, report, committing}
    otp: null,            // {phone, sent}
    busy: false,
    error: "",
    notice: "",
  };

  function set(patch) { for (var k in patch) S[k] = patch[k]; render(); }

  // ── persistence ───────────────────────────────────────────
  function saveAuth(a) {
    try { localStorage.setItem("vh_portal_auth", JSON.stringify(a)); } catch (e) {}
  }
  function loadAuth() {
    try {
      var raw = localStorage.getItem("vh_portal_auth");
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function signOut() {
    try { localStorage.removeItem("vh_portal_auth"); } catch (e) {}
    S.auth = null; S.schools = []; S.school = null; S.view = "schools";
    render();
  }

  // ── api ───────────────────────────────────────────────────
  function api(path, opts) {
    var o = opts || {};
    var headers = { "Content-Type": "application/json" };
    if (S.auth && S.auth.mode === "key") headers["X-Admin-Key"] = S.auth.key;
    if (S.auth && S.auth.mode === "session") headers["Authorization"] = "Bearer " + S.auth.token;
    return fetch(path, {
      method: o.method || "GET",
      headers: headers,
      body: o.body ? JSON.stringify(o.body) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = { error: t }; }
        if (!r.ok) {
          var err = new Error((data && data.error) || ("Request failed (" + r.status + ")"));
          err.code = data && data.code;
          err.status = r.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function run(promise, onOk) {
    set({ busy: true, error: "" });
    promise.then(function (d) {
      S.busy = false;
      if (onOk) onOk(d);
      render();
    }).catch(function (e) {
      set({ busy: false, error: e.message || "Something went wrong" });
    });
  }

  // ── CSV ───────────────────────────────────────────────────
  function parseCsv(text) {
    var rows = [], row = [], field = "", inQ = false, i = 0;
    text = text.replace(/^\\uFEFF/, "");
    while (i < text.length) {
      var c = text.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\\r") { i++; continue; }
      if (c === "\\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ""; }); });
  }

  function csvToObjects(text) {
    var grid = parseCsv(text);
    if (grid.length < 2) return { headers: [], rows: [] };
    var headers = grid[0].map(function (h) { return String(h).trim(); });
    var out = [];
    for (var i = 1; i < grid.length; i++) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        if (headers[j]) obj[headers[j]] = grid[i][j] === undefined ? "" : grid[i][j];
      }
      out.push(obj);
    }
    return { headers: headers, rows: out };
  }

  function toCsv(rows) {
    return rows.map(function (r) {
      return r.map(function (cell) {
        var s = cell === null || cell === undefined ? "" : String(cell);
        return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(",");
    }).join("\\n");
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ── sign in ───────────────────────────────────────────────
  function viewSignIn() {
    var mode = S.signMode || "key";
    var keyInput, phoneInput, otpInput;

    function useKey() {
      var key = keyInput.value.trim();
      if (!key) { set({ error: "Enter the admin API key" }); return; }
      S.auth = { mode: "key", key: key, name: "VitaHero Ops", role: "ADMIN", schoolId: null };
      run(api("/api/admin/schools"), function (d) {
        saveAuth(S.auth);
        S.schools = d.schools; S.view = "schools";
      });
    }

    function sendOtp() {
      var phone = phoneInput.value.trim();
      if (!phone) { set({ error: "Enter your mobile number" }); return; }
      run(api("/api/auth/phone/send", { method: "POST", body: { phone: phone } }), function () {
        S.otp = { phone: phone, sent: true };
        S.notice = "We sent a code to " + phone;
      });
    }

    function verifyOtp() {
      var code = otpInput.value.trim();
      if (!code) { set({ error: "Enter the code" }); return; }
      run(api("/api/auth/phone/verify", {
        method: "POST",
        body: { phone: S.otp.phone, otp: code }
      }), function (d) {
        var p = d.profile || {};
        if (p.role !== "SCHOOL_ADMIN" && p.role !== "ADMIN" && p.role !== "SUPERADMIN") {
          S.error = "That number is not registered as an administrator.";
          S.auth = null;
          return;
        }
        S.auth = {
          mode: "session", token: d.token, name: p.name || "Administrator",
          role: p.role, schoolId: p.school_id || null
        };
        saveAuth(S.auth);
        S.otp = null;
        loadSchools();
      });
    }

    return el("div", { class: "signin" },
      el("div", { class: "logo", style: "justify-content:center;margin-bottom:18px;font-size:19px" },
        el("span", { class: "dot" }), "VitaHero"),
      el("div", { class: "card" },
        el("h2", { style: "margin-bottom:4px" }, "School administration"),
        el("p", { class: "muted", style: "font-size:13.5px" },
          "Sign in to manage schools, classes and student rosters."),
        el("div", { class: "modes" },
          el("button", {
            class: mode === "key" ? "on" : "",
            onclick: function () { S.signMode = "key"; S.error = ""; render(); }
          }, "VitaHero ops"),
          el("button", {
            class: mode === "otp" ? "on" : "",
            onclick: function () { S.signMode = "otp"; S.error = ""; render(); }
          }, "School admin")
        ),
        S.error ? el("div", { class: "banner err" }, S.error) : null,
        S.notice ? el("div", { class: "banner ok" }, S.notice) : null,

        mode === "key"
          ? el("div", null,
              el("div", { class: "field" },
                el("label", null, "Admin API key"),
                keyInput = el("input", {
                  type: "text", placeholder: "Paste your key",
                  onkeydown: function (e) { if (e.key === "Enter") useKey(); }
                }),
                el("div", { class: "hint" }, "The ADMIN_API_KEY set on the worker.")
              ),
              el("button", { class: "primary", style: "width:100%", disabled: S.busy, onclick: useKey },
                S.busy ? "Checking..." : "Sign in")
            )
          : el("div", null,
              !S.otp || !S.otp.sent
                ? el("div", null,
                    el("div", { class: "field" },
                      el("label", null, "Mobile number"),
                      phoneInput = el("input", {
                        type: "tel", placeholder: "98765 43210",
                        onkeydown: function (e) { if (e.key === "Enter") sendOtp(); }
                      }),
                      el("div", { class: "hint" }, "The number VitaHero registered for you.")
                    ),
                    el("button", { class: "primary", style: "width:100%", disabled: S.busy, onclick: sendOtp },
                      S.busy ? "Sending..." : "Send code")
                  )
                : el("div", null,
                    el("div", { class: "field" },
                      el("label", null, "Six-digit code"),
                      otpInput = el("input", {
                        type: "text", inputmode: "numeric", maxlength: "6", placeholder: "000000",
                        onkeydown: function (e) { if (e.key === "Enter") verifyOtp(); }
                      })
                    ),
                    el("button", { class: "primary", style: "width:100%", disabled: S.busy, onclick: verifyOtp },
                      S.busy ? "Verifying..." : "Verify and sign in"),
                    el("button", {
                      class: "link", style: "display:block;margin:10px auto 0",
                      onclick: function () { S.otp = null; S.notice = ""; render(); }
                    }, "Use a different number")
                  )
            )
      )
    );
  }

  // ── loaders ───────────────────────────────────────────────
  function loadSchools() {
    run(api("/api/admin/schools"), function (d) {
      S.schools = d.schools;
      S.view = "schools";
      // A school admin has exactly one school; go straight into it.
      if (S.auth.role === "SCHOOL_ADMIN" && d.schools.length === 1) {
        S.school = d.schools[0];
        S.view = "school";
        S.tab = "roster";
        loadTab();
      }
    });
  }

  function openSchool(id, tab) {
    run(api("/api/admin/schools/" + encodeURIComponent(id)), function (d) {
      S.school = d.school; S.view = "school"; S.tab = tab || "programme";
      S.classes = null; S.admins = null; S.roster = null; S.batches = null;
      S.upload = null;
      loadTab();
    });
  }

  function loadTab() {
    var id = S.school.id;
    if (S.tab === "classes" && !S.classes) {
      run(api("/api/admin/schools/" + id + "/classes"), function (d) { S.classes = d; });
    } else if (S.tab === "admins" && !S.admins) {
      run(api("/api/admin/schools/" + id + "/admins"), function (d) { S.admins = d.admins; });
    } else if (S.tab === "roster" && !S.roster) {
      run(api("/api/admin/schools/" + id + "/roster?limit=500"), function (d) { S.roster = d; });
    } else if (S.tab === "history" && !S.batches) {
      run(api("/api/admin/schools/" + id + "/roster/batches"), function (d) { S.batches = d.batches; });
    }
  }

  // ── schools list ──────────────────────────────────────────
  function viewSchools() {
    return el("div", null,
      el("div", { class: "rowline", style: "margin-bottom:18px" },
        el("h1", { style: "flex:1" }, "Schools"),
        isOps() ? el("button", {
          class: "primary",
          onclick: function () { set({ view: "newSchool", error: "" }); }
        }, "Add school") : null
      ),
      S.schools.length === 0
        ? el("div", { class: "card empty" },
            el("p", null, "No schools yet."),
            isOps() ? el("button", { class: "primary", onclick: function () { set({ view: "newSchool" }); } }, "Add the first school") : null)
        : el("div", { class: "tw" },
            el("table", null,
              el("thead", null, el("tr", null,
                el("th", null, "School"),
                el("th", null, "Partner code"),
                el("th", null, "Year"),
                el("th", { class: "num" }, "Students"),
                el("th", { class: "num" }, "Admins"),
                el("th", null, "Status"),
                el("th", null, "")
              )),
              el("tbody", null, S.schools.map(function (s) {
                return el("tr", null,
                  el("td", null,
                    el("b", null, s.name),
                    el("div", { class: "muted", style: "font-size:13px" },
                      [s.city, s.district].filter(Boolean).join(" · "))),
                  el("td", null, el("span", { class: "code" }, s.partnerCode)),
                  el("td", null, s.academicYear || el("span", { class: "muted" }, "—")),
                  el("td", { class: "num" }, s.studentCount),
                  el("td", { class: "num" }, s.adminCount),
                  el("td", null, el("span", {
                    class: "pill " + (s.active && s.status === "ACTIVE" ? "ok" : "mute")
                  }, s.active && s.status === "ACTIVE" ? "Active" : (s.status || "Inactive"))),
                  el("td", null, el("button", {
                    class: "sm", onclick: function () { openSchool(s.id); }
                  }, "Manage"))
                );
              }))
            )
          )
    );
  }

  // ── new school ────────────────────────────────────────────
  var CHECKS = ["Height & weight","Vision","Dental","Haemoglobin","ENT","Skin","Spine","Immunisation review"];
  var CADENCES = [["ANNUAL","Once a year"],["BIANNUAL","Twice a year"],["QUARTERLY","Every quarter"],["ADHOC","As arranged"]];

  function viewNewSchool() {
    var f = S.form || (S.form = {
      name: "", city: "Hyderabad", district: "", contactName: "", contactPhone: "",
      contactEmail: "", academicYear: "", campCadence: "ANNUAL", checksOffered: [], description: ""
    });
    function bind(key) {
      return function (e) { f[key] = e.target.value; };
    }
    function toggleCheck(c) {
      var i = f.checksOffered.indexOf(c);
      if (i >= 0) f.checksOffered.splice(i, 1); else f.checksOffered.push(c);
      render();
    }
    function submit() {
      run(api("/api/admin/schools", { method: "POST", body: f }), function (d) {
        S.form = null;
        S.notice = "Created " + d.school.name + ". Partner code " + d.school.partnerCode + ".";
        S.schools.push(d.school);
        S.school = d.school; S.view = "school"; S.tab = "classes";
        S.classes = null; S.admins = null; S.roster = null; S.batches = null;
        loadTab();
      });
    }

    return el("div", null,
      el("button", { class: "link", style: "margin-bottom:12px", onclick: function () { S.form = null; set({ view: "schools", error: "" }); } }, "← Schools"),
      el("h1", { style: "margin-bottom:18px" }, "Add a school"),
      S.error ? el("div", { class: "banner err" }, S.error) : null,
      el("div", { class: "card" },
        el("div", { class: "card-hd" }, el("h2", null, "The school")),
        el("div", { class: "field" },
          el("label", null, "School name"),
          el("input", { type: "text", value: f.name, oninput: bind("name"), placeholder: "Oakridge International School" })),
        el("div", { class: "grid2" },
          el("div", { class: "field" }, el("label", null, "City"),
            el("input", { type: "text", value: f.city, oninput: bind("city") })),
          el("div", { class: "field" }, el("label", null, "District"),
            el("input", { type: "text", value: f.district, oninput: bind("district"), placeholder: "Optional" }))
        ),
        el("div", { class: "grid2" },
          el("div", { class: "field" }, el("label", null, "Contact person"),
            el("input", { type: "text", value: f.contactName, oninput: bind("contactName"), placeholder: "Head of school health" })),
          el("div", { class: "field" }, el("label", null, "Contact mobile"),
            el("input", { type: "tel", value: f.contactPhone, oninput: bind("contactPhone"), placeholder: "98765 43210" }))
        ),
        el("div", { class: "field" }, el("label", null, "Contact email"),
          el("input", { type: "email", value: f.contactEmail, oninput: bind("contactEmail"), placeholder: "Optional" }))
      ),
      el("div", { class: "card" },
        el("div", { class: "card-hd" }, el("h2", null, "The programme")),
        el("div", { class: "grid2" },
          el("div", { class: "field" }, el("label", null, "Academic year"),
            el("input", { type: "text", value: f.academicYear, oninput: bind("academicYear"), placeholder: "Leave blank for the current year" })),
          el("div", { class: "field" }, el("label", null, "How often camps run"),
            el("select", { onchange: bind("campCadence") },
              CADENCES.map(function (c) {
                return el("option", { value: c[0], selected: f.campCadence === c[0] }, c[1]);
              })))
        ),
        el("div", { class: "field" },
          el("label", null, "Checks offered at this school's camps"),
          el("div", { class: "checks" }, CHECKS.map(function (c) {
            var on = f.checksOffered.indexOf(c) >= 0;
            return el("label", { class: "check" + (on ? " on" : "") },
              el("input", { type: "checkbox", checked: on, onchange: function () { toggleCheck(c); } }), c);
          })),
          el("div", { class: "hint" }, "This is what the school has agreed to. Camp day can only record these.")
        ),
        el("div", { class: "field" }, el("label", null, "Notes"),
          el("textarea", { oninput: bind("description"), placeholder: "Anything the ops team should know" }, f.description))
      ),
      el("div", { class: "rowline" },
        el("button", { class: "primary", disabled: S.busy, onclick: submit }, S.busy ? "Creating..." : "Create school"),
        el("button", { onclick: function () { S.form = null; set({ view: "schools", error: "" }); } }, "Cancel")
      )
    );
  }

  // ── school detail ─────────────────────────────────────────
  function viewSchool() {
    var s = S.school;
    var tabs = [
      ["programme", "Programme"],
      ["classes", "Classes"],
      ["admins", "Administrators"],
      ["roster", "Roster"],
      ["history", "Upload history"]
    ];
    return el("div", null,
      isOps() ? el("button", { class: "link", style: "margin-bottom:12px", onclick: function () { set({ view: "schools", error: "", notice: "" }); } }, "← Schools") : null,
      el("div", { class: "rowline", style: "margin-bottom:6px" },
        el("h1", { style: "flex:1" }, s.name),
        el("span", { class: "code" }, s.partnerCode)
      ),
      el("p", { class: "muted", style: "font-size:13.5px" },
        [s.city, s.district, s.academicYear].filter(Boolean).join(" · ")),
      el("div", { class: "tabs" }, tabs.map(function (t) {
        return el("button", {
          class: "tab" + (S.tab === t[0] ? " on" : ""),
          onclick: function () { S.tab = t[0]; S.error = ""; render(); loadTab(); }
        }, t[1]);
      })),
      S.error ? el("div", { class: "banner err" }, S.error) : null,
      S.notice ? el("div", { class: "banner ok" }, S.notice) : null,
      S.tab === "programme" ? tabProgramme()
        : S.tab === "classes" ? tabClasses()
        : S.tab === "admins" ? tabAdmins()
        : S.tab === "roster" ? tabRoster()
        : tabHistory()
    );
  }

  function tabProgramme() {
    var s = S.school;
    var f = S.pform || (S.pform = {
      name: s.name, city: s.city, district: s.district,
      contactName: s.contactName, contactPhone: s.contactPhone, contactEmail: s.contactEmail,
      academicYear: s.academicYear, campCadence: s.campCadence,
      checksOffered: s.checksOffered.slice(), description: s.description
    });
    function bind(k) { return function (e) { f[k] = e.target.value; }; }
    function toggleCheck(c) {
      var i = f.checksOffered.indexOf(c);
      if (i >= 0) f.checksOffered.splice(i, 1); else f.checksOffered.push(c);
      render();
    }
    function save() {
      var body = {};
      for (var k in f) body[k] = f[k];
      if (!isOps()) { delete body.name; delete body.campCadence; }
      run(api("/api/admin/schools/" + s.id, { method: "PATCH", body: body }), function (d) {
        S.school = d.school; S.pform = null; S.notice = "Saved.";
        var idx = S.schools.findIndex(function (x) { return x.id === d.school.id; });
        if (idx >= 0) S.schools[idx] = d.school;
      });
    }

    return el("div", null,
      el("div", { class: "card" },
        el("div", { class: "card-hd" }, el("h2", null, "School details"),
          !isOps() ? el("span", { class: "pill mute" }, "Some fields are ops-only") : null),
        el("div", { class: "field" }, el("label", null, "School name"),
          el("input", { type: "text", value: f.name, oninput: bind("name"), disabled: !isOps() })),
        el("div", { class: "grid2" },
          el("div", { class: "field" }, el("label", null, "City"),
            el("input", { type: "text", value: f.city, oninput: bind("city") })),
          el("div", { class: "field" }, el("label", null, "District"),
            el("input", { type: "text", value: f.district, oninput: bind("district") }))
        ),
        el("div", { class: "grid2" },
          el("div", { class: "field" }, el("label", null, "Contact person"),
            el("input", { type: "text", value: f.contactName, oninput: bind("contactName") })),
          el("div", { class: "field" }, el("label", null, "Contact mobile"),
            el("input", { type: "tel", value: f.contactPhone, oninput: bind("contactPhone") }))
        ),
        el("div", { class: "field" }, el("label", null, "Contact email"),
          el("input", { type: "email", value: f.contactEmail, oninput: bind("contactEmail") }))
      ),
      el("div", { class: "card" },
        el("div", { class: "card-hd" }, el("h2", null, "Programme")),
        el("div", { class: "grid2" },
          el("div", { class: "field" }, el("label", null, "Academic year"),
            el("input", { type: "text", value: f.academicYear, oninput: bind("academicYear"), placeholder: "2026-27" })),
          el("div", { class: "field" }, el("label", null, "How often camps run"),
            el("select", { onchange: bind("campCadence"), disabled: !isOps() },
              CADENCES.map(function (c) {
                return el("option", { value: c[0], selected: f.campCadence === c[0] }, c[1]);
              })))
        ),
        el("div", { class: "field" },
          el("label", null, "Checks offered"),
          el("div", { class: "checks" }, CHECKS.map(function (c) {
            var on = f.checksOffered.indexOf(c) >= 0;
            return el("label", { class: "check" + (on ? " on" : "") },
              el("input", { type: "checkbox", checked: on, onchange: function () { toggleCheck(c); } }), c);
          }))
        ),
        el("div", { class: "field" }, el("label", null, "Notes"),
          el("textarea", { oninput: bind("description") }, f.description))
      ),
      el("button", { class: "primary", disabled: S.busy, onclick: save }, S.busy ? "Saving..." : "Save changes")
    );
  }

  // ── classes ───────────────────────────────────────────────
  function tabClasses() {
    if (!S.classes) return el("div", { class: "card empty" }, "Loading classes...");
    var c = S.classes;
    var g = S.cform || (S.cform = {
      year: c.academicYear,
      grades: c.classes.length
        ? uniq(c.classes.map(function (x) { return x.grade; })).join(", ")
        : "Class 1, Class 2, Class 3, Class 4, Class 5",
      sections: c.classes.length
        ? uniq(c.classes.map(function (x) { return x.section; }).filter(Boolean)).join(", ")
        : "A, B"
    });
    function save() {
      var grades = g.grades.split(",").map(trim).filter(Boolean);
      var sections = g.sections.split(",").map(trim).filter(Boolean);
      if (!grades.length) { set({ error: "List at least one class" }); return; }
      run(api("/api/admin/schools/" + S.school.id + "/classes", {
        method: "POST",
        body: { academicYear: g.year, grades: grades, sections: sections }
      }), function (d) {
        S.classes = d; S.cform = null;
        S.notice = "Saved " + d.classes.length + " classes for " + d.academicYear + ".";
        if (d.keptBecauseInUse && d.keptBecauseInUse.length) {
          S.notice += " Kept " + d.keptBecauseInUse.join(", ") + " because students are still enrolled.";
        }
      });
    }

    return el("div", null,
      el("div", { class: "card" },
        el("div", { class: "card-hd" }, el("h2", null, "Classes and sections")),
        el("p", { class: "muted", style: "font-size:13.5px" },
          "Every class in the school, for one academic year. The roster upload checks each student against this list, so a typo in a spreadsheet gets flagged instead of quietly creating a new class."),
        el("div", { class: "field" }, el("label", null, "Academic year"),
          el("input", { type: "text", value: g.year, oninput: function (e) { g.year = e.target.value; }, placeholder: "2026-27" }),
          el("div", { class: "hint" }, "Format: 2026-27")),
        el("div", { class: "field" }, el("label", null, "Classes"),
          el("input", { type: "text", value: g.grades, oninput: function (e) { g.grades = e.target.value; } }),
          el("div", { class: "hint" }, "Comma separated, exactly as they appear in your roster file.")),
        el("div", { class: "field" }, el("label", null, "Sections"),
          el("input", { type: "text", value: g.sections, oninput: function (e) { g.sections = e.target.value; } }),
          el("div", { class: "hint" }, "Applied to every class. Leave blank if this school does not use sections.")),
        el("button", { class: "primary", disabled: S.busy, onclick: save }, S.busy ? "Saving..." : "Save classes")
      ),
      c.classes.length
        ? el("div", { class: "tw" },
            el("table", null,
              el("thead", null, el("tr", null,
                el("th", null, "Class"), el("th", null, "Section"), el("th", { class: "num" }, "Students"))),
              el("tbody", null, c.classes.map(function (x) {
                return el("tr", null,
                  el("td", null, x.grade),
                  el("td", null, x.section || el("span", { class: "muted" }, "—")),
                  el("td", { class: "num" }, x.studentCount));
              }))))
        : el("div", { class: "card empty" }, "No classes defined for " + c.academicYear + " yet.")
    );
  }

  // ── administrators ────────────────────────────────────────
  function tabAdmins() {
    if (!S.admins) return el("div", { class: "card empty" }, "Loading administrators...");
    var f = S.aform || (S.aform = { name: "", phone: "", email: "" });
    function addAdmin() {
      run(api("/api/admin/schools/" + S.school.id + "/admins", { method: "POST", body: f }), function (d) {
        S.aform = null; S.admins = null;
        S.notice = d.admin.name + " can now sign in with " + d.admin.phone + ".";
        run(api("/api/admin/schools/" + S.school.id + "/admins"), function (r) { S.admins = r.admins; });
      });
    }
    function removeAdmin(a) {
      if (!confirm("Remove " + a.name + "? They will lose access immediately.")) return;
      run(api("/api/admin/schools/" + S.school.id + "/admins/" + encodeURIComponent(a.profileId), { method: "DELETE" }), function () {
        S.admins = S.admins.filter(function (x) { return x.profileId !== a.profileId; });
        S.notice = a.name + " no longer has access.";
      });
    }

    return el("div", null,
      el("div", { class: "card" },
        el("div", { class: "card-hd" }, el("h2", null, "Add an administrator")),
        el("p", { class: "muted", style: "font-size:13.5px" },
          "They sign in here with this mobile number and a one-time code. Use a number that is not already registered as a parent."),
        el("div", { class: "grid2" },
          el("div", { class: "field" }, el("label", null, "Name"),
            el("input", { type: "text", value: f.name, oninput: function (e) { f.name = e.target.value; } })),
          el("div", { class: "field" }, el("label", null, "Mobile number"),
            el("input", { type: "tel", value: f.phone, oninput: function (e) { f.phone = e.target.value; } }))
        ),
        el("div", { class: "field" }, el("label", null, "Email"),
          el("input", { type: "email", value: f.email, oninput: function (e) { f.email = e.target.value; }, placeholder: "Optional" })),
        el("button", { class: "primary", disabled: S.busy, onclick: addAdmin }, S.busy ? "Adding..." : "Add administrator")
      ),
      S.admins.length
        ? el("div", { class: "tw" },
            el("table", null,
              el("thead", null, el("tr", null,
                el("th", null, "Name"), el("th", null, "Mobile"), el("th", null, "Email"),
                el("th", null, "Status"), el("th", null, ""))),
              el("tbody", null, S.admins.map(function (a) {
                return el("tr", null,
                  el("td", null, el("b", null, a.name)),
                  el("td", { class: "mono" }, a.phone),
                  el("td", null, a.email || el("span", { class: "muted" }, "—")),
                  el("td", null, el("span", { class: "pill " + (a.hasSignedIn ? "ok" : "mute") },
                    a.hasSignedIn ? "Active" : "Not signed in yet")),
                  el("td", null, el("button", { class: "sm danger", onclick: function () { removeAdmin(a); } }, "Remove")));
              }))))
        : el("div", { class: "card empty" }, "No administrators yet for this school.")
    );
  }

  // ── roster ────────────────────────────────────────────────
  function tabRoster() {
    if (S.upload) return uploadWizard();
    if (!S.roster) return el("div", { class: "card empty" }, "Loading roster...");
    var r = S.roster;
    var activated = r.students.filter(function (s) { return s.guardianActivated; }).length;

    return el("div", null,
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("b", null, r.total), el("span", null, "students on roll")),
        el("div", { class: "stat ok" }, el("b", null, activated), el("span", null, "guardians signed in")),
        el("div", { class: "stat" }, el("b", null, uniq(r.students.map(function (s) { return s.guardianPhone; })).length),
          el("span", null, "guardian numbers"))
      ),
      el("div", { class: "rowline", style: "margin-bottom:16px" },
        el("button", { class: "primary", onclick: function () { set({ upload: { step: 1 }, error: "", notice: "" }); } }, "Upload roster"),
        el("button", { onclick: downloadTemplate }, "Download template"),
        r.total ? el("button", { onclick: exportRoster }, "Export current roster") : null
      ),
      r.students.length === 0
        ? el("div", { class: "card empty" },
            el("p", null, "No students yet."),
            el("p", { style: "font-size:13.5px" }, "Set up your classes first, then upload the roster CSV."))
        : el("div", { class: "tw" },
            el("table", null,
              el("thead", null, el("tr", null,
                el("th", null, "Student"), el("th", null, "Class"), el("th", null, "DOB"),
                el("th", null, "Guardian"), el("th", null, "Mobile"), el("th", null, "App"))),
              el("tbody", null, r.students.map(function (s) {
                return el("tr", null,
                  el("td", null, el("b", null, s.name),
                    s.studentRef ? el("div", { class: "muted mono", style: "font-size:12px" }, s.studentRef.replace(/^sid_/, "")) : null),
                  el("td", null, (s.grade || "") + (s.section ? " " + s.section : "")),
                  el("td", { class: "mono", style: "font-size:13px" }, s.dob || el("span", { class: "muted" }, "age " + (s.age || "?"))),
                  el("td", null, s.guardianName || el("span", { class: "muted" }, "—")),
                  el("td", { class: "mono", style: "font-size:13px" }, s.guardianPhone),
                  el("td", null, el("span", { class: "pill " + (s.guardianActivated ? "ok" : "mute") },
                    s.guardianActivated ? "Yes" : "No")));
              })))),
      r.total > r.students.length
        ? el("p", { class: "muted", style: "margin-top:12px;font-size:13px" },
            "Showing " + r.students.length + " of " + r.total + ".")
        : null
    );
  }

  function downloadTemplate() {
    download("vitahero-roster-template.csv", toCsv([
      ["Admission No","Student Name","Date of Birth","Gender","Class","Section","Guardian Name","Guardian Phone"],
      ["2026/0412","Rahul Sharma","14/03/2016","Male","Class 4","B","Priya Sharma","9876543210"],
      ["2026/0413","Ananya Reddy","02/11/2015","Female","Class 5","A","Vikram Reddy","9876543211"]
    ]));
  }

  function exportRoster() {
    var rows = [["Admission No","Student Name","Date of Birth","Gender","Class","Section","Guardian Name","Guardian Phone","Signed in"]];
    S.roster.students.forEach(function (s) {
      rows.push([s.studentRef.replace(/^sid_/, ""), s.name, s.dob, s.gender, s.grade, s.section,
        s.guardianName, s.guardianPhone, s.guardianActivated ? "Yes" : "No"]);
    });
    download("roster-" + S.school.partnerCode + ".csv", toCsv(rows));
  }

  // ── upload wizard ─────────────────────────────────────────
  function uploadWizard() {
    var u = S.upload;
    return el("div", null,
      el("button", { class: "link", style: "margin-bottom:12px", onclick: function () { set({ upload: null, error: "" }); } }, "← Back to roster"),
      el("div", { class: "steps" },
        stepPill(1, "Choose file", u.step), el("span", { class: "sep" }),
        stepPill(2, "Review", u.step), el("span", { class: "sep" }),
        stepPill(3, "Done", u.step)),
      S.error ? el("div", { class: "banner err" }, S.error) : null,
      u.step === 1 ? stepChoose() : u.step === 2 ? stepReview() : stepDone()
    );
  }

  function stepPill(n, label, current) {
    return el("span", { class: "step" + (current === n ? " on" : current > n ? " done" : "") },
      el("b", null, current > n ? "✓" : String(n)), label);
  }

  function stepChoose() {
    var input;
    function handleFile(file) {
      if (!file) return;
      if (!/\\.csv$/i.test(file.name)) {
        set({ error: "Please upload a .csv file. In Excel, use File → Save As → CSV." });
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var parsed = csvToObjects(String(reader.result));
        if (!parsed.rows.length) {
          set({ error: "That file has a header row but no students." });
          return;
        }
        S.upload = { step: 1, filename: file.name, rows: parsed.rows, headers: parsed.headers };
        validate();
      };
      reader.onerror = function () { set({ error: "Could not read that file." }); };
      reader.readAsText(file);
    }
    function validate() {
      run(api("/api/admin/schools/" + S.school.id + "/roster/validate", {
        method: "POST",
        body: { rows: S.upload.rows, filename: S.upload.filename }
      }), function (report) {
        S.upload.report = report;
        S.upload.step = 2;
      });
    }

    return el("div", null,
      el("div", {
        class: "drop" + (S.dragOver ? " over" : ""),
        ondragover: function (e) { e.preventDefault(); if (!S.dragOver) set({ dragOver: true }); },
        ondragleave: function () { set({ dragOver: false }); },
        ondrop: function (e) {
          e.preventDefault(); S.dragOver = false;
          handleFile(e.dataTransfer.files && e.dataTransfer.files[0]);
        }
      },
        el("p", { style: "font-size:16px;font-weight:600;margin-bottom:6px" }, "Drop your roster CSV here"),
        el("p", { class: "muted", style: "font-size:13.5px" }, "or choose a file from your computer"),
        input = el("input", {
          type: "file", accept: ".csv,text/csv", style: "display:none",
          onchange: function (e) { handleFile(e.target.files[0]); }
        }),
        el("button", { class: "primary", disabled: S.busy, onclick: function () { input.click(); } },
          S.busy ? "Checking..." : "Choose file"),
        el("div", { style: "margin-top:14px" },
          el("button", { class: "link", onclick: downloadTemplate }, "Download the template"))
      ),
      el("div", { class: "card", style: "margin-top:18px" },
        el("h3", { style: "margin-bottom:8px" }, "What the file needs"),
        el("p", { class: "muted", style: "font-size:13.5px;margin-bottom:8px" },
          "One row per student. Column names are matched loosely, so \\u201cGuardian Phone\\u201d, \\u201cguardian_phone\\u201d and \\u201cMobile\\u201d all work."),
        el("ul", { style: "font-size:13.5px;margin:0;padding-left:18px;color:var(--ink-mid)" },
          el("li", null, el("b", null, "Required: "), "student name, guardian mobile, class, and either a date of birth or an age"),
          el("li", null, el("b", null, "Strongly recommended: "), "admission or roll number — without it, renaming a student later creates a duplicate"),
          el("li", null, el("b", null, "Dates: "), "DD/MM/YYYY. We will tell you if a date is ambiguous"),
          el("li", null, el("b", null, "Not here: "), "height, weight, vision or dental findings. Those belong to a camp, not the roster"))
      )
    );
  }

  function stepReview() {
    var rep = S.upload.report;
    var showAll = S.showAllRows;
    var problems = rep.rows.filter(function (r) { return r.issues.length > 0; });
    var shown = showAll ? rep.rows : (problems.length ? problems : rep.rows.slice(0, 25));

    function commit(allowPartial) {
      S.upload.committing = true;
      run(api("/api/admin/schools/" + S.school.id + "/roster/commit", {
        method: "POST",
        body: {
          rows: S.upload.rows, filename: S.upload.filename,
          academicYear: rep.academicYear, allowPartial: !!allowPartial
        }
      }), function (result) {
        S.upload = { step: 3, result: result, filename: rep.filename };
        S.roster = null; S.batches = null; S.classes = null;
      });
      S.upload.committing = false;
    }

    function downloadErrors() {
      var rows = [["Row","Student","Guardian phone","Class","Severity","Field","Problem"]];
      rep.rows.forEach(function (r) {
        r.issues.forEach(function (i) {
          rows.push([r.row, r.studentName, r.phone, (r.grade || "") + " " + (r.section || ""),
            i.severity, i.field, i.message]);
        });
      });
      download("roster-issues-" + rep.filename.replace(/\\.csv$/i, "") + ".csv", toCsv(rows));
    }

    return el("div", null,
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("b", null, rep.total), el("span", null, "rows in file")),
        el("div", { class: "stat ok" }, el("b", null, rep.create), el("span", null, "new students")),
        el("div", { class: "stat" }, el("b", null, rep.update), el("span", null, "will be updated")),
        el("div", { class: "stat" }, el("b", null, rep.unchanged), el("span", null, "unchanged")),
        el("div", { class: "stat err" }, el("b", null, rep.errors), el("span", null, "blocking problems")),
        el("div", { class: "stat warn" }, el("b", null, rep.warnings), el("span", null, "warnings")),
        el("div", { class: "stat" }, el("b", null, rep.guardians), el("span", null, "guardians"))
      ),
      rep.errors > 0
        ? el("div", { class: "banner err" },
            el("b", null, rep.errors + " row" + (rep.errors === 1 ? "" : "s") + " cannot be imported. "),
            "Fix them in your spreadsheet and upload again, or import everything else and deal with these separately.")
        : el("div", { class: "banner ok" }, "Every row can be imported."),
      rep.knownClasses.length === 0
        ? el("div", { class: "banner info" },
            "No classes are configured for " + rep.academicYear + " yet, so class names were not checked. Any classes in this file will be created.")
        : null,
      el("div", { class: "rowline", style: "margin-bottom:14px" },
        el("button", {
          class: "primary", disabled: S.busy || rep.errors > 0,
          onclick: function () { commit(false); }
        }, S.busy ? "Importing..." : "Import " + (rep.create + rep.update) + " students"),
        rep.errors > 0
          ? el("button", { disabled: S.busy, onclick: function () { commit(true); } },
              "Import the " + (rep.create + rep.update) + " good rows, skip the rest")
          : null,
        (rep.errors + rep.warnings) > 0
          ? el("button", { onclick: downloadErrors }, "Download the problem list")
          : null,
        el("button", { onclick: function () { set({ upload: { step: 1 }, showAllRows: false }); } }, "Choose a different file")
      ),
      el("div", { class: "rowline", style: "margin-bottom:10px" },
        el("h3", { style: "flex:1" },
          showAll ? "Every row" : (problems.length ? "Rows needing attention" : "First 25 rows")),
        rep.rows.length > shown.length || showAll
          ? el("button", { class: "link", onclick: function () { set({ showAllRows: !showAll }); } },
              showAll ? "Show only problems" : "Show all " + rep.total + " rows")
          : null
      ),
      el("div", { class: "tw" },
        el("table", null,
          el("thead", null, el("tr", null,
            el("th", { class: "num" }, "Row"), el("th", null, "Student"), el("th", null, "Class"),
            el("th", null, "DOB"), el("th", null, "Guardian"), el("th", null, "Action"),
            el("th", null, "Notes"))),
          el("tbody", null, shown.map(function (r) {
            var hasErr = r.issues.some(function (i) { return i.severity === "error"; });
            var hasWarn = r.issues.some(function (i) { return i.severity === "warning"; });
            return el("tr", { class: hasErr ? "rowerr" : hasWarn ? "rowwarn" : "" },
              el("td", { class: "num muted" }, r.row),
              el("td", null, r.studentName || el("span", { class: "muted" }, "—")),
              el("td", null, (r.grade || "") + (r.section ? " " + r.section : "")),
              el("td", { class: "mono", style: "font-size:12.5px" },
                r.dob || (r.age !== null ? "age " + r.age : el("span", { class: "muted" }, "—"))),
              el("td", null,
                el("div", null, r.guardianName || el("span", { class: "muted" }, "—")),
                el("div", { class: "muted mono", style: "font-size:12px" }, r.phone)),
              el("td", null, el("span", {
                class: "pill " + (r.action === "create" ? "ok" : r.action === "update" ? "info"
                  : r.action === "skip" ? "err" : "mute")
              }, r.action)),
              el("td", null, r.issues.length
                ? el("ul", { class: "issues" }, r.issues.map(function (i) {
                    return el("li", { class: i.severity === "error" ? "e" : "w" }, i.message);
                  }))
                : el("span", { class: "muted" }, "—")));
          })))
      )
    );
  }

  function stepDone() {
    var r = S.upload.result;
    return el("div", null,
      el("div", { class: "banner ok" },
        el("b", null, "Roster imported. "),
        r.create + " students added, " + r.update + " updated, " + r.unchanged + " already up to date."),
      el("div", { class: "stats" },
        el("div", { class: "stat ok" }, el("b", null, r.create), el("span", null, "added")),
        el("div", { class: "stat" }, el("b", null, r.update), el("span", null, "updated")),
        el("div", { class: "stat" }, el("b", null, r.unchanged), el("span", null, "unchanged")),
        el("div", { class: "stat" }, el("b", null, r.guardians), el("span", null, "guardians")),
        r.errors ? el("div", { class: "stat err" }, el("b", null, r.errors), el("span", null, "skipped")) : null
      ),
      el("div", { class: "card" },
        el("h3", { style: "margin-bottom:8px" }, "What happens next"),
        el("p", { class: "muted", style: "font-size:13.5px;margin-bottom:0" },
          "These students are on the roll for " + r.academicYear + ". Guardians cannot see anything yet — " +
          "they are invited once a camp is scheduled and they have given consent for it.")
      ),
      el("button", { class: "primary", onclick: function () { set({ upload: null, tab: "roster", notice: "" }); loadTab(); } },
        "Back to the roster")
    );
  }

  // ── history ───────────────────────────────────────────────
  function tabHistory() {
    if (!S.batches) return el("div", { class: "card empty" }, "Loading history...");
    if (!S.batches.length) return el("div", { class: "card empty" }, "No roster uploads yet.");
    return el("div", { class: "tw" },
      el("table", null,
        el("thead", null, el("tr", null,
          el("th", null, "When"), el("th", null, "File"), el("th", null, "By"), el("th", null, "Year"),
          el("th", { class: "num" }, "Rows"), el("th", { class: "num" }, "Added"),
          el("th", { class: "num" }, "Updated"), el("th", { class: "num" }, "Skipped"))),
        el("tbody", null, S.batches.map(function (b) {
          return el("tr", null,
            el("td", null, fmtDate(b.createdAt)),
            el("td", null, b.filename || el("span", { class: "muted" }, "—")),
            el("td", null, b.adminName || el("span", { class: "muted" }, "—")),
            el("td", null, b.academicYear),
            el("td", { class: "num" }, b.total),
            el("td", { class: "num" }, b.created),
            el("td", { class: "num" }, b.updated),
            el("td", { class: "num" }, b.errors
              ? el("span", { class: "pill err" }, b.errors) : el("span", { class: "muted" }, "0")));
        }))));
  }

  // ── helpers ───────────────────────────────────────────────
  function isOps() { return S.auth && (S.auth.role === "ADMIN" || S.auth.role === "SUPERADMIN"); }
  function trim(s) { return String(s).trim(); }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) +
      " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  // ── render ────────────────────────────────────────────────
  function render() {
    var root = document.getElementById("root");
    clear(root);

    if (!S.auth) { add(root, viewSignIn()); return; }

    add(root, el("div", { class: "top" },
      el("div", { class: "top-in" },
        el("div", {
          class: "logo", style: "cursor:pointer",
          onclick: function () { if (isOps()) { set({ view: "schools", error: "", notice: "" }); } }
        }, el("span", { class: "dot" }), "VitaHero"),
        el("span", { class: "spacer" }),
        el("div", { class: "whoami" },
          el("b", null, S.auth.name),
          S.auth.role === "SCHOOL_ADMIN" ? "School administrator" : "VitaHero operations"),
        el("button", { class: "sm", onclick: signOut }, "Sign out")
      )));

    var body = el("div", { class: "wrap" });
    if (S.view === "newSchool") add(body, viewNewSchool());
    else if (S.view === "school" && S.school) add(body, viewSchool());
    else add(body, viewSchools());
    add(root, body);
  }

  // ── boot ──────────────────────────────────────────────────
  var saved = loadAuth();
  if (saved) {
    S.auth = saved;
    api("/api/admin/schools").then(function (d) {
      S.schools = d.schools;
      if (S.auth.role === "SCHOOL_ADMIN" && d.schools.length === 1) {
        S.school = d.schools[0]; S.view = "school"; S.tab = "roster";
        render(); loadTab();
      } else render();
    }).catch(function () {
      // A stale key or an expired session should land on sign-in, not an error page.
      signOut();
    });
  }
  render();
})();
</script>
</body>
</html>`;
