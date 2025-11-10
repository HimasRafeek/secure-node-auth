const express = require('express');
const path = require('path');
const fs = require('fs');
const { marked } = require('marked');

const app = express();
const PORT = process.env.PORT || 3000;

// Doc titles mapping
const docTitles = {
  'README.md': 'Secure Node Auth - Documentation',
  'GETTING_STARTED.md': 'Getting Started - Secure Node Auth',
  'QUICK_START.md': 'Quick Start - Secure Node Auth',
  'SECURITY.md': 'Security Guide - Secure Node Auth',
  'EMAIL_VERIFICATION_GUIDE.md': 'Email Verification - Secure Node Auth',
  'FASTIFY_GUIDE.md': 'Fastify Integration - Secure Node Auth',
  'HEADLESS_APPS_GUIDE.md': 'Headless Apps Part 1 - Secure Node Auth',
  'HEADLESS_APPS_GUIDE_PART2.md': 'Headless Apps Part 2 - Secure Node Auth',
  'HEADLESS_APPS_GUIDE_PART3.md': 'Headless Apps Part 3 - Secure Node Auth',
  'HEADLESS_APPS_INDEX.md': 'Headless Apps Index - Secure Node Auth',
  'TYPESCRIPT_GUIDE.md': 'TypeScript Guide - Secure Node Auth',
  'API_REFERENCE.md': 'API Reference - Secure Node Auth',
  'FLOW_DIAGRAM.md': 'Authentication Flow - Secure Node Auth',
  'QUICK_REFERENCE_USER_DATA.md': 'User Data Reference - Secure Node Auth',
  'USER_DATA_ACCESS.md': 'User Data Access - Secure Node Auth',
  'SECURITY_AUDIT_REPORT.md': 'Security Audit Report - Secure Node Auth',
};

// Serve static files from the website directory
app.use(express.static(path.join(__dirname, 'website')));

// Server-side render documentation with SEO
app.get('/docs.html', (req, res) => {
  const docName = req.query.doc || 'README.md';
  const filePath = path.join(__dirname, 'docs', docName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Documentation not found');
  }

  const markdown = fs.readFileSync(filePath, 'utf-8');
  const htmlContent = marked.parse(markdown);
  const title = docTitles[docName] || 'Documentation - Secure Node Auth';
  const description = `Complete documentation for ${docName.replace('.md', '')} - Secure Node Auth package`;

  const template = fs.readFileSync(path.join(__dirname, 'website', 'docs-template.html'), 'utf-8');
  const html = template
    .replace(/\{\{TITLE\}\}/g, title)
    .replace(/\{\{DESCRIPTION\}\}/g, description)
    .replace(/\{\{DOC_NAME\}\}/g, docName)
    .replace(/\{\{CONTENT\}\}/g, htmlContent);

  res.send(html);
});

// Serve markdown files with proper content type (for backward compatibility)
app.get('/docs/*.md', (req, res) => {
  const fileName = req.params[0];
  const filePath = path.join(__dirname, 'docs', `${fileName}.md`);

  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(filePath);
  } else {
    res.status(404).send('Documentation file not found');
  }
});

// Serve docs directory for other files
app.use('/docs', express.static(path.join(__dirname, 'docs')));

// Serve README as plain text
app.get('/README.md', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.sendFile(path.join(__dirname, 'README.md'));
});

// Serve README through docs path too
app.get('/docs/README.md', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.sendFile(path.join(__dirname, 'README.md'));
});

// Root route - serve landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Landing page server running at http://localhost:${PORT}`);
  console.log(`\n📚 View the documentation website at:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`\n📖 Direct documentation links:`);
  console.log(`   http://localhost:${PORT}/docs/SECURITY_GUIDE.md`);
  console.log(`   http://localhost:${PORT}/docs/EMAIL_VERIFICATION_GUIDE.md`);
  console.log(`   http://localhost:${PORT}/docs/FASTIFY_GUIDE.md`);
  console.log(`   http://localhost:${PORT}/docs/HEADLESS_APPS_GUIDE.md`);
  console.log(`\n✨ Press Ctrl+C to stop the server\n`);
});
