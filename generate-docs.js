const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

// Configure marked for syntax highlighting class names
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Doc titles and descriptions
const docMeta = {
  'README.md': {
    title: 'Secure Node Auth - Fast MySQL Authentication with JWT',
    description:
      'Zero-config MySQL authentication system with JWT tokens, bcrypt hashing, and production-ready security. Set up secure auth in seconds.',
  },
  'GETTING_STARTED.md': {
    title: 'Getting Started - Secure Node Auth',
    description:
      'Step-by-step guide to set up Secure Node Auth in your Node.js application with Express or Fastify.',
  },
  'QUICK_START.md': {
    title: 'Quick Start Guide - Secure Node Auth',
    description:
      'Get started with Secure Node Auth in 3 lines of code. Complete quick start guide with examples.',
  },
  'SECURITY.md': {
    title: 'Security Guide - Secure Node Auth',
    description:
      'Comprehensive security documentation covering SQL injection protection, password security, token management, and best practices.',
  },
  'EMAIL_VERIFICATION_GUIDE.md': {
    title: 'Email Verification - Secure Node Auth',
    description:
      'Complete guide to implementing email verification with Secure Node Auth. Includes examples with Nodemailer and SendGrid.',
  },
  'FASTIFY_GUIDE.md': {
    title: 'Fastify Integration - Secure Node Auth',
    description:
      'Learn how to integrate Secure Node Auth with Fastify framework. Complete guide with examples and best practices.',
  },
  'HEADLESS_APPS_GUIDE.md': {
    title: 'Headless Apps Authentication Part 1 - Secure Node Auth',
    description:
      'Build secure authentication for headless applications with React, Vue, Angular, or mobile apps. Part 1 of 3.',
  },
  'HEADLESS_APPS_GUIDE_PART2.md': {
    title: 'Headless Apps Authentication Part 2 - Secure Node Auth',
    description:
      'Advanced headless authentication patterns including token refresh, protected routes, and state management. Part 2 of 3.',
  },
  'HEADLESS_APPS_GUIDE_PART3.md': {
    title: 'Headless Apps Authentication Part 3 - Secure Node Auth',
    description:
      'Complete headless authentication with mobile apps, SSR, and advanced patterns. Part 3 of 3.',
  },
  'HEADLESS_APPS_INDEX.md': {
    title: 'Headless Apps Index - Secure Node Auth',
    description: 'Complete index and navigation for headless apps authentication guides.',
  },
  'TYPESCRIPT_GUIDE.md': {
    title: 'TypeScript Guide - Secure Node Auth',
    description:
      'Full TypeScript support and type definitions for Secure Node Auth. Learn how to use with type safety.',
  },
  'API_REFERENCE.md': {
    title: 'API Reference - Secure Node Auth',
    description:
      'Complete API reference for all methods, properties, and configuration options in Secure Node Auth.',
  },
  'FLOW_DIAGRAM.md': {
    title: 'Authentication Flow Diagram - Secure Node Auth',
    description:
      'Visual guide showing how authentication flows work in Secure Node Auth from registration to token refresh.',
  },
  'QUICK_REFERENCE_USER_DATA.md': {
    title: 'User Data Quick Reference - Secure Node Auth',
    description:
      'Quick reference guide for common patterns in accessing and managing user-specific data.',
  },
  'USER_DATA_ACCESS.md': {
    title: 'User Data Access Guide - Secure Node Auth',
    description:
      'Complete guide on protecting routes and accessing user-specific data like posts, orders, and profiles.',
  },
  'SECURITY_AUDIT_REPORT.md': {
    title: 'Security Audit Report - Secure Node Auth',
    description:
      'Expert-level security audit results with 49 issues resolved. Comprehensive security analysis and improvements.',
  },
};

