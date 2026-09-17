/**
 * Payment service abstraction.
 *
 * ⚠️ THIS IS A DEV-ONLY MOCK. No real payment gateway is connected.
 * Nothing here should be treated as production-ready — it exists so the
 * order/card-generation pipeline can be built and tested end-to-end now,
 * and so a real provider (Razorpay/Stripe/etc.) can be dropped in later
 * by replacing verifyPayment() below without touching server.js.
 *
 * A real implementation would:
 *   1. Create an order with the provider (e.g. Razorpay Orders API).
 *   2. Return a client-side checkout handle to the frontend.
 *   3. On the provider's webhook/callback, verify the signature server-side.
 *   4. Only THEN resolve verifyPayment() as successful.
 *
 * Cards/orders in this codebase are only created after verifyPayment()
 * resolves — never based on a frontend-only "success" message.
 */

const PLANS = {
  10: { quantity: 10, amount: 2500 },
  25: { quantity: 25, amount: 5625 },
  50: { quantity: 50, amount: 10000 },
};

function getPlan(planKey) {
  return PLANS[planKey] || null;
}

/**
 * Mock verification — always "succeeds" after a short simulated delay.
 * Replace this function's internals with real gateway verification.
 * Must remain async and must reject/return {verified:false} on failure
 * so callers never create orders/cards for unverified payments.
 */
async function verifyPayment({ planKey, customerEmail }) {
  const plan = getPlan(planKey);
  if (!plan) return { verified: false, reason: 'Invalid plan' };
  // Simulate gateway round-trip latency.
  await new Promise(r => setTimeout(r, 150));
  return {
    verified: true,
    mock: true,
    plan: planKey,
    quantity: plan.quantity,
    amount: plan.amount,
    reference: 'MOCK-' + Date.now(),
  };
}

module.exports = { PLANS, getPlan, verifyPayment };
