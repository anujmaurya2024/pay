const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

// ─── Connect ────────────────────────────────────────────────────────────────
// Called once from server.js before app.listen().
async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in .env');
  await mongoose.connect(uri);
  console.log('✅ MongoDB connected');
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
// We keep the custom `id` string fields (e.g. "biz_xxx", "card_xxx") as the
// logical application IDs. Mongoose's _id is unused for lookup — all queries
// go through these string ids — so existing data migrates with zero ID changes.

const businessSchema = new mongoose.Schema({
  id:        { type: String, required: true, unique: true, index: true },
  name:      { type: String, required: true },
  reviewUrl: { type: String, default: '' },
  ownerId:   { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() },
}, { _id: true, versionKey: false });

const cardSchema = new mongoose.Schema({
  id:            { type: String, required: true, unique: true, index: true },
  publicCardId:  { type: String, required: true, unique: true, index: true },
  businessId:    { type: String, default: null },
  customerId:    { type: String, default: null },
  orderId:       { type: String, default: null },
  businessName:  { type: String, default: null },
  status:        { type: String, default: 'ACTIVE' },
  destinationUrl:{ type: String, default: null },
  reviewSuggestions: {
    enabled: { type: Boolean, default: false },
    prompts:  { type: [String], default: undefined },
  },
  primary:   { type: Boolean, default: false },
  createdAt: { type: String, default: () => new Date().toISOString() },
}, { _id: true, versionKey: false });

