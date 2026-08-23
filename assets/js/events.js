// Carica gli eventi da /api/events e li mostra al posto del messaggio
// "coming soon", che resta comunque nell'HTML come stato di partenza —
// utile se JS è disabilitato, se l'API è momentaneamente giù, o finché
// non c'è ancora nessun evento pubblicato.
//
// Ogni contenitore [data-events-mount] può specificare:
//   data-status="pubblicato|fatto"  quali eventi mostrare (default: pubblicato)
//   data-max="3"                    quanti mostrarne al massimo
//   data-coming-soon="id"           elemento di fallback da nascondere se non vuoto
//   data-hide-section="id"          sezione intera da nascondere se non ci sono eventi
//                                   (utile per un archivio che non deve comparire affatto
//                                   quando è vuoto, invece di mostrare un titolo senza nulla sotto)

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

  function fillMount(mount, allEvents) {
    var status = mount.getAttribute("data-status") || "pubblicato";
    var max = parseInt(mount.getAttribute("data-max"), 10);
    var comingSoonId = mount.getAttribute("data-coming-soon");
    var comingSoon = comingSoonId ? document.getElementById(comingSoonId) : null;
    var hideSectionId = mount.getAttribute("data-hide-section");
    var section = hideSectionId ? document.getElementById(hideSectionId) : null;

    var events = allEvents.filter(function (event) {
      return event.status === status;
    });

    if (!events.length) {
      if (section) {
        section.hidden = true;
      }
      return; // resta il fallback "coming soon" già nell'HTML, se presente
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
    if (section) {
      section.hidden = false;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var mounts = document.querySelectorAll("[data-events-mount]");
    if (!mounts.length) return;

    fetch("/api/events")
      .then(function (res) {
        if (!res.ok) throw new Error("Richiesta eventi non riuscita");
        return res.json();
      })
      .then(function (data) {
        var events = (data && data.events) || [];
        mounts.forEach(function (mount) {
          fillMount(mount, events);
        });
      })
      .catch(function () {
        // Nessun evento da mostrare: i fallback già nell'HTML restano visibili.
      });
  });
})();
