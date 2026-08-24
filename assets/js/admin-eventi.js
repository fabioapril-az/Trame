// Gestione eventi (admin.html, sezione "Eventi"). Login separato dal ruolo
// SWA "editor" usato per il resto della pagina (Impostazioni): qui serve un
// ruolo Azure AD App Roles (Presidente/Admin) sulla stessa App Registration
// "Trame Backoffice" usata dal Libro Soci — verificato dall'API .NET a ogni
// chiamata, questa pagina si limita a nascondere/mostrare l'interfaccia e a
// mostrare gli errori che l'API restituisce (403 compreso).

(function () {
  var stato = { eventoCorrenteId: null };

  var authGateNote = document.getElementById("eventi-auth-gate-note");
  var areaRiservata = document.getElementById("eventi-area-riservata");
  var userLabel = document.getElementById("eventi-auth-user-label");
  var btnLogin = document.getElementById("eventi-btn-login");
  var btnLogout = document.getElementById("eventi-btn-logout");

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
