(function(){
  const galleryImages = Array.from(document.querySelectorAll('.product-gallery figure img'));
  if(!galleryImages.length) return;

  galleryImages.forEach((img, index) => {
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-haspopup', 'dialog');
    img.setAttribute('aria-label', (img.alt || 'Open image') + ' - open larger view');
    img.dataset.galleryIndex = String(index);
  });

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
  let lastTrigger = null;
  let currentIndex = 0;

  function renderImage(index){
    currentIndex = (index + galleryImages.length) % galleryImages.length;
    const img = galleryImages[currentIndex];
    lightboxImage.src = img.currentSrc || img.src;
    lightboxImage.alt = img.alt || '';
    const figure = img.closest('figure');
    const figureCaption = figure ? figure.querySelector('figcaption') : null;
    const baseCaption = figureCaption ? figureCaption.textContent.trim() : (img.alt || '');
    caption.textContent = `${baseCaption} (${currentIndex + 1} of ${galleryImages.length})`;
    prevButton.disabled = galleryImages.length < 2;
    nextButton.disabled = galleryImages.length < 2;
  }

  function openLightbox(img){
    lastTrigger = img;
    renderImage(Number(img.dataset.galleryIndex || 0));
    overlay.hidden = false;
    document.body.classList.add('lightbox-open');
    closeButton.focus();
  }

  function closeLightbox(){
    overlay.hidden = true;
    lightboxImage.removeAttribute('src');
    document.body.classList.remove('lightbox-open');
    if(lastTrigger) lastTrigger.focus();
  }

  function showPrevious(){
    renderImage(currentIndex - 1);
  }

  function showNext(){
    renderImage(currentIndex + 1);
  }

  galleryImages.forEach((img) => {
    img.addEventListener('click', () => openLightbox(img));
    img.addEventListener('keydown', (event) => {
      if(event.key === 'Enter' || event.key === ' '){
        event.preventDefault();
        openLightbox(img);
      }
    });
  });

  closeButton.addEventListener('click', closeLightbox);
  prevButton.addEventListener('click', showPrevious);
  nextButton.addEventListener('click', showNext);
  overlay.addEventListener('click', (event) => {
    if(event.target === overlay){
      closeLightbox();
    }
  });
  dialog.addEventListener('click', (event) => event.stopPropagation());

  document.addEventListener('keydown', (event) => {
    if(overlay.hidden) return;
    if(event.key === 'Escape'){
      closeLightbox();
      return;
    }
    if(event.key === 'ArrowLeft'){
      event.preventDefault();
      showPrevious();
      return;
    }
    if(event.key === 'ArrowRight'){
      event.preventDefault();
      showNext();
    }
  });
})();
