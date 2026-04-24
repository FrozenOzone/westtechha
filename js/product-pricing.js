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

  function updateProductPrice(products) {
    document.querySelectorAll("[data-product-price]").forEach(function (el) {
      const product = products[el.getAttribute("data-product-price")];
      if (product) el.textContent = formatMoney(product.itemAmount);
    });

    document.querySelectorAll("[data-product-shipping-note]").forEach(function (el) {
      const product = products[el.getAttribute("data-product-shipping-note")];
      if (product) el.textContent = `Flat-rate shipping to the 48 contiguous U.S.: ${formatMoney(product.shippingAmount)}`;
    });

    document.querySelectorAll("[data-product-from]").forEach(function (el) {
      const family = el.getAttribute("data-product-from");
      const suffix = el.getAttribute("data-product-from-suffix") || "";
      const familyProducts = Object.values(products).filter(function (product) {
        return product.family === family;
      });
      if (!familyProducts.length) return;
      const minPrice = Math.min.apply(null, familyProducts.map(function (product) {
        return Number(product.itemAmount || 0);
      }));
      el.textContent = `From ${formatMoney(minPrice)}${suffix}`;
    });
  }

  fetchJson("/api/products")
    .then(function (data) { if (data.products) updateProductPrice(data.products); })
    .catch(function (error) { console.warn(error && error.message ? error.message : error); });
})();
