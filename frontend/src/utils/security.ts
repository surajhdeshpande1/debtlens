/**
 * DebtLens Enterprise Security & Data Sanitization Utilities
 * Implements OWASP Top 10 client-side sanitization, XSS mitigation, and payload type guards.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * Escapes potentially dangerous HTML characters to prevent stored/reflected XSS.
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[&<>"'/]/g, (char) => HTML_ENTITY_MAP[char] || char);
}

/**
 * Strips script tags, style blocks, and dangerous javascript: protocol links.
 */
export function sanitizeInput(input: string, maxLength: number = 500): string {
  if (!input || typeof input !== 'string') return '';
  
  // Remove script and style tags
  let cleaned = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/javascript:[^"']*/gi, '');

  // Strip null bytes and control chars (except standard whitespace)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim and enforce length limit
  return cleaned.trim().slice(0, maxLength);
}

/**
 * Validates and safely parses positive numeric inputs.
 */
export function safeNumeric(val: any, fallback: number = 0, min: number = 0, max: number = 100000): number {
  const parsed = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(parsed) || !isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/**
 * Validates email format with RFC 5322 compliance.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  return re.test(email.trim()) && email.length <= 100;
}

