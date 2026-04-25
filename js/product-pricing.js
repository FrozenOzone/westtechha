(function () {
  function formatMoney(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD"
    }).format(Number(value || 0));
  }

  function fetchJson(url) {
    return fetch(url, { headers: { "Content-Type": "application/json" } }).then(async function (response) {
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.message || "Could not load product pricing.");
      return data;
    });
  }

  function shippingTierText(product) {
    return product.shippingTierSummary || `Shipping tiers: 1 unit ${formatMoney(product.shippingAmount)} • 2 units $10.95 • 3-4 units $14.95 • 5+ units custom / email order`;
  }

  function familyMinPrice(products, family) {
    const familyProducts = Object.values(products).filter(function (product) {
      return product.family === family;
    });

    if (!familyProducts.length) return null;

    return Math.min.apply(null, familyProducts.map(function (product) {
      return Number(product.unitAmount || product.itemAmount || 0);
    }));
  }

  function updateProductPrice(products) {
    document.querySelectorAll("[data-product-price]").forEach(function (el) {
      const product = products[el.getAttribute("data-product-price")];
      if (product) el.textContent = formatMoney(product.unitAmount || product.itemAmount);
    });

    document.querySelectorAll("[data-product-shipping-note]").forEach(function (el) {
      const product = products[el.getAttribute("data-product-shipping-note")];
      if (product) el.textContent = shippingTierText(product);
    });

    document.querySelectorAll("[data-product-from]").forEach(function (el) {
      const family = el.getAttribute("data-product-from");
      const minPrice = familyMinPrice(products, family);

      if (minPrice === null) return;

      const amount = formatMoney(minPrice);
      const format = el.getAttribute("data-product-from-format") || "";
      const prefix = el.getAttribute("data-product-from-prefix");
      const suffix = el.getAttribute("data-product-from-suffix");

      if (format === "amount-only") {
        el.textContent = amount;
        return;
      }

      if (prefix !== null || suffix !== null) {
        el.textContent = `${prefix || ""}${amount}${suffix || ""}`;
        return;
      }

      el.textContent = `From ${amount}`;
    });
  }

  fetchJson("/api/products")
    .then(function (data) { if (data.products) updateProductPrice(data.products); })
    .catch(function (error) { console.warn(error && error.message ? error.message : error); });
})();
