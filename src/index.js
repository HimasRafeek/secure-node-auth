const DatabaseFactory = require('./core/DatabaseFactory');
const TokenService = require('./core/TokenService');
const SecurityService = require('./core/SecurityService');
const EmailService = require('./core/EmailService');
const AuthRoutes = require('./middleware/AuthRoutes');

/**
 * SecureNodeAuth - Main authentication system class
 * Zero-config MySQL authentication with JWT
 */
class SecureNodeAuth {
  constructor(options = {}) {
    this.options = this._validateOptions(options);

    // Initialize core services - use DatabaseFactory to support multiple DB types
    this.db = DatabaseFactory.create(this.options.connection);
    this.tokenService = new TokenService(this.options.jwt);
    this.security = new SecurityService(this.options.security);

    // Custom fields storage
    this.customFields = [];

    // Email service (initialized after db connection)
    this.emailService = null;

    // Audit logger (can be overridden by user)
    this.auditLogger = options.auditLogger || this._defaultAuditLogger.bind(this);

    // Hooks system
    this.hooks = {
      beforeRegister: [],
      afterRegister: [],
      beforeLogin: [],
      afterLogin: [],
      beforeTokenRefresh: [],
      afterTokenRefresh: [],
    };

    // Initialization state
    this.initialized = false;
  }

  /**
   * Validate and set default options
   */
  _validateOptions(options) {
    const defaults = {
      connection: {
        type: process.env.DB_TYPE || 'mysql', // 'mysql' or 'postgres'
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'secure_node_auth',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined, // Auto-detect based on type
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      },
      jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || 'change_this_secret_in_production',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'change_this_refresh_secret_in_production',
        accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      },
      security: {
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,
        lockoutTime: parseInt(process.env.LOCKOUT_TIME, 10) || 15 * 60 * 1000, // 15 minutes
        requireEmailVerification: false,
        passwordMinLength: 8,
        passwordRequireUppercase: true,
        passwordRequireNumbers: true,
        passwordRequireSpecialChars: true,
      },
      tables: {
        users: 'secure_auth_users',
        refreshTokens: 'secure_auth_refresh_tokens',
        loginAttempts: 'secure_auth_login_attempts',
        verificationTokens: 'secure_auth_verification_tokens',
      },
      smtp: {
        host: process.env.SMTP_HOST || null,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true' || false,
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : null,
        from: process.env.SMTP_FROM || process.env.SMTP_USER || null,
      },
      emailTemplates: null, // Custom email templates (optional)
      autoInit: true,
    };

    // Merge with user options
    const merged = {
      ...defaults,
      ...options,
      connection: { ...defaults.connection, ...(options.connection || {}) },
      jwt: { ...defaults.jwt, ...(options.jwt || {}) },
      security: { ...defaults.security, ...(options.security || {}) },
      tables: { ...defaults.tables, ...(options.tables || {}) },
      smtp: { ...defaults.smtp, ...(options.smtp || {}) },
      emailTemplates: options.emailTemplates || defaults.emailTemplates,
    };

    // Set default port based on database type if not specified
    if (!merged.connection.port) {
      const dbType = (merged.connection.type || 'mysql').toLowerCase();
      merged.connection.port =
        dbType === 'postgres' || dbType === 'postgresql' || dbType === 'pg' ? 5432 : 3306;
    }

    // Validate critical numeric values
    if (
      isNaN(merged.security.bcryptRounds) ||
      merged.security.bcryptRounds < 4 ||
      merged.security.bcryptRounds > 31
    ) {
      merged.security.bcryptRounds = 10;
      console.warn('[SecureNodeAuth] Invalid bcryptRounds, using default: 10');
    }

    if (isNaN(merged.security.maxLoginAttempts) || merged.security.maxLoginAttempts < 1) {
      merged.security.maxLoginAttempts = 5;
      console.warn('[SecureNodeAuth] Invalid maxLoginAttempts, using default: 5');
    }

    if (isNaN(merged.security.lockoutTime) || merged.security.lockoutTime < 0) {
      merged.security.lockoutTime = 15 * 60 * 1000;
      console.warn('[SecureNodeAuth] Invalid lockoutTime, using default: 15 minutes');
    }

    // SECURITY: Validate JWT secrets for production environment
    this._validateJWTSecrets(merged.jwt);

