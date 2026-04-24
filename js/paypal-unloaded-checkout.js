(function () {
  const CONFIG_ENDPOINT = "/api/paypal/config";
  const PRODUCT_ENDPOINT = "/api/products/{sku}";
  const CREATE_ORDER_ENDPOINT = "/api/paypal/orders";
  const ORDER_DETAILS_ENDPOINT = "/api/paypal/orders/{orderID}/details";
  const PREPARE_COLORADO_ENDPOINT = "/api/paypal/orders/{orderID}/prepare-colorado";
  const CAPTURE_ORDER_ENDPOINT = "/api/paypal/orders/{orderID}/capture";
  const SUCCESS_URL = "order-thank-you.html";

  const checkoutConfig = window.WESTTECH_CHECKOUT || {};
  let PRODUCT = {
    sku: checkoutConfig.sku || "scout-30-unloaded",
    name: checkoutConfig.name || "Loading product…",
    layout: checkoutConfig.layout || "",
    family: checkoutConfig.family || "",
    itemAmount: 0,
    shippingAmount: 0
  };

  const status = document.getElementById("paypal-status");
  const container = document.getElementById("paypal-button-container");
  const itemAmountEl = document.getElementById("checkout-item-amount");
  const shippingAmountEl = document.getElementById("checkout-shipping-amount");
  const taxAmountEl = document.getElementById("checkout-tax-amount");
  const totalAmountEl = document.getElementById("checkout-total-amount");
  const totalLabelEl = document.getElementById("checkout-total-label");
  const totalLineEl = document.getElementById("checkout-total-line");
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

  if (!status || !container || !itemAmountEl || !shippingAmountEl || !taxAmountEl || !totalAmountEl || !totalLabelEl || !totalLineEl || !coloradoCard || !coloradoForm || !coloradoSummary || !coloradoResult || !coloradoVerifyWrap || !coloradoChangeNote || !coloradoVerifyCheckbox || !resultItemEl || !resultShippingEl || !resultTaxEl || !resultTotalEl || !coloradoCompleteBtn) return;

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
    pendingQuote: null
  };

  function formatMoney(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
  }

  function baseTotal() {
    return PRODUCT.itemAmount + PRODUCT.shippingAmount;
  }

  function resetBaseSummary() {
    taxAmountEl.textContent = "Finalized during checkout";
    totalLabelEl.textContent = "Base total before any applicable tax";
    totalAmountEl.textContent = formatMoney(baseTotal());
    totalLineEl.classList.remove("is-final");
    coloradoSummary.classList.add("is-hidden");
    coloradoResult.classList.add("is-hidden");
    coloradoChangeNote.classList.add("is-hidden");
    coloradoVerifyWrap.classList.add("is-hidden");
    coloradoVerifyCheckbox.checked = false;
    coloradoCompleteBtn.classList.add("is-hidden");
    coloradoCompleteBtn.disabled = true;
    resultItemEl.textContent = formatMoney(PRODUCT.itemAmount);
    resultShippingEl.textContent = formatMoney(PRODUCT.shippingAmount);
    resultTaxEl.textContent = formatMoney(0);
    resultTotalEl.textContent = formatMoney(baseTotal());
    if (resultItemNameEl) resultItemNameEl.textContent = PRODUCT.name;
  }

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  }

  function fetchJson(url, options) {
    return fetch(url, options).then(async function (response) {
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Request failed.");
      return data;
    });
  }

  function normalizeProduct(product) {
    return {
      sku: product.sku || PRODUCT.sku,
      name: product.name || PRODUCT.name,
      layout: product.layout || PRODUCT.layout,
      family: product.family || PRODUCT.family,
      itemAmount: Number(product.itemAmount || 0),
      shippingAmount: Number(product.shippingAmount || 0)
    };
  }

  function applyProductToPage() {
    itemAmountEl.textContent = formatMoney(PRODUCT.itemAmount);
    shippingAmountEl.textContent = formatMoney(PRODUCT.shippingAmount);
    const itemNameEls = document.querySelectorAll("[data-checkout-product-name]");
    itemNameEls.forEach((el) => { el.textContent = PRODUCT.name; });
    if (resultItemNameEl) resultItemNameEl.textContent = PRODUCT.name;
  }

  async function loadProductConfig() {
    const endpoint = PRODUCT_ENDPOINT.replace("{sku}", encodeURIComponent(PRODUCT.sku));
    const data = await fetchJson(endpoint, { method: "GET", headers: { "Content-Type": "application/json" } });
    if (!data.product) throw new Error("Could not load product pricing.");
    PRODUCT = normalizeProduct(data.product);
    applyProductToPage();
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

  async function showColoradoFallback(details) {
    coloradoCard.classList.remove("is-hidden");
    resetBaseSummary();
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
    resultItemEl.textContent = formatMoney(PRODUCT.itemAmount);
    resultShippingEl.textContent = formatMoney(PRODUCT.shippingAmount);
    resultTaxEl.textContent = formatMoney(quote.taxAmount);
    resultTotalEl.textContent = formatMoney(quote.totalAmount);
    if (resultItemNameEl) resultItemNameEl.textContent = PRODUCT.name;
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
      sku: PRODUCT.sku
    };
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
    await fetchJson(endpoint, { method: "POST", headers: { "Content-Type": "application/json" } });
    window.location.href = SUCCESS_URL;
  }

  async function handleApproval(orderID) {
    const detailsEndpoint = ORDER_DETAILS_ENDPOINT.replace("{orderID}", encodeURIComponent(orderID));
    const details = await fetchJson(detailsEndpoint, { method: "GET", headers: { "Content-Type": "application/json" } });
    const shippingAddress = details.shippingAddress || {};
    state.pendingOrderId = orderID;
    state.pendingOrderDetails = shippingAddress;

    if ((shippingAddress.state || "").toUpperCase() === "CO") {
      await showColoradoFallback(shippingAddress);
      return;
    }
    setStatus("Shipping address confirmed. Finalizing payment now.");
    await captureOrder(orderID);
  }

  function isDarkCheckoutTheme() {
    const explicitTheme = document.documentElement.getAttribute("data-theme");
    if (explicitTheme) return explicitTheme === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function paypalButtonStyle() {
    return {
      shape: "rect",
      layout: "vertical",
      label: "paypal",
      color: isDarkCheckoutTheme() ? "silver" : "gold"
    };
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
      coloradoCompleteBtn.disabled = !coloradoVerifyCheckbox.checked;
      setStatus("Colorado tax calculated. Verify the shipping address, then complete the order.");
    } catch (error) {
      console.error(error);
      coloradoChangeNote.classList.add("is-hidden");
      coloradoVerifyWrap.classList.add("is-hidden");
      coloradoCompleteBtn.classList.add("is-hidden");
      state.pendingQuote = null;
      setStatus(error && error.message ? error.message : "Could not calculate the Colorado total.", true);
    }
  }

  async function renderButtonsIfNeeded() {
    await ensurePayPalReady();
    if (state.buttonsRendered) {
      container.classList.remove("is-hidden");
      return;
    }
    await window.paypal.Buttons({
      fundingSource: window.paypal.FUNDING.PAYPAL,
      style: paypalButtonStyle(),
      async createOrder() {
        setStatus("Opening PayPal. Choose the shipping address there first. Colorado orders may return here for one final address confirmation step before payment is captured.");
        const orderData = await fetchJson(CREATE_ORDER_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sku: PRODUCT.sku, quantity: 1 })
        });
        if (!orderData.id) throw new Error("Could not create the PayPal order.");
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
    container.classList.remove("is-hidden");
    setStatus("PayPal is ready. PayPal opens first, and Colorado orders may return here for one final address confirmation step.");
  }

  coloradoVerifyCheckbox.addEventListener("change", function () {
    coloradoCompleteBtn.disabled = !coloradoVerifyCheckbox.checked || !state.pendingQuote;
  });

  coloradoCompleteBtn.addEventListener("click", async function () {
    if (!state.pendingOrderId) return setStatus("Start PayPal first so we can finalize the correct order.", true);
    if (!state.pendingQuote) return setStatus("Colorado tax must be calculated before completing the order.", true);
    if (!coloradoVerifyCheckbox.checked) return setStatus("Verify the shipping address before completing the order.", true);
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
    resetBaseSummary();
    await renderButtonsIfNeeded();
  }

  initializeCheckout().catch(function (error) {
    console.error(error);
    setStatus(error && error.message ? error.message : "Checkout could not be loaded.", true);
  });
})();
