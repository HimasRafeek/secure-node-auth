const mysql = require('mysql2/promise');

/**
 * DatabaseManager - Handles all database operations
 * Auto-creates tables, indexes, and manages connections
 */
class DatabaseManager {
  constructor(config) {
    this.config = config;
    this.pool = null;
  }

  /**
   * Create connection pool
   */
  async connect() {
    try {
      // Validate config before connecting
      if (!this.config || typeof this.config !== 'object') {
        throw new Error('Database configuration is required');
      }

      if (!this.config.host || !this.config.user || !this.config.database) {
        throw new Error('Database host, user, and database name are required');
      }

      this.pool = mysql.createPool(this.config);

      // Test connection
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();

      return true;
    } catch (error) {
      // Clean up pool on failure
      if (this.pool) {
        try {
          await this.pool.end();
        } catch (closeError) {
          // Ignore close errors
        }
        this.pool = null;
      }
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Create all necessary tables
   */
  async createTables(tables, customFields = []) {
    const connection = await this.pool.getConnection();

    try {
      // Build custom fields SQL with proper escaping
      const customFieldsSQL = customFields
        .map((field) => {
          // Validate field name to prevent SQL injection
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.name)) {
            throw new Error(
              `Invalid field name: ${field.name}. Only alphanumeric and underscore allowed.`
            );
          }

          let sql = `\`${field.name}\` ${field.type}`;
          if (field.required) sql += ' NOT NULL';

          // Properly handle default values based on type
          if (field.defaultValue !== null && field.defaultValue !== undefined) {
            // For numeric types, don't quote
            if (
              ['INT', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL'].some((t) =>
                field.type.toUpperCase().startsWith(t)
              )
            ) {
              sql += ` DEFAULT ${field.defaultValue}`;
            } else if (field.type.toUpperCase().includes('BOOLEAN')) {
              sql += ` DEFAULT ${field.defaultValue ? 'TRUE' : 'FALSE'}`;
            } else {
              // For string types, use connection.escape for safety
              sql += ` DEFAULT ${connection.escape(field.defaultValue)}`;
            }
          }

          if (field.unique) sql += ' UNIQUE';
          return sql;
        })
        .join(',\n    ');

      // Users table
      const usersTableSQL = `
        CREATE TABLE IF NOT EXISTS \`${tables.users}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          firstName VARCHAR(100),
          lastName VARCHAR(100),
          emailVerified BOOLEAN DEFAULT FALSE,
          emailVerificationToken VARCHAR(255),
          resetPasswordToken VARCHAR(255),
          resetPasswordExpires BIGINT,
          isActive BOOLEAN DEFAULT TRUE,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ${customFieldsSQL ? ',' + customFieldsSQL : ''}
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      // Refresh tokens table
      const refreshTokensTableSQL = `
        CREATE TABLE IF NOT EXISTS \`${tables.refreshTokens}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          token TEXT NOT NULL,
          revoked BOOLEAN DEFAULT FALSE,
          expiresAt BIGINT NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES \`${tables.users}\`(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      // Login attempts table
      const loginAttemptsTableSQL = `
        CREATE TABLE IF NOT EXISTS \`${tables.loginAttempts}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          success BOOLEAN DEFAULT FALSE,
          ipAddress VARCHAR(45),
          userAgent TEXT,
          attemptedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_email_attempted (email, attemptedAt)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      // Email verification tokens table
      const verificationTokensTableSQL = `
        CREATE TABLE IF NOT EXISTS \`${tables.verificationTokens}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          userId INT NOT NULL,
          token VARCHAR(255) NOT NULL UNIQUE,
          expiresAt BIGINT NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES \`${tables.users}\`(id) ON DELETE CASCADE,
          INDEX idx_token (token),
          INDEX idx_user_token (userId, token)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `;

      await connection.query(usersTableSQL);
      await connection.query(refreshTokensTableSQL);
      await connection.query(loginAttemptsTableSQL);
      await connection.query(verificationTokensTableSQL);
    } finally {
      connection.release();
    }
  }

