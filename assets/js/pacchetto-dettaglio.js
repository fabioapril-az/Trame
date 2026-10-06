// Pagina dettaglio di un pacchetto (pacchetto.html?id=ID) — un evento a più
// date collegate. Stessi helper di formattazione di evento-dettaglio.js,
// duplicati qui per lo stesso motivo (nessun build step / bundler).

(function () {
  function formattaData(isoDate) {
    if (!isoDate) return "Data da definire";
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

  // "11 e 18 ottobre 2026": stesso mese/anno scritti una sola volta se
  // coincidono (il caso comune), altrimenti ogni data per intero.
  function formattaDateMultiple(dates) {
    var MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
      "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
    var parsed = dates.map(function (iso) {
      if (!iso) return null;
      var p = iso.split("-");
      return { giorno: parseInt(p[2], 10), mese: parseInt(p[1], 10) - 1, anno: p[0] };
    });
    if (parsed.some(function (d) { return !d; })) {
      return "Date da definire";
    }
    var stessoMeseAnno = parsed.every(function (d) { return d.mese === parsed[0].mese && d.anno === parsed[0].anno; });
    if (stessoMeseAnno) {
      var giorni = parsed.map(function (d) { return d.giorno; }).join(" e ");
      return giorni + " " + MESI[parsed[0].mese] + " " + parsed[0].anno;
    }
    return parsed.map(function (d) { return d.giorno + " " + MESI[d.mese] + " " + d.anno; }).join(" e ");
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
    var loadingEl = document.getElementById("pacchetto-loading");
    var erroreEl = document.getElementById("pacchetto-errore");
    var erroreIconaEl = document.getElementById("pacchetto-errore-icona");
    var erroreTitoloEl = document.getElementById("pacchetto-errore-titolo");
    var erroreMsgEl = document.getElementById("pacchetto-errore-msg");
    var contentEl = document.getElementById("pacchetto-content");

    // titolo/icona facoltativi: di default lo stesso messaggio "evento non
    // trovato" di sempre, riusato anche per "dettagli non ancora attivi"
    // passando un titolo/icona diversi — stesso schema di evento.html.
    function mostraErrore(messaggio, titolo, icona) {
      loadingEl.hidden = true;
      contentEl.hidden = true;
      erroreEl.hidden = false;
      erroreIconaEl.textContent = icona || "🔍";
      erroreTitoloEl.textContent = titolo || "Evento non trovato";
      if (messaggio) {
        erroreMsgEl.textContent = messaggio;
      }
    }

    if (!id) {
      mostraErrore("Manca l'identificativo dell'evento nel link.");
      return;
    }

    window.trameFetch("/api/pacchetti-eventi/" + encodeURIComponent(id))
      .then(function (pacchetto) {
        // Interruttore manuale, stesso principio di evento.html: il
        // pacchetto esiste (l'API l'ha trovato) ma i dettagli non sono
        // ancora pronti — niente contenuto reale nemmeno con il link diretto.
        if (pacchetto.dettagliAttivi === false) {
          mostraErrore("Prova a tornare più avanti, oppure scrivici per saperne di più.", "Dettagli in arrivo", "🕒");
          return;
        }

        loadingEl.hidden = true;
        contentEl.hidden = false;
        document.title = pacchetto.nome + " — Progetto TraMe";

        var sottoEventi = pacchetto.sottoEventi || [];

        var immagineEl = document.getElementById("pacchetto-immagine");
        var mediaIconEl = document.getElementById("pacchetto-media-icon");
        if (pacchetto.immagineUrl) {
          immagineEl.src = pacchetto.immagineUrl;
          immagineEl.hidden = false;
        } else {
          mediaIconEl.hidden = false;
        }

        document.getElementById("pacchetto-badge-date").textContent = sottoEventi.length + " date";
        document.getElementById("pacchetto-titolo").textContent = pacchetto.nome;

        var dateTesto = formattaDateMultiple(sottoEventi.map(function (ev) { return ev.dataEvento; }));
        var luoghi = sottoEventi.map(function (ev) { return ev.luogo; }).filter(Boolean);
        // Luogo mostrato solo se uguale per tutte le date (il caso comune):
        // con luoghi diversi non ha senso un'unica riga di meta, si lascia
        // solo alla pagina di iscrizione il dettaglio data per data.
        var stessoLuogo = luoghi.length === sottoEventi.length && luoghi.every(function (l) { return l === luoghi[0]; });
        var metaParts = ["🗓️ " + dateTesto];
        if (stessoLuogo && luoghi[0]) {
          metaParts.push("📍 " + luoghi[0]);
        }
        document.getElementById("pacchetto-meta").textContent = metaParts.join("    ");

        // testoDettaglio: testo esteso pensato apposta per questa pagina,
        // facoltativo — finché non è compilato si mostra la descrizione
        // breve (quella della card), stesso principio di evento.html.
        var descEl = document.getElementById("pacchetto-descrizione");
        descEl.innerHTML = formattaTestoRicco(pacchetto.testoDettaglio || pacchetto.descrizione || "");
        normalizzaListeQuill(descEl);

        // Teaser di prezzo: il minimo tra le singole date, per dare un'idea
        // senza anticipare il calcolo esatto (sconto socio + sconto
        // pacchetto), che si vede solo nella pagina di iscrizione.
        var prezziSingoli = sottoEventi.map(function (ev) { return ev.prezzoSingolo; }).filter(function (p) { return p != null; });
        if (prezziSingoli.length) {
          var minimo = Math.min.apply(null, prezziSingoli);
          document.getElementById("pacchetto-prezzo").textContent = "da " + formattaPrezzo(minimo);
        }

        var prenotaEl = document.getElementById("pacchetto-prenota");
        var tutteEsaurite = sottoEventi.length > 0 && sottoEventi.every(function (ev) {
          return ev.postiDisponibili != null && ev.postiDisponibili <= 0;
        });
        if (pacchetto.stato === "annunciato") {
          disabilitaBottone(prenotaEl, "In arrivo");
        } else if (pacchetto.stato !== "aperto") {
          disabilitaBottone(prenotaEl, "Iscrizioni chiuse");
        } else if (tutteEsaurite) {
          disabilitaBottone(prenotaEl, "Posti esauriti");
        } else {
          prenotaEl.href = "iscrizione-pacchetto.html?id=" + pacchetto.id;
        }
      })
      .catch(function (err) {
        mostraErrore(err && err.message);
      });
  });
})();
