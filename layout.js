// Styles are now in public/css/styles.css (served as static files).
// This variable is kept for backward compatibility but is empty.
const BASE_STYLES = `
  :root{
    --bg:#08080a; --bg2:#121214; --card:#141416; --line:#28282c;
    --white:#f5f5f5; --gray:#9a9a a3; --gray:#9c9ca3; --gold:#d4af37; --gold-soft:#e9cd7a; --gold-dim:#8a7429;
  }
  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{
    margin:0; background:var(--bg); color:var(--white); overflow-x:hidden;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  a{color:inherit; text-decoration:none;}
  .nav{
    display:flex; justify-content:space-between; align-items:center;
    padding:18px 24px; border-bottom:1px solid var(--line);
    position:sticky; top:0; background:rgba(8,8,10,.75); backdrop-filter:blur(10px); z-index:50;
  }
  .brand{font-weight:800; letter-spacing:.5px; font-size:18px;}
  .brand span{color:var(--gold);}
  .nav-links{display:flex; gap:26px; align-items:center;}
  .nav-links a.link{color:var(--gray); font-size:14px; font-weight:500; transition:color .2s;}
  .nav-links a.link:hover{color:var(--white);}
  @media(max-width:700px){.nav-links .link{display:none;}}
  .nav a.btn{border:1px solid var(--line); padding:9px 18px; border-radius:8px; font-size:14px; transition:.2s;}
  .nav a.btn:hover{border-color:var(--gold); color:var(--gold);}

  .container{max-width:1140px; margin:0 auto; padding:0 24px;}

  /* HERO */
  .hero{
    position:relative; text-align:center; padding:110px 24px 40px; overflow:hidden;
  }
  .hero::before{
    content:''; position:absolute; top:-200px; left:50%; transform:translateX(-50%);
    width:900px; height:900px; border-radius:50%;
    background:radial-gradient(circle, rgba(212,175,55,.10) 0%, rgba(212,175,55,0) 65%);
    pointer-events:none;
  }
  .eyebrow{
    display:inline-flex; align-items:center; gap:8px; color:var(--gold); font-weight:600;
    letter-spacing:1.5px; font-size:12px; text-transform:uppercase; margin-bottom:22px;
    border:1px solid rgba(212,175,55,.3); padding:6px 14px; border-radius:20px; background:rgba(212,175,55,.05);
  }
  .hero h1{
    font-size:clamp(36px,6.4vw,68px); font-weight:900; letter-spacing:-1px; margin:0 0 18px; line-height:1.08;
    background:linear-gradient(180deg,#fff 30%,#b9b9b9); -webkit-background-clip:text; background-clip:text; color:transparent;
    position:relative; z-index:1;
  }
  .hero p.lead{color:var(--gray); font-size:19px; margin:6px auto; line-height:1.55; max-width:520px; position:relative; z-index:1;}
  .btn-row{display:flex; gap:14px; justify-content:center; margin-top:36px; flex-wrap:wrap; position:relative; z-index:1;}
  .btn-primary{
    background:linear-gradient(180deg,var(--gold-soft),var(--gold)); color:#0a0a0a; padding:15px 32px; border-radius:10px; font-weight:800;
    box-shadow:0 0 0 1px rgba(212,175,55,.4), 0 10px 40px rgba(212,175,55,.25); transition:transform .2s, box-shadow .2s; display:inline-block;
  }
  .btn-primary:hover{transform:translateY(-2px); box-shadow:0 0 0 1px rgba(212,175,55,.6), 0 14px 50px rgba(212,175,55,.35);}
  .btn-secondary{
    border:1px solid var(--line); color:var(--white); padding:15px 32px; border-radius:10px; font-weight:600; transition:.2s; display:inline-block;
  }
  .btn-secondary:hover{border-color:var(--gold); color:var(--gold); transform:translateY(-2px);}

  /* PRODUCT STAND CARD (3D floating) */
  .stand-wrap{
    perspective:1400px; margin:80px auto 0; max-width:360px; position:relative; z-index:1;
  }
  .stand{
    position:relative; background:linear-gradient(155deg,#1c1c1f,#0c0c0e 60%);
    border-radius:26px 26px 10px 10px; padding:40px 28px 30px; text-align:center;
    box-shadow:0 40px 90px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.04);
    transform:rotateX(6deg) rotateY(-8deg);
    animation:floaty 6s ease-in-out infinite;
    border:1px solid #232326;
    overflow:hidden;
  }
  .stand::before{
    content:''; position:absolute; inset:0; opacity:.5; pointer-events:none;
    background-image:repeating-radial-gradient(circle at 50% 38%, transparent 0, transparent 10px, rgba(255,255,255,.025) 11px, transparent 12px);
  }
  .stand-base{
    width:120px; height:16px; background:linear-gradient(180deg,#0c0c0e,#020202);
    margin:0 auto; border-radius:0 0 10px 10px; box-shadow:0 20px 30px rgba(0,0,0,.5);
    transform:rotateX(55deg); transform-origin:top;
  }
  @keyframes floaty{
    0%,100%{transform:rotateX(6deg) rotateY(-8deg) translateY(0px);}
    50%{transform:rotateX(4deg) rotateY(-6deg) translateY(-10px);}
  }
  .g-logo{width:66px; height:66px; margin:0 auto 14px; position:relative; z-index:1;}
  .tap-icons{color:#cfcfcf; font-size:12px; letter-spacing:1.5px; margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:8px; position:relative; z-index:1;}
  .tap-icons .dot{width:4px; height:4px; border-radius:50%; background:#555;}
  .review-line{font-weight:700; font-size:17px; color:#fff; margin-bottom:26px; position:relative; z-index:1;}
  .stand-bottom{display:flex; justify-content:space-between; align-items:center; margin-top:22px; position:relative; z-index:1;}
  .stand-qr{background:#fff; padding:8px; border-radius:8px; width:64px; height:64px;}
  .stand-qr img{width:100%; height:100%; display:block;}
  .stand-brand{color:#8a8a8f; font-size:10px; letter-spacing:.5px; text-align:right;}
  .stand-brand b{color:#c9c9cc; display:block; font-size:12px;}

  /* CARD (digital /card/ page) */
  .card-preview{
    max-width:340px; margin:60px auto 0; background:var(--card); border:1px solid var(--line);
    border-radius:24px; padding:34px 26px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,.5);
    transition:transform .3s; animation:floaty 7s ease-in-out infinite;
  }
  .logo-circle{
    width:64px; height:64px; border-radius:50%; background:var(--bg2); border:1px solid var(--line);
    display:flex; align-items:center; justify-content:center; font-size:30px; margin:0 auto 14px;
  }
  .biz-name{font-size:20px; font-weight:800; letter-spacing:.5px; margin-bottom:22px;}
  .love-line{color:var(--gold); font-weight:700; letter-spacing:1px; font-size:14px; margin-bottom:6px;}
  .tap-line{color:var(--gray); font-size:13px; letter-spacing:.5px; margin-bottom:22px;}
  .tap-btn{
    display:block; width:100%; background:linear-gradient(180deg,var(--gold-soft),var(--gold)); color:#0a0a0a; font-weight:800; padding:16px;
    border-radius:12px; border:none; font-size:15px; letter-spacing:.5px; cursor:pointer; margin-bottom:16px; transition:transform .15s;
  }
  .tap-btn:active{transform:scale(.97);}
  .or-line{color:var(--line); font-size:12px; letter-spacing:2px; margin:14px 0;}
  .qr-box{
    background:#fff; padding:14px; border-radius:14px; display:inline-block; margin-bottom:16px;
  }
  .qr-box img{display:block; width:170px; height:170px;}
  .stars{color:var(--gold); font-size:20px; letter-spacing:3px; margin-bottom:6px;}
  .google-line{color:var(--gray); font-size:12px; letter-spacing:1px; margin-bottom:20px;}
  .thanks{color:var(--gray); font-size:13px; margin-top:10px;}
  .powered{color:#555; font-size:11px; margin-top:20px; letter-spacing:.5px;}

  /* SECTIONS */
  .reveal{opacity:0; transform:translateY(24px); transition:opacity .7s ease, transform .7s ease;}
  .reveal.in{opacity:1; transform:translateY(0);}
  .section-head{text-align:center; max-width:600px; margin:0 auto 50px;}
  .section-tag{color:var(--gold); font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:12px;}
  .section-head h2{font-size:clamp(26px,4vw,38px); font-weight:800; margin:0 0 12px; letter-spacing:-.5px;}
  .section-head p{color:var(--gray); font-size:15px; margin:0; line-height:1.6;}

  .steps{display:grid; grid-template-columns:repeat(3,1fr); gap:24px; padding:100px 24px; max-width:1000px; margin:0 auto;}
  @media(max-width:700px){.steps{grid-template-columns:1fr;}}
  .step{
    background:var(--card); border:1px solid var(--line); border-radius:16px; padding:30px; text-align:center;
    transition:transform .25s, border-color .25s;
  }
  .step:hover{transform:translateY(-6px); border-color:rgba(212,175,55,.4);}
  .step .num{color:var(--gold); font-weight:900; font-size:28px; margin-bottom:10px;}
  .step h3{margin:0 0 8px; font-size:16px;}
  .step p{color:var(--gray); font-size:14px; margin:0; line-height:1.5;}

  .showcase{padding:40px 24px 110px; background:linear-gradient(180deg,transparent,rgba(212,175,55,.03),transparent);}
  .showcase-grid{display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:center; max-width:1000px; margin:0 auto;}
  @media(max-width:800px){.showcase-grid{grid-template-columns:1fr; gap:40px;}}
  .showcase-copy h3{font-size:26px; font-weight:800; margin:0 0 14px;}
  .showcase-copy p{color:var(--gray); font-size:15px; line-height:1.7; margin-bottom:14px;}
  .check-list{list-style:none; padding:0; margin:22px 0 0;}
  .check-list li{color:#d8d8d8; font-size:14px; padding:8px 0; display:flex; gap:10px; align-items:flex-start;}
  .check-list li::before{content:'✓'; color:var(--gold); font-weight:900;}

  .benefits{padding:20px 24px 110px;}
  .benefit-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:20px; max-width:1100px; margin:0 auto;}
  @media(max-width:900px){.benefit-grid{grid-template-columns:repeat(2,1fr);}}
  @media(max-width:520px){.benefit-grid{grid-template-columns:1fr;}}
  .benefit{background:var(--card); border:1px solid var(--line); border-radius:14px; padding:26px 22px; transition:.25s;}
  .benefit:hover{border-color:rgba(212,175,55,.4); transform:translateY(-4px);}
  .benefit .icon{font-size:22px; margin-bottom:12px;}
  .benefit h4{margin:0 0 6px; font-size:15px;}
  .benefit p{color:var(--gray); font-size:13px; margin:0; line-height:1.5;}

  .cta-final{
    max-width:900px; margin:0 auto 110px; text-align:center; padding:70px 30px; border-radius:28px;
    background:radial-gradient(circle at 50% 0%, rgba(212,175,55,.12), transparent 60%), var(--card);
    border:1px solid var(--line);
  }
  .cta-final h2{font-size:clamp(26px,4vw,40px); font-weight:900; margin:0 0 14px;}
  .cta-final p{color:var(--gray); margin:0 0 30px; font-size:15px;}

  footer{border-top:1px solid var(--line); padding:34px 24px; text-align:center; color:#555; font-size:12px;}
  footer .foot-brand{color:#888; font-weight:700; margin-bottom:6px; letter-spacing:.5px;}
  table{width:100%; border-collapse:collapse; margin-top:20px;}
  th,td{text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); font-size:14px;}
  th{color:var(--gray); font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:.5px;}
  .badge{padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; letter-spacing:.5px;}
  .badge.active{background:rgba(212,175,55,.15); color:var(--gold);}
  .badge.inactive{background:rgba(255,255,255,.08); color:#888;}
  .panel{background:var(--card); border:1px solid var(--line); border-radius:16px; padding:24px; margin-bottom:24px;}
  .panel h2{margin-top:0; font-size:16px; letter-spacing:.5px;}
  input,select{
    width:100%; background:var(--bg2); border:1px solid var(--line); color:var(--white);
    padding:10px 12px; border-radius:8px; font-size:14px; margin-bottom:12px;
  }
  label{font-size:12px; color:var(--gray); display:block; margin-bottom:4px; letter-spacing:.5px;}
  .btn-small{background:var(--gold); color:#000; border:none; padding:9px 16px; border-radius:8px; font-weight:700; font-size:13px; cursor:pointer;}
  .btn-danger{background:transparent; border:1px solid #663; color:#e88; padding:9px 16px; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer;}
  .flex-between{display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;}
  code{background:var(--bg2); padding:2px 6px; border-radius:4px; font-size:12px; color:var(--gold);}
  /* PHYSICAL CARD PAGE (matches physical PVC stand reference) */
  /* UNIVERSAL PHYSICAL CARD (destination-neutral, matches final PVC card design) */
  .uc-wrap{perspective:1600px; max-width:460px; margin:0 auto;}
  .uc-card{
    position:relative; aspect-ratio:1.42/1; background:linear-gradient(160deg,#1b1b1e,#0a0a0c 65%);
    border-radius:22px; padding:26px 28px; overflow:hidden;
    box-shadow:0 40px 90px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05);
    border:1px solid #232326;
    display:flex; flex-direction:column; justify-content:space-between;
    transform:rotateX(4deg) rotateY(-4deg);
    animation:floaty 7s ease-in-out infinite;
  }
  .uc-card::before{ content:none; }
  .uc-rings{
    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
    width:78%; aspect-ratio:1/1; border-radius:50%; overflow:hidden; z-index:0; pointer-events:none;
    background-image:repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 11px, rgba(255,255,255,.05) 12px, transparent 13px);
    -webkit-mask-image:radial-gradient(circle, #000 60%, transparent 100%);
    mask-image:radial-gradient(circle, #000 60%, transparent 100%);
  }
  .uc-center{position:relative; z-index:1; text-align:center; margin-top:10px;}
  .uc-tap{
    font-size:clamp(30px,7vw,48px); font-weight:900; letter-spacing:6px; color:#d8d8dc;
    background:linear-gradient(180deg,#f2f2f4,#9a9aa0); -webkit-background-clip:text; background-clip:text; color:transparent;
    margin-bottom:8px; text-shadow:0 1px 0 rgba(255,255,255,.1);
  }
  .uc-tap-row{display:flex; align-items:center; justify-content:center; gap:8px; color:#c9c9cc; font-size:11px; font-weight:600; letter-spacing:1.5px;}
  .uc-tap-row .ic{font-size:14px;}
  .uc-subtext{color:#b7b7bc; font-size:12px; margin-top:4px; letter-spacing:.5px;}
  .uc-bottom-row{position:relative; z-index:1; display:flex; align-items:flex-end; justify-content:space-between;}
  .uc-qr-box{background:#fff; padding:8px; border-radius:8px; box-shadow:0 8px 20px rgba(0,0,0,.35);}
  .uc-qr-box img{display:block; width:64px; height:64px;}
  .uc-brand{text-align:right; color:#84848a; font-size:9px; letter-spacing:1px;}
  .uc-brand b{color:#d8d8db; display:block; font-size:12px; letter-spacing:.5px;}
  .uc-status-pill{
    position:absolute; top:14px; right:16px; z-index:2; font-size:9px; font-weight:800; letter-spacing:1px;
    padding:4px 10px; border-radius:20px; text-transform:uppercase;
  }
  .uc-status-pill.active{background:rgba(212,175,55,.15); color:var(--gold); border:1px solid rgba(212,175,55,.35);}
  .uc-status-pill.inactive{background:rgba(255,255,255,.06); color:#999; border:1px solid var(--line);}
  .uc-card-id{position:absolute; top:14px; left:18px; z-index:2; color:#5c5c62; font-size:10px; letter-spacing:1px;}

  .phys-wrap{perspective:1600px; max-width:380px; margin:0 auto;}
  .phys-card{
    position:relative; background:linear-gradient(160deg,#1d1d20,#0a0a0c 65%);
    border-radius:28px 28px 12px 12px; padding:38px 30px 32px; text-align:center;
    box-shadow:0 45px 100px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05), inset 0 0 40px rgba(212,175,55,.03);
    border:1px solid #232326; overflow:hidden;
    transform:rotateX(5deg) rotateY(-6deg);
    animation:floaty 7s ease-in-out infinite;
  }
  .phys-card::before{
    content:''; position:absolute; inset:0; opacity:.55; pointer-events:none;
    background-image:repeating-radial-gradient(circle at 50% 32%, transparent 0, transparent 11px, rgba(255,255,255,.028) 12px, transparent 13px);
  }
  .phys-base{
    width:130px; height:18px; background:linear-gradient(180deg,#0c0c0e,#020202);
    margin:0 auto; border-radius:0 0 10px 10px; box-shadow:0 22px 34px rgba(0,0,0,.5);
    transform:rotateX(55deg); transform-origin:top;
  }
  .phys-brand-row{display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:22px; position:relative; z-index:1;}
  .phys-brand-logo{
    width:30px; height:30px; border-radius:50%; background:var(--bg2); border:1px solid var(--line);
    display:flex; align-items:center; justify-content:center; font-size:15px;
  }
  .phys-brand-name{font-size:13px; font-weight:700; letter-spacing:.5px; color:#e4e4e6;}
  .phys-g-logo{width:78px; height:78px; margin:6px auto 18px; position:relative; z-index:1;}
  .phys-tap-row{
    display:flex; align-items:center; justify-content:center; gap:10px; color:#c9c9cc;
    font-size:12px; font-weight:600; letter-spacing:2px; text-transform:uppercase; margin-bottom:14px; position:relative; z-index:1;
  }
  .phys-tap-row .ic{font-size:15px;}
  .phys-review-line{font-weight:800; font-size:19px; color:#fff; margin-bottom:30px; position:relative; z-index:1; letter-spacing:.2px;}
  .phys-bottom-row{display:flex; align-items:flex-end; justify-content:space-between; position:relative; z-index:1;}
  .phys-qr-box{background:#fff; padding:9px; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,.35);}
  .phys-qr-box img{display:block; width:82px; height:82px;}
  .phys-powered{text-align:right; color:#84848a; font-size:10px; letter-spacing:.5px; line-height:1.5;}
  .phys-powered b{color:#d8d8db; display:block; font-size:13px; letter-spacing:.5px;}
  .status-pill{
    position:absolute; top:16px; right:16px; z-index:2; font-size:10px; font-weight:800; letter-spacing:1px;
    padding:5px 11px; border-radius:20px; text-transform:uppercase;
  }
  .status-pill.active{background:rgba(212,175,55,.15); color:var(--gold); border:1px solid rgba(212,175,55,.35);}
  .status-pill.inactive{background:rgba(255,255,255,.06); color:#999; border:1px solid var(--line);}
  .phys-card-id{color:#5c5c62; font-size:11px; letter-spacing:1px; margin-top:22px; position:relative; z-index:1;}
  .nfc-tap-btn{
    display:block; width:100%; max-width:380px; margin:26px auto 0; background:linear-gradient(180deg,var(--gold-soft),var(--gold));
    color:#0a0a0a; font-weight:800; padding:16px; border-radius:12px; border:none; font-size:14px; letter-spacing:.5px;
    cursor:pointer; transition:transform .15s;
  }
  .nfc-tap-btn:active{transform:scale(.97);}

  .error-box{max-width:420px; margin:120px auto; text-align:center; padding:0 24px;}
  .error-box h1{font-size:60px; margin-bottom:10px;}
  .error-box p{color:var(--gray);}
`;

