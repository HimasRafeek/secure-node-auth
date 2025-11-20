# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.3] - 2025-11-20

### 🐛 Bug Fixes

- **Comprehensive MySQL/PostgreSQL Compatibility Fixes**
  - Fixed `pool.execute is not a function` error in EmailService
  - Added execute() abstraction layer for complete database compatibility
  - Fixed PostgreSQL case sensitivity issues with camelCase identifiers
  - Added automatic quoting for camelCase column names in PostgreSQL queries
  - Fixed result format compatibility (affectedRows, insertId)
  - Added getConnection() as alias for connect() in PostgreSQL
  - Added transaction methods (beginTransaction, commit, rollback) to PostgreSQL connections
  - Fixed parameter mismatch in password reset (newPasswordHash)

### 🔧 Database Enhancements

- **Execute Method Abstraction**
  - Created unified `execute(sql, params)` interface across DatabaseManager and PostgresDatabaseManager
  - Automatic MySQL → PostgreSQL SQL conversion (?, backticks)
  - Proper result object normalization for both database systems

- **PostgreSQL SQL Conversion**
  - Placeholder conversion: ? → $1, $2, etc.
  - Identifier conversion: backticks → double quotes
  - CamelCase identifier quoting with negative lookbehind/lookahead
  - Prevents double-quoting of already-quoted identifiers

- **Transaction Support**
  - Full transaction support for PostgreSQL: BEGIN/COMMIT/ROLLBACK
  - Wrapped in native connection methods for seamless API compatibility
  - Works identically to MySQL transactions

### 📚 Documentation Updates

- Updated package.json version to 1.4.3
- All documentation examples now reference public API correctly
- Added migration notes for existing users

### ✅ Testing & Validation

- All 50+ database query patterns validated for both MySQL and PostgreSQL
- Connection management verified (13 release/close calls)
- Regex patterns tested with 5 comprehensive SQL scenarios
- Zero compilation errors across entire codebase
- Full backward compatibility maintained

## [1.4.1] - 2025-11-20

### 🐛 Bug Fixes

- **Fixed database connection timeout issues (ETIMEDOUT)**
  - Added connection timeout defaults (10 seconds)
  - Added retry logic with exponential backoff (3 attempts by default)
  - Added helpful error messages for common connection issues
  - Added keepAlive support for stable long-running connections

### 📝 Configuration

- New connection options available:
  - `connectTimeout` - Connection timeout in milliseconds (default: 10000)
  - `acquireTimeout` - Connection acquire timeout (default: 10000)
  - `timeout` - Query timeout (default: 10000)
  - `retryAttempts` - Number of connection retry attempts (default: 3)
  - `retryDelay` - Delay between retries in milliseconds (default: 1000)
  - `enableKeepAlive` - Enable TCP keepalive (default: true)
  - `keepAliveInitialDelay` - Initial keepalive delay (default: 0)

### 📚 Documentation

- Added comprehensive troubleshooting section in README
- Added connection timeout configuration examples
- Added solutions for common MySQL connection errors (ETIMEDOUT, ECONNREFUSED, ER_ACCESS_DENIED_ERROR)
- Updated TypeScript definitions with new connection options

## [1.4.0] - 2025-11-20

### ✨ New Features - 6-Digit Code Authentication

- **6-Digit Email Verification Codes** - Modern alternative to URL-based verification
  - `sendVerificationCode(email, options)` - Send 6-digit verification code via email
  - `verifyCode(email, code)` - Verify email with 6-digit code
  - Customizable expiration (default: 10 minutes)
  - Perfect for mobile apps and improved UX
  - Format validation (exactly 6 digits required)
  - Automatic cleanup of old codes

- **6-Digit Password Reset Codes** - Secure password recovery with codes
  - `sendPasswordResetCode(email, options)` - Send 6-digit reset code via email
  - `resetPasswordWithCode(email, code, newPassword)` - Reset password with code
  - Customizable expiration (default: 15 minutes)
  - All user sessions revoked after successful reset
  - Single-use codes (deleted after verification)

### 📧 Email Templates

- Added beautiful HTML email templates for verification codes
- Added HTML email templates for password reset codes
- Support for custom email templates via configuration
- Mobile-responsive design with security tips

### 📚 Documentation

- Added comprehensive guide: `docs/VERIFICATION_AND_AUDIT_GUIDE.md`
- Added examples: `examples/email-verification-examples.js` (6+ scenarios)
- Added examples: `examples/password-reset-examples.js` (8+ scenarios)
- Updated `docs/API_REFERENCE.md` with all new methods
- Updated README with feature comparisons and usage tips
- Added IMPLEMENTATION_VERIFICATION.md report

