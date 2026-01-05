/**
 * Validation constants for authentication
 */

/**
 * Password validation pattern
 * Requires at least:
 * - 1 uppercase letter
 * - 1 lowercase letter
 * - 1 number
 * - 1 special character (@$!%*?&)
 */
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;

/**
 * Password validation error message
 */
export const PASSWORD_VALIDATION_MESSAGE =
  'Password must contain at least 1 uppercase, 1 lowercase, 1 number and 1 special character';

/**
 * Minimum password length
 */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Phone number validation pattern (Vietnamese format)
 * Format: 0xxxxxxxxx (10 digits starting with 0)
 * Valid prefixes: 03, 05, 07, 08, 09
 */
export const PHONE_REGEX = /^0[3|5|7|8|9][0-9]{8}$/;

/**
 * Phone number validation error message
 */
export const PHONE_VALIDATION_MESSAGE =
  'Phone number must be in Vietnamese format: 0xxxxxxxxx (10 digits)';
