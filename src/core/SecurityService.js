const bcrypt = require('bcrypt');
const validator = require('validator');

/**
 * SecurityService - Handles password hashing, validation, and security checks
 */
class SecurityService {
  constructor(config) {
    // Validate and set bcrypt rounds (must be between 4-31)
    this.bcryptRounds = config.bcryptRounds || 10;
    if (this.bcryptRounds < 4 || this.bcryptRounds > 31) {
      console.warn('[SecurityService] bcryptRounds must be between 4-31, using default: 10');
      this.bcryptRounds = 10;
    }
    
    this.maxLoginAttempts = config.maxLoginAttempts || 5;
    this.lockoutTime = config.lockoutTime || 15 * 60 * 1000;
    this.passwordMinLength = config.passwordMinLength || 8;
    
    // Validate password min length
    if (this.passwordMinLength < 6 || this.passwordMinLength > 72) {
      console.warn('[SecurityService] passwordMinLength must be between 6-72, using default: 8');
      this.passwordMinLength = 8;
    }
    
    this.passwordRequireUppercase = config.passwordRequireUppercase !== false;
    this.passwordRequireNumbers = config.passwordRequireNumbers !== false;
    this.passwordRequireSpecialChars = config.passwordRequireSpecialChars !== false;
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required and must be a string');
    }
    
    if (password.length > 72) {
      throw new Error('Password too long for hashing (max 72 characters)');
    }
    
    try {
      const salt = await bcrypt.genSalt(this.bcryptRounds);
      const hash = await bcrypt.hash(password, salt);
      return hash;
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password, hash) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required for verification');
    }
    
    if (!hash || typeof hash !== 'string') {
      throw new Error('Hash is required for verification');
    }
    
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error(`Password verification failed: ${error.message}`);
    }
  }

  /**
   * Validate password strength
   */
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('Password is required and must be a string');
    }
    
    // Check maximum length to prevent DoS attacks via bcrypt
    if (password.length > 72) {
      throw new Error('Password must not exceed 72 characters');
    }
    
    const errors = [];

    if (password.length < this.passwordMinLength) {
      errors.push(`Password must be at least ${this.passwordMinLength} characters long`);
    }

    if (this.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.passwordRequireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.passwordRequireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const weakPasswords = ['password', '12345678', 'qwerty', 'abc123', 'password123', 'admin123', 'letmein'];
    if (weakPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a stronger password');
    }
    
    // Check for sequential characters
    if (/(.)\1{2,}/.test(password)) {
      errors.push('Password should not contain repeated characters');
    }

    if (errors.length > 0) {
      throw new Error(errors.join('. '));
    }

    return true;
  }

  /**
   * Validate email format
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new Error('Email is required and must be a string');
    }
    
    // Trim and lowercase for validation
    const normalizedEmail = email.trim().toLowerCase();
    
    if (!validator.isEmail(normalizedEmail)) {
      throw new Error('Invalid email address format');
    }
    
    // Additional checks for suspicious patterns
    if (normalizedEmail.length > 254) {
      throw new Error('Email address is too long');
    }
    
    return true;
  }

  /**
   * Validate registration data
   */
  validateRegistrationData(data, customFields = []) {
    if (!data || typeof data !== 'object') {
      throw new Error('Registration data must be an object');
    }
    
    const errors = [];

    // Validate email
    try {
      this.validateEmail(data.email);
    } catch (error) {
      errors.push(error.message);
    }

    // Validate password
    try {
      this.validatePassword(data.password);
    } catch (error) {
      errors.push(error.message);
    }

    // Validate custom required fields
    for (const field of customFields) {
      if (field.required && !data[field.name]) {
        errors.push(`Field '${field.name}' is required`);
      }
      
      // Validate field type matches expected type if value is provided
      if (data[field.name] !== undefined && data[field.name] !== null) {
        const fieldType = field.type.toUpperCase();
        const value = data[field.name];
        
        // Basic type validation
        if (fieldType.includes('INT') || fieldType.includes('BIGINT')) {
          if (!Number.isInteger(Number(value)) || isNaN(Number(value))) {
            errors.push(`Field '${field.name}' must be an integer`);
          }
        } else if (fieldType.includes('VARCHAR') || fieldType.includes('TEXT')) {
          if (typeof value !== 'string') {
            errors.push(`Field '${field.name}' must be a string`);
          }
        } else if (fieldType.includes('BOOLEAN')) {
          if (typeof value !== 'boolean' && value !== 0 && value !== 1) {
            errors.push(`Field '${field.name}' must be a boolean`);
          }
        }
      }
    }

    // Sanitize inputs
    if (data.firstName) {
      data.firstName = validator.escape(data.firstName.trim());
    }
    if (data.lastName) {
      data.lastName = validator.escape(data.lastName.trim());
    }

    if (errors.length > 0) {
      throw new Error(errors.join('. '));
    }

    return true;
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32) {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Sanitize user input
   */
  sanitize(input) {
    if (typeof input === 'string') {
      return validator.escape(input.trim());
    }
    return input;
  }

  /**
   * Check password strength (returns score 0-4)
   */
  checkPasswordStrength(password) {
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;

    return Math.min(strength, 4);
  }

  /**
   * Validate phone number (optional)
   */
  validatePhoneNumber(phone) {
    if (!phone) return true;
    
    return validator.isMobilePhone(phone, 'any', { strictMode: false });
  }

  /**
   * Rate limiting helper
   */
  createRateLimiter(options = {}) {
    const rateLimit = require('express-rate-limit');
    
    return rateLimit({
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
      max: options.max || 5, // 5 requests per window
      message: options.message || 'Too many requests, please try again later',
      standardHeaders: true,
      legacyHeaders: false
    });
  }
}

module.exports = SecurityService;
