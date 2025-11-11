# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
