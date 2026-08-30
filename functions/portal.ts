// The VitaHero administration console, served at /admin.
//
// Dependency-free on purpose: no build step, no CDN, no framework. It ships
// with the worker, so there is one thing to deploy and one place the API
// contract lives.
//
// Four audiences share it, and each sees only their own surface:
//   ops          every school, every camp
//   school admin one school: roster, camps, people, consent
//   screener     the camps they are assigned to, camp-day capture only
//   physician    the camps they are assigned to, review and release
//
// The portal JS below avoids template literals so this file can hold it in one
// without escaping every backtick.

export const PORTAL_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VitaHero Console</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>
  :root {
    --brand:#E86A15; --brand-dk:#C4560C; --brand-sf:#FDF1E7;
    --nav:#101B26; --nav-2:#18262F; --nav-tx:#93A5B3; --nav-ac:#F2A15C;
    --ink:#0F1B24; --ink-2:#4A5C68; --ink-3:#7B8C98;
    --bg:#F2F5F7; --card:#FFFFFF; --sunk:#F5F8FA;
    --line:#DFE6EB; --line-2:#EDF1F4;
    --ok:#0E7A57; --ok-bg:#E2F1EB;
    --warn:#9A6608; --warn-bg:#FBF0D9;
    --err:#B3312A; --err-bg:#FBE6E3;
    --info:#0F6C93; --info-bg:#E2F1F8;
    --mute:#6B7A85; --mute-bg:#EDF1F4;
    --sh:0 1px 2px rgba(15,27,36,.05),0 1px 3px rgba(15,27,36,.04);
    --sh-lg:0 4px 6px -2px rgba(15,27,36,.05),0 12px 24px -8px rgba(15,27,36,.14);
    --r:8px;
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  body{
    margin:0;background:var(--bg);color:var(--ink);
    font:14px/1.55 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  h1,h2,h3,h4{margin:0;line-height:1.25;letter-spacing:-.011em}
  h1{font-size:23px;font-weight:680}
  h2{font-size:16px;font-weight:650}
  h3{font-size:14px;font-weight:650}
  h4{font-size:12px;font-weight:650;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-3)}
  p{margin:0 0 12px}
  a{color:var(--brand-dk)}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em}

  /* ── shell ── */
  .shell{display:grid;grid-template-columns:232px 1fr;min-height:100vh}
  .nav{background:var(--nav);color:#fff;display:flex;flex-direction:column;position:sticky;top:0;height:100vh}
  .brand{display:flex;align-items:center;gap:10px;padding:18px 18px 16px;font-weight:700;font-size:15px;letter-spacing:-.02em}
  .brand .dot{width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,var(--brand),#F5B764);flex:none}
  .navsec{padding:6px 10px}
  .navsec h4{color:#5D707E;padding:10px 8px 6px;font-size:10.5px}
  .navi{
    display:flex;align-items:center;gap:9px;width:100%;text-align:left;
    background:none;border:none;color:var(--nav-tx);font:inherit;font-weight:500;
    padding:8px 10px;border-radius:6px;cursor:pointer;margin-bottom:1px;
  }
  .navi:hover{background:var(--nav-2);color:#fff}
  .navi.on{background:var(--nav-2);color:#fff;font-weight:600}
  .navi.on .ic{color:var(--nav-ac)}
  .ic{width:16px;text-align:center;flex:none;opacity:.9}
  .navfoot{margin-top:auto;padding:14px;border-top:1px solid #223140;font-size:12.5px;color:var(--nav-tx)}
  .navfoot b{display:block;color:#fff;font-weight:600;font-size:13px}
  .navfoot .role{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#5D707E;margin-top:1px}
  .navfoot button{margin-top:10px;width:100%;background:none;border:1px solid #2C3E4E;color:var(--nav-tx);
    padding:6px;border-radius:6px;font:inherit;font-size:12.5px;cursor:pointer}
  .navfoot button:hover{background:var(--nav-2);color:#fff}

  .main{min-width:0;display:flex;flex-direction:column}
  .bar{
    background:var(--card);border-bottom:1px solid var(--line);padding:14px 26px;
    display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:10;min-height:60px;
  }
  .bar .grow{flex:1;min-width:0}
  .crumb{font-size:12.5px;color:var(--ink-3);margin-bottom:2px}
  .crumb button{background:none;border:none;color:var(--ink-3);font:inherit;padding:0;cursor:pointer;text-decoration:underline}
  .crumb button:hover{color:var(--brand-dk)}
  .content{padding:24px 26px 64px;flex:1}

  /* ── controls ── */
  button,.btn{
    font:inherit;font-weight:550;cursor:pointer;border:1px solid var(--line);
    background:var(--card);color:var(--ink);padding:7px 13px;border-radius:6px;
    transition:background .12s,border-color .12s;white-space:nowrap;
  }
  button:hover:not(:disabled){background:var(--sunk);border-color:#CFD9E0}
  button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--brand);outline-offset:1px}
  button:disabled{opacity:.45;cursor:not-allowed}
  button.pri{background:var(--brand);border-color:var(--brand);color:#fff}
  button.pri:hover:not(:disabled){background:var(--brand-dk);border-color:var(--brand-dk)}
  button.ghost{border-color:transparent;background:none}
  button.ghost:hover:not(:disabled){background:var(--mute-bg)}
  button.dang{color:var(--err);border-color:#EBC8C4}
  button.dang:hover:not(:disabled){background:var(--err-bg)}
  button.lnk{border:none;background:none;color:var(--brand-dk);padding:2px 3px;text-decoration:underline;font-weight:500}
  button.lnk:hover:not(:disabled){background:none;color:var(--brand)}
  button.sm{padding:4px 9px;font-size:12.5px}
  button.big{padding:10px 18px;font-size:15px}

  label{display:block;font-size:12.5px;font-weight:600;margin-bottom:5px;color:var(--ink-2)}
  input[type=text],input[type=tel],input[type=email],input[type=number],input[type=date],select,textarea{
    font:inherit;width:100%;padding:7px 10px;border:1px solid var(--line);border-radius:6px;
    background:var(--card);color:var(--ink);
  }
  textarea{min-height:80px;resize:vertical;line-height:1.5}
  .fld{margin-bottom:14px}
  .hint{font-size:12px;color:var(--ink-3);margin-top:4px;line-height:1.45}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
  .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:0 14px}
  @media(max-width:760px){.g2,.g3{grid-template-columns:1fr}}

  .chips{display:flex;flex-wrap:wrap;gap:7px}
  .chip{
    display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;
    border:1px solid var(--line);border-radius:18px;padding:5px 12px 5px 9px;cursor:pointer;
    user-select:none;background:var(--card);
  }
  .chip input{margin:0;accent-color:var(--brand)}
  .chip.on{background:var(--brand-sf);border-color:#EFC49C}

  /* ── surfaces ── */
  .card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh);margin-bottom:16px}
  .card-b{padding:18px 20px}
  .card-h{padding:14px 20px;border-bottom:1px solid var(--line-2);display:flex;align-items:center;gap:12px}
  .card-h h2{flex:1;min-width:0}
  .card-f{padding:12px 20px;border-top:1px solid var(--line-2);background:var(--sunk);border-radius:0 0 var(--r) var(--r)}

  .tw{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--sh)}
  table{border-collapse:collapse;width:100%;font-size:13.5px}
  th,td{text-align:left;padding:9px 14px;border-bottom:1px solid var(--line-2);vertical-align:middle}
  th{background:var(--sunk);font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-2);font-weight:650;white-space:nowrap}
  tbody tr:last-child td{border-bottom:none}
  tbody tr.click{cursor:pointer}
  tbody tr.click:hover{background:var(--sunk)}
  .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}

  .pill{display:inline-block;font-size:11px;font-weight:650;letter-spacing:.03em;text-transform:uppercase;
    padding:2px 7px;border-radius:4px;white-space:nowrap}
  .pill.ok{background:var(--ok-bg);color:var(--ok)}
  .pill.warn{background:var(--warn-bg);color:var(--warn)}
  .pill.err{background:var(--err-bg);color:var(--err)}
  .pill.info{background:var(--info-bg);color:var(--info)}
  .pill.mute{background:var(--mute-bg);color:var(--mute)}
  .code{font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:650;background:var(--sunk);
    border:1px solid var(--line);border-radius:5px;padding:2px 8px;letter-spacing:.05em;font-size:12.5px}

  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:1px;background:var(--line);
    border:1px solid var(--line);border-radius:var(--r);overflow:hidden;margin-bottom:18px;box-shadow:var(--sh)}
  .stat{background:var(--card);padding:13px 16px}
  .stat b{display:block;font-size:21px;font-weight:680;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.2}
  .stat span{display:block;font-size:11.5px;color:var(--ink-3);margin-top:2px;line-height:1.35}
  .stat.ok b{color:var(--ok)} .stat.warn b{color:var(--warn)}
  .stat.err b{color:var(--err)} .stat.info b{color:var(--info)}

  .msg{border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:13.5px;border:1px solid transparent}
  .msg.err{background:var(--err-bg);color:var(--err);border-color:#F0D2CE}
  .msg.ok{background:var(--ok-bg);color:var(--ok);border-color:#C6E3D8}
  .msg.warn{background:var(--warn-bg);color:var(--warn);border-color:#EEDFB6}
  .msg.info{background:var(--info-bg);color:var(--info);border-color:#C3E2F0}

  .tabs{display:flex;gap:2px;border-bottom:1px solid var(--line);margin-bottom:20px;overflow-x:auto}
  .tab{border:none;background:none;padding:9px 14px;font-weight:600;font-size:13.5px;color:var(--ink-3);
    border-bottom:2px solid transparent;border-radius:0;white-space:nowrap}
  .tab:hover{background:none;color:var(--ink)}
  .tab.on{color:var(--brand-dk);border-bottom-color:var(--brand)}
  .tab .n{font-size:11px;background:var(--mute-bg);color:var(--mute);border-radius:9px;padding:1px 6px;margin-left:5px;font-weight:650}
  .tab.on .n{background:var(--brand-sf);color:var(--brand-dk)}

  .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .muted{color:var(--ink-3)}
  .empty{text-align:center;padding:44px 20px;color:var(--ink-3)}
  .empty h3{color:var(--ink);margin-bottom:6px}

  /* ── sign-in ── */
  .sin{max-width:392px;margin:9vh auto;padding:0 20px}
  .modes{display:flex;gap:2px;background:var(--mute-bg);padding:3px;border-radius:7px;margin-bottom:18px}
  .modes button{flex:1;border:none;background:none;font-size:13px;padding:6px;border-radius:5px;font-weight:550}
  .modes button.on{background:var(--card);box-shadow:var(--sh);font-weight:650}

  /* ── screening ── */
  .split{display:grid;grid-template-columns:280px 1fr;gap:18px;align-items:start}
  @media(max-width:900px){.split{grid-template-columns:1fr}}
  .plist{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;box-shadow:var(--sh);
    max-height:74vh;overflow-y:auto}
  .pitem{display:block;width:100%;text-align:left;border:none;border-bottom:1px solid var(--line-2);background:none;
    padding:10px 14px;border-radius:0;font:inherit}
  .pitem:hover{background:var(--sunk)}
  .pitem.on{background:var(--brand-sf);box-shadow:inset 3px 0 0 var(--brand)}
  .pitem b{display:block;font-weight:600;font-size:13.5px}
  .pitem .sub{font-size:12px;color:var(--ink-3);display:flex;gap:6px;align-items:center;margin-top:2px}

  .chk{border:1px solid var(--line);border-radius:var(--r);margin-bottom:12px;overflow:hidden}
  .chk-h{background:var(--sunk);padding:9px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line-2)}
  .chk-h b{flex:1;font-size:13.5px}
  .chk-b{padding:14px}
  .flagline{font-size:12.5px;padding:8px 14px;border-top:1px solid var(--line-2);background:var(--card)}

  .kv{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:13.5px}
  .kv dt{color:var(--ink-3)}
  .kv dd{margin:0;font-weight:550}

  .drop{border:2px dashed var(--line);border-radius:var(--r);padding:32px 20px;text-align:center;background:var(--card)}
  .drop.over{border-color:var(--brand);background:var(--brand-sf)}
  .steps{display:flex;gap:7px;align-items:center;margin-bottom:18px;font-size:12.5px;flex-wrap:wrap}
  .step{display:flex;align-items:center;gap:6px;color:var(--ink-3)}
  .step b{width:20px;height:20px;border-radius:50%;background:var(--mute-bg);color:var(--mute);
    display:grid;place-items:center;font-size:11px;font-weight:650}
  .step.on{color:var(--ink);font-weight:600}
  .step.on b{background:var(--brand);color:#fff}
  .step.done b{background:var(--ok);color:#fff}
  .sep{width:16px;height:1px;background:var(--line)}
  .issues{margin:3px 0 0;padding-left:15px;font-size:12px}
  .issues li.e{color:var(--err)} .issues li.w{color:var(--warn)}
  tbody tr.rowerr{background:var(--err-bg)} tbody tr.rowwarn{background:var(--warn-bg)}

  @media(max-width:820px){
    .shell{grid-template-columns:1fr}
    .nav{position:static;height:auto;flex-direction:row;flex-wrap:wrap;align-items:center;padding-bottom:8px}
    .navsec{display:flex;gap:4px;padding:0 10px 8px;overflow-x:auto;flex:1}
    .navsec h4{display:none}
    .navi{width:auto;margin:0}
    .navfoot{margin:0;border:none;padding:8px 14px;display:flex;align-items:center;gap:12px}
    .navfoot button{width:auto;margin:0}
    .content{padding:18px 16px 48px}.bar{padding:12px 16px}
  }
</style>
</head>
<body><div id="root"></div>
<script>
(function () {
  "use strict";

  // ── dom ──
  function el(tag, props) {
    var n = document.createElement(tag), p = props || {}, k, v;
    for (k in p) {
      if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
      v = p[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "value") n.value = v;
      else if (k === "checked" || k === "disabled" || k === "selected") n[k] = !!v;
      else n.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  }
  function add(par, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(par, x); }); return; }
    par.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  // ── state ──
  var S = {
    auth: null, view: "overview", busy: false, error: "", notice: "",
    overview: null, schools: [], school: null, schoolTab: "roster",
    classes: null, admins: null, staff: null, roster: null, batches: null,
    camps: null, camp: null, campTab: "setup", participants: null, queue: null,
    screenKid: null, screenForm: null, reviewKid: null, reviewData: null,
    myCamps: null, upload: null, otp: null, signMode: "otp", form: null,
    referrals: null, report: null, corrections: null, refKid: null, refDetail: null,
    programme: null, rollover: null, refForm: null, refFilter: "",
  };
  function set(p) { for (var k in p) S[k] = p[k]; render(); }

  var CHECKS = ["Height & weight","Vision","Dental","Haemoglobin","ENT","Skin","Spine","Immunisation review"];
  var ACUITY = ["6/6","6/9","6/12","6/18","6/24","6/36","6/60","<6/60"];
  var CADENCE = [["ANNUAL","Once a year"],["BIANNUAL","Twice a year"],["QUARTERLY","Every quarter"],["ADHOC","As arranged"]];

  // ── auth storage ──
  function saveAuth(a) { try { localStorage.setItem("vh_console", JSON.stringify(a)); } catch (e) {} }
  function loadAuth() { try { var r = localStorage.getItem("vh_console"); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function signOut() {
    try { localStorage.removeItem("vh_console"); } catch (e) {}
    S.auth = null; S.view = "overview"; S.school = null; S.camp = null; render();
  }

  // ── api ──
  function api(path, opts) {
    var o = opts || {}, h = { "Content-Type": "application/json" };
    if (S.auth && S.auth.mode === "key") h["X-Admin-Key"] = S.auth.key;
    if (S.auth && S.auth.mode === "session") h["Authorization"] = "Bearer " + S.auth.token;
    return fetch(path, { method: o.method || "GET", headers: h, body: o.body ? JSON.stringify(o.body) : undefined })
      .then(function (r) {
        return r.text().then(function (t) {
          var d = null;
          try { d = t ? JSON.parse(t) : null; } catch (e) { d = { error: t }; }
          if (!r.ok) { var e2 = new Error((d && d.error) || "Request failed (" + r.status + ")"); e2.code = d && d.code; throw e2; }
          return d;
        });
      });
  }
  function run(p, ok) {
    set({ busy: true, error: "" });
    p.then(function (d) { S.busy = false; if (ok) ok(d); render(); })
     .catch(function (e) { set({ busy: false, error: e.message || "Something went wrong" }); });
  }

  // ── role helpers ──
  function role() { return S.auth ? S.auth.role : ""; }
  function isOps() { return role() === "ADMIN" || role() === "SUPERADMIN"; }
  function isSchoolAdmin() { return role() === "SCHOOL_ADMIN"; }
  function isClinical() { return role() === "SCREENER" || role() === "PHYSICIAN"; }
  function canManage() { return isOps() || isSchoolAdmin(); }
  function roleLabel() {
    var m = { ADMIN: "VitaHero operations", SUPERADMIN: "VitaHero operations",
      SCHOOL_ADMIN: "School administrator", SCREENER: "Screening team", PHYSICIAN: "Supervising physician" };
    return m[role()] || "";
  }

  // ── csv ──
  function parseCsv(text) {
    var rows = [], row = [], f = "", q = false, i = 0;
    text = text.replace(/^\\uFEFF/, "");
    while (i < text.length) {
      var c = text.charAt(i);
      if (q) {
        if (c === '"') { if (text.charAt(i + 1) === '"') { f += '"'; i += 2; continue; } q = false; i++; continue; }
        f += c; i++; continue;
      }
      if (c === '"') { q = true; i++; continue; }
      if (c === ",") { row.push(f); f = ""; i++; continue; }
      if (c === "\\r") { i++; continue; }
      if (c === "\\n") { row.push(f); rows.push(row); row = []; f = ""; i++; continue; }
      f += c; i++;
    }
    if (f.length || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ""; }); });
  }
  function csvToObjects(t) {
    var g = parseCsv(t);
    if (g.length < 2) return { headers: [], rows: [] };
    var hd = g[0].map(function (h) { return String(h).trim(); }), out = [];
    for (var i = 1; i < g.length; i++) {
      var o = {};
      for (var j = 0; j < hd.length; j++) if (hd[j]) o[hd[j]] = g[i][j] === undefined ? "" : g[i][j];
      out.push(o);
    }
    return { headers: hd, rows: out };
  }
  function toCsv(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        var s = c === null || c === undefined ? "" : String(c);
        return /[",\\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(",");
    }).join("\\n");
  }
  function download(name, text) {
    var b = new Blob([text], { type: "text/csv;charset=utf-8" }), u = URL.createObjectURL(b);
    var a = document.createElement("a"); a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
  }

  // ── small helpers ──
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function trim(s) { return String(s).trim(); }
  function fmtDate(iso) {
    if (!iso) return "\\u2014";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  function flagPill(f) {
    var m = { GOOD: "ok", WATCH: "warn", ALERT: "err", NOT_MEASURED: "mute" };
    var t = { GOOD: "On track", WATCH: "Watch", ALERT: "Refer", NOT_MEASURED: "Not measured" };
    return el("span", { class: "pill " + (m[f] || "mute") }, t[f] || f);
  }
  function statusPill(s) {
    var m = { DRAFT: "mute", SCHEDULED: "info", IN_PROGRESS: "warn", SCREENED: "warn",
      RELEASED: "ok", CANCELLED: "mute", NOT_SCREENED: "mute", APPROVED: "ok",
      PENDING: "mute", GRANTED: "ok", DECLINED: "err", PAPER: "ok",
      PRESENT: "ok", ABSENT: "mute", REFUSED: "err", UNKNOWN: "mute" };
    var t = { IN_PROGRESS: "In progress", NOT_SCREENED: "Not screened", PAPER: "Paper consent" };
    return el("span", { class: "pill " + (m[s] || "mute") },
      t[s] || (s || "").charAt(0) + (s || "").slice(1).toLowerCase().replace(/_/g, " "));
  }
  function urgencyPill(u) {
    if (!u || u === "NONE") return null;
    var m = { ROUTINE: "info", SOON: "warn", URGENT: "err" };
    return el("span", { class: "pill " + (m[u] || "mute") }, u === "URGENT" ? "Urgent" : u === "SOON" ? "See soon" : "Routine");
  }

  // ══════════════════════════════════════ sign in
  function viewSignIn() {
    var keyI, phoneI, otpI;
    function useKey() {
      var k = keyI.value.trim();
      if (!k) { set({ error: "Enter the admin API key" }); return; }
      S.auth = { mode: "key", key: k, name: "VitaHero Ops", role: "SUPERADMIN", schoolId: null };
      run(api("/api/admin/overview"), function (d) { saveAuth(S.auth); S.overview = d; S.view = "overview"; });
    }
    function send() {
      var p = phoneI.value.trim();
      if (!p) { set({ error: "Enter your mobile number" }); return; }
      run(api("/api/auth/phone/send", { method: "POST", body: { phone: p } }),
        function () { S.otp = { phone: p }; S.notice = "Code sent to " + p; });
    }
    function verify() {
      var c = otpI.value.trim();
      if (!c) { set({ error: "Enter the code" }); return; }
      run(api("/api/auth/phone/verify", { method: "POST", body: { phone: S.otp.phone, otp: c } }), function (d) {
        var p = d.profile || {};
        if (["SCHOOL_ADMIN","SCREENER","PHYSICIAN","ADMIN","SUPERADMIN"].indexOf(p.role) < 0) {
          S.error = "That number is not registered as staff."; S.auth = null; return;
        }
        S.auth = { mode: "session", token: d.token, name: p.name || "Staff", role: p.role, schoolId: p.school_id || null };
        saveAuth(S.auth); S.otp = null; S.notice = ""; boot();
      });
    }
    return el("div", { class: "sin" },
      el("div", { class: "brand", style: "justify-content:center;color:var(--ink);margin-bottom:16px;padding:0" },
        el("span", { class: "dot" }), "VitaHero Console"),
      el("div", { class: "card" }, el("div", { class: "card-b" },
        el("h2", { style: "margin-bottom:4px" }, "Sign in"),
        el("p", { class: "muted", style: "font-size:13px" }, "For school staff, screening teams and VitaHero operations."),
        el("div", { class: "modes" },
          el("button", { class: S.signMode === "otp" ? "on" : "", onclick: function () { set({ signMode: "otp", error: "" }); } }, "Staff sign-in"),
          el("button", { class: S.signMode === "key" ? "on" : "", onclick: function () { set({ signMode: "key", error: "" }); } }, "Ops key")),
        S.error ? el("div", { class: "msg err" }, S.error) : null,
        S.notice ? el("div", { class: "msg ok" }, S.notice) : null,
        S.signMode === "key"
          ? el("div", null,
              el("div", { class: "fld" }, el("label", null, "Admin API key"),
                keyI = el("input", { type: "text", placeholder: "Paste your key",
                  onkeydown: function (e) { if (e.key === "Enter") useKey(); } }),
                el("div", { class: "hint" }, "The ADMIN_API_KEY set on the worker.")),
              el("button", { class: "pri", style: "width:100%", disabled: S.busy, onclick: useKey }, S.busy ? "Checking\\u2026" : "Sign in"))
          : (!S.otp
              ? el("div", null,
                  el("div", { class: "fld" }, el("label", null, "Mobile number"),
                    phoneI = el("input", { type: "tel", placeholder: "98765 43210",
                      onkeydown: function (e) { if (e.key === "Enter") send(); } }),
                    el("div", { class: "hint" }, "The number VitaHero registered for you.")),
                  el("button", { class: "pri", style: "width:100%", disabled: S.busy, onclick: send }, S.busy ? "Sending\\u2026" : "Send code"))
              : el("div", null,
                  el("div", { class: "fld" }, el("label", null, "Six-digit code"),
                    otpI = el("input", { type: "text", inputmode: "numeric", maxlength: "6", placeholder: "000000",
                      onkeydown: function (e) { if (e.key === "Enter") verify(); } })),
                  el("button", { class: "pri", style: "width:100%", disabled: S.busy, onclick: verify }, S.busy ? "Verifying\\u2026" : "Verify and sign in"),
                  el("button", { class: "lnk", style: "display:block;margin:10px auto 0",
                    onclick: function () { set({ otp: null, notice: "" }); } }, "Use a different number")))
      )));
  }

  // ══════════════════════════════════════ loaders
  function boot() {
    if (isClinical()) { S.view = "mycamps"; loadMyCamps(); return; }
    run(api("/api/admin/overview"), function (d) {
      S.overview = d; S.view = "overview";
      api("/api/admin/schools").then(function (r) {
        S.schools = r.schools;
        if (isSchoolAdmin() && r.schools.length === 1) S.school = r.schools[0];
        render();
      }).catch(function () {});
    });
  }
  function loadSchools() { run(api("/api/admin/schools"), function (d) { S.schools = d.schools; S.view = "schools"; }); }
  function loadMyCamps() { run(api("/api/admin/my-camps"), function (d) { S.myCamps = d.camps; S.view = "mycamps"; }); }

  function openSchool(id, tab) {
    run(api("/api/admin/schools/" + encodeURIComponent(id)), function (d) {
      S.school = d.school; S.view = "school"; S.schoolTab = tab || "roster";
      S.classes = null; S.admins = null; S.staff = null; S.roster = null; S.batches = null;
      S.camps = null; S.upload = null; S.form = null;
      S.referrals = null; S.report = null; S.corrections = null; S.refKid = null;
      loadSchoolTab();
    });
  }
  function loadSchoolTab() {
    var id = S.school.id, t = S.schoolTab;
    if (t === "roster" && !S.roster) run(api("/api/admin/schools/" + id + "/roster?limit=500"), function (d) { S.roster = d; });
    else if (t === "camps" && !S.camps) run(api("/api/admin/schools/" + id + "/camps"), function (d) { S.camps = d.camps; });
    else if (t === "classes" && !S.classes) run(api("/api/admin/schools/" + id + "/classes"), function (d) { S.classes = d; });
    else if (t === "people" && !S.admins) {
      run(api("/api/admin/schools/" + id + "/admins"), function (d) {
        S.admins = d.admins;
        api("/api/admin/schools/" + id + "/staff").then(function (r) { S.staff = r.staff; render(); }).catch(function () {});
      });
    }
    else if (t === "history" && !S.batches) run(api("/api/admin/schools/" + id + "/roster/batches"), function (d) { S.batches = d.batches; });
    else if (t === "referrals" && !S.referrals) run(api("/api/admin/schools/" + id + "/referrals"), function (d) { S.referrals = d; });
    else if (t === "report" && !S.report) run(api("/api/admin/schools/" + id + "/report"), function (d) { S.report = d; });
    else if (t === "requests" && !S.corrections) run(api("/api/admin/schools/" + id + "/corrections"), function (d) { S.corrections = d.corrections; });
  }

  function openCamp(id, tab) {
    run(api("/api/admin/camps/" + encodeURIComponent(id)), function (d) {
      S.camp = d; S.view = "camp"; S.campTab = tab || defaultCampTab(d);
      S.participants = null; S.queue = null; S.screenKid = null; S.reviewKid = null;
      loadCampTab();
    });
  }
  function defaultCampTab(d) {
    if (d.can.review && !d.can.schedule) return "review";
    if (d.can.screen && !d.can.schedule) return "campday";
    return "setup";
  }
  function loadCampTab() {
    var id = S.camp.camp.id, t = S.campTab;
    if ((t === "consent" || t === "campday") && !S.participants) {
      run(api("/api/admin/camps/" + id + "/participants"), function (d) { S.participants = d.participants; });
    } else if (t === "review" && !S.queue) {
      run(api("/api/admin/camps/" + id + "/review"), function (d) { S.queue = d.queue; });
    }
  }
  function refreshCamp(tab) {
    var id = S.camp.camp.id;
    run(api("/api/admin/camps/" + id), function (d) {
      S.camp = d; S.participants = null; S.queue = null;
      if (tab) S.campTab = tab;
      loadCampTab();
    });
  }

  // ══════════════════════════════════════ overview
  function viewOverview() {
    var o = S.overview;
    if (!o) return el("div", { class: "empty" }, "Loading\\u2026");
    var cs = o.campStatus || {};
    return el("div", null,
      isOps() ? el("div", { class: "row", style: "margin-bottom:14px" },
        el("div", { style: "flex:1" }),
        el("button", { onclick: loadProgrammeReport }, S.programme ? "Hide programme report" : "Programme report")) : null,
      S.programme ? programmePanel() : null,
      el("div", { class: "stats" },
        isOps() ? el("div", { class: "stat" }, el("b", null, o.schools), el("span", null, "schools")) : null,
        el("div", { class: "stat" }, el("b", null, o.students), el("span", null, "students on roll")),
        el("div", { class: "stat" }, el("b", null, o.guardians), el("span", null, "guardians")),
        el("div", { class: "stat ok" }, el("b", null, o.guardiansActivated), el("span", null, "using the app")),
        el("div", { class: "stat info" }, el("b", null, (cs.SCHEDULED || 0) + (cs.IN_PROGRESS || 0)), el("span", null, "camps running")),
        el("div", { class: "stat" }, el("b", null, cs.RELEASED || 0), el("span", null, "camps released"))),
      el("div", { class: "card" },
        el("div", { class: "card-h" }, el("h2", null, "Camps needing attention")),
        o.upcoming.length === 0
          ? el("div", { class: "empty" },
              el("h3", null, "No camps scheduled"),
              el("p", { style: "font-size:13.5px" }, "Open a school and schedule one to get started."))
          : el("table", null,
              el("thead", null, el("tr", null,
                el("th", null, "Camp"), isOps() ? el("th", null, "School") : null, el("th", null, "Date"),
                el("th", { class: "num" }, "Children"), el("th", { class: "num" }, "Consented"),
                el("th", null, "Status"), el("th", null, ""))),
              el("tbody", null, o.upcoming.map(function (c) {
                return el("tr", { class: "click", onclick: function () { openCamp(c.id); } },
                  el("td", null, el("b", null, c.title)),
                  isOps() ? el("td", { class: "muted" }, c.schoolName) : null,
                  el("td", null, fmtDate(c.date)),
                  el("td", { class: "num" }, c.participants),
                  el("td", { class: "num" }, c.consented + " / " + c.participants),
                  el("td", null, statusPill(c.status)),
                  el("td", null, el("button", { class: "sm" }, "Open")));
              })))));
  }

  function loadProgrammeReport() {
    if (S.programme) { set({ programme: null }); return; }
    run(api("/api/admin/programme-report"), function (d) { S.programme = d; });
  }

  function programmePanel() {
    var d = S.programme, t = d.totals;
    return el("div", { class: "card" },
      el("div", { class: "card-h" }, el("h2", null, "Across every school")),
      el("div", { class: "card-b" },
        el("div", { class: "stats", style: "margin-bottom:16px" },
          el("div", { class: "stat" }, el("b", null, t.schools), el("span", null, "schools")),
          el("div", { class: "stat" }, el("b", null, t.students), el("span", null, "students")),
          el("div", { class: "stat ok" }, el("b", null, t.screened), el("span", null, "children screened")),
          el("div", { class: "stat" }, el("b", null, t.referrals), el("span", null, "referrals")),
          el("div", { class: "stat ok" }, el("b", null, t.closureRate === null ? "—" : t.closureRate + "%"),
            el("span", null, "closure rate"))),
        d.prevalence.length
          ? el("div", null, el("h4", { style: "margin-bottom:8px" }, "Anonymised prevalence"),
              el("table", { style: "margin-bottom:16px" }, el("tbody", null, d.prevalence.map(function (p2) {
                return el("tr", null, el("td", null, p2.checkType),
                  el("td", { class: "num muted" }, p2.measured + " measured"),
                  el("td", { class: "num" }, el("span", { class: "pill " + (p2.flaggedRate > 25 ? "warn" : "mute") },
                    (p2.flaggedRate === null ? "—" : p2.flaggedRate + "%") + " flagged")));
              }))))
          : null,
        el("h4", { style: "margin-bottom:8px" }, "By school"),
        el("div", { class: "tw" }, el("table", null,
          el("thead", null, el("tr", null, el("th", null, "School"), el("th", { class: "num" }, "Students"),
            el("th", { class: "num" }, "Camps"), el("th", { class: "num" }, "Released"),
            el("th", { class: "num" }, "Referrals"), el("th", { class: "num" }, "Closure"),
            el("th", { class: "num" }, "Guardians"))),
          el("tbody", null, d.schools.map(function (s) {
            return el("tr", { class: "click", onclick: function () { openSchool(s.id); } },
              el("td", null, el("b", null, s.name), el("div", { class: "muted", style: "font-size:12px" }, s.city)),
              el("td", { class: "num" }, s.students),
              el("td", { class: "num" }, s.camps),
              el("td", { class: "num" }, s.campsReleased),
              el("td", { class: "num" }, s.referrals),
              el("td", { class: "num" }, s.closureRate === null ? "—"
                : el("span", { class: "pill " + (s.closureRate > 60 ? "ok" : "warn") }, s.closureRate + "%")),
              el("td", { class: "num" }, s.guardiansActive));
          }))))));
  }

  // ══════════════════════════════════════ schools
  function viewSchools() {
    return el("div", null,
      el("div", { class: "row", style: "margin-bottom:16px" },
        el("div", { style: "flex:1" }),
        isOps() ? el("button", { class: "pri", onclick: function () { set({ view: "newSchool", form: null, error: "" }); } }, "Add school") : null),
      S.schools.length === 0
        ? el("div", { class: "card" }, el("div", { class: "empty" },
            el("h3", null, "No schools yet"),
            el("p", { style: "font-size:13.5px" }, "Add the first school to begin onboarding students."),
            isOps() ? el("button", { class: "pri", onclick: function () { set({ view: "newSchool" }); } }, "Add school") : null))
        : el("div", { class: "tw" }, el("table", null,
            el("thead", null, el("tr", null,
              el("th", null, "School"), el("th", null, "Partner code"), el("th", null, "Year"),
              el("th", { class: "num" }, "Students"), el("th", { class: "num" }, "Staff"), el("th", null, "Status"), el("th", null, ""))),
            el("tbody", null, S.schools.map(function (s) {
              return el("tr", { class: "click", onclick: function () { openSchool(s.id); } },
                el("td", null, el("b", null, s.name),
                  el("div", { class: "muted", style: "font-size:12.5px" }, [s.city, s.district].filter(Boolean).join(" \\u00b7 "))),
                el("td", null, el("span", { class: "code" }, s.partnerCode)),
                el("td", null, s.academicYear || el("span", { class: "muted" }, "\\u2014")),
                el("td", { class: "num" }, s.studentCount),
                el("td", { class: "num" }, s.adminCount),
                el("td", null, statusPill(s.active && s.status === "ACTIVE" ? "ACTIVE" : s.status)),
                el("td", null, el("button", { class: "sm" }, "Manage")));
            }))))
    );
  }

  function viewNewSchool() {
    var f = S.form || (S.form = { name: "", city: "Hyderabad", district: "", contactName: "", contactPhone: "",
      contactEmail: "", academicYear: "", campCadence: "ANNUAL", checksOffered: [], description: "" });
    function b(k) { return function (e) { f[k] = e.target.value; }; }
    function tog(c) { var i = f.checksOffered.indexOf(c); if (i >= 0) f.checksOffered.splice(i, 1); else f.checksOffered.push(c); render(); }
    function save() {
      run(api("/api/admin/schools", { method: "POST", body: f }), function (d) {
        S.form = null; S.notice = "Created " + d.school.name + ". Partner code " + d.school.partnerCode + ".";
        S.schools.push(d.school); openSchool(d.school.id, "classes");
      });
    }
    return el("div", null,
      S.error ? el("div", { class: "msg err" }, S.error) : null,
      el("div", { class: "card" },
        el("div", { class: "card-h" }, el("h2", null, "School")),
        el("div", { class: "card-b" },
          el("div", { class: "fld" }, el("label", null, "School name"),
            el("input", { type: "text", value: f.name, oninput: b("name"), placeholder: "Oakridge International School" })),
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "City"), el("input", { type: "text", value: f.city, oninput: b("city") })),
            el("div", { class: "fld" }, el("label", null, "District"), el("input", { type: "text", value: f.district, oninput: b("district"), placeholder: "Optional" }))),
          el("div", { class: "g3" },
            el("div", { class: "fld" }, el("label", null, "Contact person"), el("input", { type: "text", value: f.contactName, oninput: b("contactName") })),
            el("div", { class: "fld" }, el("label", null, "Contact mobile"), el("input", { type: "tel", value: f.contactPhone, oninput: b("contactPhone") })),
            el("div", { class: "fld" }, el("label", null, "Contact email"), el("input", { type: "email", value: f.contactEmail, oninput: b("contactEmail") }))))),
      el("div", { class: "card" },
        el("div", { class: "card-h" }, el("h2", null, "Programme")),
        el("div", { class: "card-b" },
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "Academic year"),
              el("input", { type: "text", value: f.academicYear, oninput: b("academicYear"), placeholder: "Blank uses the current year" })),
            el("div", { class: "fld" }, el("label", null, "How often camps run"),
              el("select", { onchange: b("campCadence") }, CADENCE.map(function (c) {
                return el("option", { value: c[0], selected: f.campCadence === c[0] }, c[1]); })))),
          el("div", { class: "fld" }, el("label", null, "Checks this school has agreed to"),
            el("div", { class: "chips" }, CHECKS.map(function (c) {
              var on = f.checksOffered.indexOf(c) >= 0;
              return el("label", { class: "chip" + (on ? " on" : "") },
                el("input", { type: "checkbox", checked: on, onchange: function () { tog(c); } }), c); })),
            el("div", { class: "hint" }, "A camp can only record checks on this list.")),
          el("div", { class: "fld" }, el("label", null, "Notes"), el("textarea", { oninput: b("description") }, f.description)))),
      el("div", { class: "row" },
        el("button", { class: "pri", disabled: S.busy, onclick: save }, S.busy ? "Creating\\u2026" : "Create school"),
        el("button", { onclick: function () { S.form = null; set({ view: "schools", error: "" }); } }, "Cancel")));
  }

  // ══════════════════════════════════════ school detail
  function viewSchool() {
    var s = S.school;
    var tabs = [["roster","Roster"],["camps","Camps"],["referrals","Follow-ups"],["report","Report"],
      ["classes","Classes"],["people","People"],["requests","Requests"],["programme","Programme"],["history","Uploads"]];
    return el("div", null,
      el("div", { class: "tabs" }, tabs.map(function (t) {
        return el("button", { class: "tab" + (S.schoolTab === t[0] ? " on" : ""),
          onclick: function () { S.schoolTab = t[0]; S.error = ""; S.upload = null; render(); loadSchoolTab(); } }, t[1]);
      })),
      S.error ? el("div", { class: "msg err" }, S.error) : null,
      S.notice ? el("div", { class: "msg ok" }, S.notice) : null,
      S.schoolTab === "roster" ? tabRoster()
        : S.schoolTab === "camps" ? tabCamps()
        : S.schoolTab === "referrals" ? tabReferrals()
        : S.schoolTab === "report" ? tabReport()
        : S.schoolTab === "classes" ? tabClasses()
        : S.schoolTab === "people" ? tabPeople()
        : S.schoolTab === "requests" ? tabRequests()
        : S.schoolTab === "programme" ? tabProgramme()
        : tabHistory());
  }

  function tabProgramme() {
    var s = S.school;
    var f = S.form || (S.form = { name: s.name, city: s.city, district: s.district, contactName: s.contactName,
      contactPhone: s.contactPhone, contactEmail: s.contactEmail, academicYear: s.academicYear,
      campCadence: s.campCadence, checksOffered: s.checksOffered.slice(), description: s.description });
    function b(k) { return function (e) { f[k] = e.target.value; }; }
    function tog(c) { var i = f.checksOffered.indexOf(c); if (i >= 0) f.checksOffered.splice(i, 1); else f.checksOffered.push(c); render(); }
    function save() {
      var body = {}; for (var k in f) body[k] = f[k];
      if (!isOps()) { delete body.name; delete body.campCadence; }
      run(api("/api/admin/schools/" + s.id, { method: "PATCH", body: body }), function (d) {
        S.school = d.school; S.form = null; S.notice = "Saved.";
      });
    }
    return el("div", null,
      el("div", { class: "card" }, el("div", { class: "card-h" }, el("h2", null, "School details"),
          !isOps() ? el("span", { class: "pill mute" }, "Some fields are ops-only") : null),
        el("div", { class: "card-b" },
          el("div", { class: "fld" }, el("label", null, "School name"),
            el("input", { type: "text", value: f.name, oninput: b("name"), disabled: !isOps() })),
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "City"), el("input", { type: "text", value: f.city, oninput: b("city") })),
            el("div", { class: "fld" }, el("label", null, "District"), el("input", { type: "text", value: f.district, oninput: b("district") }))),
          el("div", { class: "g3" },
            el("div", { class: "fld" }, el("label", null, "Contact person"), el("input", { type: "text", value: f.contactName, oninput: b("contactName") })),
            el("div", { class: "fld" }, el("label", null, "Contact mobile"), el("input", { type: "tel", value: f.contactPhone, oninput: b("contactPhone") })),
            el("div", { class: "fld" }, el("label", null, "Contact email"), el("input", { type: "email", value: f.contactEmail, oninput: b("contactEmail") }))))),
      el("div", { class: "card" }, el("div", { class: "card-h" }, el("h2", null, "Programme")),
        el("div", { class: "card-b" },
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "Academic year"), el("input", { type: "text", value: f.academicYear, oninput: b("academicYear") })),
            el("div", { class: "fld" }, el("label", null, "How often camps run"),
              el("select", { onchange: b("campCadence"), disabled: !isOps() }, CADENCE.map(function (c) {
                return el("option", { value: c[0], selected: f.campCadence === c[0] }, c[1]); })))),
          el("div", { class: "fld" }, el("label", null, "Checks offered"),
            el("div", { class: "chips" }, CHECKS.map(function (c) {
              var on = f.checksOffered.indexOf(c) >= 0;
              return el("label", { class: "chip" + (on ? " on" : "") },
                el("input", { type: "checkbox", checked: on, onchange: function () { tog(c); } }), c); }))),
          el("div", { class: "fld" }, el("label", null, "Notes"), el("textarea", { oninput: b("description") }, f.description)))),
      el("button", { class: "pri", disabled: S.busy, onclick: save }, S.busy ? "Saving\\u2026" : "Save changes"));
  }

  function tabClasses() {
    if (!S.classes) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\\u2026"));
    var c = S.classes;
    var g = S.form || (S.form = {
      year: c.academicYear,
      grades: c.classes.length ? uniq(c.classes.map(function (x) { return x.grade; })).join(", ") : "Class 1, Class 2, Class 3, Class 4, Class 5",
      sections: c.classes.length ? uniq(c.classes.map(function (x) { return x.section; }).filter(Boolean)).join(", ") : "A, B"
    });
    function save() {
      var grades = g.grades.split(",").map(trim).filter(Boolean);
      var sections = g.sections.split(",").map(trim).filter(Boolean);
      if (!grades.length) { set({ error: "List at least one class" }); return; }
      run(api("/api/admin/schools/" + S.school.id + "/classes", { method: "POST",
        body: { academicYear: g.year, grades: grades, sections: sections } }), function (d) {
        S.classes = d; S.form = null;
        S.notice = "Saved " + d.classes.length + " classes for " + d.academicYear + ".";
        if (d.keptBecauseInUse && d.keptBecauseInUse.length) {
          S.notice += " Kept " + d.keptBecauseInUse.join(", ") + " \\u2014 students are still enrolled.";
        }
      });
    }
    return el("div", null,
      el("div", { class: "card" },
        el("div", { class: "card-h" }, el("h2", null, "Classes and sections")),
        el("div", { class: "card-b" },
          el("p", { class: "muted", style: "font-size:13px" },
            "Every class in the school for one year. Roster uploads and camps are checked against this list."),
          el("div", { class: "g3" },
            el("div", { class: "fld" }, el("label", null, "Academic year"),
              el("input", { type: "text", value: g.year, oninput: function (e) { g.year = e.target.value; }, placeholder: "2026-27" })),
            el("div", { class: "fld" }, el("label", null, "Classes"),
              el("input", { type: "text", value: g.grades, oninput: function (e) { g.grades = e.target.value; } })),
            el("div", { class: "fld" }, el("label", null, "Sections"),
              el("input", { type: "text", value: g.sections, oninput: function (e) { g.sections = e.target.value; } }))),
          el("div", { class: "hint", style: "margin-bottom:12px" }, "Comma separated, exactly as they appear in your roster file."),
          el("button", { class: "pri", disabled: S.busy, onclick: save }, S.busy ? "Saving\\u2026" : "Save classes"))),
      c.classes.length
        ? el("div", { class: "tw" }, el("table", null,
            el("thead", null, el("tr", null, el("th", null, "Class"), el("th", null, "Section"), el("th", { class: "num" }, "Students"))),
            el("tbody", null, c.classes.map(function (x) {
              return el("tr", null, el("td", null, x.grade),
                el("td", null, x.section || el("span", { class: "muted" }, "\\u2014")),
                el("td", { class: "num" }, x.studentCount)); }))))
        : el("div", { class: "card" }, el("div", { class: "empty" }, "No classes defined for " + c.academicYear + " yet.")),
      c.classes.length ? rolloverPanel(c) : null);
  }

  function rolloverPanel(c) {
    var f = S.rollover || (S.rollover = { fromYear: c.academicYear, toYear: nextYear(c.academicYear), plan: null });
    function preview() {
      run(api("/api/admin/schools/" + S.school.id + "/rollover", { method: "POST",
        body: { fromYear: f.fromYear, toYear: f.toYear, dryRun: true } }), function (d) { f.plan = d.plan; });
    }
    function commit() {
      if (!confirm("Move every student up a class for " + f.toYear + "? Students in the final class will be marked as having left.")) return;
      run(api("/api/admin/schools/" + S.school.id + "/rollover", { method: "POST",
        body: { fromYear: f.fromYear, toYear: f.toYear } }), function (d) {
        S.rollover = null; S.classes = null; S.roster = null;
        S.notice = d.promoted + " students moved up" + (d.graduated ? ", " + d.graduated + " left the school" : "") + ".";
        loadSchoolTab();
      });
    }
    return el("div", { class: "card", style: "margin-top:16px" },
      el("div", { class: "card-h" }, el("h2", null, "Start a new academic year")),
      el("div", { class: "card-b" },
        el("p", { class: "muted", style: "font-size:13px" },
          "Moves every student up one class, using this school's own class list. Students in the final class are marked as having left — their guardians keep access to the history."),
        el("div", { class: "g2" },
          el("div", { class: "fld" }, el("label", null, "From"),
            el("input", { type: "text", value: f.fromYear, oninput: function (e) { f.fromYear = e.target.value; } })),
          el("div", { class: "fld" }, el("label", null, "To"),
            el("input", { type: "text", value: f.toYear, oninput: function (e) { f.toYear = e.target.value; } }))),
        f.plan
          ? el("div", null,
              el("table", { style: "margin-bottom:12px" }, el("tbody", null, f.plan.map(function (x) {
                return el("tr", null, el("td", null, x.grade),
                  el("td", { class: "num muted" }, x.students + " students"),
                  el("td", null, x.becomes === "LEAVING"
                    ? el("span", { class: "pill mute" }, "Leaving")
                    : el("span", null, "→ " + x.becomes)));
              }))),
              el("div", { class: "row" },
                el("button", { class: "pri", disabled: S.busy, onclick: commit }, S.busy ? "Moving…" : "Confirm rollover"),
                el("button", { onclick: function () { f.plan = null; render(); } }, "Cancel")))
          : el("button", { disabled: S.busy, onclick: preview }, S.busy ? "Checking…" : "Preview the rollover")));
  }

  function nextYear(y) {
    var m = /^(\d{4})-(\d{2})$/.exec(y || "");
    if (!m) return "";
    var a = parseInt(m[1], 10) + 1;
    var b = (a + 1) % 100;
    return a + "-" + (b < 10 ? "0" + b : String(b));
  }

  function tabPeople() {
    if (!S.admins) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\\u2026"));
    var f = S.form || (S.form = { name: "", phone: "", email: "", kind: "SCHOOL_ADMIN" });
    function addPerson() {
      if (f.kind === "SCHOOL_ADMIN") {
        run(api("/api/admin/schools/" + S.school.id + "/admins", { method: "POST", body: f }), function (d) {
          S.form = null; S.notice = d.admin.name + " can sign in with " + d.admin.phone + ".";
          S.admins = null; loadSchoolTab();
        });
      } else {
        run(api("/api/admin/schools/" + S.school.id + "/staff", { method: "POST",
          body: { name: f.name, phone: f.phone, role: f.kind } }), function (d) {
          S.form = null; S.notice = d.staff.name + " added as " + (f.kind === "SCREENER" ? "screening team" : "physician") + ".";
          S.admins = null; loadSchoolTab();
        });
      }
    }
    function removeAdmin(a) {
      if (!confirm("Remove " + a.name + "? They lose access immediately.")) return;
      run(api("/api/admin/schools/" + S.school.id + "/admins/" + encodeURIComponent(a.profileId), { method: "DELETE" }), function () {
        S.admins = S.admins.filter(function (x) { return x.profileId !== a.profileId; });
        S.notice = a.name + " no longer has access.";
      });
    }
    var people = (S.admins || []).map(function (a) { return { p: a, role: "SCHOOL_ADMIN" }; })
      .concat((S.staff || []).map(function (a) { return { p: a, role: a.role }; }));
    var roleName = { SCHOOL_ADMIN: "Administrator", SCREENER: "Screening team", PHYSICIAN: "Physician" };
    return el("div", null,
      el("div", { class: "card" },
        el("div", { class: "card-h" }, el("h2", null, "Add someone")),
        el("div", { class: "card-b" },
          el("p", { class: "muted", style: "font-size:13px" },
            "They sign in here with this mobile number and a one-time code. Use a number not already registered as a parent."),
          el("div", { class: "g3" },
            el("div", { class: "fld" }, el("label", null, "Name"),
              el("input", { type: "text", value: f.name, oninput: function (e) { f.name = e.target.value; } })),
            el("div", { class: "fld" }, el("label", null, "Mobile number"),
              el("input", { type: "tel", value: f.phone, oninput: function (e) { f.phone = e.target.value; } })),
            el("div", { class: "fld" }, el("label", null, "Role"),
              el("select", { onchange: function (e) { f.kind = e.target.value; render(); } },
                el("option", { value: "SCHOOL_ADMIN", selected: f.kind === "SCHOOL_ADMIN" }, "Administrator"),
                el("option", { value: "SCREENER", selected: f.kind === "SCREENER" }, "Screening team"),
                el("option", { value: "PHYSICIAN", selected: f.kind === "PHYSICIAN" }, "Supervising physician")))),
          el("div", { class: "hint", style: "margin-bottom:12px" },
            f.kind === "PHYSICIAN" ? "A physician reviews and approves every result before guardians see it."
              : f.kind === "SCREENER" ? "Screeners record measurements on camp day. They cannot approve or release."
              : "Administrators manage the roster, classes and camps for this school."),
          el("button", { class: "pri", disabled: S.busy, onclick: addPerson }, S.busy ? "Adding\\u2026" : "Add person"))),
      people.length
        ? el("div", { class: "tw" }, el("table", null,
            el("thead", null, el("tr", null, el("th", null, "Name"), el("th", null, "Role"),
              el("th", null, "Mobile"), el("th", null, "Status"), el("th", null, ""))),
            el("tbody", null, people.map(function (x) {
              return el("tr", null,
                el("td", null, el("b", null, x.p.name)),
                el("td", null, el("span", { class: "pill " + (x.role === "PHYSICIAN" ? "info" : x.role === "SCREENER" ? "warn" : "mute") }, roleName[x.role] || x.role)),
                el("td", { class: "mono" }, x.p.phone),
                el("td", null, el("span", { class: "pill " + (x.p.hasSignedIn ? "ok" : "mute") }, x.p.hasSignedIn ? "Active" : "Not signed in")),
                el("td", null, x.role === "SCHOOL_ADMIN"
                  ? el("button", { class: "sm dang", onclick: function () { removeAdmin(x.p); } }, "Remove") : null));
            }))))
        : el("div", { class: "card" }, el("div", { class: "empty" }, "Nobody added yet.")));
  }

  function tabHistory() {
    if (!S.batches) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\\u2026"));
    if (!S.batches.length) return el("div", { class: "card" }, el("div", { class: "empty" }, "No roster uploads yet."));
    return el("div", { class: "tw" }, el("table", null,
      el("thead", null, el("tr", null, el("th", null, "When"), el("th", null, "File"), el("th", null, "By"),
        el("th", null, "Year"), el("th", { class: "num" }, "Rows"), el("th", { class: "num" }, "Added"),
        el("th", { class: "num" }, "Updated"), el("th", { class: "num" }, "Skipped"))),
      el("tbody", null, S.batches.map(function (b) {
        return el("tr", null, el("td", null, fmtDate(b.createdAt)),
          el("td", null, b.filename || el("span", { class: "muted" }, "\\u2014")),
          el("td", null, b.adminName || el("span", { class: "muted" }, "\\u2014")),
          el("td", null, b.academicYear),
          el("td", { class: "num" }, b.total), el("td", { class: "num" }, b.created),
          el("td", { class: "num" }, b.updated),
          el("td", { class: "num" }, b.errors ? el("span", { class: "pill err" }, b.errors) : el("span", { class: "muted" }, "0")));
      }))));
  }

  // ══════════════════════════════════════ roster
  function tabRoster() {
    if (S.upload) return uploadWizard();
    if (!S.roster) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\\u2026"));
    var r = S.roster;
    var act = r.students.filter(function (s) { return s.guardianActivated; }).length;
    return el("div", null,
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("b", null, r.total), el("span", null, "students on roll")),
        el("div", { class: "stat ok" }, el("b", null, act), el("span", null, "guardians using the app")),
        el("div", { class: "stat" }, el("b", null, uniq(r.students.map(function (s) { return s.guardianPhone; })).length),
          el("span", null, "guardian numbers"))),
      el("div", { class: "row", style: "margin-bottom:14px" },
        el("button", { class: "pri", onclick: function () { set({ upload: { step: 1 }, error: "", notice: "" }); } }, "Upload roster"),
        el("button", { onclick: dlTemplate }, "Download template"),
        r.total ? el("button", { onclick: exportRoster }, "Export roster") : null),
      r.students.length === 0
        ? el("div", { class: "card" }, el("div", { class: "empty" },
            el("h3", null, "No students yet"), el("p", { style: "font-size:13.5px" }, "Set up your classes, then upload the roster CSV.")))
        : el("div", { class: "tw" }, el("table", null,
            el("thead", null, el("tr", null, el("th", null, "Student"), el("th", null, "Class"), el("th", null, "DOB"),
              el("th", null, "Guardian"), el("th", null, "Mobile"), el("th", null, "App"))),
            el("tbody", null, r.students.map(function (s) {
              return el("tr", null,
                el("td", null, el("b", null, s.name),
                  s.studentRef ? el("div", { class: "muted mono", style: "font-size:11.5px" }, s.studentRef.replace(/^sid_/, "")) : null),
                el("td", null, (s.grade || "") + (s.section ? " " + s.section : "")),
                el("td", { class: "mono" }, s.dob || el("span", { class: "muted" }, "age " + (s.age || "?"))),
                el("td", null, s.guardianName || el("span", { class: "muted" }, "\\u2014")),
                el("td", { class: "mono" }, s.guardianPhone),
                el("td", null, el("span", { class: "pill " + (s.guardianActivated ? "ok" : "mute") }, s.guardianActivated ? "Yes" : "No")));
            })))),
      r.total > r.students.length ? el("p", { class: "muted", style: "margin-top:10px;font-size:12.5px" },
        "Showing " + r.students.length + " of " + r.total + ".") : null);
  }

  function dlTemplate() {
    download("vitahero-roster-template.csv", toCsv([
      ["Admission No","Student Name","Date of Birth","Gender","Class","Section","Guardian Name","Guardian Phone"],
      ["2026/0412","Rahul Sharma","14/03/2016","Male","Class 4","B","Priya Sharma","9876543210"],
      ["2026/0413","Ananya Reddy","02/11/2015","Female","Class 5","A","Vikram Reddy","9876543211"]]));
  }
  function exportRoster() {
    var rows = [["Admission No","Student Name","Date of Birth","Gender","Class","Section","Guardian Name","Guardian Phone","Signed in"]];
    S.roster.students.forEach(function (s) {
      rows.push([s.studentRef.replace(/^sid_/, ""), s.name, s.dob, s.gender, s.grade, s.section, s.guardianName, s.guardianPhone, s.guardianActivated ? "Yes" : "No"]);
    });
    download("roster-" + S.school.partnerCode + ".csv", toCsv(rows));
  }

  function uploadWizard() {
    var u = S.upload;
    return el("div", null,
      el("button", { class: "lnk", style: "margin-bottom:10px", onclick: function () { set({ upload: null, error: "" }); } }, "\\u2190 Back to roster"),
      el("div", { class: "steps" }, stepPill(1, "Choose file", u.step), el("span", { class: "sep" }),
        stepPill(2, "Review", u.step), el("span", { class: "sep" }), stepPill(3, "Done", u.step)),
      S.error ? el("div", { class: "msg err" }, S.error) : null,
      u.step === 1 ? stepChoose() : u.step === 2 ? stepReview() : stepDone());
  }
  function stepPill(n, label, cur) {
    return el("span", { class: "step" + (cur === n ? " on" : cur > n ? " done" : "") },
      el("b", null, cur > n ? "\\u2713" : String(n)), label);
  }
  function stepChoose() {
    var input;
    function handle(file) {
      if (!file) return;
      if (!/\\.csv$/i.test(file.name)) { set({ error: "Please upload a .csv file. In Excel: File \\u2192 Save As \\u2192 CSV." }); return; }
      var rd = new FileReader();
      rd.onload = function () {
        var p = csvToObjects(String(rd.result));
        if (!p.rows.length) { set({ error: "That file has a header row but no students." }); return; }
        S.upload = { step: 1, filename: file.name, rows: p.rows };
        run(api("/api/admin/schools/" + S.school.id + "/roster/validate", { method: "POST",
          body: { rows: p.rows, filename: file.name } }), function (rep) { S.upload.report = rep; S.upload.step = 2; });
      };
      rd.onerror = function () { set({ error: "Could not read that file." }); };
      rd.readAsText(file);
    }
    return el("div", null,
      el("div", { class: "drop" + (S.dragOver ? " over" : ""),
        ondragover: function (e) { e.preventDefault(); if (!S.dragOver) set({ dragOver: true }); },
        ondragleave: function () { set({ dragOver: false }); },
        ondrop: function (e) { e.preventDefault(); S.dragOver = false; handle(e.dataTransfer.files && e.dataTransfer.files[0]); } },
        el("p", { style: "font-size:15px;font-weight:600;margin-bottom:4px" }, "Drop your roster CSV here"),
        el("p", { class: "muted", style: "font-size:13px" }, "or choose a file from your computer"),
        input = el("input", { type: "file", accept: ".csv,text/csv", style: "display:none",
          onchange: function (e) { handle(e.target.files[0]); } }),
        el("button", { class: "pri", disabled: S.busy, onclick: function () { input.click(); } }, S.busy ? "Checking\\u2026" : "Choose file"),
        el("div", { style: "margin-top:12px" }, el("button", { class: "lnk", onclick: dlTemplate }, "Download the template"))),
      el("div", { class: "card", style: "margin-top:16px" }, el("div", { class: "card-b" },
        el("h3", { style: "margin-bottom:8px" }, "What the file needs"),
        el("ul", { style: "font-size:13px;margin:0;padding-left:17px;color:var(--ink-2);line-height:1.7" },
          el("li", null, el("b", null, "Required: "), "student name, guardian mobile, class, and either a date of birth or an age"),
          el("li", null, el("b", null, "Strongly recommended: "), "admission or roll number \\u2014 without it, renaming a student later creates a duplicate"),
          el("li", null, el("b", null, "Dates: "), "DD/MM/YYYY. Ambiguous dates are flagged, not guessed"),
          el("li", null, el("b", null, "Not here: "), "height, weight, vision or dental. Those are recorded at a camp, not in the roster")))));
  }
  function stepReview() {
    var rep = S.upload.report, all = S.showAll;
    var probs = rep.rows.filter(function (r) { return r.issues.length > 0; });
    var shown = all ? rep.rows : (probs.length ? probs : rep.rows.slice(0, 25));
    function commit(partial) {
      run(api("/api/admin/schools/" + S.school.id + "/roster/commit", { method: "POST",
        body: { rows: S.upload.rows, filename: S.upload.filename, academicYear: rep.academicYear, allowPartial: !!partial } }),
        function (res) { S.upload = { step: 3, result: res }; S.roster = null; S.batches = null; S.classes = null; });
    }
    function dlIssues() {
      var rows = [["Row","Student","Guardian phone","Class","Severity","Field","Problem"]];
      rep.rows.forEach(function (r) { r.issues.forEach(function (i) {
        rows.push([r.row, r.studentName, r.phone, (r.grade || "") + " " + (r.section || ""), i.severity, i.field, i.message]); }); });
      download("roster-issues.csv", toCsv(rows));
    }
    return el("div", null,
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("b", null, rep.total), el("span", null, "rows in file")),
        el("div", { class: "stat ok" }, el("b", null, rep.create), el("span", null, "new students")),
        el("div", { class: "stat" }, el("b", null, rep.update), el("span", null, "updated")),
        el("div", { class: "stat" }, el("b", null, rep.unchanged), el("span", null, "unchanged")),
        el("div", { class: "stat err" }, el("b", null, rep.errors), el("span", null, "blocking problems")),
        el("div", { class: "stat warn" }, el("b", null, rep.warnings), el("span", null, "warnings")),
        el("div", { class: "stat" }, el("b", null, rep.guardians), el("span", null, "guardians"))),
      rep.errors > 0
        ? el("div", { class: "msg err" }, el("b", null, rep.errors + " row" + (rep.errors === 1 ? "" : "s") + " cannot be imported. "),
            "Fix them in your spreadsheet and upload again, or import the rest and handle these separately.")
        : el("div", { class: "msg ok" }, "Every row can be imported."),
      rep.knownClasses.length === 0
        ? el("div", { class: "msg info" }, "No classes are configured for " + rep.academicYear + ", so class names were not checked. Any classes in this file will be created.")
        : null,
      el("div", { class: "row", style: "margin-bottom:12px" },
        el("button", { class: "pri", disabled: S.busy || rep.errors > 0, onclick: function () { commit(false); } },
          S.busy ? "Importing\\u2026" : "Import " + (rep.create + rep.update) + " students"),
        rep.errors > 0 ? el("button", { disabled: S.busy, onclick: function () { commit(true); } },
          "Import the " + (rep.create + rep.update) + " good rows") : null,
        (rep.errors + rep.warnings) > 0 ? el("button", { onclick: dlIssues }, "Download problem list") : null,
        el("button", { onclick: function () { set({ upload: { step: 1 }, showAll: false }); } }, "Different file")),
      el("div", { class: "row", style: "margin-bottom:8px" },
        el("h3", { style: "flex:1" }, all ? "Every row" : (probs.length ? "Rows needing attention" : "First 25 rows")),
        rep.rows.length > shown.length || all
          ? el("button", { class: "lnk", onclick: function () { set({ showAll: !all }); } }, all ? "Show only problems" : "Show all " + rep.total) : null),
      el("div", { class: "tw" }, el("table", null,
        el("thead", null, el("tr", null, el("th", { class: "num" }, "Row"), el("th", null, "Student"),
          el("th", null, "Class"), el("th", null, "DOB"), el("th", null, "Guardian"), el("th", null, "Action"), el("th", null, "Notes"))),
        el("tbody", null, shown.map(function (r) {
          var e = r.issues.some(function (i) { return i.severity === "error"; });
          var w = r.issues.some(function (i) { return i.severity === "warning"; });
          return el("tr", { class: e ? "rowerr" : w ? "rowwarn" : "" },
            el("td", { class: "num muted" }, r.row),
            el("td", null, r.studentName || el("span", { class: "muted" }, "\\u2014")),
            el("td", null, (r.grade || "") + (r.section ? " " + r.section : "")),
            el("td", { class: "mono" }, r.dob || (r.age !== null ? "age " + r.age : "\\u2014")),
            el("td", null, el("div", null, r.guardianName || el("span", { class: "muted" }, "\\u2014")),
              el("div", { class: "muted mono", style: "font-size:11.5px" }, r.phone)),
            el("td", null, el("span", { class: "pill " + (r.action === "create" ? "ok" : r.action === "update" ? "info" : r.action === "skip" ? "err" : "mute") }, r.action)),
            el("td", null, r.issues.length
              ? el("ul", { class: "issues" }, r.issues.map(function (i) { return el("li", { class: i.severity === "error" ? "e" : "w" }, i.message); }))
              : el("span", { class: "muted" }, "\\u2014")));
        })))));
  }
  function stepDone() {
    var r = S.upload.result;
    return el("div", null,
      el("div", { class: "msg ok" }, el("b", null, "Roster imported. "),
        r.create + " added, " + r.update + " updated, " + r.unchanged + " already up to date."),
      el("div", { class: "card" }, el("div", { class: "card-b" },
        el("h3", { style: "margin-bottom:6px" }, "What happens next"),
        el("p", { class: "muted", style: "font-size:13px;margin:0" },
          "These students are on the roll for " + r.academicYear + ". Guardians see nothing yet \\u2014 schedule a camp, then request consent."))),
      el("div", { class: "row" },
        el("button", { class: "pri", onclick: function () { set({ upload: null, notice: "" }); loadSchoolTab(); } }, "Back to roster"),
        el("button", { onclick: function () { set({ upload: null, schoolTab: "camps" }); loadSchoolTab(); } }, "Schedule a camp")));
  }

  // ══════════════════════════════════════ follow-ups (Stage G)
  function tabReferrals() {
    if (S.refKid) return referralDetailPanel();
    if (!S.referrals) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading…"));
    var d = S.referrals, t = d.totals;
    var filter = S.refFilter || "";
    function nudge() {
      if (!confirm("Send a reminder to every family who has not acted yet?")) return;
      run(api("/api/admin/schools/" + S.school.id + "/referrals/nudge", { method: "POST" }), function (r) {
        S.notice = r.nudged + " reminders sent"
          + (r.expired ? ", " + r.expired + " marked expired" : "")
          + (r.needsSchoolFollowUp ? ". " + r.needsSchoolFollowUp + " need the school to call them." : ".");
        S.referrals = null; loadSchoolTab();
      });
    }
    var shown = filter ? d.referrals.filter(function (r) { return r.status === filter; }) : d.referrals;
    return el("div", null,
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("b", null, t.total), el("span", null, "referrals raised")),
        el("div", { class: "stat warn" }, el("b", null, t.open), el("span", null, "not acted on")),
        el("div", { class: "stat info" }, el("b", null, t.booked + t.attended), el("span", null, "in progress")),
        el("div", { class: "stat ok" }, el("b", null, t.closed), el("span", null, "closed")),
        el("div", { class: "stat" }, el("b", null, t.declined), el("span", null, "declined")),
        el("div", { class: "stat err" }, el("b", null, t.overdue), el("span", null, "overdue")),
        el("div", { class: "stat ok" }, el("b", null, t.closureRate === null ? "—" : t.closureRate + "%"),
          el("span", null, "closure rate"))),
      el("div", { class: "msg info" },
        "Closure rate is the number that shows the screening changed something. It counts referrals a clinician has closed, over those a family has not declined."),
      el("div", { class: "row", style: "margin-bottom:12px" },
        el("select", { style: "max-width:200px", onchange: function (e) { set({ refFilter: e.target.value }); } },
          [["", "All statuses"], ["OPEN", "Not acted on"], ["BOOKED", "Booked"], ["ATTENDED", "Seen"],
           ["CLOSED", "Closed"], ["DECLINED", "Declined"], ["EXPIRED", "Expired"]].map(function (o) {
            return el("option", { value: o[0], selected: filter === o[0] }, o[1]); })),
        t.open ? el("button", { class: "pri", disabled: S.busy, onclick: nudge }, "Remind families who have not acted") : null,
        el("button", { onclick: exportReferrals }, "Export")),
      d.bySpecialty.length
        ? el("div", { class: "card" }, el("div", { class: "card-h" }, el("h2", null, "By specialty")),
            el("table", null, el("tbody", null, d.bySpecialty.map(function (s) {
              return el("tr", null, el("td", null, s.specialty),
                el("td", { class: "num" }, s.closed + " of " + s.total + " closed"),
                el("td", { class: "num" }, el("span", { class: "pill " + (s.total && s.closed / s.total > 0.6 ? "ok" : "warn") },
                  s.total ? Math.round((s.closed / s.total) * 100) + "%" : "—")));
            }))))
        : null,
      shown.length === 0
        ? el("div", { class: "card" }, el("div", { class: "empty" },
            el("h3", null, "Nothing here"),
            el("p", { style: "font-size:13.5px" }, "Referrals appear once a camp is released with flagged results.")))
        : el("div", { class: "tw" }, el("table", null,
            el("thead", null, el("tr", null, el("th", null, "Child"), el("th", null, "Class"), el("th", null, "For"),
              el("th", null, "Urgency"), el("th", null, "Due"), el("th", null, "Guardian"),
              el("th", null, "Status"), el("th", null, ""))),
            el("tbody", null, shown.map(function (r) {
              var overdue = r.dueBy && r.dueBy < new Date().toISOString().slice(0, 10)
                && (r.status === "OPEN" || r.status === "BOOKED");
              return el("tr", { class: "click", onclick: function () { openReferral(r.id); } },
                el("td", null, el("b", null, r.kidName)),
                el("td", { class: "muted" }, r.grade),
                el("td", null, r.specialty, el("div", { class: "muted", style: "font-size:12px" }, r.checkType)),
                el("td", null, urgencyPill(r.urgency) || el("span", { class: "muted" }, "—")),
                el("td", null, overdue ? el("span", { class: "pill err" }, "Overdue") : fmtDate(r.dueBy)),
                el("td", null, r.guardianName || el("span", { class: "muted" }, "—"),
                  el("div", { class: "muted mono", style: "font-size:11.5px" }, r.guardianPhone)),
                el("td", null, statusPill(r.status)),
                el("td", null, el("button", { class: "sm" }, r.status === "CLOSED" ? "View" : "Record outcome")));
            })))));
  }

  function exportReferrals() {
    var rows = [["Child","Class","Check","Specialty","Urgency","Due by","Guardian","Mobile","Status","Outcome","Diagnosis"]];
    S.referrals.referrals.forEach(function (r) {
      rows.push([r.kidName, r.grade, r.checkType, r.specialty, r.urgency, r.dueBy,
        r.guardianName, r.guardianPhone, r.status, r.outcome, r.diagnosis]);
    });
    download("follow-ups-" + S.school.partnerCode + ".csv", toCsv(rows));
  }

  function openReferral(id) {
    S.refKid = id; S.refDetail = null; S.error = ""; render();
    run(api("/api/admin/referrals/" + encodeURIComponent(id)), function (d) {
      S.refDetail = d;
      S.refForm = { outcome: "RESOLVED", diagnosis: "", treatment: "", note: "", clinicianName: "" };
    });
  }

  function referralDetailPanel() {
    var d = S.refDetail;
    if (!d) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading…"));
    var r = d.referral, f = S.refForm;
    var closed = r.status === "CLOSED" || r.status === "DECLINED";
    function save() {
      run(api("/api/admin/referrals/" + encodeURIComponent(r.id) + "/outcome", { method: "POST", body: f }),
        function () { S.notice = "Outcome recorded for " + r.kidName + "."; S.refKid = null; S.referrals = null; loadSchoolTab(); });
    }
    return el("div", null,
      el("button", { class: "lnk", style: "margin-bottom:10px", onclick: function () { set({ refKid: null, refDetail: null, error: "" }); } },
        "← Back to follow-ups"),
      S.error ? el("div", { class: "msg err" }, S.error) : null,
      el("div", { class: "card" },
        el("div", { class: "card-h" },
          el("div", { style: "flex:1" }, el("h2", null, r.kidName),
            el("div", { class: "muted", style: "font-size:12.5px" },
              [r.grade, r.age ? r.age + " years" : "", r.gender].filter(Boolean).join(" · "))),
          urgencyPill(r.urgency), statusPill(r.status)),
        el("div", { class: "card-b" },
          el("dl", { class: "kv" },
            el("dt", null, "Referred for"), el("dd", null, r.specialty + " — " + r.checkType),
            el("dt", null, "Why"), el("dd", null, r.reason || "—"),
            el("dt", null, "From"), el("dd", null, (r.campTitle || "") + (r.campDate ? " on " + fmtDate(r.campDate) : "")),
            el("dt", null, "Due by"), el("dd", null, fmtDate(r.dueBy)),
            el("dt", null, "Guardian"), el("dd", null, (r.guardianName || "—") + " · " + r.guardianPhone)),
          d.finding ? el("div", { class: "msg info", style: "margin-top:14px" },
            el("b", null, "At the camp: "), d.finding.rationale || d.finding.summary) : null)),
      closed
        ? el("div", { class: "card" }, el("div", { class: "card-b" },
            el("h3", { style: "margin-bottom:8px" }, "Outcome"),
            el("dl", { class: "kv" },
              el("dt", null, "Result"), el("dd", null, r.outcome || r.status),
              el("dt", null, "Diagnosis"), el("dd", null, r.diagnosis || "—"),
              el("dt", null, "Treatment"), el("dd", null, r.treatment || "—"),
              el("dt", null, "Recorded by"), el("dd", null, r.clinicianName || "—"),
              r.declinedReason ? el("dt", null, "Declined because") : null,
              r.declinedReason ? el("dd", null, r.declinedReason) : null)))
        : el("div", { class: "card" },
            el("div", { class: "card-h" }, el("h2", null, "Record what happened")),
            el("div", { class: "card-b" },
              el("div", { class: "fld" }, el("label", null, "Result"),
                el("div", { class: "row" }, [["RESOLVED","Resolved"],["ONGOING","Under treatment"],
                  ["REFERRED_ON","Referred on"],["NO_ISSUE","Nothing found"]].map(function (o) {
                    return el("button", { class: (f.outcome === o[0] ? "pri" : ""),
                      onclick: function () { f.outcome = o[0]; render(); } }, o[1]); }))),
              el("div", { class: "g2" },
                el("div", { class: "fld" }, el("label", null, "What was found"),
                  el("input", { type: "text", value: f.diagnosis, oninput: function (e) { f.diagnosis = e.target.value; } })),
                el("div", { class: "fld" }, el("label", null, "Treatment given"),
                  el("input", { type: "text", value: f.treatment, oninput: function (e) { f.treatment = e.target.value; } }))),
              el("div", { class: "g2" },
                el("div", { class: "fld" }, el("label", null, "Clinician"),
                  el("input", { type: "text", value: f.clinicianName, oninput: function (e) { f.clinicianName = e.target.value; },
                    placeholder: "Who saw the child" })),
                el("div", { class: "fld" }, el("label", null, "Note"),
                  el("input", { type: "text", value: f.note, oninput: function (e) { f.note = e.target.value; } }))),
              el("button", { class: "pri big", disabled: S.busy, onclick: save },
                S.busy ? "Saving…" : "Close this follow-up"),
              el("div", { class: "hint", style: "margin-top:8px" },
                "This is what turns a flagged child into a closed loop. It feeds the school's closure rate."))));
  }

  // ══════════════════════════════════════ cohort report (Stage I5)
  function tabReport() {
    if (!S.report) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading…"));
    var d = S.report;
    if (!d.camps.length) {
      return el("div", { class: "card" }, el("div", { class: "empty" },
        el("h3", null, "No camps yet for " + (d.academicYear || "this year")),
        el("p", { style: "font-size:13.5px" }, d.note || "")));
    }
    var c = d.coverage, ref = d.referrals, imp = d.improvement;
    return el("div", null,
      el("div", { class: "row", style: "margin-bottom:14px" },
        el("h3", { style: "flex:1" }, d.school.name + " · " + d.academicYear),
        el("button", { onclick: exportReport }, "Export report")),
      el("h4", { style: "margin-bottom:8px" }, "Coverage"),
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("b", null, c.rostered), el("span", null, "children on camps")),
        el("div", { class: "stat" }, el("b", null, c.consented), el("span", null, "consented")),
        el("div", { class: "stat ok" }, el("b", null, c.screened), el("span", null, "screened")),
        el("div", { class: "stat" }, el("b", null, c.absent), el("span", null, "absent")),
        el("div", { class: "stat info" }, el("b", null, c.screenedRate === null ? "—" : c.screenedRate + "%"),
          el("span", null, "of the roll screened"))),
      el("h4", { style: "margin:18px 0 8px" }, "What was found"),
      el("div", { class: "tw" }, el("table", null,
        el("thead", null, el("tr", null, el("th", null, "Check"), el("th", { class: "num" }, "Measured"),
          el("th", { class: "num" }, "On track"), el("th", { class: "num" }, "Watch"),
          el("th", { class: "num" }, "Refer"), el("th", { class: "num" }, "Flagged"))),
        el("tbody", null, d.prevalence.map(function (p) {
          return el("tr", null, el("td", null, el("b", null, p.checkType)),
            el("td", { class: "num" }, p.measured),
            el("td", { class: "num" }, p.good),
            el("td", { class: "num" }, p.watch ? el("span", { class: "pill warn" }, p.watch) : "0"),
            el("td", { class: "num" }, p.alert ? el("span", { class: "pill err" }, p.alert) : "0"),
            el("td", { class: "num" }, p.flaggedRate === null ? "—" : p.flaggedRate + "%"));
        })))),
      el("h4", { style: "margin:18px 0 8px" }, "Did families act?"),
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("b", null, ref.total), el("span", null, "referrals raised")),
        el("div", { class: "stat ok" }, el("b", null, ref.closed), el("span", null, "closed by a clinician")),
        el("div", { class: "stat warn" }, el("b", null, ref.outstanding), el("span", null, "still open")),
        el("div", { class: "stat" }, el("b", null, ref.declined), el("span", null, "declined")),
        el("div", { class: "stat ok" }, el("b", null, ref.closureRate === null ? "—" : ref.closureRate + "%"),
          el("span", null, "closure rate"))),
      imp && imp.compared
        ? el("div", null, el("h4", { style: "margin:18px 0 8px" }, "Change since the previous camp"),
            el("div", { class: "stats" },
              el("div", { class: "stat" }, el("b", null, imp.compared), el("span", null, "children compared")),
              el("div", { class: "stat ok" }, el("b", null, imp.improved), el("span", null, "improved")),
              el("div", { class: "stat" }, el("b", null, imp.unchanged), el("span", null, "unchanged")),
              el("div", { class: "stat err" }, el("b", null, imp.worse), el("span", null, "worse"))))
        : el("div", { class: "msg info", style: "margin-top:18px" },
            "Change over time appears once children have been screened at two camps."));
  }

  function exportReport() {
    var d = S.report, rows = [["VitaHero report", d.school.name, d.academicYear], []];
    rows.push(["Coverage"]);
    rows.push(["On camps", d.coverage.rostered], ["Consented", d.coverage.consented],
      ["Screened", d.coverage.screened], ["Absent", d.coverage.absent],
      ["Screened rate %", d.coverage.screenedRate]);
    rows.push([], ["Findings"], ["Check","Measured","On track","Watch","Refer","Flagged %"]);
    d.prevalence.forEach(function (p) { rows.push([p.checkType, p.measured, p.good, p.watch, p.alert, p.flaggedRate]); });
    rows.push([], ["Follow-up"], ["Raised", d.referrals.total], ["Closed", d.referrals.closed],
      ["Outstanding", d.referrals.outstanding], ["Declined", d.referrals.declined],
      ["Closure rate %", d.referrals.closureRate]);
    download("report-" + S.school.partnerCode + "-" + d.academicYear + ".csv", toCsv(rows));
  }

  // ══════════════════════════════════════ correction requests (Stage J6)
  function tabRequests() {
    if (!S.corrections) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading…"));
    function resolve(c, accept) {
      var note = accept ? "Applied" : (prompt("Why is this being rejected?") || "Rejected");
      run(api("/api/admin/schools/" + S.school.id + "/corrections/" + encodeURIComponent(c.id),
        { method: "POST", body: { accept: accept, note: note } }), function () {
        S.corrections = null; S.roster = null;
        S.notice = accept ? "Corrected." : "Request rejected.";
        loadSchoolTab();
      });
    }
    var open = S.corrections.filter(function (c) { return c.status === "OPEN"; });
    return el("div", null,
      el("div", { class: "msg info" },
        "Guardians can ask for a detail about their child to be corrected. A guardian cannot change a record themselves — you accept or reject, and either way it is recorded."),
      S.corrections.length === 0
        ? el("div", { class: "card" }, el("div", { class: "empty" },
            el("h3", null, "No requests"), el("p", { style: "font-size:13.5px" }, "Nothing to review.")))
        : el("div", { class: "tw" }, el("table", null,
            el("thead", null, el("tr", null, el("th", null, "Child"), el("th", null, "Field"),
              el("th", null, "Currently"), el("th", null, "Should be"), el("th", null, "Guardian"),
              el("th", null, "Status"), el("th", null, ""))),
            el("tbody", null, S.corrections.map(function (c) {
              return el("tr", null,
                el("td", null, el("b", null, c.kidName), el("div", { class: "muted", style: "font-size:12px" }, c.grade)),
                el("td", { class: "mono" }, c.field),
                el("td", null, c.currentValue || el("span", { class: "muted" }, "—")),
                el("td", null, el("b", null, c.requestedValue)),
                el("td", null, c.guardianName, c.note ? el("div", { class: "muted", style: "font-size:12px" }, c.note) : null),
                el("td", null, statusPill(c.status)),
                el("td", null, c.status === "OPEN"
                  ? el("div", { class: "row" },
                      el("button", { class: "sm pri", onclick: function () { resolve(c, true); } }, "Apply"),
                      el("button", { class: "sm dang", onclick: function () { resolve(c, false); } }, "Reject"))
                  : el("span", { class: "muted", style: "font-size:12.5px" }, c.resolutionNote || "—")));
            })))),
      open.length ? el("p", { class: "muted", style: "margin-top:10px;font-size:12.5px" },
        open.length + " waiting.") : null);
  }

  // ══════════════════════════════════════ camps list
  function tabCamps() {
    if (S.form && S.form.newCamp) return newCampForm();
    if (!S.camps) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\\u2026"));
    return el("div", null,
      el("div", { class: "row", style: "margin-bottom:14px" },
        el("div", { style: "flex:1" }),
        el("button", { class: "pri", onclick: function () { set({ form: { newCamp: true, title: "Annual Health Camp", date: "",
          time: "09:00", venue: "", checks: (S.school.checksOffered || []).slice(), grades: [], sections: [], consentDeadline: "" } }); } },
          "Schedule a camp")),
      S.camps.length === 0
        ? el("div", { class: "card" }, el("div", { class: "empty" },
            el("h3", null, "No camps yet"),
            el("p", { style: "font-size:13.5px" }, "A camp is what turns your roster into health records.")))
        : el("div", { class: "tw" }, el("table", null,
            el("thead", null, el("tr", null, el("th", null, "Camp"), el("th", null, "Date"), el("th", null, "Classes"),
              el("th", { class: "num" }, "Children"), el("th", { class: "num" }, "Consented"),
              el("th", { class: "num" }, "Screened"), el("th", null, "Status"), el("th", null, ""))),
            el("tbody", null, S.camps.map(function (c) {
              return el("tr", { class: "click", onclick: function () { openCamp(c.id); } },
                el("td", null, el("b", null, c.title), c.venue ? el("div", { class: "muted", style: "font-size:12.5px" }, c.venue) : null),
                el("td", null, fmtDate(c.date)),
                el("td", { class: "muted" }, (c.grades || []).join(", ") || "\\u2014"),
                el("td", { class: "num" }, c.participants || 0),
                el("td", { class: "num" }, (c.consented || 0) + " / " + (c.participants || 0)),
                el("td", { class: "num" }, (c.screened || 0) + " / " + (c.participants || 0)),
                el("td", null, statusPill(c.status)),
                el("td", null, el("button", { class: "sm" }, "Open")));
            })))));
  }

  function newCampForm() {
    var f = S.form;
    var offered = S.school.checksOffered || [];
    var classes = S.classes ? S.classes.classes : null;
    if (!classes) {
      api("/api/admin/schools/" + S.school.id + "/classes").then(function (d) { S.classes = d; render(); }).catch(function () {});
    }
    var grades = classes ? uniq(classes.map(function (c) { return c.grade; })) : [];
    var sections = classes ? uniq(classes.map(function (c) { return c.section; }).filter(Boolean)) : [];
    function b(k) { return function (e) { f[k] = e.target.value; }; }
    function togList(list, v) { var i = list.indexOf(v); if (i >= 0) list.splice(i, 1); else list.push(v); render(); }
    function create() {
      run(api("/api/admin/schools/" + S.school.id + "/camps", { method: "POST", body: f }), function (d) {
        S.form = null; S.camps = null; S.notice = "Camp created. Build the list of children next.";
        S.camp = d; S.view = "camp"; S.campTab = "setup"; S.participants = null; render();
      });
    }
    return el("div", null,
      el("button", { class: "lnk", style: "margin-bottom:10px", onclick: function () { set({ form: null, error: "" }); } }, "\\u2190 Back to camps"),
      S.error ? el("div", { class: "msg err" }, S.error) : null,
      offered.length === 0
        ? el("div", { class: "msg warn" }, "This school has no agreed checks yet. Set them under Programme first.")
        : null,
      el("div", { class: "card" }, el("div", { class: "card-h" }, el("h2", null, "Schedule a camp")),
        el("div", { class: "card-b" },
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "Camp name"), el("input", { type: "text", value: f.title, oninput: b("title") })),
            el("div", { class: "fld" }, el("label", null, "Date"), el("input", { type: "date", value: f.date, oninput: b("date") }))),
          el("div", { class: "g3" },
            el("div", { class: "fld" }, el("label", null, "Start time"), el("input", { type: "text", value: f.time, oninput: b("time"), placeholder: "09:00" })),
            el("div", { class: "fld" }, el("label", null, "Venue"), el("input", { type: "text", value: f.venue, oninput: b("venue"), placeholder: "School hall" })),
            el("div", { class: "fld" }, el("label", null, "Consent deadline"),
              el("input", { type: "date", value: f.consentDeadline, oninput: b("consentDeadline") }))),
          el("div", { class: "fld" }, el("label", null, "Checks at this camp"),
            el("div", { class: "chips" }, offered.map(function (c) {
              var on = f.checks.indexOf(c) >= 0;
              return el("label", { class: "chip" + (on ? " on" : "") },
                el("input", { type: "checkbox", checked: on, onchange: function () { togList(f.checks, c); } }), c); })),
            el("div", { class: "hint" }, "Only what the school has agreed to appears here.")),
          el("div", { class: "fld" }, el("label", null, "Classes covered"),
            grades.length
              ? el("div", { class: "chips" }, grades.map(function (g) {
                  var on = f.grades.indexOf(g) >= 0;
                  return el("label", { class: "chip" + (on ? " on" : "") },
                    el("input", { type: "checkbox", checked: on, onchange: function () { togList(f.grades, g); } }), g); }))
              : el("div", { class: "hint" }, "No classes configured yet \\u2014 set them up first.")),
          sections.length
            ? el("div", { class: "fld" }, el("label", null, "Sections (leave empty for all)"),
                el("div", { class: "chips" }, sections.map(function (s) {
                  var on = f.sections.indexOf(s) >= 0;
                  return el("label", { class: "chip" + (on ? " on" : "") },
                    el("input", { type: "checkbox", checked: on, onchange: function () { togList(f.sections, s); } }), s); })))
            : null)),
      el("button", { class: "pri", disabled: S.busy, onclick: create }, S.busy ? "Creating\\u2026" : "Create camp"));
  }

  // ══════════════════════════════════════ camp detail
  function viewCamp() {
    var d = S.camp, c = d.camp, can = d.can;
    var tabs = [];
    if (can.schedule) tabs.push(["setup", "Setup", null]);
    if (can.schedule) tabs.push(["consent", "Consent", c.pendingConsent]);
    if (can.screen) tabs.push(["campday", "Camp day", c.awaitingReview]);
    if (can.review) tabs.push(["review", "Review", c.awaitingReview]);
    return el("div", null,
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("b", null, c.participants || 0), el("span", null, "children")),
        el("div", { class: "stat ok" }, el("b", null, c.consented || 0), el("span", null, "consented")),
        el("div", { class: "stat err" }, el("b", null, c.declined || 0), el("span", null, "declined")),
        el("div", { class: "stat info" }, el("b", null, c.present || 0), el("span", null, "present")),
        el("div", { class: "stat" }, el("b", null, c.screened || 0), el("span", null, "screened")),
        el("div", { class: "stat warn" }, el("b", null, c.awaitingReview || 0), el("span", null, "awaiting review")),
        el("div", { class: "stat ok" }, el("b", null, c.released || 0), el("span", null, "released"))),
      el("div", { class: "tabs" }, tabs.map(function (t) {
        return el("button", { class: "tab" + (S.campTab === t[0] ? " on" : ""),
          onclick: function () { S.campTab = t[0]; S.error = ""; S.screenKid = null; S.reviewKid = null; render(); loadCampTab(); } },
          t[1], t[2] ? el("span", { class: "n" }, t[2]) : null);
      })),
      S.error ? el("div", { class: "msg err" }, S.error) : null,
      S.notice ? el("div", { class: "msg ok" }, S.notice) : null,
      S.campTab === "setup" ? campSetup()
        : S.campTab === "consent" ? campConsent()
        : S.campTab === "campday" ? campDay()
        : campReview());
  }

  function campSetup() {
    var c = S.camp.camp, staff = S.camp.staff;
    function build() {
      run(api("/api/admin/camps/" + c.id + "/roster", { method: "POST" }), function (r) {
        S.notice = "Roster built: " + r.added + " added" + (r.removed ? ", " + r.removed + " removed" : "") + ". " + r.total + " children in total.";
        refreshCamp();
      });
    }
    function requestConsent() {
      if (!confirm("Send a consent request by SMS to every guardian who has not answered?")) return;
      run(api("/api/admin/camps/" + c.id + "/consent/request", { method: "POST" }), function (r) {
        S.notice = "Consent requested from " + r.guardians + " guardians (" + r.sent + " messages sent).";
        refreshCamp("consent");
      });
    }
    return el("div", null,
      el("div", { class: "card" }, el("div", { class: "card-h" }, el("h2", null, "Camp setup")),
        el("div", { class: "card-b" },
          el("dl", { class: "kv", style: "margin:0 0 16px" },
            el("dt", null, "Date"), el("dd", null, fmtDate(c.date) + (c.time ? " at " + c.time : "")),
            el("dt", null, "Venue"), el("dd", null, c.venue || "\\u2014"),
            el("dt", null, "Classes"), el("dd", null, (c.grades || []).join(", ") + (c.sections && c.sections.length ? " \\u00b7 sections " + c.sections.join(", ") : " \\u00b7 all sections")),
            el("dt", null, "Checks"), el("dd", null, (c.checks || []).join(", ")),
            el("dt", null, "Consent by"), el("dd", null, c.consentDeadline ? fmtDate(c.consentDeadline) : "\\u2014")),
          el("div", { class: "row" },
            el("button", { class: "pri", disabled: S.busy, onclick: build },
              (c.participants ? "Rebuild" : "Build") + " the list of children"),
            c.participants ? el("button", { disabled: S.busy, onclick: requestConsent }, "Request consent by SMS") : null),
          el("div", { class: "hint", style: "margin-top:8px" },
            c.participants
              ? c.participants + " children are on this camp. Rebuild after changing classes or uploading a new roster."
              : "This pulls every child in the selected classes onto the camp. Nothing can happen until you do this."))),
      el("div", { class: "card" }, el("div", { class: "card-h" }, el("h2", null, "Team on this camp")),
        staff.length === 0
          ? el("div", { class: "empty" },
              el("p", { style: "font-size:13.5px;margin:0" }, "Nobody assigned yet. Add screeners and a physician under the school's People tab, then assign them here."))
          : el("table", null, el("tbody", null, staff.map(function (s) {
              return el("tr", null,
                el("td", null, el("b", null, s.name), el("div", { class: "muted mono", style: "font-size:12px" }, s.phone)),
                el("td", null, el("span", { class: "pill " + (s.role === "PHYSICIAN" ? "info" : "warn") },
                  s.role === "PHYSICIAN" ? "Physician" : "Screener")),
                el("td", { style: "text-align:right" }, el("button", { class: "sm dang", onclick: function () {
                  run(api("/api/admin/camps/" + c.id + "/staff/" + encodeURIComponent(s.profileId), { method: "DELETE" }),
                    function () { refreshCamp(); }); } }, "Remove")));
            }))),
        el("div", { class: "card-f" }, assignStaffRow(c))));
  }

  function assignStaffRow(c) {
    if (!S.staff) {
      api("/api/admin/schools/" + c.schoolId + "/staff").then(function (r) { S.staff = r.staff; render(); }).catch(function () {});
      return el("span", { class: "muted", style: "font-size:13px" }, "Loading team\\u2026");
    }
    var assigned = S.camp.staff.map(function (s) { return s.profileId; });
    var avail = S.staff.filter(function (s) { return assigned.indexOf(s.profileId) < 0; });
    if (avail.length === 0) return el("span", { class: "muted", style: "font-size:13px" }, "Everyone at this school is already assigned.");
    var sel;
    return el("div", { class: "row" },
      sel = el("select", { style: "max-width:280px" }, avail.map(function (s) {
        return el("option", { value: s.profileId }, s.name + " \\u2014 " + (s.role === "PHYSICIAN" ? "Physician" : "Screener")); })),
      el("button", { disabled: S.busy, onclick: function () {
        run(api("/api/admin/camps/" + c.id + "/staff", { method: "POST", body: { profileId: sel.value } }),
          function () { S.notice = "Assigned."; refreshCamp(); });
      } }, "Assign to camp"));
  }

  function campConsent() {
    if (!S.participants) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\\u2026"));
    var c = S.camp.camp;
    function paper(kid, decision) {
      run(api("/api/admin/camps/" + c.id + "/consent/record", { method: "POST",
        body: { kidId: kid.kidId, decision: decision, source: "PAPER", note: "Recorded in the console" } }),
        function () { S.participants = null; S.notice = "Recorded for " + kid.name + "."; refreshCamp("consent"); });
    }
    var pend = S.participants.filter(function (p) { return p.consentStatus === "PENDING"; });
    return el("div", null,
      el("div", { class: "msg info" },
        "Consent is per camp and per child. A child cannot be screened without it \\u2014 that rule is enforced by the server, not by this screen."),
      el("div", { class: "tw" }, el("table", null,
        el("thead", null, el("tr", null, el("th", null, "Child"), el("th", null, "Class"), el("th", null, "Guardian"),
          el("th", null, "Mobile"), el("th", null, "Consent"), el("th", null, "Record a paper form"))),
        el("tbody", null, S.participants.map(function (p) {
          return el("tr", null,
            el("td", null, el("b", null, p.name)),
            el("td", null, (p.grade || "") + (p.section ? " " + p.section : "")),
            el("td", null, p.guardianName || el("span", { class: "muted" }, "\\u2014")),
            el("td", { class: "mono" }, p.guardianPhone),
            el("td", null, statusPill(p.consentStatus)),
            el("td", null, p.consentStatus === "PENDING"
              ? el("div", { class: "row" },
                  el("button", { class: "sm", onclick: function () { paper(p, "PAPER"); } }, "Granted on paper"),
                  el("button", { class: "sm dang", onclick: function () { paper(p, "DECLINED"); } }, "Declined"))
              : el("span", { class: "muted", style: "font-size:12.5px" }, "Answered")));
        })))),
      pend.length ? el("p", { class: "muted", style: "margin-top:10px;font-size:12.5px" },
        pend.length + " still waiting. Use Setup \\u2192 Request consent to send a reminder.") : null);
  }

  // ══════════════════════════════════════ camp day
  function campDay() {
    if (!S.participants) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\\u2026"));
    var c = S.camp.camp;
    var q = (S.search || "").toLowerCase();
    var list = S.participants.filter(function (p) {
      return !q || p.name.toLowerCase().indexOf(q) >= 0 || (p.studentRef || "").toLowerCase().indexOf(q) >= 0;
    });
    var selected = S.screenKid;
    return el("div", { class: "split" },
      el("div", null,
        el("input", { type: "text", placeholder: "Search name or roll number", value: S.search || "",
          oninput: function (e) { S.search = e.target.value; render(); }, style: "margin-bottom:10px" }),
        el("div", { class: "plist" }, list.length === 0
          ? el("div", { class: "empty", style: "padding:24px 14px" },
              c.participants ? "No match." : el("span", null, "No children on this camp yet. An administrator needs to build the list under Setup."))
          : list.map(function (p) {
              return el("button", { class: "pitem" + (selected === p.kidId ? " on" : ""),
                onclick: function () { openScreening(p.kidId); } },
                el("b", null, p.name),
                el("div", { class: "sub" },
                  el("span", null, (p.grade || "") + (p.section ? " " + p.section : "")),
                  statusPill(p.consentStatus === "PENDING" || p.consentStatus === "DECLINED" ? p.consentStatus : p.status),
                  p.attendance === "ABSENT" ? el("span", { class: "pill mute" }, "Absent") : null));
            }))),
      el("div", null, selected ? screeningPanel() : el("div", { class: "card" }, el("div", { class: "empty" },
        el("h3", null, "Choose a child"),
        el("p", { style: "font-size:13.5px" }, "Pick someone from the list to record their check-up.")))));
  }

  function openScreening(kidId) {
    S.screenKid = kidId; S.screenForm = null; S.error = ""; S.saved = null; render();
    run(api("/api/admin/camps/" + S.camp.camp.id + "/screening/" + encodeURIComponent(kidId)), function (d) {
      S.screenData = d;
      var form = {};
      (d.checks || []).forEach(function (ct) {
        var prev = (d.findings || []).filter(function (f) { return f.checkType === ct; })[0];
        form[ct] = prev ? JSON.parse(JSON.stringify(prev.detail || {})) : {};
      });
      S.screenForm = form;
    });
  }

  function screeningPanel() {
    var d = S.screenData;
    if (!d || d.child.kidId !== S.screenKid) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\\u2026"));
    var ch = d.child, form = S.screenForm || {};
    var blocked = d.consentStatus !== "GRANTED" && d.consentStatus !== "PAPER";

    function mark(v) {
      run(api("/api/admin/camps/" + S.camp.camp.id + "/attendance", { method: "POST", body: { kidId: ch.kidId, attendance: v } }),
        function () { d.attendance = v; S.participants = null; S.notice = ch.name + " marked " + v.toLowerCase() + "."; loadCampTab(); });
    }
    function save() {
      var findings = [];
      (d.checks || []).forEach(function (ct) {
        var det = form[ct] || {};
        var any = Object.keys(det).some(function (k) { return det[k] !== "" && det[k] !== null && det[k] !== undefined && det[k] !== false; });
        if (any) findings.push({ checkType: ct, detail: det, note: det.__note || "" });
      });
      if (findings.length === 0) { set({ error: "Record at least one measurement before saving." }); return; }
      run(api("/api/admin/camps/" + S.camp.camp.id + "/screening/" + encodeURIComponent(ch.kidId), { method: "POST", body: { findings: findings } }),
        function (r) { S.saved = r.saved; S.participants = null; S.notice = "Saved " + ch.name + "'s check-up."; loadCampTab(); });
    }

    return el("div", null,
      el("div", { class: "card" },
        el("div", { class: "card-h" },
          el("div", { style: "flex:1" },
            el("h2", null, ch.name),
            el("div", { class: "muted", style: "font-size:12.5px" },
              [(ch.grade || "") + (ch.section ? " " + ch.section : ""), ch.gender, ch.age ? ch.age + " years" : "", ch.studentRef.replace(/^sid_/, "")]
                .filter(Boolean).join(" \\u00b7 "))),
          statusPill(d.consentStatus)),
        el("div", { class: "card-b" },
          el("div", { class: "row", style: "margin-bottom:4px" },
            el("span", { class: "muted", style: "font-size:13px" }, "Attendance:"),
            el("button", { class: "sm" + (d.attendance === "PRESENT" ? " pri" : ""), onclick: function () { mark("PRESENT"); } }, "Present"),
            el("button", { class: "sm" + (d.attendance === "ABSENT" ? " pri" : ""), onclick: function () { mark("ABSENT"); } }, "Absent"),
            el("button", { class: "sm" + (d.attendance === "REFUSED" ? " pri" : ""), onclick: function () { mark("REFUSED"); } }, "Refused")))),

      blocked
        ? el("div", { class: "msg warn" },
            d.consentStatus === "DECLINED"
              ? "This guardian declined consent. This child must not be screened."
              : "No consent on file yet. Record it under the Consent tab before screening.")
        : null,

      d.excludedByConsent && d.excludedByConsent.length
        ? el("div", { class: "msg info" }, "Consent excludes: " + d.excludedByConsent.join(", ") + ".") : null,

      S.saved ? el("div", { class: "card" }, el("div", { class: "card-b" },
        el("h3", { style: "margin-bottom:8px" }, "Recorded"),
        S.saved.map(function (s) {
          return el("div", { class: "row", style: "margin-bottom:5px" }, flagPill(s.flag),
            el("b", { style: "font-size:13px" }, s.checkType),
            el("span", { class: "muted", style: "font-size:12.5px" }, s.rationale));
        }),
        el("p", { class: "muted", style: "font-size:12.5px;margin:10px 0 0" },
          "A physician confirms every result before the guardian sees it."))) : null,

      blocked ? null : el("div", null,
        (d.checks || []).map(function (ct) { return checkBlock(ct, form); }),
        el("div", { class: "row" },
          el("button", { class: "pri big", disabled: S.busy, onclick: save }, S.busy ? "Saving\\u2026" : "Save check-up"),
          el("button", { onclick: function () { set({ screenKid: null, screenData: null, saved: null }); } }, "Done"))));
  }

  function checkBlock(ct, form) {
    var d = form[ct] || (form[ct] = {});
    function bind(k, cast) {
      return function (e) { d[k] = cast ? cast(e.target.value) : e.target.value; };
    }
    function body() {
      if (ct === "Height & weight") {
        return el("div", { class: "g2" },
          el("div", { class: "fld" }, el("label", null, "Height (cm)"),
            el("input", { type: "number", step: "0.1", value: d.heightCm || "", oninput: bind("heightCm") })),
          el("div", { class: "fld" }, el("label", null, "Weight (kg)"),
            el("input", { type: "number", step: "0.1", value: d.weightKg || "", oninput: bind("weightKg") })));
      }
      if (ct === "Vision") {
        return el("div", null, el("div", { class: "g2" },
          el("div", { class: "fld" }, el("label", null, "Left eye"),
            el("select", { onchange: bind("leftAcuity") }, el("option", { value: "" }, "\\u2014"),
              ACUITY.map(function (a) { return el("option", { value: a, selected: d.leftAcuity === a }, a); }))),
          el("div", { class: "fld" }, el("label", null, "Right eye"),
            el("select", { onchange: bind("rightAcuity") }, el("option", { value: "" }, "\\u2014"),
              ACUITY.map(function (a) { return el("option", { value: a, selected: d.rightAcuity === a }, a); })))),
          el("label", { class: "chip" + (d.squint ? " on" : "") },
            el("input", { type: "checkbox", checked: !!d.squint, onchange: function (e) { d.squint = e.target.checked; render(); } }), "Squint noted"));
      }
      if (ct === "Dental") {
        return el("div", null, el("div", { class: "g2" },
          el("div", { class: "fld" }, el("label", null, "Carious teeth"),
            el("input", { type: "number", min: "0", value: d.cariesCount === undefined ? "" : d.cariesCount, oninput: bind("cariesCount") })),
          el("div", { class: "fld" }, el("label", null, "Gums"),
            el("select", { onchange: bind("gums") }, el("option", { value: "" }, "\\u2014"),
              ["healthy","bleeding","swollen"].map(function (g) {
                return el("option", { value: g, selected: d.gums === g }, g.charAt(0).toUpperCase() + g.slice(1)); })))),
          el("label", { class: "chip" + (d.pain ? " on" : "") },
            el("input", { type: "checkbox", checked: !!d.pain, onchange: function (e) { d.pain = e.target.checked; render(); } }), "Reports pain"));
      }
      if (ct === "Haemoglobin") {
        return el("div", { class: "fld", style: "max-width:220px" }, el("label", null, "Haemoglobin (g/dL)"),
          el("input", { type: "number", step: "0.1", value: d.hb || "", oninput: bind("hb") }));
      }
      return el("div", { class: "fld" }, el("label", null, "Result"),
        el("select", { onchange: bind("outcome") }, el("option", { value: "" }, "\\u2014"),
          [["normal","Normal"],["abnormal","Abnormal, monitor"],["referral","Needs referral"]].map(function (o) {
            return el("option", { value: o[0], selected: d.outcome === o[0] }, o[1]); })));
    }
    return el("div", { class: "chk" },
      el("div", { class: "chk-h" }, el("b", null, ct)),
      el("div", { class: "chk-b" }, body(),
        el("div", { class: "fld", style: "margin:10px 0 0" }, el("label", null, "Note (required to override the suggested result)"),
          el("input", { type: "text", value: d.__note || "", oninput: bind("__note"), placeholder: "Optional" }))));
  }

  // ══════════════════════════════════════ review
  function campReview() {
    if (S.reviewKid) return reviewPanel();
    if (!S.queue) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\\u2026"));
    var c = S.camp.camp;
    function release() {
      if (!confirm("Release " + (c.approved || 0) + " approved results to guardians? This cannot be undone.")) return;
      run(api("/api/admin/camps/" + c.id + "/release", { method: "POST" }), function (r) {
        S.notice = "Released " + r.released + " results" + (r.urgentNotified ? ", " + r.urgentNotified + " urgent families texted" : "") + ".";
        refreshCamp("review");
      });
    }
    var pending = S.queue.filter(function (q) { return q.status === "SCREENED"; });
    return el("div", null,
      el("div", { class: "row", style: "margin-bottom:14px" },
        el("div", { style: "flex:1" },
          el("span", { class: "muted", style: "font-size:13px" },
            pending.length + " awaiting review \\u00b7 " + (c.approved || 0) + " approved \\u00b7 " + (c.released || 0) + " released")),
        el("button", { class: "pri", disabled: S.busy || !(c.approved > 0), onclick: release },
          "Release " + (c.approved || 0) + " to guardians")),
      c.released ? el("div", { class: "msg ok" }, c.released + " results are already with guardians.") : null,
      S.queue.length === 0
        ? el("div", { class: "card" }, el("div", { class: "empty" },
            el("h3", null, "Nothing to review"), el("p", { style: "font-size:13.5px" }, "Results appear here once the screening team records them.")))
        : el("div", { class: "tw" }, el("table", null,
            el("thead", null, el("tr", null, el("th", null, "Child"), el("th", null, "Class"),
              el("th", { class: "num" }, "Refer"), el("th", { class: "num" }, "Watch"),
              el("th", null, "Urgency"), el("th", null, "Status"), el("th", null, ""))),
            el("tbody", null, S.queue.map(function (q) {
              return el("tr", { class: "click", onclick: function () { openReview(q.kidId); } },
                el("td", null, el("b", null, q.name)),
                el("td", { class: "muted" }, q.grade),
                el("td", { class: "num" }, q.alerts ? el("span", { class: "pill err" }, q.alerts) : el("span", { class: "muted" }, "0")),
                el("td", { class: "num" }, q.watches ? el("span", { class: "pill warn" }, q.watches) : el("span", { class: "muted" }, "0")),
                el("td", null, urgencyPill(q.urgency) || el("span", { class: "muted" }, "\\u2014")),
                el("td", null, statusPill(q.status)),
                el("td", null, el("button", { class: "sm" }, q.status === "APPROVED" ? "View" : "Review")));
            })))));
  }

  function openReview(kidId) {
    S.reviewKid = kidId; S.reviewData = null; S.error = ""; render();
    run(api("/api/admin/camps/" + S.camp.camp.id + "/review/" + encodeURIComponent(kidId)), function (d) {
      S.reviewData = d;
      S.reviewEdit = { recommendation: d.recommendation, urgency: d.suggestedUrgency,
        flags: d.findings.reduce(function (a, f) { a[f.checkType] = f.flag; return a; }, {}) };
    });
  }

  function reviewPanel() {
    var d = S.reviewData;
    if (!d) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\\u2026"));
    var e = S.reviewEdit;
    function approve() {
      var findings = d.findings.map(function (f) { return { checkType: f.checkType, flag: e.flags[f.checkType] }; });
      run(api("/api/admin/camps/" + S.camp.camp.id + "/review/" + encodeURIComponent(d.child.kidId), { method: "POST",
        body: { findings: findings, recommendation: e.recommendation, urgency: e.urgency } }), function () {
        S.notice = d.child.name + " approved."; S.reviewKid = null; S.reviewData = null; refreshCamp("review");
      });
    }
    return el("div", null,
      el("button", { class: "lnk", style: "margin-bottom:10px", onclick: function () { set({ reviewKid: null, reviewData: null, error: "" }); } }, "\\u2190 Back to the queue"),
      S.error ? el("div", { class: "msg err" }, S.error) : null,
      el("div", { class: "card" },
        el("div", { class: "card-h" },
          el("div", { style: "flex:1" }, el("h2", null, d.child.name),
            el("div", { class: "muted", style: "font-size:12.5px" },
              [d.child.grade, d.child.gender, d.child.age ? d.child.age + " years" : ""].filter(Boolean).join(" \\u00b7 "))),
          statusPill(d.status)),
        el("div", { class: "card-b" },
          el("h4", { style: "margin-bottom:10px" }, "What the screening team recorded"),
          d.findings.length === 0 ? el("p", { class: "muted" }, "No findings recorded.") : null,
          d.findings.map(function (f) {
            return el("div", { class: "chk" },
              el("div", { class: "chk-h" }, el("b", null, f.checkType),
                f.overridden ? el("span", { class: "pill warn" }, "Screener overrode") : null,
                el("span", { class: "muted", style: "font-size:12px" }, f.screenerName || "")),
              el("div", { class: "chk-b" },
                el("div", { class: "row", style: "margin-bottom:8px" },
                  el("span", { class: "muted", style: "font-size:12.5px;min-width:74px" }, "Measured"),
                  el("b", { style: "font-size:13.5px" }, f.rationale || "\\u2014")),
                f.screenerNote ? el("div", { class: "row", style: "margin-bottom:8px" },
                  el("span", { class: "muted", style: "font-size:12.5px;min-width:74px" }, "Note"),
                  el("span", { style: "font-size:13px" }, f.screenerNote)) : null,
                el("div", { class: "row" },
                  el("span", { class: "muted", style: "font-size:12.5px;min-width:74px" }, "Your call"),
                  ["GOOD","WATCH","ALERT","NOT_MEASURED"].map(function (fl) {
                    return el("button", { class: "sm" + (e.flags[f.checkType] === fl ? " pri" : ""),
                      onclick: function () { e.flags[f.checkType] = fl; render(); } },
                      fl === "GOOD" ? "On track" : fl === "WATCH" ? "Watch" : fl === "ALERT" ? "Refer" : "Not measured");
                  }))));
          }))),
      el("div", { class: "card" },
        el("div", { class: "card-h" }, el("h2", null, "What the guardian will read")),
        el("div", { class: "card-b" },
          el("div", { class: "fld" }, el("label", null, "How soon should they act?"),
            el("div", { class: "row" }, [["NONE","No action"],["ROUTINE","At the next routine visit"],["SOON","Within two weeks"],["URGENT","Within a few days"]].map(function (u) {
              return el("button", { class: (e.urgency === u[0] ? "pri" : ""), onclick: function () { e.urgency = u[0]; render(); } }, u[1]); }))),
          el("div", { class: "fld" }, el("label", null, "Message to the guardian"),
            el("textarea", { oninput: function (ev) { e.recommendation = ev.target.value; } }, e.recommendation),
            el("div", { class: "hint" }, d.recommendationIsDraft
              ? "Drafted from the findings. Edit it \\u2014 this is what the parent reads in the app."
              : "Previously saved. Edit if anything has changed.")),
          el("div", { class: "row" },
            el("button", { class: "pri big", disabled: S.busy, onclick: approve },
              S.busy ? "Saving\\u2026" : d.status === "APPROVED" ? "Update approval" : "Approve this child"),
            el("button", { onclick: function () { set({ reviewKid: null, reviewData: null }); } }, "Cancel")),
          el("div", { class: "hint", style: "margin-top:8px" },
            "Approving does not notify anyone. Results reach guardians only when you release the camp."))));
  }

  // ══════════════════════════════════════ my camps (screener / physician)
  function viewMyCamps() {
    if (!S.myCamps) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\\u2026"));
    if (!S.myCamps.length) {
      return el("div", { class: "card" }, el("div", { class: "empty" },
        el("h3", null, "No camps assigned"),
        el("p", { style: "font-size:13.5px" }, "A school administrator assigns you to a camp. Once they do, it appears here with its list of children.")));
    }
    return el("div", { class: "tw" }, el("table", null,
      el("thead", null, el("tr", null, el("th", null, "Camp"), el("th", null, "School"), el("th", null, "Date"),
        el("th", null, "Your role"), el("th", { class: "num" }, "Children"), el("th", { class: "num" }, "Screened"),
        el("th", null, "Status"), el("th", null, ""))),
      el("tbody", null, S.myCamps.map(function (c) {
        return el("tr", { class: "click", onclick: function () { openCamp(c.id); } },
          el("td", null, el("b", null, c.title)),
          el("td", { class: "muted" }, c.schoolName),
          el("td", null, fmtDate(c.date)),
          el("td", null, el("span", { class: "pill " + (c.staffRole === "PHYSICIAN" ? "info" : "warn") },
            c.staffRole === "PHYSICIAN" ? "Physician" : "Screener")),
          el("td", { class: "num" }, c.participants || 0),
          el("td", { class: "num" }, (c.screened || 0) + " / " + (c.participants || 0)),
          el("td", null, statusPill(c.status)),
          el("td", null, el("button", { class: "sm pri" }, c.staffRole === "PHYSICIAN" ? "Review" : "Open camp")));
      }))));
  }

  // ══════════════════════════════════════ chrome
  function navItem(icon, label, view, onclick) {
    return el("button", { class: "navi" + (S.view === view ? " on" : ""), onclick: onclick },
      el("span", { class: "ic" }, icon), label);
  }

  function sidebar() {
    return el("nav", { class: "nav" },
      el("div", { class: "brand" }, el("span", { class: "dot" }), "VitaHero"),
      el("div", { class: "navsec" },
        el("h4", null, "Menu"),
        canManage() ? navItem("\\u25A6", "Overview", "overview", function () { set({ view: "overview" }); if (!S.overview) boot(); }) : null,
        canManage() ? navItem("\\u25EC", isSchoolAdmin() ? "My school" : "Schools", "schools", function () {
          if (isSchoolAdmin() && S.school) openSchool(S.school.id); else loadSchools();
        }) : null,
        isClinical() ? navItem("\\u2695", "My camps", "mycamps", loadMyCamps) : null,
        S.camp ? navItem("\\u2691", "Current camp", "camp", function () { set({ view: "camp" }); }) : null),
      el("div", { class: "navfoot" },
        el("b", null, S.auth.name),
        el("div", { class: "role" }, roleLabel()),
        el("button", { onclick: signOut }, "Sign out")));
  }

  function crumbs() {
    var parts = [];
    if (S.view === "school" && S.school) {
      parts.push(el("button", { onclick: loadSchools }, "Schools"), " / ", S.school.name);
    } else if (S.view === "camp" && S.camp) {
      if (canManage() && S.school) {
        parts.push(el("button", { onclick: function () { openSchool(S.school.id, "camps"); } }, S.school.name), " / ");
      } else if (isClinical()) {
        parts.push(el("button", { onclick: loadMyCamps }, "My camps"), " / ");
      }
      parts.push(S.camp.camp.schoolName ? S.camp.camp.schoolName + " \\u00b7 " : "", S.camp.camp.title);
    } else if (S.view === "newSchool") {
      parts.push(el("button", { onclick: loadSchools }, "Schools"), " / New school");
    }
    return parts.length ? el("div", { class: "crumb" }, parts) : null;
  }

  function title() {
    if (S.view === "overview") return "Overview";
    if (S.view === "schools") return isSchoolAdmin() ? "My school" : "Schools";
    if (S.view === "newSchool") return "Add a school";
    if (S.view === "school" && S.school) return S.school.name;
    if (S.view === "camp" && S.camp) return S.camp.camp.title;
    if (S.view === "mycamps") return "My camps";
    return "VitaHero";
  }

  function render() {
    var root = document.getElementById("root");
    clear(root);
    if (!S.auth) { add(root, viewSignIn()); return; }

    var body;
    if (S.view === "newSchool") body = viewNewSchool();
    else if (S.view === "school" && S.school) body = viewSchool();
    else if (S.view === "camp" && S.camp) body = viewCamp();
    else if (S.view === "mycamps") body = viewMyCamps();
    else if (S.view === "schools") body = viewSchools();
    else body = viewOverview();

    add(root, el("div", { class: "shell" }, sidebar(),
      el("div", { class: "main" },
        el("div", { class: "bar" },
          el("div", { class: "grow" }, crumbs(), el("h1", null, title())),
          S.view === "camp" && S.camp ? statusPill(S.camp.camp.status) : null,
          S.view === "school" && S.school ? el("span", { class: "code" }, S.school.partnerCode) : null),
        el("div", { class: "content" },
          S.view !== "school" && S.view !== "camp" && S.error ? el("div", { class: "msg err" }, S.error) : null,
          S.view !== "school" && S.view !== "camp" && S.notice ? el("div", { class: "msg ok" }, S.notice) : null,
          body))));
  }

  // ── boot ──
  var saved = loadAuth();
  if (saved) {
    S.auth = saved;
    boot();
  }
  render();
})();
</script>
</body>
</html>`;
