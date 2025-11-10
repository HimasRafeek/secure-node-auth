# Contributing to Secure Node Auth

Thank you for considering contributing to Secure Node Auth! We welcome contributions from the community.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/HimasRafeek/secure-node-auth/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (Node version, database version, etc.)

### Suggesting Features

1. Check existing feature requests
2. Create a new issue with:
   - Clear description of the feature
   - Use cases and benefits
   - Possible implementation approach

### Pull Requests

1. Fork the repository
2. Create a new branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/HimasRafeek/secure-node-auth.git
cd secure-node-auth

# Install dependencies
npm install

# Set up test database
mysql -u root -p < test/setup.sql

# Run tests
npm test

# Run example
npm run example
```

## Code Style

- Use 2 spaces for indentation
- Follow existing code style
- Add comments for complex logic
- Keep functions focused and concise

## Testing

- Add tests for new features
- Ensure all tests pass before submitting PR
- Test with different database configurations

## Documentation

- Update README.md if adding new features
- Add JSDoc comments to functions
- Update TypeScript definitions if needed

## Questions?

Feel free to open an issue for any questions or discussions.

Thank you for contributing! 🎉
