// Pagina dettaglio di un singolo evento (evento.html?id=ID).
// Stessi helper di categoria/formattazione di events.js, duplicati qui
// invece di condivisi: il sito non ha un build step / bundler, e sono
// poche righe — coerente con il resto del progetto (stessa scelta già
// fatta per CATEGORY_LABELS tra events.js e admin.js).

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

  function formattaData(isoDate) {
    var parti = isoDate.split("-");
    return parti[2] + "/" + parti[1] + "/" + parti[0];
  }

  function formattaPrezzo(valore) {
    return Number(valore).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  // Dall'editor di formattazione in admin (Quill) testoDettaglio/descrizione
  // arrivano come HTML, ma gli eventi creati prima che l'editor esistesse
  // hanno ancora testo semplice con eventuali "\n" come separatori di
  // paragrafo — le due situazioni si distinguono cercando un tag HTML nel
  // valore. Duplicato da events.js, non condiviso: stessa scelta già fatta
  // per gli altri helper di questo file.
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
      ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "style", "class"],
    });
  }

  function formattaTestoRicco(testo) {
    if (contieneHtml(testo)) {
      return sanitizza(testo);
    }
    return testo
      .split(/\n+/)
      .map(function (paragrafo) { return paragrafo.trim(); })
      .filter(Boolean)
      .map(function (paragrafo) { return "<p>" + escapeHtml(paragrafo) + "</p>"; })
      .join("");
  }

  function disabilitaBottone(el, testo) {
    el.textContent = testo;
    el.classList.remove("btn--primary");
    el.classList.add("btn--outline");
    el.setAttribute("aria-disabled", "true");
    el.style.pointerEvents = "none";
    el.style.opacity = "0.6";
    el.removeAttribute("href");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var id = new URLSearchParams(window.location.search).get("id");
    var loadingEl = document.getElementById("evento-loading");
    var erroreEl = document.getElementById("evento-errore");
    var erroreMsgEl = document.getElementById("evento-errore-msg");
    var contentEl = document.getElementById("evento-content");

    function mostraErrore(messaggio) {
      loadingEl.hidden = true;
      contentEl.hidden = true;
      erroreEl.hidden = false;
      if (messaggio) {
        erroreMsgEl.textContent = messaggio;
      }
    }

    if (!id) {
      mostraErrore("Manca l'identificativo dell'evento nel link.");
      return;
    }

    window.trameFetch("/api/eventi/" + encodeURIComponent(id))
      .then(function (event) {
        loadingEl.hidden = true;
        contentEl.hidden = false;
        document.title = event.titolo + " — Progetto TraMe";

        var immagineEl = document.getElementById("evento-immagine");
        var mediaIconEl = document.getElementById("evento-media-icon");
        if (event.immagineUrl) {
          immagineEl.src = event.immagineUrl;
          immagineEl.hidden = false;
        } else {
          mediaIconEl.textContent = categoryIcon(event.categoria);
          mediaIconEl.hidden = false;
        }

        document.getElementById("evento-badge").textContent = categoryLabel(event.categoria);
        document.getElementById("evento-categoria-label").textContent = categoryLabel(event.categoria);
        document.getElementById("evento-titolo").textContent = event.titolo;

        var metaParts = ["🗓️ " + formattaData(event.dataEvento) + (event.ora ? " · " + event.ora : "")];
        if (event.luogo) {
          metaParts.push("📍 " + event.luogo);
        }
        document.getElementById("evento-meta").textContent = metaParts.join("    ");

        if (event.scadenzaIscrizione) {
          var scadenzaEl = document.getElementById("evento-scadenza");
          scadenzaEl.textContent = "Prenotazioni entro il " + formattaData(event.scadenzaIscrizione);
          scadenzaEl.hidden = false;
        }

        if (!event.apertoNonSoci) {
          document.getElementById("evento-riservato").hidden = false;
        }

        // testoDettaglio: testo esteso pensato apposta per questa pagina,
        // facoltativo — finché non è compilato si mostra la descrizione
        // breve (la stessa usata sulla card) così un evento creato prima
        // dell'aggiunta di questo campo non resta senza testo.
        var descEl = document.getElementById("evento-descrizione");
        descEl.innerHTML = formattaTestoRicco(event.testoDettaglio || event.descrizione || "");

        var socialEl = document.getElementById("evento-social");
        var igEl = document.getElementById("evento-instagram");
        var fbEl = document.getElementById("evento-facebook");
        var galleriaEl = document.getElementById("evento-galleria");
        var haSocial = false;
        if (event.instagramUrl) {
          igEl.href = event.instagramUrl;
          igEl.hidden = false;
          haSocial = true;
        }
        if (event.facebookUrl) {
          fbEl.href = event.facebookUrl;
          fbEl.hidden = false;
          haSocial = true;
        }
        if (event.galleryUrl) {
          galleriaEl.href = event.galleryUrl;
          galleriaEl.hidden = false;
          haSocial = true;
        }
        if (haSocial) {
          socialEl.hidden = false;
        }

        if (event.quotaEvento) {
          document.getElementById("evento-prezzo").textContent = formattaPrezzo(event.quotaEvento);
        }

        var prenotaEl = document.getElementById("evento-prenota");
        var postiEsauriti = event.postiDisponibili != null && event.postiDisponibili <= 0;
        if (event.stato !== "aperto") {
          disabilitaBottone(prenotaEl, "Iscrizioni chiuse");
        } else if (postiEsauriti) {
          disabilitaBottone(prenotaEl, "Posti esauriti");
        } else {
          prenotaEl.href = "iscrizione-evento.html?id=" + event.id;
        }
      })
      .catch(function (err) {
        mostraErrore(err && err.message);
      });
  });
})();
