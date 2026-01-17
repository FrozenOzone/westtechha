/* WestTechHA Email Chooser
   Opens a modal so visitors can choose Gmail / Outlook Web / Default mail app / Copy.

   Works in two ways:
     1) Any element with data-wt-email-trigger + data-email / data-subject / data-body
     2) Any <a href="mailto:..."> link (intercepted and shown in chooser)

   Public API:
     WTEmail.open({ to, subject, body })
*/

(function () {
  'use strict';

  const DEFAULT_TO = 'support@WestTechHA.com';

  function ensureModal() {
    if (document.getElementById('wtEmailModal')) return;

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="wt-email-modal" id="wtEmailModal" aria-hidden="true">
        <div class="wt-email-backdrop" data-wt-email-close></div>
        <div class="wt-email-card" role="dialog" aria-modal="true" aria-label="Email options">
          <div class="wt-email-head">
            <div class="wt-email-title">Email WestTechHA</div>
            <button class="wt-email-close" id="wtEmailClose" type="button" aria-label="Close">×</button>
          </div>
          <p class="wt-email-text">Choose how you’d like to compose this message:</p>
          <div class="wt-email-actions">
            <a class="btn btn-primary" id="wtEmailGmail" target="_blank" rel="noopener">Open Gmail</a>
            <a class="btn btn-primary" id="wtEmailOutlook" target="_blank" rel="noopener">Open Outlook Web</a>
            <a class="btn btn-ghost" id="wtEmailMailto">Use Default Mail App</a>
            <button class="btn btn-ghost" id="wtEmailCopy" type="button">Copy Address</button>
          </div>
          <p class="wt-email-small">To: <span class="mono" id="wtEmailToText">${DEFAULT_TO}</span></p>
        </div>
      </div>
      <div class="wt-email-toast" id="wtEmailToast" aria-hidden="true"></div>
    `;

    // Append to end of body
    document.body.appendChild(wrap);
  }

  function enc(v) {
    return encodeURIComponent(v || '');
  }

  function parseMailto(href) {
    // href like: mailto:addr?subject=...&body=...
    const out = { to: '', subject: '', body: '' };
    if (!href || typeof href !== 'string') return out;

    const raw = href.trim();
    if (!raw.toLowerCase().startsWith('mailto:')) return out;

    const rest = raw.slice(7); // after mailto:
    const qIndex = rest.indexOf('?');

    const toPart = qIndex >= 0 ? rest.slice(0, qIndex) : rest;
    const query = qIndex >= 0 ? rest.slice(qIndex + 1) : '';

    out.to = decodeURIComponent(toPart || '').trim() || DEFAULT_TO;

    if (query) {
      try {
        const params = new URLSearchParams(query);
        out.subject = params.get('subject') || params.get('su') || '';
        out.body = params.get('body') || '';
      } catch (e) {
        // ignore
      }
    }

    return out;
  }

  function getEls() {
    const modal = document.getElementById('wtEmailModal');
    if (!modal) return null;

    return {
      modal,
      backdrop: modal.querySelector('[data-wt-email-close]'),
      closeBtn: modal.querySelector('#wtEmailClose'),
      gmail: modal.querySelector('#wtEmailGmail'),
      outlook: modal.querySelector('#wtEmailOutlook'),
      mailto: modal.querySelector('#wtEmailMailto'),
      copyBtn: modal.querySelector('#wtEmailCopy'),
      toText: modal.querySelector('#wtEmailToText'),
      toast: document.getElementById('wtEmailToast')
    };
  }

  function buildLinks(els, to, subject, body) {
    const toEnc = enc(to);
    const suEnc = enc(subject);
    const bodyEnc = enc(body);

    // Gmail compose
    els.gmail.href =
      'https://mail.google.com/mail/?view=cm&fs=1&to=' + toEnc +
      (subject ? '&su=' + suEnc : '') +
      (body ? '&body=' + bodyEnc : '');

    // Outlook Web compose
    els.outlook.href =
      'https://outlook.office.com/mail/deeplink/compose?to=' + toEnc +
      (subject ? '&subject=' + suEnc : '') +
      (body ? '&body=' + bodyEnc : '');

    // Default mail app
    els.mailto.href =
      'mailto:' + to +
      (subject || body ? '?' : '') +
      (subject ? 'subject=' + suEnc : '') +
      (subject && body ? '&' : '') +
      (body ? 'body=' + bodyEnc : '');

    els.toText.textContent = to;
  }

  function openModal(payload) {
    ensureModal();
    const els = getEls();
    if (!els) return;

    const to = (payload && payload.to) ? payload.to : DEFAULT_TO;
    const subject = payload && payload.subject ? payload.subject : '';
    const body = payload && payload.body ? payload.body : '';

    buildLinks(els, to, subject, body);
    els.modal.classList.add('is-open');
    els.modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    const els = getEls();
    if (!els) return;
    els.modal.classList.remove('is-open');
    els.modal.setAttribute('aria-hidden', 'true');
  }

  function showToast(msg) {
    const els = getEls();
    if (!els || !els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    window.setTimeout(() => {
      els.toast.classList.remove('show');
    }, 1400);
  }

  // Public API
  window.WTEmail = {
    open: openModal,
    close: closeModal
  };

  // Ensure modal exists (safe even if page never uses it)
  document.addEventListener('DOMContentLoaded', () => {
    ensureModal();

    const els = getEls();
    if (!els) return;

    // Close actions
    if (els.backdrop) els.backdrop.addEventListener('click', closeModal);
    if (els.closeBtn) els.closeBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Copy
    if (els.copyBtn) {
      els.copyBtn.addEventListener('click', async () => {
        const email = (els.toText && els.toText.textContent) ? els.toText.textContent : '';
        try {
          await navigator.clipboard.writeText(email);
          showToast('Copied');
        } catch (err) {
          window.prompt('Copy this email address:', email);
        }
      });
    }
  });

  // Global click handling
  document.addEventListener('click', (e) => {
    // 1) Explicit triggers
    const t = e.target.closest('[data-wt-email-trigger]');
    if (t) {
      e.preventDefault();
      const to = t.getAttribute('data-email') || DEFAULT_TO;
      const subject = t.getAttribute('data-subject') || '';
      const body = t.getAttribute('data-body') || '';
      openModal({ to, subject, body });
      return;
    }

    // 2) mailto links anywhere on the site
    const a = e.target.closest('a[href^="mailto:"]');
    if (a) {
      e.preventDefault();
      const payload = parseMailto(a.getAttribute('href'));
      openModal(payload);
    }
  });
})();
