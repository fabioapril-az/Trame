// Pagina dettaglio di un pacchetto (pacchetto.html?id=ID) — un evento a più
// date collegate. Stessi helper di formattazione di evento-dettaglio.js,
// duplicati qui per lo stesso motivo (nessun build step / bundler).

(function () {
  // Stessa etichetta categoria della card in eventi.html (vedi events.js),
  // duplicata qui per lo stesso motivo degli altri helper di questo file.
  var CATEGORY_LABELS = {
    yoga: "Yoga",
    fotografia: "Fotografia",
    pasticceria: "Pasticceria",
    canto: "Canto",
    ballo: "Ballo",
    teatro: "Teatro",
    disegno: "Disegno",
    "trekking-urbano": "Itinerari urbani",
    viaggi: "Viaggi",
  };

  function categoryLabel(category) {
    return CATEGORY_LABELS[category] || category || "Altro";
  }

  function formattaData(isoDate) {
    if (!isoDate) return "Data da definire";
    var parti = isoDate.split("-");
    return parti[2] + "/" + parti[1] + "/" + parti[0];
  }

  function formattaPrezzo(valore) {
    return Number(valore).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  // Stessa frase/conteggio della card in eventi.html (vedi events.js,
  // notaIscrizioneEvento), qui con "da" davanti al totale: il prezzo di un
  // pacchetto è il minimo tra le date, non un valore singolo.
  function notaIscrizioneHtml(prezzoBase, quotaIscrizioneSoci) {
    var domanda = "<p class=\"event-card__nota-iscrizione\">Non sei ancora socio TraMe? Puoi richiedere l'iscrizione durante la prenotazione.</p>";
    if (prezzoBase == null || quotaIscrizioneSoci == null) {
      return domanda;
    }
    var totale = formattaPrezzo(Number(prezzoBase) + Number(quotaIscrizioneSoci));
    return domanda +
      '<p class="event-card__nota-iscrizione event-card__nota-iscrizione--prezzo">' +
      "<span>Prima partecipazione, inclusa tessera da " + formattaPrezzo(quotaIscrizioneSoci) + "</span>" +
      "<strong>da " + totale + "</strong>" +
      "</p>";
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

  // Il titolo deve restare sempre su massimo 2 righe, visibile per intero
  // (richiesto dall'utente): invece di tagliarlo, riduce il carattere a
  // passi di 1px finché non ci sta, con un minimo sotto il quale non
  // scende. Duplicata da evento-dettaglio.js, stesso motivo degli altri
  // helper di questo file.
  function adattaTitoloA2Righe(el) {
    var fontSize = parseFloat(getComputedStyle(el).fontSize);
    var minFontSize = 18;
    while (fontSize > minFontSize) {
      var lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      if (el.scrollHeight <= lineHeight * 2 + 1) {
        break;
      }
      fontSize -= 1;
      el.style.fontSize = fontSize + "px";
    }
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

    Promise.all([
      window.trameFetch("/api/pacchetti-eventi/" + encodeURIComponent(id)),
      // Quota tessera per il conteggio "prima partecipazione" sotto il
      // prezzo — pubblica, niente di grave se manca: niente conteggio,
      // resta solo la frase (vedi notaIscrizioneHtml).
      window.trameFetch("/api/impostazioni").catch(function () { return null; })
    ])
      .then(function (risultati) {
        var pacchetto = risultati[0];
        var impostazioni = risultati[1];
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
        var titoloEl = document.getElementById("pacchetto-titolo");
        titoloEl.textContent = pacchetto.nome;
        adattaTitoloA2Righe(titoloEl);

        if (pacchetto.sottotitolo) {
          var sottotitoloEl = document.getElementById("pacchetto-sottotitolo");
          sottotitoloEl.textContent = pacchetto.sottotitolo;
          sottotitoloEl.hidden = false;
        }

        var dateTesto = formattaDateMultiple(sottoEventi.map(function (ev) { return ev.dataEvento; }));
        // Ora/luogo mostrati solo se uguali per tutte le date (il caso
        // comune): con valori diversi non ha senso un'unica riga di meta, si
        // lascia solo alla pagina di iscrizione il dettaglio data per data.
        function valoreComune(campo) {
          var valori = sottoEventi.map(function (ev) { return ev[campo]; }).filter(Boolean);
          var comune = valori.length === sottoEventi.length && valori.every(function (v) { return v === valori[0]; });
          return comune ? valori[0] : null;
        }
        var ora = valoreComune("ora");
        var luogo = valoreComune("luogo");
        var categoria = valoreComune("categoria");

        // Eyebrow: categoria (se condivisa da tutte le date) e numero di
        // date insieme, come l'eyebrow della card in eventi.html.
        var eyebrowParts = [];
        if (categoria) { eyebrowParts.push(categoryLabel(categoria)); }
        eyebrowParts.push(sottoEventi.length + " date");
        document.getElementById("pacchetto-categoria-label").textContent = eyebrowParts.join(" · ");

        // Righe separate (data/più date, ora, luogo, nota), stesso ordine e
        // stesse icone della card — non più una riga unica di testo.
        var metaParts = ["<span>🗓️ " + escapeHtml(dateTesto) + "</span>"];
        if (ora) {
          metaParts.push("<span>🕐 " + escapeHtml(ora) + "</span>");
        }
        if (luogo) {
          metaParts.push("<span>📍 " + escapeHtml(luogo) + "</span>");
        }
        if (pacchetto.nota) {
          metaParts.push("<span>📝 " + escapeHtml(pacchetto.nota) + "</span>");
        }
        document.getElementById("pacchetto-meta").innerHTML = metaParts.join("");

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
        var minimo = prezziSingoli.length ? Math.min.apply(null, prezziSingoli) : null;
        if (minimo != null) {
          document.getElementById("pacchetto-prezzo").textContent = "da " + formattaPrezzo(minimo);
          document.getElementById("pacchetto-prezzo-socio").hidden = false;
        }

        var quotaIscrizioneSoci = (impostazioni && impostazioni.quotaIscrizioneSoci) || null;
        document.getElementById("pacchetto-nota-iscrizione").innerHTML =
          notaIscrizioneHtml(minimo, quotaIscrizioneSoci);

        var prenotaEl = document.getElementById("pacchetto-prenota");
        var tutteEsaurite = sottoEventi.length > 0 && sottoEventi.every(function (ev) {
          return ev.postiDisponibili != null && ev.postiDisponibili <= 0;
        });
        if (pacchetto.stato === "annunciato") {
          disabilitaBottone(prenotaEl, "In arrivo");
        } else if (pacchetto.stato !== "aperto") {
          disabilitaBottone(prenotaEl, "Iscrizioni chiuse");
        } else if (tutteEsaurite) {
          var inPagamento = sottoEventi.some(function (ev) { return ev.postiInPagamento > 0; });
          disabilitaBottone(prenotaEl, inPagamento ? "In prenotazione, riprova tra 30 minuti" : "Posti esauriti");
        } else {
          prenotaEl.href = "iscrizione-pacchetto.html?id=" + pacchetto.id;
        }

        // Statistiche: visita al dettaglio e clic sul vero "Prenota".
        if (window.TrameAnalytics) {
          window.TrameAnalytics.visita("pacchetto", pacchetto.id);
          prenotaEl.addEventListener("click", function () {
            if (/^iscrizione-pacchetto\.html/.test(prenotaEl.getAttribute("href") || "")) {
              window.TrameAnalytics.clicPrenota("pacchetto", pacchetto.id, "dettaglio");
            }
          });
        }
      })
      .catch(function (err) {
        mostraErrore(err && err.message);
      });
  });
})();
