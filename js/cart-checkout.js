(function () {
  'use strict';

  const CONFIG_ENDPOINT = "/api/paypal/config";
  const PRODUCTS_ENDPOINT = "/api/products/{sku}";
  const CREATE_ORDER_ENDPOINT = "/api/paypal/orders";
  const ORDER_DETAILS_ENDPOINT = "/api/paypal/orders/{orderID}/details";
  const PREPARE_COLORADO_ENDPOINT = "/api/paypal/orders/{orderID}/prepare-colorado";
  const CAPTURE_ORDER_ENDPOINT = "/api/paypal/orders/{orderID}/capture";
  const SUCCESS_URL = "order-thank-you.html";
  const US_ONLY_SHIPPING_MESSAGE = "Website checkout currently supports U.S. shipping addresses only.";

  const els = {
    items: document.getElementById('cart-items'),
    clear: document.getElementById('cart-clear-button'),
    customLink: document.getElementById('cart-custom-link'),
    totalQty: document.getElementById('cart-total-quantity'),
    productSummary: document.getElementById('cart-product-summary'),
    subtotal: document.getElementById('cart-subtotal'),
    shipping: document.getElementById('cart-shipping'),
    tax: document.getElementById('cart-tax'),
    total: document.getElementById('cart-total'),
    totalLabel: document.getElementById('cart-total-label'),
    totalLine: document.getElementById('cart-total-line'),
    availability: document.getElementById('cart-availability-status'),
    paypalShell: document.querySelector('.checkout-paypal-shell'),
    paypalContainer: document.getElementById('cart-paypal-button-container'),
    status: document.getElementById('cart-status'),
    coloradoCard: document.getElementById('cart-colorado-card'),
    coloradoSummary: document.getElementById('cart-colorado-summary'),
    coloradoResult: document.getElementById('cart-colorado-result'),
    changeNote: document.getElementById('cart-change-note'),
    verifyWrap: document.getElementById('cart-verify-wrap'),
    verifyCheckbox: document.getElementById('cart-verify-checkbox'),
    completeButton: document.getElementById('cart-complete-button'),
    invoice: document.getElementById('cart-invoice-id'),
    displayName: document.getElementById('cart-display-name'),
    displayAddress1: document.getElementById('cart-display-address1'),
    displayAddress2: document.getElementById('cart-display-address2'),
    displayCityStateZip: document.getElementById('cart-display-citystatezip'),
    resultItem: document.getElementById('cart-result-item'),
    resultShipping: document.getElementById('cart-result-shipping'),
    resultTax: document.getElementById('cart-result-tax'),
    resultTotal: document.getElementById('cart-result-total')
  };

  const fields = {
    fullName: document.getElementById('cart-full-name'),
    address1: document.getElementById('cart-address1'),
    address2: document.getElementById('cart-address2'),
    city: document.getElementById('cart-city'),
    state: document.getElementById('cart-state'),
    postalCode: document.getElementById('cart-postal')
  };

  if (!els.items || !els.status || !els.paypalContainer || !window.WESTTECH_CART) return;

  const state = {
    config: null,
    paypalLoaded: false,
    buttonsRendered: false,
    products: {},
    pendingOrderId: null,
    pendingQuote: null,
    pendingInvoiceId: null
  };

  function formatMoney(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
  }

  function setStatus(message, isError) {
    els.status.textContent = message;
    els.status.classList.toggle('is-error', Boolean(isError));
  }

  function fetchJson(url, options) {
    return fetch(url, options).then(async function (response) {
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || 'Request failed.');
      return data;
    });
  }

  function cartItems() {
    return window.WESTTECH_CART.read();
  }

  function normalizeQuantity(quantity) {
    const parsed = Number.parseInt(quantity, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return parsed;
  }

  function normalizeColor(color) {
    return String(color || 'White').trim().toLowerCase() === 'black' ? 'Black' : 'White';
  }

  function totalQuantity(items = cartItems()) {
    return items.reduce((sum, item) => sum + normalizeQuantity(item.quantity), 0);
  }

  function shippingForQuantity(quantity) {
    if (quantity === 1) return 8.95;
    if (quantity === 2) return 10.95;
    if (quantity === 3 || quantity === 4) return 14.95;
    return null;
  }

  function checkoutItems() {
    return cartItems().map((item) => ({
      sku: item.sku,
      name: item.name,
      color: normalizeColor(item.color),
      quantity: normalizeQuantity(item.quantity)
    }));
  }

  function subtotalAmount() {
    return checkoutItems().reduce((sum, item) => {
      const product = state.products[item.sku];
      const unit = Number(product?.unitAmount || 0);
      return sum + unit * item.quantity;
    }, 0);
  }

  function canFulfillCart() {
    const items = checkoutItems();
    if (!items.length) return false;
    if (totalQuantity(items) > 4) return false;
    return items.every((item) => {
      const availability = state.products[item.sku]?.availability || {};
      if (!availability.enforced) return true;
      return availability.canFulfill !== false && availability.status !== 'temporarily-unavailable';
    });
  }

  function availabilityLabel() {
    const items = checkoutItems();
    if (!items.length) return 'Cart is empty';
    if (totalQuantity(items) > 4) return 'Custom order required';
    if (canFulfillCart()) return 'In stock';
    return 'One or more items are unavailable';
  }

  function resetColoradoState() {
    state.pendingQuote = null;
    if (!els.coloradoCard) return;
    els.coloradoCard.classList.add('is-hidden');
    els.coloradoSummary.classList.add('is-hidden');
    els.coloradoResult.classList.add('is-hidden');
    els.changeNote.classList.add('is-hidden');
    els.verifyWrap.classList.add('is-hidden');
    els.verifyWrap.classList.remove('is-attention');
    els.verifyCheckbox.checked = false;
    els.completeButton.classList.add('is-hidden');
    els.completeButton.disabled = true;
  }

  function updateInvoice() {
    if (els.invoice) els.invoice.textContent = state.pendingInvoiceId || 'Pending…';
  }

  function updateAddressPreview() {
    if (els.displayName) {
      els.displayName.textContent = fields.fullName.value.trim() || 'Pending…';
    }
    if (els.displayAddress1) {
      els.displayAddress1.textContent = fields.address1.value.trim() || '—';
    }
    if (els.displayAddress2) {
      const line2 = fields.address2.value.trim();
      els.displayAddress2.textContent = line2;
      els.displayAddress2.classList.toggle('is-hidden', !line2);
    }
    if (els.displayCityStateZip) {
      const city = fields.city.value.trim();
      const stateCode = fields.state.value.trim();
      const postal = fields.postalCode.value.trim();
      const cityState = city && stateCode ? `${city}, ${stateCode}` : (city || stateCode || '');
      const combined = [cityState, postal].filter(Boolean).join(' ');
      els.displayCityStateZip.textContent = combined || '—';
    }
  }

  async function loadProductForItem(item) {
    const endpoint = PRODUCTS_ENDPOINT.replace('{sku}', encodeURIComponent(item.sku));
    const data = await fetchJson(`${endpoint}?quantity=${encodeURIComponent(String(item.quantity))}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    return data.product;
  }

  async function loadProducts() {
    const items = checkoutItems();
    const next = {};
    for (const item of items) {
      next[item.sku] = await loadProductForItem(item);
    }
    state.products = next;
  }

  function renderItems() {
    const items = checkoutItems();
    els.items.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'cart-empty';
      empty.innerHTML = 'Your cart is empty. <a href="products.html">Browse products</a> to add an enclosure.';
      els.items.appendChild(empty);
      return;
    }

    items.forEach((item, index) => {
      const product = state.products[item.sku] || { name: item.name || item.sku, unitAmount: 0 };
      const lineTotal = Number(product.unitAmount || 0) * item.quantity;
      const card = document.createElement('article');
      card.className = 'cart-item';
      card.innerHTML = `
        <div>
          <h3 class="cart-item-title">${product.name || item.name}</h3>
          <p class="cart-item-meta">${item.color} • ${product.layout || 'Selected enclosure'}</p>
          <div class="cart-item-controls">
            <label>Color
              <select data-cart-color="${index}">
                <option value="White"${item.color === 'White' ? ' selected' : ''}>White</option>
                <option value="Black"${item.color === 'Black' ? ' selected' : ''}>Black</option>
              </select>
            </label>
            <label>Quantity
              <select data-cart-quantity="${index}">
                <option value="1"${item.quantity === 1 ? ' selected' : ''}>1</option>
                <option value="2"${item.quantity === 2 ? ' selected' : ''}>2</option>
                <option value="3"${item.quantity === 3 ? ' selected' : ''}>3</option>
                <option value="4"${item.quantity === 4 ? ' selected' : ''}>4</option>
              </select>
            </label>
            <button class="cart-item-remove" type="button" data-cart-remove="${index}" aria-label="Remove ${product.name || item.name} from cart">Remove</button>
          </div>
        </div>
        <div class="cart-item-price">${formatMoney(lineTotal)}</div>
      `;
      els.items.appendChild(card);
    });
  }

  function updateSummary() {
    const items = checkoutItems();
    const qty = totalQuantity(items);
    const subtotal = subtotalAmount();
    const shipping = shippingForQuantity(qty);
    const custom = qty >= 5 || shipping === null;

    els.totalQty.textContent = String(qty);
    els.productSummary.textContent = items.length ? items.map((item) => `${item.quantity}× ${state.products[item.sku]?.name || item.name} (${item.color})`).join(' • ') : 'No items selected';
    els.subtotal.textContent = formatMoney(subtotal);
    els.shipping.textContent = custom ? 'Custom quote required' : formatMoney(shipping);
    els.tax.textContent = custom ? 'Quoted during custom order' : 'Finalized during checkout';
    els.totalLabel.textContent = custom ? 'Direct checkout is available for 1 through 4 total units' : 'Base total before any applicable tax';
    els.total.textContent = custom ? 'Use custom / email order' : formatMoney(subtotal + shipping);
    els.totalLine.classList.remove('is-final');
    els.availability.textContent = `Availability: ${availabilityLabel()}`;
    els.availability.className = `checkout-inventory-status availability-${canFulfillCart() ? 'in-stock' : 'unknown'}`;

    if (els.customLink) els.customLink.classList.toggle('is-hidden', !custom);
    if (els.paypalShell) els.paypalShell.classList.toggle('is-hidden', !items.length || custom || !canFulfillCart());
    if (els.paypalContainer) els.paypalContainer.classList.toggle('is-hidden', !items.length || custom || !canFulfillCart() || !state.buttonsRendered);

    resetColoradoState();
    if (!items.length) setStatus('Your cart is empty. Add an enclosure to begin checkout.');
    else if (custom) setStatus('For 5+ total units, use the custom / email order path so shipping can be quoted correctly.');
    else if (!canFulfillCart()) setStatus('One or more cart items are temporarily unavailable or do not have enough stock.', true);
    else setStatus('PayPal is ready. Website checkout currently supports U.S. shipping addresses only.');
  }

  async function refresh() {
    await loadProducts().catch((error) => {
      console.error(error);
      setStatus(error && error.message ? error.message : 'Could not load cart pricing.', true);
    });
    renderItems();
    updateSummary();
  }

  function writeItems(items) {
    window.WESTTECH_CART.write(items);
  }

  els.items.addEventListener('change', async function (event) {
    const colorIndex = event.target.getAttribute('data-cart-color');
    const quantityIndex = event.target.getAttribute('data-cart-quantity');
    const items = checkoutItems();
    if (colorIndex !== null) items[Number(colorIndex)].color = normalizeColor(event.target.value);
    if (quantityIndex !== null) items[Number(quantityIndex)].quantity = normalizeQuantity(event.target.value);

    if (totalQuantity(items) > 4) {
      setStatus('Website cart checkout supports up to 4 total units. Use the quote page for 5+ units.', true);
    }
    writeItems(items);
    await refresh();
  });

  els.items.addEventListener('click', async function (event) {
    const removeButton = event.target.closest('[data-cart-remove]');
    if (!removeButton || !els.items.contains(removeButton)) return;
    const removeIndex = removeButton.getAttribute('data-cart-remove');
    if (removeIndex === null) return;
    const items = checkoutItems();
    items.splice(Number(removeIndex), 1);
    writeItems(items);
    await refresh();
  });

  if (els.clear) {
    els.clear.addEventListener('click', async function () {
      window.WESTTECH_CART.clear();
      await refresh();
    });
  }

  function normalizeCountryCode(value) {
    return String(value || '').trim().toUpperCase();
  }

  function payPalShippingCountryCode(data) {
    return normalizeCountryCode(
      data?.shippingAddress?.countryCode ||
      data?.shippingAddress?.country_code ||
      data?.shipping_address?.country_code ||
      data?.shipping_address?.countryCode ||
      data?.selected_shipping_option?.country_code ||
      ''
    );
  }

  function isUsShippingAddress(address) {
    return normalizeCountryCode(address?.countryCode || address?.country_code || '') === 'US';
  }

  function rejectNonUsPayPalShipping(data, actions) {
    const countryCode = payPalShippingCountryCode(data);
    if (!countryCode || countryCode === 'US') {
      if (actions && typeof actions.resolve === 'function') return actions.resolve();
      return undefined;
    }
    setStatus(`${US_ONLY_SHIPPING_MESSAGE} Please choose a U.S. shipping address in PayPal.`, true);
    if (actions && typeof actions.reject === 'function') return actions.reject();
    return Promise.reject(new Error(US_ONLY_SHIPPING_MESSAGE));
  }

  function loadPayPalSdk(clientId, currency) {
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-paypal-sdk="cart-checkout"]') || document.querySelector('script[data-paypal-sdk="unloaded-checkout"]');
      if (existing) {
        if (window.paypal && window.paypal.Buttons) return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=buttons&currency=${encodeURIComponent(currency)}&intent=capture&commit=false&disable-funding=card,paylater,credit`;
      script.async = true;
      script.dataset.paypalSdk = 'cart-checkout';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensurePayPalReady() {
    if (state.paypalLoaded) return;
    state.config = state.config || await fetchJson(CONFIG_ENDPOINT, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    await loadPayPalSdk(state.config.clientId, state.config.currency || 'USD');
    if (!window.paypal || !window.paypal.Buttons) throw new Error('PayPal loaded, but the Buttons component was not available.');
    state.paypalLoaded = true;
  }

  function currentAddressBody() {
    return {
      fullName: fields.fullName.value.trim(),
      address1: fields.address1.value.trim(),
      address2: fields.address2.value.trim(),
      city: fields.city.value.trim(),
      state: fields.state.value.trim(),
      postalCode: fields.postalCode.value.trim(),
      countryCode: 'US',
      items: checkoutItems()
    };
  }

  async function captureOrder(orderID) {
    const endpoint = CAPTURE_ORDER_ENDPOINT.replace('{orderID}', encodeURIComponent(orderID));
    const captureData = await fetchJson(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const invoiceId = captureData.invoiceId || state.pendingInvoiceId || '';
    window.WESTTECH_CART.clear();
    if (invoiceId) {
      try { sessionStorage.setItem('westtechInvoiceId', invoiceId); } catch (error) {}
      window.location.href = `${SUCCESS_URL}?order=${encodeURIComponent(invoiceId)}`;
      return;
    }
    window.location.href = SUCCESS_URL;
  }

  function showPayPalBeforeApproval() {
    if (state.pendingOrderId || !canFulfillCart()) return;
    if (els.paypalShell) els.paypalShell.classList.remove('is-hidden');
    if (els.paypalContainer && state.buttonsRendered) els.paypalContainer.classList.remove('is-hidden');
  }

  function hidePayPalForFinalReview() {
    if (els.paypalShell) els.paypalShell.classList.add('is-hidden');
    if (els.paypalContainer) els.paypalContainer.classList.add('is-hidden');
  }

  async function calculateColoradoQuote() {
    try {
      const quote = await fetchJson('/api/tax/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentAddressBody())
      });
      state.pendingQuote = quote;
      els.tax.textContent = formatMoney(quote.taxAmount);
      els.totalLabel.textContent = 'Final total including Colorado tax';
      els.total.textContent = formatMoney(quote.totalAmount);
      els.totalLine.classList.add('is-final');
      els.coloradoSummary.classList.remove('is-hidden');
      els.coloradoSummary.textContent = `Colorado tax: ${formatMoney(quote.taxAmount)} • Final total: ${formatMoney(quote.totalAmount)}`;
      els.coloradoResult.classList.remove('is-hidden');
      els.resultItem.textContent = formatMoney(subtotalAmount());
      els.resultShipping.textContent = formatMoney(shippingForQuantity(totalQuantity()));
      els.resultTax.textContent = formatMoney(quote.taxAmount);
      els.resultTotal.textContent = formatMoney(quote.totalAmount);
      els.changeNote.classList.remove('is-hidden');
      els.verifyWrap.classList.remove('is-hidden');
      els.completeButton.classList.remove('is-hidden');
      els.completeButton.disabled = !state.pendingQuote;
      hidePayPalForFinalReview();
      setStatus('Review the shipping address and final total, then click Complete Order.');
    } catch (error) {
      console.error(error);
      state.pendingQuote = null;
      setStatus(error && error.message ? error.message : 'Could not calculate the Colorado total.', true);
    }
  }

  async function showColoradoFallback(details) {
    hidePayPalForFinalReview();
    els.coloradoCard.classList.remove('is-hidden');
    fields.fullName.value = details.fullName || '';
    fields.address1.value = details.address1 || '';
    fields.address2.value = details.address2 || '';
    fields.city.value = details.city || '';
    fields.state.value = details.state || 'CO';
    fields.postalCode.value = details.postalCode || '';
    updateAddressPreview();
    setStatus('Colorado address detected. Reviewing the address and calculating the final total now.');
    await calculateColoradoQuote();
  }

  async function handleApproval(orderID) {
    const detailsEndpoint = ORDER_DETAILS_ENDPOINT.replace('{orderID}', encodeURIComponent(orderID));
    const details = await fetchJson(detailsEndpoint, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const shippingAddress = details.shippingAddress || {};
    state.pendingOrderId = orderID;
    state.pendingInvoiceId = details.invoiceId || state.pendingInvoiceId || null;
    updateInvoice();

    if (!isUsShippingAddress(shippingAddress)) {
      state.pendingOrderId = null;
      setStatus(`${US_ONLY_SHIPPING_MESSAGE} Please choose a U.S. shipping address and try checkout again.`, true);
      showPayPalBeforeApproval();
      return;
    }

    if ((shippingAddress.state || '').toUpperCase() === 'CO') {
      await showColoradoFallback(shippingAddress);
      return;
    }

    setStatus('U.S. shipping address confirmed. Finalizing payment now.');
    await captureOrder(orderID);
  }

  async function renderButtonsIfNeeded() {
    await ensurePayPalReady();
    if (state.buttonsRendered) {
      showPayPalBeforeApproval();
      return;
    }

    await window.paypal.Buttons({
      fundingSource: window.paypal.FUNDING.PAYPAL,
      style: { shape: 'rect', layout: 'vertical', label: 'paypal', color: 'gold' },
      async createOrder() {
        const items = checkoutItems();
        if (!items.length) throw new Error('Your cart is empty.');
        if (totalQuantity(items) > 4) throw new Error('Use the custom / email order path for 5+ units.');
        setStatus('Opening PayPal. Website checkout currently supports U.S. shipping addresses only.');
        const orderData = await fetchJson(CREATE_ORDER_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items })
        });
        if (!orderData.id) throw new Error('Could not create the PayPal order.');
        state.pendingInvoiceId = orderData.invoiceId || null;
        updateInvoice();
        return orderData.id;
      },
      async onApprove(data) { await handleApproval(data.orderID); },
      onShippingAddressChange(data, actions) { return rejectNonUsPayPalShipping(data, actions); },
      onShippingChange(data, actions) { return rejectNonUsPayPalShipping(data, actions); },
      onCancel() { setStatus('Checkout was cancelled before payment was completed.', true); },
      onError(err) {
        console.error(err);
        setStatus(err && err.message ? err.message : 'PayPal checkout hit an error. Please try again.', true);
      }
    }).render('#cart-paypal-button-container');

    state.buttonsRendered = true;
    showPayPalBeforeApproval();
  }

  if (els.verifyCheckbox) {
    els.verifyCheckbox.addEventListener('change', function () {
      els.completeButton.disabled = !state.pendingQuote;
      if (els.verifyCheckbox.checked) els.verifyWrap.classList.remove('is-attention');
    });
  }

  if (els.completeButton) {
    els.completeButton.addEventListener('click', async function () {
      if (!state.pendingOrderId) return setStatus('Start PayPal first so we can finalize the correct order.', true);
      if (!state.pendingQuote) return setStatus('Colorado tax must be calculated before completing the order.', true);
      if (!els.verifyCheckbox.checked) {
        els.verifyWrap.classList.add('is-attention');
        return setStatus('Please verify the shipping address before completing the order.', true);
      }
      els.completeButton.disabled = true;
      try {
        const prepareEndpoint = PREPARE_COLORADO_ENDPOINT.replace('{orderID}', encodeURIComponent(state.pendingOrderId));
        await fetchJson(prepareEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentAddressBody())
        });
        setStatus('Colorado address confirmed. Finalizing payment now.');
        await captureOrder(state.pendingOrderId);
      } catch (error) {
        console.error(error);
        setStatus(error && error.message ? error.message : 'Could not finalize the Colorado order.', true);
      } finally {
        els.completeButton.disabled = false;
      }
    });
  }

  async function initialize() {
    setStatus('Loading cart pricing…');
    await refresh();
    await renderButtonsIfNeeded();
  }

  initialize().catch(function (error) {
    console.error(error);
    setStatus(error && error.message ? error.message : 'Cart checkout could not be loaded.', true);
  });
})();
