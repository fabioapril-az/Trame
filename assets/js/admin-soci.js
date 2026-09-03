// Backoffice Libro Soci + gestione eventi (admin-soci.html). Login separato
// da quello di admin.html (sessione MSAL/App Roles indipendente, anche se
// contro la stessa App Registration): qui serve un ruolo App Roles Azure AD
// sull'App Registration "Trame Backoffice" (segretario/presidente/
// vicepresidente/admin), verificato dall'API stessa a ogni chiamata — questa
// pagina non decide da sola chi può fare cosa, si limita a nascondere/mostrare
// l'interfaccia e a mostrare gli errori che l'API restituisce (403 compreso).

(function () {
  var DIMENSIONE_PAGINA = 20;
  var stato = {
    pagina: 1,
    totale: 0,
    editingSocioId: null,
    rinnovoSocioId: null
  };

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

  function formattaData(isoDate) {
    if (!isoDate) return "—";
    var parti = isoDate.split("-");
    return parti[2] + "/" + parti[1] + "/" + parti[0];
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
    cercaSoci();
    caricaImpostazioniIscrizione();
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

  // --- Libro Soci ---

  var METODO_PAGAMENTO_LABELS = {
    card: "Carta", paypal: "PayPal", klarna: "Klarna", satispay: "Satispay",
    amazon_pay: "Amazon Pay", link: "Link", apple_pay: "Apple Pay", google_pay: "Google Pay"
  };

  function cercaSoci() {
    var ricerca = document.getElementById("soci-ricerca").value.trim();
    var filtroStato = document.getElementById("soci-filtro-stato").value;
    var query = "?pagina=" + stato.pagina + "&dimensionePagina=" + DIMENSIONE_PAGINA;
    if (ricerca) query += "&ricerca=" + encodeURIComponent(ricerca);
    if (filtroStato) query += "&stato=" + encodeURIComponent(filtroStato);

    apiFetchAuth("/api/soci" + query)
      .then(function (result) {
        stato.totale = result.totale;
        var tbody = document.getElementById("soci-tabella-body");
        tbody.innerHTML = "";
        document.getElementById("soci-empty").hidden = result.risultati.length > 0;

        result.risultati.forEach(function (s) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + escapeHtml(s.nome) + " " + escapeHtml(s.cognome) + "</td>" +
            "<td>" + escapeHtml(s.email) + "</td>" +
            "<td>" + escapeHtml(s.telefono || "—") + "</td>" +
            "<td>" + escapeHtml(s.numeroTessera) + "</td>" +
            "<td>" + formattaData(s.dataScadenza) + "</td>" +
            '<td><span class="status-badge status-badge--' + escapeHtml(s.stato) + '">' + escapeHtml(s.stato) + "</span></td>" +
            "<td>" + escapeHtml(METODO_PAGAMENTO_LABELS[s.metodoPagamento] || s.metodoPagamento || "—") + "</td>" +
            '<td><button type="button" class="btn btn--outline btn--small" data-action="modifica">Modifica</button> ' +
            '<button type="button" class="btn btn--outline btn--small" data-action="rinnova">Rinnova</button> ' +
            '<button type="button" class="btn btn--outline btn--small" data-action="tessera">Scarica tessera</button> ' +
            '<button type="button" class="btn btn--outline btn--small" data-action="storico">Storico</button> ' +
            (s.metodoPagamento ? '<button type="button" class="btn btn--outline btn--small" data-action="rimborsa">Segna come rimborsato</button> ' : "") +
            '<button type="button" class="btn btn--outline btn--small" data-action="elimina">Elimina</button></td>';
          tr.querySelector('[data-action="modifica"]').addEventListener("click", function () { apriModifica(s); });
          tr.querySelector('[data-action="rinnova"]').addEventListener("click", function () { apriRinnovo(s); });
          tr.querySelector('[data-action="tessera"]').addEventListener("click", function () { scaricaTessera(s); });
          tr.querySelector('[data-action="storico"]').addEventListener("click", function () { apriStorico(s); });
          tr.querySelector('[data-action="elimina"]').addEventListener("click", function () { eliminaSocio(s); });
          var btnRimborsa = tr.querySelector('[data-action="rimborsa"]');
          if (btnRimborsa) {
            btnRimborsa.addEventListener("click", function () { segnaSocioRimborsato(s); });
          }
          if (s.stato === "cancellato") {
            tr.querySelector('[data-action="elimina"]').disabled = true;
          }
          tbody.appendChild(tr);
        });

        var totalePagine = Math.max(1, Math.ceil(stato.totale / DIMENSIONE_PAGINA));
        document.getElementById("soci-pagina-label").textContent = "Pagina " + stato.pagina + " di " + totalePagine + " (" + stato.totale + " soci)";
        document.getElementById("btn-pagina-prec").disabled = stato.pagina <= 1;
        document.getElementById("btn-pagina-succ").disabled = stato.pagina >= totalePagine;
      })
      .catch(function (err) { window.alert(err.message); });
  }

  document.getElementById("btn-cerca-soci").addEventListener("click", function () { stato.pagina = 1; cercaSoci(); });
  document.getElementById("btn-pagina-prec").addEventListener("click", function () { stato.pagina--; cercaSoci(); });
  document.getElementById("btn-pagina-succ").addEventListener("click", function () { stato.pagina++; cercaSoci(); });

  function apriModifica(socio) {
    stato.editingSocioId = socio.id;
    document.getElementById("mod-nome").value = socio.nome;
    document.getElementById("mod-cognome").value = socio.cognome;
    document.getElementById("mod-telefono").value = socio.telefono || "";
    document.getElementById("mod-indirizzo").value = "";
    document.getElementById("mod-citta").value = "";
    document.getElementById("mod-cap").value = "";
    document.getElementById("modifica-status").hidden = true;
    document.getElementById("pannello-modifica").hidden = false;
    document.getElementById("pannello-modifica").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("btn-annulla-modifica").addEventListener("click", function () {
    document.getElementById("pannello-modifica").hidden = true;
  });

  // Endpoint pubblico (nessun login richiesto per un socio che scarica la
  // propria tessera): da qui basta un fetch semplice, senza token.
  function scaricaTessera(socio) {
    fetch(window.TRAME_CONFIG.apiBaseUrl + "/api/soci/" + socio.id + "/tessera")
      .then(function (res) {
        if (!res.ok) throw new Error("Download tessera non riuscito (" + res.status + ").");
        return res.blob();
      })
      .then(function (blob) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "tessera-" + socio.numeroTessera + ".pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(function (err) { window.alert(err.message); });
  }

  var AZIONE_LABELS = { creazione: "Creazione", modifica: "Modifica", cancellazione: "Cancellazione" };

  function formattaDettagli(azione, dettagliJson) {
    if (!dettagliJson) {
      return azione === "creazione" ? "Iscrizione registrata" : "—";
    }
    try {
      var diff = JSON.parse(dettagliJson);
      return Object.keys(diff).map(function (campo) {
        var v = diff[campo];
        return campo + ": " + (v.prima || "—") + " → " + (v.dopo || "—");
      }).join("; ");
    } catch (e) {
      return dettagliJson;
    }
  }

  function apriStorico(socio) {
    apiFetchAuth("/api/soci/" + socio.id + "/log")
      .then(function (log) {
        var tbody = document.getElementById("storico-tabella-body");
        tbody.innerHTML = "";
        document.getElementById("storico-empty").hidden = log.length > 0;
        log.forEach(function (voce) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + new Date(voce.dataOra).toLocaleString("it-IT") + "</td>" +
            "<td>" + escapeHtml(AZIONE_LABELS[voce.azione] || voce.azione) + "</td>" +
            "<td>" + escapeHtml(voce.eseguitaDa) + "</td>" +
            "<td>" + escapeHtml(formattaDettagli(voce.azione, voce.dettagli)) + "</td>";
          tbody.appendChild(tr);
        });
        document.getElementById("pannello-storico").hidden = false;
        document.getElementById("pannello-storico").scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(function (err) { window.alert(err.message); });
  }

  document.getElementById("btn-chiudi-storico").addEventListener("click", function () {
    document.getElementById("pannello-storico").hidden = true;
  });

  // Cancellazione soft: l'API imposta stato = 'cancellato' (non un DELETE
  // fisico), tessere/rinnovi/log restano. Da qui in poi rinnovo e iscrizione
  // eventi risultano bloccati (già gestito lato API), il socio resta visibile
  // filtrando per stato "cancellato".
  function eliminaSocio(socio) {
    var conferma = window.confirm(
      "Eliminare " + socio.nome + " " + socio.cognome + "?\n\n" +
      "Il socio verrà segnato come cancellato: non sarà più possibile rinnovarlo " +
      "o iscriverlo a eventi, ma tessera e storico restano consultabili.");
    if (!conferma) return;

    apiFetchAuth("/api/soci/" + socio.id + "/cancella", { method: "POST" })
      .then(function () { cercaSoci(); })
      .catch(function (err) { window.alert(err.message); });
  }

  document.getElementById("btn-salva-modifica").addEventListener("click", function () {
    var payload = {
      nome: document.getElementById("mod-nome").value.trim(),
      cognome: document.getElementById("mod-cognome").value.trim(),
      telefono: document.getElementById("mod-telefono").value.trim() || null,
      indirizzo: document.getElementById("mod-indirizzo").value.trim() || null,
      citta: document.getElementById("mod-citta").value.trim() || null,
      cap: document.getElementById("mod-cap").value.trim() || null
    };
    apiFetchAuth("/api/soci/" + stato.editingSocioId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function () {
        document.getElementById("pannello-modifica").hidden = true;
        cercaSoci();
      })
      .catch(function (err) { mostraMessaggio(document.getElementById("modifica-status"), err.message, true); });
  });

  function apriRinnovo(socio) {
    stato.rinnovoSocioId = socio.id;
    document.getElementById("rin-data").value = new Date().toISOString().slice(0, 10);
    document.getElementById("rin-metodo").value = "";
    document.getElementById("rin-importo").value = "";
    document.getElementById("rin-riferimento").value = "";
    document.getElementById("rinnovo-status").hidden = true;
    document.getElementById("pannello-rinnovo").hidden = false;
    document.getElementById("pannello-rinnovo").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("btn-annulla-rinnovo").addEventListener("click", function () {
    document.getElementById("pannello-rinnovo").hidden = true;
  });

  document.getElementById("btn-salva-rinnovo").addEventListener("click", function () {
    var importoVal = document.getElementById("rin-importo").value;
    var payload = {
      dataRinnovo: document.getElementById("rin-data").value,
      importo: importoVal ? parseFloat(importoVal) : null,
      metodoPagamento: document.getElementById("rin-metodo").value || null,
      riferimentoPagamento: document.getElementById("rin-riferimento").value.trim() || null
    };
    apiFetchAuth("/api/soci/" + stato.rinnovoSocioId + "/rinnova", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function () {
        document.getElementById("pannello-rinnovo").hidden = true;
        cercaSoci();
      })
      .catch(function (err) { mostraMessaggio(document.getElementById("rinnovo-status"), err.message, true); });
  });

  // Il rimborso vero si fa dal Dashboard Stripe: questa azione registra solo
  // che è avvenuto, nessun automatismo (stesso pattern validato in Fase 1).
  // Flag separato dal ciclo di vita della tessera (soci.stato resta
  // attivo/scaduto/decaduto/cancellato): un rimborso non deve confondersi
  // con una cancellazione o una scadenza.
  function segnaSocioRimborsato(socio) {
    if (!window.confirm("Segnare come rimborsata la tessera di " + socio.nome + " " + socio.cognome +
      "? Il rimborso vero va fatto prima dal Dashboard Stripe.")) {
      return;
    }
    apiFetchAuth("/api/soci/" + socio.id + "/rimborsato", { method: "POST" })
      .then(function () { cercaSoci(); })
      .catch(function (err) { window.alert(err.message); });
  }

  document.getElementById("btn-export-csv").addEventListener("click", function () {
    window.trameAuth.getToken().then(function (token) {
      return fetch(window.TRAME_CONFIG.apiBaseUrl + "/api/soci/export-csv", {
        headers: { Authorization: "Bearer " + token }
      });
    }).then(function (res) {
      if (!res.ok) throw new Error("Esportazione non riuscita (" + res.status + ").");
      return res.blob();
    }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "soci.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }).catch(function (err) { window.alert(err.message); });
  });

  // --- Scadenze ---

  document.getElementById("btn-carica-scadenze").addEventListener("click", function () {
    var giorni = document.getElementById("scadenze-giorni").value || 30;
    apiFetchAuth("/api/soci/scadenze?giorni=" + encodeURIComponent(giorni))
      .then(function (lista) {
        var tbody = document.getElementById("scadenze-tabella-body");
        tbody.innerHTML = "";
        document.getElementById("scadenze-empty").hidden = lista.length > 0;
        lista.forEach(function (s) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + escapeHtml(s.nome) + " " + escapeHtml(s.cognome) + "</td>" +
            "<td>" + escapeHtml(s.email) + "</td>" +
            "<td>" + escapeHtml(s.numeroTessera) + "</td>" +
            "<td>" + formattaData(s.dataScadenza) + "</td>";
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) { window.alert(err.message); });
  });

  // --- Iscrizione soci (quota + testo vantaggi, mostrati in
  //     iscrizione-evento.html a chi non è ancora socio) ---
  // Condivide /api/impostazioni con i link social di admin.html: è un PUT
  // che sovrascrive tutti i campi, quindi qui si tengono in cache quelli non
  // editati in questa pagina (instagram/facebook/galleria) per non
  // azzerarli inviando solo quota e testo.
  var impostazioniCorrenti = null;

  function caricaImpostazioniIscrizione() {
    window.trameFetch("/api/impostazioni")
      .then(function (impostazioni) {
        impostazioniCorrenti = impostazioni;
        document.getElementById("is-quota").value = impostazioni.quotaIscrizioneSoci || "";
        document.getElementById("is-vantaggi").value = impostazioni.testoVantaggiIscrizione || "";
        document.getElementById("is-sconto-euro").value = impostazioni.scontoSocioEuro != null ? impostazioni.scontoSocioEuro : "";
        document.getElementById("is-sconto-max-eventi").value = impostazioni.scontoSocioMaxEventi != null ? impostazioni.scontoSocioMaxEventi : "";
      })
      .catch(function () { /* form vuoto: si può comunque compilare da zero */ });
  }

  document.getElementById("iscrizione-soci-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var status = document.getElementById("iscrizione-soci-status");
    status.hidden = true;

    var quota = document.getElementById("is-quota").value;
    var scontoEuro = document.getElementById("is-sconto-euro").value;
    var scontoMaxEventi = document.getElementById("is-sconto-max-eventi").value;
    var payload = Object.assign({}, impostazioniCorrenti, {
      quotaIscrizioneSoci: quota ? parseFloat(quota) : null,
      testoVantaggiIscrizione: document.getElementById("is-vantaggi").value.trim() || null,
      scontoSocioEuro: scontoEuro ? parseFloat(scontoEuro) : null,
      scontoSocioMaxEventi: scontoMaxEventi ? parseInt(scontoMaxEventi, 10) : null
    });

    apiFetchAuth("/api/impostazioni", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (aggiornate) {
        impostazioniCorrenti = aggiornate;
        mostraMessaggio(status, "Salvato.", false);
      })
      .catch(function (err) { mostraMessaggio(status, err.message, true); });
  });
})();