// Document navigation
const docNavigation = {
  'README.md': { next: 'GETTING_STARTED.md', nextTitle: 'Getting Started' },
  'GETTING_STARTED.md': {
    prev: 'README.md',
    prevTitle: 'README',
    next: 'QUICK_START.md',
    nextTitle: 'Quick Start',
  },
  'QUICK_START.md': {
    prev: 'GETTING_STARTED.md',
    prevTitle: 'Getting Started',
    next: 'SECURITY.md',
    nextTitle: 'Security Guide',
  },
  'SECURITY.md': {
    prev: 'QUICK_START.md',
    prevTitle: 'Quick Start',
    next: 'EMAIL_VERIFICATION_GUIDE.md',
    nextTitle: 'Email Verification',
  },
  'EMAIL_VERIFICATION_GUIDE.md': {
    prev: 'SECURITY.md',
    prevTitle: 'Security Guide',
    next: 'FASTIFY_GUIDE.md',
    nextTitle: 'Fastify Guide',
  },
  'FASTIFY_GUIDE.md': {
    prev: 'EMAIL_VERIFICATION_GUIDE.md',
    prevTitle: 'Email Verification',
    next: 'HEADLESS_APPS_GUIDE.md',
    nextTitle: 'Headless Apps (Part 1)',
  },
  'HEADLESS_APPS_GUIDE.md': {
    prev: 'FASTIFY_GUIDE.md',
    prevTitle: 'Fastify Guide',
    next: 'HEADLESS_APPS_GUIDE_PART2.md',
    nextTitle: 'Headless Apps (Part 2)',
  },
  'HEADLESS_APPS_GUIDE_PART2.md': {
    prev: 'HEADLESS_APPS_GUIDE.md',
    prevTitle: 'Headless Apps (Part 1)',
    next: 'HEADLESS_APPS_GUIDE_PART3.md',
    nextTitle: 'Headless Apps (Part 3)',
  },
  'HEADLESS_APPS_GUIDE_PART3.md': {
    prev: 'HEADLESS_APPS_GUIDE_PART2.md',
    prevTitle: 'Headless Apps (Part 2)',
    next: 'HEADLESS_APPS_INDEX.md',
    nextTitle: 'Headless Apps Index',
  },
  'HEADLESS_APPS_INDEX.md': {
    prev: 'HEADLESS_APPS_GUIDE_PART3.md',
    prevTitle: 'Headless Apps (Part 3)',
    next: 'TYPESCRIPT_GUIDE.md',
    nextTitle: 'TypeScript Guide',
  },
  'TYPESCRIPT_GUIDE.md': {
    prev: 'HEADLESS_APPS_INDEX.md',
    prevTitle: 'Headless Apps Index',
    next: 'API_REFERENCE.md',
    nextTitle: 'API Reference',
  },
  'API_REFERENCE.md': {
    prev: 'TYPESCRIPT_GUIDE.md',
    prevTitle: 'TypeScript Guide',
    next: 'FLOW_DIAGRAM.md',
    nextTitle: 'Flow Diagram',
  },
  'FLOW_DIAGRAM.md': {
    prev: 'API_REFERENCE.md',
    prevTitle: 'API Reference',
    next: 'QUICK_REFERENCE_USER_DATA.md',
    nextTitle: 'User Data Reference',
  },
  'QUICK_REFERENCE_USER_DATA.md': {
    prev: 'FLOW_DIAGRAM.md',
    prevTitle: 'Flow Diagram',
    next: 'USER_DATA_ACCESS.md',
    nextTitle: 'User Data Access',
  },
  'USER_DATA_ACCESS.md': {
    prev: 'QUICK_REFERENCE_USER_DATA.md',
    prevTitle: 'User Data Reference',
    next: 'SECURITY_AUDIT_REPORT.md',
    nextTitle: 'Security Audit Report',
  },
  'SECURITY_AUDIT_REPORT.md': { prev: 'USER_DATA_ACCESS.md', prevTitle: 'User Data Access' },
};

// Generate TOC from headings
function generateTOC(html) {
  const headingRegex = /<h([123])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h\1>/gi;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      level: match[1],
      id: match[2],
      text: match[3].replace(/<[^>]*>/g, ''), // Strip HTML tags
    });
  }

  if (headings.length === 0) return '<p class="text-gray-500 text-sm p-2">No headings found</p>';

  return headings
    .map(
      (h) => `
    <div class="toc-item toc-h${h.level}" data-target="${h.id}">
      ${h.text}
    </div>`
    )
    .join('');
}

// Generate navigation buttons
function generateNavigation(docName) {
  const nav = docNavigation[docName];
  if (!nav) return '';

  let html = '<div class="flex flex-col sm:flex-row justify-between gap-4">';

  if (nav.prev) {
    html += `
      <a href="${nav.prev.replace('.md', '.html')}" class="nav-button-outline">
        <i class="fas fa-arrow-left"></i>
        <span>${nav.prevTitle}</span>
      </a>`;
  }

  if (nav.next) {
    html += `
      <a href="${nav.next.replace('.md', '.html')}" class="nav-button">
        <span>${nav.nextTitle}</span>
        <i class="fas fa-arrow-right"></i>
      </a>`;
  }

  html += '</div>';
  return html;
}

// Read template
const templatePath = path.join(__dirname, 'website', 'static-doc-template.html');
const template = fs.readFileSync(templatePath, 'utf-8');

// Create output directory
const outputDir = path.join(__dirname, 'website', 'docs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate HTML for each markdown file
const docsDir = path.join(__dirname, 'docs');
const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md'));

console.log(`\n🚀 Generating static HTML documentation...\n`);

files.forEach((file) => {
  const filePath = path.join(docsDir, file);
  const markdown = fs.readFileSync(filePath, 'utf-8');

  // Configure marked to add IDs to headings
  let headingIndex = 0;
  const renderer = new marked.Renderer();
  renderer.heading = function ({ text, depth }) {
    const id = `heading-${headingIndex++}`;
    return `<h${depth} id="${id}">${text}</h${depth}>`;
  };

  marked.setOptions({ renderer });

  // Convert markdown to HTML
  headingIndex = 0;
  const htmlContent = marked.parse(markdown);

  // Get metadata
  const meta = docMeta[file] || {
    title: `${file.replace('.md', '')} - Secure Node Auth`,
    description: `Documentation for ${file.replace('.md', '')}`,
  };

  // Generate TOC
  const toc = generateTOC(htmlContent);

  // Generate navigation
  const navigation = generateNavigation(file);

  // Replace placeholders
  const html = template
    .replace(/\{\{TITLE\}\}/g, meta.title)
    .replace(/\{\{DESCRIPTION\}\}/g, meta.description)
    .replace(/\{\{CONTENT\}\}/g, htmlContent)
    .replace(/\{\{TOC\}\}/g, toc)
    .replace(/\{\{NAVIGATION\}\}/g, navigation)
    .replace(/\{\{DOC_NAME\}\}/g, file);

  // Write HTML file
  const outputFile = path.join(outputDir, file.replace('.md', '.html'));
  fs.writeFileSync(outputFile, html);

  console.log(`✅ Generated: ${file.replace('.md', '.html')}`);
});

// Create index.html (redirect to README)
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0;url=README.html">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting to <a href="README.html">documentation</a>...</p>
</body>
</html>`;

fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml);

console.log(`\n✨ Generated ${files.length} HTML files in website/docs/`);
console.log(`📁 Output directory: ${outputDir}`);
console.log(`\n🌐 You can now serve these files with any static host!\n`);
