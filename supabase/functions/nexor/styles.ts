export const CSS_TEXT = `
:root{
  --shell:#0E1524; --shell-2:#16203A; --line-dark:#243252;
  --canvas:#F4F6FA; --card:#FFFFFF; --line:#E3E8F0;
  --ink:#16202F; --ink-2:#5B6880; --ink-3:#8A94A8;
  --brand:#4F46E5; --brand-2:#6366F1; --brand-soft:#EEF0FE;
  --teal:#0EA5A5; --amber:#D97706; --red:#DC2626; --green:#16A34A;
  --r:10px; --r-lg:16px;
  --sh:0 1px 2px rgba(16,24,40,.05), 0 4px 12px rgba(16,24,40,.05);
  --sh-2:0 8px 28px rgba(16,24,40,.12);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:'Inter',-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:var(--canvas);color:var(--ink);-webkit-font-smoothing:antialiased}
button,input,select{font-family:inherit}
.hide{display:none !important}

#login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(900px 500px at 12% 8%, rgba(79,70,229,.30), transparent 60%),radial-gradient(700px 460px at 88% 92%, rgba(14,165,165,.22), transparent 60%),var(--shell)}
.lg-card{width:100%;max-width:400px;background:#fff;border-radius:20px;padding:38px 34px;box-shadow:0 24px 70px rgba(5,10,25,.45)}
.lg-brand{text-align:center;margin-bottom:28px}
.lg-mark{width:54px;height:54px;border-radius:15px;margin:0 auto 14px;background:linear-gradient(140deg,var(--brand),var(--teal));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:21px;box-shadow:0 8px 20px rgba(79,70,229,.32)}
.lg-brand h1{font-size:25px;letter-spacing:5px;font-weight:700}
.lg-brand p{font-size:12.5px;color:var(--ink-3);margin-top:6px}
.fld{margin-bottom:15px}
.fld label{display:block;font-size:12.5px;font-weight:600;color:var(--ink-2);margin-bottom:6px}
.fld .wrap{position:relative}
.fld input{width:100%;height:46px;border:1px solid var(--line);border-radius:var(--r);padding:0 42px 0 14px;font-size:14px;color:var(--ink);background:#fff;outline:none;transition:border-color .15s, box-shadow .15s}
.fld input:focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.eye{position:absolute;right:6px;top:6px;width:34px;height:34px;border:none;background:none;cursor:pointer;color:var(--ink-3);display:flex;align-items:center;justify-content:center;border-radius:8px}
.eye:hover{background:var(--canvas);color:var(--ink)}
.lg-row{display:flex;align-items:center;justify-content:space-between;margin:4px 0 16px;font-size:12.5px}
.lg-row label{display:flex;align-items:center;gap:7px;color:var(--ink-2);cursor:pointer}
.lg-row a{color:var(--brand);text-decoration:none;font-weight:600}
.err{min-height:20px;font-size:12.5px;color:var(--red);text-align:center;margin-bottom:10px;font-weight:500}
.shake{animation:sk .38s}
@keyframes sk{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
.lg-foot{text-align:center;font-size:11.5px;color:var(--ink-3);margin-top:20px}

.btn{height:40px;padding:0 16px;border-radius:var(--r);border:1px solid transparent;font-size:13.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:.15s;white-space:nowrap}
.btn-primary{background:var(--brand);color:#fff}
.btn-primary:hover{background:var(--brand-2)}
.btn-primary:active{transform:scale(.985)}
.btn-ghost{background:#fff;border-color:var(--line);color:var(--ink)}
.btn-ghost:hover{border-color:var(--brand);color:var(--brand)}
.btn-sm{height:32px;padding:0 11px;font-size:12.5px}
.btn-full{width:100%}
.btn-icon{width:38px;height:38px;padding:0;border-radius:10px;background:none;border:none;cursor:pointer;color:#A7B2C8;display:flex;align-items:center;justify-content:center;position:relative;transition:.15s}
.btn-icon:hover{background:rgba(255,255,255,.08);color:#fff}

#app{display:grid;grid-template-columns:250px 1fr;min-height:100vh}
.side{background:var(--shell);color:#C3CCDE;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden}
.side-top{display:flex;align-items:center;gap:11px;padding:18px 16px;border-bottom:1px solid var(--line-dark);min-height:66px}
.side-mark{width:34px;height:34px;border-radius:10px;flex:none;background:linear-gradient(140deg,var(--brand),var(--teal));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px}
.side-name{font-weight:700;letter-spacing:3px;font-size:15px;color:#fff}
.side-name small{display:block;letter-spacing:0;font-size:9.5px;color:#7B88A3;font-weight:500;margin-top:2px}
.nav{flex:1;overflow-y:auto;padding:12px 10px}
.nav::-webkit-scrollbar{width:6px}
.nav::-webkit-scrollbar-thumb{background:#243252;border-radius:8px}
.nav-item{display:flex;align-items:center;gap:12px;width:100%;padding:10px 11px;border:none;background:none;color:#AFBACE;font-size:13.5px;font-weight:500;border-radius:9px;cursor:pointer;text-align:left;margin-bottom:2px;transition:.14s}
.nav-item:hover{background:var(--shell-2);color:#fff}
.nav-item.on{background:var(--brand);color:#fff;font-weight:600;box-shadow:0 4px 14px rgba(79,70,229,.35)}
.nav-ico{width:19px;height:19px;flex:none;display:flex;align-items:center;justify-content:center}
.nav-txt{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-caret{width:14px;height:14px;flex:none;transition:transform .18s;opacity:.7}
.nav-item.open .nav-caret{transform:rotate(90deg)}
.sub{overflow:hidden;max-height:0;transition:max-height .25s ease}
.sub.open{max-height:900px}
.sub-item{display:block;width:100%;text-align:left;border:none;background:none;cursor:pointer;color:#8D9AB4;font-size:12.8px;padding:8px 12px 8px 43px;border-radius:8px;transition:.14s}
.sub-item:hover{background:var(--shell-2);color:#fff}
.sub-item.on{color:#fff;background:var(--shell-2);font-weight:600;box-shadow:inset 2px 0 0 var(--teal)}
.sub-group{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#5D6B87;padding:10px 12px 4px 43px;font-weight:700}
.side-foot{border-top:1px solid var(--line-dark);padding:12px 14px;display:flex;align-items:center;gap:10px}
.side-foot-meta{flex:1;min-width:0}

.main{display:flex;flex-direction:column;min-width:0}
.top{height:66px;background:var(--shell);border-bottom:1px solid var(--line-dark);display:flex;align-items:center;gap:14px;padding:0 20px;position:sticky;top:0;z-index:20}
.burger{display:none}
.search{position:relative;flex:1;max-width:420px}
.search input{width:100%;height:38px;border-radius:9px;border:1px solid var(--line-dark);background:var(--shell-2);color:#E7ECF5;padding:0 12px 0 36px;font-size:13.5px;outline:none}
.search input::placeholder{color:#6F7C97}
.search input:focus{border-color:var(--brand);background:#1B274A}
.search .s-ico{position:absolute;left:11px;top:10px;color:#6F7C97}
.s-res{position:absolute;top:44px;left:0;right:0;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--sh-2);max-height:320px;overflow-y:auto;z-index:40;padding:6px}
.s-res button{display:block;width:100%;text-align:left;border:none;background:none;cursor:pointer;padding:9px 11px;border-radius:8px;font-size:13px;color:var(--ink)}
.s-res button:hover{background:var(--brand-soft);color:var(--brand)}
.s-res button small{display:block;color:var(--ink-3);font-size:11px;margin-top:2px}
.s-empty{padding:14px;text-align:center;color:var(--ink-3);font-size:12.5px}
.unit{display:flex;align-items:center;gap:9px;height:38px;padding:0 12px;border-radius:9px;background:var(--shell-2);border:1px solid var(--line-dark);color:#E7ECF5;cursor:pointer;font-size:13px;font-weight:600;position:relative}
.unit:hover{border-color:var(--brand)}
.unit .u-lab{font-size:9.5px;color:#7B88A3;font-weight:600;letter-spacing:.6px;text-transform:uppercase;display:block;line-height:1}
.unit .u-val{display:block;line-height:1.35;margin-top:2px}
.u-menu{position:absolute;top:46px;right:0;width:250px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--sh-2);padding:6px;z-index:40}
.u-menu button{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;text-align:left;border:none;background:none;cursor:pointer;padding:10px 11px;border-radius:8px;font-size:13px;color:var(--ink)}
.u-menu button:hover{background:var(--canvas)}
.u-menu button.on{background:var(--brand-soft);color:var(--brand);font-weight:600}
.u-menu small{display:block;color:var(--ink-3);font-size:11px;font-weight:400}
.top-sp{flex:1}
.dot{position:absolute;top:8px;right:9px;width:7px;height:7px;border-radius:50%;background:var(--red);border:2px solid var(--shell)}
.who{display:flex;align-items:center;gap:10px;padding-left:12px;border-left:1px solid var(--line-dark);margin-left:2px}
.who-meta{line-height:1.3}
.who-meta b{display:block;font-size:13px;color:#fff;font-weight:600}
.who-meta span{font-size:11px;color:#7B88A3}
.ava{width:36px;height:36px;border-radius:50%;flex:none;background:linear-gradient(140deg,var(--brand),var(--teal));color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center}

.content{padding:26px 30px 60px;flex:1;overflow-x:hidden}
.crumb{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--ink-3);margin-bottom:14px;flex-wrap:wrap}
.crumb button{border:none;background:none;color:var(--ink-3);cursor:pointer;font-size:12.5px;padding:0}
.crumb button:hover{color:var(--brand);text-decoration:underline}
.crumb b{color:var(--ink-2);font-weight:600}
.head{display:flex;align-items:flex-start;gap:14px;margin-bottom:24px;flex-wrap:wrap}
.head-ico{width:46px;height:46px;border-radius:13px;flex:none;background:var(--brand-soft);color:var(--brand);display:flex;align-items:center;justify-content:center}
.head h1{font-size:22px;font-weight:700;letter-spacing:-.3px}
.head p{font-size:13.5px;color:var(--ink-2);margin-top:3px}
.head-act{margin-left:auto;display:flex;gap:9px;flex-wrap:wrap}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(252px,1fr));gap:16px}
.mod{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:20px;cursor:pointer;text-align:left;transition:.18s;position:relative;overflow:hidden}
.mod:before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--brand);transform:scaleY(0);transform-origin:top;transition:transform .2s}
.mod:hover{transform:translateY(-3px);box-shadow:var(--sh-2);border-color:#CFD8E8}
.mod:hover:before{transform:scaleY(1)}
.mod-ico{width:44px;height:44px;border-radius:12px;background:var(--brand-soft);color:var(--brand);display:flex;align-items:center;justify-content:center;margin-bottom:14px;transition:.18s}
.mod:hover .mod-ico{background:var(--brand);color:#fff}
.mod h3{font-size:15px;font-weight:700;margin-bottom:5px}
.mod p{font-size:12.8px;color:var(--ink-2);line-height:1.5;min-height:38px}
.mod-go{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--brand);margin-top:12px;opacity:0;transform:translateX(-6px);transition:.18s}
.mod:hover .mod-go{opacity:1;transform:translateX(0)}
.mod-tag{position:absolute;top:16px;right:16px;font-size:10px;font-weight:700;color:var(--ink-3);background:var(--canvas);padding:3px 8px;border-radius:20px}

.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--sh);margin-bottom:18px}
.card-h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.card-h h3{font-size:14.5px;font-weight:700}
.card-h p{font-size:12.5px;color:var(--ink-3);margin-top:2px}
.card-b{padding:20px}
.card-b.flush{padding:0}

.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:22px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:var(--r-lg);padding:17px;box-shadow:var(--sh)}
.kpi .k-l{font-size:11.5px;font-weight:600;color:var(--ink-3);text-transform:uppercase;letter-spacing:.5px}
.kpi .k-v{font-size:25px;font-weight:700;margin-top:7px;letter-spacing:-.5px}
.kpi .k-s{font-size:12px;color:var(--ink-3);margin-top:3px}

.filters{display:flex;gap:10px;flex-wrap:wrap;padding:16px 20px;border-bottom:1px solid var(--line);background:#FBFCFE}
.filters input,.filters select{height:38px;border:1px solid var(--line);border-radius:9px;padding:0 11px;font-size:13px;background:#fff;color:var(--ink);outline:none;min-width:0}
.filters input{flex:1;min-width:170px}
.filters input:focus,.filters select:focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}

.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:13.2px;min-width:720px}
th{text-align:left;padding:11px 16px;font-size:10.5px;font-weight:700;color:var(--ink-3);text-transform:uppercase;letter-spacing:.6px;background:#FBFCFE;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:13px 16px;border-bottom:1px solid var(--line);color:var(--ink-2)}
td b{color:var(--ink);font-weight:600}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover{background:#FBFCFE}
.acts{display:flex;gap:5px;justify-content:flex-end}
.act{width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:#fff;cursor:pointer;color:var(--ink-3);display:inline-flex;align-items:center;justify-content:center;transition:.15s}
.act:hover{border-color:var(--brand);color:var(--brand);background:var(--brand-soft)}
.act.danger:hover{border-color:var(--red);color:var(--red);background:#FEF2F2}

.pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:20px}
.pill:before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor}
.p-on{background:#ECFDF3;color:var(--green)}
.p-off{background:#F2F4F7;color:var(--ink-3)}
.p-wait{background:#FFFAEB;color:var(--amber)}
.p-dev{background:var(--brand-soft);color:var(--brand)}
.p-block{background:#FEF2F2;color:var(--red)}

.pag{display:flex;align-items:center;justify-content:space-between;padding:13px 20px;font-size:12.5px;color:var(--ink-3);flex-wrap:wrap;gap:10px}
.pag-n{display:flex;gap:5px}

.empty{text-align:center;padding:56px 24px}
.empty-ico{width:70px;height:70px;border-radius:20px;background:var(--brand-soft);color:var(--brand);display:flex;align-items:center;justify-content:center;margin:0 auto 18px}
.empty h3{font-size:16.5px;font-weight:700;margin-bottom:7px}
.empty p{font-size:13.5px;color:var(--ink-2);max-width:430px;margin:0 auto 18px;line-height:1.6}

.chart-ph{height:210px;border:1.5px dashed var(--line);border-radius:12px;background:#FBFCFE;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--ink-3);font-size:12.5px}

.perm-row{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.perm-row:last-child{border-bottom:none}
.perm-i{flex:1;min-width:190px}
.perm-i b{font-size:13.5px;display:block}
.perm-i span{font-size:12px;color:var(--ink-3)}
.perm-t{display:flex;gap:16px;flex-wrap:wrap}
.tg{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink-2);cursor:pointer}
.sw{width:34px;height:19px;border-radius:20px;background:#D7DEEA;position:relative;transition:.18s;flex:none}
.sw:after{content:'';position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;transition:.18s;box-shadow:0 1px 3px rgba(0,0,0,.2)}
input:checked+.sw{background:var(--brand)}
input:checked+.sw:after{transform:translateX(15px)}
.tg input{display:none}

.ov{position:fixed;inset:0;background:rgba(13,20,35,.55);display:flex;align-items:center;justify-content:center;z-index:60;padding:20px}
.mo{background:#fff;border-radius:var(--r-lg);width:100%;max-width:620px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 26px 70px rgba(0,0,0,.32);animation:pop .18s}
@keyframes pop{from{opacity:0;transform:translateY(10px) scale(.985)}}
.mo.sm{max-width:420px}
.mo-h{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--line)}
.mo-h h3{font-size:16px;font-weight:700}
.mo-h p{font-size:12.5px;color:var(--ink-3);margin-top:2px}
.x{width:32px;height:32px;border:none;background:none;cursor:pointer;color:var(--ink-3);border-radius:8px;font-size:20px;line-height:1}
.x:hover{background:var(--canvas);color:var(--red)}
.mo-b{padding:22px;overflow-y:auto}
.mo-f{display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid var(--line);background:#FBFCFE;border-radius:0 0 var(--r-lg) var(--r-lg)}
.fg{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.fg .full{grid-column:1/-1}
.fi label{display:block;font-size:12px;font-weight:600;color:var(--ink-2);margin-bottom:5px}
.fi input,.fi select{width:100%;height:40px;border:1px solid var(--line);border-radius:9px;padding:0 11px;font-size:13.5px;color:var(--ink);background:#fff;outline:none}
.fi input:focus,.fi select:focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.sec-t{font-size:11px;font-weight:700;color:var(--ink-3);text-transform:uppercase;letter-spacing:.7px;margin:22px 0 12px;padding-bottom:7px;border-bottom:1px solid var(--line)}
.sec-t:first-child{margin-top:0}

.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--shell);color:#fff;padding:13px 22px;border-radius:11px;font-size:13.5px;font-weight:500;box-shadow:var(--sh-2);z-index:90;animation:up .22s;display:flex;align-items:center;gap:9px}
@keyframes up{from{opacity:0;transform:translate(-50%,12px)}}

.scrim{display:none}
@media(max-width:1000px){
  #app{grid-template-columns:1fr}
  .side{position:fixed;left:0;top:0;bottom:0;width:262px;z-index:70;transform:translateX(-100%);transition:transform .22s}
  #app.open .side{transform:translateX(0)}
  .scrim{display:block;position:fixed;inset:0;background:rgba(10,16,28,.5);z-index:65;opacity:0;pointer-events:none;transition:opacity .2s}
  #app.open .scrim{opacity:1;pointer-events:auto}
  .burger{display:flex}
  .who-meta,.unit .u-lab{display:none}
  .content{padding:20px 16px 60px}
  .search{max-width:none}
}
@media(max-width:640px){
  .grid{grid-template-columns:1fr}
  .fg{grid-template-columns:1fr}
  .head h1{font-size:19px}
  .kpi .k-v{font-size:21px}
  .search{display:none}
}
`;
