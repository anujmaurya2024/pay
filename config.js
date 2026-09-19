/**
 * Shared runtime config. Sensitive/business values (like the WhatsApp number)
 * are read from environment variables here, never hardcoded in multiple files.
 */

// Business number for ordering cards and customer checkout
const WHATSAPP_NUMBER = process.env.TAP2REVIEW_WHATSAPP_NUMBER || '918112280082';

// Technical glitch & developer support number
const DEVELOPER_PHONE = '919305178105';

module.exports = { WHATSAPP_NUMBER, DEVELOPER_PHONE };
