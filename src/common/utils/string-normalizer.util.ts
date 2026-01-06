/**
 * String normalization utilities for user input
 */

/**
 * Normalizes email address by converting to lowercase and trimming whitespace
 * @param email - Email address to normalize
 * @returns Normalized email address
 */
export function normalizeEmail(email: string): string {
  if (!email) {
    return email;
  }
  return email.toLowerCase().trim();
}

/**
 * Normalizes phone number by removing whitespace and common separators
 * Keeps the + prefix for international format
 * @param phone - Phone number to normalize
 * @returns Normalized phone number
 */
export function normalizePhone(phone: string): string {
  if (!phone) {
    return phone;
  }
  // Remove all whitespace, hyphens, parentheses, and dots
  // Keep the + prefix if present
  const hasPlus = phone.trim().startsWith('+');
  const cleaned = phone.replace(/[\s\-()\.]/g, '');

  // If original had +, ensure normalized version has it
  if (hasPlus && !cleaned.startsWith('+')) {
    return '+' + cleaned;
  }

  return cleaned;
}
