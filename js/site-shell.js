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
    { href: 'forum.html', label: 'Forum' },
    { href: 'returns.html',  label: 'Returns & Warranty' },
    { href: 'shipping.html', label: 'Shipping Policy' },
    { href: 'about.html',    label: 'About' }
  ];

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
        <div class="badge badge-nav">
          <span></span>
          VETERAN OWNED • IoT PANELS
        </div>
      </div>

      <div class="nav-menu">
        <div class="nav-links nav-primary">
          ${primaryLinks.map(link => linkHtml(link, 'nav-link')).join('')}
        </div>
      </div>
    </nav>
  `;

  const footerHtml = `
    <footer class="footer">
      <div class="footer-links" aria-label="Footer navigation">
        ${footerLinks.map(link => linkHtml(link, 'footer-link')).join('')}
      </div>
      <p>© 2026 WestTech Home Automation, LLC · Veteran Owned · Built for DIYers</p>
    </footer>
  `;

  const headerHost = document.getElementById('site-header');
  if (headerHost) {
    headerHost.innerHTML = headerHtml;
  }

  const footerHost = document.getElementById('site-footer');
  if (footerHost) {
    footerHost.innerHTML = footerHtml;
  }
})();
