import { zip } from "es-toolkit/array";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

function toLocalYyyyMmDd(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCommonYyyyMmDdPrefix(start: string, end: string): string {
  return zip(start.split("-"), end.split("-"))
    .map(([a, b]) => (a === b ? a : false))
    .filter(Boolean)
    .join("-");
}

function localizeDateElements() {
  document.querySelectorAll<HTMLTimeElement>("time[data-localized-date]").forEach(($time) => {
    if ($time.dataset.isLocalized === "true") {
      return;
    }

    const format = $time.dataset.format ?? "datetime";

    try {
      if ($time.hasAttribute("datetime")) {
        const date = $time.getAttribute("datetime");
        if (!date) {
          return;
        }

        if (format === "date") {
          $time.textContent = toLocalYyyyMmDd(date);
        } else {
          $time.textContent = dateTimeFormatter.format(new Date(date));
        }
      } else {
        const lowerBound = $time.getAttribute("lowerBound") ?? $time.getAttribute("lowerbound");
        const upperBound = $time.getAttribute("upperBound") ?? $time.getAttribute("upperbound");

        if (!lowerBound || !upperBound) {
          return;
        }

        if (format === "date") {
          const start = toLocalYyyyMmDd(lowerBound);
          const end = toLocalYyyyMmDd(upperBound);
          const commonPrefix = getCommonYyyyMmDdPrefix(start, end);

          if (commonPrefix.length > 0) {
            $time.textContent = commonPrefix;
          } else {
            $time.textContent = `${start} — ${end}`;
          }
        } else {
          const start = dateTimeFormatter.format(new Date(lowerBound));
          const end = dateTimeFormatter.format(new Date(upperBound));
          $time.textContent = `${start} — ${end}`;
        }
      }

      $time.dataset.isLocalized = "true";
    } catch (error) {
      console.error("Error localizing date:", error);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", localizeDateElements, { once: true });
} else {
  localizeDateElements();
}
