/**
 * Input Validation Utility
 * Provides consistent input validation across the application
 */

const InputValidator = (() => {
  /**
   * Validate and sanitize email input
   * @param {string} email - Email to validate
   * @returns {Object} { valid: boolean, value: string, error: string }
   */
  function validateEmail(email) {
    const trimmed = (email || '').trim();

    if (!trimmed) {
      return { valid: false, value: '', error: 'Email is required' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, value: trimmed, error: 'Please enter a valid email address' };
    }

    return { valid: true, value: trimmed, error: null };
  }

  /**
   * Validate password input
   * @param {string} password - Password to validate
   * @param {number} minLength - Minimum password length (default: 6)
   * @returns {Object} { valid: boolean, error: string }
   */
  function validatePassword(password, minLength = 6) {
    if (!password) {
      return { valid: false, error: 'Password is required' };
    }

    if (password.length < minLength) {
      return { valid: false, error: `Password must be at least ${minLength} characters` };
    }

    return { valid: true, error: null };
  }

  /**
   * Validate password confirmation
   * @param {string} password - Password
   * @param {string} confirm - Confirmation password
   * @returns {Object} { valid: boolean, error: string }
   */
  function validatePasswordMatch(password, confirm) {
    if (password !== confirm) {
      return { valid: false, error: 'Passwords do not match' };
    }

    return { valid: true, error: null };
  }

  /**
   * Validate text input
   * @param {string} value - Value to validate
   * @param {Object} options - { required: true, minLength: 1, maxLength: 255, pattern: null }
   * @returns {Object} { valid: boolean, value: string, error: string }
   */
  function validateText(value, options = {}) {
    const {
      required = true,
      minLength = 1,
      maxLength = 255,
      pattern = null,
      fieldName = 'Value'
    } = options;

    const trimmed = (value || '').trim();

    if (required && !trimmed) {
      return { valid: false, value: '', error: `${fieldName} is required` };
    }

    if (trimmed.length < minLength) {
      return { valid: false, value: trimmed, error: `${fieldName} must be at least ${minLength} characters` };
    }

    if (trimmed.length > maxLength) {
      return { valid: false, value: trimmed, error: `${fieldName} must not exceed ${maxLength} characters` };
    }

    if (pattern && !pattern.test(trimmed)) {
      return { valid: false, value: trimmed, error: `${fieldName} format is invalid` };
    }

    return { valid: true, value: trimmed, error: null };
  }

  /**
   * Validate number input
   * @param {*} value - Value to validate
   * @param {Object} options - { required: true, min: 0, max: Infinity }
   * @returns {Object} { valid: boolean, value: number, error: string }
   */
  function validateNumber(value, options = {}) {
    const { required = true, min = 0, max = Infinity, fieldName = 'Number' } = options;

    if (value === '' || value === null || value === undefined) {
      if (required) {
        return { valid: false, value: null, error: `${fieldName} is required` };
      }
      return { valid: true, value: null, error: null };
    }

    const num = Number(value);

    if (isNaN(num)) {
      return { valid: false, value: null, error: `${fieldName} must be a number` };
    }

    if (num < min) {
      return { valid: false, value: num, error: `${fieldName} must be at least ${min}` };
    }

    if (num > max) {
      return { valid: false, value: num, error: `${fieldName} must not exceed ${max}` };
    }

    return { valid: true, value: num, error: null };
  }

  /**
   * Validate currency amount
   * @param {*} value - Value to validate
   * @param {string} fieldName - Name of field (for error messages)
   * @returns {Object} { valid: boolean, value: number, error: string }
   */
  function validateAmount(value, fieldName = 'Amount') {
    const result = validateNumber(value, { required: true, min: 0.01, max: 999999999.99, fieldName });

    if (result.valid) {
      // Round to 2 decimal places
      result.value = Math.round(result.value * 100) / 100;
    }

    return result;
  }

  /**
   * Validate URL
   * @param {string} url - URL to validate
   * @returns {Object} { valid: boolean, error: string }
   */
  function validateURL(url) {
    try {
      new URL(url);
      return { valid: true, error: null };
    } catch {
      return { valid: false, error: 'Please enter a valid URL' };
    }
  }

  /**
   * Sanitize HTML to prevent XSS
   * @param {string} html - HTML string to sanitize
   * @returns {string} Sanitized string
   */
  function sanitizeHTML(html) {
    if (!html) return '';

    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Validate form inputs in bulk
   * @param {Object} formData - Object with field names and values
   * @param {Object} schema - Validation schema { fieldName: validatorFunction }
   * @returns {Object} { valid: boolean, errors: { fieldName: errorMessage } }
   */
  function validateForm(formData, schema) {
    const errors = {};
    let isValid = true;

    for (const [fieldName, validator] of Object.entries(schema)) {
      const result = validator(formData[fieldName]);

      if (!result.valid) {
        errors[fieldName] = result.error;
        isValid = false;
      }
    }

    return { valid: isValid, errors };
  }

  return {
    validateEmail,
    validatePassword,
    validatePasswordMatch,
    validateText,
    validateNumber,
    validateAmount,
    validateURL,
    sanitizeHTML,
    validateForm
  };
})();
