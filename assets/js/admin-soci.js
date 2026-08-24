// Backoffice Libro Soci + gestione eventi (admin-soci.html). Login separato
// dal ruolo SWA "editor" di admin.html: qui serve un ruolo App Roles Azure AD
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
    rinnovoSocioId: null,
    eventoCorrenteId: null
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
    caricaEventi();
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
            '<td><button type="button" class="btn btn--outline btn--small" data-action="modifica">Modifica</button> ' +
            '<button type="button" class="btn btn--outline btn--small" data-action="rinnova">Rinnova</button> ' +
            '<button type="button" class="btn btn--outline btn--small" data-action="tessera">Scarica tessera</button> ' +
            '<button type="button" class="btn btn--outline btn--small" data-action="storico">Storico</button></td>';
          tr.querySelector('[data-action="modifica"]').addEventListener("click", function () { apriModifica(s); });
          tr.querySelector('[data-action="rinnova"]').addEventListener("click", function () { apriRinnovo(s); });
          tr.querySelector('[data-action="tessera"]').addEventListener("click", function () { scaricaTessera(s); });
          tr.querySelector('[data-action="storico"]').addEventListener("click", function () { apriStorico(s); });
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

  // --- Eventi ---

  document.getElementById("btn-crea-evento").addEventListener("click", function () {
    var payload = leggiCampiEvento("ev-");
    apiFetchAuth("/api/eventi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function () {
        mostraMessaggio(document.getElementById("crea-evento-status"), "Evento creato.", false);
        caricaEventi();
      })
      .catch(function (err) { mostraMessaggio(document.getElementById("crea-evento-status"), err.message, true); });
  });

  function leggiCampiEvento(prefix) {
    var quota = document.getElementById(prefix + "quota").value;
    var quotaIscrizione = document.getElementById(prefix + "quota-iscrizione").value;
    var posti = document.getElementById(prefix + "posti").value;
    return {
      titolo: document.getElementById(prefix + "titolo").value.trim(),
      descrizione: document.getElementById(prefix + "descrizione").value.trim() || null,
      dataEvento: document.getElementById(prefix + "data").value,
      luogo: document.getElementById(prefix + "luogo").value.trim() || null,
      categoria: document.getElementById(prefix + "categoria").value || null,
      quotaEvento: quota ? parseFloat(quota) : null,
      quotaIscrizioneInclusa: quotaIscrizione ? parseFloat(quotaIscrizione) : null,
      postiMax: posti ? parseInt(posti, 10) : null,
      stato: document.getElementById(prefix + "stato").value
    };
  }

  var STATO_EVENTO_LABELS = { bozza: "Bozza", aperto: "Aperto", chiuso: "Chiuso", annullato: "Annullato" };

  function caricaEventi() {
    var filtroStato = document.getElementById("ev-filtro-stato").value;
    var query = filtroStato ? "?stato=" + encodeURIComponent(filtroStato) : "";
    apiFetchAuth("/api/eventi" + query)
      .then(function (eventi) {
        var tbody = document.getElementById("eventi-tabella-body");
        tbody.innerHTML = "";
        document.getElementById("eventi-empty").hidden = eventi.length > 0;
        eventi.forEach(function (ev) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + escapeHtml(ev.titolo) + "</td>" +
            "<td>" + formattaData(ev.dataEvento) + "</td>" +
            "<td>" + escapeHtml(ev.categoria || "—") + "</td>" +
            '<td><span class="status-badge status-badge--' + escapeHtml(ev.stato) + '">' +
            escapeHtml(STATO_EVENTO_LABELS[ev.stato] || ev.stato) + "</span></td>" +
            "<td>" + (ev.postiMax ? ev.postiDisponibili + " / " + ev.postiMax : "illimitati") + "</td>" +
            '<td><button type="button" class="btn btn--outline btn--small" data-action="modifica">Modifica</button></td>';
          tr.querySelector('[data-action="modifica"]').addEventListener("click", function () { apriModificaEvento(ev); });
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) { window.alert(err.message); });
  }

  document.getElementById("btn-carica-eventi").addEventListener("click", caricaEventi);

  function apriModificaEvento(evento) {
    stato.eventoCorrenteId = evento.id;
    document.getElementById("mod-ev-titolo").value = evento.titolo;
    document.getElementById("mod-ev-descrizione").value = evento.descrizione || "";
    document.getElementById("mod-ev-data").value = evento.dataEvento;
    document.getElementById("mod-ev-luogo").value = evento.luogo || "";
    document.getElementById("mod-ev-categoria").value = evento.categoria || "";
    document.getElementById("mod-ev-quota").value = evento.quotaEvento || "";
    document.getElementById("mod-ev-quota-iscrizione").value = evento.quotaIscrizioneInclusa || "";
    document.getElementById("mod-ev-posti").value = evento.postiMax || "";
    document.getElementById("mod-ev-stato").value = evento.stato;
    document.getElementById("evento-posti-info").textContent = evento.postiMax
      ? "Posti disponibili: " + evento.postiDisponibili + " / " + evento.postiMax
      : "Nessun limite di posti impostato.";
    document.getElementById("evento-dettaglio").hidden = false;
    document.getElementById("evento-dettaglio").scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("iscritti-tabella").hidden = true;
    document.getElementById("modifica-evento-status").hidden = true;
  }

  document.getElementById("btn-salva-evento").addEventListener("click", function () {
    var payload = leggiCampiEvento("mod-ev-");
    apiFetchAuth("/api/eventi/" + stato.eventoCorrenteId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function () {
        mostraMessaggio(document.getElementById("modifica-evento-status"), "Modifiche salvate.", false);
        caricaEventi();
      })
      .catch(function (err) { mostraMessaggio(document.getElementById("modifica-evento-status"), err.message, true); });
  });

  document.getElementById("btn-vedi-iscritti").addEventListener("click", function () {
    apiFetchAuth("/api/eventi/" + stato.eventoCorrenteId + "/iscritti")
      .then(function (iscritti) {
        var tbody = document.getElementById("iscritti-tabella-body");
        tbody.innerHTML = "";
        iscritti.forEach(function (i) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + escapeHtml(i.emailIscrizione) + "</td>" +
            "<td>" + escapeHtml(i.tipoIscrizione) + "</td>" +
            "<td>" + escapeHtml(i.stato) + "</td>" +
            "<td>" + (i.importoPagato != null ? i.importoPagato + " €" : "—") + "</td>" +
            "<td>" + formattaData(i.dataIscrizione) + "</td>" +
            '<td><button type="button" class="btn btn--outline btn--small" data-action="annulla">Annulla</button></td>';
          tr.querySelector('[data-action="annulla"]').addEventListener("click", function () { annullaIscrizione(i.id); });
          tbody.appendChild(tr);
        });
        document.getElementById("iscritti-tabella").hidden = false;
      })
      .catch(function (err) { window.alert(err.message); });
  });

  function annullaIscrizione(iscrizioneId) {
    var vuoleRimborso = window.confirm("Registrare anche una richiesta di rimborso per questa iscrizione?");
    var note = vuoleRimborso ? (window.prompt("Note sul rimborso (facoltativo):") || null) : null;
    apiFetchAuth("/api/eventi/" + stato.eventoCorrenteId + "/annulla-iscrizione?iscrizioneId=" + iscrizioneId, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ richiediRimborso: vuoleRimborso, noteRimborso: note })
    })
      .then(function () { document.getElementById("btn-vedi-iscritti").click(); })
      .catch(function (err) { window.alert(err.message); });
  }
})();
