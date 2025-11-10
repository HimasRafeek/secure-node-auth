const nodemailer = require('nodemailer');
const crypto = require('crypto');

/**
 * EmailService - Handles all email operations (verification, password reset, etc.)
 */
class EmailService {
  constructor(config, dbPool, tables) {
    this.config = config;
    this.dbPool = dbPool;
    this.tables = tables;
    this.transporter = null;
    
    // Initialize transporter if config is provided
    if (config && config.smtp) {
      this.initTransporter();
    }
  }

  /**
   * Initialize nodemailer transporter
   */
  initTransporter() {
    const { smtp } = this.config;
    
    if (!smtp || !smtp.host || !smtp.port) {
      console.warn('[EmailService] SMTP configuration incomplete. Email features disabled.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure || false, // true for 465, false for other ports
        auth: smtp.auth ? {
          user: smtp.auth.user,
          pass: smtp.auth.pass
        } : undefined,
        tls: smtp.tls || {
          rejectUnauthorized: false // Allow self-signed certificates in dev
        }
      });
      
      console.log('[EmailService] ✓ Email transporter initialized');
    } catch (error) {
      console.error('[EmailService] Failed to initialize transporter:', error.message);
      this.transporter = null;
    }
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection() {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized. Check SMTP configuration.');
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      throw new Error(`SMTP connection failed: ${error.message}`);
    }
  }

  /**
   * Generate a secure random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Send verification email to user
   */
  async sendVerificationEmail(userId, email, verificationUrl) {
    if (!this.transporter) {
      throw new Error('Email service not configured. Please set up SMTP settings.');
    }

    try {
      // Generate verification token
      const token = this.generateToken();
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

      // Store token in database
      await this.dbPool.execute(
        `INSERT INTO \`${this.tables.verificationTokens}\` (userId, token, expiresAt) VALUES (?, ?, ?)`,
        [userId, token, expiresAt]
      );

      // Build verification link
      const verificationLink = `${verificationUrl}?token=${token}`;

      // Email template
      const mailOptions = {
        from: this.config.smtp.from || this.config.smtp.auth.user,
        to: email,
        subject: this.config.emailTemplates?.verification?.subject || 'Verify Your Email Address',
        html: this.config.emailTemplates?.verification?.html
          ? this.config.emailTemplates.verification.html(verificationLink, email)
          : this._defaultVerificationTemplate(verificationLink, email)
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('[EmailService] Verification email sent:', info.messageId);
      
      return {
        success: true,
        messageId: info.messageId,
        token // Return token for testing purposes
      };
    } catch (error) {
      console.error('[EmailService] Failed to send verification email:', error.message);
      throw new Error(`Failed to send verification email: ${error.message}`);
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token) {
    const connection = await this.dbPool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Find valid token
      const [tokens] = await connection.execute(
        `SELECT userId, expiresAt FROM \`${this.tables.verificationTokens}\` 
         WHERE token = ? LIMIT 1`,
        [token]
      );

      if (tokens.length === 0) {
        throw new Error('Invalid or expired verification token');
      }

      const { userId, expiresAt } = tokens[0];

      // Check if token expired
      if (Date.now() > expiresAt) {
        // Delete expired token
        await connection.execute(
          `DELETE FROM \`${this.tables.verificationTokens}\` WHERE token = ?`,
          [token]
        );
        await connection.commit();
        throw new Error('Verification token has expired. Please request a new one.');
      }

      // Mark user as verified
      await connection.execute(
        `UPDATE \`${this.tables.users}\` SET emailVerified = TRUE WHERE id = ?`,
        [userId]
      );

      // Delete used token
      await connection.execute(
        `DELETE FROM \`${this.tables.verificationTokens}\` WHERE token = ?`,
        [token]
      );

      await connection.commit();

      console.log('[EmailService] Email verified successfully for user:', userId);

      return {
        success: true,
        userId,
        message: 'Email verified successfully'
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email, verificationUrl) {
    try {
      // Find user by email
      const [users] = await this.dbPool.execute(
        `SELECT id, email, emailVerified FROM \`${this.tables.users}\` WHERE email = ? LIMIT 1`,
        [email]
      );

      if (users.length === 0) {
        throw new Error('User not found');
      }

      const user = users[0];

      if (user.emailVerified) {
        throw new Error('Email is already verified');
      }

      // Delete old tokens for this user
      await this.dbPool.execute(
        `DELETE FROM \`${this.tables.verificationTokens}\` WHERE userId = ?`,
        [user.id]
      );

      // Send new verification email
      return await this.sendVerificationEmail(user.id, user.email, verificationUrl);
    } catch (error) {
      console.error('[EmailService] Failed to resend verification email:', error.message);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, resetUrl) {
    if (!this.transporter) {
      throw new Error('Email service not configured. Please set up SMTP settings.');
    }

    try {
      // Find user
      const [users] = await this.dbPool.execute(
        `SELECT id FROM \`${this.tables.users}\` WHERE email = ? LIMIT 1`,
        [email]
      );

      if (users.length === 0) {
        // Don't reveal if user exists for security
        return { success: true, message: 'If the email exists, a reset link has been sent.' };
      }

      const userId = users[0].id;

      // Generate reset token
      const token = this.generateToken();
      const expiresAt = Date.now() + (1 * 60 * 60 * 1000); // 1 hour

      // Store token in users table
      await this.dbPool.execute(
        `UPDATE \`${this.tables.users}\` 
         SET resetPasswordToken = ?, resetPasswordExpires = ? 
         WHERE id = ?`,
        [token, expiresAt, userId]
      );

      // Build reset link
      const resetLink = `${resetUrl}?token=${token}`;

      // Email template
      const mailOptions = {
        from: this.config.smtp.from || this.config.smtp.auth.user,
        to: email,
        subject: this.config.emailTemplates?.passwordReset?.subject || 'Reset Your Password',
        html: this.config.emailTemplates?.passwordReset?.html
          ? this.config.emailTemplates.passwordReset.html(resetLink, email)
          : this._defaultPasswordResetTemplate(resetLink, email)
      };

      // Send email
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('[EmailService] Password reset email sent:', info.messageId);
      
      return {
        success: true,
        messageId: info.messageId,
        message: 'If the email exists, a reset link has been sent.'
      };
    } catch (error) {
      console.error('[EmailService] Failed to send password reset email:', error.message);
      // Don't reveal internal errors
      return {
        success: true,
        message: 'If the email exists, a reset link has been sent.'
      };
    }
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens() {
    try {
      const now = Date.now();
      
      // Delete expired verification tokens
      const [result] = await this.dbPool.execute(
        `DELETE FROM \`${this.tables.verificationTokens}\` WHERE expiresAt < ?`,
        [now]
      );

      // Clear expired reset tokens from users table
      await this.dbPool.execute(
        `UPDATE \`${this.tables.users}\` 
         SET resetPasswordToken = NULL, resetPasswordExpires = NULL 
         WHERE resetPasswordExpires < ?`,
        [now]
      );

      if (result.affectedRows > 0) {
        console.log(`[EmailService] Cleaned up ${result.affectedRows} expired tokens`);
      }

      return result.affectedRows;
    } catch (error) {
      console.error('[EmailService] Failed to cleanup expired tokens:', error.message);
      return 0;
    }
  }

  /**
   * Default verification email template
   */
  _defaultVerificationTemplate(verificationLink, email) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Verify Your Email Address</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hello,</p>
          
          <p>Thank you for registering! Please verify your email address by clicking the button below:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="background: #667eea; color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Verify Email Address
            </a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: white; padding: 10px; border-radius: 5px; font-size: 12px;">
            ${verificationLink}
          </p>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This verification link will expire in 24 hours.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>This is an automated email, please do not reply.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Default password reset email template
   */
  _defaultPasswordResetTemplate(resetLink, email) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Reset Your Password</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p>Hello,</p>
          
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background: #f5576c; color: white; padding: 14px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Reset Password
            </a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; background: white; padding: 10px; border-radius: 5px; font-size: 12px;">
            ${resetLink}
          </p>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This password reset link will expire in 1 hour.
          </p>
          
          <p style="color: #666; font-size: 14px;">
            If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>This is an automated email, please do not reply.</p>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = EmailService;
