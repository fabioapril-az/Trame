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

  // Dall'editor Quill di admin.html "Descrizione" arriva come HTML
  // (grassetto/corsivo/colore/liste/immagini inline, es. il logo
  // dell'attività della persona) — stesso pattern/stessa ragione di
  // events.js, duplicato qui per la stessa ragione (nessun modulo condiviso
  // in questo sito). Un talento creato prima dell'editor (nessuno ancora in
  // produzione, ma per coerenza) avrebbe testo semplice: si distingue
  // cercando un tag HTML nel valore.
  var TAG_HTML = /<[a-z][\s\S]*>/i;

  function contieneHtml(testo) {
    return TAG_HTML.test(testo);
  }

  function sanitizza(html) {
    if (!window.DOMPurify) {
      var div = document.createElement("div");
      div.innerHTML = html;
      return escapeHtml(div.textContent);
    }
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "span", "ol", "ul", "li", "a", "img"],
      ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "style", "class", "data-list"],
    });
  }

  // Quill genera sempre <ol> per gli elenchi, puntati compresi (distinti da
  // data-list="bullet"/"ordered" su ogni <li>): converte in un vero <ul>
  // quando serve, così basta il CSS normale del sito — stesso helper di
  // events.js.
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

  function formattaDescrizione(testo) {
    if (contieneHtml(testo)) {
      return sanitizza(testo);
    }
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

    var descEl = article.querySelector(".event-card__desc");
    if (descEl) {
      normalizzaListeQuill(descEl);
    }

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