### 🔐 Security Features

- Codes expire automatically (10-15 minutes, customizable)
- Format validation (must be exactly 6 digits)
- Single-use codes (deleted after successful use)
- Automatic cleanup when sending new codes
- Rate limiting recommended (examples provided)
- Audit logging for all verification/reset events

### 🎯 Developer Experience

- Zero breaking changes - all existing code works
- TypeScript definitions for all new methods
- Works with existing database tables
- Optional feature - use alongside URL-based methods
- Express.js integration examples included

### 🆚 Method Comparison

| Feature | URL Method | 6-Digit Code Method |
|---------|-----------|---------------------|
| Email Verification | 24h expiry | 10min expiry |
| Password Reset | 1h expiry | 15min expiry |
| Best For | Web apps | Mobile apps |
| User Action | Click link | Enter code |

## [1.3.0] - 2025-11-20

### ⚠️ New Features - Runtime Schema Migrations

- **Dangerous Schema Migration Methods** - Add columns to existing databases (use with extreme caution)
  - `dangerouslyAddColumn(fieldConfig, options)` - Add single column to existing table
  - `dangerouslyMigrateSchema(fields, options)` - Add multiple columns at once
  - Safety features: Confirmation required, transaction support (PostgreSQL), detailed logging
  - ⚠️ **WARNING**: Can cause table locks and downtime on production databases
  - Recommended: Use proper migration tools (Flyway, Liquibase) for production
  - Best for: Development, testing, small databases with planned maintenance windows

### 📚 Documentation

- Added comprehensive migration guide: `docs/DANGEROUS_MIGRATIONS.md`
- Updated README with runtime schema change examples
- Added safety warnings and best practices
- Included transaction examples for PostgreSQL

### 🔧 Technical Details

