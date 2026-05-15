(function () {
  const STATUS_CLASS_PREFIX = "availability-";
  const DEFAULT_AVAILABILITY = {
    status: "unknown",
    label: "Availability pending",
    canFulfill: true
  };

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

  function statusScore(status) {
    if (status === "temporarily-unavailable") return 0;
    if (status === "low-stock") return 1;
    if (status === "in-stock") return 2;
    return 1;
  }

  function statusLabel(status) {
    if (status === "temporarily-unavailable") return "Temporarily unavailable";
    if (status === "low-stock") return "Low stock";
    if (status === "in-stock") return "In stock";
    return "Availability pending";
  }

  function clearAvailabilityClasses(el) {
    Array.from(el.classList).forEach(function (className) {
      if (className.indexOf(STATUS_CLASS_PREFIX) === 0) el.classList.remove(className);
    });
  }

  function applyAvailability(el, availability) {
    const inv = availability || DEFAULT_AVAILABILITY;
    const status = inv.status || "unknown";
    const prefix = el.getAttribute("data-product-availability-prefix") || "Availability: ";
    el.textContent = `${prefix}${inv.label || statusLabel(status)}`;
    clearAvailabilityClasses(el);
    el.classList.add("product-availability-badge", `${STATUS_CLASS_PREFIX}${status}`);
  }

  function groupAvailability(products, skus) {
    const availability = skus.map(function (sku) {
      return products[sku] && products[sku].availability ? products[sku].availability : null;
    }).filter(Boolean);

    if (!availability.length) return null;

    const availableCount = availability.filter(function (item) { return item.status !== "temporarily-unavailable"; }).length;
    let status;

    if (availableCount === 0) {
      status = "temporarily-unavailable";
    } else if (availableCount < availability.length || availability.some(function (item) { return statusScore(item.status) <= 1; })) {
      status = "low-stock";
    } else {
      status = "in-stock";
    }

    return {
      status,
      label: statusLabel(status),
      canFulfill: status !== "temporarily-unavailable"
    };
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

    document.querySelectorAll("[data-product-availability]").forEach(function (el) {
      const sku = el.getAttribute("data-product-availability");
      const product = products[sku];
      if (product && product.availability) applyAvailability(el, product.availability);
    });

    document.querySelectorAll("[data-product-availability-group]").forEach(function (el) {
      const skus = (el.getAttribute("data-product-availability-group") || "")
        .split(",")
        .map(function (sku) { return sku.trim(); })
        .filter(Boolean);
      const availability = groupAvailability(products, skus);
      if (availability) applyAvailability(el, availability);
    });
  }

  fetchJson("/api/products")
    .then(function (data) { if (data.products) updateProductPrice(data.products); })
    .catch(function (error) { console.warn(error && error.message ? error.message : error); });
})();