    return merged;
  }

  /**
   * Validate JWT secrets for security requirements
   * Enforces strict requirements in production environment
   * @private
   */
  _validateJWTSecrets(jwtConfig) {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';

    const accessSecretIsDefault = jwtConfig.accessSecret === 'change_this_secret_in_production';
    const refreshSecretIsDefault =
      jwtConfig.refreshSecret === 'change_this_refresh_secret_in_production';

    // CRITICAL: In production, abort if defaults are used
    if (isProduction && (accessSecretIsDefault || refreshSecretIsDefault)) {
      const error = new Error(
        'CRITICAL SECURITY ERROR: Default JWT secrets detected in production environment. ' +
          'You must set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables ' +
          'to cryptographically secure values before starting in production.'
      );
      error.code = 'ERR_JWT_SECRETS_NOT_CONFIGURED';
      throw error;
    }

    // CRITICAL: Minimum length requirement
    const MIN_SECRET_LENGTH = 32;
    if (jwtConfig.accessSecret.length < MIN_SECRET_LENGTH) {
      const error = new Error(
        `CRITICAL SECURITY ERROR: JWT_ACCESS_SECRET must be at least ${MIN_SECRET_LENGTH} characters long. ` +
          `Current length: ${jwtConfig.accessSecret.length}. ` +
          'Use a cryptographically secure random string (e.g., openssl rand -base64 32).'
      );
      error.code = 'ERR_JWT_ACCESS_SECRET_TOO_SHORT';

      if (isProduction) {
        throw error;
      } else {
        console.error('[SecureNodeAuth] ⚠️  WARNING: ' + error.message);
      }
    }

    if (jwtConfig.refreshSecret.length < MIN_SECRET_LENGTH) {
      const error = new Error(
        `CRITICAL SECURITY ERROR: JWT_REFRESH_SECRET must be at least ${MIN_SECRET_LENGTH} characters long. ` +
          `Current length: ${jwtConfig.refreshSecret.length}. ` +
          'Use a cryptographically secure random string (e.g., openssl rand -base64 32).'
      );
      error.code = 'ERR_JWT_REFRESH_SECRET_TOO_SHORT';

      if (isProduction) {
        throw error;
      } else {
        console.error('[SecureNodeAuth] ⚠️  WARNING: ' + error.message);
      }
    }

    // Secrets must be different
    if (jwtConfig.accessSecret === jwtConfig.refreshSecret) {
      const error = new Error(
        'CRITICAL SECURITY ERROR: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different. ' +
          'Using the same secret for both token types defeats the purpose of token separation.'
      );
      error.code = 'ERR_JWT_SECRETS_IDENTICAL';
      throw error;
    }

    // Warn if using default values in development
    if ((isDevelopment || !isProduction) && (accessSecretIsDefault || refreshSecretIsDefault)) {
      console.warn(
        '[SecureNodeAuth] ⚠️  WARNING: Using default JWT secrets. ' +
          'These should ONLY be used for development/testing. ' +
          'In production, set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET to secure random values.'
      );
    }

    // Log secret validation status
    console.log('[SecureNodeAuth] ✓ JWT secrets validated securely');
  }

  /**
   * Initialize the authentication system
   * Creates tables, indexes, and sets up the database
   */
  async init() {
    if (this.initialized) {
      console.warn('[SecureNodeAuth] Already initialized');
      return this;
    }

    try {
      console.log('[SecureNodeAuth] Initializing authentication system...');

      // Validate table names
      const tableNames = Object.values(this.options.tables);
      for (const tableName of tableNames) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          throw new Error(
            `Invalid table name: ${tableName}. Must contain only alphanumeric characters and underscores.`
          );
        }
      }

      // Connect to database
      await this.db.connect();
      console.log('[SecureNodeAuth] ✓ Database connected');

      // Create tables with custom fields
      await this.db.createTables(this.options.tables, this.customFields);
      console.log('[SecureNodeAuth] ✓ Tables created/verified');

      // Create indexes for performance
      await this.db.createIndexes(this.options.tables);
      console.log('[SecureNodeAuth] ✓ Indexes created');

      // Initialize email service if SMTP configured
      this.emailService = new EmailService(this.options, this.db.pool, this.options.tables);
      if (this.options.smtp && this.options.smtp.host) {
        console.log('[SecureNodeAuth] ✓ Email service initialized');
      }

      this.initialized = true;
      console.log('[SecureNodeAuth] ✓ Initialization complete');

      return this;
    } catch (error) {
      console.error('[SecureNodeAuth] Initialization failed:', error.message);
      // Cleanup on failure
      try {
        await this.db.close();
      } catch (closeError) {
        // Ignore close errors
      }
      throw error;
    }
  }

  /**
   * Add custom field to user schema
   * Must be called before init()
   */
  addField(field) {
    if (this.initialized) {
      throw new Error(
        'Cannot add fields after initialization. Call addField() before init().\n\n' +
          '💡 For existing databases, use dangerouslyAddColumn() instead:\n' +
          '   auth.dangerouslyAddColumn({ name: "fieldName", type: "VARCHAR(255)" }, { confirmed: true })\n\n' +
          '⚠️  WARNING: dangerouslyAddColumn() can cause table locks and downtime.'
      );
    }

    if (!field || typeof field !== 'object') {
      throw new Error('Field must be an object');
    }

    const { name, type, required = false, defaultValue = null, unique = false } = field;

    if (!name || !type) {
      throw new Error('Field name and type are required');
    }

    if (typeof name !== 'string' || typeof type !== 'string') {
      throw new Error('Field name and type must be strings');
    }

    // Validate field name (alphanumeric and underscore only, must start with letter or underscore)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(
        `Invalid field name: ${name}. Must start with letter or underscore and contain only alphanumeric characters and underscores.`
      );
    }

    // Prevent overriding system fields
    const reservedFields = [
      'id',
      'email',
      'password',
      'createdAt',
      'updatedAt',
      'emailVerified',
      'emailVerificationToken',
      'resetPasswordToken',
      'resetPasswordExpires',
      'isActive',
    ];
    if (reservedFields.includes(name)) {
      throw new Error(`Field name '${name}' is reserved and cannot be used.`);
    }

    // Check for duplicate field names
    if (this.customFields.some((f) => f.name === name)) {
      throw new Error(`Field '${name}' already exists`);
    }

    this.customFields.push({
      name,
      type,
      required,
      defaultValue,
      unique,
    });

    console.log(`[SecureNodeAuth] Custom field added: ${name} (${type})`);
    return this;
  }

  /**
   * ⚠️ DANGEROUS: Add column to existing table at runtime
   *
   * This method adds a new column to an already initialized database table.
   * USE WITH EXTREME CAUTION - Can cause table locks and downtime on production databases.
   *
   * @param {Object} fieldConfig - Field configuration
   * @param {string} fieldConfig.name - Column name (alphanumeric and underscore only)
   * @param {string} fieldConfig.type - SQL data type (e.g., 'VARCHAR(20)', 'INTEGER', 'DECIMAL(10,2)')
   * @param {boolean} [fieldConfig.unique=false] - Add unique constraint
   * @param {boolean} [fieldConfig.required=false] - Add NOT NULL constraint (requires defaultValue if table has data)
   * @param {*} [fieldConfig.defaultValue] - Default value for existing and new rows
   * @param {Object} [options] - Migration options
   * @param {boolean} [options.confirmed=false] - REQUIRED: Must be true to proceed (safety check)
   * @param {boolean} [options.skipIfExists=true] - Skip if column already exists (safe retry)
   * @param {boolean} [options.skipIndexCreation=false] - Skip index creation for performance
   * @param {number} [options.warnThreshold=1000] - Warn if table has more rows than this
   * @returns {Promise<Object>} Migration result with success status and details
   *
   * @example
   * // Add optional column
   * await auth.dangerouslyAddColumn({
   *   name: 'phoneNumber',
   *   type: 'VARCHAR(20)',
   *   unique: true,
   * }, { confirmed: true });
   *
   * @example
   * // Add required column with default value
   * await auth.dangerouslyAddColumn({
   *   name: 'age',
   *   type: 'INTEGER',
   *   required: true,
   *   defaultValue: 0,
   * }, { confirmed: true });
   *
   * @throws {Error} If not initialized, not confirmed, or validation fails
   */
  async dangerouslyAddColumn(fieldConfig, options = {}) {
    const {
      confirmed = false,
      skipIfExists = true,
      skipIndexCreation = false,
      warnThreshold = 1000,
    } = options;

    // Safety check 1: Must be initialized
    if (!this.initialized) {
      throw new Error(
        '❌ Cannot add column before initialization.\n\n' +
          '   For new installations, use addField() BEFORE init():\n' +
          '   auth.addField({ name: "fieldName", type: "VARCHAR(255)" });\n' +
          '   await auth.init();\n'
      );
    }

    // Safety check 2: Require explicit confirmation
    if (!confirmed) {
      throw new Error(
        '\n' +
          '='.repeat(70) +
          '\n' +
          '⚠️  DANGEROUS OPERATION - EXPLICIT CONFIRMATION REQUIRED\n' +
          '='.repeat(70) +
          '\n\n' +
          '   This operation adds a column to an existing production table.\n' +
          '   Risks include:\n' +
          '   • Table locks blocking ALL queries during migration\n' +
          '   • Potential downtime on large tables (>10,000 rows)\n' +
          '   • Failed deployments if schema changes are rolled back\n' +
          '   • Data inconsistencies if migration is interrupted\n\n' +
          '📋 REQUIRED STEPS BEFORE PROCEEDING:\n' +
          '   1. ✅ Backup your database\n' +
          '   2. ✅ Test on a database copy first\n' +
          '   3. ✅ Schedule during low-traffic maintenance window\n' +
          '   4. ✅ Monitor table size and server load\n\n' +
          '📖 To proceed, pass { confirmed: true } in options:\n\n' +
          '   auth.dangerouslyAddColumn(fieldConfig, { confirmed: true })\n\n' +
          '='.repeat(70) +
          '\n'
      );
    }

    // Validate field configuration
    if (!fieldConfig || typeof fieldConfig !== 'object') {
      throw new Error('Field configuration must be an object');
    }

    const { name, type, unique = false, required = false, defaultValue } = fieldConfig;

    if (!name || !type) {
      throw new Error('Field name and type are required');
    }

    if (typeof name !== 'string' || typeof type !== 'string') {
      throw new Error('Field name and type must be strings');
    }

    // Validate field name (alphanumeric and underscore only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(
        `Invalid field name: "${name}"\n` +
          '   Field names must:\n' +
          '   • Start with a letter or underscore\n' +
          '   • Contain only letters, numbers, and underscores\n' +
          '   • Not contain spaces or special characters'
      );
    }

    // Prevent overriding system fields
    const reservedFields = [
      'id',
      'email',
      'password',
      'createdAt',
      'updatedAt',
      'emailVerified',
      'emailVerificationToken',
      'resetPasswordToken',
      'resetPasswordExpires',
      'isActive',
      'firstName',
      'lastName',
    ];
    if (reservedFields.includes(name)) {
      throw new Error(
        `Field name "${name}" is reserved by the system.\n` +
          `   Reserved fields: ${reservedFields.join(', ')}`
      );
    }

    const tableName = this.options.tables.users;
    const isPostgres = this.options.connection.type === 'postgres';

    try {
      console.log('\n' + '='.repeat(70));
      console.log('🚨 DANGEROUS OPERATION: ADDING COLUMN TO EXISTING TABLE');
      console.log('='.repeat(70));
      console.log(`📋 Table:    ${tableName}`);
      console.log(`📋 Column:   ${name}`);
      console.log(`📋 Type:     ${type}`);
      console.log(`📋 Unique:   ${unique ? 'Yes' : 'No'}`);
      console.log(`📋 Required: ${required ? 'Yes' : 'No'}`);
      console.log(`📋 Default:  ${defaultValue !== undefined ? defaultValue : 'NULL'}`);
      console.log('='.repeat(70) + '\n');

      // Step 1: Check if column already exists
      if (skipIfExists) {
        console.log('🔍 Checking if column already exists...');
        const exists = await this.db.columnExists(tableName, name);
        if (exists) {
          console.log(`⚠️  Column "${name}" already exists in table "${tableName}".`);
          console.log('   Skipping migration (safe retry).\n');
          return {
            success: true,
            skipped: true,
            columnName: name,
            reason: 'Column already exists',
          };
        }
        console.log('   Column does not exist. Proceeding with migration.\n');
      }

      // Step 2: Get table statistics and warn user
      console.log('📊 Analyzing table...');
      const rowCount = await this.db.getUserCount(tableName);
      console.log(`   Current rows: ${rowCount.toLocaleString()}`);

      if (rowCount > warnThreshold) {
        const estimatedSeconds = Math.ceil(rowCount / 10000); // Rough estimate
        console.log('\n' + '⚠️ '.repeat(35));
        console.log('⚠️  WARNING: LARGE TABLE DETECTED');
        console.log('⚠️ '.repeat(35));
        console.log(`   Table size: ${rowCount.toLocaleString()} rows`);
        console.log(`   Estimated lock time: ~${estimatedSeconds} seconds`);
        console.log(`   Impact: ALL queries will be blocked during migration`);
        console.log('⚠️ '.repeat(35));
        console.log('\n💡 Recommendations for large tables:');
        console.log('   • Run during scheduled maintenance window');
        console.log('   • Alert users about potential downtime');
        console.log('   • Monitor server CPU and memory during migration');
        if (!isPostgres) {
          console.log('   • Consider using pt-online-schema-change for MySQL');
        }
        console.log('');
      }

      // Step 3: Validate required field constraint
      if (required && defaultValue === undefined && rowCount > 0) {
        throw new Error(
          `❌ Cannot add required column "${name}" without a default value.\n\n` +
            `   The table "${tableName}" has ${rowCount.toLocaleString()} existing rows.\n` +
            `   A required (NOT NULL) column needs a value for all existing rows.\n\n` +
            '   Solutions:\n' +
            `   1. Add a default value:\n` +
            `      auth.dangerouslyAddColumn({\n` +
            `        name: '${name}',\n` +
            `        type: '${type}',\n` +
            `        required: true,\n` +
            `        defaultValue: 'your_default_value'\n` +
            `      }, { confirmed: true });\n\n` +
            `   2. Make the column optional:\n` +
            `      auth.dangerouslyAddColumn({\n` +
            `        name: '${name}',\n` +
            `        type: '${type}',\n` +
            `        required: false\n` +
            `      }, { confirmed: true });\n`
        );
      }

      // Step 4: Build ALTER TABLE statement
      console.log('🔨 Building ALTER TABLE statement...');
      let sql;

      if (isPostgres) {
        sql = `ALTER TABLE "${tableName}" ADD COLUMN "${name}" ${type}`;

        if (defaultValue !== undefined) {
          sql += ` DEFAULT ${this.db.escapeValue(defaultValue)}`;
        }
        if (required) {
          sql += ` NOT NULL`;
        }
        if (unique) {
          sql += ` UNIQUE`;
        }
      } else {
        // MySQL
        sql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${name}\` ${type}`;

        if (defaultValue !== undefined) {
          sql += ` DEFAULT ${this.db.escapeValue(defaultValue)}`;
        }
        if (required) {
          sql += ` NOT NULL`;
        }
        if (unique) {
          sql += ` UNIQUE`;
        }
      }

      console.log(`   SQL: ${sql}\n`);

      // Step 5: Execute ALTER TABLE
      console.log('⏳ Executing migration...');
      console.log('   (This may take several seconds for large tables)\n');

      const startTime = Date.now();
      await this.db.query(sql);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`✅ Column "${name}" added successfully in ${duration}s\n`);

      // Step 6: Create index if needed (PostgreSQL: use CONCURRENTLY)
      if (unique && !skipIndexCreation) {
        console.log('🔍 Creating index for unique constraint...');
        const indexName = `idx_${tableName}_${name}`.substring(0, 63); // PostgreSQL limit

        try {
          if (isPostgres) {
            // CONCURRENTLY prevents table locks in PostgreSQL
            const indexSql = `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "${tableName}" ("${name}")`;
            await this.db.query(indexSql);
            console.log(`   Index "${indexName}" created (non-blocking)\n`);
          } else {
            // MySQL
            const indexSql = `CREATE INDEX \`${indexName}\` ON \`${tableName}\` (\`${name}\`)`;
            await this.db.query(indexSql);
            console.log(`   Index "${indexName}" created\n`);
          }
        } catch (indexError) {
          // Non-fatal: index might already exist from UNIQUE constraint
          console.warn(`   ⚠️  Index creation warning: ${indexError.message}\n`);
        }
      }

      // Step 7: Add to customFields for future operations
      this.customFields.push({
        name,
        type,
        unique,
        required,
        defaultValue,
      });

      console.log('='.repeat(70));
      console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
      console.log('='.repeat(70));
      console.log(`   Column "${name}" is now available in table "${tableName}"`);
      console.log(`   You can now use this field in register() and updateProfile()`);
      console.log('='.repeat(70) + '\n');

      return {
        success: true,
        columnName: name,
        tableName,
        rowsAffected: rowCount,
        duration: `${duration}s`,
      };
    } catch (error) {
      console.error('\n' + '='.repeat(70));
      console.error('❌ MIGRATION FAILED');
      console.error('='.repeat(70));
      console.error(`Error: ${error.message}\n`);
      console.error('💡 Troubleshooting steps:');
      console.error('   1. Check if column name is valid (alphanumeric and underscore only)');
      console.error('   2. Verify database permissions (ALTER TABLE required)');
      console.error('   3. Confirm SQL type is valid for your database');
      console.error('   4. Check database logs for detailed error information');
      console.error('   5. Ensure no other migrations are running simultaneously');
      console.error('='.repeat(70) + '\n');

      throw new Error(`Column migration failed: ${error.message}`);
    }
  }

  /**
   * ⚠️ DANGEROUS: Migrate multiple columns to existing table with transaction support
   *
   * This method adds multiple columns to an already initialized database table.
   * PostgreSQL: Uses transactions for atomic all-or-nothing operation.
   * MySQL: Executes sequentially (transactions don't support ALTER TABLE).
   *
   * USE WITH EXTREME CAUTION - Can cause extended table locks on production databases.
   *
   * @param {Array<Object>} fields - Array of field configurations (same format as dangerouslyAddColumn)
   * @param {Object} [options] - Migration options
   * @param {boolean} [options.confirmed=false] - REQUIRED: Must be true to proceed
   * @param {boolean} [options.useTransaction=true] - Wrap in transaction (PostgreSQL only)
   * @param {boolean} [options.rollbackOnError=true] - Rollback on any error (PostgreSQL only)
   * @param {boolean} [options.skipIfExists=true] - Skip columns that already exist
   * @param {boolean} [options.skipIndexCreation=false] - Skip index creation
   * @param {number} [options.warnThreshold=1000] - Warn if table has more rows
   * @returns {Promise<Object>} Migration result with statistics
   *
   * @example
   * // Add multiple columns safely
   * await auth.dangerouslyMigrateSchema([
   *   { name: 'phoneNumber', type: 'VARCHAR(20)', unique: true },
   *   { name: 'age', type: 'INTEGER', defaultValue: 0 },
   *   { name: 'city', type: 'VARCHAR(100)' },
   * ], {
   *   confirmed: true,
   *   useTransaction: true  // PostgreSQL: all-or-nothing
   * });
   *
   * @throws {Error} If not initialized, not confirmed, or any migration fails
   */
  async dangerouslyMigrateSchema(fields, options = {}) {
    const {
      confirmed = false,
      useTransaction = true,
      rollbackOnError = true,
      skipIfExists = true,
      skipIndexCreation = false,
      warnThreshold = 1000,
    } = options;

    // Safety check 1: Must be initialized
    if (!this.initialized) {
      throw new Error(
        '❌ Cannot migrate schema before initialization.\n\n' +
          '   For new installations, use addField() BEFORE init():\n' +
          '   auth.addField({ name: "field1", type: "VARCHAR(255)" });\n' +
          '   auth.addField({ name: "field2", type: "INTEGER" });\n' +
          '   await auth.init();\n'
      );
    }

    // Safety check 2: Require explicit confirmation
    if (!confirmed) {
      throw new Error(
        '\n' +
          '='.repeat(70) +
          '\n' +
          '⚠️  BULK SCHEMA MIGRATION - EXPLICIT CONFIRMATION REQUIRED\n' +
          '='.repeat(70) +
          '\n\n' +
          `   About to add ${fields.length} column(s) to existing production table.\n` +
          '   This operation may cause extended table locks.\n\n' +
          '   Risks include:\n' +
          '   • Extended table locks blocking queries\n' +
          '   • Longer downtime than single column addition\n' +
          '   • Cannot easily reverse structure changes\n' +
          '   • Failed rollback may leave partial changes (MySQL)\n\n' +
          '📋 REQUIRED STEPS:\n' +
          '   1. ✅ Backup database\n' +
          '   2. ✅ Test on copy first\n' +
          '   3. ✅ Schedule maintenance window\n' +
          '   4. ✅ Alert users about downtime\n\n' +
          '📖 To proceed, pass { confirmed: true }:\n\n' +
          '   auth.dangerouslyMigrateSchema(fields, { confirmed: true })\n\n' +
          '='.repeat(70) +
          '\n'
      );
    }

    // Validate fields array
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error('Fields must be a non-empty array of field configurations');
    }

    if (fields.length > 20) {
      console.warn(
        `⚠️  WARNING: Adding ${fields.length} columns in one migration.\n` +
          '   Consider breaking this into smaller batches for safety.\n'
      );
    }

    const isPostgres = this.options.connection.type === 'postgres';
    const tableName = this.options.tables.users;
    const results = {
      success: false,
      fieldsAdded: 0,
      fieldsSkipped: 0,
      fieldsProcessed: 0,
      totalFields: fields.length,
      duration: 0,
      columns: [],
    };

    console.log('\n' + '='.repeat(70));
    console.log('🚨 DANGEROUS BULK MIGRATION: ADDING MULTIPLE COLUMNS');
    console.log('='.repeat(70));
    console.log(`📋 Table:          ${tableName}`);
    console.log(`📋 Columns to add: ${fields.length}`);
    console.log(`📋 Database:       ${isPostgres ? 'PostgreSQL' : 'MySQL'}`);
    console.log(
      `📋 Transaction:    ${useTransaction && isPostgres ? 'Yes (atomic)' : 'No (sequential)'}`
    );
    console.log('='.repeat(70) + '\n');

    const startTime = Date.now();

    try {
      if (useTransaction && isPostgres) {
        // PostgreSQL with transaction: Atomic all-or-nothing
        console.log('🔒 Starting transaction (all-or-nothing mode)...\n');

        const client = await this.db.getPool().connect();
        try {
          await client.query('BEGIN');
          console.log('✅ Transaction started\n');

          for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            console.log(`[${i + 1}/${fields.length}] Processing column: ${field.name}...`);

            const result = await this.dangerouslyAddColumn(field, {
              ...options,
              confirmed: true, // Already confirmed at bulk level
            });

            results.fieldsProcessed++;
            if (result.skipped) {
              results.fieldsSkipped++;
              console.log(`   ⏭️  Skipped (already exists)\n`);
            } else {
              results.fieldsAdded++;
              results.columns.push(field.name);
              console.log(`   ✅ Added successfully\n`);
            }
          }

          await client.query('COMMIT');
          console.log('✅ Transaction committed - all changes applied\n');
          results.success = true;
        } catch (error) {
          if (rollbackOnError) {
            await client.query('ROLLBACK');
            console.error('❌ Transaction rolled back - no changes applied\n');
            throw new Error(
              `Migration failed on column "${fields[results.fieldsProcessed]?.name || 'unknown'}":\n` +
                `   ${error.message}\n` +
                `   All changes have been rolled back.`
            );
          } else {
            throw error;
          }
        } finally {
          client.release();
        }
      } else {
        // MySQL or no transaction: Sequential execution
        if (useTransaction && !isPostgres) {
          console.log('⚠️  MySQL does not support transactional DDL (ALTER TABLE).');
          console.log('   Executing migrations sequentially without rollback capability.\n');
        } else {
          console.log('⚠️  Running without transaction - changes cannot be rolled back.\n');
        }

        for (let i = 0; i < fields.length; i++) {
          const field = fields[i];
          console.log(`[${i + 1}/${fields.length}] Processing column: ${field.name}...`);

          try {
            const result = await this.dangerouslyAddColumn(field, {
              ...options,
              confirmed: true,
            });

            results.fieldsProcessed++;
            if (result.skipped) {
              results.fieldsSkipped++;
              console.log(`   ⏭️  Skipped (already exists)\n`);
            } else {
              results.fieldsAdded++;
              results.columns.push(field.name);
              console.log(`   ✅ Added successfully\n`);
            }
          } catch (error) {
            console.error(`\n❌ Failed to add column "${field.name}": ${error.message}\n`);

            if (rollbackOnError) {
              throw new Error(
                `Migration failed on column "${field.name}":\n` +
                  `   ${error.message}\n` +
                  `   ${results.fieldsAdded} column(s) were added before failure.\n` +
                  `   ⚠️  WARNING: Cannot automatically rollback (no transaction support).`
              );
            } else {
              console.warn(`⚠️  Continuing with remaining columns (rollbackOnError=false)...\n`);
            }
          }
        }

        results.success = true;
      }

      results.duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log('='.repeat(70));
      console.log('✅ BULK MIGRATION COMPLETED');
      console.log('='.repeat(70));
      console.log(`   Total columns:     ${results.totalFields}`);
      console.log(`   Added:             ${results.fieldsAdded}`);
      console.log(`   Skipped:           ${results.fieldsSkipped}`);
      console.log(`   Duration:          ${results.duration}s`);
      if (results.columns.length > 0) {
        console.log(`   New columns:       ${results.columns.join(', ')}`);
      }
      console.log('='.repeat(70) + '\n');

      return results;
    } catch (error) {
      results.duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.error('\n' + '='.repeat(70));
      console.error('❌ BULK MIGRATION FAILED');
      console.error('='.repeat(70));
      console.error(`   Processed: ${results.fieldsProcessed}/${results.totalFields} columns`);
      console.error(`   Added:     ${results.fieldsAdded} columns`);
      console.error(`   Failed on: ${fields[results.fieldsProcessed]?.name || 'unknown'}`);
      console.error(`   Duration:  ${results.duration}s`);
      console.error(`\n   Error: ${error.message}`);
      console.error('='.repeat(70) + '\n');

      throw error;
    }
  }

  /**
   * Register a new user
   */
  async register(userData) {
    this._ensureInitialized();

    if (!userData || typeof userData !== 'object') {
      throw new Error('User data is required and must be an object');
    }

    if (!userData.email || !userData.password) {
      throw new Error('Email and password are required');
    }

    // Clone userData to avoid mutating the original
    const userDataCopy = { ...userData };

    // Run beforeRegister hooks
    await this._runHooks('beforeRegister', userDataCopy);

    // Validate user data (this may modify userDataCopy for sanitization)
    this.security.validateRegistrationData(userDataCopy, this.customFields);

    // Normalize email to lowercase to prevent duplicate accounts with different cases
    userDataCopy.email = userDataCopy.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await this.db.findUserByEmail(
      userDataCopy.email,
      this.options.tables.users
    );
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.security.hashPassword(userDataCopy.password);

    // Create user (database UNIQUE constraint will catch race conditions)
    let userId;
    try {
      userId = await this.db.createUser(
        { ...userDataCopy, password: hashedPassword },
        this.options.tables.users
      );
    } catch (error) {
      // Handle duplicate email from race condition
      if (error.message.includes('Duplicate entry') || error.code === 'ER_DUP_ENTRY') {
        throw new Error('User with this email already exists');
      }
      throw error;
    }

    // Generate tokens
    const tokens = await this.tokenService.generateTokens({ userId, email: userDataCopy.email });

    // Store refresh token
    await this.db.storeRefreshToken(userId, tokens.refreshToken, this.options.tables.refreshTokens);

    // Get created user
    const user = await this.db.findUserById(userId, this.options.tables.users);
    if (!user) {
      throw new Error('Failed to retrieve created user');
    }
    delete user.password;

    const result = { user, tokens };

    // Audit log
    this.auditLogger('USER_REGISTERED', {
      userId: user.id,
      email: user.email,
      success: true,
    });

    // Send verification email if configured and required
    if (
      this.options.security.requireEmailVerification &&
      this.emailService &&
      this.emailService.transporter &&
      this.options.verificationUrl
    ) {
      try {
        await this.emailService.sendVerificationEmail(
          user.id,
          user.email,
          this.options.verificationUrl
        );
        console.log('[SecureNodeAuth] Verification email sent to:', user.email);
      } catch (emailError) {
        console.error('[SecureNodeAuth] Failed to send verification email:', emailError.message);
        // Don't fail registration if email fails
      }
    }

    // Run afterRegister hooks
    await this._runHooks('afterRegister', result);

    return result;
  }

  /**
   * Login user
   */
  async login(email, password) {
    this._ensureInitialized();

    // Validate inputs
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      throw new Error('Email and password are required');
    }

    // Normalize email to lowercase for consistent lookups
    email = email.trim().toLowerCase();

    // Run beforeLogin hooks
    await this._runHooks('beforeLogin', { email });

    // Check login attempts
    const isLocked = await this.db.isAccountLocked(
      email,
      this.options.tables.loginAttempts,
      this.options.security.maxLoginAttempts,
      this.options.security.lockoutTime
    );

    if (isLocked) {
      throw new Error('Account is temporarily locked due to too many failed login attempts');
    }

    // Find user
    const user = await this.db.findUserByEmail(email, this.options.tables.users);
    if (!user) {
      await this.db.recordLoginAttempt(email, false, this.options.tables.loginAttempts);
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await this.security.verifyPassword(password, user.password);
    if (!isValidPassword) {
      await this.db.recordLoginAttempt(email, false, this.options.tables.loginAttempts);
      throw new Error('Invalid email or password');
    }

    // Record successful login
    await this.db.recordLoginAttempt(email, true, this.options.tables.loginAttempts);

    // Generate tokens
    const tokens = await this.tokenService.generateTokens({
      userId: user.id,
      email: user.email,
    });

    // Store refresh token
    await this.db.storeRefreshToken(
      user.id,
      tokens.refreshToken,
      this.options.tables.refreshTokens
    );

    delete user.password;

    const result = { user, tokens };

    // Audit log
    this.auditLogger('USER_LOGIN', {
      userId: user.id,
      email: user.email,
      success: true,
    });

    // Run afterLogin hooks
    await this._runHooks('afterLogin', result);

    return result;
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    this._ensureInitialized();

    // Validate refresh token input
    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim() === '') {
      throw new Error('Invalid refresh token provided');
    }

    // Run beforeTokenRefresh hooks
    await this._runHooks('beforeTokenRefresh', { refreshToken });

    // Check if refresh token exists in database first (before expensive JWT verification)
    const storedToken = await this.db.findRefreshToken(
      refreshToken,
      this.options.tables.refreshTokens
    );

    if (!storedToken) {
      throw new Error('Invalid or revoked refresh token');
    }

    // Verify refresh token JWT signature
    const decoded = await this.tokenService.verifyRefreshToken(refreshToken);

    // Generate new access token
    const accessToken = await this.tokenService.generateAccessToken({
      userId: decoded.userId,
      email: decoded.email,
    });

    const result = { accessToken };

    // Audit log
    this.auditLogger('TOKEN_REFRESH', {
      userId: decoded.userId,
      email: decoded.email,
      success: true,
    });

    // Run afterTokenRefresh hooks
    await this._runHooks('afterTokenRefresh', result);

    return result;
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(refreshToken) {
    this._ensureInitialized();

    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new Error('Refresh token is required');
    }

    const affectedRows = await this.db.revokeRefreshToken(
      refreshToken,
      this.options.tables.refreshTokens
    );

    // Audit log
    this.auditLogger('USER_LOGOUT', {
      success: affectedRows > 0,
    });

    return { success: true, revoked: affectedRows > 0 };
  }

  /**
   * Logout from all devices (revoke all user's refresh tokens)
   */
  async logoutAll(userId) {
    this._ensureInitialized();

    if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
      throw new Error('Valid userId is required');
    }

    const affectedRows = await this.db.revokeAllUserTokens(
      userId,
      this.options.tables.refreshTokens
    );
    return { success: true, revokedCount: affectedRows };
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token) {
    return await this.tokenService.verifyAccessToken(token);
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    this._ensureInitialized();

    if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
      throw new Error('Valid userId is required');
    }

    const user = await this.db.findUserById(userId, this.options.tables.users);
    if (user) {
      delete user.password;
    }
    return user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email) {
    this._ensureInitialized();

    if (!email || typeof email !== 'string') {
      throw new Error('Valid email is required');
    }

    const user = await this.db.findUserByEmail(email, this.options.tables.users);
    if (user) {
      delete user.password;
    }
    return user;
  }

  /**
   * Update user
   */
  async updateUser(userId, updates) {
    this._ensureInitialized();

    if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
      throw new Error('Valid userId is required');
    }

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      throw new Error('Updates object is required and must not be empty');
    }

    // Don't allow direct password updates
    if (updates.password) {
      throw new Error('Use changePassword() method to update password');
    }

    // Don't allow email updates directly (should require verification)
    if (updates.email) {
      throw new Error(
        'Direct email updates not allowed. Use a separate email change flow with verification'
      );
    }

    // Don't allow updating protected fields
    const protectedFields = ['id', 'createdAt'];
    for (const field of protectedFields) {
      if (updates[field] !== undefined) {
        delete updates[field];
      }
    }

    await this.db.updateUser(userId, updates, this.options.tables.users);
    return await this.getUserById(userId);
  }

  /**
   * Update user profile (alias for updateUser)
   */
  async updateProfile(userId, updates) {
    return await this.updateUser(userId, updates);
  }

  /**
   * Change password
   */
  async changePassword(userId, oldPassword, newPassword) {
    this._ensureInitialized();

    if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
      throw new Error('Valid userId is required');
    }

    if (
      !oldPassword ||
      !newPassword ||
      typeof oldPassword !== 'string' ||
      typeof newPassword !== 'string'
    ) {
      throw new Error('Both old and new passwords are required');
    }

    if (oldPassword === newPassword) {
      throw new Error('New password must be different from old password');
    }

    const user = await this.db.findUserById(userId, this.options.tables.users);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValid = await this.security.verifyPassword(oldPassword, user.password);
    if (!isValid) {
      throw new Error('Invalid current password');
    }

    // Validate new password
    this.security.validatePassword(newPassword);

    // Hash new password
    const hashedPassword = await this.security.hashPassword(newPassword);

    // Update password
    await this.db.updateUser(userId, { password: hashedPassword }, this.options.tables.users);

    // Revoke all tokens for security
    await this.logoutAll(userId);

    // Audit log
    this.auditLogger('PASSWORD_CHANGE', {
      userId,
      email: user.email,
      success: true,
    });

    return { success: true };
  }

  /**
   * Check if account is locked due to failed login attempts
   */
  async isAccountLocked(email) {
    this._ensureInitialized();

    if (!email || typeof email !== 'string') {
      throw new Error('Valid email is required');
    }

    // Normalize email
    email = email.trim().toLowerCase();

    return await this.db.isAccountLocked(
      email,
      this.options.tables.loginAttempts,
      this.options.security.maxLoginAttempts,
      this.options.security.lockoutTime
    );
  }

  /**
   * Get total user count (for analytics/dashboards)
   */
  async getUserCount() {
    this._ensureInitialized();
    return await this.db.getUserCount(this.options.tables.users);
  }

  /**
   * Get raw database connection pool for advanced queries
   * Use with caution - direct pool access bypasses security checks
   */
  getPool() {
    this._ensureInitialized();
    return this.db.getPool();
  }

  /**
   * Clean up expired verification tokens
   * Removes tokens that have expired to prevent table bloat
   */
  async cleanupExpiredTokens() {
    this._ensureInitialized();

    if (!this.options.tables.verificationTokens) {
      throw new Error('Verification tokens table not configured');
    }

    return await this.db.cleanupExpiredTokens(this.options.tables.verificationTokens);
  }

  /**
   * Clean up expired login attempts
   * Removes old login attempt records to prevent table bloat
   * @param {number} daysToKeep - Number of days to retain records (default: 30)
   */
  async cleanupExpiredLoginAttempts(daysToKeep = 30) {
    this._ensureInitialized();
    return await this.db.cleanupExpiredLoginAttempts(this.options.tables.loginAttempts, daysToKeep);
  }

  /**
   * Clean up revoked refresh tokens
   * Removes revoked tokens that have expired
   * @param {number} daysToKeep - Number of days to retain revoked records (default: 7)
   */
  async cleanupRevokedRefreshTokens(daysToKeep = 7) {
    this._ensureInitialized();
    return await this.db.cleanupRevokedRefreshTokens(this.options.tables.refreshTokens, daysToKeep);
  }

  /**
   * Perform comprehensive database maintenance
   * Runs all cleanup operations in one call
   * Recommended: Schedule this daily during low-traffic periods
   * @param {Object} options - Cleanup options
   */
  async performMaintenance(options = {}) {
    this._ensureInitialized();
    return await this.db.performMaintenance(this.options.tables, options);
  }

  /**
   * Register a hook
   */
  on(event, callback) {
    if (!this.hooks[event]) {
      throw new Error(
        `Invalid hook event: ${event}. Valid events: ${Object.keys(this.hooks).join(', ')}`
      );
    }

    if (typeof callback !== 'function') {
      throw new Error('Hook callback must be a function');
    }

    this.hooks[event].push(callback);
    return this;
  }

  /**
   * Get Express router with auth routes
   */
  router(options = {}) {
    return new AuthRoutes(this, options).getRouter();
  }

  /**
   * Get authentication middleware
   */
  middleware() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            error: 'No token provided',
          });
        }

        const token = authHeader.substring(7);

        if (!token || token.trim() === '') {
          return res.status(401).json({
            success: false,
            error: 'Invalid token format',
          });
        }

        const decoded = await this.verifyAccessToken(token);

        req.user = decoded;
        next();
      } catch (error) {
        const errorMessage =
          error.message === 'Access token expired' ? 'Token expired' : 'Invalid token';

        return res.status(401).json({
          success: false,
          error: errorMessage,
        });
      }
    };
  }

  /**
   * Close database connection
   */
  async close() {
    await this.db.close();
    this.initialized = false;
  }

  /**
   * Helper methods
   */
  _ensureInitialized() {
    if (!this.initialized) {
      throw new Error('Authentication system not initialized. Call init() first.');
    }
  }

  /**
   * Email verification methods
   */

  /**
   * Send verification email to user
   * @param {string} email - User email address
   * @param {string} verificationUrl - Base URL for verification (e.g., 'http://localhost:3000/verify-email')
   */
  async sendVerificationEmail(email, verificationUrl) {
    this._ensureInitialized();

    if (!this.emailService || !this.emailService.transporter) {
      throw new Error('Email service not configured. Please set up SMTP settings.');
    }

    // Normalize email
    email = email.trim().toLowerCase();

    // Find user
    const [users] = await this.db.pool.execute(
      `SELECT id, email, emailVerified FROM \`${this.options.tables.users}\` WHERE email = ? LIMIT 1`,
      [email]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    if (user.emailVerified) {
      throw new Error('Email is already verified');
    }

    return await this.emailService.sendVerificationEmail(user.id, user.email, verificationUrl);
  }

  /**
   * Send 6-digit verification code via email (optional alternative to URL-based verification)
   * @param {string} email - User email address
   * @param {Object} options - Optional configuration
   * @param {number} options.expiresInMinutes - Code expiration time (default: 10 minutes)
   * @returns {Promise<Object>} Result with success status
   *
   * @example
   * // Send verification code
   * await auth.sendVerificationCode('user@example.com');
   *
   * @example
   * // Send code with custom expiration
   * await auth.sendVerificationCode('user@example.com', { expiresInMinutes: 5 });
   */
  async sendVerificationCode(email, options = {}) {
    this._ensureInitialized();

    if (!this.emailService || !this.emailService.transporter) {
      throw new Error('Email service not configured. Please set up SMTP settings.');
    }

    // Normalize email
    email = email.trim().toLowerCase();

    // Find user
    const [users] = await this.db.pool.execute(
      `SELECT id, email, emailVerified FROM \`${this.options.tables.users}\` WHERE email = ? LIMIT 1`,
      [email]
    );

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    if (user.emailVerified) {
      throw new Error('Email is already verified');
    }

    // Delete old codes for this user to prevent code reuse
    await this.db.pool.execute(
      `DELETE FROM \`${this.options.tables.verificationTokens}\` WHERE userId = ?`,
      [user.id]
    );

    return await this.emailService.sendVerificationCode(user.id, user.email, options);
  }

  /**
   * Verify email with token
   * @param {string} token - Verification token from email
   */
  async verifyEmail(token) {
    this._ensureInitialized();

    const result = await this.emailService.verifyEmail(token);

    // Audit log
    this.auditLogger('EMAIL_VERIFIED', {
      userId: result.userId,
      success: true,
    });

    return result;
  }

  /**
   * Verify email with 6-digit code
   * @param {string} email - User email address
   * @param {string} code - 6-digit verification code
   * @returns {Promise<Object>} Verification result
   *
   * @example
   * // Verify email with code
   * const result = await auth.verifyCode('user@example.com', '123456');
   * console.log(result); // { success: true, userId: 1, message: 'Email verified successfully' }
   */
  async verifyCode(email, code) {
    this._ensureInitialized();

    if (!email || typeof email !== 'string') {
      throw new Error('Valid email is required');
    }

    if (!code || typeof code !== 'string') {
      throw new Error('Valid 6-digit code is required');
    }

    // Normalize email
    email = email.trim().toLowerCase();

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      throw new Error('Code must be exactly 6 digits');
    }

    const result = await this.emailService.verifyCode(email, code);

    // Audit log
    this.auditLogger('EMAIL_VERIFIED', {
      userId: result.userId,
      email: email,
      method: 'code',
      success: true,
    });

    return result;
  }

  /**
   * Resend verification email
   * @param {string} email - User email address
   * @param {string} verificationUrl - Base URL for verification
   */
  async resendVerificationEmail(email, verificationUrl) {
    this._ensureInitialized();

    if (!this.emailService || !this.emailService.transporter) {
      throw new Error('Email service not configured. Please set up SMTP settings.');
    }

    return await this.emailService.resendVerificationEmail(email, verificationUrl);
  }

  /**
   * Send password reset email
   * @param {string} email - User email address
   * @param {string} resetUrl - Base URL for password reset (e.g., 'http://localhost:3000/reset-password')
   */
  async sendPasswordResetEmail(email, resetUrl) {
    this._ensureInitialized();

    if (!this.emailService || !this.emailService.transporter) {
      throw new Error('Email service not configured. Please set up SMTP settings.');
    }

    // Normalize email
    email = email.trim().toLowerCase();

    return await this.emailService.sendPasswordResetEmail(email, resetUrl);
  }

  /**
   * Reset password with token
   * @param {string} token - Reset token from email
   * @param {string} newPassword - New password
   */
  async resetPassword(token, newPassword) {
    this._ensureInitialized();

    if (!token || typeof token !== 'string') {
      throw new Error('Valid token is required');
    }

    if (!newPassword || typeof newPassword !== 'string') {
      throw new Error('Valid new password is required');
    }

    // Validate new password
    this.security.validatePassword(newPassword);

    const connection = await this.db.pool.getConnection();

    try {
      await connection.beginTransaction();

      // Find user with valid reset token
      const [users] = await connection.execute(
        `SELECT id, email, resetPasswordExpires FROM \`${this.options.tables.users}\` 
         WHERE resetPasswordToken = ? LIMIT 1`,
        [token]
      );

      if (users.length === 0) {
        throw new Error('Invalid or expired reset token');
      }

      const user = users[0];

      // Check if token expired
      if (Date.now() > user.resetPasswordExpires) {
        // Clear expired token
        await connection.execute(
          `UPDATE \`${this.options.tables.users}\` 
           SET resetPasswordToken = NULL, resetPasswordExpires = NULL 
           WHERE id = ?`,
          [user.id]
        );
        await connection.commit();
        throw new Error('Reset token has expired. Please request a new one.');
      }

      // Hash new password
      const hashedPassword = await this.security.hashPassword(newPassword);

      // Update password and clear reset token
      await connection.execute(
        `UPDATE \`${this.options.tables.users}\` 
         SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL 
         WHERE id = ?`,
        [hashedPassword, user.id]
      );

      // Revoke all refresh tokens for this user (force re-login)
      await connection.execute(
        `UPDATE \`${this.options.tables.refreshTokens}\` 
         SET revoked = TRUE 
         WHERE userId = ?`,
        [user.id]
      );

      await connection.commit();

      // Audit log
      this.auditLogger('PASSWORD_RESET', {
        userId: user.id,
        email: user.email,
        success: true,
      });

      return {
        success: true,
        message: 'Password reset successfully',
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Check if email is verified
   * @param {number} userId - User ID
   */
  async isEmailVerified(userId) {
    this._ensureInitialized();

    const [users] = await this.db.pool.execute(
      `SELECT emailVerified FROM \`${this.options.tables.users}\` WHERE id = ? LIMIT 1`,
      [userId]
    );

    return users.length > 0 && users[0].emailVerified;
  }

  async _runHooks(event, data) {
    if (!this.hooks[event] || !Array.isArray(this.hooks[event])) {
      return;
    }

    for (const hook of this.hooks[event]) {
      try {
        await hook(data);
      } catch (error) {
        console.error(`[SecureNodeAuth] Hook error in '${event}':`, error.message);
        // Re-throw to allow caller to handle
        throw new Error(`Hook execution failed in '${event}': ${error.message}`);
      }
    }
  }

  /**
   * Default audit logger (can be overridden)
   * @private
   */
  _defaultAuditLogger(event, data) {
    const timestamp = new Date().toISOString();
    console.log(
      `[AUDIT ${timestamp}] ${event}:`,
      JSON.stringify({
        userId: data.userId,
        email: data.email,
        success: data.success,
        ip: data.ip,
      })
    );
  }
}

module.exports = SecureNodeAuth;