  /**
   * Create indexes for performance
   */
  async createIndexes(tables) {
    const connection = await this.pool.getConnection();

    try {
      // These indexes improve query performance
      const indexes = [
        `CREATE INDEX IF NOT EXISTS idx_email ON \`${tables.users}\`(email)`,
        `CREATE INDEX IF NOT EXISTS idx_user_tokens ON \`${tables.refreshTokens}\`(userId, revoked)`,
        `CREATE INDEX IF NOT EXISTS idx_token_expires ON \`${tables.refreshTokens}\`(expiresAt)`,
      ];

      for (const indexSQL of indexes) {
        try {
          await connection.query(indexSQL);
        } catch (error) {
          // Index might already exist, continue
          if (!error.message.includes('Duplicate key name')) {
            console.warn(`Index creation warning: ${error.message}`);
          }
        }
      }
    } finally {
      connection.release();
    }
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email, tableName) {
    this._ensureConnected();

    if (!email || typeof email !== 'string') {
      return null;
    }

    const [rows] = await this.pool.execute(
      `SELECT * FROM \`${tableName}\` WHERE email = ? LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  }

  /**
   * Find user by ID
   */
  async findUserById(userId, tableName) {
    this._ensureConnected();

    if (!userId) {
      return null;
    }

    const [rows] = await this.pool.execute(`SELECT * FROM \`${tableName}\` WHERE id = ? LIMIT 1`, [
      userId,
    ]);
    return rows[0] || null;
  }

  /**
   * Create new user
   */
  async createUser(userData, tableName) {
    this._ensureConnected();

    if (!userData || typeof userData !== 'object') {
      throw new Error('User data is required');
    }

    if (!userData.email || !userData.password) {
      throw new Error('Email and password are required fields');
    }

    // Validate number of fields to prevent abuse
    const fieldCount = Object.keys(userData).length;
    if (fieldCount > 50) {
      throw new Error('Too many fields. Maximum 50 fields allowed per user.');
    }

    const fields = Object.keys(userData);
    const values = Object.values(userData);
    const placeholders = fields.map(() => '?').join(', ');

    // Escape field names to prevent SQL injection
    const escapedFields = fields.map((field) => `\`${field}\``).join(', ');

    const sql = `INSERT INTO \`${tableName}\` (${escapedFields}) VALUES (${placeholders})`;

    const [result] = await this.pool.execute(sql, values);
    return result.insertId;
  }

  /**
   * Update user
   */
  async updateUser(userId, updates, tableName) {
    this._ensureConnected();

    if (!updates || typeof updates !== 'object') {
      throw new Error('Updates must be an object');
    }

    if (Object.keys(updates).length === 0) {
      throw new Error('No fields to update');
    }

    // Validate number of fields to prevent abuse
    if (Object.keys(updates).length > 30) {
      throw new Error('Too many fields. Maximum 30 fields can be updated at once.');
    }

    const fields = Object.keys(updates);
    const values = Object.values(updates);

    // Escape field names to prevent SQL injection
    const setClause = fields.map((field) => `\`${field}\` = ?`).join(', ');
    const sql = `UPDATE \`${tableName}\` SET ${setClause} WHERE id = ?`;

    const [result] = await this.pool.execute(sql, [...values, userId]);
    return result.affectedRows;
  }

  /**
   * Store refresh token
   */
  async storeRefreshToken(userId, token, tableName) {
    this._ensureConnected();

    if (!userId || !token || typeof token !== 'string') {
      throw new Error('userId and token are required');
    }

    // Calculate expiration (7 days from now)
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;

    // Hash the token before storing for additional security
    // Store last 8 chars for debugging/identification
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const sql = `INSERT INTO \`${tableName}\` (userId, token, expiresAt) VALUES (?, ?, ?)`;
    await this.pool.execute(sql, [userId, tokenHash, expiresAt]);
  }

