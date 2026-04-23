(function () {
  const CONFIG_ENDPOINT = "/api/paypal/config";
  const TAX_QUOTE_ENDPOINT = "/api/tax/quote";
  const CREATE_ORDER_ENDPOINT = "/api/paypal/orders";
  const CAPTURE_ORDER_ENDPOINT = "/api/paypal/orders/{orderID}/capture";
  const SUCCESS_URL = "order-thank-you.html";

  const PRICE = 35.00;
  const SHIPPING = 8.95;

  const form = document.getElementById("checkout-address-form");
  const status = document.getElementById("paypal-status");
  const container = document.getElementById("paypal-button-container");
  const itemAmountEl = document.getElementById("checkout-item-amount");
  const shippingAmountEl = document.getElementById("checkout-shipping-amount");
  const taxAmountEl = document.getElementById("checkout-tax-amount");
  const totalAmountEl = document.getElementById("checkout-total-amount");

  if (!form || !status || !container || !itemAmountEl || !shippingAmountEl || !taxAmountEl || !totalAmountEl) return;

  const state = {
    config: null,
    quote: null,
    paypalLoaded: false,
    buttonsRendered: false
  };

  function formatMoney(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(Number(value || 0));
  }

  function setStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(data.message || "Request failed.");
    }

    return data;
  }

  function loadPayPalSdk(clientId, currency) {
    return new Promise(function (resolve, reject) {
      const existing = document.querySelector('script[data-paypal-sdk="scout-ready"]');
      if (existing) {
        if (window.paypal && window.paypal.Buttons) {
          resolve();
          return;
        }
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=buttons&currency=${encodeURIComponent(currency)}&intent=capture`;
      script.async = true;
      script.dataset.paypalSdk = "scout-ready";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function readAddressFromForm() {
    const formData = new FormData(form);
    return {
      fullName: (formData.get("fullName") || "").toString().trim(),
      address1: (formData.get("address1") || "").toString().trim(),
      address2: (formData.get("address2") || "").toString().trim(),
      city: (formData.get("city") || "").toString().trim(),
      state: (formData.get("state") || "").toString().trim(),
      postalCode: (formData.get("postalCode") || "").toString().trim(),
      countryCode: "US"
    };
  }

  function updateSummary(quote) {
    itemAmountEl.textContent = formatMoney(PRICE);
    shippingAmountEl.textContent = formatMoney(SHIPPING);

    if (!quote) {
      taxAmountEl.textContent = "Enter shipping address";
      totalAmountEl.textContent = formatMoney(PRICE + SHIPPING);
      return;
    }

    if (quote.isColorado) {
      taxAmountEl.textContent = `${formatMoney(quote.taxAmount)} (${(Number(quote.taxRate || 0) * 100).toFixed(2)}%)`;
    } else {
      taxAmountEl.textContent = formatMoney(0);
    }

    totalAmountEl.textContent = formatMoney(quote.totalAmount);
  }

  function invalidateQuote(message) {
    state.quote = null;
    container.classList.add("is-hidden");
    updateSummary(null);
    if (message) {
      setStatus(message, false);
    }
  }

  async function ensurePayPalReady() {
    if (state.paypalLoaded) return;

    state.config = state.config || await fetchJson(CONFIG_ENDPOINT, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    await loadPayPalSdk(state.config.clientId, state.config.currency || "USD");

    if (!window.paypal || !window.paypal.Buttons) {
      throw new Error("PayPal loaded, but the Buttons component was not available.");
    }

    state.paypalLoaded = true;
  }

  async function renderButtonsIfNeeded() {
    await ensurePayPalReady();

    if (state.buttonsRendered) {
      container.classList.remove("is-hidden");
      return;
    }

    await window.paypal.Buttons({
      style: {
        shape: "rect",
        layout: "vertical",
        label: "paypal"
      },
      async createOrder() {
        if (!state.quote || !state.quote.address) {
          throw new Error("Please calculate the total with your shipping address before continuing to PayPal.");
        }

        const orderData = await fetchJson(CREATE_ORDER_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sku: "scout-30-unloaded",
            quantity: 1,
            shippingAddress: state.quote.address
          })
        });

        if (!orderData.id) {
          throw new Error("Could not create the PayPal order.");
        }

        return orderData.id;
      },
      async onApprove(data) {
        const endpoint = CAPTURE_ORDER_ENDPOINT.replace("{orderID}", encodeURIComponent(data.orderID));
        await fetchJson(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          }
        });

        window.location.href = SUCCESS_URL;
      },
      onCancel() {
        setStatus("Checkout was cancelled before payment was completed.", true);
      },
      onError(err) {
        console.error(err);
        setStatus(err && err.message ? err.message : "PayPal checkout hit an error. Please verify the shipping address step and try again.", true);
      }
    }).render("#paypal-button-container");

    state.buttonsRendered = true;
    container.classList.remove("is-hidden");
  }

  async function handleQuote(event) {
    event.preventDefault();

    try {
      setStatus("Checking shipping address and calculating your total...");
      container.classList.add("is-hidden");

      const quote = await fetchJson(TAX_QUOTE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(readAddressFromForm())
      });

      state.quote = quote;
      updateSummary(quote);
      await renderButtonsIfNeeded();

      if (quote.isColorado) {
        setStatus("Colorado tax has been added. Your PayPal checkout is ready.");
      } else {
        setStatus("Your total is ready. No sales tax was added for this shipping address.");
      }
    } catch (error) {
      console.error(error);
      invalidateQuote();
      setStatus(error.message || "We could not calculate the total for this shipping address.", true);
    }
  }

  form.addEventListener("submit", handleQuote);

  Array.prototype.forEach.call(form.querySelectorAll("input, select"), function (field) {
    field.addEventListener("input", function () {
      invalidateQuote("Shipping details changed. Recalculate the total before continuing to PayPal.");
    });
    field.addEventListener("change", function () {
      invalidateQuote("Shipping details changed. Recalculate the total before continuing to PayPal.");
    });
  });

  updateSummary(null);
  setStatus("Enter the shipping address and calculate the total before PayPal checkout is enabled.");
})();
