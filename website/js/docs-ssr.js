// Document navigation structure
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

let currentDoc = window.CURRENT_DOC || 'README.md';

// Apply syntax highlighting to pre-rendered content
function applySyntaxHighlighting() {
  $('#content pre code').each(function () {
    hljs.highlightElement(this);
  });
}

// Add copy buttons to code blocks
function addCopyButtons() {
  $('#content pre').each(function () {
    const pre = $(this);

    // Skip if button already exists
    if (pre.find('.copy-button').length > 0) return;

    // Create wrapper for positioning
    pre.css('position', 'relative');

    // Create copy button
    const button = $(`
      <button class="copy-button" style="
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(31, 41, 55, 0.8);
        backdrop-filter: blur(4px);
        color: #9ca3af;
        border: 1px solid rgba(75, 85, 99, 0.3);
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        z-index: 10;
        display: flex;
        align-items: center;
        gap: 4px;
        opacity: 0.7;
      ">
        <i class="fas fa-copy" style="font-size: 11px;"></i>
        <span>Copy</span>
      </button>
    `);

    // Hover effects
    button.hover(
      function () {
        $(this).css({
          background: 'rgba(55, 65, 81, 0.9)',
          color: '#e5e7eb',
          'border-color': 'rgba(107, 114, 128, 0.5)',
          opacity: '1',
          transform: 'scale(1.02)',
        });
      },
      function () {
        $(this).css({
          background: 'rgba(31, 41, 55, 0.8)',
          color: '#9ca3af',
          'border-color': 'rgba(75, 85, 99, 0.3)',
          opacity: '0.7',
          transform: 'scale(1)',
        });
      }
    );

    // Click handler
    button.on('click', function (e) {
      e.preventDefault();
      const code = pre.find('code').text();

      navigator.clipboard
        .writeText(code)
        .then(() => {
          const originalHtml = button.html();
          button.html('<i class="fas fa-check" style="font-size: 11px;"></i><span>Copied!</span>');
          button.css({
            background: 'rgba(34, 197, 94, 0.9)',
            color: '#d1fae5',
            'border-color': 'rgba(34, 197, 94, 0.5)',
            opacity: '1',
          });

          setTimeout(() => {
            button.html(originalHtml);
            button.css({
              background: 'rgba(31, 41, 55, 0.8)',
              color: '#9ca3af',
              'border-color': 'rgba(75, 85, 99, 0.3)',
              opacity: '0.7',
            });
          }, 2000);
        })
        .catch((err) => {
          console.error('Failed to copy:', err);
        });
    });

    pre.append(button);
  });
}

// Generate table of contents from pre-rendered headings
function generateTOC() {
  const toc = $('#toc');
  toc.empty();

  const headings = $('#content').find('h1, h2, h3');

  if (headings.length === 0) {
    toc.html('<p class="text-gray-500 text-sm p-2">No headings found</p>');
    return;
  }

  headings.each(function (index) {
    const heading = $(this);
    const id = `heading-${index}`;
    const text = heading.text();
    const level = heading.prop('tagName').toLowerCase();

    // Add ID to heading for scrolling
    heading.attr('id', id);

    // Create TOC item
    const tocItem = $(`
      <div class="toc-item toc-${level}" data-target="${id}">
        ${text}
      </div>
    `);

    toc.append(tocItem);
  });

  // Click handler for TOC items
  $('.toc-item').on('click', function () {
    const targetId = $(this).data('target');
    const target = $(`#${targetId}`);

    if (target.length) {
      $('html, body').animate(
        {
          scrollTop: target.offset().top - 80,
        },
        300
      );
    }
  });
}

// Setup navigation buttons
function setupNavigation() {
  const nav = docNavigation[currentDoc];

  if (nav) {
    // Previous button
    if (nav.prev) {
      $('#prev-doc')
        .attr('href', `docs.html?doc=${nav.prev}`)
        .find('.prev-title')
        .text(nav.prevTitle);
      $('#prev-doc').show();
    } else {
      $('#prev-doc').hide();
    }

    // Next button
    if (nav.next) {
      $('#next-doc')
        .attr('href', `docs.html?doc=${nav.next}`)
        .find('.next-title')
        .text(nav.nextTitle);
      $('#next-doc').show();
    } else {
      $('#next-doc').hide();
    }

    $('#doc-navigation').show();
  } else {
    $('#prev-doc').hide();
    $('#next-doc').hide();
  }
}

// Highlight active section in TOC on scroll
function updateActiveTOC() {
  const scrollPos = $(window).scrollTop() + 100;

  let activeId = null;
  $('#content h1, #content h2, #content h3').each(function () {
    if ($(this).offset().top <= scrollPos) {
      activeId = $(this).attr('id');
    }
  });

  $('.toc-item').removeClass('active');
  if (activeId) {
    $(`.toc-item[data-target="${activeId}"]`).addClass('active');
  }
}

// Sidebar toggle for mobile
$('#sidebar-toggle').on('click', function () {
  $('#sidebar').toggleClass('mobile-open');
  $('#content-wrapper').toggleClass('expanded');
});

// Document selector change
$('#doc-selector').on('change', function () {
  const docName = $(this).val();
  if (docName) {
    window.location.href = `docs.html?doc=${docName}`;
  }
});

// Scroll event for TOC highlighting
$(window).on('scroll', function () {
  updateActiveTOC();
});

// Close sidebar when clicking outside on mobile
$(document).on('click', function (e) {
  if (window.innerWidth <= 768) {
    if (!$(e.target).closest('#sidebar, #sidebar-toggle').length) {
      $('#sidebar').removeClass('mobile-open');
      $('#content-wrapper').removeClass('expanded');
    }
  }
});

// Initialize on page load
$(document).ready(function () {
  // Set doc selector value
  $('#doc-selector').val(currentDoc);

  // Apply enhancements to server-rendered content
  applySyntaxHighlighting();
  addCopyButtons();
  generateTOC();
  setupNavigation();

  // Update active section
  setTimeout(updateActiveTOC, 500);
});