  /**
   * Find refresh token
   */
  async findRefreshToken(token, tableName) {
    this._ensureConnected();

    if (!token || typeof token !== 'string') {
      return null;
    }

    // Hash the token to match stored hash
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [rows] = await this.pool.execute(
      `SELECT * FROM \`${tableName}\` WHERE token = ? AND expiresAt > ? AND revoked = FALSE LIMIT 1`,
      [tokenHash, Date.now()]
    );
    return rows[0] || null;
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(token, tableName) {
    this._ensureConnected();

    if (!token || typeof token !== 'string') {
      throw new Error('Token is required');
    }

    // Hash the token to match stored hash
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [result] = await this.pool.execute(
      `UPDATE \`${tableName}\` SET revoked = TRUE WHERE token = ?`,
      [tokenHash]
    );
    return result.affectedRows;
  }

  /**
   * Revoke all user's refresh tokens
   */
  async revokeAllUserTokens(userId, tableName) {
    this._ensureConnected();

    if (!userId) {
      throw new Error('userId is required');
    }

    const [result] = await this.pool.execute(
      `UPDATE \`${tableName}\` SET revoked = TRUE WHERE userId = ? AND revoked = FALSE`,
      [userId]
    );
    return result.affectedRows;
  }

  /**
   * Record login attempt
   */
  async recordLoginAttempt(email, success, tableName, ipAddress = null, userAgent = null) {
    this._ensureConnected();

    if (!email || typeof email !== 'string') {
      throw new Error('Email is required for recording login attempt');
    }

    const sql = `INSERT INTO \`${tableName}\` (email, success, ipAddress, userAgent) VALUES (?, ?, ?, ?)`;
    await this.pool.execute(sql, [email, success, ipAddress, userAgent]);
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(email, tableName, maxAttempts, lockoutTime) {
    this._ensureConnected();

    if (!email || typeof email !== 'string') {
      return false;
    }

    const cutoffTime = new Date(Date.now() - lockoutTime);

    const [rows] = await this.pool.execute(
      `SELECT COUNT(*) as failedAttempts 
       FROM \`${tableName}\` 
       WHERE email = ? 
       AND success = FALSE 
       AND attemptedAt > ?`,
      [email, cutoffTime]
    );

    return rows[0].failedAttempts >= maxAttempts;
  }

  /**
   * Clean up expired tokens (maintenance task)
   */
  async cleanupExpiredTokens(tableName) {
    this._ensureConnected();
    await this.pool.execute(`DELETE FROM \`${tableName}\` WHERE expiresAt < ?`, [Date.now()]);
  }

  /**
   * Get user count (for analytics)
   */
  async getUserCount(tableName) {
    this._ensureConnected();
    const [rows] = await this.pool.execute(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    return rows[0].count;
  }

  /**
   * Close connection pool
   */
  async close() {
    if (this.pool) {
      try {
        await this.pool.end();
      } catch (error) {
        console.error('[DatabaseManager] Error closing pool:', error.message);
        // Force close if graceful close fails
        try {
          await this.pool.end();
        } catch (forceError) {
          console.error('[DatabaseManager] Force close also failed:', forceError.message);
        }
      } finally {
        this.pool = null;
      }
    }
  }

  /**
   * Get raw pool for advanced queries
   */
  getPool() {
    this._ensureConnected();
    return this.pool;
  }

  /**
   * Clean up expired login attempt records
   * MAINTENANCE: Should be called periodically (e.g., daily via cron job)
   * Removes login records older than specified days to prevent table bloat
   * @param {string} tableName - Login attempts table name
   * @param {number} daysToKeep - Number of days to retain records (default: 30)
   * @returns {Promise<number>} Number of records deleted
   */
  async cleanupExpiredLoginAttempts(tableName, daysToKeep = 30) {
    this._ensureConnected();

    if (typeof daysToKeep !== 'number' || daysToKeep < 1) {
      throw new Error('daysToKeep must be a positive number');
    }

    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      const [result] = await this.pool.execute(
        `DELETE FROM \`${tableName}\` WHERE attemptedAt < ?`,
        [cutoffDate]
      );

      const deletedCount = result.affectedRows || 0;

      console.log(
        `[DatabaseManager] ✓ Cleaned up ${deletedCount} expired login attempts ` +
          `(older than ${daysToKeep} days)`
      );

      return deletedCount;
    } catch (error) {
      throw new Error(`Failed to clean up login attempts: ${error.message}`);
    }
  }

  /**
   * Clean up expired verification tokens
   * MAINTENANCE: Should be called periodically (e.g., hourly via cron job)
   * Removes tokens that have expired to prevent table bloat
   * @param {string} tableName - Verification tokens table name
   * @returns {Promise<number>} Number of tokens deleted
   */
  async cleanupExpiredVerificationTokens(tableName) {
    this._ensureConnected();

    try {
      const [result] = await this.pool.execute(`DELETE FROM \`${tableName}\` WHERE expiresAt < ?`, [
        Date.now(),
      ]);

      const deletedCount = result.affectedRows || 0;

      if (deletedCount > 0) {
        console.log(`[DatabaseManager] ✓ Cleaned up ${deletedCount} expired verification tokens`);
      }

      return deletedCount;
    } catch (error) {
      throw new Error(`Failed to clean up verification tokens: ${error.message}`);
    }
  }

  /**
   * Clean up revoked refresh tokens
   * MAINTENANCE: Should be called periodically (e.g., daily via cron job)
   * Removes revoked tokens that have expired to prevent table bloat
   * @param {string} tableName - Refresh tokens table name
   * @param {number} daysToKeep - Number of days to retain revoked records (default: 7)
   * @returns {Promise<number>} Number of tokens deleted
   */
  async cleanupRevokedRefreshTokens(tableName, daysToKeep = 7) {
    this._ensureConnected();

    if (typeof daysToKeep !== 'number' || daysToKeep < 1) {
      throw new Error('daysToKeep must be a positive number');
    }

    try {
      const cutoffDate = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

      const [result] = await this.pool.execute(
        `DELETE FROM \`${tableName}\` 
         WHERE revoked = TRUE AND expiresAt < ?`,
        [cutoffDate]
      );

      const deletedCount = result.affectedRows || 0;

      if (deletedCount > 0) {
        console.log(
          `[DatabaseManager] ✓ Cleaned up ${deletedCount} revoked refresh tokens ` +
            `(older than ${daysToKeep} days)`
        );
      }

      return deletedCount;
    } catch (error) {
      throw new Error(`Failed to clean up revoked tokens: ${error.message}`);
    }
  }

  /**
   * Perform comprehensive database maintenance
   * Cleans up all expired records in one operation
   * RECOMMENDED: Schedule this to run daily during low-traffic periods
   * @param {Object} tables - Table configuration object with table names
   * @param {Object} options - Cleanup options
   * @returns {Promise<Object>} Summary of cleanup operations
   */
  async performMaintenance(tables, options = {}) {
    this._ensureConnected();

    const {
      cleanupLoginAttempts = true,
      loginAttemptsRetentionDays = 30,
      cleanupVerificationTokens = true,
      cleanupRevokedTokens = true,
      revokedTokensRetentionDays = 7,
    } = options;

    console.log('[DatabaseManager] Starting database maintenance cleanup...');

    const results = {
      loginAttemptsDeleted: 0,
      verificationTokensDeleted: 0,
      revokedTokensDeleted: 0,
      startTime: new Date(),
    };

    try {
      if (cleanupLoginAttempts && tables.loginAttempts) {
        results.loginAttemptsDeleted = await this.cleanupExpiredLoginAttempts(
          tables.loginAttempts,
          loginAttemptsRetentionDays
        );
      }

      if (cleanupVerificationTokens && tables.verificationTokens) {
        results.verificationTokensDeleted = await this.cleanupExpiredVerificationTokens(
          tables.verificationTokens
        );
      }

      if (cleanupRevokedTokens && tables.refreshTokens) {
        results.revokedTokensDeleted = await this.cleanupRevokedRefreshTokens(
          tables.refreshTokens,
          revokedTokensRetentionDays
        );
      }

      results.endTime = new Date();
      results.duration = results.endTime - results.startTime;

      console.log(
        `[DatabaseManager] ✓ Maintenance complete ` +
          `(${results.duration}ms, ${results.loginAttemptsDeleted + results.verificationTokensDeleted + results.revokedTokensDeleted} total records cleaned)`
      );

      return results;
    } catch (error) {
      console.error('[DatabaseManager] Maintenance failed:', error.message);
      throw error;
    }
  }

  /**
   * Ensure pool is connected
   * @private
   */
  _ensureConnected() {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
  }
}

module.exports = DatabaseManager;
