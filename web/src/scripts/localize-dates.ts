function localizeDateElements() {
  document.querySelectorAll<HTMLTimeElement>("time[data-localized-date]").forEach(($time) => {
    const date = $time.getAttribute("datetime");
    if ($time.dataset.isLocalized !== "true" && date) {
      try {
        $time.textContent = new Intl.DateTimeFormat(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(date));
        $time.dataset.isLocalized = "true";
      } catch (error) {
        console.error("Error localizing date:", error);
      }
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", localizeDateElements, { once: true });
} else {
  localizeDateElements();
}
