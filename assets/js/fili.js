// Carica i talenti da GET /api/talenti (pubblico: senza login risponde solo
// stato "pubblicato", stesso pattern già usato per GET /api/eventi — vedi
// events.js) e li mostra al posto del messaggio "i primi fili arrivano
// presto", che resta nell'HTML come stato di partenza per JS disabilitato,
// API momentaneamente giù, o finché non c'è ancora nessun talento pubblicato.
//
// Riusa le classi CSS di event-card (events.js) invece di definirne di
// nuove: stessa griglia, stessa cornice, stesso comportamento responsive —
// qui "ambito" prende il posto della categoria, "descrizione" il posto del
// testo breve, nessun prezzo né azione di prenotazione.

(function () {
  var grid = document.getElementById("fili-grid");
  var vuoto = document.getElementById("fili-vuoto");
  if (!grid) return;

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  // Testo libero (nessun editor Quill per questo campo, vedi backend):
  // niente HTML da sanitizzare, solo paragrafi separati da eventuali "\n".
  function formattaDescrizione(testo) {
    return (testo || "")
      .split(/\n+/)
      .map(function (paragrafo) { return paragrafo.trim(); })
      .filter(Boolean)
      .map(function (paragrafo) { return "<p>" + escapeHtml(paragrafo) + "</p>"; })
      .join("");
  }

  function renderCard(talento) {
    var article = document.createElement("article");
    article.className = "event-card";

    var mediaHtml = talento.immagineUrl
      ? '<img src="' + escapeHtml(talento.immagineUrl) + '" alt="" class="event-card__image" loading="lazy">'
      : '<span class="event-card__media-icon" aria-hidden="true">🧵</span>';

    article.innerHTML =
      '<div class="event-card__media">' +
      mediaHtml +
      (talento.ambito ? '<span class="event-card__badge">' + escapeHtml(talento.ambito) + "</span>" : "") +
      "</div>" +
      '<div class="event-card__body">' +
      '<h3 class="event-card__title">' + escapeHtml(talento.nome) + "</h3>" +
      (talento.descrizione ? '<div class="event-card__desc">' + formattaDescrizione(talento.descrizione) + "</div>" : "") +
      "</div>";

    return article;
  }

  // Nessun ordine deciso dal backend (vedi risposta): alfabetico per nome,
  // così l'elenco non dipende dall'ordine di creazione né cambia da sé a
  // ogni ricarica.
  function ordinaPerNome(talenti) {
    return talenti.slice().sort(function (a, b) {
      return (a.nome || "").localeCompare(b.nome || "", "it");
    });
  }

  window.trameFetch("/api/talenti")
    .then(function (talenti) {
      talenti = ordinaPerNome(talenti || []);
      if (!talenti.length) {
        vuoto.hidden = false;
        grid.hidden = true;
        return;
      }
      grid.innerHTML = "";
      talenti.forEach(function (talento) {
        grid.appendChild(renderCard(talento));
      });
      grid.hidden = false;
      vuoto.hidden = true;
    })
    .catch(function () {
      // API non raggiungibile: resta il fallback "i primi fili arrivano
      // presto", già visibile di default nell'HTML — nessuna azione da fare.
    });
})();
