# Pre-Publication Checklist

Before publishing to npm and GitHub, update the following:

## 📝 Required Updates

### 1. package.json

- [ ] Update `author` field with your name and email
- [ ] Update `repository.url` with your actual GitHub repository URL
- [ ] Update `bugs.url` with your GitHub issues URL
- [ ] Update `homepage` with your GitHub repository URL
- [ ] Verify version number (currently 1.0.0)

### 2. README.md

- [ ] Update GitHub repository links (line 524, 526)
  - Replace `yourusername` with your GitHub username
- [ ] Verify NPM package link matches your package name

### 3. docs/README.md

- [ ] Update GitHub repository links (line 540, 542)
  - Replace `yourusername` with your GitHub username

### 4. Repository Setup

- [ ] Initialize git repository if not done: `git init`
- [ ] Create GitHub repository
- [ ] Add remote: `git remote add origin <your-repo-url>`
- [ ] Create initial commit: `git add . && git commit -m "Initial commit"`
- [ ] Push to GitHub: `git push -u origin main`

### 5. NPM Setup

- [ ] Login to npm: `npm login`
- [ ] Test package locally: `npm pack` (creates a .tgz file)
- [ ] Check what will be published: `npm publish --dry-run`
- [ ] Publish to npm: `npm publish`

## ✅ Pre-Flight Checks

### Code Quality

- [ ] All examples work correctly
- [ ] No sensitive data in code (API keys, passwords, etc.)
- [ ] All dependencies are properly listed
- [ ] TypeScript definitions are accurate

### Documentation

- [ ] README.md is complete and accurate
- [ ] CHANGELOG.md reflects current version
- [ ] Examples are up to date
- [ ] API documentation is clear

### Security

- [ ] No `.env` file in repository
- [ ] `.gitignore` properly configured
- [ ] `.npmignore` excludes dev files
- [ ] Security audit clean: `npm audit`

### Testing

- [ ] Run tests: `npm test` (if applicable)
- [ ] Test basic usage example
- [ ] Verify database schema creation works
- [ ] Test authentication flow end-to-end

## 📦 What Gets Published to NPM

The following files/folders will be included in the npm package (defined in `package.json` files field):

- `src/` - Main source code
- `examples/` - Example code
- `README.md` - Main documentation
- `LICENSE` - License file
- `CHANGELOG.md` - Version history
- `SECURITY.md` - Security policy
- `CONTRIBUTING.md` - Contribution guidelines
- `INSTALLATION.md` - Installation guide

The following will be **excluded** (defined in `.npmignore`):

- `audit/` - Internal audit reports
- `website/` - Documentation website
- `docs/` - Source documentation files
- Dev scripts: `qa-test.js`, `docs-server.js`, `generate-docs.js`
- Development configs: `.vscode/`, `.env.example`

## 🚀 Quick Publish Commands

```bash
# 1. Update package.json, README.md, etc. with your details

# 2. Verify what will be published
npm pack
tar -tzf secure-node-auth-1.0.0.tgz  # Check contents

# 3. Test locally in another project
cd ../test-project
npm install ../secure-node-auth/secure-node-auth-1.0.0.tgz

# 4. Publish to npm
cd ../secure-node-auth
npm publish

# 5. Push to GitHub
git add .
git commit -m "Release v1.0.0"
git tag v1.0.0
git push origin main --tags
```

## 📋 Post-Publication Tasks

- [ ] Verify package appears on npmjs.com
- [ ] Test installation: `npm install secure-node-auth`
- [ ] Update GitHub repository description
- [ ] Add topics/tags to GitHub repository
- [ ] Create GitHub release for v1.0.0
- [ ] Share on social media/developer communities (optional)

## 🔄 For Future Updates

1. Update version in `package.json` following [semver](https://semver.org/)
2. Update `CHANGELOG.md` with changes
3. Commit changes
4. Create git tag: `git tag v1.x.x`
5. Push: `git push origin main --tags`
6. Publish: `npm publish`
