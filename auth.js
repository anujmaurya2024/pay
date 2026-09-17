const bcrypt = require('bcryptjs');

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Customer-facing auth — completely separate from the admin Basic-Auth system.
function requireCustomerAuth(req, res, next) {
  if (req.session && req.session.customerId) return next();
  return res.redirect('/login');
}

module.exports = { hashPassword, verifyPassword, requireCustomerAuth };
