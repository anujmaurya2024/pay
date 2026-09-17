const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

function read() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function write(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function genCardId() {
  return 'TR-' + nanoid(6).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
}

function getBusinesses() {
  return read().businesses;
}
function getBusiness(id) {
  return read().businesses.find(b => b.id === id);
}
function createBusiness({ name, reviewUrl, ownerId }) {
  const db = read();
  const biz = {
    id: 'biz_' + nanoid(8),
    name,
    reviewUrl,
    ownerId: ownerId || null, // null = legacy/admin-owned business (backward compatible)
    createdAt: new Date().toISOString(),
  };
  db.businesses.push(biz);
  write(db);
  return biz;
}
function getBusinessesByOwner(ownerId) {
  return read().businesses.filter(b => b.ownerId === ownerId);
}
function updateBusinessProfile(id, { name }) {
  const db = read();
  const biz = db.businesses.find(b => b.id === id);
  if (!biz) return null;
  if (name) biz.name = name;
  write(db);
  return biz;
}

function getCards() {
  return read().cards;
}
function getCardByPublicId(publicCardId) {
  return read().cards.find(c => c.publicCardId === publicCardId);
}
function createCard({ businessId, customerId, orderId, businessName, destinationUrl }) {
  const db = read();
  let publicCardId;
  do {
    publicCardId = genCardId();
  } while (db.cards.some(c => c.publicCardId === publicCardId));
  const isFirstCard = db.cards.length === 0;
  const card = {
    id: 'card_' + nanoid(8),
    publicCardId,
    businessId: businessId || null,
    customerId: customerId || null, // null = legacy/admin-created card (backward compatible)
    orderId: orderId || null,
    businessName: businessName || null, // per-card business name override (new — independent per card)
    status: 'ACTIVE',
    destinationUrl: destinationUrl || null,
    reviewSuggestions: { enabled: false },
    primary: isFirstCard, // first card ever created becomes the homepage/primary card by default
    createdAt: new Date().toISOString(),
  };
  db.cards.push(card);
  write(db);
  return card;
}
function setCardBusinessName(publicCardId, businessName) {
  const db = read();
  const card = db.cards.find(c => c.publicCardId === publicCardId);
  if (!card) return null;
  card.businessName = businessName || null;
  write(db);
  return card;
}
function setCardDetails(publicCardId, { businessName, destinationUrl }) {
  const db = read();
  const card = db.cards.find(c => c.publicCardId === publicCardId);
  if (!card) return null;
  if (businessName !== undefined) card.businessName = businessName || null;
  if (destinationUrl !== undefined) card.destinationUrl = destinationUrl || null;
  write(db);
  return card;
}
// Resolves the display name for a card: per-card override first, then linked
// business name, then a safe fallback. Existing cards created before this
// field existed simply have businessName === undefined/null and fall back
// cleanly to their business — no migration needed, nothing breaks.
function resolveCardBusinessName(card) {
  if (card.businessName) return card.businessName;
  const biz = getBusiness(card.businessId);
  return biz ? biz.name : 'Your Business';
}
function getCardsByCustomer(customerId) {
  return read().cards.filter(c => c.customerId === customerId);
}
function setCardBusiness(publicCardId, businessId) {
  const db = read();
  const card = db.cards.find(c => c.publicCardId === publicCardId);
  if (!card) return null;
  card.businessId = businessId;
  write(db);
  return card;
}
function setCardReviewSuggestions(publicCardId, enabled) {
  const db = read();
  const card = db.cards.find(c => c.publicCardId === publicCardId);
  if (!card) return null;
  // Preserve any custom prompts already set — toggling on/off must not wipe them.
  card.reviewSuggestions = { ...(card.reviewSuggestions || {}), enabled: !!enabled };
  write(db);
  return card;
}
function setCardReviewPrompts(publicCardId, prompts) {
  const db = read();
  const card = db.cards.find(c => c.publicCardId === publicCardId);
  if (!card) return null;
  card.reviewSuggestions = { ...(card.reviewSuggestions || {}), prompts };
  write(db);
  return card;
}
const DEFAULT_REVIEW_PROMPTS = [
  'Amazing service! Highly recommend.',
  'Great experience, will definitely visit again.',
  'Very friendly and professional staff.',
  'Excellent quality and service.',
  'Loved it — five stars!',
];
// Returns this card's own custom prompts if it has exactly 5 valid ones,
// otherwise falls back to the universal defaults — nothing breaks for
// existing/legacy cards that predate this feature.
function getCardReviewPrompts(card) {
  const prompts = card.reviewSuggestions && Array.isArray(card.reviewSuggestions.prompts)
    ? card.reviewSuggestions.prompts.filter(p => typeof p === 'string' && p.trim())
    : [];
  return prompts.length === 5 ? prompts : DEFAULT_REVIEW_PROMPTS;
}
function setPrimaryCard(publicCardId) {
  const db = read();
  const target = db.cards.find(c => c.publicCardId === publicCardId);
  if (!target) return null;
  db.cards.forEach(c => { c.primary = false; });
  target.primary = true;
  write(db);
  return target;
}
function getPrimaryCard() {
  const db = read();
  let primary = db.cards.find(c => c.primary === true && c.status === 'ACTIVE');
  if (primary) return primary;
  primary = db.cards.find(c => c.status === 'ACTIVE');
  if (primary) return primary;
  return db.cards[0] || null;
}
function setCardStatus(publicCardId, status) {
  const db = read();
  const card = db.cards.find(c => c.publicCardId === publicCardId);
  if (!card) return null;
  card.status = status;
  write(db);
  return card;
}
function setCardDestination(publicCardId, destinationUrl) {
  const db = read();
  const card = db.cards.find(c => c.publicCardId === publicCardId);
  if (!card) return null;
  card.destinationUrl = destinationUrl || null;
  write(db);
  return card;
}

function resolveDestination(card) {
  if (card.destinationUrl) return card.destinationUrl;
  const biz = getBusiness(card.businessId);
  return biz ? biz.reviewUrl : null;
}
function isGoogleReviewDestination(url) {
  if (!url) return false;
  return /google\.com|g\.page|goo\.gl\/maps/i.test(url);
}

// ---------------- CUSTOMERS ----------------
function getCustomerByEmail(email) {
  return read().customers.find(c => c.email.toLowerCase() === String(email).toLowerCase());
}
function getCustomerById(id) {
  return read().customers.find(c => c.id === id);
}
function createCustomer({ name, email, passwordHash }) {
  const db = read();
  const customer = {
    id: 'cust_' + nanoid(10),
    name,
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  db.customers.push(customer);
  write(db);
  return customer;
}

// ---------------- ORDERS ----------------
// createOrder now supports a PENDING state for real payment gateways: the
// order is created BEFORE payment, cards are only generated after
// markOrderPaid() confirms verified payment (idempotent — see below).
function createOrder({ customerId, quantity, amount, plan, paymentStatus, checkout }) {
  const db = read();
  const order = {
    id: 'order_' + nanoid(8),
    customerId: customerId || null,
    quantity,
    amount,
    plan,
    paymentStatus: paymentStatus || 'PAID', // 'PENDING' | 'PAID' | 'FAILED'
    paytmTxnId: null,
    cardsGenerated: false,
    // Checkout details captured before payment, used to create the account
    // only once payment is verified. Password is stored already-hashed.
    checkout: checkout || null,
    createdAt: new Date().toISOString(),
  };
  db.orders.push(order);
  write(db);
  return order;
}
function getOrderById(id) {
  return read().orders.find(o => o.id === id);
}
// Idempotent: if this order was already marked PAID (e.g. Paytm retries the
// callback/webhook), do nothing and just return the existing order untouched.
function markOrderPaid(orderId, paytmTxnId) {
  const db = read();
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return null;
  if (order.paymentStatus === 'PAID') return order; // already processed — idempotent no-op
  order.paymentStatus = 'PAID';
  order.paytmTxnId = paytmTxnId || null;
  write(db);
  return order;
}
function markOrderFailed(orderId) {
  const db = read();
  const order = db.orders.find(o => o.id === orderId);
  if (!order || order.paymentStatus === 'PAID') return order || null; // never downgrade a paid order
  order.paymentStatus = 'FAILED';
  write(db);
  return order;
}
function markOrderCardsGenerated(orderId) {
  const db = read();
  const order = db.orders.find(o => o.id === orderId);
  if (!order) return null;
  order.cardsGenerated = true;
  write(db);
  return order;
}
function getOrders() {
  return read().orders;
}
function getOrdersByCustomer(customerId) {
  return read().orders.filter(o => o.customerId === customerId);
}
function getCustomers() {
  return read().customers;
}

module.exports = {
  getBusinesses, getBusiness, createBusiness, updateBusinessProfile, getBusinessesByOwner,
  getCards, getCardByPublicId, createCard, setCardStatus, setCardDestination,
  setPrimaryCard, getPrimaryCard, getCardsByCustomer, setCardBusiness, setCardReviewSuggestions,
  setCardReviewPrompts, getCardReviewPrompts, DEFAULT_REVIEW_PROMPTS,
  setCardBusinessName, setCardDetails, resolveCardBusinessName,
  resolveDestination, isGoogleReviewDestination,
  getCustomerByEmail, getCustomerById, createCustomer, getCustomers,
  createOrder, getOrders, getOrdersByCustomer, getOrderById,
  markOrderPaid, markOrderFailed, markOrderCardsGenerated,
};
