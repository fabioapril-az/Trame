// Carica gli eventi da GET /api/eventi (backend .NET del gestionale soci —
// unico sistema ora, sostituisce il vecchio CMS separato su Table Storage)
// e li mostra al posto del messaggio "coming soon", che resta comunque
// nell'HTML come stato di partenza — utile se JS è disabilitato, se l'API
// è momentaneamente giù, o finché non c'è ancora nessun evento aperto.
//
// Ogni contenitore [data-events-mount] può specificare:
//   data-status="aperto|chiuso|annunciato"  quali eventi mostrare (default: aperto).
//                                   Si può indicare più di uno stato separandoli con
//                                   una virgola (es. "aperto,annunciato"): compaiono
//                                   tutti nella stessa griglia, nell'ordine degli stati
//                                   elencati — usato per mostrare aperti e annunciati
//                                   insieme (aperti prima), invece che in sezioni separate.
//   data-max="3"                    quanti mostrarne al massimo
//   data-coming-soon="id"           elemento di fallback da nascondere se non vuoto
//   data-hide-section="id"          sezione intera da nascondere se non ci sono eventi
//                                   (utile per un archivio che non deve comparire affatto
//                                   quando è vuoto, invece di mostrare un titolo senza nulla sotto)
//   data-empty-categoria="id"       elemento da mostrare (invece di data-coming-soon) quando
//                                   si arriva filtrati su una categoria (eventi.html#yoga, dalle
//                                   card "Le nostre trame" in home/footer) e quella categoria
//                                   specifica non ha eventi — deve contenere un elemento con
//                                   [data-categoria-nome], dove viene scritto il nome della categoria
// Da non autenticati (visitatori del sito) l'API restituisce solo eventi
// aperto/chiuso/annunciato — mai bozza/annullato, indipendentemente da cosa si chiede.
// "annunciato": pubblicato in anteprima (può non avere ancora una data),
// niente bottone Prenota — vedi renderEventCard.

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

  var CATEGORY_ICONS = {
    yoga: "🧘",
    fotografia: "📷",
    pasticceria: "🍰",
    canto: "🎤",
    ballo: "💃",
    disegno: "✏️",
    "trekking-urbano": "🥾",
    viaggi: "🧳",
  };

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || category || "Altro";
  }

  function categoryIcon(category) {
    return CATEGORY_ICONS[category] || "🗓️";
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  // Gli eventi "annunciato" possono non avere ancora una data (solo bozza e
  // annunciato lo permettono — vedi coordinamento con l'API).
  function formattaData(isoDate) {
    if (!isoDate) return "Data da definire";
    var parti = isoDate.split("-");
    return parti[2] + "/" + parti[1] + "/" + parti[0];
  }

  function formattaPrezzo(valore) {
    return Number(valore).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  // Dall'editor di formattazione in admin (Quill) "Descrizione"/testoDettaglio
  // arrivano come HTML (grassetto/corsivo/colore/liste/immagini), ma gli
  // eventi creati prima che l'editor esistesse hanno ancora testo semplice
  // con eventuali "\n" come separatori di paragrafo — le due situazioni si
  // distinguono cercando un tag HTML nel valore (stesso criterio usato in
  // admin per la stessa ragione). Duplicato in evento-dettaglio.js, non
  // condiviso: stessa scelta già fatta per gli altri helper di questo file.
  var TAG_HTML = /<[a-z][\s\S]*>/i;

  function contieneHtml(testo) {
    return TAG_HTML.test(testo);
  }

  function sanitizza(html) {
    if (!window.DOMPurify) {
      // DOMPurify non caricato (CDN irraggiungibile): meglio testo semplice
      // e sicuro che HTML non filtrato.
      var div = document.createElement("div");
      div.innerHTML = html;
      return escapeHtml(div.textContent);
    }
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "span", "ol", "ul", "li", "a", "img"],
      ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "style", "class", "data-list"],
    });
  }

  // Quill genera SEMPRE <ol> per gli elenchi, puntati compresi: distingue i
  // due tipi con l'attributo data-list="bullet"/"ordered" su ogni <li>, e li
  // rende visivamente diversi con il proprio CSS (non incluso qui, solo
  // l'HTML che produce). Senza quel CSS un elenco puntato risulterebbe
  // numerato di default: qui si converte in un vero <ul> quando serve, così
  // basta il CSS normale del sito.
  function normalizzaListeQuill(container) {
    container.querySelectorAll("ol").forEach(function (ol) {
      var primoConTipo = ol.querySelector("li[data-list]");
      var puntato = primoConTipo && primoConTipo.getAttribute("data-list") === "bullet";
      ol.querySelectorAll("li[data-list]").forEach(function (li) { li.removeAttribute("data-list"); });
      if (puntato) {
        var ul = document.createElement("ul");
        while (ol.firstChild) { ul.appendChild(ol.firstChild); }
        ol.replaceWith(ul);
      }
    });
  }

  // "Descrizione" è pensata apposta come testo breve per la card (il testo
  // esteso va nel campo separato testoDettaglio, mostrato solo nella pagina
  // di dettaglio — vedi evento-dettaglio.js): qui si mostra per intero,
  // senza troncare.
  function formattaDescrizioneCard(testo) {
    if (contieneHtml(testo)) {
      return sanitizza(testo);
    }
    // Testo semplice "vecchio stile": paragrafi separati da eventuali "\n",
    // non uniti su una riga.
    return testo
      .split(/\n+/)
      .map(function (paragrafo) { return paragrafo.trim(); })
      .filter(Boolean)
      .map(function (paragrafo) { return "<p>" + escapeHtml(paragrafo) + "</p>"; })
      .join("");
  }

  function renderEventCard(event) {
    var article = document.createElement("article");
    article.className = "event-card";
    if (event.categoria) {
      article.setAttribute("data-category", event.categoria);
    }

    var metaParts = [];
    metaParts.push(
      "<span>🗓️ " + formattaData(event.dataEvento) + (event.ora ? " · " + escapeHtml(event.ora) : "") + "</span>"
    );
    if (event.luogo) {
      metaParts.push("<span>📍 " + escapeHtml(event.luogo) + "</span>");
    }

    // Se manca immagineUrl, un riquadro con l'icona della categoria al
    // posto della foto, così la card resta ben composta comunque.
    var mediaHtml = event.immagineUrl
      ? '<img src="' + escapeHtml(event.immagineUrl) + '" alt="" class="event-card__image" loading="lazy">'
      : '<span class="event-card__media-icon" aria-hidden="true">' + categoryIcon(event.categoria) + "</span>";

    // "annunciato": pubblicato in anteprima, niente iscrizioni ancora aperte
    // — nessun bottone Prenota (non semplicemente disabilitato: proprio
    // assente, a differenza di "chiuso"/tutto esaurito).
    var annunciato = event.stato === "annunciato";
    var postiEsauriti = event.postiDisponibili != null && event.postiDisponibili <= 0;
    var nonPrenotabile = event.stato !== "aperto" || postiEsauriti;
    var etichettaNonPrenotabile = event.stato !== "aperto" ? "Iscrizioni chiuse" : "Posti esauriti";

    var azionePrenota = annunciato
      ? ""
      : (nonPrenotabile
        ? '<span class="btn btn--outline btn--small" aria-disabled="true" style="opacity:.6; pointer-events:none;">' + etichettaNonPrenotabile + "</span>"
        : '<a href="iscrizione-evento.html?id=' + event.id + '" class="btn btn--primary btn--small">Prenota →</a>');

    // dettagliAttivi: interruttore manuale per-evento (default true se
    // omesso) — se spento, niente accesso alla pagina di dettaglio finché
    // non è pronta, indipendentemente dallo stato dell'evento.
    var dettagliAttivi = event.dettagliAttivi !== false;
    var azioneDettagli = dettagliAttivi
      ? '<a href="evento.html?id=' + event.id + '" class="btn btn--outline btn--small">Dettagli →</a>'
      : "";

    article.innerHTML =
      '<div class="event-card__media">' +
      mediaHtml +
      (event.categoria ? '<span class="event-card__badge">' + escapeHtml(categoryLabel(event.categoria)) + "</span>" : "") +
      (annunciato ? '<span class="event-card__badge event-card__badge--stato">Prossimamente</span>' : "") +
      "</div>" +
      '<div class="event-card__body">' +
      '<p class="event-card__meta">' + metaParts.join("") + "</p>" +
      '<h3 class="event-card__title">' + escapeHtml(event.titolo) + "</h3>" +
      (event.descrizione ? '<div class="event-card__desc">' + formattaDescrizioneCard(event.descrizione) + "</div>" : "") +
      '<div class="event-card__footer">' +
      (event.quotaEvento ? '<span class="event-card__price">' + formattaPrezzo(event.quotaEvento) + "</span>" : "<span></span>") +
      '<div class="event-card__actions">' +
      azioneDettagli +
      azionePrenota +
      "</div>" +
      "</div>" +
      "</div>";

    var descEl = article.querySelector(".event-card__desc");
    if (descEl) {
      normalizzaListeQuill(descEl);
    }

    return article;
  }

  function ordinaAnnunciati(events) {
    // Gli "annunciato" possono non avere ancora una data: quelli con una
    // data già nota vanno prima (dal più vicino), quelli ancora del tutto
    // da definire in coda — l'API non lo garantisce (i NULL SQL finiscono
    // in fondo solo per costruzione della query, non per scelta esplicita).
    return events.slice().sort(function (a, b) {
      if (!a.dataEvento && !b.dataEvento) return 0;
      if (!a.dataEvento) return 1;
      if (!b.dataEvento) return -1;
      return a.dataEvento < b.dataEvento ? -1 : a.dataEvento > b.dataEvento ? 1 : 0;
    });
  }

  function fillMount(mount, allEvents, categoriaFiltro) {
    var statuses = (mount.getAttribute("data-status") || "aperto").split(",").map(function (s) { return s.trim(); });
    var max = parseInt(mount.getAttribute("data-max"), 10);
    var comingSoonId = mount.getAttribute("data-coming-soon");
    var comingSoon = comingSoonId ? document.getElementById(comingSoonId) : null;
    var hideSectionId = mount.getAttribute("data-hide-section");
    var section = hideSectionId ? document.getElementById(hideSectionId) : null;
    var emptyCategoriaId = mount.getAttribute("data-empty-categoria");
    var emptyCategoria = emptyCategoriaId ? document.getElementById(emptyCategoriaId) : null;

    // Con più stati (es. "aperto,annunciato") gli eventi restano raggruppati
    // nell'ordine in cui gli stati sono elencati, non mescolati tra loro.
    var events = [];
    statuses.forEach(function (status) {
      var gruppo = allEvents.filter(function (event) { return event.stato === status; });
      if (status === "annunciato") {
        gruppo = ordinaAnnunciati(gruppo);
      }
      events = events.concat(gruppo);
    });

    // Arrivo filtrato da una card categoria in home (eventi.html#yoga, ecc.)
    // — vedi lettura di categoriaFiltro dall'hash più sotto.
    if (categoriaFiltro) {
      events = events.filter(function (event) { return event.categoria === categoriaFiltro; });
    }

    if (!events.length) {
      if (section) {
        section.hidden = true;
      }
      // Categoria filtrata ma senza eventi propri: messaggio dedicato
      // ("Arriveranno presto"), diverso dal fallback generico sotto che
      // invece è per quando non c'è NESSUN evento pubblicato in nessuna
      // categoria.
      if (categoriaFiltro && emptyCategoria) {
        var nomeEl = emptyCategoria.querySelector("[data-categoria-nome]");
        if (nomeEl) {
          nomeEl.textContent = categoryLabel(categoriaFiltro);
        }
        emptyCategoria.hidden = false;
        if (comingSoon) {
          comingSoon.hidden = true;
        }
        return;
      }
      // Nessun evento: si mostra (di nuovo) il fallback "coming soon",
      // gestito esplicitamente in entrambi i rami — vedi nota su
      // comingSoon.hidden più sotto sul perché non basta lasciarlo com'era.
      if (comingSoon) {
        comingSoon.hidden = false;
      }
      return;
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
    if (emptyCategoria) {
      emptyCategoria.hidden = true;
    }
    if (section) {
      section.hidden = false;
    }
  }

  // Categoria scelta da una card "Le nostre trame" in home (eventi.html#yoga,
  // eventi.html#trekking-urbano, ecc. — stessi link anche nel footer). Un
  // hash che non corrisponde a una categoria nota (o assente) non filtra
  // nulla, invece di mostrare per errore "nessun evento" per una categoria
  // inesistente.
  function leggiCategoriaFiltro() {
    var hash = (window.location.hash || "").replace(/^#/, "");
    return hash && CATEGORY_LABELS.hasOwnProperty(hash) ? hash : null;
  }

  // Solo su eventi.html il titolo ha questi id (in home, dove events.js
  // gira anche per la sezione "In programma", non esistono: qui non
  // succede nulla). Aggiorna titolo/sottotitolo per riflettere la
  // categoria scelta, invece di lasciare l'intestazione generica "Tante
  // categorie, un filo comune" su una pagina che ne mostra solo una.
  function aggiornaIntestazionePerCategoria(categoriaFiltro) {
    if (!categoriaFiltro) return;
    var titoloEl = document.getElementById("eventi-titolo");
    var sottotitoloEl = document.getElementById("eventi-sottotitolo");
    if (titoloEl) {
      titoloEl.textContent = categoryLabel(categoriaFiltro);
    }
    if (sottotitoloEl) {
      sottotitoloEl.textContent = "";
      sottotitoloEl.appendChild(document.createTextNode("Solo gli eventi e i corsi di questa categoria. "));
      var link = document.createElement("a");
      link.href = "eventi.html";
      link.textContent = "Vedi tutte le categorie →";
      sottotitoloEl.appendChild(link);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var mounts = document.querySelectorAll("[data-events-mount]");
    if (!mounts.length) return;

    var categoriaFiltro = leggiCategoriaFiltro();
    aggiornaIntestazionePerCategoria(categoriaFiltro);

    // Il messaggio "coming soon" resta visibile di default nell'HTML solo
    // come fallback per JS disabilitato — con JS attivo va nascosto SUBITO,
    // prima ancora che la chiamata all'API risponda: altrimenti per la
    // durata della richiesta si vede un lampo di "il calendario arriva
    // presto" anche quando ci sono eventi reali (bug reale segnalato
    // dall'utente). fillMount() lo farà ricomparire lui stesso se, una
    // volta arrivata la risposta, risulta che non ci sono davvero eventi.
    var comingSoonEls = [];
    mounts.forEach(function (mount) {
      var comingSoonId = mount.getAttribute("data-coming-soon");
      var el = comingSoonId ? document.getElementById(comingSoonId) : null;
      if (el) {
        comingSoonEls.push(el);
        el.hidden = true;
      }
    });
    var loadingEl = null;
    if (comingSoonEls.length) {
      loadingEl = document.createElement("p");
      loadingEl.className = "form-note";
      loadingEl.textContent = "Caricamento eventi…";
      comingSoonEls[0].parentNode.insertBefore(loadingEl, comingSoonEls[0]);
    }

    window.trameFetch("/api/eventi")
      .then(function (events) {
        if (loadingEl) {
          loadingEl.remove();
        }
        events = events || [];
        mounts.forEach(function (mount) {
          fillMount(mount, events, categoriaFiltro);
        });
      })
      .catch(function () {
        // API non raggiungibile: si torna al fallback "coming soon".
        if (loadingEl) {
          loadingEl.remove();
        }
        comingSoonEls.forEach(function (el) { el.hidden = false; });
      });
  });
})();
