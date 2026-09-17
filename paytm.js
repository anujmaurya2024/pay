/**
 * Paytm Payment Gateway integration.
 *
 * Uses Paytm's official "paytmchecksum" library for signature generation/
 * verification, and Paytm's Transaction Status API for server-side
 * confirmation — never trusts the browser-side callback alone.
 *
 * Configuration is read entirely from environment variables (.env).
 * No credentials are ever hardcoded here.
 *
 * Required env vars for the real gateway to activate:
 *   PAYTM_MID            - Merchant ID
 *   PAYTM_MERCHANT_KEY   - Merchant Key (secret — never expose to frontend)
 *   PAYTM_WEBSITE        - "WEBSTAGING" for testing, your live website name in production
 *   PAYTM_CHANNEL_ID     - usually "WEB"
 *   PAYTM_CALLBACK_URL   - e.g. https://tap2review.in/api/payment/callback
 *   PAYTM_ENV            - "STAGING" or "PRODUCTION" (defaults to STAGING)
 *
 * ⚠️ IMPORTANT — HONEST LIMITATION: this code follows Paytm's documented
 * Node.js integration exactly (initiateTransaction → showPaymentPage →
 * callback → verify checksum → Transaction Status API → activate order),
 * but it has NOT been exercised against Paytm's live/staging servers in
 * this environment, because outbound network access here is restricted to
 * package registries only (no route to paytm.in). The checksum generation
 * and verification logic (pure crypto, no network) has been unit-tested
 * directly — see test output in the implementation report. Before going
 * live, run a real staging transaction end-to-end from an environment that
 * can reach Paytm's servers.
 *
 * If PAYTM_MID/PAYTM_MERCHANT_KEY/PAYTM_CALLBACK_URL are not set, the app
 * falls back to the previous dev-only simulated payment (clearly labeled
 * on-screen) so local development still works without real credentials.
 */

const PaytmChecksum = require('paytmchecksum');

const PAYTM_MID = process.env.PAYTM_MID || '';
const PAYTM_MERCHANT_KEY = process.env.PAYTM_MERCHANT_KEY || '';
const PAYTM_WEBSITE = process.env.PAYTM_WEBSITE || 'WEBSTAGING';
const PAYTM_CHANNEL_ID = process.env.PAYTM_CHANNEL_ID || 'WEB';
const PAYTM_INDUSTRY_TYPE_ID = process.env.PAYTM_INDUSTRY_TYPE_ID || 'Retail';
const PAYTM_CALLBACK_URL = process.env.PAYTM_CALLBACK_URL || '';
const PAYTM_ENV = (process.env.PAYTM_ENV || 'STAGING').toUpperCase();

const isConfigured = Boolean(PAYTM_MID && PAYTM_MERCHANT_KEY && PAYTM_CALLBACK_URL);

function baseUrl() {
  return PAYTM_ENV === 'PRODUCTION' ? 'https://securegw.paytm.in' : 'https://securegw-stage.paytm.in';
}

// Step 1: ask Paytm for a txnToken for this order (server-to-server, signed).
async function initiateTransaction({ orderId, amount, custId, email }) {
  const body = {
    requestType: 'Payment',
    mid: PAYTM_MID,
    websiteName: PAYTM_WEBSITE,
    orderId,
    callbackUrl: PAYTM_CALLBACK_URL,
    txnAmount: { value: Number(amount).toFixed(2), currency: 'INR' },
    userInfo: { custId, email },
  };
  const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), PAYTM_MERCHANT_KEY);
  const paytmParams = { body, head: { signature } };

  const url = `${baseUrl()}/theia/api/v1/initiateTransaction?mid=${PAYTM_MID}&orderId=${orderId}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paytmParams),
  });
  const data = await resp.json();
  if (!data.body || data.body.resultInfo.resultStatus !== 'S') {
    throw new Error('Paytm initiateTransaction failed: ' + JSON.stringify(data));
  }
  return {
    txnToken: data.body.txnToken,
    paymentPageUrl: `${baseUrl()}/theia/api/v1/showPaymentPage?mid=${PAYTM_MID}&orderId=${orderId}`,
  };
}

// Step 2 (callback): verify the checksum Paytm sent back BEFORE trusting anything in the payload.
async function verifyCallbackChecksum(callbackBody) {
  const received = callbackBody.CHECKSUMHASH;
  if (!received) return false;
  const withoutChecksum = { ...callbackBody };
  delete withoutChecksum.CHECKSUMHASH;
  return PaytmChecksum.verifySignature(withoutChecksum, PAYTM_MERCHANT_KEY, received);
}

// Step 3 (callback): independently ask Paytm's server for the real transaction
// status — never rely solely on the callback payload, which could be replayed.
async function checkTransactionStatus(orderId) {
  const body = { mid: PAYTM_MID, orderId };
  const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), PAYTM_MERCHANT_KEY);
  const paytmParams = { body, head: { signature } };
  const url = `${baseUrl()}/v3/order/status`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paytmParams),
  });
  return resp.json(); // data.body.resultInfo.resultStatus === 'TXN_SUCCESS' on success
}

module.exports = {
  isConfigured,
  PAYTM_CHANNEL_ID,
  PAYTM_INDUSTRY_TYPE_ID,
  initiateTransaction,
  verifyCallbackChecksum,
  checkTransactionStatus,
};
