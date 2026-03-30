(function () {
  'use strict';
  const primaryLinks = [
    { href: 'index.html', label: 'Home' },
    { href: 'products.html', label: 'Products' },
    { href: 'services.html', label: 'Services' },
    { href: 'order.html', label: 'Order' },
    { href: 'support.html', label: 'Support' },
    { href: 'contact.html', label: 'Contact' }
  ];
  const footerLinks = [
    { href: 'shipping.html', label: 'Shipping Policy' },
    { href: 'returns.html', label: 'Returns & Warranty' },
    { href: 'about.html', label: 'About' },
    { href: 'forum.html', label: 'Forum' }
  ];
  const currentFile = (window.location.pathname || '').split('/').pop() || 'index.html';
  function linkHtml(link, className) {
    const isActive = currentFile === link.href || (currentFile === '' && link.href === 'index.html');
    const classes = `${className}${isActive ? ' active' : ''}`;
    const aria = isActive ? ' aria-current="page"' : '';
    return `<a class="${classes}" href="${link.href}"${aria}>${link.label}</a>`;
  }
  const headerHtml = `
    <div class="nav-shell">
      <a class="brand" href="index.html" aria-label="WestTech Home Automation home">
        <img src="images/WestTech_Logo_Blue.png" alt="WestTech Home Automation logo" />
        <div class="brand-copy">
          <p class="brand-title">WestTech Home Automation</p>
          <p class="brand-sub">Enclosures • Kits • Custom Builds</p>
        </div>
      </a>
      <nav class="nav-links" aria-label="Primary navigation">
        ${primaryLinks.map((link) => linkHtml(link, 'nav-link')).join('')}
      </nav>
    </div>
  `;
  const footerHtml = `
    <div class="footer-shell">
      <div class="footer-top">
        <div class="brand-copy">
          <p class="brand-title">WestTech Home Automation</p>
          <p class="brand-sub">Enclosures first. Kits next. Custom builds by request.</p>
        </div>
        <nav class="footer-links" aria-label="Footer navigation">
          ${footerLinks.map((link) => linkHtml(link, 'footer-link')).join('')}
        </nav>
      </div>
      <p class="footer-meta">© 2026 WestTech Home Automation, LLC · Veteran Owned · Built for practical DIY and installer projects.</p>
    </div>
  `;
  const headerHost = document.getElementById('site-header');
  if (headerHost) headerHost.innerHTML = headerHtml;
  const footerHost = document.getElementById('site-footer');
  if (footerHost) footerHost.innerHTML = footerHtml;
})();
