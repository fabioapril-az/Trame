// Gestione eventi (admin.html, sezione "Eventi"). Login condiviso con il
// resto della pagina (Impostazioni) — vedi admin-auth.js per il widget di
// login/logout e la visibilità della sezione riservata: qui ci si limita a
// caricare i dati quando arriva "trame:auth-ready" e a mostrare gli errori
// che l'API restituisce (403 compreso). Serve comunque un ruolo Azure AD
// App Roles (Presidente/Admin) sulla App Registration "Trame Backoffice"
// usata anche dal Libro Soci, verificato dall'API .NET a ogni chiamata.

(function () {
  var stato = { eventoCorrenteId: null };

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

  window.addEventListener("trame:auth-ready", caricaEventi);

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
      stato: document.getElementById(prefix + "stato").value,
      apertoNonSoci: document.getElementById(prefix + "aperto-non-soci").checked
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
            '<td>' +
            '<button type="button" class="btn btn--outline btn--small" data-action="modifica">Modifica</button> ' +
            '<button type="button" class="btn btn--outline btn--small" data-action="iscritti">Iscritti</button> ' +
            '<button type="button" class="btn btn--outline btn--small" data-action="elimina">Elimina</button>' +
            '</td>';
          tr.querySelector('[data-action="modifica"]').addEventListener("click", function () { apriModificaEvento(ev); });
          tr.querySelector('[data-action="iscritti"]').addEventListener("click", function () { mostraIscrittiDiretti(ev); });
          tr.querySelector('[data-action="elimina"]').addEventListener("click", function () { eliminaEvento(ev); });
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
    document.getElementById("mod-ev-aperto-non-soci").checked = Boolean(evento.apertoNonSoci);
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

  function caricaIscritti(eventoId) {
    return apiFetchAuth("/api/eventi/" + eventoId + "/iscritti")
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
  }

  document.getElementById("btn-vedi-iscritti").addEventListener("click", function () {
    caricaIscritti(stato.eventoCorrenteId);
  });

  // Scorciatoia dalla riga della tabella eventi: mostra direttamente
  // l'elenco iscritti senza dover prima aprire "Modifica" (segnalato
  // dall'utente come poco raggiungibile).
  function mostraIscrittiDiretti(evento) {
    stato.eventoCorrenteId = evento.id;
    document.getElementById("evento-dettaglio").hidden = true;
    caricaIscritti(evento.id).then(function () {
      document.getElementById("iscritti-tabella").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function eliminaEvento(evento) {
    var messaggio = 'Eliminare definitivamente l\'evento "' + evento.titolo + '"? ' +
      'L\'operazione non è reversibile: se ci sono già iscritti, vengono eliminati anche loro.';
    if (!window.confirm(messaggio)) {
      return;
    }
    apiFetchAuth("/api/eventi/" + evento.id, { method: "DELETE" })
      .then(function () { caricaEventi(); })
      .catch(function (err) { window.alert(err.message); });
  }

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
