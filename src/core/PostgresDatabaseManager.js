const { Pool } = require('pg');

/**
 * PostgresDatabaseManager - Handles all database operations for PostgreSQL
 * Auto-creates tables, indexes, and manages connections
 */
class PostgresDatabaseManager {
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

      // Map MySQL-style config to PostgreSQL Pool options
      const pgConfig = {
        host: this.config.host,
        port: this.config.port || 5432,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        // Map connectionLimit to max for pg
        max: this.config.connectionLimit || this.config.max || 10,
        // PostgreSQL-specific options
        idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis || 2000,
        ssl: this.config.ssl || false,
      };

      this.pool = new Pool(pgConfig);

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

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
    const client = await this.pool.connect();

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

          // Convert MySQL types to PostgreSQL types
          let pgType = this._convertMySQLTypeToPG(field.type);

          // Quote field name to preserve case (especially for camelCase)
          let sql = `"${field.name}" ${pgType}`;
          if (field.required) sql += ' NOT NULL';

          // Handle default values
          if (field.defaultValue !== null && field.defaultValue !== undefined) {
            // For numeric types, don't quote
            if (
              ['INT', 'BIGINT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'NUMERIC', 'INTEGER'].some((t) =>
                pgType.toUpperCase().includes(t)
              )
            ) {
              sql += ` DEFAULT ${field.defaultValue}`;
            } else if (pgType.toUpperCase().includes('BOOLEAN')) {
              sql += ` DEFAULT ${field.defaultValue ? 'TRUE' : 'FALSE'}`;
            } else {
              // For string types, escape properly
              const escapedValue = field.defaultValue.toString().replace(/'/g, "''");
              sql += ` DEFAULT '${escapedValue}'`;
            }
          }

          if (field.unique) sql += ' UNIQUE';
          return sql;
        })
        .join(',\n    ');

      // Users table
      const usersTableSQL = `
        CREATE TABLE IF NOT EXISTS "${tables.users}" (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          "firstName" VARCHAR(100),
          "lastName" VARCHAR(100),
          "emailVerified" BOOLEAN DEFAULT FALSE,
          "emailVerificationToken" VARCHAR(255),
          "resetPasswordToken" VARCHAR(255),
          "resetPasswordExpires" BIGINT,
          "isActive" BOOLEAN DEFAULT TRUE,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ${customFieldsSQL ? ',' + customFieldsSQL : ''}
        );
      `;

      // Refresh tokens table
      const refreshTokensTableSQL = `
        CREATE TABLE IF NOT EXISTS "${tables.refreshTokens}" (
          id SERIAL PRIMARY KEY,
          "userId" INTEGER NOT NULL,
          token TEXT NOT NULL,
          revoked BOOLEAN DEFAULT FALSE,
          "expiresAt" BIGINT NOT NULL,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("userId") REFERENCES "${tables.users}"(id) ON DELETE CASCADE
        );
      `;

      // Login attempts table
      const loginAttemptsTableSQL = `
        CREATE TABLE IF NOT EXISTS "${tables.loginAttempts}" (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          success BOOLEAN DEFAULT FALSE,
          "ipAddress" VARCHAR(45),
          "userAgent" TEXT,
          "attemptedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // Email verification tokens table
      const verificationTokensTableSQL = `
        CREATE TABLE IF NOT EXISTS "${tables.verificationTokens}" (
          id SERIAL PRIMARY KEY,
          "userId" INTEGER NOT NULL,
          token VARCHAR(255) NOT NULL UNIQUE,
          "expiresAt" BIGINT NOT NULL,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("userId") REFERENCES "${tables.users}"(id) ON DELETE CASCADE
        );
      `;

      // Create trigger function for updated_at
      const triggerFunctionSQL = `
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `;

      await client.query(usersTableSQL);
      await client.query(refreshTokensTableSQL);
      await client.query(loginAttemptsTableSQL);
      await client.query(verificationTokensTableSQL);

      // Create trigger function (CREATE OR REPLACE makes it idempotent)
      await client.query(triggerFunctionSQL);

      // Create trigger for users table (drop first to make it idempotent)
      try {
        await client.query(`DROP TRIGGER IF EXISTS update_users_updated_at ON "${tables.users}";`);
        await client.query(`
          CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON "${tables.users}"
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        `);
      } catch (error) {
        // Trigger might not exist on first run, that's okay
        if (!error.message.includes('does not exist')) {
          console.warn(`Trigger creation warning: ${error.message}`);
        }
      }
    } finally {
      client.release();
    }
  }

  /**
   * Convert MySQL types to PostgreSQL types
   */
  _convertMySQLTypeToPG(mysqlType) {
    const typeUpper = mysqlType.toUpperCase();

    // Handle ENUM specially
    if (typeUpper.includes('ENUM')) {
      // Extract enum values and convert to CHECK constraint format
      // For now, return VARCHAR and let validation happen at app level
      return 'VARCHAR(50)';
    }

    // INT variations (order matters - check BIGINT before INT, TINYINT before INT)
    if (typeUpper.includes('TINYINT(1)')) return 'BOOLEAN';
    if (typeUpper.includes('BIGINT')) return 'BIGINT';
    if (typeUpper.includes('INT')) return 'INTEGER';
    if (typeUpper === 'BOOLEAN') return 'BOOLEAN';

    // String types
    if (typeUpper.includes('VARCHAR')) return mysqlType.replace(/varchar/i, 'VARCHAR');
    if (typeUpper.includes('TEXT')) return 'TEXT';
    if (typeUpper.includes('CHAR')) return mysqlType.replace(/char/i, 'CHAR');

    // Numeric types (order matters - check DOUBLE before FLOAT)
    if (typeUpper.includes('DOUBLE')) return 'DOUBLE PRECISION';
    if (typeUpper.includes('FLOAT')) return 'REAL';
    if (typeUpper.includes('DECIMAL')) return mysqlType.replace(/decimal/i, 'DECIMAL');
    if (typeUpper.includes('NUMERIC')) return mysqlType.replace(/numeric/i, 'NUMERIC');

    // Date/Time types (order matters - check DATETIME before DATE)
    if (typeUpper.includes('DATETIME')) return 'TIMESTAMP';
    if (typeUpper.includes('TIMESTAMP')) return 'TIMESTAMP';
    if (typeUpper.includes('DATE')) return 'DATE';
    if (typeUpper.includes('TIME')) return 'TIME';

    // Default - return as-is
    return mysqlType;
  }

  /**
   * Create indexes for performance
   */
  async createIndexes(tables) {
    const client = await this.pool.connect();

    try {
      // These indexes improve query performance
      const indexes = [
        `CREATE INDEX IF NOT EXISTS idx_email ON "${tables.users}"(email)`,
        `CREATE INDEX IF NOT EXISTS idx_user_tokens ON "${tables.refreshTokens}"("userId", revoked)`,
        `CREATE INDEX IF NOT EXISTS idx_token_expires ON "${tables.refreshTokens}"("expiresAt")`,
        `CREATE INDEX IF NOT EXISTS idx_email_attempted ON "${tables.loginAttempts}"(email, "attemptedAt")`,
        `CREATE INDEX IF NOT EXISTS idx_token ON "${tables.verificationTokens}"(token)`,
        `CREATE INDEX IF NOT EXISTS idx_user_token ON "${tables.verificationTokens}"("userId", token)`,
      ];

      for (const indexSQL of indexes) {
        try {
          await client.query(indexSQL);
        } catch (error) {
          // Index might already exist, continue
          if (!error.message.includes('already exists')) {
            console.warn(`Index creation warning: ${error.message}`);
          }
        }
      }
    } finally {
      client.release();
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

    const result = await this.pool.query(`SELECT * FROM "${tableName}" WHERE email = $1 LIMIT 1`, [
      email,
    ]);
    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   */
  async findUserById(userId, tableName) {
    this._ensureConnected();

    if (!userId) {
      return null;
    }

    const result = await this.pool.query(`SELECT * FROM "${tableName}" WHERE id = $1 LIMIT 1`, [
      userId,
    ]);
    return result.rows[0] || null;
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
    const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');

    // Quote field names for PostgreSQL
    const quotedFields = fields.map((field) => `"${field}"`).join(', ');

    const sql = `INSERT INTO "${tableName}" (${quotedFields}) VALUES (${placeholders}) RETURNING id`;

    const result = await this.pool.query(sql, values);
    return result.rows[0].id;
  }

  /**
   * Update user
   */
  async updateUser(userId, updates, tableName) {
    this._ensureConnected();

    if (!userId || !updates || typeof updates !== 'object') {
      throw new Error('User ID and updates object are required');
    }

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Validate number of fields
    if (fields.length > 50) {
      throw new Error('Too many fields. Maximum 50 fields allowed per update.');
    }

    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `"${field}" = $${i + 1}`).join(', ');

    const sql = `UPDATE "${tableName}" SET ${setClause} WHERE id = $${fields.length + 1}`;

    const result = await this.pool.query(sql, [...values, userId]);
    return result.rowCount > 0;
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

    const sql = `
      INSERT INTO "${tableName}" ("userId", token, "expiresAt")
      VALUES ($1, $2, $3)
      RETURNING id
    `;

    const result = await this.pool.query(sql, [userId, tokenHash, expiresAt]);
    return result.rows[0].id;
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

    const sql = `
      SELECT * FROM "${tableName}"
      WHERE token = $1 AND revoked = FALSE AND "expiresAt" > $2
      LIMIT 1
    `;

    const result = await this.pool.query(sql, [tokenHash, Date.now()]);
    return result.rows[0] || null;
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

    const sql = `
      UPDATE "${tableName}"
      SET revoked = TRUE
      WHERE token = $1
    `;

    const result = await this.pool.query(sql, [tokenHash]);
    return result.rowCount > 0;
  }

  /**
   * Revoke all user tokens
   */
  async revokeAllUserTokens(userId, tableName) {
    this._ensureConnected();

    if (!userId) {
      throw new Error('User ID is required');
    }

    const sql = `
      UPDATE "${tableName}"
      SET revoked = TRUE
      WHERE "userId" = $1 AND revoked = FALSE
    `;

    const result = await this.pool.query(sql, [userId]);
    return result.rowCount;
  }

  /**
   * Record login attempt
   */
  async recordLoginAttempt(email, success, tableName, ipAddress = null, userAgent = null) {
    this._ensureConnected();

    const sql = `
      INSERT INTO "${tableName}" (email, success, "ipAddress", "userAgent")
      VALUES ($1, $2, $3, $4)
    `;

    await this.pool.query(sql, [email, success, ipAddress, userAgent]);
  }

  /**
   * Check if account is locked
   */
  async isAccountLocked(email, tableName, maxAttempts, lockoutTime) {
    this._ensureConnected();

    const cutoffTime = new Date(Date.now() - lockoutTime);

    const sql = `
      SELECT COUNT(*) as count
      FROM "${tableName}"
      WHERE email = $1 AND success = FALSE AND "attemptedAt" > $2
    `;

    const result = await this.pool.query(sql, [email, cutoffTime]);
    const failedAttempts = parseInt(result.rows[0].count);

    return failedAttempts >= maxAttempts;
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens(tableName) {
    this._ensureConnected();

    const sql = `DELETE FROM "${tableName}" WHERE "expiresAt" < $1`;
    const result = await this.pool.query(sql, [Date.now()]);
    return result.rowCount;
  }

  /**
   * Get user count
   */
  async getUserCount(tableName) {
    this._ensureConnected();

    const result = await this.pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count);
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * Get the connection pool with execute wrapper
   */
  getPool() {
    // Wrap the pool to add execute method to connections
    const originalConnect = this.pool.connect.bind(this.pool);
    const pool = this.pool;

    return {
      ...pool,
      connect: async () => {
        const client = await originalConnect();
        // Add execute method to client for MySQL compatibility
        if (!client.execute) {
          client.execute = async (sql, params = []) => {
            // Convert MySQL ? placeholders to PostgreSQL $1, $2, etc.
            let paramIndex = 1;
            let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

            // Convert MySQL backticks to PostgreSQL double quotes
            pgSql = pgSql.replace(/`/g, '"');

            // Quote camelCase column names to preserve case in PostgreSQL
            // Match patterns like: columnName, table.columnName, AS columnName
            // But skip if already quoted (negative lookbehind/lookahead for double quotes)
            pgSql = pgSql.replace(/(?<!")\b([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b(?!")/g, '"$1"');

            const result = await client.query(pgSql, params);

            // Add affectedRows property for MySQL compatibility
            const rows = result.rows;
            rows.affectedRows = result.rowCount;
            rows.insertId = result.rows[0]?.id; // For INSERT queries

            // Return in MySQL format: [rows, fields]
            return [rows, result.fields];
          };
        }
        // Add beginTransaction method for MySQL compatibility
        if (!client.beginTransaction) {
          client.beginTransaction = async () => {
            await client.query('BEGIN');
          };
        }
        // Add commit method for MySQL compatibility
        if (!client.commit) {
          client.commit = async () => {
            await client.query('COMMIT');
          };
        }
        // Add rollback method for MySQL compatibility
        if (!client.rollback) {
          client.rollback = async () => {
            await client.query('ROLLBACK');
          };
        }
        return client;
      },
      // Add getConnection as alias for connect (MySQL compatibility)
      getConnection: async () => {
        const client = await originalConnect();
        // Add execute method to client for MySQL compatibility
        if (!client.execute) {
          client.execute = async (sql, params = []) => {
            // Convert MySQL ? placeholders to PostgreSQL $1, $2, etc.
            let paramIndex = 1;
            let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

            // Convert MySQL backticks to PostgreSQL double quotes
            pgSql = pgSql.replace(/`/g, '"');

            // Quote camelCase column names to preserve case in PostgreSQL
            // Match patterns like: columnName, table.columnName, AS columnName
            // But skip if already quoted (negative lookbehind/lookahead for double quotes)
            pgSql = pgSql.replace(/(?<!")\b([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b(?!")/g, '"$1"');

            const result = await client.query(pgSql, params);

            // Add affectedRows property for MySQL compatibility
            const rows = result.rows;
            rows.affectedRows = result.rowCount;
            rows.insertId = result.rows[0]?.id; // For INSERT queries

            // Return in MySQL format: [rows, fields]
            return [rows, result.fields];
          };
        }
        // Add beginTransaction method for MySQL compatibility
        if (!client.beginTransaction) {
          client.beginTransaction = async () => {
            await client.query('BEGIN');
          };
        }
        // Add commit method for MySQL compatibility
        if (!client.commit) {
          client.commit = async () => {
            await client.query('COMMIT');
          };
        }
        // Add rollback method for MySQL compatibility
        if (!client.rollback) {
          client.rollback = async () => {
            await client.query('ROLLBACK');
          };
        }
        return client;
      },
      query: pool.query.bind(pool),
      end: pool.end.bind(pool),
      escape: (value) => {
        if (value === null || value === undefined) return 'NULL';
        if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
        return `'${String(value).replace(/'/g, "''")}'`;
      },
    };
  }

  /**
   * Execute a query (PostgreSQL adapter - maps to query with $1, $2 placeholders)
   * This method provides a consistent interface for both MySQL and PostgreSQL
   */
  async execute(sql, params = []) {
    // Convert MySQL ? placeholders to PostgreSQL $1, $2, etc.
    let paramIndex = 1;
    let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

    // Convert MySQL backticks to PostgreSQL double quotes
    pgSql = pgSql.replace(/`/g, '"');

    // Quote camelCase column names to preserve case in PostgreSQL
    // Match patterns like: columnName, table.columnName, AS columnName
    // But skip if already quoted (negative lookbehind/lookahead for double quotes)
    pgSql = pgSql.replace(/(?<!")\b([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b(?!")/g, '"$1"');

    const result = await this.pool.query(pgSql, params);

    // Add affectedRows property for MySQL compatibility
    const rows = result.rows;
    rows.affectedRows = result.rowCount;
    rows.insertId = result.rows[0]?.id; // For INSERT queries

    // Return in MySQL format: [rows, fields]
    return [rows, result.fields];
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

      const result = await this.pool.query(`DELETE FROM "${tableName}" WHERE "attemptedAt" < $1`, [
        cutoffDate,
      ]);

      const deletedCount = result.rowCount || 0;

      console.log(
        `[PostgresDatabaseManager] ✓ Cleaned up ${deletedCount} expired login attempts ` +
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
      const result = await this.pool.query(`DELETE FROM "${tableName}" WHERE "expiresAt" < $1`, [
        Date.now(),
      ]);

      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        console.log(
          `[PostgresDatabaseManager] ✓ Cleaned up ${deletedCount} expired verification tokens`
        );
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

      const result = await this.pool.query(
        `DELETE FROM "${tableName}" 
         WHERE "revoked" = true AND "expiresAt" < $1`,
        [cutoffDate]
      );

      const deletedCount = result.rowCount || 0;

      if (deletedCount > 0) {
        console.log(
          `[PostgresDatabaseManager] ✓ Cleaned up ${deletedCount} revoked refresh tokens ` +
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

    console.log('[PostgresDatabaseManager] Starting database maintenance cleanup...');

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
        `[PostgresDatabaseManager] ✓ Maintenance complete ` +
          `(${results.duration}ms, ${results.loginAttemptsDeleted + results.verificationTokensDeleted + results.revokedTokensDeleted} total records cleaned)`
      );

      return results;
    } catch (error) {
      console.error('[PostgresDatabaseManager] Maintenance failed:', error.message);
      throw error;
    }
  }

  /**
   * Execute raw query (use with caution)
   */
  async query(sql, params = []) {
    this._ensureConnected();
    return await this.pool.query(sql, params);
  }

  /**
   * Check if a column exists in a table
   */
  async columnExists(tableName, columnName) {
    this._ensureConnected();

    try {
      const result = await this.pool.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = $1 AND column_name = $2`,
        [tableName, columnName]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('[PostgresDatabaseManager] Error checking column existence:', error.message);
      return false;
    }
  }

  /**
   * Escape SQL values safely for use in queries
   */
  escapeValue(value) {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    // Escape single quotes for PostgreSQL
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  /**
   * Get count of users in a table
   */
  async getUserCount(tableName) {
    this._ensureConnected();

    try {
      const result = await this.pool.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error('[PostgresDatabaseManager] Error getting user count:', error.message);
      return 0;
    }
  }

  /**
   * Ensure connection is established
   */
  _ensureConnected() {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
  }
}

module.exports = PostgresDatabaseManager;
