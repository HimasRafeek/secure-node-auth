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
      const customFieldsSQL = customFields.map(field => {
        // Validate field name to prevent SQL injection
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.name)) {
          throw new Error(`Invalid field name: ${field.name}. Only alphanumeric and underscore allowed.`);
        }
        
        let sql = `\`${field.name}\` ${field.type}`;
        if (field.required) sql += ' NOT NULL';
        
        // Properly handle default values based on type
        if (field.defaultValue !== null && field.defaultValue !== undefined) {
          // For numeric types, don't quote
          if (['INT', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL'].some(t => field.type.toUpperCase().startsWith(t))) {
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
      }).join(',\n    ');

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
        `CREATE INDEX IF NOT EXISTS idx_token_expires ON \`${tables.refreshTokens}\`(expiresAt)`
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
    
    const [rows] = await this.pool.execute(
      `SELECT * FROM \`${tableName}\` WHERE id = ? LIMIT 1`,
      [userId]
    );
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
    const escapedFields = fields.map(field => `\`${field}\``).join(', ');
    
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
    const setClause = fields.map(field => `\`${field}\` = ?`).join(', ');
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
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000);
    
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
    await this.pool.execute(
      `DELETE FROM \`${tableName}\` WHERE expiresAt < ?`,
      [Date.now()]
    );
  }

  /**
   * Get user count (for analytics)
   */
  async getUserCount(tableName) {
    this._ensureConnected();
    const [rows] = await this.pool.execute(
      `SELECT COUNT(*) as count FROM \`${tableName}\``
    );
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
