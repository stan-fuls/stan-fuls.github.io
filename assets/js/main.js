/* ============================================
 * Workspace of He Jie - Common JS
 * ============================================ */

(function () {
  'use strict';

  // Back to Top Button
  function initBackToTop() {
    var btn = document.getElementById('back-to-top');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'back-to-top';
      btn.className = 'back-to-top';
      btn.innerHTML = '&uarr;';
      btn.title = 'Back to Top';
      btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      document.body.appendChild(btn);
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(function () {
          if (window.scrollY > 400) {
            btn.classList.add('visible');
          } else {
            btn.classList.remove('visible');
          }
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // Mobile nav: close menu when clicking a link
  function initMobileNav() {
    var toggle = document.getElementById('nav-toggle');
    var links = document.querySelectorAll('.nav-link');
    if (!toggle) return;
    links.forEach(function (link) {
      link.addEventListener('click', function () {
        toggle.checked = false;
      });
    });
  }

  // External links: open in new tab
  function initExternalLinks() {
    var links = document.querySelectorAll('a[href^="http"]');
    links.forEach(function (link) {
      var host = link.hostname;
      var currentHost = window.location.hostname;
      if (host !== currentHost && !link.hasAttribute('target')) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initBackToTop();
      initMobileNav();
      initExternalLinks();
    });
  } else {
    initBackToTop();
    initMobileNav();
    initExternalLinks();
  }
})();
