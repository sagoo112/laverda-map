(() => {
  "use strict";
  const byId = (id) => document.getElementById(id);
  const overview = byId("overview");
  const refreshLink = byId("refresh");
  const autoRefresh = byId("auto-refresh");
  const labels = {
    pass: "Verfügbar",
    fail: "Fehler",
    skipped: "Nicht geprüft",
  };
  const keys = ["api", "database", "directory", "authentication"];
  const number = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 });
  let activeRequest = null;

  function update(report, httpStatus) {
    if (
      !["Healthy", "Unhealthy"].includes(report.status) ||
      !Number.isFinite(report.durationMs) ||
      report.durationMs < 0 ||
      Number.isNaN(Date.parse(report.checkedAt)) ||
      keys.some(
        (key) =>
          !labels[report.checks?.[key]?.status] ||
          (report.checks[key].durationMs !== null &&
            (!Number.isFinite(report.checks[key].durationMs) ||
              report.checks[key].durationMs < 0)),
      ) ||
      (report.status === "Healthy" ? httpStatus !== 200 : httpStatus !== 503)
    ) {
      throw new Error("Invalid health response");
    }
    const healthy = report.status === "Healthy";
    overview.className =
      "overview " + (healthy ? "is-healthy" : "is-unhealthy");
    byId("overall-title").textContent = healthy
      ? "Alle Systeme bereit"
      : "Dienst eingeschränkt";
    byId("overall-description").textContent = healthy
      ? "Alle technischen Prüfungen sind erfolgreich."
      : "Mindestens eine technische Prüfung ist fehlgeschlagen.";
    byId("http-status").textContent = "HTTP " + httpStatus;
    byId("duration").textContent = number.format(report.durationMs) + " ms";
    byId("passed").textContent =
      keys.filter((key) => report.checks[key].status === "pass").length +
      " / 4";
    const time = byId("checked-at");
    time.dateTime = report.checkedAt;
    time.textContent = new Intl.DateTimeFormat("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(new Date(report.checkedAt));
    for (const key of keys) {
      const card = document.querySelector('[data-check="' + key + '"]');
      const check = report.checks[key];
      card.querySelector("[data-state]").className =
        "check-badge " + check.status;
      card.querySelector("[data-label]").textContent = labels[check.status];
      card.querySelector("[data-duration]").textContent =
        check.durationMs === null
          ? "—"
          : number.format(check.durationMs) + " ms";
    }
  }

  function unavailable() {
    overview.className = "overview is-unknown";
    byId("overall-title").textContent = "Status nicht erreichbar";
    byId("overall-description").textContent =
      "Die letzte Prüfung ist nicht mehr aktuell. Bitte erneut versuchen.";
    byId("http-status").textContent = "Keine aktuelle Antwort";
    byId("duration").textContent = "—";
    byId("passed").textContent = "— / 4";
    for (const card of document.querySelectorAll("[data-check]")) {
      card.querySelector("[data-state]").className = "check-badge unknown";
      card.querySelector("[data-label]").textContent = "Unbekannt";
      card.querySelector("[data-duration]").textContent = "—";
    }
    byId("refresh-message").textContent =
      "Keine Verbindung oder ungültige Antwort. Die angezeigte Prüfzeit gehört zur letzten erfolgreichen Übertragung.";
  }

  async function refresh() {
    if (activeRequest) return;
    const controller = new AbortController();
    activeRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    refreshLink.setAttribute("aria-disabled", "true");
    overview.setAttribute("aria-busy", "true");
    byId("refresh-label").textContent = "Wird geprüft…";
    try {
      const response = await fetch("/health?format=json", {
        headers: { Accept: "application/json" },
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      // A valid 503 report is an actual outage result, not a failed fetch.
      update(await response.json(), response.status);
      byId("refresh-message").textContent =
        "Status aktualisiert. Gemessen wurde die technische Bereitschaft der API.";
    } catch {
      unavailable();
    } finally {
      clearTimeout(timeout);
      activeRequest = null;
      refreshLink.removeAttribute("aria-disabled");
      overview.removeAttribute("aria-busy");
      byId("refresh-label").textContent = "Jetzt prüfen";
    }
  }

  refreshLink.addEventListener("click", (event) => {
    event.preventDefault();
    void refresh();
  });
  const timer = setInterval(() => {
    if (autoRefresh.checked && document.visibilityState === "visible")
      void refresh();
  }, 60000);
  window.addEventListener("pagehide", () => {
    clearInterval(timer);
    activeRequest?.abort();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });
  try {
    const initial = JSON.parse(byId("health-data").textContent);
    update(initial, initial.status === "Healthy" ? 200 : 503);
  } catch {
    unavailable();
  }
})();