const customerSchema = new mongoose.Schema({
  id:           { type: String, required: true, unique: true, index: true },
  name:         { type: String, required: true },
  email:        { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  createdAt:    { type: String, default: () => new Date().toISOString() },
}, { _id: true, versionKey: false });

const orderSchema = new mongoose.Schema({
  id:            { type: String, required: true, unique: true, index: true },
  customerId:    { type: String, default: null },
  quantity:      { type: Number, required: true },
  amount:        { type: Number, required: true },
  plan:          { type: String, required: true },
  paymentStatus: { type: String, default: 'PAID' },
  paytmTxnId:    { type: String, default: null },
  cardsGenerated:{ type: Boolean, default: false },
  checkout:      { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt:     { type: String, default: () => new Date().toISOString() },
}, { _id: true, versionKey: false });

// Guard against model re-registration (e.g. during hot-reload)
const Business = mongoose.models.Business || mongoose.model('Business', businessSchema);
const Card     = mongoose.models.Card     || mongoose.model('Card',     cardSchema);
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
const Order    = mongoose.models.Order    || mongoose.model('Order',    orderSchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function genCardId() {
  return 'TR-' + nanoid(6).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
}

// Lean documents (plain JS objects) are returned everywhere so callers
// can access properties directly — no .toObject() needed downstream.

// ─── BUSINESSES ──────────────────────────────────────────────────────────────
async function getBusinesses() {
  return Business.find().lean();
}
async function getBusiness(id) {
  if (!id) return null;
  return Business.findOne({ id }).lean();
}
async function createBusiness({ name, reviewUrl, ownerId }) {
  const biz = await Business.create({
    id: 'biz_' + nanoid(8),
    name,
    reviewUrl: reviewUrl || '',
    ownerId: ownerId || null,
    createdAt: new Date().toISOString(),
  });
  return biz.toObject();
}
async function getBusinessesByOwner(ownerId) {
  return Business.find({ ownerId }).lean();
}
async function updateBusinessProfile(id, { name }) {
  const biz = await Business.findOneAndUpdate(
    { id },
    { ...(name ? { name } : {}) },
    { new: true }
  ).lean();
  return biz;
}

// ─── CARDS ───────────────────────────────────────────────────────────────────
async function getCards() {
  return Card.find().lean();
}
async function getCardByPublicId(publicCardId) {
  return Card.findOne({ publicCardId }).lean();
}
async function createCard({ businessId, customerId, orderId, businessName, destinationUrl }) {
  // Ensure publicCardId is unique
  let publicCardId;
  do {
    publicCardId = genCardId();
  } while (await Card.exists({ publicCardId }));

  const isFirstCard = (await Card.countDocuments()) === 0;
  const card = await Card.create({
    id: 'card_' + nanoid(8),
    publicCardId,
    businessId: businessId || null,
    customerId: customerId || null,
    orderId: orderId || null,
    businessName: businessName || null,
    status: 'ACTIVE',
    destinationUrl: destinationUrl || null,
    reviewSuggestions: { enabled: false },
    primary: isFirstCard,
    createdAt: new Date().toISOString(),
  });
  return card.toObject();
}
async function setCardBusinessName(publicCardId, businessName) {
  return Card.findOneAndUpdate(
    { publicCardId },
    { businessName: businessName || null },
    { new: true }
  ).lean();
}
async function setCardDetails(publicCardId, { businessName, destinationUrl }) {
  const update = {};
  if (businessName !== undefined) update.businessName = businessName || null;
  if (destinationUrl !== undefined) update.destinationUrl = destinationUrl || null;
  return Card.findOneAndUpdate({ publicCardId }, update, { new: true }).lean();
}
// Resolves the display name for a card: per-card override first, then linked
// business name, then a safe fallback.
async function resolveCardBusinessName(card) {
  if (card.businessName) return card.businessName;
  const biz = await getBusiness(card.businessId);
  return biz ? biz.name : 'Your Business';
}
async function getCardsByCustomer(customerId) {
  return Card.find({ customerId }).lean();
}
async function setCardBusiness(publicCardId, businessId) {
  return Card.findOneAndUpdate({ publicCardId }, { businessId }, { new: true }).lean();
}
async function setCardReviewSuggestions(publicCardId, enabled) {
  // Preserve any custom prompts already set.
  const card = await Card.findOne({ publicCardId }).lean();
  if (!card) return null;
  const existing = card.reviewSuggestions || {};
  return Card.findOneAndUpdate(
    { publicCardId },
    { reviewSuggestions: { ...existing, enabled: !!enabled } },
    { new: true }
  ).lean();
}
async function setCardReviewPrompts(publicCardId, prompts) {
  const card = await Card.findOne({ publicCardId }).lean();
  if (!card) return null;
  const existing = card.reviewSuggestions || {};
  return Card.findOneAndUpdate(
    { publicCardId },
    { reviewSuggestions: { ...existing, prompts } },
    { new: true }
  ).lean();
}
const DEFAULT_REVIEW_PROMPTS = [
  'Amazing service! Highly recommend.',
  'Great experience, will definitely visit again.',
  'Very friendly and professional staff.',
  'Excellent quality and service.',
  'Loved it — five stars!',
];
// Returns this card's own custom prompts if it has exactly 5 valid ones,
// otherwise falls back to the universal defaults.
function getCardReviewPrompts(card) {
  const prompts = card.reviewSuggestions && Array.isArray(card.reviewSuggestions.prompts)
    ? card.reviewSuggestions.prompts.filter(p => typeof p === 'string' && p.trim())
    : [];
  return prompts.length === 5 ? prompts : DEFAULT_REVIEW_PROMPTS;
}
async function setPrimaryCard(publicCardId) {
  const target = await Card.findOne({ publicCardId }).lean();
  if (!target) return null;
  // Clear primary on all cards, then set on the target
  await Card.updateMany({}, { primary: false });
  return Card.findOneAndUpdate({ publicCardId }, { primary: true }, { new: true }).lean();
}
async function getPrimaryCard() {
  let primary = await Card.findOne({ primary: true, status: 'ACTIVE' }).lean();
  if (primary) return primary;
  primary = await Card.findOne({ status: 'ACTIVE' }).lean();
  if (primary) return primary;
  return Card.findOne().lean();
}
async function setCardStatus(publicCardId, status) {
  return Card.findOneAndUpdate({ publicCardId }, { status }, { new: true }).lean();
}
async function setCardDestination(publicCardId, destinationUrl) {
  return Card.findOneAndUpdate(
    { publicCardId },
    { destinationUrl: destinationUrl || null },
    { new: true }
  ).lean();
}

// ─── Destination helpers ─────────────────────────────────────────────────────
async function resolveDestination(card) {
  if (card.destinationUrl) return card.destinationUrl;
  const biz = await getBusiness(card.businessId);
  return biz ? biz.reviewUrl : null;
}
function isGoogleReviewDestination(url) {
  if (!url) return false;
  return /google\.com|g\.page|goo\.gl\/maps/i.test(url);
}

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────
async function getCustomerByEmail(email) {
  if (!email) return null;
  const cleaned = String(email).trim();
  return Customer.findOne({
    email: { $regex: new RegExp(`^${cleaned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  }).lean();
}
async function getCustomerById(id) {
  if (!id) return null;
  return Customer.findOne({ id }).lean();
}
async function createCustomer({ name, email, passwordHash }) {
  const customer = await Customer.create({
    id: 'cust_' + nanoid(10),
    name: String(name || '').trim(),
    email: String(email || '').trim().toLowerCase(),
    passwordHash,
    createdAt: new Date().toISOString(),
  });
  return customer.toObject();
}
async function getCustomers() {
  return Customer.find().lean();
}
async function updateCustomerPassword(id, passwordHash) {
  return Customer.findOneAndUpdate({ id }, { passwordHash }, { new: true }).lean();
}

// ─── ORDERS ──────────────────────────────────────────────────────────────────
// createOrder supports a PENDING state for real payment gateways: the
// order is created BEFORE payment, cards are only generated after
// markOrderPaid() confirms verified payment (idempotent).
async function createOrder({ customerId, quantity, amount, plan, paymentStatus, checkout }) {
  const order = await Order.create({
    id: 'order_' + nanoid(8),
    customerId: customerId || null,
    quantity,
    amount,
    plan,
    paymentStatus: paymentStatus || 'PAID',
    paytmTxnId: null,
    cardsGenerated: false,
    checkout: checkout || null,
    createdAt: new Date().toISOString(),
  });
  return order.toObject();
}
async function getOrderById(id) {
  return Order.findOne({ id }).lean();
}
// Idempotent: if this order was already marked PAID (e.g. Paytm retries the
// callback/webhook), do nothing and just return the existing order untouched.
async function markOrderPaid(orderId, paytmTxnId) {
  const order = await Order.findOne({ id: orderId }).lean();
  if (!order) return null;
  if (order.paymentStatus === 'PAID') return order; // already processed — idempotent no-op
  return Order.findOneAndUpdate(
    { id: orderId },
    { paymentStatus: 'PAID', paytmTxnId: paytmTxnId || null },
    { new: true }
  ).lean();
}
async function markOrderFailed(orderId) {
  const order = await Order.findOne({ id: orderId }).lean();
  if (!order || order.paymentStatus === 'PAID') return order || null; // never downgrade a paid order
  return Order.findOneAndUpdate({ id: orderId }, { paymentStatus: 'FAILED' }, { new: true }).lean();
}
async function markOrderCardsGenerated(orderId) {
  return Order.findOneAndUpdate({ id: orderId }, { cardsGenerated: true }, { new: true }).lean();
}
async function setOrderCustomerId(orderId, customerId) {
  return Order.findOneAndUpdate({ id: orderId }, { customerId }, { new: true }).lean();
}
async function getOrders() {
  return Order.find().lean();
}
async function getOrdersByCustomer(customerId) {
  return Order.find({ customerId }).lean();
}

module.exports = {
  connect, isConnected,
  getBusinesses, getBusiness, createBusiness, updateBusinessProfile, getBusinessesByOwner,
  getCards, getCardByPublicId, createCard, setCardStatus, setCardDestination,
  setPrimaryCard, getPrimaryCard, getCardsByCustomer, setCardBusiness, setCardReviewSuggestions,
  setCardReviewPrompts, getCardReviewPrompts, DEFAULT_REVIEW_PROMPTS,
  setCardBusinessName, setCardDetails, resolveCardBusinessName,
  resolveDestination, isGoogleReviewDestination,
  getCustomerByEmail, getCustomerById, createCustomer, getCustomers, updateCustomerPassword,
  createOrder, getOrders, getOrdersByCustomer, getOrderById,
  markOrderPaid, markOrderFailed, markOrderCardsGenerated, setOrderCustomerId,
};
