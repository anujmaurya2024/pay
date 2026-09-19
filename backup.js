/**
 * backup.js — Exports all live records from MongoDB Atlas to a JSON backup file.
 *
 * Usage:
 *   node backup.js
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

async function main() {
  console.log('🔌 Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

  const Business = mongoose.models.Business || mongoose.model('Business', new mongoose.Schema({}, { strict: false }));
  const Card = mongoose.models.Card || mongoose.model('Card', new mongoose.Schema({}, { strict: false }));
  const Customer = mongoose.models.Customer || mongoose.model('Customer', new mongoose.Schema({}, { strict: false }));
  const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({}, { strict: false }));

  console.log('📦 Fetching records…');
  const businesses = await Business.find({}, { _id: 0 }).lean();
  const cards = await Card.find({}, { _id: 0 }).lean();
  const customers = await Customer.find({}, { _id: 0 }).lean();
  const orders = await Order.find({}, { _id: 0 }).lean();

  const data = {
    backupDate: new Date().toISOString(),
    businesses,
    cards,
    customers,
    orders,
  };

  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const timestampedPath = path.join(dataDir, `backup-${timestamp}.json`);
  const latestPath = path.join(dataDir, 'db.backup.json');

  fs.writeFileSync(timestampedPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.writeFileSync(latestPath, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`✅ Backup successful!`);
  console.log(`   - Businesses: ${businesses.length}`);
  console.log(`   - Cards:      ${cards.length}`);
  console.log(`   - Customers:  ${customers.length}`);
  console.log(`   - Orders:     ${orders.length}`);
  console.log(`\n📁 Saved to:\n   ${timestampedPath}\n   ${latestPath}\n`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌ Backup failed:', err.message);
  process.exit(1);
});