// Reveal script is now in public/js/reveal.js (served as static file).
const REVEAL_SCRIPT = '<script src="/js/reveal.js"></script>';

const { WHATSAPP_NUMBER } = require('./config');

function page({ title = 'Tap2Review', body = '', nav = true, footer = true }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="stylesheet" href="/css/styles.css">
</head>
<body>
${nav ? `<div class="nav">
  <a href="/" class="brand">TAP2<span>REVIEW</span></a>
  <div class="nav-links">
    <a href="/how-it-works" class="link">How It Works</a>
    <a href="/demo" class="link">Demo</a>
    <a href="/pricing" class="link">Pricing</a>
    <a href="/faq" class="link">FAQ</a>
    <a href="https://wa.me/${WHATSAPP_NUMBER}" class="link" target="_blank">WhatsApp</a>
    <a href="/login" class="link">Login</a>
    <a href="/admin" class="btn">Admin</a>
  </div>
</div>` : ''}
${body}
${footer ? `<footer>
  <div class="foot-brand">TAP2REVIEW</div>
  <div>© 2026 Tap2Review. All rights reserved.</div>
  <div style="margin-top:10px; color:var(--gray); font-size:13px;">
    For any query: Developer <a href="https://wa.me/${WHATSAPP_NUMBER}" target="_blank" style="color:var(--gold); font-weight:700; text-decoration:underline;">ANUJ MAURYA</a>
  </div>
</footer>` : ''}
${REVEAL_SCRIPT}
</body>
</html>`;
}

module.exports = { page, REVEAL_SCRIPT };
