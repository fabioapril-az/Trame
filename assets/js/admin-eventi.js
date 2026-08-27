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

  // Il form "Nuovo evento" resta nascosto finché non serve (segnalato
  // dall'utente: prima stava sempre espanso sopra la tabella) — il
  // pulsante vive nella toolbar di "Tutti gli eventi", accanto ad
  // "Aggiorna elenco".
  document.getElementById("btn-mostra-nuovo-evento").addEventListener("click", function () {
    var pannello = document.getElementById("pannello-nuovo-evento");
    pannello.hidden = !pannello.hidden;
    if (!pannello.hidden) {
      pannello.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  document.getElementById("btn-annulla-nuovo-evento").addEventListener("click", function () {
    document.getElementById("pannello-nuovo-evento").hidden = true;
  });

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
      ora: document.getElementById(prefix + "ora").value || null,
      luogo: document.getElementById(prefix + "luogo").value.trim() || null,
      categoria: document.getElementById(prefix + "categoria").value || null,
      quotaEvento: quota ? parseFloat(quota) : null,
      quotaIscrizioneInclusa: quotaIscrizione ? parseFloat(quotaIscrizione) : null,
      postiMax: posti ? parseInt(posti, 10) : null,
      scadenzaIscrizione: document.getElementById(prefix + "scadenza-iscrizione").value || null,
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
            "<td>" + formattaData(ev.dataEvento) + (ev.ora ? " · " + escapeHtml(ev.ora) : "") + "</td>" +
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
    document.getElementById("mod-ev-ora").value = evento.ora || "";
    document.getElementById("mod-ev-luogo").value = evento.luogo || "";
    document.getElementById("mod-ev-categoria").value = evento.categoria || "";
    document.getElementById("mod-ev-quota").value = evento.quotaEvento || "";
    document.getElementById("mod-ev-quota-iscrizione").value = evento.quotaIscrizioneInclusa || "";
    document.getElementById("mod-ev-posti").value = evento.postiMax || "";
    document.getElementById("mod-ev-scadenza-iscrizione").value = evento.scadenzaIscrizione || "";
    document.getElementById("mod-ev-aperto-non-soci").checked = Boolean(evento.apertoNonSoci);
    document.getElementById("mod-ev-stato").value = evento.stato;
    document.getElementById("evento-posti-info").textContent = evento.postiMax
      ? "Posti disponibili: " + evento.postiDisponibili + " / " + evento.postiMax
      : "Nessun limite di posti impostato.";
    aggiornaAnteprimaImmagine(evento.immagineUrl);
    document.getElementById("mod-ev-immagine-file").value = "";
    document.getElementById("immagine-evento-status").hidden = true;
    document.getElementById("evento-dettaglio").hidden = false;
    document.getElementById("evento-dettaglio").scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("iscritti-tabella").hidden = true;
    document.getElementById("modifica-evento-status").hidden = true;
  }

  function aggiornaAnteprimaImmagine(url) {
    var img = document.getElementById("mod-ev-immagine-anteprima");
    if (url) {
      img.src = url;
      img.hidden = false;
    } else {
      img.hidden = true;
      img.removeAttribute("src");
    }
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

  // Ridimensiona/comprime l'immagine lato client prima dell'invio (lato
  // massimo ~1600px, JPEG qualità ~80%): una foto da telefono può pesare
  // diversi MB a piena risoluzione, così si evitano sia upload lenti sia
  // pagine pubbliche pesanti, senza bisogno di elaborazione lato server
  // (coordinato con la sessione sul sito pubblico).
  function ridimensionaImmagine(file, latoMassimo, qualita) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scala = Math.min(1, latoMassimo / Math.max(img.width, img.height));
        var larghezza = Math.round(img.width * scala);
        var altezza = Math.round(img.height * scala);
        var canvas = document.createElement("canvas");
        canvas.width = larghezza;
        canvas.height = altezza;
        canvas.getContext("2d").drawImage(img, 0, 0, larghezza, altezza);
        canvas.toBlob(function (blob) {
          if (!blob) {
            reject(new Error("Impossibile elaborare l'immagine."));
            return;
          }
          resolve(blob);
        }, "image/jpeg", qualita);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("File immagine non valido."));
      };
      img.src = url;
    });
  }

  document.getElementById("btn-carica-immagine").addEventListener("click", function () {
    var input = document.getElementById("mod-ev-immagine-file");
    var status = document.getElementById("immagine-evento-status");
    status.hidden = true;
    if (!input.files || !input.files[0]) {
      mostraMessaggio(status, "Seleziona prima un file immagine.", true);
      return;
    }

    ridimensionaImmagine(input.files[0], 1600, 0.8)
      .then(function (blob) {
        var formData = new FormData();
        formData.append("file", blob, "evento.jpg");
        return apiFetchAuth("/api/eventi/" + stato.eventoCorrenteId + "/immagine", {
          method: "POST",
          body: formData
        });
      })
      .then(function (evento) {
        mostraMessaggio(status, "Immagine caricata.", false);
        aggiornaAnteprimaImmagine(evento.immagineUrl);
        caricaEventi();
      })
      .catch(function (err) { mostraMessaggio(status, err.message, true); });
  });

  document.getElementById("btn-rimuovi-immagine").addEventListener("click", function () {
    var status = document.getElementById("immagine-evento-status");
    apiFetchAuth("/api/eventi/" + stato.eventoCorrenteId + "/immagine", { method: "DELETE" })
      .then(function (evento) {
        mostraMessaggio(status, "Immagine rimossa.", false);
        aggiornaAnteprimaImmagine(evento.immagineUrl);
        document.getElementById("mod-ev-immagine-file").value = "";
        caricaEventi();
      })
      .catch(function (err) { mostraMessaggio(status, err.message, true); });
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