- MySQL: Uses `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- PostgreSQL: Supports transactions with `BEGIN`/`COMMIT`/`ROLLBACK`
- Validation: Field name sanitization, type checking, duplicate prevention
- Error handling: Graceful degradation with detailed error messages

## [1.2.1] - 2025-11-11

### 🐛 Bug Fixes

- **PostgreSQL Refresh Token Storage** - Fixed token storage to match MySQL implementation
  - Now accepts plain string tokens (was expecting token object)
  - Added SHA256 hashing for secure token storage
  - Auto-generates 7-day expiration (was requiring manual calculation)
  - Fixed `findRefreshToken()` and `revokeRefreshToken()` to hash tokens before lookup

### ✨ New Features

- **Added Missing API Methods** - Exposed 6 utility methods for production use
  - `getUserByEmail(email)` - Get user by email address
  - `updateProfile(userId, updates)` - Alias for updateUser with clearer naming
  - `isAccountLocked(email)` - Check if account is locked due to failed login attempts
  - `getUserCount()` - Get total user count for analytics/dashboards
  - `getPool()` - Get raw database pool for advanced queries
  - `cleanupExpiredTokens()` - Clean up expired verification tokens
  - `cleanupExpiredLoginAttempts(days)` - Clean up old login attempt records
  - `cleanupRevokedRefreshTokens(days)` - Clean up revoked refresh tokens
  - `performMaintenance(options)` - Run all cleanup operations in one call

### 📚 Documentation

- Added TypeScript definitions for all new methods
- Updated API documentation with maintenance utilities
- Added examples for database cleanup and maintenance

### 🔧 Improvements

- Better API consistency between MySQL and PostgreSQL implementations
- Complete feature parity for refresh token management
- Enhanced database maintenance capabilities for production deployments

## [1.2.0] - 2025-11-11

### 🔒 Security Hardening

- **CRITICAL: JWT Secret Validation** - Added multi-layer JWT secret validation with strict production enforcement
  - Prevents use of default secrets in production
  - Enforces minimum 32-character length for production secrets
  - Requires unique secrets for access and refresh tokens
  - Specific error codes for debugging and monitoring
- **CRITICAL: SMTP TLS Verification** - Environment-aware TLS configuration for email service
  - Production: Enforces `rejectUnauthorized=true` (rejects invalid certificates)
  - Development: Allows self-signed certificates with detailed warnings
  - Prevents man-in-the-middle attacks on email verification tokens
- **Database Maintenance Utilities** - New automated cleanup methods for all databases
  - `cleanupExpiredLoginAttempts()` - Removes old login attempt records
  - `cleanupExpiredVerificationTokens()` - Cleans up expired email verification tokens
  - `cleanupRevokedRefreshTokens()` - Removes invalidated refresh tokens
  - `performMaintenance()` - Runs all cleanup operations with detailed metrics
  - Supports both MySQL and PostgreSQL

### 📚 Documentation

- Added comprehensive production security checklist (3000+ lines)
- Added HTTP security headers guide for Express, Fastify, Nginx, Apache
- Added deep security code analysis report with vulnerability assessments
- Added security implementation verification guide
- See `docs/SECURITY.md` and `docs/` folder for complete documentation

### ✨ Features

- Startup validation ensures secure configuration before app initialization
- Detailed error messages guide developers to fix security issues
- Zero breaking changes - development deployments work as before
- Backward compatible with existing deployments

### 📊 Quality

- All 5 identified security vulnerabilities fixed
- Corporate-grade implementation standards applied
- Comprehensive test coverage for security features
- Production-ready for enterprise deployments

## [1.1.1] - 2025-11-11

### 🐛 Bug Fixes

- Fixed PostgreSQL trigger creation to be idempotent (prevents errors when calling `init()` multiple times)
- Fixed type conversion order in PostgreSQL adapter (BIGINT/DOUBLE were incorrectly matched)
- Added proper connection pool config mapping for PostgreSQL (connectionLimit → max)
- Improved error handling for trigger creation

### 📚 Documentation

- Added comprehensive PostgreSQL test suite (`test-postgres.js`)
- Added detailed code review document
- Updated .npmignore to properly exclude development files

## [1.1.0] - 2025-11-10

### 🎉 Major Feature: PostgreSQL Support

### Added

- 🗄️ **Full PostgreSQL support** - Use PostgreSQL or MySQL with a simple config change
- 📦 New `PostgresDatabaseManager` class for PostgreSQL operations
- 🏭 `DatabaseFactory` to automatically choose the right database adapter
- 📚 Comprehensive PostgreSQL documentation and migration guide
- 💡 PostgreSQL example file (`examples/postgres-example.js`)
- 🔧 Auto-detection of database type and default port (3306 for MySQL, 5432 for PostgreSQL)
- 🎯 Support for PostgreSQL-specific features (SERIAL, double quotes, $1 placeholders)
- 🔄 Automatic SQL type conversion between MySQL and PostgreSQL

### Changed

- 📖 Updated README with PostgreSQL quick start and examples
- 🏷️ Added PostgreSQL-related keywords to package.json
- 📝 Updated package description to mention both databases

### Technical Details

- PostgreSQL uses `SERIAL` instead of `AUTO_INCREMENT`
- Automatic conversion of MySQL types to PostgreSQL equivalents
- Parameterized queries use `$1, $2` syntax for PostgreSQL
- Table/column names use double quotes for PostgreSQL
- Trigger-based `updatedAt` column for PostgreSQL
- Full connection pooling support for both databases

## [1.0.1] - 2025-11-10

### Added

- ⚡ Fastify integration guide in README
- 🎯 Complete Fastify plugin and routes support
- 📚 Comprehensive Fastify documentation

### Changed

- 📖 Updated README to highlight Fastify support
- 🔖 Added "fastify" keyword to package.json

### Fixed

- 🔒 Updated nodemailer dependency to v7.0.10 to fix security vulnerability

## [1.0.0] - 2025-11-10

### 🎉 Initial Release

Production-ready MySQL authentication system with zero configuration.

### Added

- ⚡ Zero-config setup with automatic schema creation
- 🔒 Complete authentication system (register, login, logout)
- 🎯 JWT token management (access + refresh tokens)
- 🔐 Bcrypt password hashing with configurable rounds
- 🛡️ Security features:
  - Rate limiting and brute force protection
  - Account lockout after failed attempts
  - SQL injection protection (parameterized queries)
  - Token revocation and blacklisting
- 📦 Express middleware and pre-built routes
- ⚙️ Fastify support with native plugin
- 🎨 Custom fields support for user data
- 🔌 Extensible hooks system (before/after events)
- 📧 Email verification system (optional)
- 🔑 2FA support with TOTP (optional)
- 📝 Profile management (get, update, delete)
- 🔄 Token refresh mechanism
- 💾 Connection pooling for performance
- 📚 TypeScript definitions included
- 📖 Comprehensive documentation and examples

### Security

- Password strength validation
- Input sanitization and validation
- Secure token generation
- Session management
- Login attempt tracking
- CORS support

### Developer Experience

- Simple 3-line setup
- Extensive configuration options
- Clear error messages
- Working examples included
- Full API documentation
- Migration support

[1.0.0]: https://github.com/HimasRafeek/secure-node-auth/releases/tag/v1.0.0
