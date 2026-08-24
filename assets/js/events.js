// Carica gli eventi da GET /api/eventi (backend .NET del gestionale soci —
// unico sistema ora, sostituisce il vecchio CMS separato su Table Storage)
// e li mostra al posto del messaggio "coming soon", che resta comunque
// nell'HTML come stato di partenza — utile se JS è disabilitato, se l'API
// è momentaneamente giù, o finché non c'è ancora nessun evento aperto.
//
// Ogni contenitore [data-events-mount] può specificare:
//   data-status="aperto|chiuso"     quali eventi mostrare (default: aperto)
//   data-max="3"                    quanti mostrarne al massimo
//   data-coming-soon="id"           elemento di fallback da nascondere se non vuoto
//   data-hide-section="id"          sezione intera da nascondere se non ci sono eventi
//                                   (utile per un archivio che non deve comparire affatto
//                                   quando è vuoto, invece di mostrare un titolo senza nulla sotto)
// Da non autenticati (visitatori del sito) l'API restituisce solo eventi
// aperto/chiuso — mai bozza/annullato, indipendentemente da cosa si chiede.

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

  function formattaData(isoDate) {
    var parti = isoDate.split("-");
    return parti[2] + "/" + parti[1] + "/" + parti[0];
  }

  function renderEventCard(event) {
    var article = document.createElement("article");
    article.className = "event-card";
    if (event.categoria) {
      article.setAttribute("data-category", event.categoria);
    }

    var metaParts = [];
    if (event.luogo) {
      metaParts.push("<span>📍 " + escapeHtml(event.luogo) + "</span>");
    }
    metaParts.push("<span>🗓️ " + formattaData(event.dataEvento) + "</span>");
    if (event.quotaEvento) {
      metaParts.push("<span>" + event.quotaEvento + " €</span>");
    }

    article.innerHTML =
      '<div class="event-card__top">' +
      (event.categoria ? '<span class="event-card__tag">' + escapeHtml(categoryLabel(event.categoria)) + "</span>" : "") +
      '<h3 class="event-card__title">' + escapeHtml(event.titolo) + "</h3>" +
      '<p class="event-card__meta">' + metaParts.join("") + "</p>" +
      "</div>" +
      '<div class="event-card__body">' +
      (event.descrizione ? '<p class="event-card__desc">' + escapeHtml(event.descrizione) + "</p>" : "") +
      '<a href="iscrizione-evento.html?id=' + event.id + '" class="event-card__cta">Iscriviti</a>' +
      "</div>";

    return article;
  }

  function fillMount(mount, allEvents) {
    var status = mount.getAttribute("data-status") || "aperto";
    var max = parseInt(mount.getAttribute("data-max"), 10);
    var comingSoonId = mount.getAttribute("data-coming-soon");
    var comingSoon = comingSoonId ? document.getElementById(comingSoonId) : null;
    var hideSectionId = mount.getAttribute("data-hide-section");
    var section = hideSectionId ? document.getElementById(hideSectionId) : null;

    var events = allEvents.filter(function (event) {
      return event.stato === status;
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

    window.trameFetch("/api/eventi")
      .then(function (events) {
        events = events || [];
        mounts.forEach(function (mount) {
          fillMount(mount, events);
        });
      })
      .catch(function () {
        // Nessun evento da mostrare: i fallback già nell'HTML restano visibili.
      });
  });
})();
