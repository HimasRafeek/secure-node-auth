/**
 * FastifyRoutes - Fastify routes with pre-built authentication endpoints
 * Alternative to Express AuthRoutes for Fastify framework
 */
class FastifyRoutes {
  constructor(authInstance, options = {}) {
    this.auth = authInstance;
    this.options = {
      prefix: options.prefix || '/auth',
      enableRateLimit: options.enableRateLimit !== false,
      rateLimitMax: options.rateLimitMax || 10,
      rateLimitWindow: options.rateLimitWindow || 15 * 60 * 1000, // 15 minutes
      ...options
    };
  }

  /**
   * Register all authentication routes with Fastify instance
   */
  async register(fastify, opts) {
    // Apply rate limiting if enabled
    if (this.options.enableRateLimit) {
      await fastify.register(require('@fastify/rate-limit'), {
        max: this.options.rateLimitMax,
        timeWindow: this.options.rateLimitWindow
      });
    }

    // Health check
    fastify.get('/health', {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              service: { type: 'string' },
              timestamp: { type: 'string' }
            }
          }
        }
      }
    }, this._healthCheck.bind(this));

    // Register
    fastify.post('/register', {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            firstName: { type: 'string' },
            lastName: { type: 'string' }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              data: { type: 'object' }
            }
          }
        }
      }
    }, this._register.bind(this));

    // Login
    fastify.post('/login', {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' }
          }
        }
      }
    }, this._login.bind(this));

    // Refresh token
    fastify.post('/refresh', {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' }
          }
        }
      }
    }, this._refresh.bind(this));

    // Logout
    fastify.post('/logout', {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' }
          }
        }
      }
    }, this._logout.bind(this));

    // Logout all devices
    fastify.post('/logout-all', {
      preHandler: this._fastifyAuthMiddleware.bind(this)
    }, this._logoutAll.bind(this));

    // Get current user
    fastify.get('/me', {
      preHandler: this._fastifyAuthMiddleware.bind(this)
    }, this._getCurrentUser.bind(this));

    // Update user
    fastify.patch('/me', {
      preHandler: this._fastifyAuthMiddleware.bind(this)
    }, this._updateUser.bind(this));

    // Change password
    fastify.post('/change-password', {
      preHandler: this._fastifyAuthMiddleware.bind(this),
      schema: {
        body: {
          type: 'object',
          required: ['oldPassword', 'newPassword'],
          properties: {
            oldPassword: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 }
          }
        }
      }
    }, this._changePassword.bind(this));

    // Verify token
    fastify.post('/verify', {
      schema: {
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' }
          }
        }
      }
    }, this._verifyToken.bind(this));

    // Email verification routes
    fastify.post('/send-verification-email', {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' }
          }
        }
      }
    }, this._sendVerificationEmail.bind(this));

    fastify.post('/verify-email', {
      schema: {
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string' }
          }
        }
      }
    }, this._verifyEmail.bind(this));

    fastify.post('/resend-verification-email', {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' }
          }
        }
      }
    }, this._resendVerificationEmail.bind(this));

    // Password reset routes
    fastify.post('/forgot-password', {
      schema: {
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' }
          }
        }
      }
    }, this._forgotPassword.bind(this));

    fastify.post('/reset-password', {
      schema: {
        body: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 }
          }
        }
      }
    }, this._resetPassword.bind(this));
  }

  /**
   * Fastify auth middleware (preHandler)
   */
  async _fastifyAuthMiddleware(request, reply) {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          success: false,
          error: 'No token provided'
        });
      }

      const token = authHeader.substring(7);
      const decoded = await this.auth.verifyAccessToken(token);
      
      // Attach user to request
      request.user = decoded;
    } catch (error) {
      return reply.code(401).send({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  }

  /**
   * Health check endpoint
   */
  async _healthCheck(request, reply) {
    return {
      status: 'ok',
      service: 'secure-node-auth',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Register new user
   */
  async _register(request, reply) {
    try {
      const result = await this.auth.register(request.body);
      
      return reply.code(201).send({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      const status = error.message.includes('already exists') ? 409 : 400;
      
      return reply.code(status).send({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Login user
   */
  async _login(request, reply) {
    try {
      const { email, password } = request.body;
      const result = await this.auth.login(email, password);
      
      return {
        success: true,
        message: 'Login successful',
        data: result
      };
    } catch (error) {
      const status = error.message.includes('locked') ? 423 : 401;
      
      return reply.code(status).send({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Refresh access token
   */
  async _refresh(request, reply) {
    try {
      const { refreshToken } = request.body;
      const result = await this.auth.refreshToken(refreshToken);
      
      return {
        success: true,
        message: 'Token refreshed successfully',
        data: result
      };
    } catch (error) {
      return reply.code(401).send({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Logout (revoke refresh token)
   */
  async _logout(request, reply) {
    try {
      const { refreshToken } = request.body;
      await this.auth.logout(refreshToken);
      
      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Logout all devices
   */
  async _logoutAll(request, reply) {
    try {
      await this.auth.logoutAll(request.user.userId);
      
      return {
        success: true,
        message: 'Logged out from all devices'
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get current user
   */
  async _getCurrentUser(request, reply) {
    try {
      const user = await this.auth.getUserById(request.user.userId);
      
      return {
        success: true,
        data: user
      };
    } catch (error) {
      return reply.code(404).send({
        success: false,
        error: 'User not found'
      });
    }
  }

  /**
   * Update user
   */
  async _updateUser(request, reply) {
    try {
      // Remove sensitive fields
      delete request.body.password;
      delete request.body.email;
      
      const user = await this.auth.updateUser(request.user.userId, request.body);
      
      return {
        success: true,
        message: 'User updated successfully',
        data: user
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Change password
   */
  async _changePassword(request, reply) {
    try {
      const { oldPassword, newPassword } = request.body;
      await this.auth.changePassword(request.user.userId, oldPassword, newPassword);
      
      return {
        success: true,
        message: 'Password changed successfully. Please login again.'
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Verify access token
   */
  async _verifyToken(request, reply) {
    try {
      const { token } = request.body;
      const decoded = await this.auth.verifyAccessToken(token);
      
      return {
        success: true,
        valid: true,
        data: decoded
      };
    } catch (error) {
      return reply.code(401).send({
        success: false,
        valid: false,
        error: error.message
      });
    }
  }

  /**
   * Send verification email
   */
  async _sendVerificationEmail(request, reply) {
    try {
      const { email } = request.body;
      const verificationUrl = this.options.verificationUrl || this.auth.options.verificationUrl;

      if (!verificationUrl) {
        return reply.code(500).send({
          success: false,
          error: 'Verification URL not configured'
        });
      }

      await this.auth.sendVerificationEmail(email, verificationUrl);
      
      return {
        success: true,
        message: 'Verification email sent successfully'
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Verify email with token
   */
  async _verifyEmail(request, reply) {
    try {
      const { token } = request.body;
      const result = await this.auth.verifyEmail(token);
      
      return {
        success: true,
        message: 'Email verified successfully',
        data: result
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Resend verification email
   */
  async _resendVerificationEmail(request, reply) {
    try {
      const { email } = request.body;
      const verificationUrl = this.options.verificationUrl || this.auth.options.verificationUrl;

      if (!verificationUrl) {
        return reply.code(500).send({
          success: false,
          error: 'Verification URL not configured'
        });
      }

      await this.auth.resendVerificationEmail(email, verificationUrl);
      
      return {
        success: true,
        message: 'Verification email resent successfully'
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Forgot password - send reset email
   */
  async _forgotPassword(request, reply) {
    try {
      const { email } = request.body;
      const resetUrl = this.options.passwordResetUrl || this.auth.options.passwordResetUrl;

      if (!resetUrl) {
        return reply.code(500).send({
          success: false,
          error: 'Password reset URL not configured'
        });
      }

      await this.auth.sendPasswordResetEmail(email, resetUrl);
      
      return {
        success: true,
        message: 'If the email exists, a reset link has been sent.'
      };
    } catch (error) {
      // Don't reveal if email exists
      return {
        success: true,
        message: 'If the email exists, a reset link has been sent.'
      };
    }
  }

  /**
   * Reset password with token
   */
  async _resetPassword(request, reply) {
    try {
      const { token, newPassword } = request.body;
      const result = await this.auth.resetPassword(token, newPassword);
      
      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = FastifyRoutes;
