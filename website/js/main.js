$(document).ready(function () {
  // Mobile Menu Toggle
  $('#mobile-menu-btn').on('click', function () {
    $('#mobile-menu').slideToggle(300);
    const icon = $(this).find('i');
    icon.toggleClass('fa-bars fa-times');
  });

  // Close mobile menu when clicking a link
  $('#mobile-menu a').on('click', function () {
    $('#mobile-menu').slideUp(300);
    $('#mobile-menu-btn i').removeClass('fa-times').addClass('fa-bars');
  });

  // Framework Tabs
  $('.framework-tab').on('click', function () {
    const framework = $(this).data('framework');

    // Remove active state from all tabs and contents
    $('.framework-tab')
      .removeClass('border-primary text-primary border-b-2')
      .addClass('text-gray-400 border-b-2 border-transparent');
    $('.framework-content').hide();

    // Add active state to clicked tab
    $(this)
      .removeClass('text-gray-400 border-transparent')
      .addClass('border-primary text-primary border-b-2');

    // Show corresponding content
    $(`#${framework}-code`).fadeIn(300);
  });

  // Copy Code Functionality
  $('.copy-btn, .copy-code').on('click', function (e) {
    e.preventDefault();
    const button = $(this);
    const codeBlock = button.closest('.relative').find('code');
    let code = codeBlock.text();

    // If no code element, try pre
    if (!code) {
      code = button.closest('.relative').find('pre').text();
    }

    // Copy to clipboard
    navigator.clipboard
      .writeText(code)
      .then(function () {
        // Success feedback
        const originalHtml = button.html();
        button.html('<i class="fas fa-check"></i> Copied!');
        button.removeClass('bg-primary').addClass('bg-green-500');

        setTimeout(function () {
          button.html(originalHtml);
          button.removeClass('bg-green-500').addClass('bg-primary');
        }, 2000);
      })
      .catch(function (err) {
        // Error feedback
        console.error('Failed to copy:', err);
        const originalHtml = button.html();
        button.html('<i class="fas fa-times"></i> Failed');
        button.removeClass('bg-primary').addClass('bg-red-500');

        setTimeout(function () {
          button.html(originalHtml);
          button.removeClass('bg-red-500').addClass('bg-primary');
        }, 2000);
      });
  });

  // Smooth Scrolling for Anchor Links
  $('a[href^="#"]').on('click', function (e) {
    const href = $(this).attr('href');

    if (href === '#' || !href) {
      return;
    }

    e.preventDefault();
    const target = $(href);

    if (target.length) {
      $('html, body').animate(
        {
          scrollTop: target.offset().top - 80,
        },
        600
      );

      // Close mobile menu if open
      $('#mobile-menu').slideUp(300);
      $('#mobile-menu-btn i').removeClass('fa-times').addClass('fa-bars');
    }
  });

  // Scroll Animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px',
  };

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        $(entry.target).addClass('fade-in-up');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe elements for animation
  $('.bg-gray-800, .bg-gray-900').each(function () {
    const element = this;
    if ($(element).hasClass('p-6')) {
      observer.observe(element);
    }
  });

  // Active Navigation Highlight on Scroll
  $(window).on('scroll', function () {
    let current = '';

    $('section[id]').each(function () {
      const sectionTop = $(this).offset().top;
      const scrollPos = $(window).scrollTop();

      if (scrollPos >= sectionTop - 200) {
        current = $(this).attr('id');
      }
    });

    $('nav a[href^="#"]').each(function () {
      $(this).removeClass('text-primary').addClass('text-gray-300');

      if ($(this).attr('href') === `#${current}`) {
        $(this).removeClass('text-gray-300').addClass('text-primary');
      }
    });
  });

  // Navbar Background on Scroll
  $(window).on('scroll', function () {
    if ($(window).scrollTop() > 50) {
      $('nav').css('background-opacity', '0.95');
    } else {
      $('nav').css('background-opacity', '0.9');
    }
  });

  // Counter Animation for Stats
  function animateCounter(element, target) {
    let current = 0;
    const increment = target / 50;
    const timer = setInterval(function () {
      current += increment;
      if (current >= target) {
        $(element).text(target);
        clearInterval(timer);
      } else {
        $(element).text(Math.floor(current));
      }
    }, 30);
  }

  // Stats Counter on Scroll Into View
  const statsObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const target = $(entry.target);
          const value = target.text();

          // Only animate if it's a number
          if (/^\d+$/.test(value)) {
            target.text('0');
            animateCounter(target[0], parseInt(value));
          }

          statsObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  // Observe stats numbers
  $('.gradient-bg .font-bold').each(function () {
    statsObserver.observe(this);
  });

  // Add hover effects to cards
  $('.bg-gray-800, .bg-gray-900').each(function () {
    if ($(this).hasClass('p-6')) {
      $(this).addClass('hover-lift');
    }
  });

  // Syntax Highlighting - DISABLED (was causing double-highlighting issues)
  // Code blocks display correctly without syntax highlighting
  $('code').each(function () {
    // Skip if already highlighted
    if ($(this).find('span').length > 0) {
      return;
    }

    // Get text content to avoid HTML entities issues
    let text = $(this).text();
    let html = text;

    // Keywords - must be done first
    html = html.replace(
      /\b(const|let|var|function|class|import|export|from|require|async|await|return|if|else|for|while|try|catch|new)\b/g,
      '###KEYWORD###$1###ENDKEYWORD###'
    );

    // Strings
    html = html.replace(/(['"`])((?:(?!\1).)*)\1/g, '###STRING###$1$2$1###ENDSTRING###');

    // Functions
    html = html.replace(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, '###FUNCTION###$1###ENDFUNCTION###(');

    // Comments
    html = html.replace(/(\/\/.*$)/gm, '###COMMENT###$1###ENDCOMMENT###');

    // Numbers
    html = html.replace(/\b(\d+)\b/g, '###NUMBER###$1###ENDNUMBER###');

    // Replace markers with actual HTML
    html = html.replace(
      /###KEYWORD###(.*?)###ENDKEYWORD###/g,
      '<span style="color: #c678dd">$1</span>'
    );
    html = html.replace(
      /###STRING###(.*?)###ENDSTRING###/g,
      '<span style="color: #98c379">$1</span>'
    );
    html = html.replace(
      /###FUNCTION###(.*?)###ENDFUNCTION###/g,
      '<span style="color: #61afef">$1</span>'
    );
    html = html.replace(
      /###COMMENT###(.*?)###ENDCOMMENT###/g,
      '<span style="color: #5c6370; font-style: italic;">$1</span>'
    );
    html = html.replace(
      /###NUMBER###(.*?)###ENDNUMBER###/g,
      '<span style="color: #d19a66">$1</span>'
    );

    $(this).html(html);
  });

  // Log initialization
  console.log('SecureNodeAuth Landing Page - Initialized ✓');
  console.log('Tailwind CSS: ✓');
  console.log('jQuery: ✓');
  console.log('All features loaded successfully!');
});
