function applyThemeColor() {
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    const cssColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-base-200")
      .trim();

    if (cssColor) {
      themeMeta.setAttribute("content", cssColor);
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyThemeColor, { once: true });
} else {
  applyThemeColor();
}
