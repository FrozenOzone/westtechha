(function(){
  'use strict';

  const revealItems = Array.from(document.querySelectorAll('[data-reveal]'));
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((el) => el.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealItems.forEach((el) => observer.observe(el));
  }

  const stage = document.querySelector('.coaster-hero-stage');
  if (stage && !reduceMotion) {
    stage.addEventListener('pointermove', (event) => {
      const rect = stage.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 22;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 22;
      stage.style.setProperty('--mx', `${x}px`);
      stage.style.setProperty('--my', `${y}px`);
    });
    stage.addEventListener('pointerleave', () => {
      stage.style.setProperty('--mx', '0px');
      stage.style.setProperty('--my', '0px');
    });
  }
})();
