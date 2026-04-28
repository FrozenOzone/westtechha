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

  topBtn.addEventListener("click", () => {
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

    const syncTopButton = () => {
      const showTop = (window.scrollY || window.pageYOffset || 0) > 520;
      topBtn.classList.toggle("is-visible", showTop);
      topBtn.setAttribute("aria-hidden", showTop ? "false" : "true");
      topBtn.tabIndex = showTop ? 0 : -1;
    };

    syncTopButton();
    window.addEventListener("scroll", syncTopButton, { passive: true });
    window.addEventListener("load", syncTopButton);

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
