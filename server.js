require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const QRCode = require('qrcode');
const { page } = require('./layout');
const db = require('./db');
const payments = require('./payments');
const paytm = require('./paytm');
const { WHATSAPP_NUMBER } = require('./config');
const { hashPassword, verifyPassword, requireCustomerAuth } = require('./auth');

const path = require('path');

const app = express();
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER || !!process.env.VERCEL;

// Trust reverse proxy (e.g. Cloudflare, Render, Vercel) for HTTPS detection and secure cookies
app.set('trust proxy', 1);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ensure MongoDB is connected before handling requests (required for Vercel serverless functions)
app.use(async (req, res, next) => {
  if (!db.isConnected()) {
    try {
      await db.connect();
    } catch (err) {
      console.error('MongoDB serverless connection error:', err.message);
    }
  }
  next();
});
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 60 * 60 * 24 * 7, // 7 days in seconds
    autoRemove: 'native',
  }),
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
}));

// In-memory rate limiting for login attempts
const loginAttempts = new Map();
function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (record && record.resetAt > now) {
    if (record.count >= 10) {
      return res.redirect('/login?error=' + encodeURIComponent('Too many login attempts. Please wait 15 minutes.'));
    }
    record.count++;
  } else {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  }
  next();
}

// In-memory rate limiting for purchase requests
const purchaseAttempts = new Map();
function purchaseRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = purchaseAttempts.get(ip);
  if (record && record.resetAt > now) {
    if (record.count >= 10) {
      return res.status(429).send('Too many purchase requests from this network. Please wait 15 minutes or contact us directly on WhatsApp.');
    }
    record.count++;
  } else {
    purchaseAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  }
  next();
}

// In-memory rate limiting for admin login attempts
const adminAttempts = new Map();

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'tap2review123';

// ---------- Basic Auth for /admin ----------
function requireAuth(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = adminAttempts.get(ip);
  if (record && record.resetAt > now && record.count >= 10) {
    return res.status(429).send('Too many admin login attempts. Please wait 15 minutes.');
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Tap2Review Admin"');
    return res.status(401).send('Authentication required.');
  }
  const [user, pass] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    adminAttempts.delete(ip);
    return next();
  }
  if (record && record.resetAt > now) {
    record.count++;
  } else {
    adminAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  }
  res.set('WWW-Authenticate', 'Basic realm="Tap2Review Admin"');
  return res.status(401).send('Invalid credentials.');
}

// ---------- Helpers ----------
const CARD_ID_RE = /^TR-[A-Z0-9]{4,10}$/;

