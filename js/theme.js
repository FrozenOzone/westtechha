/* WestTechHA theme controller
   - Default: follow OS preference (no override)
   - Click: cycle Auto -> Dark -> Light -> Auto
   - Stores preference in localStorage key 'wtha-theme'
*/
(() => {
  const KEY = "wtha-theme";
  const root = document.documentElement;

  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function apply(mode) {
    if (mode === "dark" || mode === "light") {
      root.setAttribute("data-theme", mode);
    } else {
      root.removeAttribute("data-theme"); // auto
    }
    updateButton(mode);
  }

  function getStored() {
    const v = localStorage.getItem(KEY);
    return (v === "dark" || v === "light" || v === "auto") ? v : "auto";
  }

  function setStored(mode) {
    if (mode === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, mode);
  }

  function nextMode(mode) {
    // Auto -> Dark -> Light -> Auto
    if (mode === "auto") return "dark";
    if (mode === "dark") return "light";
    return "auto";
  }

  // Create a small floating theme toggle button
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "theme-fab";
  btn.id = "themeToggle";
  btn.setAttribute("aria-label", "Theme toggle");
  btn.setAttribute("title", "Theme: Auto / Dark / Light");

  // Optional icon span
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  btn.append(icon, label);

  // Create a quiet Back to Top button for longer pages
  const topBtn = document.createElement("button");
  topBtn.type = "button";
  topBtn.className = "back-to-top-fab";
  topBtn.id = "backToTop";
  topBtn.setAttribute("aria-label", "Back to top");
  topBtn.setAttribute("aria-hidden", "true");
  topBtn.setAttribute("title", "Back to top");
  topBtn.tabIndex = -1;

  const topIcon = document.createElement("span");
  topIcon.setAttribute("aria-hidden", "true");
  topIcon.textContent = "↑";
  const topLabel = document.createElement("span");
  topLabel.textContent = "Top";
  topBtn.append(topIcon, topLabel);

  let productFabMode = false;
  let productJumpShouldShow = () => false;
  let productJumpMenu = null;

  function setupProductFabJumpPicker() {
    const topJump = document.querySelector(".product-jump-nav");
    if (!topJump || productFabMode) return false;

    const sourceLinks = Array.from(topJump.querySelectorAll('a[href^="#"]'));
    if (!sourceLinks.length) return false;

    productFabMode = true;
    document.body.classList.add("has-product-jump-nav");

    topIcon.textContent = "↕";
    topLabel.textContent = "Jump To";
    topBtn.setAttribute("aria-label", "Jump to product section");
    topBtn.setAttribute("title", "Jump to product section");
    topBtn.setAttribute("aria-expanded", "false");

    productJumpMenu = document.createElement("div");
    productJumpMenu.className = "product-fab-jump-menu";
    productJumpMenu.setAttribute("aria-label", "Jump to product page sections");
    productJumpMenu.innerHTML = sourceLinks.map((link) => {
      const href = link.getAttribute("href");
      const labelText = link.textContent.trim();
      return `<a href="${href}">${labelText}</a>`;
    }).join("");
    document.body.appendChild(productJumpMenu);

    const menuLinks = Array.from(productJumpMenu.querySelectorAll('a[href^="#"]'));

    const getHeaderHeight = () => {
      const headerHost = document.getElementById("site-header");
      const header = headerHost ? (headerHost.querySelector(".site-header") || headerHost) : document.querySelector(".site-header, header");
      return header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    };

    const getHeaderOffset = () => getHeaderHeight() + 48;

    productJumpShouldShow = () => {
      const rect = topJump.getBoundingClientRect();
      const headerHeight = getHeaderHeight();

      // Show compact Jump only after the inline Jump bar has scrolled behind/above the fixed header.
      return rect.bottom <= (headerHeight + 8);
    };

    const closeMenu = () => {
      document.body.classList.remove("jump-menu-open");
      topBtn.setAttribute("aria-expanded", "false");
    };

    const setActive = (hash) => {
      [...sourceLinks, ...menuLinks].forEach((link) => {
        const active = link.getAttribute("href") === hash;
        link.classList.toggle("active", active);
        if (active) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    };

    const jumpToHash = (hash) => {
      const target = document.querySelector(hash);
      if (!target) return;

      const targetTop = target.getBoundingClientRect().top + window.scrollY;
      const destination = Math.max(0, targetTop - getHeaderOffset());

      window.history.pushState(null, "", hash);
      window.scrollTo({ top: destination, behavior: "smooth" });
      setActive(hash);
      closeMenu();
    };

    [...sourceLinks, ...menuLinks].forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        jumpToHash(link.getAttribute("href"));
      });
    });

    document.addEventListener("click", (event) => {
      if (!productJumpMenu.contains(event.target) && !topBtn.contains(event.target)) closeMenu();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });

    if (window.location.hash) {
      window.setTimeout(() => jumpToHash(window.location.hash), 140);
    }

    return true;
  }

  topBtn.addEventListener("click", (event) => {
    if (productFabMode) {
      event.preventDefault();
      event.stopPropagation();
      const open = document.body.classList.toggle("jump-menu-open");
      topBtn.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  function updateButton(mode) {
    let effective = mode;
    if (mode === "auto") {
      effective = mq && mq.matches ? "dark" : "light";
    }
    icon.textContent = effective === "dark" ? "☾" : "☀";
    label.textContent = `Theme: ${mode[0].toUpperCase()}${mode.slice(1)}`;
    btn.setAttribute('data-theme-current', mode);
    btn.setAttribute('data-theme-effective', effective);
  }

  btn.addEventListener("click", () => {
    const current = getStored();
    const next = nextMode(current);
    setStored(next);
    apply(next);
  });

  // If user is in Auto, follow system changes live
  if (mq && mq.addEventListener) {
    mq.addEventListener("change", () => {
      if (getStored() === "auto") apply("auto");
    });
  } else if (mq && mq.addListener) {
    mq.addListener(() => {
      if (getStored() === "auto") apply("auto");
    });
  }

  // Mount after DOM is ready
  const mount = () => {
    document.body.append(btn, topBtn);
    setupProductFabJumpPicker();

    const syncTopButton = () => {
      let showTop = (window.scrollY || window.pageYOffset || 0) > 520;

      if (productFabMode) {
        showTop = productJumpShouldShow();
        if (!showTop) {
          document.body.classList.remove("jump-menu-open");
          topBtn.setAttribute("aria-expanded", "false");
        }
      }

      topBtn.classList.toggle("is-visible", showTop);
      topBtn.setAttribute("aria-hidden", showTop ? "false" : "true");
      topBtn.tabIndex = showTop ? 0 : -1;
    };

    syncTopButton();
    window.addEventListener("scroll", syncTopButton, { passive: true });
    window.addEventListener("load", syncTopButton);
    window.addEventListener("resize", syncTopButton);

    // ---- Polish: keep the buttons clear of footer/watermark content ----
    // Some layouts put a small footer watermark at the bottom; we "lift" the button
    // when the footer (or watermark) enters the viewport so it never sits on top.
    const liftVar = "--theme-fab-lift";
    const LIFT_PX = 84; // conservative: clears a 1–2 line footer
    const target = document.querySelector("footer.footer")
      || document.querySelector(".footer")
      || document.querySelector(".page-watermark")
      || document.querySelector(".watermark");

    if (target && "IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        const anyVisible = entries.some(e => e.isIntersecting);
        root.style.setProperty(liftVar, anyVisible ? `${LIFT_PX}px` : "0px");
      }, {
        // Trigger as soon as the footer/watermark approaches the bottom area
        root: null,
        threshold: 0,
        rootMargin: "0px 0px 140px 0px"
      });
      io.observe(target);
    }

    // Compact mode on very small screens: icon-only
    const setCompact = () => {
      const isCompact = window.innerWidth <= 420;
      btn.classList.toggle("is-compact", isCompact);
      topBtn.classList.toggle("is-compact", isCompact);
    };
    setCompact();
    window.addEventListener("resize", setCompact, { passive: true });

    apply(getStored());
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
