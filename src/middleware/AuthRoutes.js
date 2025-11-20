const express = require('express');
const { body, validationResult } = require('express-validator');

/**
 * AuthRoutes - Express router with pre-built authentication routes
 */
class AuthRoutes {
  constructor(authInstance, options = {}) {
    this.auth = authInstance;
    this.options = {
      prefix: options.prefix || '',
      enableRateLimit: options.enableRateLimit !== false,
      ...options
    };
    
    this.router = express.Router();
    this._setupRoutes();
  }

  /**
   * Setup all authentication routes
   */
  _setupRoutes() {
    // Apply rate limiting if enabled
    if (this.options.enableRateLimit) {
      const rateLimiter = this.auth.security.createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 requests per window
      });
      this.router.use(rateLimiter);
    }

    // Health check
    this.router.get('/health', this._healthCheck.bind(this));

    // Register
    this.router.post(
      '/register',
      [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 8 }),
        body('firstName').optional().trim(),
        body('lastName').optional().trim(),
      ],
      this._register.bind(this)
    );

    // Login
    this.router.post(
      '/login',
      [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
      this._login.bind(this)
    );

    // Refresh token
    this.router.post('/refresh', [body('refreshToken').notEmpty()], this._refresh.bind(this));

    // Logout
    this.router.post('/logout', [body('refreshToken').notEmpty()], this._logout.bind(this));

    // Logout all devices
    this.router.post('/logout-all', this.auth.middleware(), this._logoutAll.bind(this));

    // Get current user
    this.router.get('/me', this.auth.middleware(), this._getCurrentUser.bind(this));

    // Update user
    this.router.patch('/me', this.auth.middleware(), this._updateUser.bind(this));

    // Change password
    this.router.post(
      '/change-password',
      this.auth.middleware(),
      [body('oldPassword').notEmpty(), body('newPassword').isLength({ min: 8 })],
      this._changePassword.bind(this)
    );

    // Verify token
    this.router.post('/verify', [body('token').notEmpty()], this._verifyToken.bind(this));

    // Email verification routes (URL method)
    this.router.post(
      '/send-verification-email',
      [body('email').isEmail().normalizeEmail()],
      this._sendVerificationEmail.bind(this)
    );

    this.router.post('/verify-email', [body('token').notEmpty()], this._verifyEmail.bind(this));

    this.router.post(
      '/resend-verification-email',
      [body('email').isEmail().normalizeEmail()],
      this._resendVerificationEmail.bind(this)
    );

    // Email verification routes (6-digit code method)
    this.router.post(
      '/send-verification-code',
      [body('email').isEmail().normalizeEmail()],
      this._sendVerificationCode.bind(this)
    );

    this.router.post(
      '/verify-code',
      [
        body('email').isEmail().normalizeEmail(),
        body('code')
          .matches(/^\d{6}$/)
          .withMessage('Code must be 6 digits'),
      ],
      this._verifyCode.bind(this)
    );

    // Password reset routes (URL method)
    this.router.post(
      '/forgot-password',
      [body('email').isEmail().normalizeEmail()],
      this._forgotPassword.bind(this)
    );

    this.router.post(
      '/reset-password',
      [body('token').notEmpty(), body('newPassword').isLength({ min: 8 })],
      this._resetPassword.bind(this)
    );

    // Password reset routes (6-digit code method)
    this.router.post(
      '/send-password-reset-code',
      [body('email').isEmail().normalizeEmail()],
      this._sendPasswordResetCode.bind(this)
    );

    this.router.post(
      '/reset-password-with-code',
      [
        body('email').isEmail().normalizeEmail(),
        body('code')
          .matches(/^\d{6}$/)
          .withMessage('Code must be 6 digits'),
        body('newPassword').isLength({ min: 8 }),
      ],
      this._resetPasswordWithCode.bind(this)
    );
  }

  /**
   * Health check endpoint
   */
  async _healthCheck(req, res) {
    res.json({ 
      status: 'ok', 
      service: 'secure-node-auth',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Register new user
   */
  async _register(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const result = await this.auth.register(req.body);
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      // Handle duplicate user specifically
      const status = error.message.includes('already exists') ? 409 : 400;
      
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Login user
   */
  async _login(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { email, password } = req.body;
      const result = await this.auth.login(email, password);
      
      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      // Handle account locked specifically
      const status = error.message.includes('locked') ? 423 : 401;
      
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Refresh access token
   */
  async _refresh(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { refreshToken } = req.body;
      const result = await this.auth.refreshToken(refreshToken);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Logout user
   */
  async _logout(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { refreshToken } = req.body;
      await this.auth.logout(refreshToken);
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Logout from all devices
   */
  async _logoutAll(req, res) {
    try {
      await this.auth.logoutAll(req.user.userId);
      
      res.json({
        success: true,
        message: 'Logged out from all devices'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get current user
   */
  async _getCurrentUser(req, res) {
    try {
      const user = await this.auth.getUserById(req.user.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update user
   */
  async _updateUser(req, res) {
    try {
      // Remove sensitive fields
      delete req.body.password;
      delete req.body.email; // Email updates should be separate with verification
      
      const user = await this.auth.updateUser(req.user.userId, req.body);
      
      res.json({
        success: true,
        message: 'User updated successfully',
        data: user
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Change password
   */
  async _changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { oldPassword, newPassword } = req.body;
      await this.auth.changePassword(req.user.userId, oldPassword, newPassword);
      
      res.json({
        success: true,
        message: 'Password changed successfully. Please login again.'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Verify access token
   */
  async _verifyToken(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token } = req.body;
      const decoded = await this.auth.verifyAccessToken(token);
      
      res.json({
        success: true,
        valid: true,
        data: decoded
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        valid: false,
        error: error.message
      });
    }
  }

  /**
   * Send verification email
   */
  async _sendVerificationEmail(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { email } = req.body;
      const verificationUrl = this.options.verificationUrl || this.auth.options.verificationUrl;

      if (!verificationUrl) {
        return res.status(500).json({
          success: false,
          error: 'Verification URL not configured'
        });
      }

      await this.auth.sendVerificationEmail(email, verificationUrl);
      
      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Verify email with token
   */
  async _verifyEmail(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { token } = req.body;
      const result = await this.auth.verifyEmail(token);
      
      res.json({
        success: true,
        message: 'Email verified successfully',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Resend verification email
   */
  async _resendVerificationEmail(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { email } = req.body;
      const verificationUrl = this.options.verificationUrl || this.auth.options.verificationUrl;

      if (!verificationUrl) {
        return res.status(500).json({
          success: false,
          error: 'Verification URL not configured'
        });
      }

      await this.auth.resendVerificationEmail(email, verificationUrl);
      
      res.json({
        success: true,
        message: 'Verification email resent successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Forgot password - send reset email
   */
  async _forgotPassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { email } = req.body;
      const resetUrl = this.options.passwordResetUrl || this.auth.options.passwordResetUrl;

      if (!resetUrl) {
        return res.status(500).json({
          success: false,
          error: 'Password reset URL not configured'
        });
      }

      const result = await this.auth.sendPasswordResetEmail(email, resetUrl);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      // Don't reveal if email exists
      res.json({
        success: true,
        message: 'If the email exists, a reset link has been sent.'
      });
    }
  }

  /**
   * Reset password with token
   */
  async _resetPassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { token, newPassword } = req.body;
      const result = await this.auth.resetPassword(token, newPassword);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Send verification code (6-digit)
   */
  async _sendVerificationCode(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { email } = req.body;
      await this.auth.sendVerificationCode(email);
      
      res.json({
        success: true,
        message: 'Verification code sent successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Verify email with 6-digit code
   */
  async _verifyCode(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { email, code } = req.body;
      const result = await this.auth.verifyCode(email, code);
      
      res.json({
        success: true,
        message: 'Email verified successfully',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Send password reset code (6-digit)
   */
  async _sendPasswordResetCode(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { email } = req.body;
      await this.auth.sendPasswordResetCode(email);
      
      // Security best practice: Don't reveal if email exists
      res.json({
        success: true,
        message: 'If the email exists, a reset code has been sent.'
      });
    } catch (error) {
      // Don't reveal errors
      res.json({
        success: true,
        message: 'If the email exists, a reset code has been sent.'
      });
    }
  }

  /**
   * Reset password with 6-digit code
   */
  async _resetPasswordWithCode(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { email, code, newPassword } = req.body;
      const result = await this.auth.resetPasswordWithCode(email, code, newPassword);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get router instance
   */
  getRouter() {
    return this.router;
  }
}

module.exports = AuthRoutes;
