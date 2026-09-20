// Vista unificata di tutti i pagamenti (eventi + tessere/rinnovi), pensata
// per non dover più aprire "Vedi iscritti" evento per evento (segnalato
// dall'utente come amministrativamente scomodo). Login MSAL condiviso con
// admin.html/admin-soci.html: qui basta il ruolo VistaSoci (Segretario/
// Presidente/Vicepresidente-Tesoriere/Admin), verificato dall'API a ogni
// chiamata — questa pagina non decide da sola chi può fare cosa.

(function () {
  var DIMENSIONE_PAGINA = 10;
  var stato = { pagina: 1, totale: 0 };

  var authGateNote = document.getElementById("auth-gate-note");
  var areaRiservata = document.getElementById("area-riservata");
  var userLabel = document.getElementById("auth-user-label");
  var btnLogin = document.getElementById("btn-login");
  var btnLogout = document.getElementById("btn-logout");

  function apiFetchAuth(path, options) {
    options = options || {};
    return window.trameAuth.getToken().then(function (token) {
      options.headers = Object.assign({}, options.headers, { Authorization: "Bearer " + token });
      return window.trameFetch(path, options);
    });
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function mostraMessaggio(el, testo, isErrore) {
    el.textContent = testo;
    el.hidden = false;
    el.style.color = isErrore ? "var(--color-terracotta, #b5533c)" : "inherit";
  }

  // --- Autenticazione ---

  function refreshUi() {
    var account = window.trameAuth.getAccount();
    if (!account) {
      authGateNote.hidden = false;
      areaRiservata.hidden = true;
      btnLogin.hidden = false;
      btnLogout.hidden = true;
      userLabel.textContent = "Non collegato";
      return;
    }
    authGateNote.hidden = true;
    areaRiservata.hidden = false;
    btnLogin.hidden = true;
    btnLogout.hidden = false;
    userLabel.textContent = account.name || account.username;
    caricaEventiFiltro();
    cercaPagamenti();
  }

  btnLogin.addEventListener("click", function () {
    window.trameAuth.login().then(refreshUi).catch(function (err) {
      mostraMessaggio(authGateNote, "Accesso non riuscito: " + err.message, true);
    });
  });

  btnLogout.addEventListener("click", function () {
    window.trameAuth.logout().then(function () { window.location.reload(); });
  });

  window.trameAuth.ready.then(refreshUi);

  // --- Filtro Evento: elenco eventi per la dropdown (lista aperta a
  // qualunque utente autenticato, indipendentemente dal ruolo — non serve
  // GestioneEventi, solo essere loggati). ---

  function caricaEventiFiltro() {
    apiFetchAuth("/api/eventi")
      .then(function (eventi) {
        var select = document.getElementById("pag-filtro-evento");
        eventi.forEach(function (ev) {
          var option = document.createElement("option");
          option.value = ev.id;
          option.textContent = ev.titolo;
          select.appendChild(option);
        });
      })
      .catch(function () { /* dropdown resta con solo "Tutti gli eventi": non blocca il resto della pagina */ });
  }

  // --- Elenco pagamenti ---

  var TIPO_LABELS = { evento: "Evento", tessera: "Tessera" };
  var STATO_LABELS = {
    confermata: "Confermata", in_attesa: "In attesa pagamento", annullata: "Annullata",
    rimborso_richiesto: "Rimborso richiesto", rimborsato: "Rimborsato",
    in_attesa_pagamento_manuale: "In attesa pagamento manuale"
  };
  var METODO_PAGAMENTO_LABELS = {
    card: "Carta", paypal: "PayPal", klarna: "Klarna", satispay: "Satispay",
    amazon_pay: "Amazon Pay", link: "Link", apple_pay: "Apple Pay", google_pay: "Google Pay",
    bonifico: "Bonifico", contante: "Contante"
  };

  // Filtri attivi in questo momento, letti una volta sola: li usano sia la
  // ricerca sia l'export CSV, che deve esportare esattamente ciò che l'utente
  // ha davanti — leggerli in due punti diversi è il modo classico per farli
  // divergere.
  function filtriAttivi() {
    return {
      tipo: document.getElementById("pag-filtro-tipo").value,
      eventoId: document.getElementById("pag-filtro-evento").value,
      mese: document.getElementById("pag-filtro-mese").value,
      anno: document.getElementById("pag-filtro-anno").value,
    };
  }

  function queryFiltri(filtri) {
    var query = "";
    if (filtri.tipo) query += "&tipo=" + encodeURIComponent(filtri.tipo);
    if (filtri.eventoId) query += "&eventoId=" + encodeURIComponent(filtri.eventoId);
    if (filtri.mese) query += "&mese=" + encodeURIComponent(filtri.mese);
    if (filtri.anno) query += "&anno=" + encodeURIComponent(filtri.anno);
    return query;
  }

  function cercaPagamenti() {
    var query = "?pagina=" + stato.pagina + "&dimensionePagina=" + DIMENSIONE_PAGINA + queryFiltri(filtriAttivi());

    apiFetchAuth("/api/pagamenti" + query)
      .then(function (result) {
        stato.totale = result.totale;
        var tbody = document.getElementById("pagamenti-tabella-body");
        tbody.innerHTML = "";
        document.getElementById("pagamenti-empty").hidden = result.risultati.length > 0;

        result.risultati.forEach(function (p) {
          var nomeCompleto = (p.nome || p.cognome) ? ((p.nome || "") + " " + (p.cognome || "")).trim() : "—";
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + escapeHtml(TIPO_LABELS[p.tipo] || p.tipo) + "</td>" +
            "<td>" + escapeHtml(p.riferimento) + "</td>" +
            "<td>" + escapeHtml(nomeCompleto) + "</td>" +
            "<td>" + escapeHtml(p.email) + "</td>" +
            "<td>" + (p.numeroPersone || 1) + "</td>" +
            "<td>" + escapeHtml(p.opzionePartecipazioneNome || "—") + "</td>" +
            "<td>" + escapeHtml(STATO_LABELS[p.stato] || p.stato) + "</td>" +
            "<td>" + (p.importoPagato != null ? p.importoPagato + " €" : "—") + "</td>" +
            "<td>" + escapeHtml(METODO_PAGAMENTO_LABELS[p.metodoPagamento] || p.metodoPagamento || "—") + "</td>" +
            "<td>" + escapeHtml(p.allergieNote || "—") + "</td>" +
            "<td>" + escapeHtml(p.data || "—") + "</td>";
          tbody.appendChild(tr);
        });

        var totalePagine = Math.max(1, Math.ceil(stato.totale / DIMENSIONE_PAGINA));
        document.getElementById("pagamenti-pagina-label").textContent =
          "Pagina " + stato.pagina + " di " + totalePagine + " (" + stato.totale + " pagamenti)";
        document.getElementById("btn-pagina-prec").disabled = stato.pagina <= 1;
        document.getElementById("btn-pagina-succ").disabled = stato.pagina >= totalePagine;
      })
      .catch(function (err) { window.alert(err.message); });
  }

  // --- Export CSV ---
  //
  // Esporta TUTTE le righe che corrispondono ai filtri attivi, non solo la
  // pagina da 10 a schermo: un export che si fermasse alla pagina visibile
  // sarebbe una trappola, perché somiglia a un export completo.

  // 200 è il massimo accettato dall'API. Attenzione, confermato dal backend:
  // NON è un clamp — chiedere più di 200 non riporta a 200, fa cadere su 20.
  // Quindi questo valore non va alzato senza cambiare anche il server.
  var DIMENSIONE_EXPORT = 200;
  var MAX_PAGINE_EXPORT = 200; // Paracadute: senza, un `totale` incoerente con le righe restituite darebbe un ciclo infinito.

  // Separatore ';' e BOM UTF-8: è ciò che serve a Excel in locale italiano
  // per aprire il file in colonne e mostrare correttamente gli accenti (con
  // ',' e senza BOM finisce tutto in una colonna con i caratteri rotti).
  var CSV_SEPARATORE = ";";

  function campoCsv(valore) {
    var testo = valore == null ? "" : String(valore);
    // Neutralizza l'iniezione di formule: un campo che inizia per = + - @
    // viene interpretato da Excel come formula, e questi campi contengono
    // testo scritto dagli iscritti (nome, email, note allergie).
    if (/^[=+\-@\t\r]/.test(testo)) {
      testo = "'" + testo;
    }
    return '"' + testo.replace(/"/g, '""') + '"';
  }

  // Excel in locale italiano vuole la virgola decimale, altrimenti legge
  // "12.50" come testo e non lo somma.
  function importoCsv(valore) {
    return valore == null ? "" : String(valore).replace(".", ",");
  }

  function dataCsv(valore) {
    if (!valore) return "";
    var iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(valore));
    if (!iso) return String(valore);
    var giorno = iso[3] + "/" + iso[2] + "/" + iso[1];
    return iso[4] ? giorno + " " + iso[4] + ":" + iso[5] : giorno;
  }

  var COLONNE_CSV = [
    { testata: "Tipo", valore: function (p) { return TIPO_LABELS[p.tipo] || p.tipo; } },
    { testata: "Riferimento", valore: function (p) { return p.riferimento; } },
    // Nome e cognome separati (in tabella sono uniti): in un foglio di
    // calcolo servono in due colonne per ordinare e per gli invii.
    { testata: "Nome", valore: function (p) { return p.nome; } },
    { testata: "Cognome", valore: function (p) { return p.cognome; } },
    { testata: "Email", valore: function (p) { return p.email; } },
    { testata: "Persone", valore: function (p) { return p.numeroPersone || 1; } },
    { testata: "Modalita", valore: function (p) { return p.opzionePartecipazioneNome; } },
    { testata: "Stato", valore: function (p) { return STATO_LABELS[p.stato] || p.stato; } },
    // Senza il simbolo €, così la colonna resta sommabile.
    { testata: "Importo", valore: function (p) { return importoCsv(p.importoPagato); }, grezzo: true },
    { testata: "Metodo", valore: function (p) { return METODO_PAGAMENTO_LABELS[p.metodoPagamento] || p.metodoPagamento; } },
    { testata: "Allergie", valore: function (p) { return p.allergieNote; } },
    { testata: "Data", valore: function (p) { return dataCsv(p.data); } },
  ];

  function costruisciCsv(righe) {
    var linee = [COLONNE_CSV.map(function (c) { return campoCsv(c.testata); }).join(CSV_SEPARATORE)];
    righe.forEach(function (p) {
      linee.push(COLONNE_CSV.map(function (c) { return campoCsv(c.valore(p)); }).join(CSV_SEPARATORE));
    });
    return "﻿" + linee.join("\r\n") + "\r\n";
  }

  function nomeFileCsv(filtri) {
    var parti = ["pagamenti"];
    if (filtri.tipo) parti.push(filtri.tipo === "evento" ? "eventi" : "tessere");
    if (filtri.eventoId) {
      var select = document.getElementById("pag-filtro-evento");
      var titolo = select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : "";
      var slug = titolo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      if (slug) parti.push(slug);
    }
    if (filtri.anno) parti.push(filtri.anno);
    if (filtri.mese) parti.push(("0" + filtri.mese).slice(-2));
    var oggi = new Date();
    parti.push("export-" + oggi.getFullYear() + ("0" + (oggi.getMonth() + 1)).slice(-2) + ("0" + oggi.getDate()).slice(-2));
    return parti.join("_") + ".csv";
  }

  // Scarica una pagina dopo l'altra fino a coprire il totale dichiarato
  // dall'API. La dimensione pagina non è data per scontata: si usa quella
  // che il server dichiara di aver applicato (`dimensionePagina` in
  // risposta) e, se non ci fosse, la si deduce dalle righe ricevute. Serve
  // perché se il server riducesse la dimensione senza dirlo e calcolasse
  // l'offset sul valore richiesto, le pagine successive salterebbero righe e
  // l'export perderebbe dati in silenzio.
  //
  // Il presupposto di tutto questo è che la paginazione partizioni davvero
  // le righe. Non era vero: l'endpoint ordinava per data senza chiave
  // univoca, e in produzione esistono iscrizioni con data identica al
  // secondo, quindi la stessa riga poteva comparire su due pagine e un'altra
  // essere saltata. Il backend ha aggiunto un tiebreaker deterministico
  // (segnalato mentre questo export veniva scritto). Il controllo finale sul
  // conteggio resta comunque, come rete.
  function scaricaTuttePagine(filtri, onProgresso) {
    var righe = [];
    var coda = queryFiltri(filtri);

    function pagina(numero, dimensione) {
      return apiFetchAuth("/api/pagamenti?pagina=" + numero + "&dimensionePagina=" + dimensione + coda)
        .then(function (result) {
          var ricevute = result.risultati || [];
          righe = righe.concat(ricevute);
          var totale = result.totale || 0;
          if (onProgresso) onProgresso(righe.length, totale);

          var dimensioneReale = result.dimensionePagina > 0
            ? result.dimensionePagina
            : (numero === 1 && ricevute.length && ricevute.length < dimensione ? ricevute.length : dimensione);

          if (!ricevute.length || righe.length >= totale || numero >= MAX_PAGINE_EXPORT) {
            return { righe: righe, totale: totale, completo: righe.length >= totale };
          }
          return pagina(numero + 1, dimensioneReale);
        });
    }

    return pagina(1, DIMENSIONE_EXPORT);
  }

  var btnExport = document.getElementById("btn-esporta-csv");
  var exportStatus = document.getElementById("export-status");

  btnExport.addEventListener("click", function () {
    var filtri = filtriAttivi();
    btnExport.disabled = true;
    mostraMessaggio(exportStatus, "Preparazione export…", false);

    scaricaTuttePagine(filtri, function (fatte, totale) {
      mostraMessaggio(exportStatus, "Lettura pagamenti: " + fatte + " di " + totale + "…", false);
    })
      .then(function (esito) {
        if (!esito.righe.length) {
          mostraMessaggio(exportStatus, "Nessun pagamento da esportare per questi filtri.", true);
          return;
        }

        var blob = new Blob([costruisciCsv(esito.righe)], { type: "text/csv;charset=utf-8;" });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.href = url;
        link.download = nomeFileCsv(filtri);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Se il conteggio non torna lo diciamo invece di tacere: meglio un
        // export dichiarato incompleto che un file che sembra completo.
        mostraMessaggio(
          exportStatus,
          esito.completo
            ? "Esportati " + esito.righe.length + " pagamenti con i filtri attivi."
            : "Attenzione: esportate " + esito.righe.length + " righe su " + esito.totale + " dichiarate dall'API. Export incompleto.",
          !esito.completo
        );
      })
      .catch(function (err) {
        mostraMessaggio(exportStatus, "Export non riuscito: " + err.message, true);
      })
      .then(function () { btnExport.disabled = false; });
  });

  document.getElementById("btn-cerca-pagamenti").addEventListener("click", function () {
    stato.pagina = 1;
    cercaPagamenti();
  });
  document.getElementById("btn-reset-pagamenti").addEventListener("click", function () {
    document.getElementById("pag-filtro-tipo").value = "";
    document.getElementById("pag-filtro-evento").value = "";
    document.getElementById("pag-filtro-mese").value = "";
    document.getElementById("pag-filtro-anno").value = "";
    stato.pagina = 1;
    cercaPagamenti();
  });
  document.getElementById("btn-pagina-prec").addEventListener("click", function () { stato.pagina--; cercaPagamenti(); });
  document.getElementById("btn-pagina-succ").addEventListener("click", function () { stato.pagina++; cercaPagamenti(); });
})();