function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ================= HEALTH CHECK =================
app.get('/health', (req, res) => {
  const dbStatus = db.isConnected() ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// ================= PUBLIC LANDING PAGE =================
app.get('/', async (req, res) => {
  try {
    const primaryCard = await db.getPrimaryCard();
    const isDemoSeed = primaryCard && primaryCard.id === 'card_1'; // original seed card only — real cards never match this
    const primaryBiz = primaryCard ? await db.getBusiness(primaryCard.businessId) : null;
    const bizName = primaryBiz ? primaryBiz.name : 'Your Business';
    const bizLogo = primaryBiz ? (primaryBiz.logo || '⭐') : '⭐';
    const cardId = primaryCard ? primaryCard.publicCardId : null;
    const demoHref = cardId ? `/card/${cardId}` : '/admin';
    const qrSrc = cardId ? `/api/qr/${cardId}` : null;

    const body = `
  <div class="hero">
    <div class="eyebrow">${isDemoSeed ? '✨ Demo card shown below — manage your own in Admin' : '✨ Now taking early access'}</div>
    <h1>Get More Reviews<br/>With One Tap.</h1>
    <p class="lead">One tap or scan. Straight to your Google review page. No app, no login, no friction.</p>
    <div class="btn-row">
      <a href="/demo" class="btn-primary">Try Demo</a>
      <a href="/pricing" class="btn-secondary">Buy Cards</a>
    </div>

    <div class="uc-wrap" style="margin-top:70px;">
      <div class="uc-card"><div class="uc-rings"></div>
        <div class="uc-center">
          <div class="uc-tap">TAP</div>
          <div class="uc-tap-row"><span class="ic">📱</span> Tap or Scan <span class="ic">📶</span></div>
        </div>
        <div class="uc-bottom-row">
          <div class="uc-qr-box">${qrSrc ? `<img src="${qrSrc}" alt="QR code" width="64" height="64"/>` : ''}</div>
          <div class="uc-brand">POWERED BY<b>tap2review</b></div>
        </div>
      </div>
    </div>
  </div>

  <div class="container" id="how">
    <div class="section-head reveal">
      <div class="section-tag">How it works</div>
      <h2>From tap to 5-star, in seconds</h2>
      <p>No app to download. No account to create. Just a card on your counter.</p>
    </div>
    <div class="steps">
      <div class="step reveal"><div class="num">01</div><h3>Customer sees card</h3><p>A sleek NFC + QR card sits on the counter, table, or checkout.</p></div>
      <div class="step reveal"><div class="num">02</div><h3>Customer taps or scans</h3><p>No app. No login. Just a phone tap or a quick QR scan.</p></div>
      <div class="step reveal"><div class="num">03</div><h3>Destination opens</h3><p>Straight to wherever you've set it — Google Reviews, Instagram, WhatsApp, or your site.</p></div>
    </div>
  </div>

  <div class="showcase" id="product">
    <div class="showcase-grid">
      <div class="showcase-copy reveal">
        <div class="section-tag">The product</div>
        <h3>One card. Every table. Every counter.</h3>
        <p>A premium matte-black card with embedded NFC and a printed QR code — built to sit quietly on your counter and do one job perfectly: send customers exactly where you want them to go.</p>
        <ul class="check-list">
          <li>Durable matte-black finish with subtle gold detailing</li>
          <li>NFC chip + QR code — works with any phone, iOS or Android</li>
          <li>Change the destination anytime without reprinting the card</li>
          <li>Deactivate instantly if you ever need to pause it</li>
        </ul>
        <div class="btn-row" style="justify-content:flex-start; margin-top:28px;">
          <a href="/demo" class="btn-secondary">View Digital Card</a>
        </div>
      </div>
      <div class="reveal">
        <div class="uc-wrap">
          <div class="uc-card" style="animation-delay:-3s;"><div class="uc-rings"></div>
            <div class="uc-center">
              <div class="uc-tap">TAP</div>
              <div class="uc-tap-row"><span class="ic">📱</span> Tap or Scan <span class="ic">📶</span></div>
            </div>
            <div class="uc-bottom-row">
              <div class="uc-qr-box">${qrSrc ? `<img src="${qrSrc}" alt="QR code" width="64" height="64"/>` : ''}</div>
              <div class="uc-brand">POWERED BY<b>tap2review</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="benefits" id="benefits">
    <div class="section-head reveal">
      <div class="section-tag">Why businesses use it</div>
      <h2>Built for real, offline businesses</h2>
    </div>
    <div class="benefit-grid">
      <div class="benefit reveal"><div class="icon">⚡</div><h4>Zero friction</h4><p>No app, no signup — customers are on your review page in one tap.</p></div>
      <div class="benefit reveal"><div class="icon">🔗</div><h4>Update anytime</h4><p>Change where the card points without reprinting or replacing it.</p></div>
      <div class="benefit reveal"><div class="icon">🛡️</div><h4>Always in control</h4><p>Activate or deactivate any card instantly from the admin panel.</p></div>
      <div class="benefit reveal"><div class="icon">📈</div><h4>More 5-star reviews</h4><p>Lower the effort to leave a review, and more happy customers will.</p></div>
    </div>
  </div>

  <div class="container">
    <div class="cta-final reveal">
      <h2>Ready to get more reviews?</h2>
      <p>Get your Tap2Review cards set up in minutes — no technical setup required on your end.</p>
      <a href="/pricing" class="btn-primary">Buy Cards</a>
    </div>
  </div>
  `;
    res.send(page({ title: 'Tap2Review — Turn Every Happy Customer Into a Review', body }));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// ================= HOW IT WORKS =================
app.get('/how-it-works', (req, res) => {
  const body = `
  <div class="container" style="padding:70px 24px 100px;">
    <div class="section-head reveal">
      <div class="section-tag">How It Works</div>
      <h2>From tap to 5-star, in seconds</h2>
    </div>
    <div class="steps">
      <div class="step reveal"><div class="num">01</div><h3>Get your cards</h3><p>Order a bundle of Tap2Review NFC + QR cards for your business.</p></div>
      <div class="step reveal"><div class="num">02</div><h3>Set your destination</h3><p>Point your cards at Google Reviews, Instagram, WhatsApp, your website — anything.</p></div>
      <div class="step reveal"><div class="num">03</div><h3>Place them anywhere</h3><p>Counter, table, checkout — customers tap or scan, no app needed.</p></div>
      <div class="step reveal"><div class="num">04</div><h3>Update anytime</h3><p>Change what a card points to whenever you like — the card itself never changes.</p></div>
    </div>
  </div>`;
  res.send(page({ title: 'How It Works — Tap2Review', body }));
});

// ================= FAQ =================
app.get('/faq', (req, res) => {
  const faqs = [
    ['Do customers need to download an app?', 'No. Tap or scan opens the destination directly in their phone\'s browser.'],
    ['Can I change where a card points later?', 'Yes — anytime from your dashboard. The physical card, QR, and NFC URL never change.'],
    ['What destinations are supported?', 'Google Reviews, Instagram, WhatsApp, your website, or any valid HTTPS link.'],
    ['What is Review Suggestions?', 'Review Suggestions is an optional, admin-managed feature for Google Review cards that shows the customer a few custom prompts to copy before continuing to Google. It never posts anything automatically.'],
    ['Can I deactivate a card?', 'Yes, instantly, from your dashboard — deactivated cards stop redirecting immediately.'],
  ];
  const body = `
  <div class="container" style="padding:70px 24px 100px; max-width:760px;">
    <div class="section-head reveal"><div class="section-tag">FAQ</div><h2>Common questions</h2></div>
    ${faqs.map(([q, a]) => `<div class="panel reveal"><h2 style="margin-bottom:8px;">${escapeHtml(q)}</h2><p style="color:var(--gray); font-size:14px; margin:0;">${escapeHtml(a)}</p></div>`).join('')}
  </div>`;
  res.send(page({ title: 'FAQ — Tap2Review', body }));
});

// ================= PRICING =================
app.get('/pricing', (req, res) => {
  const cards = Object.entries(payments.PLANS).map(([key, p]) => `
    <div class="benefit reveal" style="text-align:center; padding:34px 24px;">
      <h3 style="font-size:20px; margin:0 0 6px;">${p.quantity} Cards</h3>
      <div style="font-size:32px; font-weight:900; color:var(--gold); margin-bottom:4px;">₹${p.amount.toLocaleString('en-IN')}</div>
      <div style="color:var(--gray); font-size:13px; margin-bottom:22px;">₹${Math.round(p.amount / p.quantity)}/card</div>
      <a href="/checkout?plan=${key}" class="btn-primary" style="display:block;">Buy Now</a>
    </div>
  `).join('');
  const body = `
  <div class="container" style="padding:70px 24px 100px;">
    <div class="section-head reveal"><div class="section-tag">Pricing</div><h2>Simple, one-time pricing</h2><p>Buy cards once — no subscriptions.</p></div>
    <div class="benefit-grid" style="grid-template-columns:repeat(3,1fr);">${cards}</div>
    <p style="text-align:center; color:var(--gray); font-size:13px; margin-top:40px;">
      Prefer to order over chat? <a href="https://wa.me/${WHATSAPP_NUMBER}" style="color:var(--gold);" target="_blank">Message us on WhatsApp</a>.
    </p>
  </div>`;
  res.send(page({ title: 'Pricing — Tap2Review', body }));
});

// ================= INTERACTIVE DEMO (no login, no real card) =================
// Fixed demo destination — permanently set to Google, never a real customer's destination.
const DEMO_DESTINATION_URL = process.env.DEMO_DESTINATION_URL || 'https://www.google.com';

app.get('/demo', (req, res) => {
  const body = `
  <div class="hero" style="padding-top:60px;">
    <div class="eyebrow">Interactive Demo</div>
    <h1 style="font-size:32px;">Try the Tap2Review Experience</h1>
    <p class="lead">This simulates exactly what a customer sees — no account needed.</p>

    <div class="uc-wrap">
      <div class="uc-card"><div class="uc-rings"></div>
        <div class="uc-center">
          <div class="uc-tap">TAP</div>
          <div class="uc-tap-row"><span class="ic">📱</span> Tap or Scan <span class="ic">📶</span></div>
        </div>
        <div class="uc-bottom-row">
          <div class="uc-qr-box"><img src="/api/qr/demo" alt="Demo QR code" width="64" height="64"/></div>
          <div class="uc-brand">POWERED BY<b>tap2review</b></div>
        </div>
      </div>
    </div>

    <button class="nfc-tap-btn" style="max-width:340px;" onclick="window.location.href='/demo/redirect'">📶 Simulate Tap / Scan</button>

    <p style="max-width:420px; margin:22px auto 0; color:var(--gray); font-size:13px; text-align:center; line-height:1.6;">
      This is a demo. Your purchased cards will have unique QR/NFC links, and you can change their destination anytime from your dashboard.
    </p>
  </div>
  `;
  res.send(page({ title: 'Try the Demo — Tap2Review', body }));
});

// ================= CUSTOMER AUTH =================
app.get('/login', (req, res) => {
  const body = `
  <div class="hero" style="padding-top:80px;">
    <div class="panel" style="max-width:380px; margin:0 auto; text-align:left;">
      <h2>Log in to your dashboard</h2>
      ${req.query.error ? `<p style="color:#e88; font-size:13px;">${escapeHtml(req.query.error)}</p>` : ''}
      <form method="POST" action="/login">
        <label>Email</label>
        <input type="email" name="email" required/>
        <label>Password</label>
        <input type="password" name="password" required/>
        <button class="btn-small" type="submit" style="width:100%; margin-top:6px;">Log In</button>
      </form>
      <p style="color:var(--gray); font-size:13px; margin-top:16px;">No account yet? <a href="/pricing" style="color:var(--gold);">Buy cards</a> to get one automatically.</p>
    </div>
  </div>`;
  res.send(page({ title: 'Login — Tap2Review', body }));
});

app.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    if (!email || !password) {
      return res.redirect('/login?error=' + encodeURIComponent('Please enter both email and password.'));
    }
    const customer = await db.getCustomerByEmail(email);
    if (!customer || !customer.passwordHash || !(await verifyPassword(password, customer.passwordHash))) {
      return res.redirect('/login?error=' + encodeURIComponent('Invalid email or password.'));
    }
    // Clear failed login attempts on successful authentication
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    loginAttempts.delete(ip);

    req.session.customerId = customer.id;
    // Explicitly persist session to MongoStore before sending 302 redirect
    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.redirect('/dashboard');
    });
  } catch (err) {
    console.error('Login error:', err);
    res.redirect('/login?error=' + encodeURIComponent('Something went wrong. Please try again.'));
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ================= CHECKOUT (WhatsApp manual-payment flow) =================
//
// Launch mode: NO automatic payment gateway is used in the customer-facing
// flow right now. Customers submit their purchase request, then complete
// payment manually over WhatsApp. Admin manually confirms payment before
// any customer account, business, or cards are created. This keeps the
// "never activate before verified payment" rule intact even without a
// gateway — verification is just done by a human (Admin) instead of an API.
//
// The full Paytm integration (paytm.js, payments.js) is left completely
// intact below, gated behind ENABLE_PAYTM_CHECKOUT=true, so it can be
// switched back on later without rewriting anything — see the bottom of
// this section.

app.get('/checkout', (req, res) => {
  const planKey = req.query.plan;
  const plan = payments.getPlan(planKey);
  if (!plan) return res.redirect('/pricing');
  const body = `
  <div class="hero" style="padding-top:70px;">
    <div class="panel" style="max-width:420px; margin:0 auto; text-align:left;">
      <h2>Reserve — ${plan.quantity} Cards</h2>
      <p style="color:var(--gold); font-weight:800; font-size:20px; margin-top:-8px;">₹${plan.amount.toLocaleString('en-IN')}</p>
      <p style="color:var(--gray); font-size:12px;">
        Fill in your details, then complete payment with us directly on WhatsApp. Your cards are created only after we confirm payment has been received — usually within a few hours.
      </p>
      <form method="POST" action="/api/purchase-request">
        <input type="hidden" name="plan" value="${escapeHtml(planKey)}"/>
        <label>Your Name</label>
        <input name="name" required/>
        <label>Business Name</label>
        <input name="businessName" required placeholder="e.g. Sharma Cafe"/>
        <label>Email</label>
        <input type="email" name="email" required/>
        <label>Phone Number</label>
        <input name="phone" required placeholder="e.g. 9876543210"/>
        <label>Set a Password (for dashboard access once confirmed)</label>
        <input type="password" name="password" required minlength="6"/>
        <button class="btn-primary" type="submit" style="width:100%; border:none; cursor:pointer; margin-top:8px;">Continue to WhatsApp</button>
      </form>
    </div>
  </div>`;
  res.send(page({ title: 'Reserve Your Cards — Tap2Review', body }));
});

// Generates the unique cards + customer account for a paid order.
// Idempotent via order.cardsGenerated — safe to call more than once
// (e.g. if Admin double-clicks "Confirm Payment" on the same order).
async function fulfillPaidOrder(order) {
  if (order.cardsGenerated) {
    return {
      customer: await db.getCustomerById(order.customerId),
      cards: (await db.getCardsByCustomer(order.customerId)).filter(c => c.orderId === order.id),
    };
  }
  const { name, email, businessName, passwordHash } = order.checkout;

  let customer = await db.getCustomerByEmail(email);
  if (!customer) {
    customer = await db.createCustomer({ name, email, passwordHash });
  } else if (!customer.passwordHash || customer.passwordHash.length < 20) {
    customer = await db.updateCustomerPassword(customer.id, passwordHash);
  }
  if (!order.customerId) {
    await db.setOrderCustomerId(order.id, customer.id);
  }

  let business = (await db.getBusinessesByOwner(customer.id))[0];
  if (!business) {
    business = await db.createBusiness({ name: businessName, reviewUrl: '', ownerId: customer.id });
  }
  const newCards = [];
  for (let i = 0; i < order.quantity; i++) {
    newCards.push(await db.createCard({ businessId: business.id, customerId: customer.id, orderId: order.id, businessName }));
  }
  await db.markOrderCardsGenerated(order.id);
  return { customer, cards: newCards };
}

// Creates a PENDING_PAYMENT order — this is a REQUEST, not a payment.
// No customer, business, or cards are created here, and no session is set.
// The customer gets none of that until Admin confirms payment (see the
// /admin/api/order/:orderId/confirm-payment route further down).
app.post('/api/purchase-request', purchaseRateLimiter, async (req, res) => {
  try {
    const { plan, name, businessName, email, phone, password } = req.body;
    const planDef = payments.getPlan(plan);
    if (!planDef || !name || !businessName || !email || !phone || !password) {
      return res.status(400).send('Missing or invalid details. <a href="/pricing">Go back</a>.');
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).send('Please enter a valid email address. <a href="/pricing">Go back</a>.');
    }

    const trimmedPhone = String(phone).trim().replace(/[\s\-()]/g, '');
    if (trimmedPhone.length < 10 || trimmedPhone.length > 15) {
      return res.status(400).send('Please enter a valid phone number (at least 10 digits). <a href="/pricing">Go back</a>.');
    }

    if (String(password).length < 6) {
      return res.status(400).send('Password must be at least 6 characters. <a href="/pricing">Go back</a>.');
    }

    if (String(name).length > 100 || String(businessName).length > 100) {
      return res.status(400).send('Name or business name is too long (maximum 100 characters). <a href="/pricing">Go back</a>.');
    }

    const passwordHash = await hashPassword(password);
    const order = await db.createOrder({
      quantity: planDef.quantity,
      amount: planDef.amount,
      plan,
      paymentStatus: 'PENDING_PAYMENT',
      checkout: {
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        businessName: String(businessName).trim(),
        phone: String(phone).trim(),
        passwordHash
      },
    });

    const message =
      `Hi Tap2Review! I'd like to purchase ${planDef.quantity} cards (₹${planDef.amount.toLocaleString('en-IN')}).\n\n` +
      `Order ID: ${order.id}\n` +
      `Name: ${name}\n` +
      `Business: ${businessName}\n` +
      `Email: ${email}\n` +
      `Phone: ${phone}\n` +
      `Bundle: ${planDef.quantity} Cards — ₹${planDef.amount.toLocaleString('en-IN')}`;
    const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    const body = `
    <div class="hero" style="padding-top:80px; text-align:center;">
      <div class="eyebrow">Request Received</div>
      <h1 style="font-size:28px;">One more step — complete payment on WhatsApp</h1>
      <p class="lead">Order <code>${escapeHtml(order.id)}</code> for ${planDef.quantity} cards (₹${planDef.amount.toLocaleString('en-IN')}) has been recorded as <b>Pending Payment</b>.</p>
      <a href="${waLink}" class="btn-primary" target="_blank">Purchase via WhatsApp</a>
      <p style="color:var(--gray); font-size:13px; margin-top:24px; max-width:440px; margin-left:auto; margin-right:auto;">
        Your cards and dashboard access will be created only after we confirm your payment. This is usually quick — we'll reach out on WhatsApp once it's done.
      </p>
    </div>`;
    res.send(page({ title: 'Complete Payment on WhatsApp — Tap2Review', body }));
  } catch (err) {
    console.error('Purchase request error:', err);
    res.status(500).send('An unexpected error occurred while processing your request. Please try again or contact us directly on WhatsApp.');
  }
});

// ---- Legacy Paytm flow: intact but disabled by default ----
// Set ENABLE_PAYTM_CHECKOUT=true in .env to re-enable automatic online
// payment later. When disabled (default), these routes simply 404 rather
// than silently doing nothing, so it's obvious if something still points
// at them by mistake.
const PAYTM_CHECKOUT_ENABLED = process.env.ENABLE_PAYTM_CHECKOUT === 'true';

app.post('/api/checkout-paytm', async (req, res) => {
  if (!PAYTM_CHECKOUT_ENABLED) return res.status(404).send('Paytm checkout is currently disabled. Set ENABLE_PAYTM_CHECKOUT=true to re-enable.');
  const { plan, name, email, businessName, password } = req.body;
  const planDef = payments.getPlan(plan);
  if (!planDef || !name || !email || !businessName || !password) {
    return res.status(400).send('Missing or invalid checkout details. <a href="/pricing">Go back</a>.');
  }

  const passwordHash = await hashPassword(password);
  const order = await db.createOrder({
    quantity: planDef.quantity,
    amount: planDef.amount,
    plan,
    paymentStatus: 'PENDING_PAYMENT',
    checkout: { name, email, businessName, passwordHash },
  });

  if (!paytm.isConfigured) {
    const result = await payments.verifyPayment({ planKey: plan, customerEmail: email });
    if (!result.verified) {
      await db.markOrderFailed(order.id);
      return res.status(402).send('Payment could not be verified. <a href="/pricing">Try again</a>.');
    }
    await db.markOrderPaid(order.id, result.reference);
    const { customer } = await fulfillPaidOrder(await db.getOrderById(order.id));
    req.session.customerId = customer.id;
    return res.send(page({
      title: 'Payment Successful — Tap2Review',
      body: `<div class="hero" style="padding-top:90px; text-align:center;">
        <div class="eyebrow">✅ Payment Successful (Simulated)</div>
        <h1 style="font-size:30px;">Your Tap2Review account has been created.</h1>
        <p class="lead">${order.quantity} cards generated for ${escapeHtml(businessName)}. Head to your dashboard to set your destination.</p>
        <a href="/dashboard" class="btn-primary">Go to Dashboard</a>
      </div>`,
    }));
  }

  try {
    const { txnToken, paymentPageUrl } = await paytm.initiateTransaction({
      orderId: order.id,
      amount: planDef.amount,
      custId: 'CUST_' + Buffer.from(email).toString('base64').slice(0, 20),
      email,
    });
    const body = `
    <div class="hero" style="padding-top:100px; text-align:center;">
      <p>Redirecting you to Paytm's secure payment page…</p>
      <form id="paytmForm" method="POST" action="${escapeHtml(paymentPageUrl)}">
        <input type="hidden" name="mid" value="${escapeHtml(process.env.PAYTM_MID)}"/>
        <input type="hidden" name="orderId" value="${escapeHtml(order.id)}"/>
        <input type="hidden" name="txnToken" value="${escapeHtml(txnToken)}"/>
      </form>
      <script>document.getElementById('paytmForm').submit();</script>
    </div>`;
    res.send(page({ title: 'Redirecting to Paytm…', body }));
  } catch (err) {
    await db.markOrderFailed(order.id);
    res.status(502).send('Could not start Paytm payment. <a href="/pricing">Try again</a>. (' + escapeHtml(err.message) + ')');
  }
});

app.post('/api/payment/callback', async (req, res) => {
  if (!PAYTM_CHECKOUT_ENABLED) return res.status(404).send('Paytm checkout is currently disabled.');
  const body = req.body;
  const orderId = body.ORDERID;
  const order = orderId && await db.getOrderById(orderId);
  if (!order) return res.status(404).send('Unknown order.');

  if (order.paymentStatus === 'PAID') {
    return res.redirect('/checkout/success?order=' + encodeURIComponent(order.id));
  }

  const checksumValid = await paytm.verifyCallbackChecksum(body).catch(() => false);
  if (!checksumValid) {
    await db.markOrderFailed(order.id);
    return res.status(400).send('Checksum verification failed. Payment not trusted.');
  }

  let statusResp;
  try {
    statusResp = await paytm.checkTransactionStatus(order.id);
  } catch (err) {
    return res.status(502).send('Could not verify payment status with Paytm. Please contact support with order ID ' + order.id);
  }

  const resultStatus = statusResp && statusResp.body && statusResp.body.resultInfo && statusResp.body.resultInfo.resultStatus;
  if (resultStatus !== 'TXN_SUCCESS') {
    await db.markOrderFailed(order.id);
    return res.redirect('/checkout/failed?order=' + encodeURIComponent(order.id));
  }

  const txnId = statusResp.body.txnId || null;
  await db.markOrderPaid(order.id, txnId);
  await fulfillPaidOrder(await db.getOrderById(order.id));
  res.redirect('/checkout/success?order=' + encodeURIComponent(order.id));
});

app.get('/checkout/success', async (req, res) => {
  if (!PAYTM_CHECKOUT_ENABLED) return res.redirect('/pricing');
  const order = await db.getOrderById(req.query.order);
  if (!order || order.paymentStatus !== 'PAID') return res.redirect('/pricing');
  const customer = await db.getCustomerById(order.customerId);
  if (customer) req.session.customerId = customer.id;
  const body = `<div class="hero" style="padding-top:90px; text-align:center;">
    <div class="eyebrow">✅ Payment Successful</div>
    <h1 style="font-size:30px;">Your Tap2Review account has been created.</h1>
    <p class="lead">${order.quantity} cards generated. Head to your dashboard to set your destination.</p>
    <a href="/dashboard" class="btn-primary">Go to Dashboard</a>
  </div>`;
  res.send(page({ title: 'Payment Successful — Tap2Review', body }));
});

app.get('/checkout/failed', (req, res) => {
  if (!PAYTM_CHECKOUT_ENABLED) return res.redirect('/pricing');
  const body = `<div class="hero" style="padding-top:90px; text-align:center;">
    <div class="eyebrow">❌ Payment Failed</div>
    <h1 style="font-size:26px;">Your payment could not be verified.</h1>
    <p class="lead">No cards were created and you were not charged for this attempt.</p>
    <a href="/pricing" class="btn-primary">Try Again</a>
  </div>`;
  res.send(page({ title: 'Payment Failed — Tap2Review', body }));
});



// ================= CUSTOMER DASHBOARD =================
app.get('/dashboard', requireCustomerAuth, async (req, res) => {
  try {
    const customer = await db.getCustomerById(req.session.customerId);
    const myCards = await db.getCardsByCustomer(customer.id);

    const cardRows = await Promise.all(myCards.map(async c => {
      const redirectUrl = `${BASE_URL}/r/${c.publicCardId}`;
      const dest = await db.resolveDestination(c);
      const bizName = await db.resolveCardBusinessName(c);
      return `<tr>
      <td><code>${c.publicCardId}</code></td>
      <td>${escapeHtml(bizName)}</td>
      <td><span class="badge ${c.status === 'ACTIVE' ? 'active' : 'inactive'}">${c.status}</span></td>
      <td style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(dest || '')}">${escapeHtml(dest || '—')}</td>
      <td>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <a href="/card/${c.publicCardId}" class="btn-small" style="text-decoration:none;">View</a>
          <a href="/api/qr/${c.publicCardId}?download=1" class="btn-small" style="text-decoration:none;">QR</a>
          <button class="btn-small edit-card-btn" data-card-id="${escapeHtml(c.publicCardId)}" data-business-name="${escapeHtml(bizName)}" data-destination="${escapeHtml(dest || '')}">Edit Card</button>
          <button class="btn-small" onclick="toggleCardStatus('${c.publicCardId}','${c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}')">${c.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
        </div>
      </td>
    </tr>`;
    }));

    const myOrders = await db.getOrdersByCustomer(customer.id);

    const orderRows = (myOrders || []).slice().reverse().map(o => {
      const statusClass = o.paymentStatus === 'PAID' ? 'active' : (o.paymentStatus === 'FAILED' ? 'inactive' : '');
      const statusStyle = o.paymentStatus === 'PENDING_PAYMENT' ? 'style="background:rgba(255,180,60,.15); color:#e0a03c; border:1px solid rgba(255,180,60,.35);"' : '';
      return `<tr>
        <td><code>${escapeHtml(o.id)}</code></td>
        <td>${escapeHtml(o.plan)} Cards</td>
        <td>${o.quantity}</td>
        <td>₹${Number(o.amount).toLocaleString('en-IN')}</td>
        <td><span class="badge ${statusClass}" ${statusStyle}>${escapeHtml(o.paymentStatus)}</span></td>
        <td>${new Date(o.createdAt).toLocaleDateString()}</td>
      </tr>`;
    });

    const body = `
  <div class="container" style="padding:40px 24px 90px;">
    <div class="flex-between">
      <h1 style="letter-spacing:.5px;">My Dashboard</h1>
      <form method="POST" action="/logout"><button class="btn-small" type="submit">Log Out</button></form>
    </div>
    <p style="color:var(--gray);">${escapeHtml(customer.name)} · ${escapeHtml(customer.email)}</p>

    <div class="panel">
      <h2>Apply to All Cards (optional)</h2>
      <p style="color:var(--gray); font-size:13px; margin-top:-6px;">A quick way to set the same business name and destination on every card at once. Each card can still be edited individually afterward — this never locks cards together.</p>
      <form onsubmit="applyToAll(event)">
        <label>Business Name</label>
        <input name="businessName" required placeholder="e.g. Rahul Cafe"/>
        <label>Destination URL (Google Reviews / Instagram / WhatsApp / Website)</label>
        <input name="destinationUrl" required placeholder="https://g.page/your-business/review"/>
        <button class="btn-small" type="submit">Apply to All ${myCards.length} Cards</button>
      </form>
    </div>

    <div class="panel">
      <h2>My Cards (${myCards.length})</h2>
      <p style="color:var(--gray); font-size:13px; margin-top:-6px;">Review Suggestions (if enabled) are managed by Tap2Review admin and cannot be changed here.</p>
      <table>
        <thead><tr><th>Card ID</th><th>Business Name</th><th>Status</th><th>Destination</th><th>Actions</th></tr></thead>
        <tbody>${cardRows.join('') || '<tr><td colspan="5" style="color:var(--gray);">No cards yet.</td></tr>'}</tbody>
      </table>
    </div>

    <div class="panel">
      <h2>Order History (${(myOrders || []).length})</h2>
      <table>
        <thead><tr><th>Order ID</th><th>Plan</th><th>Cards</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>${orderRows.join('') || '<tr><td colspan="6" style="color:var(--gray);">No orders found.</td></tr>'}</tbody>
      </table>
    </div>
  </div>

  <div id="editCardModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:100; align-items:center; justify-content:center;">
    <div class="panel" style="max-width:380px; width:90%; margin:0;">
      <h2>Edit Card <span id="editCardIdLabel" style="color:var(--gold);"></span></h2>
      <p style="color:var(--gray); font-size:12px; margin-top:-6px;">Only this card is affected. Its Card ID and QR/NFC link never change.</p>
      <label>Business Name</label>
      <input id="editBusinessName" required/>
      <label>Destination URL</label>
      <input id="editDestinationUrl" required placeholder="https://..."/>
      <div style="display:flex; gap:8px; margin-top:6px;">
        <button class="btn-small" style="flex:1;" onclick="saveCardEdit()">Save</button>
        <button class="btn-small" style="flex:1; background:transparent; border:1px solid var(--line); color:var(--white);" onclick="closeEditModal()">Cancel</button>
      </div>
    </div>
  </div>

  <script src="/js/dashboard.js"></script>
  <style>.prompt-field{display:block; width:100%; margin-bottom:8px;}</style>
  `;
    res.send(page({ title: 'Dashboard — Tap2Review', body }));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Ownership check used by every dashboard card API below.
async function ownedCardOr403(req, res) {
  const card = await db.getCardByPublicId(req.params.cardId);
  if (!card || card.customerId !== req.session.customerId) {
    res.status(403).json({ error: 'Not authorized for this card' });
    return null;
  }
  return card;
}

// Edit a SINGLE card's business name + destination — never touches sibling cards.
app.post('/dashboard/api/card/:cardId/details', requireCustomerAuth, async (req, res) => {
  const card = await ownedCardOr403(req, res);
  if (!card) return;
  const { businessName, destinationUrl } = req.body;
  if (!businessName || !destinationUrl || !isValidHttpUrl(destinationUrl)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  res.json(await db.setCardDetails(card.publicCardId, { businessName, destinationUrl }));
});

// Optional convenience: apply the same business name + destination to every
// card this customer owns. Each card remains independently editable afterward.
app.post('/dashboard/api/apply-to-all', requireCustomerAuth, async (req, res) => {
  const { businessName, destinationUrl } = req.body;
  if (!businessName || !destinationUrl || !isValidHttpUrl(destinationUrl)) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const myCards = await db.getCardsByCustomer(req.session.customerId);
  await Promise.all(myCards.map(c => db.setCardDetails(c.publicCardId, { businessName, destinationUrl })));
  res.json({ updated: myCards.length });
});

// NOTE: Review Suggestions is an ADMIN-ONLY control (see /admin/api/card/:cardId/suggestions
// and /admin/api/card/:cardId/prompts below). There is deliberately no customer-facing
// route for it — a customer must never be able to enable/disable or edit prompts on
// their own cards, even by calling an API directly. requireAuth (admin Basic Auth) is
// a completely separate credential from requireCustomerAuth (session-based).

app.post('/dashboard/api/card/:cardId/status', requireCustomerAuth, async (req, res) => {
  const card = await ownedCardOr403(req, res);
  if (!card) return;
  const { status } = req.body;
  if (!['ACTIVE', 'INACTIVE'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  res.json(await db.setCardStatus(card.publicCardId, status));
});

// ================= DIGITAL CARD =================
app.get('/card/:cardId', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const cardId = req.params.cardId;
  try {
    const card = await db.getCardByPublicId(cardId);
    if (!card) return renderNotFound(res, `No card found for ID "${cardId}".`);

    const isActive = card.status === 'ACTIVE';
    const destination = await db.resolveDestination(card);
    const bizName = await db.resolveCardBusinessName(card);
    const qrTs = Date.now(); // cache-bust so QR always reflects latest destination on refresh

    // The physical card itself is universal and destination-neutral — no business
    // name, logo, or destination type is ever printed on it. Only the QR/NFC
    // permanent redirect URL is unique per card.
    const body = `
  <div class="hero" style="padding-top:60px; padding-bottom:60px;">
    <div class="eyebrow">Digital Card Preview</div>

    <div class="uc-wrap">
      <div class="uc-card"><div class="uc-rings"></div>
        <span class="uc-status-pill ${isActive ? 'active' : 'inactive'}">${isActive ? 'Active' : 'Inactive'}</span>
        <span class="uc-card-id">${escapeHtml(cardId)}</span>

        <div class="uc-center">
          <div class="uc-tap">TAP</div>
          <div class="uc-tap-row"><span class="ic">📱</span> Tap or Scan <span class="ic">📶</span></div>
        </div>

        <div class="uc-bottom-row">
          <div class="uc-qr-box"><img src="/api/qr/${encodeURIComponent(cardId)}?t=${qrTs}" alt="QR code" width="64" height="64"/></div>
          <div class="uc-brand">POWERED BY<b>tap2review</b></div>
        </div>
      </div>
    </div>

    <button class="nfc-tap-btn" onclick="simulateTap()" ${isActive ? '' : 'disabled style="opacity:.5; cursor:not-allowed;"'}>
      📶 Simulate NFC Tap
    </button>

    ${!isActive ? `<p style="color:#e88; margin-top:16px; font-size:13px; text-align:center;">⚠ This card is currently INACTIVE — tap/scan will not redirect.</p>` : ''}

    <div class="panel" style="max-width:420px; margin:24px auto 0; text-align:left;">
      <h2 style="margin-bottom:16px;">Card Details</h2>
      <p style="color:#666; font-size:12px; margin:-10px 0 16px;">The physical card is universal — this info is only for your reference and never printed on the card itself.</p>
      <label>Card ID</label>
      <input readonly value="${escapeHtml(cardId)}" style="margin-bottom:16px;"/>

      <label>Business Name (customer-configured)</label>
      <input readonly value="${escapeHtml(bizName)}" style="margin-bottom:16px;"/>

      <label>Permanent Redirect URL (used in QR + NFC)</label>
      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <input readonly id="redirectUrlInput" value="${BASE_URL}/r/${cardId}" style="margin-bottom:0;"/>
        <button class="btn-small" onclick="copyRedirect()">Copy</button>
      </div>

      <label>NFC URL (write this exact URL to the NFC chip)</label>
      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <input readonly id="nfcUrlInput" value="${BASE_URL}/r/${cardId}" style="margin-bottom:0;"/>
        <button class="btn-small" onclick="copyNfc()">Copy</button>
      </div>
      <p style="color:#666; font-size:12px; margin:-8px 0 16px;">The NFC URL is always identical to the Permanent Redirect URL above.</p>

      <label>Current Destination (where this card redirects right now)</label>
      <input readonly value="${escapeHtml(destination || 'Not configured')}" style="margin-bottom:0;"/>
    </div>

    <div style="max-width:420px; margin:14px auto 0; display:flex; gap:10px;">
      <button class="btn-small" style="flex:1" onclick="copyRedirect()">Copy Redirect URL</button>
      <a class="btn-small" style="flex:1; text-align:center; display:inline-block; text-decoration:none;" href="/api/qr/${encodeURIComponent(cardId)}?download=1" download="tapreview-${cardId}.png">Download QR</a>
    </div>
  </div>
  <script>
    function simulateTap(){ window.location.href = '/r/${cardId}'; }
    function copyRedirect(){
      navigator.clipboard.writeText('${BASE_URL}/r/${cardId}').then(()=>alert('Permanent Redirect URL copied!'));
    }
    function copyNfc(){
      navigator.clipboard.writeText('${BASE_URL}/r/${cardId}').then(()=>alert('NFC URL copied!'));
    }
  </script>
  `;
    res.send(page({ title: `${bizName} — Tap2Review`, body }));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// ================= QR CODE API =================
// Fixed demo QR/redirect — encodes the same permanent-URL pattern real cards use,
// but always points to the fixed demo destination, never a real customer's link.
app.get('/api/qr/demo', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const buf = await QRCode.toBuffer(`${BASE_URL}/demo/redirect`, { width: 400, margin: 1, color: { dark: '#0a0a0a', light: '#ffffff' } });
    res.set('Content-Type', 'image/png');
    res.send(buf);
  } catch (e) {
    res.status(500).send('QR generation failed');
  }
});
app.get('/demo/redirect', (req, res) => {
  res.redirect(302, DEMO_DESTINATION_URL);
});

app.get('/api/qr/:cardId', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const cardId = req.params.cardId;
  const url = `${BASE_URL}/r/${cardId}`;
  try {
    const buf = await QRCode.toBuffer(url, { width: 400, margin: 1, color: { dark: '#0a0a0a', light: '#ffffff' } });
    res.set('Content-Type', 'image/png');
    if (req.query.download) res.set('Content-Disposition', `attachment; filename="tapreview-${cardId}.png"`);
    res.send(buf);
  } catch (e) {
    res.status(500).send('QR generation failed');
  }
});

// ================= CORE REDIRECT =================
app.get('/r/:cardId', async (req, res) => {
  const cardId = req.params.cardId;

  if (!CARD_ID_RE.test(cardId)) return renderNotFound(res);

  try {
    const card = await db.getCardByPublicId(cardId);
    if (!card) return renderNotFound(res);
    if (card.status !== 'ACTIVE') return renderInactive(res);

    const destination = await db.resolveDestination(card);
    if (!destination || !isValidHttpUrl(destination)) return renderNotFound(res, 'This card is not configured yet.');

    // Review Suggestions is OPTIONAL, admin-controlled, and only applies to Google Review destinations.
    // Every other destination (Instagram, WhatsApp, website, etc.) redirects directly — no interstitial, ever.
    const suggestionsOn = card.reviewSuggestions && card.reviewSuggestions.enabled;
    if (suggestionsOn && db.isGoogleReviewDestination(destination)) {
      return renderReviewSuggestions(res, card, destination);
    }

    return res.redirect(302, destination);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Only shown when Review Suggestions is explicitly ON (admin-controlled) for a Google Review card,
// using that card's own custom prompts (falls back to universal defaults if
// the owner hasn't set any yet). This is the ONLY case with an interstitial
// page — the customer stays in control and must click through to Google
// themselves; nothing is ever auto-submitted on their behalf.
function renderReviewSuggestions(res, card, destination) {
  const prompts = db.getCardReviewPrompts(card);
  const options = prompts.map((text, i) =>
    `<label class="suggestion-option">
      <input type="radio" name="suggestion" value="${i}" ${i === 0 ? 'checked' : ''}/>
      <span>${escapeHtml(text)}</span>
    </label>`
  ).join('');

  const body = `
  <div class="hero" style="padding-top:60px;">
    <div class="eyebrow">Review Suggestions</div>
    <h1 style="font-size:28px;">How was your experience?</h1>
    <p class="lead" style="font-size:15px;">Pick a line you like, then continue to Google to post it — you're always in control of what gets submitted.</p>

    <div class="panel" style="max-width:440px; margin:30px auto 0; text-align:left;">
      <form id="suggForm">${options}</form>
      <button class="btn-primary" style="width:100%; margin-top:18px; border:none; cursor:pointer;" onclick="copyAndContinue()">Copy &amp; Continue to Google</button>
      <a href="${escapeHtml(destination)}" style="display:block; text-align:center; margin-top:14px; color:#888; font-size:13px;">Skip / Continue without suggestion →</a>
    </div>
  </div>
  <style>
    .suggestion-option{display:flex; gap:10px; align-items:flex-start; padding:12px; border:1px solid var(--line); border-radius:10px; margin-bottom:10px; cursor:pointer; font-size:14px;}
    .suggestion-option:hover{border-color:var(--gold);}
  </style>
  <script>
    function copyAndContinue(){
      const val = document.querySelector('input[name="suggestion"]:checked').nextElementSibling.textContent;
      navigator.clipboard.writeText(val).then(function(){
        window.location.href = ${JSON.stringify(destination)};
      }, function(){
        // Clipboard can fail (e.g. no HTTPS in dev) — continue anyway, text is on screen to copy manually.
        window.location.href = ${JSON.stringify(destination)};
      });
    }
  </script>
  `;
  res.send(page({ title: 'Leave a review — Tap2Review', body }));
}

function renderNotFound(res, msg = "This card doesn't exist or is no longer valid.") {
  const body = `<div class="error-box"><h1>❌</h1><h2>Card Not Found</h2><p>${escapeHtml(msg)}</p><a href="/" class="btn-secondary" style="margin-top:20px; display:inline-block;">Go Home</a></div>`;
  res.status(404).send(page({ title: 'Card Not Found — Tap2Review', body }));
}
function renderInactive(res) {
  const body = `<div class="error-box"><h1>⏸️</h1><h2>Card Inactive</h2><p>This review card has been deactivated by the business owner.</p><a href="/" class="btn-secondary" style="margin-top:20px; display:inline-block;">Go Home</a></div>`;
  res.status(410).send(page({ title: 'Card Inactive — Tap2Review', body }));
}

// ================= ADMIN =================
app.get('/admin', requireAuth, async (req, res) => {
  try {
    const allBusinesses = await db.getBusinesses();
    const allCards = await db.getCards();
    const businesses = allBusinesses.filter(b => !b.ownerId); // admin-managed businesses only
    const cards = allCards.filter(c => !c.customerId); // ONLY admin-created cards — customer-purchased cards never appear anywhere in Admin

    const rows = await Promise.all(cards.map(async c => {
      const redirectUrl = `${BASE_URL}/r/${c.publicCardId}`;
      const bizName = await db.resolveCardBusinessName(c);
      const dest = await db.resolveDestination(c);
      return `<tr>
      <td>${escapeHtml(bizName)}</td>
      <td><code>${c.publicCardId}</code></td>
      <td><span class="badge ${c.status === 'ACTIVE' ? 'active' : 'inactive'}">${c.status}</span></td>
      <td>${c.primary ? '<span class="badge active">HOMEPAGE</span>' : ''}</td>
      <td style="max-width:170px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(redirectUrl)}"><code>${escapeHtml(redirectUrl)}</code></td>
      <td style="max-width:170px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(dest || '')}">${escapeHtml(dest || '—')}</td>
      <td>
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          <a href="/card/${c.publicCardId}" class="btn-small" style="text-decoration:none; display:inline-block;">View</a>
          <a href="/api/qr/${c.publicCardId}" target="_blank" class="btn-small" style="text-decoration:none; display:inline-block;">QR</a>
          <a href="/api/qr/${c.publicCardId}?download=1" download="tapreview-${c.publicCardId}.png" class="btn-small" style="text-decoration:none; display:inline-block;">Download QR</a>
          <button class="btn-small" onclick="copyRedirectUrl('${redirectUrl}')">Copy URL</button>
          <button class="btn-small" onclick="toggleStatus('${c.publicCardId}','${c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}')">${c.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
          ${!c.primary ? `<button class="btn-small" onclick="setPrimary('${c.publicCardId}')">Set Homepage</button>` : ''}
        </div>
      </td>
    </tr>`;
    }));

    const bizOptions = businesses.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
    const cardOptions = await Promise.all(cards.map(async c => {
      const bizName = await db.resolveCardBusinessName(c);
      return `<option value="${c.publicCardId}">${c.publicCardId} — ${escapeHtml(bizName)}</option>`;
    }));

    // Review suggestions table rows
    const allCardsForSuggestions = await db.getCards(); // include customer cards for suggestions view
    const suggRows = await Promise.all(allCardsForSuggestions.map(async c => {
      const dest = await db.resolveDestination(c);
      const bizName = await db.resolveCardBusinessName(c);
      const isGoogle = db.isGoogleReviewDestination(dest);
      const on = !!(c.reviewSuggestions && c.reviewSuggestions.enabled);
      const prompts = db.getCardReviewPrompts(c);
      return `<tr>
              <td><code>${c.publicCardId}</code></td>
              <td>${escapeHtml(bizName)}</td>
              <td style="max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(dest || '')}">${escapeHtml(dest || '—')}</td>
              <td>${isGoogle ? (on ? '<span class="badge active">ON</span>' : '<span class="badge inactive">OFF</span>') : '<span style="color:#666;">N/A (non-Google)</span>'}</td>
              <td>
                <div style="display:flex; flex-wrap:wrap; gap:6px;">
                  ${isGoogle ? `<button class="btn-small" onclick="toggleAdminSuggestions('${c.publicCardId}', ${!on})">${on ? 'Turn Off' : 'Turn On'}</button>` : ''}
                  ${isGoogle ? `<button class="btn-small edit-admin-prompts-btn" data-card-id="${escapeHtml(c.publicCardId)}" data-prompts="${escapeHtml(JSON.stringify(prompts))}">Edit 5 Prompts</button>` : ''}
                </div>
              </td>
            </tr>`;
    }));

    const customers = await db.getCustomers();
    const customerRows = await Promise.all(customers.map(async cu => {
      const custOrders = await db.getOrdersByCustomer(cu.id);
      const custCards = await db.getCardsByCustomer(cu.id);
      return `<tr>
              <td>${escapeHtml(cu.name)}</td>
              <td>${escapeHtml(cu.email)}</td>
              <td>${new Date(cu.createdAt).toLocaleDateString()}</td>
              <td>${custOrders.length}</td>
              <td>${custCards.length}</td>
              <td><button class="btn-small" onclick="adminResetPassword('${escapeHtml(cu.id)}', '${escapeHtml(cu.email)}')">Reset Password</button></td>
            </tr>`;
    }));

    const orders = await db.getOrders();
    const orderRows = await Promise.all(orders.slice().reverse().map(async o => {
      const cust = await db.getCustomerById(o.customerId);
      const name = cust ? cust.name : (o.checkout ? o.checkout.name : '—');
      const bizName = cust ? '' : (o.checkout ? o.checkout.businessName : '');
      const email = cust ? cust.email : (o.checkout ? o.checkout.email : '—');
      const phone = o.checkout && o.checkout.phone ? o.checkout.phone : '—';
      const statusClass = o.paymentStatus === 'PAID' ? 'active' : (o.paymentStatus === 'FAILED' ? 'inactive' : '');
      const statusStyle = o.paymentStatus === 'PENDING_PAYMENT' ? 'style="background:rgba(255,180,60,.15); color:#e0a03c; border:1px solid rgba(255,180,60,.35);"' : '';
      return `<tr>
              <td><code>${o.id}</code></td>
              <td>${escapeHtml(name)}${bizName ? ' · ' + escapeHtml(bizName) : ''}</td>
              <td style="font-size:12px;">${escapeHtml(email)}<br/>${escapeHtml(phone)}</td>
              <td>${o.plan}</td>
              <td>${o.quantity}</td>
              <td>₹${Number(o.amount).toLocaleString('en-IN')}</td>
              <td><span class="badge ${statusClass}" ${statusStyle}>${o.paymentStatus}</span></td>
              <td>${new Date(o.createdAt).toLocaleDateString()}</td>
              <td>${o.paymentStatus === 'PENDING_PAYMENT' ? `<button class="btn-small" onclick="confirmPayment('${o.id}')">Confirm Payment</button>` : (o.cardsGenerated ? `${o.quantity} cards created` : '—')}</td>
            </tr>`;
    }));

    const body = `
  <div class="container" style="padding:40px 24px 80px;">
    <h1 style="letter-spacing:.5px;">Admin — Tap2Review</h1>

    <div class="panel">
      <h2>Manage a Card</h2>
      <label>Select Card</label>
      <select id="cardJumpSelect">${cardOptions.join('')}</select>
      <button class="btn-small" onclick="jumpToCard()">View Selected Card</button>
    </div>

    <div class="panel">
      <h2>Create Business</h2>
      <form onsubmit="createBusiness(event)">
        <label>Business Name</label>
        <input name="name" required placeholder="The Daily Bean"/>
        <label>Google Review URL</label>
        <input name="reviewUrl" required placeholder="https://g.page/example/review"/>
        <button class="btn-small" type="submit">Create Business</button>
      </form>
    </div>

    <div class="panel">
      <h2>Create Card</h2>
      <form onsubmit="createCard(event)">
        <label>Business</label>
        <select name="businessId" required>${bizOptions}</select>
        <button class="btn-small" type="submit">Create Card</button>
      </form>
    </div>

    <div class="panel">
      <h2>Edit Business Profile (Name)</h2>
      <form onsubmit="updateProfile(event)">
        <label>Business</label>
        <select name="businessId" required>${bizOptions}</select>
        <label>New Name</label>
        <input name="name" placeholder="Leave blank to keep current"/>
        <button class="btn-small" type="submit">Update Profile</button>
      </form>
    </div>

    <div class="panel">
      <h2>Change Card Destination</h2>
      <p style="color:var(--gray); font-size:13px; margin-top:-6px;">Overrides where a specific card redirects, independent of its business's default. Leave blank to clear the override.</p>
      <form onsubmit="updateCardDestination(event)">
        <label>Card</label>
        <select name="cardId" required>${cardOptions.join('')}</select>
        <label>New Destination URL</label>
        <input name="destinationUrl" placeholder="https://instagram.com/yourbusiness"/>
        <button class="btn-small" type="submit">Update Destination</button>
      </form>
    </div>

    <div class="panel">
      <h2>Cards</h2>
      <table>
        <thead><tr><th>Business</th><th>Card ID</th><th>Status</th><th>Homepage</th><th>Permanent Redirect URL</th><th>Current Destination</th><th>Actions</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>

    <div class="panel">
      <h2>Review Suggestions (All Cards)</h2>
      <p style="color:var(--gray); font-size:13px; margin-top:-6px;">
        Admin-only. Applies to every card — including customer-purchased ones. Only relevant when a card's destination is a Google Review URL; non-Google cards always redirect directly regardless of this setting.
      </p>
      <table>
        <thead><tr><th>Card ID</th><th>Business Name</th><th>Destination</th><th>Suggestions</th><th>Actions</th></tr></thead>
        <tbody>
          ${suggRows.join('') || '<tr><td colspan="5" style="color:var(--gray);">No cards yet.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="panel">
      <h2>Customers (${customers.length})</h2>
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Orders</th><th>Cards</th><th>Actions</th></tr></thead>
        <tbody>
          ${customerRows.join('') || '<tr><td colspan="6" style="color:var(--gray);">No customers yet.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="panel">
      <h2>Orders (${orders.length})</h2>
      <table>
        <thead><tr><th>Order ID</th><th>Customer / Business</th><th>Contact</th><th>Plan</th><th>Qty</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          ${orderRows.join('') || '<tr><td colspan="9" style="color:var(--gray);">No orders yet.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
  <script src="/js/admin.js"></script>

  <div id="adminPromptsModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:100; align-items:center; justify-content:center;">
    <div class="panel" style="max-width:440px; width:90%; margin:0;">
      <h2>Review Suggestions — 5 Prompts <span id="adminPromptsCardIdLabel" style="color:var(--gold);"></span></h2>
      <p style="color:var(--gray); font-size:12px; margin-top:-6px;">All 5 are required. Customers pick one, copy it, then continue to Google themselves — nothing is ever posted automatically.</p>
      <label>Prompt 1</label><input id="adminPrompt0" maxlength="150"/>
      <label>Prompt 2</label><input id="adminPrompt1" maxlength="150"/>
      <label>Prompt 3</label><input id="adminPrompt2" maxlength="150"/>
      <label>Prompt 4</label><input id="adminPrompt3" maxlength="150"/>
      <label>Prompt 5</label><input id="adminPrompt4" maxlength="150"/>
      <div style="display:flex; gap:8px; margin-top:6px;">
        <button class="btn-small" style="flex:1;" onclick="saveAdminPrompts()">Save 5 Prompts</button>
        <button class="btn-small" style="flex:1; background:transparent; border:1px solid var(--line); color:var(--white);" onclick="closeAdminPromptsModal()">Cancel</button>
      </div>
    </div>
  </div>
  `;
    res.send(page({ title: 'Admin — Tap2Review', body }));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Server-side enforcement (not just UI hiding): admin card actions must never
// be able to touch a customer-purchased card, even if someone calls the API
// directly with a known customer card ID. Customer cards are managed
// exclusively through the customer's own dashboard (with its own ownership
// checks — see ownedCardOr403 above).
async function adminOwnedCardOr403(cardId, res) {
  const card = await db.getCardByPublicId(cardId);
  if (!card) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  if (card.customerId) {
    res.status(403).json({ error: 'This card belongs to a customer and cannot be managed from Admin.' });
    return null;
  }
  return card;
}

// Payment confirmation is ADMIN-ONLY (requireAuth = admin Basic Auth).
// Cards/customer/business are only ever created here — never from a
// customer-facing route, and never before this is explicitly clicked.
// Idempotent: fulfillPaidOrder() no-ops if cardsGenerated is already true,
// so double-clicking "Confirm Payment" cannot create duplicate cards.
app.post('/admin/api/order/:orderId/confirm-payment', requireAuth, async (req, res) => {
  const order = await db.getOrderById(req.params.orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!order.checkout) return res.status(400).json({ error: 'This order has no checkout details to fulfill (legacy order).' });

  await db.markOrderPaid(order.id, 'MANUAL-WHATSAPP-' + Date.now());
  const { customer, cards } = await fulfillPaidOrder(await db.getOrderById(order.id));
  res.json({ orderId: order.id, customerId: customer.id, cardsCreated: cards.length });
});

app.post('/admin/api/card/primary', requireAuth, async (req, res) => {
  const { cardId } = req.body;
  if (!(await adminOwnedCardOr403(cardId, res))) return;
  const card = await db.setPrimaryCard(cardId);
  if (!card) return res.status(404).json({ error: 'Not found' });
  res.json(card);
});

// ---- Review Suggestions: ADMIN-ONLY (requireAuth = admin Basic Auth).
// Applies to all cards (including customer-purchased ones) as displayed in the
// Admin 'Review Suggestions (All Cards)' panel. Customers cannot modify suggestions. ----
app.post('/admin/api/card/:cardId/suggestions', requireAuth, async (req, res) => {
  const card = await db.getCardByPublicId(req.params.cardId);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  const dest = await db.resolveDestination(card);
  if (req.body.enabled && !db.isGoogleReviewDestination(dest)) {
    return res.status(400).json({ error: 'Review Suggestions only apply to Google Review destinations.' });
  }
  res.json(await db.setCardReviewSuggestions(card.publicCardId, !!req.body.enabled));
});

app.post('/admin/api/card/:cardId/prompts', requireAuth, async (req, res) => {
  const card = await db.getCardByPublicId(req.params.cardId);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  const dest = await db.resolveDestination(card);
  if (!db.isGoogleReviewDestination(dest)) {
    return res.status(400).json({ error: 'Review Suggestions only apply to Google Review destinations.' });
  }
  const prompts = Array.isArray(req.body.prompts) ? req.body.prompts.map(p => String(p).trim()).filter(Boolean) : [];
  if (prompts.length !== 5) {
    return res.status(400).json({ error: 'Exactly 5 prompts are required.' });
  }
  if (prompts.some(p => p.length > 150)) {
    return res.status(400).json({ error: 'Each prompt must be 150 characters or fewer.' });
  }
  res.json(await db.setCardReviewPrompts(card.publicCardId, prompts));
});

app.post('/admin/api/business', requireAuth, async (req, res) => {
  const { name, reviewUrl } = req.body;
  if (!name || !reviewUrl || !isValidHttpUrl(reviewUrl)) return res.status(400).json({ error: 'Invalid input' });
  const biz = await db.createBusiness({ name, reviewUrl });
  res.json(biz);
});

app.post('/admin/api/business/profile', requireAuth, async (req, res) => {
  const { businessId, name } = req.body;
  if (!businessId) return res.status(400).json({ error: 'Invalid input' });
  const biz = await db.getBusiness(businessId);
  if (!biz) return res.status(404).json({ error: 'Not found' });
  if (biz.ownerId) return res.status(403).json({ error: 'This business belongs to a customer and cannot be managed from Admin.' });
  const updated = await db.updateBusinessProfile(businessId, { name: name || undefined });
  res.json(updated);
});

app.post('/admin/api/card', requireAuth, async (req, res) => {
  const { businessId } = req.body;
  const biz = await db.getBusiness(businessId);
  if (!biz) return res.status(400).json({ error: 'Invalid business' });
  if (biz.ownerId) return res.status(403).json({ error: 'Cannot create admin cards under a customer-owned business.' });
  const card = await db.createCard({ businessId });
  res.json(card);
});

app.post('/admin/api/card/status', requireAuth, async (req, res) => {
  const { cardId, status } = req.body;
  if (!['ACTIVE', 'INACTIVE'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (!(await adminOwnedCardOr403(cardId, res))) return;
  const card = await db.setCardStatus(cardId, status);
  if (!card) return res.status(404).json({ error: 'Not found' });
  res.json(card);
});

app.post('/admin/api/card/destination', requireAuth, async (req, res) => {
  const { cardId, destinationUrl } = req.body;
  if (!cardId) return res.status(400).json({ error: 'Missing cardId' });
  if (!(await adminOwnedCardOr403(cardId, res))) return;
  // Allow clearing the override (empty string) to fall back to business default
  if (destinationUrl && !isValidHttpUrl(destinationUrl)) return res.status(400).json({ error: 'Invalid URL' });
  const card = await db.setCardDestination(cardId, destinationUrl);
  if (!card) return res.status(404).json({ error: 'Not found' });
  res.json(card);
});

// ─── Admin: Reset Customer Password ──────────────────────────────────────────
app.post('/admin/api/customer/:customerId/reset-password', requireAuth, async (req, res) => {
  const { customerId } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const passwordHash = await hashPassword(newPassword);
  const customer = await db.updateCustomerPassword(customerId, passwordHash);
  if (!customer) return res.status(404).json({ error: 'Customer not found.' });
  res.json({ ok: true, email: customer.email });
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

// ================= START (connect to MongoDB first, then listen) =================
// On standard server / local dev: connect and listen.
// On Vercel: Vercel executes the exported Express app as a serverless handler.
if (!process.env.VERCEL) {
  db.connect().then(() => {
    app.listen(PORT, () => {
      console.log(`Tap2Review running at ${BASE_URL}`);
    });
  }).catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
}

module.exports = app;

