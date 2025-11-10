# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-06

### Added
- 🎉 Initial release
- Zero-config MySQL authentication system
- JWT token generation and validation (access + refresh tokens)
- Bcrypt password hashing
- Auto-schema setup (tables, indexes, foreign keys)
- Express middleware and pre-built routes
- Custom fields support
- Hooks system (before/after authentication events)
- Rate limiting and brute force protection
- Account lockout after failed login attempts
- Password strength validation
- User registration and login
- Token refresh mechanism
- Profile management (get, update)
- Password change functionality
- Logout (single device and all devices)
- Comprehensive documentation and examples
- TypeScript definitions
- SQL injection protection (parameterized queries)
- Connection pooling for performance

### Security Features
- Password hashing with configurable bcrypt rounds
- Separate access and refresh token secrets
- Token revocation support
- Login attempt tracking
- Account lockout mechanism
- Input validation and sanitization
- SQL injection protection
- Rate limiting on auth endpoints

### Developer Experience
- Simple 3-line setup
- Extensive configuration options
- Hook system for extensibility
- Clear error messages
- Example applications included
- Comprehensive README with usage examples
