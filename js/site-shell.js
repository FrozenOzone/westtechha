(function () {
  'use strict';

  // Edit navigation here once, and every page updates.
  const primaryLinks = [
    { href: 'index.html',    label: 'Home' },
    { href: 'products.html', label: 'Products' },
    { href: 'services.html', label: 'Services' },
    { href: 'order.html',    label: 'Order' },
    { href: 'support.html',  label: 'Support' },
    { href: 'contact.html',  label: 'Contact' }
  ];

  const footerLinks = [
    { href: 'shipping.html', label: 'Shipping Policy' },
    { href: 'returns.html',  label: 'Returns & Warranty' },
    { href: 'about.html',    label: 'About' },
    { href: 'forum.html',    label: 'Forum' }
  ];

  const PIN_HEADER_ON_SCROLL = true;

  const currentFile = (() => {
    const path = window.location.pathname || '';
    const file = path.split('/').pop();
    return file || 'index.html';
  })();

  function linkHtml(link, className = 'nav-link') {
    const isActive = currentFile === link.href || (currentFile === '' && link.href === 'index.html');
    const classes = className + (isActive ? ' active' : '');
    const aria = isActive ? ' aria-current="page"' : '';
    return `<a class="${classes}" href="${link.href}"${aria}>${link.label}</a>`;
  }

  const headerHtml = `
    <nav class="nav nav-stack">
      <div class="nav-brand-wrap">
        <a class="nav-brand" href="index.html" aria-label="WestTech Home Automation home">
          <img
            class="nav-logo nav-logo-full"
            src="images/WestTech_Logo_Blue.png"
            alt="WestTech Home Automation – IoT & Computing Solutions logo"
          />
        </a>
      </div>

      <div class="nav-menu">
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
        <p class="footer-meta footer-meta-pro">© 2026 WestTech Home Automation, LLC · Veteran Owned · Built for Installers and DIYers</p>
      </div>
    </footer>
  `;

  const headerHost = document.getElementById('site-header');

  function syncFixedHeaderOffset() {
    if (!headerHost || !PIN_HEADER_ON_SCROLL) return;
    const height = Math.ceil(headerHost.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--site-header-offset', `${height}px`);
  }

  if (headerHost) {
    headerHost.innerHTML = headerHtml;

    if (PIN_HEADER_ON_SCROLL) {
      document.body.classList.add('header-fixed');
      syncFixedHeaderOffset();
      window.addEventListener('resize', syncFixedHeaderOffset);
      window.addEventListener('load', syncFixedHeaderOffset);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(syncFixedHeaderOffset).catch(() => {});
      }
    }
  }

  const footerHost = document.getElementById('site-footer');
  if (footerHost) {
    footerHost.innerHTML = footerHtml;
  }
})();
