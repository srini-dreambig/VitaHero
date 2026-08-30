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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;500;600;700&display=swap">
<style>
  /* Taken from the app's Compose theme, not invented separately. A school
     admin and a parent are looking at one product; when the console picked its
     own orange and its own typeface it stopped looking like one. Values here
     mirror ui/theme/Color.kt and ui/theme/Type.kt. */
  :root {
    --brand:#F47B20;        /* HeroOrange */
    --brand-dk:#D9641A;     /* HeroOrangeDark */
    --brand-sf:#FCE5D1;     /* HeroOrangeSoft */
    --blue:#1FA2DD;         /* HeroBlue */
    --blue-dk:#1380B8;
    --blue-sf:#D6EFFA;
    --nav:#0F172A;          /* Ink */
    --nav-2:#1A2341;        /* DarkSurface */
    --nav-tx:#94A3B8;       /* InkFaint */
    --nav-ac:#F47B20;
    --ink:#0F172A;          /* Ink */
    --ink-2:#475569;        /* InkSoft */
    --ink-3:#94A3B8;        /* InkFaint */
    --bg:#FAFCFE;           /* Canvas */
    --card:#FFFFFF;         /* SurfaceWhite */
    --sunk:#EEF4F8;         /* SurfaceMuted */
    --line:#E2E9EF;         /* HairLine */
    --line-2:#EEF4F8;
    --ok:#10B981;    --ok-bg:#E7F8F2;      /* FlagGood */
    --warn:#F59E0B;  --warn-bg:#FEF3DC;    /* FlagWatch */
    --err:#EF4444;   --err-bg:#FDE8E8;     /* FlagAlert */
    --info:#1FA2DD;  --info-bg:#D6EFFA;    /* HeroBlue */
    --mute:#94A3B8;  --mute-bg:#EEF4F8;    /* FlagNeutral */
    --purple:#8B5CF6;
    --sh:0 1px 2px rgba(15,23,42,.05),0 1px 3px rgba(15,23,42,.04);
    --sh-lg:0 4px 6px -2px rgba(15,23,42,.05),0 12px 24px -8px rgba(15,23,42,.14);
    /* The app rounds cards at 18-22dp and controls at 12-14dp. */
    --r:12px;
    --r-lg:18px;
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  body{
    margin:0;background:var(--bg);color:var(--ink);
    font:14px/1.55 "Host Grotesk",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
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
  /* minmax(0,...) rather than a bare 1fr: a grid track's automatic minimum is
     min-content, so a bare 1fr lets one wide child — a roster table, the
     collapsed nav strip — push the whole shell past the viewport instead of
     scrolling inside itself. */
  .shell{display:grid;grid-template-columns:232px minmax(0,1fr);min-height:100vh}
  .nav{background:var(--nav);color:#fff;display:flex;flex-direction:column;position:sticky;top:0;height:100vh}
  .brand{display:flex;align-items:center;gap:10px;padding:18px 18px 16px;font-weight:700;font-size:15px;letter-spacing:-.02em}
  /* The wordmark as the brand actually sets it: "vita" orange, "hero" blue,
     lowercase, tight. Previously a gradient square stood in for the logo. */
  .wm{font-weight:700;letter-spacing:-.02em;font-size:17px;line-height:1}
  .wm i{font-style:normal;color:var(--brand)}
  .wm b{font-weight:700;color:var(--blue)}
  .nav .wm i{color:#F9A45C}
  .nav .wm b{color:#6FC7EE}
  .wm.big{font-size:30px}
  .signbrand{display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:18px}
  .signbrand .tag{font-size:11px;font-weight:600;letter-spacing:.13em;
    text-transform:uppercase;color:var(--blue)}
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
  /* Same scrolling, none of the chrome — for a table already sitting inside a
     card. Applied by hand where it reads well and by the safety net in
     render() everywhere else, because a table that escapes its container
     scrolls the whole page sideways and takes the sticky nav with it. */
  .tws{overflow-x:auto;max-width:100%}
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
    .shell{grid-template-columns:minmax(0,1fr)}
    .nav{position:static;height:auto;flex-direction:row;flex-wrap:wrap;align-items:center;padding-bottom:8px}
    /* min-width:0 is the whole fix: a flex child defaults to min-width:auto,
       so this strip refused to shrink below its buttons and held the entire
       shell open at 424px inside a 390px phone. */
    .navsec{display:flex;gap:4px;padding:0 10px 8px;overflow-x:auto;flex:1;min-width:0}
    .nav{max-width:100%;min-width:0}
    /* The signed-in name and role can be long; let the footer wrap rather than
       hold the strip open. */
    .navfoot{flex-wrap:wrap;min-width:0}
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
  /**
   * The VitaHero shield, from the app's own launcher asset.
   *
   * Embedded rather than fetched: the console is one self-contained file
   * that has to open on a tethered phone in a school hall, and a logo is a
   * poor reason to add a network dependency. Previously a CSS gradient dot
   * stood in for it, which is why the console did not look like the app.
   */
  var BRAND_MARK = "data:image/png;base64,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";

  function brandMark(size) {
    return el("img", { src: BRAND_MARK, alt: "", width: String(size), height: String(size),
      style: "display:block;flex:none" });
  }

  // ── icons ──
  //
  // Lucide, inlined as path data. Not a CDN script: the console has to open in
  // a school hall on a phone tether, and it already caches its own shell for
  // exactly that reason. Twenty-four paths cost less than one blocked request.
  var ICONS = {
    home: "M3 9.5 12 3l9 6.5M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10",
    school: "M14 22v-4a2 2 0 1 0-4 0v4M18 10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2M4 10l8-6 8 6",
    stethoscope: "M11 2v2M6 2v2M6 4v5a5 5 0 0 0 10 0V4M11 14v2a5 5 0 0 0 10 0v-1M20 12a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z",
    flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
    book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    userPlus: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6",
    building: "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18ZM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4",
    calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
    send: "m22 2-7 20-4-9-9-4Zm0 0L11 13",
    upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    receipt: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1ZM8 7h8M8 11h8M8 15h5",
    camera: "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    message: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z",
    clipboard: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z",
    chart: "M3 3v16a2 2 0 0 0 2 2h16M7 15l4-4 3 3 5-6",
    settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
    check: "M20 6 9 17l-5-5",
    alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    plus: "M12 5v14M5 12h14",
    trash: "M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
    phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z",
  };

  /**
   * One Lucide glyph as an inline SVG element.
   *
   * Built with createElementNS because these live inside a DOM the rest of the
   * console builds by hand; innerHTML here would be the only string-to-markup
   * path in the file.
   */
  function icon(name, size) {
    var d = ICONS[name] || ICONS.check;
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size || 16));
    svg.setAttribute("height", String(size || 16));
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    d.split(" M").forEach(function (part, i) {
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", (i === 0 ? part : "M" + part).trim());
      svg.appendChild(path);
    });
    return svg;
  }

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
    pack: null, forceOffline: false, syncRejects: null, packInfo: null,
    photos: null, photosKid: null, photoOpen: null,
    hospitals: null, doctors: null, hosForm: null, docForm: null, hosQuery: "",
    invites: null, campPeople: null, peopleQuery: "",
    threads: null, thread: null, billing: null, library: null, libForm: null,
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

  // ── offline pack and queue ──
  //
  // A camp day happens in a school hall with no signal. The screener downloads
  // the camp pack while they still have one; captures go into a local queue and
  // sync when the network returns. The server stays authoritative on consent,
  // so a queued capture for a child whose guardian has since withdrawn is
  // rejected on sync rather than written.
  var PACK_KEY = "vh_pack_";
  var QUEUE_KEY = "vh_queue_";

  function packStore(campId, pack) {
    try {
      if (pack === null) localStorage.removeItem(PACK_KEY + campId);
      else localStorage.setItem(PACK_KEY + campId, JSON.stringify(pack));
      return true;
    } catch (e) { return false; }
  }
  function packLoad(campId) {
    try { var r = localStorage.getItem(PACK_KEY + campId); return r ? JSON.parse(r) : null; }
    catch (e) { return null; }
  }
  function queueLoad(campId) {
    try { var r = localStorage.getItem(QUEUE_KEY + campId); return r ? JSON.parse(r) : []; }
    catch (e) { return []; }
  }
  function queueSave(campId, q) {
    try { localStorage.setItem(QUEUE_KEY + campId, JSON.stringify(q)); return true; }
    catch (e) { set({ error: "This device has run out of storage. Sync before recording more." }); return false; }
  }
  function queuePush(campId, entry) {
    var q = queueLoad(campId);
    // One entry per child: a screener correcting a measurement should replace
    // what is queued, not send two conflicting captures.
    var i = -1;
    for (var j = 0; j < q.length; j++) if (q[j].kidId === entry.kidId) { i = j; break; }
    if (i >= 0) {
      if (entry.findings) q[i].findings = entry.findings;
      if (entry.attendance) q[i].attendance = entry.attendance;
      q[i].at = new Date().toISOString();
    } else {
      entry.at = new Date().toISOString();
      q.push(entry);
    }
    return queueSave(campId, q) ? q.length : queueLoad(campId).length;
  }
  function queueCount() {
    return S.camp ? queueLoad(S.camp.camp.id).length : 0;
  }

  function isOffline() { return S.forceOffline || !navigator.onLine; }

  function syncQueue(campId, done) {
    var q = queueLoad(campId);
    if (q.length === 0) { if (done) done({ applied: 0, rejected: [] }); return; }
    set({ busy: true, error: "" });
    api("/api/admin/camps/" + campId + "/screening-bulk", { method: "POST", body: { entries: q } })
      .then(function (r) {
        S.busy = false;
        // Keep only what the server refused, so nothing is silently lost.
        var bad = {};
        (r.rejected || []).forEach(function (x) { bad[x.kidId] = x; });
        var left = q.filter(function (e) { return bad[e.kidId]; });
        queueSave(campId, left);
        S.syncRejects = r.rejected || [];
        S.notice = r.applied + " children synced"
          + (left.length ? ", " + left.length + " could not be saved" : "") + ".";
        S.participants = null; S.screenData = null;
        if (done) done(r);
        refreshCamp();
      })
      .catch(function (e) {
        set({ busy: false, error: "Could not sync: " + (e.message || "network error") });
      });
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
      el("div", { class: "signbrand" }, brandMark(64),
        el("div", { class: "wm big" }, el("i", null, "vita"), el("b", null, "hero")),
        el("div", { class: "tag" }, "Kids health & wellness")),
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
      S.threads = null; S.thread = null; S.billing = null; S.invites = null;
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
    else if (t === "questions" && !S.threads) run(api("/api/admin/questions?school_id=" + encodeURIComponent(id)), function (d) { S.threads = d; });
    else if (t === "invites" && !S.invites) run(api("/api/admin/invites?school_id=" + encodeURIComponent(id)), function (d) { S.invites = d; });
    else if (t === "billing" && !S.billing) {
      run(api("/api/admin/billing/contract?school_id=" + encodeURIComponent(id)), function (d) {
        S.billing = { contract: d.contract, invoices: null };
        api("/api/admin/billing/invoices?school_id=" + encodeURIComponent(id))
          .then(function (r) { S.billing.invoices = r.invoices; render(); }).catch(function () {});
      });
    }
  }

  function openCamp(id, tab) {
    run(api("/api/admin/camps/" + encodeURIComponent(id)), function (d) {
      S.camp = d; S.view = "camp"; S.campTab = tab || defaultCampTab(d);
      S.participants = null; S.queue = null; S.screenKid = null; S.reviewKid = null;
      S.campPeople = null;
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
    if (t === "people" && !S.campPeople) {
      run(api("/api/admin/camp-people?camp_id=" + encodeURIComponent(id)
        + "&school_id=" + encodeURIComponent(S.camp.camp.schoolId)), function (d) { S.campPeople = d; });
    } else if ((t === "consent" || t === "campday") && !S.participants) {
      run(api("/api/admin/camps/" + id + "/participants"), function (d) { S.participants = d.participants; });
    } else if (t === "review" && !S.queue) {
      run(api("/api/admin/camps/" + id + "/review"), function (d) { S.queue = d.queue; });
    }
  }
  function refreshCamp(tab) {
    var id = S.camp.camp.id;
    run(api("/api/admin/camps/" + id), function (d) {
      S.camp = d; S.participants = null; S.queue = null; S.campPeople = null;
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
    var tabs = [["roster","Roster"],["camps","Camps"],["invites","App invites"],
      ["referrals","Follow-ups"],["questions","Questions"],["report","Report"],
      ["classes","Classes"],["people","Staff"],["requests","Requests"],
      ["billing","Billing"],["programme","Programme"],["history","Uploads"]];
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
        : S.schoolTab === "questions" ? tabQuestions()
        : S.schoolTab === "invites" ? tabInvites()
        : S.schoolTab === "billing" ? tabBilling()
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
    function signinCode(person) {
      run(api("/api/admin/schools/" + S.school.id + "/staff/"
        + encodeURIComponent(person.profileId) + "/signin-code", { method: "POST" }), function (r) {
        S.notice = r.smsDelivered
          ? ("Code texted to " + r.name + ".")
          : ("Read this to " + r.name + ": " + r.code
             + " \\u2014 they enter it on the sign-in screen with " + r.phone
             + ". It expires in " + r.expiresInMinutes + " minutes.");
      });
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
                el("td", null, el("div", { class: "row" },
                  // Staff sign in by mobile number and nothing else, so when
                  // the SMS does not arrive they are simply locked out. This
                  // is the way back in: the same one-time code, read out by
                  // someone who already administers this school.
                  el("button", { class: "sm", onclick: function () { signinCode(x.p); } },
                    icon("phone", 13), " Sign-in code"),
                  x.role === "SCHOOL_ADMIN"
                    ? el("button", { class: "sm dang", onclick: function () { removeAdmin(x.p); } }, "Remove")
                    : null)));
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

  // ══════════════════════════════════════ questions from families
  //
  // The number that matters on this screen is days waited, not message count.
  // A school that cannot answer should turn the channel off honestly rather
  // than leave families waiting, and the server will not let them do that
  // until the queue is clear.
  function tabQuestions() {
    if (!S.threads) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\u2026"));
    var q = S.threads, id = S.school.id;

    function reloadQ() { S.threads = null; S.thread = null; loadSchoolTab(); }
    function openThread(t) {
      run(api("/api/admin/questions/" + encodeURIComponent(t.id)), function (d) { S.thread = d; });
    }
    function toggleChannel(on) {
      run(api("/api/admin/questions/settings", { method: "POST", body: { schoolId: id, enabled: on } }),
        function () { S.notice = on ? "Families can ask questions again." : "The question channel is off."; reloadQ(); });
    }

    if (S.thread) return threadPanel(reloadQ);

    var overdue = q.counts ? (q.counts.overdue || 0) : 0;
    return el("div", null,
      el("div", { class: "msg info" },
        "Families can ask about their child's check-up here. It is not urgent care, and the app tells them so before they write. You have said you will reply within "
        + q.responseWindowDays + " days."),
      overdue
        ? el("div", { class: "msg err" }, overdue + " question" + (overdue === 1 ? " has" : "s have")
            + " been waiting longer than " + q.responseWindowDays + " days. Answer them, or switch the channel off so families stop expecting a reply.")
        : null,
      el("div", { class: "stats" },
        el("div", { class: "stat warn" }, el("b", null, q.counts ? (q.counts.waiting_on_us || 0) : 0), el("span", null, "waiting on you")),
        el("div", { class: "stat err" }, el("b", null, overdue), el("span", null, "overdue")),
        el("div", { class: "stat ok" }, el("b", null, q.counts ? (q.counts.closed || 0) : 0), el("span", null, "closed"))),
      el("div", { class: "row", style: "margin-bottom:12px" },
        el("span", { class: "pill " + (q.enabled ? "ok" : "") }, q.enabled ? "Open to questions" : "Closed"),
        el("button", { class: "sm" + (q.enabled ? " dang" : ""), disabled: S.busy,
          onclick: function () { toggleChannel(!q.enabled); } },
          q.enabled ? "Stop taking questions" : "Start taking questions")),
      q.threads.length === 0
        ? el("div", { class: "card" }, el("div", { class: "empty" },
            el("h3", null, "No questions"),
            el("p", { style: "font-size:13.5px" }, "Nothing waiting.")))
        : el("div", { class: "tw" }, el("table", null,
            el("thead", null, el("tr", null, el("th", null, "Family"), el("th", null, "Child"),
              el("th", null, "Last message"), el("th", { class: "num" }, "Waiting"),
              el("th", null, "Status"), el("th", null, ""))),
            el("tbody", null, q.threads.map(function (t) {
              return el("tr", { class: "click", onclick: function () { openThread(t); } },
                el("td", null, el("b", null, t.guardianName || "\u2014"),
                  el("div", { class: "muted mono", style: "font-size:12px" }, t.guardianPhone || "")),
                el("td", null, t.kidName || el("span", { class: "muted" }, "\u2014")),
                el("td", { class: "muted", style: "font-size:12.5px" },
                  (t.lastMessage || "").slice(0, 90) + ((t.lastMessage || "").length > 90 ? "\u2026" : "")),
                el("td", { class: "num" }, t.awaiting === "SCHOOL"
                  ? el("span", { class: "pill " + (t.waitingDays > q.responseWindowDays ? "err" : "warn") },
                      t.waitingDays + "d")
                  : el("span", { class: "muted" }, "\u2014")),
                el("td", null, statusPill(t.status)),
                el("td", null, el("button", { class: "sm" }, "Open")));
            })))));
  }

  function threadPanel(reloadQ) {
    var d = S.thread, t = d.thread;
    var box;
    function send(close) {
      var text = box.value.trim();
      if (text.length < 2) { set({ error: "Write a reply." }); return; }
      run(api("/api/admin/questions/" + encodeURIComponent(t.id) + "/reply",
        { method: "POST", body: { body: text, close: close === true } }),
        function () { S.notice = close ? "Replied and closed." : "Replied."; reloadQ(); });
    }
    return el("div", null,
      el("button", { class: "sm", onclick: function () { set({ thread: null }); } }, "\u2190 All questions"),
      el("div", { class: "card", style: "margin-top:12px" },
        el("div", { class: "card-h" },
          el("div", { style: "flex:1" }, el("h2", null, t.subject || "Question"),
            el("div", { class: "muted", style: "font-size:12.5px" },
              [t.kidName, t.schoolName].filter(Boolean).join(" \u00b7 "))),
          statusPill(t.status)),
        el("div", { class: "card-b" },
          d.messages.map(function (m) {
            return el("div", { style: "margin-bottom:12px;padding-left:" + (m.side === "SCHOOL" ? "28px" : "0") },
              el("div", { class: "muted", style: "font-size:12px" },
                (m.side === "SCHOOL" ? "You \u00b7 " : "") + (m.name || "") + " \u00b7 " + fmtDate(m.at)),
              el("div", { style: "font-size:13.5px;white-space:pre-wrap" }, m.body));
          }))),
      t.status === "CLOSED"
        ? el("div", { class: "msg info" }, "This question is closed. The family can open a new one if they need to.")
        : el("div", { class: "card" },
            el("div", { class: "card-b" },
              el("div", { class: "fld" },
                el("label", null, "Your reply"),
                box = el("textarea", { rows: 4, placeholder: "Answer plainly. If it is clinical, say what the physician advised." })),
              el("p", { class: "muted", style: "font-size:12.5px;margin:0 0 10px" },
                "This goes to the family in the app. Do not put anything here that belongs in a referral letter.")),
            el("div", { class: "card-f" }, el("div", { class: "row" },
              el("button", { class: "pri", disabled: S.busy, onclick: function () { send(false); } }, "Send reply"),
              el("button", { disabled: S.busy, onclick: function () { send(true); } }, "Reply and close")))));
  }

  // ══════════════════════════════════════ getting families onto the app
  //
  // A camp can screen every child in the school and still reach nobody: a
  // result only lands if the guardian has the app. Nothing used to report that
  // number, so the first anyone would know was after a release went nowhere.
  function tabInvites() {
    if (!S.invites) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\u2026"));
    var v = S.invites, id = S.school.id;

    function send(onlyNotJoined) {
      var n = onlyNotJoined ? v.notJoined : v.total;
      if (!n) { set({ error: "Nobody to message." }); return; }
      if (!confirm("Text the download link to " + n + " guardian" + (n === 1 ? "" : "s") + "?")) return;
      run(api("/api/admin/invites/send", { method: "POST",
        body: { schoolId: id, onlyNotJoined: onlyNotJoined !== false } }), function (r) {
        S.notice = "Sent to " + r.sent + " of " + r.targeted + "."
          + (r.failed.length ? " Could not reach: " + r.failed.slice(0, 5).join(", ") + "." : "");
        S.invites = null; loadSchoolTab();
      });
    }
    function exportList() {
      download("app-invites-" + id + ".csv", toCsv(v.guardians.map(function (g) {
        return { Guardian: g.name, Mobile: g.phone, Children: g.children,
          UsingApp: g.usingApp ? "yes" : "no", Invited: g.invitedAt || "" };
      })));
    }

    var pct = v.total ? Math.round((v.joined / v.total) * 100) : 0;
    return el("div", null,
      el("div", { class: "msg info" },
        "A released result reaches a family only if they have the app. This is how many can receive one."),
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("b", null, v.total), el("span", null, "guardians")),
        el("div", { class: "stat ok" }, el("b", null, v.joined), el("span", null, "using the app")),
        el("div", { class: "stat warn" }, el("b", null, v.notJoined), el("span", null, "not yet")),
        el("div", { class: "stat" }, el("b", null, pct + "%"), el("span", null, "reachable")),
        el("div", { class: "stat info" }, el("b", null, v.neverInvited), el("span", null, "never texted"))),
      el("div", { class: "row", style: "margin:14px 0" },
        el("button", { class: "pri", disabled: S.busy || !v.notJoined,
          onclick: function () { send(true); } },
          icon("send", 14), " Invite the " + v.notJoined + " not on the app"),
        el("button", { disabled: S.busy, onclick: function () { send(false); } },
          "Message everyone again"),
        el("div", { style: "flex:1" }),
        el("button", { onclick: exportList }, icon("download", 14), " Export CSV")),
      el("div", { class: "hint", style: "margin-bottom:14px" },
        "Each message carries a link that opens the app on the guardian\u2019s own number. Re-messaging everyone includes families already using it, so keep it for a reason."),
      el("div", { class: "tw" }, el("table", null,
        el("thead", null, el("tr", null, el("th", null, "Guardian"), el("th", null, "Mobile"),
          el("th", { class: "num" }, "Children"), el("th", null, "App"), el("th", null, "Last texted"))),
        el("tbody", null, v.guardians.map(function (g) {
          return el("tr", null,
            el("td", null, el("b", null, g.name || "\u2014")),
            el("td", { class: "mono" }, g.phone || "\u2014"),
            el("td", { class: "num" }, g.children),
            el("td", null, g.usingApp
              ? el("span", { class: "pill ok" }, "Installed")
              : el("span", { class: "pill warn" }, "Not yet")),
            el("td", { class: "muted", style: "font-size:12.5px" },
              g.invitedAt ? fmtDate(g.invitedAt.slice(0, 10)) : "Never"));
        })))));
  }

  // ══════════════════════════════════════ contracts and invoices
  //
  // Prices are not baked in anywhere. A contract is a shape and a rate, and an
  // invoice is built from what was actually delivered \u2014 children whose
  // results were released \u2014 with the evidence printed on every line.
  function tabBilling() {
    if (!S.billing) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\u2026"));
    var id = S.school.id, c = S.billing.contract, invs = S.billing.invoices;

    function reloadB() { S.billing = null; loadSchoolTab(); }
    function saveContract() {
      var f = S.form || {};
      run(api("/api/admin/billing/contract", { method: "POST", body: {
        schoolId: id, shape: f.shape, ratePaise: Math.round((Number(f.rateRupees) || 0) * 100),
        academicYear: f.academicYear, startsOn: f.startsOn, endsOn: f.endsOn, notes: f.notes } }),
        function () { S.notice = "Contract saved."; S.form = null; reloadB(); });
    }
    function raise() {
      run(api("/api/admin/billing/invoices", { method: "POST", body: { schoolId: id, academicYear: c.academicYear } }),
        function (r) { S.notice = "Invoice " + r.invoice.number + " drafted."; reloadB(); });
    }
    function mark(inv, status) {
      run(api("/api/admin/billing/invoice/" + encodeURIComponent(inv.id) + "/status",
        { method: "POST", body: { status: status } }),
        function () { S.notice = "Marked " + status.toLowerCase() + "."; reloadB(); });
    }

    var editing = S.form && S.form.contract;
    if (editing && isOps()) {
      var f = S.form;
      function b(k) { return function (e) { f[k] = e.target.value; }; }
      return el("div", { class: "card" },
        el("div", { class: "card-h" }, el("h2", null, c ? "Change the contract" : "Set a contract")),
        el("div", { class: "card-b" },
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "Shape"),
              el("select", { onchange: b("shape") },
                [["PER_STUDENT_YEAR","Per student, per year"],["PER_CAMP","Per camp"],
                 ["FLAT_ANNUAL","Flat annual fee"],["FREE","Free \u2014 nothing is invoiced"]].map(function (o) {
                  return el("option", { value: o[0], selected: f.shape === o[0] }, o[1]); }))),
            el("div", { class: "fld" }, el("label", null, "Rate (\u20b9)"),
              el("input", { type: "number", step: "0.01", value: f.rateRupees, oninput: b("rateRupees") }))),
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "Academic year"),
              el("input", { value: f.academicYear, oninput: b("academicYear") })),
            el("div", { class: "fld" }, el("label", null, "Notes"),
              el("input", { value: f.notes, oninput: b("notes") }))),
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "Starts"),
              el("input", { type: "date", value: f.startsOn, oninput: b("startsOn") })),
            el("div", { class: "fld" }, el("label", null, "Ends"),
              el("input", { type: "date", value: f.endsOn, oninput: b("endsOn") }))),
          el("p", { class: "hint" },
            "Rates are stored in paise, so nothing here is ever a rounding error. A free contract is a real option and invoices nothing.")),
        el("div", { class: "card-f" }, el("div", { class: "row" },
          el("button", { class: "pri", disabled: S.busy, onclick: saveContract }, "Save contract"),
          el("button", { onclick: function () { set({ form: null }); } }, "Cancel"))));
    }

    return el("div", null,
      el("div", { class: "msg info" },
        "Invoices are built from children whose results were actually released \u2014 never from a headcount. There is no payment gateway here: mark an invoice paid when the money arrives."),
      el("div", { class: "card" },
        el("div", { class: "card-h" },
          el("div", { style: "flex:1" }, el("h2", null, "Contract")),
          c ? el("span", { class: "pill info" }, c.shape.replace(/_/g, " ").toLowerCase()) : null),
        el("div", { class: "card-b" },
          c
            ? el("dl", { class: "kv", style: "margin:0" },
                el("dt", null, "Shape"), el("dd", null, c.shape.replace(/_/g, " ").toLowerCase()),
                el("dt", null, "Rate"), el("dd", null, c.shape === "FREE" ? "\u2014" : "\u20b9 " + c.rateRupees),
                el("dt", null, "Year"), el("dd", null, c.academicYear || "\u2014"),
                el("dt", null, "Period"), el("dd", null, (c.startsOn || "\u2014") + " to " + (c.endsOn || "\u2014")),
                el("dt", null, "Notes"), el("dd", null, c.notes || "\u2014"))
            : el("p", { class: "muted", style: "font-size:13.5px;margin:0" },
                "No contract yet. Nothing can be invoiced until VitaHero operations sets one.")),
        isOps() ? el("div", { class: "card-f" }, el("div", { class: "row" },
          el("button", { onclick: function () {
            set({ form: { contract: true, shape: c ? c.shape : "PER_STUDENT_YEAR",
              rateRupees: c ? c.rateRupees : "", academicYear: c ? c.academicYear : (S.school.academicYear || ""),
              startsOn: c ? c.startsOn : "", endsOn: c ? c.endsOn : "", notes: c ? c.notes : "" } }); } },
            c ? "Change contract" : "Set a contract"),
          c && c.shape !== "FREE"
            ? el("button", { class: "pri", disabled: S.busy, onclick: raise }, "Raise an invoice")
            : null)) : null),
      el("div", { class: "card" },
        el("div", { class: "card-h" }, el("h2", null, "Invoices")),
        !invs
          ? el("div", { class: "empty" }, "Loading\u2026")
          : invs.length === 0
            ? el("div", { class: "empty" }, el("p", { style: "font-size:13.5px;margin:0" }, "None raised."))
            : el("table", null,
                el("thead", null, el("tr", null, el("th", null, "Number"), el("th", null, "Year"),
                  el("th", { class: "num" }, "Amount"), el("th", null, "Status"), el("th", null, ""))),
                el("tbody", null, invs.map(function (iv) {
                  return el("tr", null,
                    el("td", { class: "mono" }, iv.number),
                    el("td", null, iv.academicYear || "\u2014"),
                    el("td", { class: "num" }, "\u20b9 " + iv.amountRupees),
                    el("td", null, statusPill(iv.status)),
                    el("td", { style: "text-align:right" }, isOps()
                      ? el("div", { class: "row" },
                          iv.status === "DRAFT" ? el("button", { class: "sm", onclick: function () { mark(iv, "SENT"); } }, "Mark sent") : null,
                          iv.status === "SENT" ? el("button", { class: "sm pri", onclick: function () { mark(iv, "PAID"); } }, "Mark paid") : null,
                          iv.status !== "PAID" ? el("button", { class: "sm dang", onclick: function () { mark(iv, "VOID"); } }, "Void") : null)
                      : null));
                })))));
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
              ? el("div", null,
                  el("div", { class: "row", style: "margin-bottom:8px" },
                    el("button", { class: "sm", onclick: function () {
                      f.grades = grades.slice(); render();
                    } }, "Select all"),
                    el("button", { class: "sm", onclick: function () {
                      f.grades = []; render();
                    } }, "Clear"),
                    S.classes && S.classes.derived
                      ? el("span", { class: "muted", style: "font-size:12.5px" },
                          "From the roster \\u2014 these are the classes your imported children are in.")
                      : null),
                  el("div", { class: "chips" }, grades.map(function (g) {
                    var on = f.grades.indexOf(g) >= 0;
                    return el("label", { class: "chip" + (on ? " on" : "") },
                      el("input", { type: "checkbox", checked: on, onchange: function () { togList(f.grades, g); } }), g); })))
              // The dead end this replaces: it said "set them up first" and
              // offered no way to, while the server refused the camp for
              // having no classes. Now it takes you there.
              : el("div", { class: "msg warn", style: "margin:0" },
                  el("div", null, "No classes yet. A camp covers classes, so there is nothing to schedule against."),
                  el("div", { class: "row", style: "margin-top:8px" },
                    el("button", { class: "sm pri", onclick: function () {
                      S.form = null; S.schoolTab = "classes"; S.error = ""; render(); loadSchoolTab();
                    } }, "Set up classes"),
                    el("button", { class: "sm", onclick: function () {
                      S.form = null; S.schoolTab = "roster"; S.error = ""; render(); loadSchoolTab();
                    } }, "Import a roster instead")))),
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
    if (can.schedule) tabs.push(["people", "Parents & children", null]);
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
        : S.campTab === "people" ? campPeopleTab()
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
      photosCard(c),
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

  // Photography is a second consent, not a setting. The copy says so, because
  // whoever flips this switch is the person who has to ask guardians again.
  function photosCard(c) {
    function toggle(on) {
      if (on && !confirm("Turn photographs on for this camp?\\n\\nEvery guardian must be asked separately before any photo can be taken. Consent to the check-up is not consent to a camera.")) return;
      run(api("/api/admin/camps/" + c.id + "/photos-enabled", { method: "POST", body: { enabled: on } }),
        function () {
          S.notice = on
            ? "Photographs are on. Guardians will now be asked the photography question as well."
            : "Photographs are off for this camp.";
          refreshCamp();
        });
    }
    return el("div", { class: "card" },
      el("div", { class: "card-h" },
        el("div", { style: "flex:1" }, el("h2", null, "Photographs")),
        el("span", { class: "pill " + (c.photosEnabled ? "warn" : "") }, c.photosEnabled ? "On" : "Off")),
      el("div", { class: "card-b" },
        el("p", { class: "muted", style: "font-size:13px;margin:0 0 10px" },
          c.photosEnabled
            ? "A screener can attach a photograph to a finding, but only for a child whose guardian said yes to photographs specifically. Every photograph opened is recorded against the person who opened it."
            : "Off, which is right for almost every camp. Turn this on only where a picture changes a clinical decision \\u2014 a skin lesion, a squint, a caries pattern."),
        el("div", { class: "row" },
          el("button", { class: c.photosEnabled ? "dang" : "", disabled: S.busy,
            onclick: function () { toggle(!c.photosEnabled); } },
            c.photosEnabled ? "Turn photographs off" : "Turn photographs on"),
          el("span", { class: "muted", style: "font-size:12.5px" },
            c.photosEnabled
              ? "Cannot be switched off once photographs exist \\u2014 delete them first."
              : "Guardians are not shown the photography question while this is off.")))); 
  }

  /**
   * Assign someone to this camp — and, when there is nobody to assign, create
   * them here.
   *
   * Adding staff lived only under the school's People tab, so from the camp
   * screen the dropdown was empty and the message said everyone was already
   * assigned. Correct, and useless: there was no way from here to the thing
   * you actually needed to do.
   */
  function assignStaffRow(c) {
    if (!S.staff) {
      api("/api/admin/schools/" + c.schoolId + "/staff").then(function (r) { S.staff = r.staff; render(); }).catch(function () {});
      return el("span", { class: "muted", style: "font-size:13px" }, "Loading team\\u2026");
    }
    var assigned = S.camp.staff.map(function (s) { return s.profileId; });
    var avail = S.staff.filter(function (s) { return assigned.indexOf(s.profileId) < 0; });

    if (S.form && S.form.newStaff) {
      var f = S.form;
      var b = function (k) { return function (e) { f[k] = e.target.value; }; };
      return el("div", null,
        el("div", { class: "g3" },
          el("div", { class: "fld" }, el("label", null, "Name"),
            el("input", { value: f.name, oninput: b("name"), placeholder: "Nurse Devi" })),
          el("div", { class: "fld" }, el("label", null, "Mobile number"),
            el("input", { value: f.phone, oninput: b("phone"), placeholder: "9876543210" })),
          el("div", { class: "fld" }, el("label", null, "Role"),
            el("select", { onchange: b("role") },
              el("option", { value: "SCREENER", selected: f.role === "SCREENER" }, "Screener"),
              el("option", { value: "PHYSICIAN", selected: f.role === "PHYSICIAN" }, "Physician")))),
        el("div", { class: "hint", style: "margin-bottom:10px" },
          "They sign in to this console with that mobile number \\u2014 no password. A physician can approve results; a screener can only record them."),
        el("div", { class: "row" },
          el("button", { class: "pri", disabled: S.busy, onclick: function () {
            run(api("/api/admin/schools/" + c.schoolId + "/staff", { method: "POST",
              body: { name: f.name, phone: f.phone, role: f.role } }), function (d) {
              // Straight onto this camp: adding them was only ever a step
              // towards assigning them.
              run(api("/api/admin/camps/" + c.id + "/staff", { method: "POST",
                body: { profileId: d.staff.profileId } }), function () {
                S.notice = d.staff.name + " added and assigned to this camp.";
                S.form = null; S.staff = null; refreshCamp();
              });
            });
          } }, "Add and assign"),
          el("button", { onclick: function () { set({ form: null }); } }, "Cancel")));
    }

    var sel;
    return el("div", { class: "row" },
      avail.length
        ? sel = el("select", { style: "max-width:280px" }, avail.map(function (s) {
            return el("option", { value: s.profileId }, s.name + " \\u2014 " + (s.role === "PHYSICIAN" ? "Physician" : "Screener")); }))
        : el("span", { class: "muted", style: "font-size:13px" },
            S.staff.length ? "Everyone at this school is already on this camp." : "No screeners or physicians yet."),
      avail.length
        ? el("button", { disabled: S.busy, onclick: function () {
            run(api("/api/admin/camps/" + c.id + "/staff", { method: "POST", body: { profileId: sel.value } }),
              function () { S.notice = "Assigned."; refreshCamp(); });
          } }, "Assign to camp")
        : null,
      el("button", { class: avail.length ? "" : "pri", onclick: function () {
        set({ form: { newStaff: true, name: "", phone: "", role: "SCREENER" } });
      } }, icon("userPlus", 14), " Add someone new"));
  }

  // ══════════════════════════════════════ everyone at this camp
  //
  // The office view. One row per child with the guardian, their number, where
  // consent stands, and whether they can even receive the result — which is
  // the list somebody prints and works down the day before a camp.
  function campPeopleTab() {
    if (!S.campPeople) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\u2026"));
    var all = S.campPeople.people;
    var q = (S.peopleQuery || "").toLowerCase();
    var rows = q
      ? all.filter(function (p) {
          return (p.kidName + " " + p.guardianName + " " + p.guardianPhone + " " + p.grade)
            .toLowerCase().indexOf(q) >= 0;
        })
      : all;

    function exportPeople() {
      download("camp-" + S.camp.camp.id + "-people.csv", toCsv(all.map(function (p) {
        return {
          Child: p.kidName, Class: (p.grade || "") + (p.section ? " " + p.section : ""),
          Age: p.age === null ? "" : p.age, Gender: p.gender, AdmissionNo: p.studentRef,
          Guardian: p.guardianName, Mobile: p.guardianPhone,
          UsingApp: p.usingApp ? "yes" : "no", Consent: p.consent,
          Photographs: p.photoConsent ? "yes" : "no",
          Attendance: p.attendance, Result: p.status, FollowUps: p.referrals,
        };
      })));
    }

    var noApp = all.filter(function (p) { return !p.usingApp; }).length;
    return el("div", null,
      el("div", { class: "row", style: "margin-bottom:12px" },
        el("input", { value: S.peopleQuery, placeholder: "Search child, guardian or number",
          style: "max-width:300px",
          oninput: function (e) { S.peopleQuery = e.target.value; render(); } }),
        el("div", { style: "flex:1" }),
        el("button", { onclick: exportPeople }, icon("download", 14), " Export CSV")),
      noApp
        ? el("div", { class: "msg warn" },
            noApp + " of these families are not on the app yet, so a released result will not reach them. "
            + "Invite them from the school\u2019s App invites tab.")
        : null,
      el("div", { class: "tw" }, el("table", null,
        el("thead", null, el("tr", null, el("th", null, "Child"), el("th", null, "Class"),
          el("th", null, "Guardian"), el("th", null, "Mobile"), el("th", null, "App"),
          el("th", null, "Consent"), el("th", null, "Attendance"), el("th", null, "Result"))),
        el("tbody", null, rows.map(function (p) {
          return el("tr", null,
            el("td", null, el("b", null, p.kidName),
              p.studentRef ? el("div", { class: "muted mono", style: "font-size:12px" },
                p.studentRef.replace(/^sid_/, "")) : null),
            el("td", null, (p.grade || "") + (p.section ? " " + p.section : "")),
            el("td", null, p.guardianName || el("span", { class: "muted" }, "\u2014")),
            el("td", { class: "mono" }, p.guardianPhone || "\u2014"),
            el("td", null, p.usingApp
              ? el("span", { class: "pill ok" }, "Yes")
              : el("span", { class: "pill warn" }, "No")),
            el("td", null, statusPill(p.consent)),
            el("td", null, p.attendance === "UNKNOWN"
              ? el("span", { class: "muted" }, "\u2014") : statusPill(p.attendance)),
            el("td", null, statusPill(p.status)));
        })))),
      el("p", { class: "muted", style: "margin-top:10px;font-size:12.5px" },
        rows.length + " of " + all.length + " shown."));
  }

  function campConsent() {
    if (!S.participants) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\\u2026"));
    var c = S.camp.camp;
    function paper(kid, decision, photos) {
      run(api("/api/admin/camps/" + c.id + "/consent/record", { method: "POST",
        body: { kidId: kid.kidId, decision: decision, source: "PAPER",
                consentPhotos: photos === true, note: "Recorded in the console" } }),
        function () { S.participants = null; S.notice = "Recorded for " + kid.name + "."; refreshCamp("consent"); });
    }
    var pend = S.participants.filter(function (p) { return p.consentStatus === "PENDING"; });
    return el("div", null,
      el("div", { class: "msg info" },
        "Consent is per camp and per child. A child cannot be screened without it \\u2014 that rule is enforced by the server, not by this screen."),
      c.photosEnabled
        ? el("div", { class: "msg warn" },
            "Photographs are on for this camp, so the paper form has two questions. Tick photographs only where the guardian ticked it themselves \\u2014 agreeing to a check-up is not agreeing to a camera.")
        : null,
      el("div", { class: "tw" }, el("table", null,
        el("thead", null, el("tr", null, el("th", null, "Child"), el("th", null, "Class"), el("th", null, "Guardian"),
          el("th", null, "Mobile"), el("th", null, "Consent"),
          c.photosEnabled ? el("th", null, "Photographs") : null,
          el("th", null, "Record a paper form"))),
        el("tbody", null, S.participants.map(function (p) {
          return el("tr", null,
            el("td", null, el("b", null, p.name)),
            el("td", null, (p.grade || "") + (p.section ? " " + p.section : "")),
            el("td", null, p.guardianName || el("span", { class: "muted" }, "\\u2014")),
            el("td", { class: "mono" }, p.guardianPhone),
            el("td", null, statusPill(p.consentStatus)),
            c.photosEnabled
              ? el("td", null, p.consentStatus === "PENDING"
                  ? el("span", { class: "muted" }, "\\u2014")
                  : el("span", { class: "pill " + (p.consentPhotos ? "warn" : "") },
                      p.consentPhotos ? "Allowed" : "Not allowed"))
              : null,
            el("td", null, p.consentStatus === "PENDING"
              ? el("div", { class: "row" },
                  el("button", { class: "sm", onclick: function () { paper(p, "PAPER", false); } },
                    c.photosEnabled ? "Check-up only" : "Granted on paper"),
                  c.photosEnabled
                    ? el("button", { class: "sm", onclick: function () { paper(p, "PAPER", true); } }, "Check-up + photographs")
                    : null,
                  el("button", { class: "sm dang", onclick: function () { paper(p, "DECLINED"); } }, "Declined"))
              : el("span", { class: "muted", style: "font-size:12.5px" }, "Answered")));
        })))),
      pend.length ? el("p", { class: "muted", style: "margin-top:10px;font-size:12.5px" },
        pend.length + " still waiting. Use Setup \\u2192 Request consent to send a reminder.") : null);
  }

  // ══════════════════════════════════════ camp day
  function campDay() {
    var c = S.camp.camp;
    var pack = packLoad(c.id);
    var queued = queueLoad(c.id);
    var offline = isOffline();

    // Offline, the downloaded pack is the only truth this device has.
    var source = S.participants || (pack ? pack.participants : null);
    if (!source) {
      return el("div", null, campDayBar(pack, queued, offline),
        el("div", { class: "card" }, el("div", { class: "empty" },
          offline
            ? el("div", null, el("h3", null, "No camp downloaded"),
                el("p", { style: "font-size:13.5px" },
                  "This device is offline and has no pack for this camp. Reconnect and download it before the camp starts."))
            : "Loading\\u2026")));
    }

    var q = (S.search || "").toLowerCase();
    var queuedIds = {};
    queued.forEach(function (e) { queuedIds[e.kidId] = true; });
    var list = source.filter(function (p) {
      return !q || p.name.toLowerCase().indexOf(q) >= 0 || (p.studentRef || "").toLowerCase().indexOf(q) >= 0;
    });
    var selected = S.screenKid;
    return el("div", null,
      campDayBar(pack, queued, offline),
      S.syncRejects && S.syncRejects.length
        ? el("div", { class: "msg err" },
            el("b", null, S.syncRejects.length + " could not be saved: "),
            S.syncRejects.map(function (r) { return r.reason; })
              .filter(function (v, i, a) { return a.indexOf(v) === i; }).join("; "))
        : null,
      el("div", { class: "split" },
        el("div", null,
          el("input", { type: "text", placeholder: "Search name or roll number", value: S.search || "",
            oninput: function (e) { S.search = e.target.value; render(); }, style: "margin-bottom:10px" }),
          el("div", { class: "plist" }, list.length === 0
            ? el("div", { class: "empty", style: "padding:24px 14px" },
                source.length ? "No match." : el("span", null, "No children on this camp yet. An administrator needs to build the list under Setup."))
            : list.map(function (p) {
                return el("button", { class: "pitem" + (selected === p.kidId ? " on" : ""),
                  onclick: function () { openScreening(p.kidId); } },
                  el("b", null, p.name),
                  el("div", { class: "sub" },
                    el("span", null, (p.grade || "") + (p.section ? " " + p.section : "")),
                    statusPill(p.consentStatus === "PENDING" || p.consentStatus === "DECLINED" ? p.consentStatus : p.status),
                    queuedIds[p.kidId] ? el("span", { class: "pill info" }, "Queued") : null,
                    p.attendance === "ABSENT" ? el("span", { class: "pill mute" }, "Absent") : null));
              }))),
        el("div", null, selected ? screeningPanel() : el("div", { class: "card" }, el("div", { class: "empty" },
          el("h3", null, "Choose a child"),
          el("p", { style: "font-size:13.5px" }, "Pick someone from the list to record their check-up."))))));
  }

  function campDayBar(pack, queued, offline) {
    var c = S.camp.camp;
    function download() {
      run(api("/api/admin/camps/" + c.id + "/pack"), function (d) {
        if (!packStore(c.id, d)) {
          S.error = "This device does not have room to store the camp. Free some space and try again.";
          return;
        }
        S.notice = "Downloaded " + d.participants.length + " children. You can now work without a signal.";
      });
    }
    return el("div", { class: "card", style: "margin-bottom:14px" },
      el("div", { class: "card-b", style: "padding:12px 16px" },
        el("div", { class: "row" },
          el("span", { class: "pill " + (offline ? "warn" : "ok") }, offline ? "Offline" : "Online"),
          pack
            ? el("span", { class: "muted", style: "font-size:12.5px" },
                pack.participants.length + " children downloaded " + fmtDate(pack.downloadedAt))
            : el("span", { class: "muted", style: "font-size:12.5px" }, "Not downloaded for offline use"),
          queued.length ? el("span", { class: "pill info" }, queued.length + " waiting to sync") : null,
          el("span", { style: "flex:1" }),
          !offline ? el("button", { class: "sm", disabled: S.busy, onclick: download },
            pack ? "Refresh download" : "Download for offline use") : null,
          queued.length && !offline
            ? el("button", { class: "sm pri", disabled: S.busy, onclick: function () { syncQueue(c.id); } },
                S.busy ? "Syncing\\u2026" : "Sync " + queued.length + " now")
            : null,
          el("button", { class: "sm ghost", onclick: function () { set({ forceOffline: !S.forceOffline }); } },
            S.forceOffline ? "Rejoin network" : "Test offline")),
        offline && queued.length
          ? el("div", { class: "hint", style: "margin-top:8px" },
              "Captures are saved on this device and upload when you are back on a network. Do not clear your browser data.")
          : null));
  }

  function openScreening(kidId) {
    S.screenKid = kidId; S.screenForm = null; S.error = ""; S.saved = null;
    S.photos = null; S.photosKid = null; S.photoOpen = null;

    // Offline, build the same shape from the downloaded pack plus anything
    // already queued on this device, so the form looks identical either way.
    if (isOffline()) {
      var pack = packLoad(S.camp.camp.id);
      var person = pack && pack.participants.filter(function (x) { return x.kidId === kidId; })[0];
      if (!person) { set({ error: "That child is not in the downloaded camp." }); return; }
      var queuedEntry = queueLoad(S.camp.camp.id).filter(function (e) { return e.kidId === kidId; })[0];
      S.screenData = {
        child: person,
        consentStatus: person.consentStatus,
        attendance: (queuedEntry && queuedEntry.attendance) || person.attendance,
        status: person.status,
        checks: person.checks,
        excludedByConsent: pack.camp.checks.filter(function (ct) { return person.checks.indexOf(ct) < 0; }),
        findings: (queuedEntry && queuedEntry.findings)
          ? queuedEntry.findings.map(function (f) { return { checkType: f.checkType, detail: f.detail, flag: "", note: f.note || "" }; })
          : person.findings,
      };
      var f0 = {};
      (person.checks || []).forEach(function (ct) {
        var prev = (S.screenData.findings || []).filter(function (x) { return x.checkType === ct; })[0];
        f0[ct] = prev ? JSON.parse(JSON.stringify(prev.detail || {})) : {};
      });
      S.screenForm = f0;
      render();
      return;
    }

    render();
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
      if (isOffline()) {
        queuePush(S.camp.camp.id, { kidId: ch.kidId, attendance: v });
        d.attendance = v;
        S.notice = ch.name + " marked " + v.toLowerCase() + ". Saved on this device.";
        render();
        return;
      }
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
      if (isOffline()) {
        var n = queuePush(S.camp.camp.id, { kidId: ch.kidId, findings: findings, attendance: d.attendance });
        // No flags to show: the clinical rules run on the server, and guessing
        // them here would risk the device and the record disagreeing.
        S.saved = null;
        S.notice = "Saved " + ch.name + " on this device. " + n + " waiting to sync.";
        S.screenKid = null; S.screenData = null;
        render();
        return;
      }
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
        photoBlock(d, ch),
        el("div", { class: "row" },
          el("button", { class: "pri big", disabled: S.busy, onclick: save }, S.busy ? "Saving\\u2026" : "Save check-up"),
          el("button", { onclick: function () { set({ screenKid: null, screenData: null, saved: null }); } }, "Done"))));
  }

  /**
   * Photographs, shown only where both switches are on. Offline it is not
   * offered at all: the queue carries measurements, and a photo taken with no
   * way to check consent on the server is a photo that should not be taken.
   */
  function photoBlock(d, ch) {
    if (!d.photosEnabled) return null;
    if (!d.consentPhotos) {
      return el("div", { class: "msg info" },
        "This guardian agreed to the check-up but not to photographs. No camera for this child.");
    }
    if (isOffline()) {
      return el("div", { class: "msg warn" },
        "Photographs need a connection, because consent is checked on the server. Record the measurements now and add the photograph when you are back online.");
    }
    if (S.photos === null || S.photos === undefined || S.photosKid !== ch.kidId) {
      S.photosKid = ch.kidId;
      S.photos = [];
      api("/api/admin/camps/" + S.camp.camp.id + "/photos/" + encodeURIComponent(ch.kidId))
        .then(function (r) { S.photos = r.photos; render(); }).catch(function () {});
    }

    var sel, cap, file;
    function upload() {
      var f = file.files && file.files[0];
      if (!f) { set({ error: "Choose a photograph first." }); return; }
      if (f.size > 220 * 1024) {
        set({ error: "That photograph is " + Math.round(f.size / 1024) + " KB. The limit is 220 KB \\u2014 use your camera's smallest setting." });
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        run(api("/api/admin/camps/" + S.camp.camp.id + "/photos/" + encodeURIComponent(ch.kidId),
          { method: "POST", body: { checkType: sel.value, mime: f.type, caption: cap.value, data: String(reader.result) } }),
          function () { S.notice = "Photograph attached."; S.photos = null; S.photosKid = null; render(); });
      };
      reader.readAsDataURL(f);
    }
    function open(id) {
      run(api("/api/admin/photo/" + encodeURIComponent(id)), function (r) {
        S.photoOpen = r; render();
      });
    }
    function remove(id) {
      if (!confirm("Delete this photograph? This cannot be undone.")) return;
      run(api("/api/admin/photo/" + encodeURIComponent(id), { method: "DELETE" }), function () {
        S.notice = "Photograph deleted."; S.photos = null; S.photosKid = null; S.photoOpen = null; render();
      });
    }

    return el("div", { class: "card" },
      el("div", { class: "card-h" },
        el("div", { style: "flex:1" }, el("h2", null, "Photographs")),
        el("span", { class: "pill warn" }, "Consented")),
      el("div", { class: "card-b" },
        el("p", { class: "muted", style: "font-size:13px;margin:0 0 10px" },
          "Only where a picture changes the decision. Four per child, 220 KB each. The guardian and this camp's clinical team can see them; the school office cannot. Every time one is opened, it is recorded."),
        (S.photos || []).length
          ? el("table", null, el("tbody", null, (S.photos || []).map(function (ph) {
              return el("tr", null,
                el("td", null, el("b", null, ph.checkType),
                  ph.caption ? el("div", { class: "muted", style: "font-size:12.5px" }, ph.caption) : null),
                el("td", { class: "muted", style: "font-size:12px" }, Math.round(ph.bytes / 1024) + " KB \\u00b7 " + (ph.uploadedBy || "")),
                el("td", { style: "text-align:right" }, el("div", { class: "row" },
                  el("button", { class: "sm", onclick: function () { open(ph.id); } }, "View"),
                  el("button", { class: "sm dang", onclick: function () { remove(ph.id); } }, "Delete"))));
            })))
          : el("p", { class: "muted", style: "font-size:13px;margin:0" }, "None attached."),
        S.photoOpen
          ? el("div", { style: "margin-top:12px" },
              el("img", { src: "data:" + S.photoOpen.mime + ";base64," + S.photoOpen.base64,
                style: "max-width:320px;border-radius:10px;border:1px solid var(--line)" }),
              el("div", null, el("button", { class: "sm", onclick: function () { set({ photoOpen: null }); } }, "Close")))
          : null),
      el("div", { class: "card-f" },
        el("div", { class: "row" },
          sel = el("select", { style: "max-width:180px" }, (d.checks || []).map(function (ct) {
            return el("option", { value: ct }, ct); })),
          file = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp", capture: "environment" }),
          cap = el("input", { type: "text", placeholder: "What this shows", style: "max-width:220px" }),
          el("button", { disabled: S.busy, onclick: upload }, "Attach"))));
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
  // ══════════════════════════════════════ the reading library
  //
  // Articles are matched to a child's own released findings, so what a family
  // is offered is about their child rather than health advice in general. That
  // makes the tags the important field on this screen, not the prose.
  function loadLibrary() {
    run(api("/api/admin/library"), function (d) { S.library = d; S.view = "library"; S.libForm = null; });
  }

  function viewLibrary() {
    if (!S.library) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\u2026"));
    var lib = S.library;

    function edit(a) {
      set({ libForm: a
        ? { slug: a.slug, locale: a.locale, title: a.title, summary: a.summary, body: a.body,
            checkTypes: (a.checkTypes || []).slice(), flags: (a.flags || []).slice(),
            minAge: a.minAge, maxAge: a.maxAge, published: a.published }
        : { slug: "", locale: "en", title: "", summary: "", body: "",
            checkTypes: [], flags: [], minAge: 0, maxAge: 99, published: true } });
    }
    function save() {
      run(api("/api/admin/library", { method: "POST", body: S.libForm }), function () {
        S.notice = "Saved."; S.libForm = null; loadLibrary();
      });
    }
    function del(a) {
      if (!confirm("Delete " + a.slug + " (" + a.locale + ")?")) return;
      run(api("/api/admin/library/" + encodeURIComponent(a.slug) + "/" + encodeURIComponent(a.locale),
        { method: "DELETE" }), function () { S.notice = "Deleted."; loadLibrary(); });
    }

    if (S.libForm) {
      var f = S.libForm;
      function b(k) { return function (e) { f[k] = e.target.value; }; }
      function tog(list, v) { var i = list.indexOf(v); if (i >= 0) list.splice(i, 1); else list.push(v); render(); }
      return el("div", { class: "card" },
        el("div", { class: "card-h" }, el("h2", null, f.slug ? "Edit article" : "New article")),
        el("div", { class: "card-b" },
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "Slug"),
              el("input", { value: f.slug, oninput: b("slug"), placeholder: "iron-rich-foods" })),
            el("div", { class: "fld" }, el("label", null, "Language"),
              el("select", { onchange: b("locale") }, (lib.locales || ["en"]).map(function (l) {
                return el("option", { value: l, selected: f.locale === l }, l); })))),
          el("div", { class: "fld" }, el("label", null, "Title"),
            el("input", { value: f.title, oninput: b("title") })),
          el("div", { class: "fld" }, el("label", null, "One-line summary"),
            el("input", { value: f.summary, oninput: b("summary") })),
          el("div", { class: "fld" }, el("label", null, "Body"),
            el("textarea", { rows: 10, value: f.body, oninput: b("body") })),
          el("div", { class: "fld" },
            el("label", null, "Shown to families whose child has one of these checks flagged"),
            el("div", { class: "chips" }, (lib.checkTypes || []).map(function (ct) {
              return el("button", { class: "chip" + (f.checkTypes.indexOf(ct) >= 0 ? " on" : ""),
                onclick: function () { tog(f.checkTypes, ct); } }, ct); }))),
          el("div", { class: "fld" }, el("label", null, "At these flags"),
            el("div", { class: "chips" }, ["WATCH", "ALERT"].map(function (fl) {
              return el("button", { class: "chip" + (f.flags.indexOf(fl) >= 0 ? " on" : ""),
                onclick: function () { tog(f.flags, fl); } }, fl); }))),
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "Youngest age"),
              el("input", { type: "number", value: f.minAge, oninput: b("minAge") })),
            el("div", { class: "fld" }, el("label", null, "Oldest age"),
              el("input", { type: "number", value: f.maxAge, oninput: b("maxAge") }))),
          el("p", { class: "hint" },
            "Leave the checks empty to put an article on the general shelf, shown to every family. Tagged articles appear only for a child who actually has that finding, at that age.")),
        el("div", { class: "card-f" }, el("div", { class: "row" },
          el("button", { class: "pri", disabled: S.busy, onclick: save }, "Save article"),
          el("button", { onclick: function () { set({ libForm: null }); } }, "Cancel"))));
    }

    return el("div", null,
      el("div", { class: "msg info" },
        "This is what families read after a camp. Write plainly, in the second person, and never write anything that reads like a diagnosis \u2014 the physician's recommendation does that job."),
      el("div", { class: "row", style: "margin-bottom:14px" },
        el("div", { style: "flex:1" }),
        el("button", { class: "pri", onclick: function () { edit(null); } }, "New article")),
      el("div", { class: "tw" }, el("table", null,
        el("thead", null, el("tr", null, el("th", null, "Article"), el("th", null, "Language"),
          el("th", null, "Shown for"), el("th", null, "Ages"), el("th", null, "Status"), el("th", null, ""))),
        el("tbody", null, lib.articles.map(function (a) {
          return el("tr", null,
            el("td", null, el("b", null, a.title),
              el("div", { class: "muted mono", style: "font-size:12px" }, a.slug)),
            el("td", null, a.locale),
            el("td", { class: "muted", style: "font-size:12.5px" },
              (a.checkTypes || []).length
                ? (a.checkTypes.join(", ") + ((a.flags || []).length ? " \u00b7 " + a.flags.join("/") : ""))
                : "Everyone"),
            el("td", { class: "muted" }, a.minAge + "\u2013" + a.maxAge),
            el("td", null, el("span", { class: "pill " + (a.published ? "ok" : "") }, a.published ? "Published" : "Draft")),
            el("td", { style: "text-align:right" }, el("div", { class: "row" },
              el("button", { class: "sm", onclick: function () { edit(a); } }, "Edit"),
              el("button", { class: "sm dang", onclick: function () { del(a); } }, "Delete"))));
        })))));
  }

  // ══════════════════════════════════════ hospitals and doctors
  //
  // The directory the parent app reads when a child is referred. It was seeded
  // once and had no editor, which meant the first pilot could not add the
  // hospital actually next to the school.
  function loadHospitals() {
    run(api("/api/admin/hospitals" + (S.hosQuery ? "?q=" + encodeURIComponent(S.hosQuery) : "")),
      function (d) {
        S.hospitals = d; S.view = "hospitals"; S.hosForm = null; S.docForm = null;
        // The catch is for the request, not for render(). It used to wrap both,
        // so a render error was swallowed whole and the console went blank with
        // nothing in the log — which is how a missing field in one response
        // could look like the app had simply died.
        api("/api/admin/doctors").then(
          function (r) { S.doctors = r; },
          function () { S.doctors = { doctors: [] }; }
        ).then(render);
      });
  }

  function viewHospitals() {
    if (!S.hospitals) return el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\u2026"));
    var canEdit = S.hospitals.canEdit;

    function saveHospital() {
      run(api("/api/admin/hospitals", { method: "POST", body: S.hosForm }), function () {
        S.notice = "Saved."; S.hosForm = null; loadHospitals();
      });
    }
    function saveDoctor() {
      run(api("/api/admin/doctors", { method: "POST", body: S.docForm }), function () {
        S.notice = "Saved."; S.docForm = null; loadHospitals();
      });
    }
    function retire(kind, id, name) {
      if (!confirm("Retire " + name + "?\\n\\nIt stops appearing to families, but referrals already written to it keep their record.")) return;
      run(api("/api/admin/" + kind + "/" + encodeURIComponent(id), { method: "DELETE" }), function () {
        S.notice = "Retired."; loadHospitals();
      });
    }

    if (S.hosForm) {
      var f = S.hosForm;
      var hb = function (k) { return function (e) { f[k] = e.target.value; }; };
      return el("div", { class: "card" },
        el("div", { class: "card-h" }, el("h2", null, f.id ? "Edit hospital" : "Add a hospital")),
        el("div", { class: "card-b" },
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "Name"),
              el("input", { value: f.name, oninput: hb("name") })),
            el("div", { class: "fld" }, el("label", null, "Phone"),
              el("input", { value: f.phone, oninput: hb("phone") }))),
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "City"),
              el("input", { value: f.city, oninput: hb("city") })),
            el("div", { class: "fld" }, el("label", null, "District"),
              el("input", { value: f.district, oninput: hb("district") }))),
          el("div", { class: "fld" }, el("label", null, "Address"),
            el("input", { value: f.address, oninput: hb("address") })),
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "Latitude"),
              el("input", { value: f.lat, oninput: hb("lat"), placeholder: "17.44" })),
            el("div", { class: "fld" }, el("label", null, "Longitude"),
              el("input", { value: f.lng, oninput: hb("lng"), placeholder: "78.39" }))),
          el("div", { class: "hint" },
            "Coordinates are optional. With them the app can sort hospitals by how far they are from the family."),
          el("label", { class: "chip" + (f.isCampPartner ? " on" : ""), style: "margin-top:10px" },
            el("input", { type: "checkbox", checked: !!f.isCampPartner,
              onchange: function (e) { f.isCampPartner = e.target.checked; render(); } }),
            "Camp partner \u2014 shown first to these families")),
        el("div", { class: "card-f" }, el("div", { class: "row" },
          el("button", { class: "pri", disabled: S.busy, onclick: saveHospital }, "Save hospital"),
          el("button", { onclick: function () { set({ hosForm: null }); } }, "Cancel"))));
    }

    if (S.docForm) {
      var g = S.docForm;
      var db = function (k) { return function (e) { g[k] = e.target.value; }; };
      return el("div", { class: "card" },
        el("div", { class: "card-h" }, el("h2", null, g.id ? "Edit doctor" : "Add a doctor")),
        el("div", { class: "card-b" },
          el("div", { class: "g2" },
            el("div", { class: "fld" }, el("label", null, "Name"),
              el("input", { value: g.name, oninput: db("name") })),
            el("div", { class: "fld" }, el("label", null, "Specialty"),
              el("input", { value: g.specialty, oninput: db("specialty"), placeholder: "Ophthalmology" }))),
          el("div", { class: "fld" }, el("label", null, "Hospital"),
            el("select", { onchange: db("hospitalId") },
              [el("option", { value: "" }, "\u2014 not attached \u2014")].concat(
                (S.hospitals.hospitals || []).map(function (h) {
                  return el("option", { value: h.id, selected: g.hospitalId === h.id }, h.name + " \u00b7 " + h.city);
                })))),
          el("div", { class: "hint" },
            "A referral names a specialty. Attaching the doctor to a hospital is what lets the app tell a family where to go.")),
        el("div", { class: "card-f" }, el("div", { class: "row" },
          el("button", { class: "pri", disabled: S.busy, onclick: saveDoctor }, "Save doctor"),
          el("button", { onclick: function () { set({ docForm: null }); } }, "Cancel"))));
    }

    var hs = S.hospitals.hospitals || [];
    var searchBox;
    return el("div", null,
      el("div", { class: "msg info" },
        "This is what a family sees when a doctor refers their child onward. A hospital marked as a camp partner is shown first."),
      el("div", { class: "row", style: "margin-bottom:14px" },
        searchBox = el("input", { value: S.hosQuery, placeholder: "Search by name or city",
          style: "max-width:280px",
          oninput: function (e) { S.hosQuery = e.target.value; } }),
        el("button", { onclick: loadHospitals }, icon("search", 14), " Search"),
        el("div", { style: "flex:1" }),
        canEdit ? el("button", { class: "pri", onclick: function () {
          set({ hosForm: { name: "", city: "Hyderabad", district: "", address: "", phone: "",
            lat: "", lng: "", isCampPartner: false } });
        } }, icon("plus", 14), " Add hospital") : null,
        canEdit ? el("button", { onclick: function () {
          set({ docForm: { name: "", specialty: "", hospitalId: "", city: "Hyderabad" } });
        } }, icon("plus", 14), " Add doctor") : null),

      hs.length === 0
        ? el("div", { class: "card" }, el("div", { class: "empty" },
            el("h3", null, "No hospitals"),
            el("p", { style: "font-size:13.5px" }, "Add the hospitals your families can actually reach.")))
        : el("div", { class: "tw" }, el("table", null,
            el("thead", null, el("tr", null, el("th", null, "Hospital"), el("th", null, "City"),
              el("th", null, "Phone"), el("th", { class: "num" }, "Doctors"),
              el("th", null, "Role"), el("th", null, ""))),
            el("tbody", null, hs.map(function (h) {
              return el("tr", { class: h.active ? "" : "muted" },
                el("td", null, el("b", null, h.name),
                  h.address ? el("div", { class: "muted", style: "font-size:12.5px" }, h.address) : null),
                el("td", null, [h.city, h.district].filter(Boolean).join(" \u00b7 ")),
                el("td", { class: "mono" }, h.phone || "\u2014"),
                el("td", { class: "num" }, h.doctorCount),
                el("td", null, h.isCampPartner
                  ? el("span", { class: "pill warn" }, "Camp partner")
                  : el("span", { class: "muted" }, "\u2014")),
                el("td", { style: "text-align:right" }, canEdit
                  ? el("div", { class: "row" },
                      el("button", { class: "sm", onclick: function () {
                        set({ hosForm: {
                          id: h.id, name: h.name, city: h.city, district: h.district,
                          address: h.address, phone: h.phone,
                          lat: h.lat === null ? "" : h.lat, lng: h.lng === null ? "" : h.lng,
                          isCampPartner: h.isCampPartner } });
                      } }, "Edit"),
                      h.active ? el("button", { class: "sm dang", onclick: function () {
                        retire("hospitals", h.id, h.name);
                      } }, "Retire") : el("span", { class: "muted", style: "font-size:12.5px" }, "Retired"))
                  : null));
            })))),

      el("h3", { style: "margin:22px 0 10px" }, "Doctors"),
      !S.doctors
        ? el("div", { class: "card" }, el("div", { class: "empty" }, "Loading\u2026"))
        : (S.doctors.doctors || []).length === 0
          ? el("div", { class: "card" }, el("div", { class: "empty" },
              el("p", { style: "font-size:13.5px;margin:0" }, "None yet.")))
          : el("div", { class: "tw" }, el("table", null,
              el("thead", null, el("tr", null, el("th", null, "Doctor"), el("th", null, "Specialty"),
                el("th", null, "Hospital"), el("th", null, ""))),
              el("tbody", null, (S.doctors.doctors || []).map(function (d) {
                return el("tr", { class: d.active ? "" : "muted" },
                  el("td", null, el("b", null, d.name)),
                  el("td", null, d.specialty),
                  el("td", { class: "muted" }, d.hospitalName || "\u2014"),
                  el("td", { style: "text-align:right" }, canEdit
                    ? el("div", { class: "row" },
                        el("button", { class: "sm", onclick: function () {
                          set({ docForm: { id: d.id, name: d.name, specialty: d.specialty,
                            hospitalId: d.hospitalId, city: d.city } });
                        } }, "Edit"),
                        d.active ? el("button", { class: "sm dang", onclick: function () {
                          retire("doctors", d.id, d.name);
                        } }, "Retire") : el("span", { class: "muted", style: "font-size:12.5px" }, "Retired"))
                    : null));
              })))));
  }

  function navItem(name, label, view, onclick) {
    return el("button", { class: "navi" + (S.view === view ? " on" : ""), onclick: onclick },
      el("span", { class: "ic" }, icon(name, 17)), label);
  }

  function sidebar() {
    return el("nav", { class: "nav" },
      el("div", { class: "brand" }, brandMark(26),
        el("span", { class: "wm" }, el("i", null, "vita"), el("b", null, "hero"))),
      el("div", { class: "navsec" },
        el("h4", null, "Menu"),
        canManage() ? navItem("home", "Overview", "overview", function () { set({ view: "overview" }); if (!S.overview) boot(); }) : null,
        canManage() ? navItem("school", isSchoolAdmin() ? "My school" : "Schools", "schools", function () {
          if (isSchoolAdmin() && S.school) openSchool(S.school.id); else loadSchools();
        }) : null,
        isClinical() ? navItem("stethoscope", "My camps", "mycamps", loadMyCamps) : null,
        isOps() ? navItem("building", "Hospitals", "hospitals", loadHospitals) : null,
        isOps() ? navItem("book", "Library", "library", loadLibrary) : null,
        S.camp ? navItem("flag", "Current camp", "camp", function () { set({ view: "camp" }); }) : null),
      el("div", { class: "navfoot" },
        el("b", null, S.auth.name),
        el("div", { class: "role" }, roleLabel()),
        el("button", { onclick: signOut }, icon("logout", 14), " Sign out")));
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
    if (S.view === "library") return "Reading for families";
    if (S.view === "hospitals") return "Hospitals & doctors";
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
    else if (S.view === "library") body = viewLibrary();
    else if (S.view === "hospitals") body = viewHospitals();
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

    // Any table that was not given a scroller gets one. A phone is 390px wide
    // and a roster table is 620px; without this the document itself scrolls
    // sideways, which drags the sticky header off screen and makes the console
    // unusable in the one place it is most needed — standing in a school hall.
    // Done here rather than at each call site so a table added later is
    // covered too.
    var tables = root.querySelectorAll("table");
    for (var ti = 0; ti < tables.length; ti++) {
      var tb = tables[ti];
      if (tb.parentNode && /\b(tw|tws)\b/.test(tb.parentNode.className || "")) continue;
      var box = document.createElement("div");
      box.className = "tws";
      tb.parentNode.insertBefore(box, tb);
      box.appendChild(tb);
    }
  }

  // ── boot ──
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin" }).catch(function () {});
  }
  window.addEventListener("online", function () {
    render();
    if (S.camp && !S.forceOffline && queueLoad(S.camp.camp.id).length) syncQueue(S.camp.camp.id);
  });
  window.addEventListener("offline", render);

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

/**
 * Caches the console's shell so a screener who left the office online can still
 * open the page in a school hall with no signal. Deliberately minimal: it
 * caches the page itself and nothing else. Camp data is not cached here — the
 * screener downloads a camp pack explicitly, so what is available offline is
 * something they chose rather than whatever happened to be in a cache.
 */
export const SERVICE_WORKER_JS = `
const CACHE = "vitahero-console-v1";
const SHELL = "/admin";

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.add(SHELL); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // API calls must never be served stale — a cached participant list would
  // show a screener consent that has since been withdrawn.
  if (url.pathname.indexOf("/api/") === 0) return;
  if (url.pathname !== "/admin" && url.pathname !== "/admin/") return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(SHELL, copy); });
      return res;
    }).catch(function () {
      return caches.match(SHELL);
    })
  );
});
`;
