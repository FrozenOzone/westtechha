(function(){
  // WestTechHA Gallery Lightbox v4
  // This version follows the actual site structure instead of guessing wrapper shape.
  //
  // Existing gallery worked because old code targeted:
  //   .product-gallery figure img
  //
  // But the top hero image structure is usually:
  //   <figure class="product-gallery">
  //     <img data-product-hero-image ...>
  //   </figure>
  //
  // So this version detects product images by the actual image/source context:
  // - any img[data-product-hero-image]
  // - any img whose src/currentSrc contains images/products/
  // - any img inside product/gallery/checkout product containers

  function imageSrc(img){
    return ((img.currentSrc || img.src || img.getAttribute('src') || '') + '').replace(/\\/g, '/');
  }

  function isProductImage(img){
    if(!img || img.tagName !== 'IMG') return false;

    if(img.hasAttribute('data-product-hero-image')) return true;

    const src = imageSrc(img);
    if(src.includes('images/products/')) return true;

    if(img.closest('.product-gallery, .product-gallery-grid, .product-card, .checkout-product-top, .checkout-product-card')){
      return true;
    }

    return false;
  }

  function getProductImages(){
    const seen = new Set();

    return Array.from(document.querySelectorAll('img')).filter((img) => {
      if(seen.has(img)) return false;
      if(!isProductImage(img)) return false;
      seen.add(img);
      return true;
    });
  }

  function ensureClickableState(){
    getProductImages().forEach((img, index) => {
      img.dataset.galleryIndex = String(index);
      img.setAttribute('tabindex', '0');
      img.setAttribute('role', 'button');
      img.setAttribute('aria-haspopup', 'dialog');
      img.setAttribute('aria-label', (img.alt || 'Open product image') + ' - open larger view');
      img.style.cursor = 'zoom-in';
    });
  }

  const overlay = document.createElement('div');
  overlay.className = 'product-lightbox';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="product-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Expanded product image">
      <button type="button" class="product-lightbox-nav product-lightbox-prev" aria-label="Show previous image">&#8249;</button>
      <button type="button" class="product-lightbox-close" aria-label="Close image viewer">×</button>
      <div class="product-lightbox-image-wrap">
        <img class="product-lightbox-image" alt=""/>
      </div>
      <button type="button" class="product-lightbox-nav product-lightbox-next" aria-label="Show next image">&#8250;</button>
      <p class="product-lightbox-caption"></p>
    </div>
  `;
  document.body.appendChild(overlay);

  const dialog = overlay.querySelector('.product-lightbox-dialog');
  const closeButton = overlay.querySelector('.product-lightbox-close');
  const prevButton = overlay.querySelector('.product-lightbox-prev');
  const nextButton = overlay.querySelector('.product-lightbox-next');
  const lightboxImage = overlay.querySelector('.product-lightbox-image');
  const caption = overlay.querySelector('.product-lightbox-caption');

  let images = [];
  let currentIndex = 0;
  let lastTrigger = null;

  function refreshImages(){
    images = getProductImages();
    ensureClickableState();
    return images;
  }

  function captionFor(img){
    const figure = img.closest('figure');
    const figcaption = figure ? figure.querySelector('figcaption') : null;
    if(figcaption && figcaption.textContent.trim()){
      return figcaption.textContent.trim();
    }

    const card = img.closest('.product-card, .checkout-card, article');
    const title = card ? card.querySelector('[data-product-hero-title], .product-name, h2, h3') : null;
    if(title && title.textContent.trim()){
      return title.textContent.trim();
    }

    return img.alt || 'Product image';
  }

  function render(index){
    refreshImages();
    if(!images.length) return;

    currentIndex = (index + images.length) % images.length;
    const img = images[currentIndex];

    lightboxImage.src = img.currentSrc || img.src;
    lightboxImage.alt = img.alt || '';

    caption.textContent = `${captionFor(img)} (${currentIndex + 1} of ${images.length})`;
    prevButton.disabled = images.length < 2;
    nextButton.disabled = images.length < 2;
  }

  function openFromImage(img){
    refreshImages();

    const index = images.indexOf(img);
    if(index < 0) return;

    lastTrigger = img;
    render(index);

    overlay.hidden = false;
    document.body.classList.add('lightbox-open');
    closeButton.focus();
  }

  function close(){
    overlay.hidden = true;
    lightboxImage.removeAttribute('src');
    document.body.classList.remove('lightbox-open');

    if(lastTrigger && typeof lastTrigger.focus === 'function'){
      lastTrigger.focus();
    }
  }

  function previous(){
    render(currentIndex - 1);
  }

  function next(){
    render(currentIndex + 1);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', refreshImages);
  } else {
    refreshImages();
  }

  // Capture phase so we get the hero click even if another handler is attached later.
  document.addEventListener('click', function(event){
    const img = event.target && event.target.closest ? event.target.closest('img') : null;
    if(!isProductImage(img)) return;

    event.preventDefault();
    openFromImage(img);
  }, true);

  document.addEventListener('keydown', function(event){
    if(!overlay.hidden){
      if(event.key === 'Escape'){
        close();
        return;
      }

      if(event.key === 'ArrowLeft'){
        event.preventDefault();
        previous();
        return;
      }

      if(event.key === 'ArrowRight'){
        event.preventDefault();
        next();
        return;
      }

      return;
    }

    if(event.key !== 'Enter' && event.key !== ' ') return;

    const active = document.activeElement;
    if(!isProductImage(active)) return;

    event.preventDefault();
    openFromImage(active);
  }, true);

  closeButton.addEventListener('click', close);
  prevButton.addEventListener('click', previous);
  nextButton.addEventListener('click', next);

  overlay.addEventListener('click', function(event){
    if(event.target === overlay){
      close();
    }
  });

  dialog.addEventListener('click', function(event){
    event.stopPropagation();
  });

  // Product toggles can swap src/alt after initial load; refresh shortly after any click.
  document.addEventListener('click', function(){
    window.setTimeout(refreshImages, 0);
  });
})();
