/**
 * Shared runtime config. Sensitive/business values (like the WhatsApp number)
 * are read from environment variables here, never hardcoded in multiple files.
 */
const WHATSAPP_NUMBER = process.env.TAP2REVIEW_WHATSAPP_NUMBER || '918112280082';

module.exports = { WHATSAPP_NUMBER };
