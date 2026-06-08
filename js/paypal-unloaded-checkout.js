(function () {
  const CONFIG_ENDPOINT = "/api/paypal/config";
  const PRODUCT_ENDPOINT = "/api/products/{sku}";
  const CREATE_ORDER_ENDPOINT = "/api/paypal/orders";
  const ORDER_DETAILS_ENDPOINT = "/api/paypal/orders/{orderID}/details";
  const PREPARE_COLORADO_ENDPOINT = "/api/paypal/orders/{orderID}/prepare-colorado";
  const CAPTURE_ORDER_ENDPOINT = "/api/paypal/orders/{orderID}/capture";
  const SUCCESS_URL = "order-thank-you.html";
  const CUSTOM_QUOTE_MIN_QUANTITY = 5;

  const checkoutConfig = window.WESTTECH_CHECKOUT || {};
  let PRODUCT = {
    sku: checkoutConfig.sku || "scout-30-unloaded",
    name: checkoutConfig.name || "Loading product…",
    layout: checkoutConfig.layout || "",
    family: checkoutConfig.family || "",
    unitAmount: 0,
    itemAmount: 0,
    shippingAmount: 0,
    shippingTierSummary: "",
    customQuoteOnly: false,
    customQuoteMinQuantity: CUSTOM_QUOTE_MIN_QUANTITY,
    availability: null
  };

  const status = document.getElementById("paypal-status");
  const container = document.getElementById("paypal-button-container");
  const paypalShell = document.querySelector(".checkout-paypal-shell");
  const itemAmountEl = document.getElementById("checkout-item-amount");
  const shippingAmountEl = document.getElementById("checkout-shipping-amount");
  const taxAmountEl = document.getElementById("checkout-tax-amount");
  const totalAmountEl = document.getElementById("checkout-total-amount");
  const totalLabelEl = document.getElementById("checkout-total-label");
  const totalLineEl = document.getElementById("checkout-total-line");
  const unitAmountEl = document.getElementById("checkout-unit-amount");
  const quantityDisplayEl = document.getElementById("checkout-quantity-display");
  const colorDisplayEl = document.getElementById("checkout-color-display");
  const colorSelect = document.getElementById("checkout-color");
  const quantitySelect = document.getElementById("checkout-quantity");
  const shippingTierNoteEl = document.getElementById("checkout-shipping-tier-note");
  const customCard = document.getElementById("checkout-custom-order-card");
  const customEmailLink = document.getElementById("checkout-custom-email-link");
  const customOrderLink = document.getElementById("checkout-custom-order-link");
  const coloradoCard = document.getElementById("checkout-colorado-card");
  const coloradoForm = document.getElementById("checkout-colorado-form");
  const coloradoSummary = document.getElementById("checkout-colorado-summary");
  const coloradoResult = document.getElementById("checkout-colorado-result");
  const coloradoVerifyWrap = document.getElementById("co-verify-wrap");
  const coloradoChangeNote = document.getElementById("co-change-note");
  const coloradoVerifyCheckbox = document.getElementById("co-verify-checkbox");
  const resultItemNameEl = document.getElementById("co-result-item-name");
  const resultItemEl = document.getElementById("co-result-item");
  const resultShippingEl = document.getElementById("co-result-shipping");
  const resultTaxEl = document.getElementById("co-result-tax");
  const resultTotalEl = document.getElementById("co-result-total");
  const coloradoCompleteBtn = document.getElementById("co-complete-button");
  const invoiceIdEl = document.getElementById("co-invoice-id");
  const checkoutProductImage = document.querySelector("[data-checkout-product-image]");
  const inventoryStatusEl = document.getElementById("checkout-inventory-status");

  if (!status || !container || !itemAmountEl || !shippingAmountEl || !taxAmountEl || !totalAmountEl || !totalLabelEl || !totalLineEl || !coloradoCard || !coloradoForm || !coloradoSummary || !coloradoResult || !coloradoVerifyWrap || !coloradoChangeNote || !coloradoVerifyCheckbox || !resultItemEl || !resultShippingEl || !resultTaxEl || !resultTotalEl || !coloradoCompleteBtn || !quantitySelect || !customCard) return;

  let coloradoCompleteNote = document.getElementById("co-complete-note");
  if (!coloradoCompleteNote) {
    coloradoCompleteNote = document.createElement("p");
    coloradoCompleteNote.id = "co-complete-note";
    coloradoCompleteNote.className = "checkout-complete-note is-hidden";
    coloradoCompleteBtn.parentNode.insertBefore(coloradoCompleteNote, coloradoCompleteBtn);
  }

  const fields = {
    fullName: document.getElementById("co-full-name"),
    address1: document.getElementById("co-address1"),
    address2: document.getElementById("co-address2"),
    city: document.getElementById("co-city"),
    state: document.getElementById("co-state"),
    postalCode: document.getElementById("co-postal")
  };

  const state = {
    config: null,
    paypalLoaded: false,
    buttonsRendered: false,
    pendingOrderId: null,
    pendingOrderDetails: null,
    pendingQuote: null,
    pendingInvoiceId: null,
    quantity: 1,
    color: "White"
  };

  function formatMoney(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  }

  function currentQuantity() {
    const raw = quantitySelect ? quantitySelect.value : String(state.quantity || 1);
    if (raw === "5+") return 5;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  function currentColor() {
    const raw = colorSelect ? colorSelect.value : String(state.color || "White");
    return raw === "Black" ? "Black" : "White";
  }

  function isCustomQuantity(quantity) {
    return Number(quantity || 0) >= Number(PRODUCT.customQuoteMinQuantity || CUSTOM_QUOTE_MIN_QUANTITY);
  }

  function shippingForQuantity(quantity) {
    if (quantity === 1) return 8.95;
    if (quantity === 2) return 10.95;
    if (quantity === 3 || quantity === 4) return 14.95;
    return null;
  }

  function itemSubtotal(quantity) {
    return Number(PRODUCT.unitAmount || 0) * Number(quantity || 1);
  }

  function orderDisplayName(quantity) {
    return quantity > 1 ? `${PRODUCT.name} × ${quantity}` : PRODUCT.name;
  }

  function updateInvoiceIdDisplay() {
    if (!invoiceIdEl) return;
    invoiceIdEl.textContent = state.pendingInvoiceId || "Pending…";
  }

  function resetPendingOrderState() {
    state.pendingOrderId = null;
    state.pendingOrderDetails = null;
    state.pendingQuote = null;
    state.pendingInvoiceId = null;
    updateInvoiceIdDisplay();
  }

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  }


  function hidePayPalForFinalReview() {
    if (paypalShell) paypalShell.classList.add("is-hidden");
    if (container) container.classList.add("is-hidden");
  }

  function showPayPalBeforeApproval() {
    if (state.pendingOrderId || !canFulfillCurrentQuantity()) return;
    if (paypalShell) paypalShell.classList.remove("is-hidden");
    if (container && state.buttonsRendered) container.classList.remove("is-hidden");
  }

  function fetchJson(url, options) {
    return fetch(url, options).then(async function (response) {
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Request failed.");
      return data;
    });
  }

  function updateCheckoutProductImage() {
    if (!checkoutProductImage || !checkoutConfig.images) return;
    const color = currentColor();
    const imageConfig = checkoutConfig.images[color];
    if (!imageConfig) return;

    if (typeof imageConfig === "string") {
      checkoutProductImage.src = imageConfig;
      checkoutProductImage.alt = `${PRODUCT.name} shown in ${color}`;
      return;
    }

    if (imageConfig.src) checkoutProductImage.src = imageConfig.src;
    checkoutProductImage.alt = imageConfig.alt || `${PRODUCT.name} shown in ${color}`;
  }

  function applyProductToPage() {
    const itemNameEls = document.querySelectorAll("[data-checkout-product-name]");
    itemNameEls.forEach((el) => { el.textContent = orderDisplayName(currentQuantity()); });
    if (resultItemNameEl) resultItemNameEl.textContent = orderDisplayName(currentQuantity());
    if (shippingTierNoteEl) shippingTierNoteEl.textContent = PRODUCT.shippingTierSummary || "Shipping tiers apply by quantity.";
    if (unitAmountEl) unitAmountEl.textContent = formatMoney(PRODUCT.unitAmount || PRODUCT.itemAmount);
  }

  async function loadProductConfig() {
    const endpoint = PRODUCT_ENDPOINT.replace("{sku}", encodeURIComponent(PRODUCT.sku));
    const data = await fetchJson(`${endpoint}?quantity=${encodeURIComponent(String(currentQuantity()))}`, { method: "GET", headers: { "Content-Type": "application/json" } });
    if (!data.product) throw new Error("Could not load product pricing.");
    PRODUCT = {
      sku: data.product.sku,
      name: data.product.name,
      layout: data.product.layout,
      family: data.product.family,
      unitAmount: Number(data.product.unitAmount || data.product.itemAmount || 0),
      itemAmount: Number(data.product.itemAmount || 0),
      shippingAmount: Number(data.product.shippingAmount || 0),
      shippingTierSummary: data.product.shippingTierSummary || "",
      customQuoteOnly: Boolean(data.product.customQuoteOnly),
      customQuoteMinQuantity: Number(data.product.customQuoteMinQuantity || CUSTOM_QUOTE_MIN_QUANTITY),
      availability: data.product.availability || null
    };
    applyProductToPage();
  }

  function resetColoradoState() {
    coloradoCard.classList.add("is-hidden");
    coloradoSummary.classList.add("is-hidden");
    coloradoResult.classList.add("is-hidden");
    coloradoChangeNote.classList.add("is-hidden");
    coloradoVerifyWrap.classList.add("is-hidden");
    coloradoVerifyWrap.classList.remove("is-attention");
    coloradoVerifyCheckbox.checked = false;
    coloradoCompleteBtn.classList.add("is-hidden");
    coloradoCompleteBtn.disabled = true;
    coloradoCompleteNote.classList.add("is-hidden");
    coloradoCompleteNote.textContent = "";
  }


  function availabilityLabel() {
    const availability = PRODUCT.availability || {};
    return availability.label || "Availability pending";
  }

  function canFulfillCurrentQuantity() {
    const availability = PRODUCT.availability || {};
    if (!availability.enforced) return true;
    return availability.canFulfill !== false && availability.status !== "temporarily-unavailable";
  }

  function updateInventoryStatus() {
    const availability = PRODUCT.availability || {};
    if (!inventoryStatusEl) return;
    inventoryStatusEl.textContent = `Availability: ${availabilityLabel()}`;
    inventoryStatusEl.className = `checkout-inventory-status availability-${availability.status || "unknown"}`;
  }

  function updateSummaryFromQuantity() {
    const quantity = currentQuantity();
    state.quantity = quantity;
    const custom = isCustomQuantity(quantity);
    const itemTotal = itemSubtotal(quantity);
    const shipping = shippingForQuantity(quantity);

    applyProductToPage();
    if (quantityDisplayEl) quantityDisplayEl.textContent = custom ? "5+" : String(quantity);
    state.color = currentColor();
    if (colorDisplayEl) colorDisplayEl.textContent = state.color;
    updateCheckoutProductImage();
    itemAmountEl.textContent = formatMoney(itemTotal);
    updateInventoryStatus();

    if (custom) {
      shippingAmountEl.textContent = "Custom quote required";
      taxAmountEl.textContent = "Quoted during custom order";
      totalLabelEl.textContent = "Direct checkout is available for quantities 1 through 4";
      totalAmountEl.textContent = "Use custom / email order";
      totalLineEl.classList.remove("is-final");
      if (paypalShell) paypalShell.classList.add("is-hidden");
      customCard.classList.remove("is-hidden");
      resetColoradoState();
      setStatus("For 5+ units, use the custom / email order path so we can quote shipping correctly.");
      if (customEmailLink) {
        const subject = encodeURIComponent(`${PRODUCT.name} - ${quantity}+ unit custom order`);
        const body = encodeURIComponent(`Hi WestTech Home Automation,

I would like to order ${quantity}+ units of ${PRODUCT.name}.\nPreferred color: ${currentColor()}\nPlease send me a shipping quote and next steps.
`);
        customEmailLink.href = `mailto:orders@westtechha.com?subject=${subject}&body=${body}`;
      }
      return;
    }

    if (!canFulfillCurrentQuantity()) {
      shippingAmountEl.textContent = "Unavailable";
      taxAmountEl.textContent = "Unavailable";
      totalLabelEl.textContent = "This option is not available for direct checkout right now";
      totalAmountEl.textContent = availabilityLabel();
      totalLineEl.classList.remove("is-final");
      if (paypalShell) paypalShell.classList.add("is-hidden");
      customCard.classList.add("is-hidden");
      resetColoradoState();
      setStatus("This product is temporarily unavailable or there is not enough stock for the selected quantity.", true);
      return;
    }

    shippingAmountEl.textContent = formatMoney(shipping);
    taxAmountEl.textContent = "Finalized during checkout";
    totalLabelEl.textContent = "Base total before any applicable tax";
    totalAmountEl.textContent = formatMoney(itemTotal + shipping);
    totalLineEl.classList.remove("is-final");
    customCard.classList.add("is-hidden");
    resetColoradoState();
    showPayPalBeforeApproval();
    setStatus("Quantity-based shipping is calculated before checkout.");
  }

  function loadPayPalSdk(clientId, currency) {
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-paypal-sdk="unloaded-checkout"]');
      if (existing) {
        if (window.paypal && window.paypal.Buttons) return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=buttons&currency=${encodeURIComponent(currency)}&intent=capture&commit=false&disable-funding=card,paylater,credit`;
      script.async = true;
      script.dataset.paypalSdk = "unloaded-checkout";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function ensurePayPalReady() {
    if (state.paypalLoaded) return;
    state.config = state.config || await fetchJson(CONFIG_ENDPOINT, { method: "GET", headers: { "Content-Type": "application/json" } });
    await loadPayPalSdk(state.config.clientId, state.config.currency || "USD");
    if (!window.paypal || !window.paypal.Buttons) throw new Error("PayPal loaded, but the Buttons component was not available.");
    state.paypalLoaded = true;
  }

  async function captureOrder(orderID) {
    const endpoint = CAPTURE_ORDER_ENDPOINT.replace("{orderID}", encodeURIComponent(orderID));
    const captureData = await fetchJson(endpoint, { method: "POST", headers: { "Content-Type": "application/json" } });
    const invoiceId = captureData.invoiceId || state.pendingInvoiceId || "";
    if (invoiceId) {
      try { sessionStorage.setItem("westtechInvoiceId", invoiceId); } catch (error) {}
      window.location.href = `${SUCCESS_URL}?order=${encodeURIComponent(invoiceId)}`;
      return;
    }
    window.location.href = SUCCESS_URL;
  }

  async function showColoradoFallback(details) {
    hidePayPalForFinalReview();
    coloradoCard.classList.remove("is-hidden");
    state.pendingQuote = null;
    fields.fullName.value = details.fullName || "";
    fields.address1.value = details.address1 || "";
    fields.address2.value = details.address2 || "";
    fields.city.value = details.city || "";
    fields.state.value = details.state || "CO";
    fields.postalCode.value = details.postalCode || "";
    setStatus("Colorado address detected. Reviewing the address and calculating the final total now.");
    await calculateColoradoQuote();
  }

  function updateSummaryFromQuote(quote) {
    taxAmountEl.textContent = formatMoney(quote.taxAmount);
    totalLabelEl.textContent = "Final total including Colorado tax";
    totalAmountEl.textContent = formatMoney(quote.totalAmount);
    totalLineEl.classList.add("is-final");
    coloradoSummary.classList.remove("is-hidden");
    coloradoSummary.textContent = `Colorado tax: ${formatMoney(quote.taxAmount)} • Final total: ${formatMoney(quote.totalAmount)}`;
    coloradoResult.classList.remove("is-hidden");
    resultItemEl.textContent = formatMoney(itemSubtotal(currentQuantity()));
    resultShippingEl.textContent = formatMoney(shippingForQuantity(currentQuantity()));
    resultTaxEl.textContent = formatMoney(quote.taxAmount);
    resultTotalEl.textContent = formatMoney(quote.totalAmount);
    if (resultItemNameEl) resultItemNameEl.textContent = orderDisplayName(currentQuantity());
    updateInvoiceIdDisplay();
  }

  function currentColoradoAddress() {
    return {
      fullName: fields.fullName.value.trim(),
      address1: fields.address1.value.trim(),
      address2: fields.address2.value.trim(),
      city: fields.city.value.trim(),
      state: fields.state.value.trim(),
      postalCode: fields.postalCode.value.trim(),
      countryCode: "US",
      sku: PRODUCT.sku,
      quantity: String(currentQuantity()),
      color: currentColor()
    };
  }

  async function handleApproval(orderID) {
    const detailsEndpoint = ORDER_DETAILS_ENDPOINT.replace("{orderID}", encodeURIComponent(orderID));
    const details = await fetchJson(detailsEndpoint, { method: "GET", headers: { "Content-Type": "application/json" } });
    const shippingAddress = details.shippingAddress || {};
    state.pendingOrderId = orderID;
    state.pendingOrderDetails = shippingAddress;
    state.pendingInvoiceId = details.invoiceId || state.pendingInvoiceId || null;
    updateInvoiceIdDisplay();

    if ((shippingAddress.state || "").toUpperCase() === "CO") {
      await showColoradoFallback(shippingAddress);
      return;
    }
    setStatus("Shipping address confirmed. Finalizing payment now.");
    await captureOrder(orderID);
  }

  function paypalButtonStyle() {
    return { shape: "rect", layout: "vertical", label: "paypal", color: "gold" };
  }

  function clearVerifyPrompt() {
    coloradoVerifyWrap.classList.remove("is-attention");
    coloradoCompleteNote.classList.remove("is-warning");
    if (state.pendingQuote) {
      coloradoCompleteNote.textContent = "Colorado tax is calculated. Verify the shipping address above, then click Complete Order.";
    }
  }

  function showVerifyPrompt() {
    coloradoVerifyWrap.classList.add("is-attention");
    coloradoCompleteNote.textContent = "Please check the box above to verify this shipping address before completing the order.";
    coloradoCompleteNote.classList.add("is-warning");
    coloradoCompleteNote.classList.remove("is-hidden");
    try { coloradoVerifyWrap.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (error) {}
    coloradoVerifyCheckbox.focus({ preventScroll: true });
  }

  async function calculateColoradoQuote() {
    try {
      const quote = await fetchJson("/api/tax/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentColoradoAddress())
      });
      state.pendingQuote = quote;
      updateSummaryFromQuote(quote);
      coloradoChangeNote.classList.remove("is-hidden");
      coloradoVerifyWrap.classList.remove("is-hidden");
      coloradoCompleteBtn.classList.remove("is-hidden");
      coloradoCompleteBtn.disabled = !state.pendingQuote;
      hidePayPalForFinalReview();
      coloradoCompleteNote.textContent = "Colorado tax is calculated. Verify the shipping address above, then click Complete Order.";
      coloradoCompleteNote.classList.remove("is-warning");
      coloradoCompleteNote.classList.remove("is-hidden");
      setStatus("Review the shipping address and final total, then click Complete Order.");
    } catch (error) {
      console.error(error);
      coloradoChangeNote.classList.add("is-hidden");
      coloradoVerifyWrap.classList.add("is-hidden");
      coloradoCompleteBtn.classList.add("is-hidden");
      coloradoCompleteNote.classList.add("is-hidden");
      coloradoCompleteNote.textContent = "";
      state.pendingQuote = null;
      setStatus(error && error.message ? error.message : "Could not calculate the Colorado total.", true);
    }
  }

  async function renderButtonsIfNeeded() {
    await ensurePayPalReady();
    if (state.buttonsRendered) {
      showPayPalBeforeApproval();
      return;
    }
    await window.paypal.Buttons({
      fundingSource: window.paypal.FUNDING.PAYPAL,
      style: paypalButtonStyle(),
      async createOrder() {
        const quantity = currentQuantity();
        if (isCustomQuantity(quantity)) throw new Error("Use the custom / email order path for 5+ units.");
        setStatus("Opening PayPal. Choose the shipping address there first. Colorado orders may return here for one final address confirmation step before payment is captured.");
        const orderData = await fetchJson(CREATE_ORDER_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sku: PRODUCT.sku, quantity, color: currentColor() })
        });
        if (!orderData.id) throw new Error("Could not create the PayPal order.");
        state.pendingInvoiceId = orderData.invoiceId || null;
        updateInvoiceIdDisplay();
        return orderData.id;
      },
      async onApprove(data) { await handleApproval(data.orderID); },
      onCancel() { setStatus("Checkout was cancelled before payment was completed.", true); },
      onError(err) {
        console.error(err);
        setStatus(err && err.message ? err.message : "PayPal checkout hit an error. Please try again.", true);
      }
    }).render("#paypal-button-container");
    state.buttonsRendered = true;
    showPayPalBeforeApproval();
    setStatus("Quantity-based shipping is calculated before checkout.");
  }

  quantitySelect.addEventListener("change", async function () {
    resetPendingOrderState();
    try {
      await loadProductConfig();
      updateSummaryFromQuantity();
    } catch (error) {
      console.error(error);
      setStatus(error && error.message ? error.message : "Could not update product availability.", true);
    }
  });

  if (colorSelect) {
    colorSelect.addEventListener("change", function () {
      resetPendingOrderState();
      updateSummaryFromQuantity();
    });
  }

  coloradoVerifyCheckbox.addEventListener("change", function () {
    coloradoCompleteBtn.disabled = !state.pendingQuote;
    if (coloradoVerifyCheckbox.checked) clearVerifyPrompt();
  });

  coloradoCompleteBtn.addEventListener("click", async function () {
    if (!state.pendingOrderId) return setStatus("Start PayPal first so we can finalize the correct order.", true);
    if (!state.pendingQuote) return setStatus("Colorado tax must be calculated before completing the order.", true);
    if (!coloradoVerifyCheckbox.checked) {
      showVerifyPrompt();
      return setStatus("Please verify the shipping address before completing the order.", true);
    }
    coloradoCompleteBtn.disabled = true;
    try {
      const prepareEndpoint = PREPARE_COLORADO_ENDPOINT.replace("{orderID}", encodeURIComponent(state.pendingOrderId));
      await fetchJson(prepareEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentColoradoAddress())
      });
      setStatus("Colorado address confirmed. Finalizing payment now.");
      await captureOrder(state.pendingOrderId);
    } catch (error) {
      console.error(error);
      setStatus(error && error.message ? error.message : "Could not finalize the Colorado order.", true);
    } finally {
      coloradoCompleteBtn.disabled = false;
    }
  });

  async function initializeCheckout() {
    setStatus("Loading product pricing…");
    await loadProductConfig();
    updateSummaryFromQuantity();
    await renderButtonsIfNeeded();
  }

  initializeCheckout().catch(function (error) {
    console.error(error);
    setStatus(error && error.message ? error.message : "Checkout could not be loaded.", true);
  });
})();
