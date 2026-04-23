(function () {
  const CONFIG_ENDPOINT = "/api/paypal/config";
  const CREATE_ORDER_ENDPOINT = "/api/paypal/orders";
  const CAPTURE_ORDER_ENDPOINT = "/api/paypal/orders/{orderID}/capture";
  const SUCCESS_URL = "order-thank-you.html";

  const PRICE = 35.00;
  const SHIPPING = 8.95;

  const status = document.getElementById("paypal-status");
  const container = document.getElementById("paypal-button-container");
  const itemAmountEl = document.getElementById("checkout-item-amount");
  const shippingAmountEl = document.getElementById("checkout-shipping-amount");
  const taxAmountEl = document.getElementById("checkout-tax-amount");
  const totalAmountEl = document.getElementById("checkout-total-amount");

  if (!status || !container || !itemAmountEl || !shippingAmountEl || !taxAmountEl || !totalAmountEl) return;

  const state = {
    config: null,
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
        setStatus("Opening PayPal. Confirm the shipping address there so the final total can be calculated before payment.");

        const orderData = await fetchJson(CREATE_ORDER_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            sku: "scout-30-unloaded",
            quantity: 1
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
        setStatus(err && err.message ? err.message : "PayPal checkout hit an error. Please try again.", true);
      }
    }).render("#paypal-button-container");

    state.buttonsRendered = true;
    container.classList.remove("is-hidden");
    setStatus("PayPal is ready. The buyer should confirm the shipping address inside PayPal before completing payment.");
  }

  itemAmountEl.textContent = formatMoney(PRICE);
  shippingAmountEl.textContent = formatMoney(SHIPPING);
  taxAmountEl.textContent = "Calculated in PayPal";
  totalAmountEl.textContent = formatMoney(PRICE + SHIPPING);

  renderButtonsIfNeeded().catch(function (error) {
    console.error(error);
    setStatus(error && error.message ? error.message : "PayPal checkout could not be loaded.", true);
  });
})();
