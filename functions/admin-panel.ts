export function renderAdminPanel(logoUri: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VitaHero Admin</title>
<link rel="icon" href="${logoUri}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --orange:#F47B20;--orange-d:#D9641A;--orange-soft:#FCE5D1;
  --blue:#1FA2DD;--blue-d:#1380B8;--blue-soft:#D6EFFA;
  --yellow:#FDB813;--yellow-soft:#FFF1CC;
  --purple:#8B5CF6;
  --ink:#0F172A;--ink-soft:#475569;--ink-faint:#94A3B8;
  --canvas:#F8FAFC;--surface:#FFFFFF;--muted:#F1F5F9;
  --hair:#E2E8F0;
  --good:#10B981;--watch:#F59E0B;--alert:#EF4444;
  --radius:20px;--radius-sm:12px;--radius-xs:8px;
  --shadow:0 1px 3px rgba(15,23,42,.08),0 4px 16px rgba(15,23,42,.06);
  --shadow-lg:0 8px 30px rgba(15,23,42,.1);
  --sidebar:260px;--sidebar-collapsed:76px;
}
body{font-family:'Host Grotesk',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:var(--canvas);color:var(--ink);font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased}

/* ── Login ── */
.login-wrap{min-height:100vh;display:grid;grid-template-columns:1.05fr 1fr}
.login-brand{position:relative;overflow:hidden;display:flex;flex-direction:column;padding:48px 44px;color:#fff;min-height:100vh}
.login-brand .bg-img{position:absolute;inset:0;background:url('https://r2-pub.rork.com/projects/0cso3uprrwvti6zjwr0jl/assets/6cdc1d51-87b7-4ac2-b9f4-aa840c15f557.png') center/cover no-repeat;opacity:.38}
.login-brand .bg-grad{position:absolute;inset:0;background:linear-gradient(160deg,rgba(244,123,32,.82) 0%,rgba(31,162,221,.78) 55%,rgba(15,23,42,.72) 100%)}
.login-brand>*{position:relative;z-index:1}
.login-brand .brand-top{display:flex;align-items:center;gap:12px}
.brand-top .brand-logo{height:54px;width:auto;filter:drop-shadow(0 2px 4px rgba(0,0,0,.2))}
.login-brand .spacer{flex:1}
.login-brand .quote{max-width:440px}
.login-brand .quote .q-mark{font-size:56px;line-height:.6;font-weight:700;opacity:.5;margin-bottom:8px;font-family:Georgia,serif}
.login-brand .quote h1{font-size:34px;font-weight:700;line-height:1.18;letter-spacing:-.7px;margin-bottom:16px}
.login-brand .quote p{font-size:16px;line-height:1.65;opacity:.92}
.login-brand .quote .author{margin-top:20px;font-size:13px;font-weight:600;opacity:.72;letter-spacing:.3px;text-transform:uppercase}
.login-form{display:flex;align-items:center;justify-content:center;padding:40px 28px;background:var(--canvas);min-height:100vh}
.login-card{background:var(--surface);border-radius:var(--radius);padding:48px 40px;max-width:400px;width:100%;box-shadow:var(--shadow-lg);border:1px solid var(--hair)}
.login-card .head{margin-bottom:32px}
.login-card .head .label{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--orange);margin-bottom:10px}
.login-card .head h2{font-size:27px;font-weight:700;letter-spacing:-.5px;color:var(--ink);line-height:1.2;margin-bottom:8px}
.login-card .head .sub{color:var(--ink-soft);font-size:14px;line-height:1.5}
.login-card .field-label{display:block;font-size:13px;font-weight:600;color:var(--ink-soft);margin-bottom:8px}
.login-card input{width:100%;padding:14px 16px;border:2px solid var(--hair);border-radius:var(--radius-sm);font-size:15px;font-family:inherit;outline:none;transition:border .2s,box-shadow .2s;background:var(--surface)}
.login-card input:focus{border-color:var(--orange);box-shadow:0 0 0 3px var(--orange-soft)}
.login-card .btn{width:100%;padding:15px;background:linear-gradient(90deg,var(--orange),var(--blue));color:#fff;border:none;border-radius:var(--radius-sm);font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;transition:opacity .2s,transform .1s;margin-top:6px}
.login-card .btn:hover{opacity:.92}.login-card .btn:active{transform:scale(.98)}
.login-card .err{color:var(--alert);font-size:13px;margin-top:12px;display:none;background:#FEE2E2;padding:11px 16px;border-radius:var(--radius-sm);text-align:center;line-height:1.5}
.login-card .foot{margin-top:26px;text-align:center;font-size:12px;color:var(--ink-faint);line-height:1.6}
.login-card .foot b{color:var(--ink-soft)}

/* ── App shell ── */
.app{display:none;min-height:100vh}
.sidebar{position:fixed;left:0;top:0;bottom:0;width:var(--sidebar);background:linear-gradient(180deg,#0F172A 0%,#1E293B 100%);color:#fff;z-index:100;display:flex;flex-direction:column;transition:width .25s cubic-bezier(.4,0,.2,1);box-shadow:4px 0 24px rgba(15,23,42,.12)}
.sidebar.collapsed{width:var(--sidebar-collapsed)}
.sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:18px 16px;border-bottom:1px solid rgba(255,255,255,.08);min-height:72px;gap:10px}
.sidebar .brand{display:flex;align-items:center;gap:12px;overflow:hidden;white-space:nowrap}
.sidebar .brand-logo{height:34px;width:auto;flex-shrink:0}
.sidebar .brand-text{font-size:20px;font-weight:700;letter-spacing:-.3px;transition:opacity .15s}
.sidebar .brand-text span{color:var(--orange)}
.sidebar.collapsed .brand-text{display:none}
.toggle-btn{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,.08);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0}
.toggle-btn:hover{background:rgba(255,255,255,.16)}
.toggle-btn .ico-expand,.toggle-btn .ico-collapse{display:none}
.sidebar.collapsed .toggle-btn .ico-expand{display:block}
.sidebar:not(.collapsed) .toggle-btn .ico-collapse{display:block}
.sidebar nav{flex:1;padding:12px 10px;overflow-y:auto}
.sidebar nav a{display:flex;align-items:center;gap:14px;padding:12px 14px;margin-bottom:4px;color:rgba(255,255,255,.6);text-decoration:none;font-size:14px;font-weight:500;border-radius:10px;cursor:pointer;transition:all .2s;position:relative;white-space:nowrap}
.sidebar nav a:hover{background:rgba(255,255,255,.06);color:#fff}
.sidebar nav a.active{background:rgba(244,123,32,.14);color:var(--orange)}
.sidebar nav a .ico{width:20px;height:20px;flex-shrink:0;opacity:.85}
.sidebar nav a.active .ico{opacity:1}
.sidebar nav a .label{white-space:nowrap;opacity:1;transition:opacity .15s}
.sidebar.collapsed nav a .label{display:none}
.sidebar.collapsed nav a{padding:14px 0;justify-content:center}
.sidebar.collapsed nav a .ico{width:22px;height:22px}
.sidebar-footer{padding:16px;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;gap:10px}
.sidebar-footer .ver{font-size:11px;color:var(--ink-faint);transition:opacity .15s}
.sidebar.collapsed .sidebar-footer .ver{display:none}
.sidebar-footer .logout{background:rgba(255,255,255,.08);border:none;color:#fff;border-radius:10px;padding:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s;flex-shrink:0}
.sidebar-footer .logout:hover{background:rgba(239,68,68,.18);color:var(--alert)}
.sidebar.collapsed .sidebar-footer{justify-content:center}

.main{margin-left:var(--sidebar);padding:28px 36px;min-height:100vh;transition:margin-left .25s cubic-bezier(.4,0,.2,1)}
.sidebar.collapsed~.main{margin-left:var(--sidebar-collapsed)}
.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;gap:16px}
.topbar h2{font-size:24px;font-weight:700;letter-spacing:-.3px}
.topbar .breadcrumb{color:var(--ink-faint);font-size:13px;margin-top:2px}

/* ── Cards ── */
.card{background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:24px;margin-bottom:20px;box-shadow:var(--shadow)}
.card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:12px;flex-wrap:wrap}
.card-title{font-size:17px;font-weight:700;display:flex;align-items:center;gap:10px}
.card-title .ico{width:18px;height:18px;color:var(--orange)}

/* ── Stats ── */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px;margin-bottom:24px}
.stat-card{background:var(--surface);border:1px solid var(--hair);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow);display:flex;align-items:flex-start;gap:16px;transition:transform .2s,box-shadow .2s}
.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
.stat-icon{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.stat-icon svg{width:24px;height:24px}
.stat-card.orange .stat-icon{background:rgba(244,123,32,.12);color:var(--orange)}
.stat-card.green .stat-icon{background:rgba(16,185,129,.12);color:var(--good)}
.stat-card.blue .stat-icon{background:rgba(31,162,221,.12);color:var(--blue)}
.stat-card.amber .stat-icon{background:rgba(253,184,19,.12);color:#B45309}
.stat-card .info{flex:1}
.stat-card .label{font-size:12px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;font-weight:600}
.stat-card .value{font-size:32px;font-weight:700;letter-spacing:-.5px}

/* ── Banner ── */
.banner{padding:14px 18px;border-radius:var(--radius-sm);margin-bottom:20px;font-size:13px;font-weight:500;display:none;align-items:center;gap:10px}
.banner.warn{background:var(--yellow-soft);color:#92400E;display:flex}
.banner.info{background:var(--blue-soft);color:var(--blue-d);display:flex}
.banner svg{width:18px;height:18px;flex-shrink:0}

/* ── Forms ── */
.form-group{margin-bottom:18px}
.form-group label{display:block;font-weight:600;margin-bottom:8px;font-size:13px;color:var(--ink-soft)}
.form-group input,.form-group textarea,.form-group select{width:100%;padding:12px 16px;border:1.5px solid var(--hair);border-radius:var(--radius-sm);font-size:14px;outline:none;font-family:inherit;background:var(--surface);transition:border .2s,box-shadow .2s}
.form-group input:focus,.form-group textarea:focus,.form-group select:focus{border-color:var(--orange);box-shadow:0 0 0 3px var(--orange-soft)}
.form-group textarea{min-height:220px;resize:vertical;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:13px;line-height:1.6}
.checkbox-row{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.checkbox-row input{width:18px;height:18px;accent-color:var(--orange);cursor:pointer}
.checkbox-row label{margin:0;cursor:pointer;font-size:14px;color:var(--ink-soft)}

/* ── Buttons ── */
.btn-primary{padding:12px 24px;background:linear-gradient(90deg,var(--orange),var(--blue));color:#fff;border:none;border-radius:var(--radius-sm);font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;transition:opacity .2s,transform .1s;display:inline-flex;align-items:center;gap:8px}
.btn-primary:hover{opacity:.92}.btn-primary:active{transform:scale(.98)}.btn-primary:disabled{opacity:.45;cursor:not-allowed}
.btn-secondary{padding:10px 18px;background:var(--surface);border:1.5px solid var(--hair);border-radius:var(--radius-sm);color:var(--ink-soft);font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:8px}
.btn-secondary:hover{background:var(--muted);border-color:var(--ink-faint);color:var(--ink)}
.btn-orange{padding:8px 18px;background:var(--orange);color:#fff;border:none;border-radius:var(--radius-xs);font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .2s}
.btn-orange:hover{background:var(--orange-d)}.btn-orange:disabled{opacity:.45;cursor:not-allowed}
.btn-sm{padding:8px 16px;font-size:13px;border:1.5px solid var(--hair);background:var(--surface);border-radius:var(--radius-xs);cursor:pointer;font-family:inherit;font-weight:500;color:var(--ink-soft);transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.btn-sm:hover{background:var(--muted);border-color:var(--ink-faint);color:var(--ink)}

/* ── Tables ── */
.table-wrap{overflow-x:auto;border-radius:var(--radius-sm);border:1px solid var(--hair)}
table{width:100%;border-collapse:collapse}
th{text-align:left;padding:12px 14px;font-size:11px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid var(--hair);font-weight:600;background:var(--muted)}
td{padding:12px 14px;border-bottom:1px solid var(--hair);font-size:13px}tr:hover td{background:var(--muted)}
.empty-state{text-align:center;padding:40px 24px;color:var(--ink-soft)}
.empty-state svg{width:48px;height:48px;color:var(--ink-faint);margin-bottom:12px}

/* ── Badges ── */
.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:50px;font-size:11px;font-weight:600}
.badge::before{content:'';width:7px;height:7px;border-radius:50%}
.badge.green{background:rgba(16,185,129,.13);color:#166534}.badge.green::before{background:var(--good)}
.badge.amber{background:rgba(245,158,11,.13);color:#92400E}.badge.amber::before{background:var(--watch)}
.badge.gray{background:var(--muted);color:var(--ink-soft)}.badge.gray::before{background:var(--ink-faint)}
.badge.red{background:rgba(239,68,68,.13);color:#991B1B}.badge.red::before{background:var(--alert)}
.badge.blue{background:var(--blue-soft);color:var(--blue-d)}.badge.blue::before{background:var(--blue)}

/* ── Misc ── */
.tab-content{display:none}.tab-content.active{display:block}
.guide-mono{font-family:'SF Mono',Consolas,monospace;font-size:12px}
.guide-tag{color:var(--blue)}.guide-tag-opt{color:var(--ink-soft)}
.flow-list{padding-left:22px;color:var(--ink-soft);line-height:2}
.flow-list b{color:var(--ink)}
.loading{text-align:center;padding:48px;color:var(--ink-soft)}
.spinner{display:inline-block;width:28px;height:28px;border:3px solid var(--hair);border-top-color:var(--orange);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.results-table{max-height:420px;overflow-y:auto;border-radius:var(--radius-sm)}
.import-toolbar{display:flex;gap:12px;margin-bottom:18px;flex-wrap:wrap;align-items:center}
.import-toolbar .hint{color:var(--ink-faint);font-size:13px}
.search-row{display:flex;gap:12px;margin-bottom:18px;align-items:center;flex-wrap:wrap}
.search-row input{flex:1;min-width:220px;padding:12px 16px;border:1.5px solid var(--hair);border-radius:var(--radius-sm);font-size:14px;outline:none;font-family:inherit;transition:border .2s,box-shadow .2s}
.search-row input:focus{border-color:var(--orange);box-shadow:0 0 0 3px var(--orange-soft)}

@media(max-width:900px){.login-wrap{grid-template-columns:1fr}.login-brand{display:none}.login-form{padding:24px 20px;min-height:100vh}}
@media(max-width:768px){
  .sidebar{transform:translateX(-100%);width:var(--sidebar)}
  .sidebar.open{transform:translateX(0)}
  .sidebar.collapsed{width:var(--sidebar)}
  .main{margin-left:0;padding:18px}
  .sidebar.collapsed~.main{margin-left:0}
  .mobile-menu{display:flex!important}
}
</style>
</head>
<body>
<div class="login-wrap" id="loginScreen">
  <div class="login-brand">
    <div class="bg-img"></div>
    <div class="bg-grad"></div>
    <div class="brand-top"><img src="${logoUri}" alt="VitaHero" class="brand-logo"></div>
    <div class="spacer"></div>
    <div class="quote">
      <div class="q-mark">&ldquo;</div>
      <h1>Track Your Kid&rsquo;s Growth Heroically!</h1>
      <p>School camps, diet plans, doctor support &amp; rewards &mdash; all in one place. VitaHero puts your child&rsquo;s health in heroic hands.</p>
      <div class="author">VitaHero &mdash; Your child&rsquo;s health companion</div>
    </div>
  </div>
  <div class="login-form">
    <div class="login-card">
      <div class="head">
        <div class="label">Admin Portal</div>
        <h2>Welcome back</h2>
        <p class="sub">Import student data &amp; manage parent invitations</p>
      </div>
      <label class="field-label" for="adminKeyInput">Admin API Key</label>
      <input type="password" id="adminKeyInput" placeholder="Enter your admin key" onkeydown="if(event.key==='Enter')doLogin()">
      <button class="btn" onclick="doLogin()">Enter Admin Panel</button>
      <div class="err" id="loginErr">Invalid admin key. Please try again.</div>
      <div class="foot"><b>Authorized personnel only.</b><br>Your data is secure &amp; private. DPDP compliant.</div>
    </div>
  </div>
</div>
<div class="app" id="mainApp">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="brand">
        <img src="${logoUri}" alt="VitaHero" class="brand-logo">
        <span class="brand-text">Vita<span>Hero</span></span>
      </div>
      <button class="toggle-btn" id="sidebarToggle" onclick="toggleSidebar()" aria-label="Toggle sidebar">
        <span class="ico-collapse"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/></svg></span>
        <span class="ico-expand"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m8 9 3 3-3 3"/></svg></span>
      </button>
    </div>
    <nav>
      <a id="tab-overview" class="active" onclick="switchTab('overview')">
        <span class="ico"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg></span>
        <span class="label">Overview</span>
      </a>
      <a id="tab-import" onclick="switchTab('import')">
        <span class="ico"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg></span>
        <span class="label">Import Data</span>
      </a>
      <a id="tab-parents" onclick="switchTab('parents')">
        <span class="ico"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
        <span class="label">Parents</span>
      </a>
      <a id="tab-doctors" onclick="switchTab('doctors')">
        <span class="ico"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .2.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg></span>
        <span class="label">Doctors</span>
      </a>
      <a id="tab-history" onclick="switchTab('history')">
        <span class="ico"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5l5 0"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg></span>
        <span class="label">History</span>
      </a>
    </nav>
    <div class="sidebar-footer">
      <span class="ver">VitaHero Admin v1.0</span>
      <button class="logout" onclick="doLogout()" aria-label="Logout"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg></button>
    </div>
  </aside>
  <main class="main">
    <div class="topbar">
      <div>
        <h2 id="pageTitle">Overview</h2>
        <div class="breadcrumb">School health management dashboard</div>
      </div>
    </div>

    <div class="tab-content active" id="content-overview">
      <div class="banner warn" id="devModeBanner"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> DEV MODE is active: SMS is bypassed and OTP codes are returned in API responses. Disable DEV_MODE before production use.</div>
      <div class="stat-grid">
        <div class="stat-card orange">
          <div class="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <div class="info"><div class="label">Provisioned Parents</div><div class="value" id="stat-parents">--</div></div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></div>
          <div class="info"><div class="label">Active (Logged In)</div><div class="value" id="stat-active">--</div></div>
        </div>
        <div class="stat-card blue">
          <div class="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg></div>
          <div class="info"><div class="label">Imported Kids</div><div class="value" id="stat-kids">--</div></div>
        </div>
        <div class="stat-card amber">
          <div class="stat-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></div>
          <div class="info"><div class="label">Invites Sent</div><div class="value" id="stat-invites">--</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg> How the closed-app flow works</div></div>
        <ol class="flow-list">
          <li><b>Import data</b>: Upload student health records (CSV) with parent phone numbers in the Import Data tab.</li>
          <li><b>Send invitations</b>: SMS invitations are sent to provisioned parents with a link to download the app.</li>
          <li><b>Parent downloads app</b>: The SMS link opens a landing page with a Google Play Store button.</li>
          <li><b>Parent logs in</b>: Parent enters their registered phone number. Only provisioned numbers receive an OTP.</li>
          <li><b>OTP verification</b>: Parent enters the OTP sent via Plivo SMS and accesses their child health data.</li>
        </ol>
      </div>
    </div>

    <div class="tab-content" id="content-import">
      <div class="card">
        <div class="card-header"><div class="card-title"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg> CSV Format Guide</div></div>
        <p style="margin-bottom:10px;color:var(--ink-soft)">Paste CSV data with headers in the first row. Column names are case-insensitive.</p>
        <p style="margin-bottom:6px"><b>Required columns:</b></p>
        <p style="margin-bottom:10px" class="guide-mono guide-tag">phone, studentName</p>
        <p style="margin-bottom:6px"><b>Optional columns:</b></p>
        <p style="margin-bottom:10px" class="guide-mono guide-tag-opt">parentName, gender, grade, dob, age, schoolCode, schoolName, campCode, campDate, campTitle, heightCm, weightKg, dental, eyesight, nutrition, studentId</p>
        <p style="margin-bottom:6px"><b>Health flags:</b> dental, eyesight, nutrition accept GOOD, WATCH, or ALERT</p>
        <p style="margin-bottom:10px"><b>Phone format:</b> 10-digit number (e.g. 9876543210). Country code +91 is auto-added.</p>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg> Import Data</div>
          <button class="btn-secondary" onclick="downloadTemplate()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Download Template
          </button>
        </div>
        <div class="form-group">
          <label>Paste CSV data here</label>
          <textarea id="csvInput" placeholder="phone,studentName,parentName,gender,grade,age,schoolCode,schoolName,campDate,campTitle,heightCm,weightKg,dental,eyesight,nutrition,studentId
9876543210,Aarav Sharma,Rahul Sharma,M,Class 3,7,OAK2026,Oakridge International School,2026-07-15,Annual Health Camp,115,22,GOOD,GOOD,GOOD,STU001"></textarea>
        </div>
        <div class="checkbox-row"><input type="checkbox" id="dryRun" checked><label for="dryRun">Dry run (preview only, no data written, no SMS sent)</label></div>
        <div class="checkbox-row"><input type="checkbox" id="sendInvites"><label for="sendInvites">Send SMS invitations after import (uncheck for dry run or to import without inviting)</label></div>
        <button class="btn-primary" id="importBtn" onclick="doImport()">Import Data</button>
      </div>
      <div class="card" id="importResults" style="display:none">
        <h3 style="margin-bottom:14px;font-size:17px;font-weight:600">Import Results</h3>
        <div id="importSummary"></div>
        <div class="results-table" id="importTableWrap"></div>
      </div>
    </div>

    <div class="tab-content" id="content-parents">
      <div class="card">
        <div class="card-header"><div class="card-title"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Provisioned Parents</div></div>
        <div class="search-row">
          <input type="text" id="parentSearch" placeholder="Search by phone or name..." onkeydown="if(event.key==='Enter')loadParents()">
          <button class="btn-sm" onclick="loadParents()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg> Search</button>
          <button class="btn-sm" onclick="loadParents()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg> Refresh</button>
        </div>
        <div class="table-wrap"><div id="parentsTable"><div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><p>Click Search to load provisioned parents</p></div></div></div>
      </div>
    </div>

    <div class="tab-content" id="content-history">
      <div class="card">
        <div class="card-header"><div class="card-title"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5l5 0"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg> Import History</div></div>
        <div class="table-wrap"><div id="historyTable"><div class="loading"><div class="spinner"></div><p style="margin-top:14px">Loading history...</p></div></div></div>
      </div>
    </div>

    <div class="tab-content" id="content-doctors">
      <div class="card">
        <div class="card-header"><div class="card-title"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .2.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg> Generate Doctor Credential</div></div>
        <p style="margin-bottom:18px;color:var(--ink-soft);font-size:13px">Create a per-camp doctor login. The doctor will receive an OTP to sign in to the VitaHero app and fill health checkup forms for kids in this camp.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="form-group" style="margin-bottom:14px"><label>Doctor Name *</label><input type="text" id="docName" placeholder="Dr. Ananya Rao"></div>
          <div class="form-group" style="margin-bottom:14px"><label>Phone Number *</label><input type="text" id="docPhone" placeholder="9876543210"></div>
          <div class="form-group" style="margin-bottom:14px"><label>Specialty</label><input type="text" id="docSpecialty" placeholder="Paediatrics" value="General Paediatrics"></div>
          <div class="form-group" style="margin-bottom:14px"><label>Hospital / Clinic</label><input type="text" id="docHospital" placeholder="Rainbow Children's Hospital"></div>
        </div>
        <div class="form-group" style="margin-bottom:18px"><label>Assign to Camp *</label><select id="docCampSelect"><option value="">Loading camps...</option></select></div>
        <button class="btn-primary" id="genDocBtn" onclick="generateDoctor()">Generate Credential</button>
        <div id="genDocResult" style="margin-top:14px"></div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Active Doctor Credentials</div><button class="btn-sm" onclick="loadDoctors()"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg> Refresh</button></div>
        <div class="table-wrap"><div id="doctorsTable"><div class="empty-state"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .2.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg><p>Click Refresh to load doctor credentials</p></div></div></div>
      </div>
    </div>
  </main>
</div>
<script>
var adminKey=localStorage.getItem('vitahero_admin_key')||'';
function api(m,p,b){var o={method:m,headers:{'Content-Type':'application/json','X-Admin-Key':adminKey}};if(b)o.body=JSON.stringify(b);return fetch(p,o).then(function(r){if(!r.ok)return r.json().then(function(e){throw new Error(e.error||('HTTP '+r.status))});return r.json()})}
function doLogin(){var k=document.getElementById('adminKeyInput').value.trim();if(!k)return;adminKey=k;api('GET','/api/admin/stats').then(function(){localStorage.setItem('vitahero_admin_key',adminKey);document.getElementById('loginScreen').style.display='none';document.getElementById('mainApp').style.display='block';var sb=document.getElementById('sidebar');if(localStorage.getItem('vitahero_sidebar_collapsed')==='1')sb.classList.add('collapsed');loadOverview();checkDevMode()}).catch(function(){adminKey='';document.getElementById('loginErr').style.display='block'})}
function doLogout(){localStorage.removeItem('vitahero_admin_key');adminKey='';location.reload()}
if(adminKey){api('GET','/api/admin/stats').then(function(){document.getElementById('loginScreen').style.display='none';document.getElementById('mainApp').style.display='block';var sb=document.getElementById('sidebar');if(localStorage.getItem('vitahero_sidebar_collapsed')==='1')sb.classList.add('collapsed');loadOverview();checkDevMode()}).catch(function(){adminKey=''})}
function toggleSidebar(){var sb=document.getElementById('sidebar');sb.classList.toggle('collapsed');localStorage.setItem('vitahero_sidebar_collapsed',sb.classList.contains('collapsed')?'1':'0')}
function checkDevMode(){fetch('/ping').then(function(r){return r.json()}).then(function(d){if(d.dev_mode)document.getElementById('devModeBanner').style.display='flex'}).catch(function(){})}
function switchTab(t){var ts=['overview','import','parents','doctors','history'];for(var i=0;i<ts.length;i++){document.getElementById('tab-'+ts[i]).classList.toggle('active',ts[i]===t);document.getElementById('content-'+ts[i]).classList.toggle('active',ts[i]===t)}var titles={overview:'Overview',import:'Import Data',parents:'Parents',doctors:'Doctors',history:'Import History'};document.getElementById('pageTitle').textContent=titles[t];if(t==='overview')loadOverview();if(t==='parents')loadParents();if(t==='doctors')loadDoctorsTab();if(t==='history')loadHistory()}
function loadOverview(){api('GET','/api/admin/stats').then(function(d){document.getElementById('stat-parents').textContent=d.provisionedParents||0;document.getElementById('stat-active').textContent=d.activeParents||0;document.getElementById('stat-kids').textContent=d.importedKids||0;document.getElementById('stat-invites').textContent=d.invitesSent||0}).catch(function(){})}
function parseCSVLine(l){var r=[],c='',q=false;for(var i=0;i<l.length;i++){var ch=l[i];if(ch=='"')q=!q;else if(ch===','&&!q){r.push(c);c=''}else c+=ch}r.push(c);return r}
function parseCSV(t){var lines=t.trim().split(String.fromCharCode(10));if(lines.length<2)return[];var headers=parseCSVLine(lines[0]);var rows=[];for(var i=1;i<lines.length;i++){var line=lines[i].trim();if(!line)continue;var vals=parseCSVLine(line);var row={};for(var j=0;j<headers.length;j++)row[headers[j]]=(vals[j]||'').trim();rows.push(row)}return rows}
function downloadTemplate(){var header='phone,studentName,parentName,gender,grade,age,schoolCode,schoolName,campDate,campTitle,heightCm,weightKg,dental,eyesight,nutrition,studentId';var sample='9876543210,Aarav Sharma,Rahul Sharma,M,Class 3,7,OAK2026,Oakridge International School,2026-07-15,Annual Health Camp,115,22,GOOD,GOOD,GOOD,STU001';var csv=header+String.fromCharCode(10)+sample;var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download='vitahero_import_template.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url)}
function doImport(){var csv=document.getElementById('csvInput').value.trim();if(!csv){alert('Please paste CSV data first.');return}var rows=parseCSV(csv);if(rows.length===0){alert('No data rows found in CSV.');return}if(rows.length>2000){alert('Too many rows (max 2000). Split the file.');return}var dry=document.getElementById('dryRun').checked;var inv=document.getElementById('sendInvites').checked;if(!dry&&!confirm('Import '+rows.length+' rows'+(inv?' and send SMS invitations':'')+'?'))return;var btn=document.getElementById('importBtn');btn.disabled=true;btn.textContent=dry?'Processing (dry run)...':'Importing...';api('POST','/api/admin/import',{rows:rows,dryRun:dry,sendInvites:dry?false:inv,filename:'admin_panel_'+new Date().toISOString().slice(0,10)}).then(function(r){btn.disabled=false;btn.textContent='Import Data';showImportResults(r);if(!dry)loadOverview()}).catch(function(e){btn.disabled=false;btn.textContent='Import Data';alert('Import failed: '+e.message)})}
function showImportResults(r){var el=document.getElementById('importResults');el.style.display='block';var s='<div style="margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span class="badge '+(r.dryRun?'amber':'green')+'">'+(r.dryRun?'DRY RUN':'IMPORTED')+'</span> <b>'+r.total+'</b> rows: <span style="color:var(--good);font-weight:600">'+r.created+' created</span>, <span style="color:var(--blue);font-weight:600">'+r.updated+' updated</span>, <span style="color:var(--alert);font-weight:600">'+r.errors+' errors</span>';if(r.invited>0)s+=', <span style="color:var(--orange);font-weight:600">'+r.invited+' invited</span>';s+='</div>';document.getElementById('importSummary').innerHTML=s;var h='<table><thead><tr><th>Row</th><th>Phone</th><th>Student</th><th>Status</th><th>Message</th></tr></thead><tbody>';for(var i=0;i<r.results.length;i++){var row=r.results[i];var bg=row.status==='created'?'green':row.status==='updated'?'blue':row.status==='skipped'?'amber':'red';h+='<tr><td>'+row.row+'</td><td>'+(row.phone||'')+'</td><td>'+(row.student||'')+'</td><td><span class="badge '+bg+'">'+row.status+'</span></td><td>'+(row.message||'')+'</td></tr>'}h+='</tbody></table>';document.getElementById('importTableWrap').innerHTML=h}
function loadParents(){var s=document.getElementById('parentSearch').value.trim();var qs=s?('?q='+encodeURIComponent(s)):'';document.getElementById('parentsTable').innerHTML='<div class="loading"><div class="spinner"></div></div>';api('GET','/api/admin/parents'+qs).then(function(rows){if(!rows||rows.length===0){document.getElementById('parentsTable').innerHTML='<div class="empty-state"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"48\" height=\"48\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/></svg><p>No provisioned parents found.</p></div>';return}var h='<table><thead><tr><th>Phone</th><th>Parent Name</th><th>School</th><th>Kids</th><th>Invited</th><th>Status</th><th>Action</th></tr></thead><tbody>';for(var i=0;i<rows.length;i++){var p=rows[i];var inv=p.invited_at?'<span class=\"badge green\">Yes ('+(p.invite_count||0)+')</span>':'<span class=\"badge gray\">No</span>';var st=p.is_logged_in?'<span class=\"badge green\">Active</span>':'<span class=\"badge amber\">Pending</span>';var btn=p.invited_at?'Re-send':'Send Invite';h+='<tr><td>'+(p.phone||'')+'</td><td>'+(p.name||'Parent')+'</td><td>'+(p.school_name||'-')+'</td><td>'+(p.kid_count||0)+'</td><td>'+inv+'</td><td>'+st+'</td><td><button class=\"btn-orange\" onclick=\"sendInvite('+(p.phone||'')+')\">'+btn+'</button></td></tr>'}h+='</tbody></table>';document.getElementById('parentsTable').innerHTML=h}).catch(function(e){document.getElementById('parentsTable').innerHTML='<p style="color:var(--alert);padding:14px;font-weight:500">Error: '+e.message+'</p>'})}
function sendInvite(phone){if(!phone)return;if(!confirm('Send invitation SMS to '+phone+'?'))return;api('POST','/api/admin/invite',{phones:[phone],force:true}).then(function(d){alert('Invitation sent: '+d.invited+' successful, '+d.skipped.length+' skipped.');loadParents()}).catch(function(e){alert('Failed to send invite: '+e.message)})}
function loadHistory(){document.getElementById('historyTable').innerHTML='<div class="loading"><div class="spinner"></div></div>';api('GET','/api/admin/import-batches').then(function(rows){if(!rows||rows.length===0){document.getElementById('historyTable').innerHTML='<div class="empty-state"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"48\" height=\"48\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3v5l5 0\"/><path d=\"M3.05 13A9 9 0 1 0 6 5.3L3 8\"/><path d=\"M12 7v5l4 2\"/></svg><p>No import batches yet.</p></div>';return}var h='<table><thead><tr><th>Date</th><th>Filename</th><th>Total</th><th>Created</th><th>Updated</th><th>Errors</th><th>Invited</th><th>Type</th></tr></thead><tbody>';for(var i=0;i<rows.length;i++){var b=rows[i];var dt=b.created_at?new Date(b.created_at).toLocaleString():'-';var tp=b.dry_run?'<span class=\"badge amber\">Dry Run</span>':'<span class=\"badge green\">Live</span>';h+='<tr><td>'+dt+'</td><td>'+(b.filename||'-')+'</td><td>'+b.total+'</td><td>'+b.created+'</td><td>'+b.updated+'</td><td>'+b.errors+'</td><td>'+b.invited+'</td><td>'+tp+'</td></tr>'}h+='</tbody></table>';document.getElementById('historyTable').innerHTML=h}).catch(function(e){document.getElementById('historyTable').innerHTML='<p style="color:var(--alert);padding:14px;font-weight:500">Error: '+e.message+'</p>'})}
function loadDoctorsTab(){loadCampOptions();loadDoctors()}
function loadCampOptions(){api('GET','/api/admin/camps').then(function(camps){var sel=document.getElementById('docCampSelect');if(!camps||camps.length===0){sel.innerHTML='<option value=\"\">No camps available - import data first</option>';return}var h='<option value=\"\">Select a camp...</option>';for(var i=0;i<camps.length;i++){var c=camps[i];h+='<option value=\"'+c.id+'\">'+(c.title||'Camp')+' - '+(c.school_name||'')+' ('+(c.date||'')+')</option>'}sel.innerHTML=h}).catch(function(){document.getElementById('docCampSelect').innerHTML='<option value=\"\">Failed to load camps</option>'})}
function generateDoctor(){var name=document.getElementById('docName').value.trim();var phone=document.getElementById('docPhone').value.trim();var camp=document.getElementById('docCampSelect').value;var spec=document.getElementById('docSpecialty').value.trim();var hosp=document.getElementById('docHospital').value.trim();if(!name||!phone||!camp){document.getElementById('genDocResult').innerHTML='<div class=\"banner warn\" style=\"display:flex\">Please fill all required fields.</div>';return}var btn=document.getElementById('genDocBtn');btn.disabled=true;btn.textContent='Generating...';api('POST','/api/admin/doctors/generate',{doctor_name:name,phone:phone,school_camp_id:camp,specialty:spec,hospital:hosp}).then(function(r){btn.disabled=false;btn.textContent='Generate Credential';document.getElementById('genDocResult').innerHTML='<div class=\"banner info\" style=\"display:flex\"><span>&#10003;</span> '+r.message+'</div>';document.getElementById('docName').value='';document.getElementById('docPhone').value='';loadDoctors()}).catch(function(e){btn.disabled=false;btn.textContent='Generate Credential';document.getElementById('genDocResult').innerHTML='<div class=\"banner warn\" style=\"display:flex\">Error: '+e.message+'</div>'})}
function loadDoctors(){document.getElementById('doctorsTable').innerHTML='<div class="loading"><div class="spinner"></div></div>';api('GET','/api/admin/doctors').then(function(rows){if(!rows||rows.length===0){document.getElementById('doctorsTable').innerHTML='<div class="empty-state"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"48\" height=\"48\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .2.3\"/><path d=\"M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4\"/><circle cx=\"20\" cy=\"10\" r=\"2\"/></svg><p>No doctor credentials generated yet.</p></div>';return}var h='<table><thead><tr><th>Doctor</th><th>Phone</th><th>Camp</th><th>School</th><th>Camp Date</th><th>Status</th><th>Login</th><th>Action</th></tr></thead><tbody>';for(var i=0;i<rows.length;i++){var d=rows[i];var st=d.assignment_status==='ACTIVE'?'<span class=\"badge green\">Active</span>':'<span class=\"badge red\">Revoked</span>';var lg=d.is_logged_in?'<span class=\"badge blue\">Logged In</span>':'<span class=\"badge gray\">Offline</span>';var rv=d.assignment_status==='ACTIVE'?'<button class=\"btn-sm\" style=\"color:var(--alert);border-color:rgba(239,68,68,.3)\" onclick=\"revokeDoctor('+d.assignment_id+')\">Revoke</button>':'-';h+='<tr><td><b>'+(d.doctor_name||'')+'</b></td><td>'+(d.phone||'')+'</td><td>'+(d.camp_title||'-')+'</td><td>'+(d.school_name||'-')+'</td><td>'+(d.camp_date||'-')+'</td><td>'+st+'</td><td>'+lg+'</td><td>'+rv+'</td></tr>'}h+='</tbody></table>';document.getElementById('doctorsTable').innerHTML=h}).catch(function(e){document.getElementById('doctorsTable').innerHTML='<p style="color:var(--alert);padding:14px;font-weight:500">Error: '+e.message+'</p>'})}
function revokeDoctor(id){if(!confirm('Revoke this doctor credential? They will lose access to the camp.'))return;api('POST','/api/admin/doctors/revoke/'+id,{}).then(function(){loadDoctors()}).catch(function(e){alert('Failed: '+e.message)})}
</script>
</body>
</html>`;
}
