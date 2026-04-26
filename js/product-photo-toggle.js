(function(){
  const root = document.querySelector('[data-product-photo-toggle-root]');
  if(!root) return;

  const sets = {};
  document.querySelectorAll('script[type="application/json"][data-photo-set]').forEach((script) => {
    const id = script.dataset.photoSet;
    try {
      sets[id] = JSON.parse(script.textContent);
    } catch (err) {
      console.warn('Invalid product photo set:', id, err);
    }
  });

  const setIds = Object.keys(sets);
  if(!setIds.length) return;

  const pageName = (location.pathname.split('/').pop() || 'product-page').replace(/[^a-z0-9_-]/gi, '-');
  const storageKey = 'westtechha-product-photo-set:' + pageName;

  function readInitialSet(){
    const urlSet = new URLSearchParams(location.search).get('photos');
    if(urlSet && sets[urlSet]) return urlSet;

    const savedSet = localStorage.getItem(storageKey);
    if(savedSet && sets[savedSet]) return savedSet;

    const defaultSet = root.dataset.defaultPhotoSet;
    if(defaultSet && sets[defaultSet]) return defaultSet;

    return setIds[0];
  }

  function setImage(img, item){
    if(!img || !item) return;
    if(item.src) img.src = item.src;
    if(item.alt) {
      img.alt = item.alt;
      img.setAttribute('aria-label', item.alt + ' - open larger view');
    }
  }

  function applyPhotoSet(id){
    const cfg = sets[id];
    if(!cfg) return;

    root.dataset.activePhotoSet = id;

    const heroImg = root.querySelector('[data-product-hero-image]');
    if(heroImg && cfg.hero) {
      if(cfg.hero.src) heroImg.src = cfg.hero.src;
      if(cfg.hero.alt) heroImg.alt = cfg.hero.alt;
    }

    const heroTitle = root.querySelector('[data-product-hero-title]');
    if(heroTitle && cfg.hero && cfg.hero.title) heroTitle.textContent = cfg.hero.title;

    const heroSpec = root.querySelector('[data-product-hero-spec]');
    if(heroSpec && cfg.hero && cfg.hero.specHtml) heroSpec.innerHTML = cfg.hero.specHtml;

    const note = root.querySelector('[data-product-photo-note]');
    if(note && cfg.note) note.textContent = cfg.note;

    const layoutChip = root.querySelector('[data-product-layout-chip]');
    if(layoutChip && cfg.layoutChip) layoutChip.textContent = cfg.layoutChip;

    const figures = Array.from(root.querySelectorAll('[data-product-gallery] figure'));
    figures.forEach((figure, index) => {
      const item = cfg.gallery && cfg.gallery[index];
      if(!item) return;

      const img = figure.querySelector('img');
      setImage(img, item);

      const caption = figure.querySelector('figcaption');
      if(caption && item.caption) caption.textContent = item.caption;
    });

    root.querySelectorAll('[data-photo-set-target]').forEach((button) => {
      const active = button.dataset.photoSetTarget === id;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    localStorage.setItem(storageKey, id);
  }

  root.querySelectorAll('[data-photo-set-target]').forEach((button) => {
    button.addEventListener('click', () => applyPhotoSet(button.dataset.photoSetTarget));
  });

  applyPhotoSet(readInitialSet());
})();
