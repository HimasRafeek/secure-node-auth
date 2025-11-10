// Minimal JavaScript for static documentation

// Apply syntax highlighting
$(document).ready(function () {
  // Highlight code blocks
  $('#content pre code').each(function () {
    hljs.highlightElement(this);
  });

  // Add copy buttons to code blocks
  $('#content pre').each(function () {
    const pre = $(this);

    if (pre.find('.copy-button').length > 0) return;

    pre.css('position', 'relative');

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

  // TOC click handlers
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

  // Highlight active section on scroll
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

  $(window).on('scroll', updateActiveTOC);
  setTimeout(updateActiveTOC, 500);

  // Sidebar toggle for mobile
  $('#sidebar-toggle').on('click', function () {
    $('#sidebar').toggleClass('mobile-open');
    $('#content-wrapper').toggleClass('expanded');
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
});
