/**
 * migrate.js — one-shot script to import all records from data/db.json into MongoDB.
 *
 * Run ONCE after setting MONGODB_URI in .env:
 *   node migrate.js
 *
 * Safe to re-run: uses updateOne with upsert:true, so existing records
 * are updated rather than duplicated.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env');
  process.exit(1);
}

// ── Schemas (same as db.js) ───────────────────────────────────────────────────
const businessSchema = new mongoose.Schema({
  id:        { type: String, required: true, unique: true },
  name:      String,
  reviewUrl: String,
  ownerId:   String,
  createdAt: String,
}, { versionKey: false });

const cardSchema = new mongoose.Schema({
  id:            { type: String, required: true, unique: true },
  publicCardId:  { type: String, required: true, unique: true },
  businessId:    String,
  customerId:    String,
  orderId:       String,
  businessName:  String,
  status:        String,
  destinationUrl:String,
  reviewSuggestions: mongoose.Schema.Types.Mixed,
  primary:       Boolean,
  createdAt:     String,
}, { versionKey: false });

const customerSchema = new mongoose.Schema({
  id:           { type: String, required: true, unique: true },
  name:         String,
  email:        String,
  passwordHash: String,
  createdAt:    String,
}, { versionKey: false });

const orderSchema = new mongoose.Schema({
  id:            { type: String, required: true, unique: true },
  customerId:    String,
  quantity:      Number,
  amount:        Number,
  plan:          String,
  paymentStatus: String,
  paytmTxnId:    String,
  cardsGenerated:Boolean,
  checkout:      mongoose.Schema.Types.Mixed,
  createdAt:     String,
}, { versionKey: false });

const Business = mongoose.model('Business', businessSchema);
const Card     = mongoose.model('Card',     cardSchema);
const Customer = mongoose.model('Customer', customerSchema);
const Order    = mongoose.model('Order',    orderSchema);

async function main() {
  console.log('🔌 Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

  const dbPath = path.join(__dirname, 'data', 'db.json');
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

  // ── Businesses ──────────────────────────────────────────────────────────────
  console.log(`📦 Migrating ${data.businesses.length} businesses…`);
  for (const b of data.businesses) {
    await Business.updateOne({ id: b.id }, { $set: b }, { upsert: true });
  }
  console.log('   ✅ Done\n');

  // ── Customers ───────────────────────────────────────────────────────────────
  console.log(`👤 Migrating ${data.customers.length} customers…`);
  for (const c of data.customers) {
    await Customer.updateOne({ id: c.id }, { $set: c }, { upsert: true });
  }
  console.log('   ✅ Done\n');

  // ── Orders ──────────────────────────────────────────────────────────────────
  console.log(`🛒 Migrating ${data.orders.length} orders…`);
  for (const o of data.orders) {
    await Order.updateOne({ id: o.id }, { $set: o }, { upsert: true });
  }
  console.log('   ✅ Done\n');

  // ── Cards ───────────────────────────────────────────────────────────────────
  console.log(`🃏 Migrating ${data.cards.length} cards…`);
  for (const c of data.cards) {
    await Card.updateOne({ id: c.id }, { $set: c }, { upsert: true });
  }
  console.log('   ✅ Done\n');

  console.log('🎉 Migration complete! All existing data is now in MongoDB.');
  console.log('   You can now run: node server.js\n');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
