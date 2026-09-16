/* Apply the saved theme before the page can paint. */
(() => {
  try {
    const savedTheme = localStorage.getItem("wtha-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  } catch (error) {
    document.documentElement.removeAttribute("data-theme");
  }
})();
