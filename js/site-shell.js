(function () {
  'use strict';

  // Edit navigation here once, and every page updates.
  const primaryLinks = [
    { href: 'index.html',    label: 'Home' },
    { href: 'products.html', label: 'Products' },
    { href: 'services.html', label: 'Services' },
    { href: 'quote.html',    label: 'Quote' },
    { href: 'support.html',  label: 'Support' },
    { href: 'contact.html',  label: 'Contact' }
  ];

  const footerLinks = [
    { href: 'materials-serviceability.html', label: 'Materials & Serviceability' },
    { href: 'hardware-reference.html', label: 'Hardware Reference' },
    { href: 'quick-start.html',   label: 'ESP32 Quick Start' },
    { href: 'shipping.html',      label: 'Shipping Policy' },
    { href: 'returns.html',       label: 'Returns & Warranty' },
    { href: 'legal-notice.html',  label: 'Legal Notice' },
    { href: 'about.html',         label: 'About' },
    { href: 'forum.html',         label: 'Forum' }
  ];

  const ENABLE_FIXED_HEADER = true;
  const ENABLE_SCROLL_HEADER_STATE = false;

  function normalizePageName(value) {
    let v = String(value || '').trim();
    v = v.split('#')[0].split('?')[0];
    if (!v) return 'index';

    v = v.replace(/^https?:\/\/[^/]+/i, '');
    v = v.replace(/^\.\//, '');
    v = v.replace(/\/+/g, '/');

    if (v.endsWith('/')) v += 'index.html';

    const file = v.split('/').pop() || 'index.html';
    const base = file.replace(/\.html?$/i, '');
    return base || 'index';
  }

  const currentPage = normalizePageName(window.location.pathname || '');

  function linkHtml(link, className = 'nav-link') {
    const linkPage = normalizePageName(link.href);
    const isActive = currentPage === linkPage;
    const classes = className + (isActive ? ' active' : '');
    const aria = isActive ? ' aria-current="page"' : '';
    return `<a class="${classes}" href="${link.href}"${aria}>${link.label}</a>`;
  }

  const headerHtml = `
    <nav class="nav nav-stack" aria-label="Primary navigation">
      <div class="nav-brand-wrap">
        <a class="nav-brand" href="index.html" aria-label="WestTech Home Automation home">
          <img
            class="nav-logo nav-logo-full"
            src="images/WestTech_Logo_Blue.png"
            alt="WestTech Home Automation – IoT & Computing Solutions logo"
          />
        </a>
      </div>

      <button
        class="nav-mobile-toggle"
        type="button"
        aria-expanded="false"
        aria-controls="site-primary-menu"
      >
        <span class="nav-mobile-toggle-text">Menu</span>
        <span class="nav-mobile-toggle-icon" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
      </button>

      <div class="nav-menu" id="site-primary-menu">
        <div class="badge badge-nav">
          <span></span>
          SCOUT • RANGER • COMMAND
        </div>

        <div class="nav-links nav-primary">
          ${primaryLinks.map(link => linkHtml(link, 'nav-link')).join('')}
        </div>
      </div>
    </nav>
  `;

  const footerHtml = `
    <footer class="footer footer-pro">
      <div class="footer-shell footer-shell-pro">
        <div class="footer-top footer-top-pro">
          <div class="footer-links footer-links-pro" aria-label="Footer navigation">
            ${footerLinks.map(link => linkHtml(link, 'footer-link')).join('')}
          </div>
        </div>
        <p class="footer-legal">WestTech Home Automation, LLC enclosure designs, digital files, product photos, and website content are original proprietary works. Unauthorized copying or redistribution is strictly prohibited!</p>
        <p class="footer-meta footer-meta-pro">© 2026 WestTech Home Automation, LLC · Veteran Owned · Built for Installers and DIYers</p>
      </div>
    </footer>
  `;

  const headerHost = document.getElementById('site-header');

  function syncFixedHeaderOffset() {
    if (!headerHost || !ENABLE_FIXED_HEADER) return;

    // Keep the header locked, but do not shrink/compress it on scroll.
    document.body.classList.remove('header-scrolled');
    headerHost.classList.remove('is-scrolled');

    const height = Math.ceil(headerHost.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--site-header-offset', `${height}px`);
  }

  function syncScrolledHeaderState() {
    if (!headerHost) return;

    if (!ENABLE_SCROLL_HEADER_STATE) {
      document.body.classList.remove('header-scrolled');
      headerHost.classList.remove('is-scrolled');
      return;
    }

    const isScrolled = (window.scrollY || window.pageYOffset || 0) > 18;
    document.body.classList.toggle('header-scrolled', isScrolled);
    headerHost.classList.toggle('is-scrolled', isScrolled);
  }

  if (headerHost) {
    headerHost.innerHTML = headerHtml;

    const mobileToggle = headerHost.querySelector('.nav-mobile-toggle');
    const mobileMenu = headerHost.querySelector('#site-primary-menu');
    const mobileBreakpoint = window.matchMedia('(max-width: 700px)');

    function setMobileMenuOpen(isOpen) {
      if (!mobileToggle || !mobileMenu) return;
      const shouldOpen = Boolean(isOpen && mobileBreakpoint.matches);
      headerHost.classList.toggle('nav-open', shouldOpen);
      mobileToggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    }

    if (mobileToggle && mobileMenu) {
      mobileToggle.addEventListener('click', () => {
        const isOpen = headerHost.classList.contains('nav-open');
        setMobileMenuOpen(!isOpen);
      });

      mobileMenu.addEventListener('click', (event) => {
        if (event.target.closest('a')) setMobileMenuOpen(false);
      });

      document.addEventListener('click', (event) => {
        if (!headerHost.contains(event.target)) setMobileMenuOpen(false);
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setMobileMenuOpen(false);
      });

      if (mobileBreakpoint.addEventListener) {
        mobileBreakpoint.addEventListener('change', () => setMobileMenuOpen(false));
      } else if (mobileBreakpoint.addListener) {
        mobileBreakpoint.addListener(() => setMobileMenuOpen(false));
      }
    }

    if (ENABLE_FIXED_HEADER) {
      document.body.classList.add('header-fixed');

      const refreshHeaderLayout = () => {
        syncFixedHeaderOffset();
        syncScrolledHeaderState();
      };

      refreshHeaderLayout();
      window.addEventListener('scroll', syncScrolledHeaderState, { passive: true });
      window.addEventListener('resize', refreshHeaderLayout, { passive: true });
      window.addEventListener('load', refreshHeaderLayout);

      if (window.ResizeObserver) {
        const headerObserver = new ResizeObserver(refreshHeaderLayout);
        headerObserver.observe(headerHost);
      }

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(refreshHeaderLayout).catch(() => {});
      }
    }
  }

  const footerHost = document.getElementById('site-footer');
  if (footerHost) {
    footerHost.innerHTML = footerHtml;
  }
})();
