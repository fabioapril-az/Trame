// Carica gli eventi pubblicati da /api/events e li mostra al posto del
// messaggio "coming soon", che resta comunque nell'HTML come stato di
// partenza — utile se JS è disabilitato, se l'API è momentaneamente giù,
// o finché non c'è ancora nessun evento pubblicato.

(function () {
  var CATEGORY_LABELS = {
    yoga: "Yoga",
    fotografia: "Fotografia",
    pasticceria: "Pasticceria",
    canto: "Canto",
    ballo: "Ballo",
    disegno: "Disegno",
    "trekking-urbano": "Trekking urbano",
    viaggi: "Viaggi",
  };

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || category || "";
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function renderEventCard(event) {
    var article = document.createElement("article");
    article.className = "event-card";

    var metaParts = [];
    if (event.whereLabel) {
      metaParts.push("<span>📍 " + escapeHtml(event.whereLabel) + "</span>");
    }
    if (event.whenLabel) {
      metaParts.push("<span>🗓️ " + escapeHtml(event.whenLabel) + "</span>");
    }

    article.innerHTML =
      '<div class="event-card__top">' +
      (event.category ? '<span class="event-card__tag">' + escapeHtml(categoryLabel(event.category)) + "</span>" : "") +
      '<h3 class="event-card__title">' + escapeHtml(event.title) + "</h3>" +
      (metaParts.length ? '<p class="event-card__meta">' + metaParts.join("") + "</p>" : "") +
      "</div>" +
      '<div class="event-card__body">' +
      (event.description ? '<p class="event-card__desc">' + escapeHtml(event.description) + "</p>" : "") +
      '<a href="contatti.html" class="event-card__cta">' + escapeHtml(event.ctaLabel || "Scrivici per iscriverti") + "</a>" +
      "</div>";

    return article;
  }

  function mountEvents(mount) {
    var comingSoonId = mount.getAttribute("data-coming-soon");
    var comingSoon = comingSoonId ? document.getElementById(comingSoonId) : null;
    var max = parseInt(mount.getAttribute("data-max"), 10);

    fetch("/api/events")
      .then(function (res) {
        if (!res.ok) throw new Error("Richiesta eventi non riuscita");
        return res.json();
      })
      .then(function (data) {
        var events = (data && data.events) || [];
        if (!events.length) {
          return; // resta il messaggio "coming soon" già nell'HTML
        }
        if (max && events.length > max) {
          events = events.slice(0, max);
        }

        events.forEach(function (event) {
          mount.appendChild(renderEventCard(event));
        });

        mount.hidden = false;
        if (comingSoon) {
          comingSoon.hidden = true;
        }
      })
      .catch(function () {
        // Nessun evento da mostrare: il fallback "coming soon" resta visibile.
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-events-mount]").forEach(mountEvents);
  });
})();
