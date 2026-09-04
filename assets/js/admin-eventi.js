// Gestione eventi (admin.html, sezione "Eventi"). Login condiviso con il
// resto della pagina (Impostazioni) — vedi admin-auth.js per il widget di
// login/logout e la visibilità della sezione riservata: qui ci si limita a
// caricare i dati quando window.trameAuthUiReady si risolve e a mostrare
// gli errori che l'API restituisce (403 compreso). Serve comunque un ruolo
// Azure AD App Roles (Presidente/Admin) sulla App Registration "Trame
// Backoffice" usata anche dal Libro Soci, verificato dall'API .NET a ogni
// chiamata.

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

  // --- Editor rich text (Descrizione/TestoDettaglio) ---
  // Fabio ha scelto un editor di testo libero (Quill) invece di un
  // componente strutturato ad hoc — coordinato con la sessione sul sito
  // pubblico, che sanitizza in lettura (DOMPurify) prima di mostrare
  // l'HTML sulle pagine pubbliche. Qui si sanitizza allo stesso modo
  // quando si ricarica il contenuto per la modifica: un account
  // Presidente/Admin compromesso non deve poter eseguire script anche
  // nel browser di un altro operatore che apre "Modifica evento".
  var TOOLBAR_BASE = [["bold", "italic"], [{ color: [] }], [{ list: "ordered" }, { list: "bullet" }]];
  var TOOLBAR_CON_IMMAGINE = TOOLBAR_BASE.concat([["image"]]);
  var quillEditors = {};

  function inizializzaEditor(id, conImmagine) {
    var quill = new Quill("#" + id + "-editor", {
      theme: "snow",
      modules: { toolbar: conImmagine ? TOOLBAR_CON_IMMAGINE : TOOLBAR_BASE }
    });
    if (conImmagine) {
      registraGestoreImmagineInline(quill);
    }
    quillEditors[id] = quill;
  }

  // Il bottone immagine è disponibile solo negli editor di "Modifica
  // evento" (serve un eventoId per l'endpoint di upload): in "Nuovo
  // evento" la toolbar non lo include affatto.
  inizializzaEditor("ev-descrizione", false);
  inizializzaEditor("ev-testo-dettaglio", false);
  inizializzaEditor("mod-ev-descrizione", true);
  inizializzaEditor("mod-ev-testo-dettaglio", true);

  function contenutoQuill(quill) {
    return quill.getText().trim() === "" ? null : quill.root.innerHTML;
  }

  // Compatibilità con gli eventi creati prima dell'editor rich text: se il
  // valore salvato non contiene già tag HTML, è testo semplice (con
  // eventuali "\n" a separare i paragrafi) — lo si converte invece di
  // mostrarlo appiattito su una riga sola (stesso criterio adottato lato
  // sito pubblico, nessuna migrazione dati).
  function sembraHtml(testo) {
    return /<[a-z][\s\S]*>/i.test(testo);
  }

  function testoSempliceInHtml(testo) {
    return testo.split(/\n{2,}/).map(function (paragrafo) {
      return "<p>" + escapeHtml(paragrafo).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function impostaContenutoQuill(quill, valore) {
    if (!valore) {
      quill.setText("");
      return;
    }
    var html = sembraHtml(valore) ? valore : testoSempliceInHtml(valore);
    quill.root.innerHTML = DOMPurify.sanitize(html);
  }

  function registraGestoreImmagineInline(quill) {
    quill.getModule("toolbar").addHandler("image", function () {
      if (!stato.eventoCorrenteId) {
        window.alert("Salva prima l'evento per poter inserire immagini nel testo.");
        return;
      }
      var input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.onchange = function () {
        if (!input.files || !input.files[0]) return;
        var range = quill.getSelection(true);
        ridimensionaImmagine(input.files[0], 1600, 0.8)
          .then(function (blob) {
            var formData = new FormData();
            formData.append("file", blob, "immagine.jpg");
            return apiFetchAuth("/api/eventi/" + stato.eventoCorrenteId + "/immagini-contenuto", {
              method: "POST",
              body: formData
            });
          })
          .then(function (result) {
            quill.insertEmbed(range.index, "image", result.url, "user");
            quill.setSelection(range.index + 1);
          })
          .catch(function (err) { window.alert(err.message); });
      };
      input.click();
    });
  }

  // Promise, non un evento: si "ricorda" di essersi già risolta anche se il
  // login si completa prima che questo script (ultimo in ordine di
  // caricamento) sia stato eseguito — con un CustomEvent sparato una sola
  // volta, in quel caso l'elenco restava vuoto finché non si premeva
  // manualmente "Aggiorna elenco" (bug reale segnalato dall'utente).
  window.trameAuthUiReady.then(caricaEventi);

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
    if (opzioniEPrezziIncompatibili(payload)) {
      mostraMessaggio(document.getElementById("crea-evento-status"),
        "Non puoi usare insieme \"Modalità di partecipazione\" e i prezzi Singolo/Gruppo/Aperitivo: scegline uno dei due.", true);
      return;
    }
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
    var prezzoSingolo = document.getElementById(prefix + "prezzo-singolo").value;
    var prezzoGruppo = document.getElementById(prefix + "prezzo-gruppo").value;
    var prezzoAperitivo = document.getElementById(prefix + "prezzo-aperitivo").value;
    return {
      titolo: document.getElementById(prefix + "titolo").value.trim(),
      descrizione: contenutoQuill(quillEditors[prefix + "descrizione"]),
      testoDettaglio: contenutoQuill(quillEditors[prefix + "testo-dettaglio"]),
      dataEvento: document.getElementById(prefix + "data").value || null,
      ora: document.getElementById(prefix + "ora").value || null,
      luogo: document.getElementById(prefix + "luogo").value.trim() || null,
      categoria: document.getElementById(prefix + "categoria").value || null,
      quotaEvento: quota ? parseFloat(quota) : null,
      quotaIscrizioneInclusa: quotaIscrizione ? parseFloat(quotaIscrizione) : null,
      postiMax: posti ? parseInt(posti, 10) : null,
      scadenzaIscrizione: document.getElementById(prefix + "scadenza-iscrizione").value || null,
      instagramUrl: document.getElementById(prefix + "instagram").value.trim() || null,
      facebookUrl: document.getElementById(prefix + "facebook").value.trim() || null,
      galleryUrl: document.getElementById(prefix + "galleria").value.trim() || null,
      stato: document.getElementById(prefix + "stato").value,
      apertoNonSoci: document.getElementById(prefix + "aperto-non-soci").checked,
      dettagliAttivi: document.getElementById(prefix + "dettagli-attivi").checked,
      opzioniPartecipazione: leggiOpzioni(prefix + "opzioni-lista"),
      prezzoSingolo: prezzoSingolo ? parseFloat(prezzoSingolo) : null,
      prezzoGruppoPersona: prezzoGruppo ? parseFloat(prezzoGruppo) : null,
      prezzoAperitivoPersona: prezzoAperitivo ? parseFloat(prezzoAperitivo) : null,
      pagamentoOnlineAttivo: document.getElementById(prefix + "pagamento-online-attivo").checked
    };
  }

  // "Modalità di partecipazione" e i 3 prezzi Singolo/Gruppo/Aperitivo sono
  // alternativi (l'API .NET rifiuta con 422 se entrambi sono impostati sullo
  // stesso evento) — controllato qui prima di inviare, per un messaggio
  // chiaro invece del solo errore grezzo del backend.
  function opzioniEPrezziIncompatibili(payload) {
    var haOpzioni = payload.opzioniPartecipazione && payload.opzioniPartecipazione.length > 0;
    var haPrezzi = payload.prezzoSingolo != null || payload.prezzoGruppoPersona != null || payload.prezzoAperitivoPersona != null;
    return haOpzioni && haPrezzi;
  }

  // --- Modalità di partecipazione (facoltative, per evento) ---
  // Prezzo sempre a persona, nessuno sconto di gruppo (deciso con l'utente):
  // un evento senza nessuna modalità definita si comporta esattamente come
  // prima (quota unica, iscrizione-evento.html non mostra alcun selettore).
  function creaRigaOpzione(container, nome, prezzoPersona) {
    var riga = document.createElement("div");
    riga.className = "admin-opzione-riga";
    riga.style.cssText = "display:flex; gap:10px; align-items:center; margin-bottom:8px;";
    riga.innerHTML =
      '<input type="text" placeholder="Nome (es. Evento completo)" class="opzione-nome" style="flex:2;">' +
      '<input type="number" placeholder="Prezzo a persona (€)" min="0" step="0.01" class="opzione-prezzo" style="flex:1;">' +
      '<button type="button" class="btn btn--outline btn--small">Rimuovi</button>';
    riga.querySelector(".opzione-nome").value = nome || "";
    riga.querySelector(".opzione-prezzo").value = prezzoPersona != null ? prezzoPersona : "";
    riga.querySelector("button").addEventListener("click", function () { riga.remove(); });
    container.appendChild(riga);
  }

  function leggiOpzioni(containerId) {
    var righe = document.querySelectorAll("#" + containerId + " .admin-opzione-riga");
    var opzioni = [];
    righe.forEach(function (riga) {
      var nome = riga.querySelector(".opzione-nome").value.trim();
      var prezzo = riga.querySelector(".opzione-prezzo").value;
      // Righe aggiunte ma lasciate incomplete (nome o prezzo mancante)
      // vengono ignorate invece di essere salvate a metà.
      if (nome && prezzo !== "") {
        opzioni.push({ nome: nome, prezzoPersona: parseFloat(prezzo) });
      }
    });
    return opzioni;
  }

  function impostaOpzioni(containerId, opzioni) {
    var container = document.getElementById(containerId);
    container.innerHTML = "";
    (opzioni || []).forEach(function (o) { creaRigaOpzione(container, o.nome, o.prezzoPersona); });
  }

  document.getElementById("ev-opzioni-aggiungi").addEventListener("click", function () {
    creaRigaOpzione(document.getElementById("ev-opzioni-lista"));
  });
  document.getElementById("mod-ev-opzioni-aggiungi").addEventListener("click", function () {
    creaRigaOpzione(document.getElementById("mod-ev-opzioni-lista"));
  });

  var STATO_EVENTO_LABELS = {
    bozza: "Bozza", annunciato: "Annunciato", aperto: "Aperto", chiuso: "Chiuso", annullato: "Annullato"
  };

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
    stato.eventoCorrenteTitolo = evento.titolo;
    document.getElementById("mod-ev-titolo").value = evento.titolo;
    impostaContenutoQuill(quillEditors["mod-ev-descrizione"], evento.descrizione);
    impostaContenutoQuill(quillEditors["mod-ev-testo-dettaglio"], evento.testoDettaglio);
    document.getElementById("mod-ev-data").value = evento.dataEvento;
    document.getElementById("mod-ev-ora").value = evento.ora || "";
    document.getElementById("mod-ev-luogo").value = evento.luogo || "";
    document.getElementById("mod-ev-categoria").value = evento.categoria || "";
    document.getElementById("mod-ev-quota").value = evento.quotaEvento || "";
    document.getElementById("mod-ev-quota-iscrizione").value = evento.quotaIscrizioneInclusa || "";
    document.getElementById("mod-ev-posti").value = evento.postiMax || "";
    document.getElementById("mod-ev-scadenza-iscrizione").value = evento.scadenzaIscrizione || "";
    document.getElementById("mod-ev-instagram").value = evento.instagramUrl || "";
    document.getElementById("mod-ev-facebook").value = evento.facebookUrl || "";
    document.getElementById("mod-ev-galleria").value = evento.galleryUrl || "";
    document.getElementById("mod-ev-aperto-non-soci").checked = Boolean(evento.apertoNonSoci);
    document.getElementById("mod-ev-dettagli-attivi").checked = Boolean(evento.dettagliAttivi);
    impostaOpzioni("mod-ev-opzioni-lista", evento.opzioniPartecipazione);
    document.getElementById("mod-ev-prezzo-singolo").value = evento.prezzoSingolo != null ? evento.prezzoSingolo : "";
    document.getElementById("mod-ev-prezzo-gruppo").value = evento.prezzoGruppoPersona != null ? evento.prezzoGruppoPersona : "";
    document.getElementById("mod-ev-prezzo-aperitivo").value = evento.prezzoAperitivoPersona != null ? evento.prezzoAperitivoPersona : "";
    // Assente sugli eventi creati prima di questo campo: di default attivo,
    // coerente con "prima non esisteva l'alternativa, Stripe era l'unica via".
    document.getElementById("mod-ev-pagamento-online-attivo").checked = evento.pagamentoOnlineAttivo !== false;
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

  // Chiude il pannello "Modifica evento" senza salvare (nessuna richiesta
  // API): segnalato dall'utente come mancante, a differenza del pannello
  // "Nuovo evento" che ha già "Annulla" — stesso comportamento, chiude
  // anche l'elenco iscritti se aperto sotto lo stesso evento.
  document.getElementById("btn-chiudi-evento").addEventListener("click", function () {
    document.getElementById("evento-dettaglio").hidden = true;
    document.getElementById("iscritti-tabella").hidden = true;
  });

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
    if (opzioniEPrezziIncompatibili(payload)) {
      mostraMessaggio(document.getElementById("modifica-evento-status"),
        "Non puoi usare insieme \"Modalità di partecipazione\" e i prezzi Singolo/Gruppo/Aperitivo: scegline uno dei due.", true);
      return;
    }
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

  var STATO_ISCRIZIONE_LABELS = {
    confermata: "Confermata", in_attesa: "In attesa pagamento", annullata: "Annullata",
    rimborso_richiesto: "Rimborso richiesto", rimborsato: "Rimborsato",
    in_attesa_pagamento_manuale: "In attesa pagamento manuale"
  };
  var METODO_PAGAMENTO_LABELS = {
    card: "Carta", paypal: "PayPal", klarna: "Klarna", satispay: "Satispay",
    amazon_pay: "Amazon Pay", link: "Link", apple_pay: "Apple Pay", google_pay: "Google Pay"
  };

  function caricaIscritti(eventoId) {
    return apiFetchAuth("/api/eventi/" + eventoId + "/iscritti")
      .then(function (iscritti) {
        var tbody = document.getElementById("iscritti-tabella-body");
        tbody.innerHTML = "";
        iscritti.forEach(function (i) {
          var tr = document.createElement("tr");
          // nomeIscrizione/cognomeIscrizione: solo per chi si è iscritto al
          // solo evento senza essere socio (il nome di un socio vive già in
          // anagrafica, non viene richiesto di nuovo — vedi iscrizione-evento.js).
          // Eccezione: la riga "aggiunta aperitivo" (persone extra non
          // nominali) ha nomeIscrizione valorizzato dal backend con lo
          // stesso testo di opzionePartecipazioneNome (es. "Aperitivo") solo
          // come placeholder — non è un nome vero, non va mostrato come tale
          // (la Modalità già lo indica).
          var placeholderAperitivo = i.nomeIscrizione && i.nomeIscrizione === i.opzionePartecipazioneNome && !i.cognomeIscrizione;
          var nomeCompleto = (!placeholderAperitivo && (i.nomeIscrizione || i.cognomeIscrizione))
            ? ((i.nomeIscrizione || "") + " " + (i.cognomeIscrizione || "")).trim()
            : null;
          var emailCella = nomeCompleto
            ? escapeHtml(nomeCompleto) + "<br><small>" + escapeHtml(i.emailIscrizione) + "</small>"
            : escapeHtml(i.emailIscrizione);
          tr.innerHTML =
            "<td>" + escapeHtml(stato.eventoCorrenteTitolo || "—") + "</td>" +
            "<td>" + emailCella + "</td>" +
            "<td>" + escapeHtml(i.tipoIscrizione) + "</td>" +
            "<td>" + (i.numeroPersone || 1) + "</td>" +
            "<td>" + escapeHtml(i.opzionePartecipazioneNome || "—") + "</td>" +
            "<td>" + escapeHtml(STATO_ISCRIZIONE_LABELS[i.stato] || i.stato) + "</td>" +
            "<td>" + (i.importoPagato != null ? i.importoPagato + " €" : "—") + "</td>" +
            "<td>" + escapeHtml(METODO_PAGAMENTO_LABELS[i.metodoPagamento] || i.metodoPagamento || "—") + "</td>" +
            "<td>" + escapeHtml(i.allergieNote || "—") + "</td>" +
            "<td>" + formattaData(i.dataIscrizione) + "</td>" +
            '<td><button type="button" class="btn btn--outline btn--small" data-action="annulla">Annulla</button> ' +
            '<button type="button" class="btn btn--outline btn--small" data-action="elimina">Elimina</button>' +
            (i.stato === "confermata"
              ? (i.checkoutEventoId
                // Un solo pagamento Stripe può generare più righe (gruppo,
                // o singolo+aperitivo): il rimborso è unico sul pagamento,
                // quindi va applicato a tutte insieme in un click, non riga
                // per riga (rischio di lasciarne indietro qualcuna).
                ? ' <button type="button" class="btn btn--outline btn--small" data-action="rimborsa-gruppo">Rimborsa gruppo</button>'
                : ' <button type="button" class="btn btn--outline btn--small" data-action="rimborsa">Segna come rimborsato</button>')
              : "") +
            (i.stato === "in_attesa_pagamento_manuale" ? ' <button type="button" class="btn btn--primary btn--small" data-action="conferma-manuale">Conferma pagamento ricevuto</button>' : "") +
            '</td>';
          tr.querySelector('[data-action="annulla"]').addEventListener("click", function () { annullaIscrizione(i.id); });
          tr.querySelector('[data-action="elimina"]').addEventListener("click", function () { eliminaIscrizione(i.id); });
          var btnRimborsa = tr.querySelector('[data-action="rimborsa"]');
          if (btnRimborsa) {
            btnRimborsa.addEventListener("click", function () { segnaIscrizioneRimborsata(i.id); });
          }
          var btnRimborsaGruppo = tr.querySelector('[data-action="rimborsa-gruppo"]');
          if (btnRimborsaGruppo) {
            btnRimborsaGruppo.addEventListener("click", function () { segnaGruppoRimborsato(i.checkoutEventoId); });
          }
          var btnConfermaManuale = tr.querySelector('[data-action="conferma-manuale"]');
          if (btnConfermaManuale) {
            btnConfermaManuale.addEventListener("click", function () { confermaPagamentoManuale(i.id); });
          }
          tbody.appendChild(tr);
        });
        document.getElementById("iscritti-tabella").hidden = false;
      })
      .catch(function (err) { window.alert(err.message); });
  }

  // Il rimborso vero si fa dal Dashboard Stripe (payment_intent_id non
  // mostrato qui ma disponibile lato backend): questa azione registra solo
  // che è avvenuto, nessun automatismo — stesso pattern validato in Fase 1.
  // Usata solo per iscrizioni senza checkoutEventoId (non-Stripe, es. vecchio
  // wizard o pagamento manuale): per quelle Stripe vedi segnaGruppoRimborsato.
  function segnaIscrizioneRimborsata(iscrizioneId) {
    if (!window.confirm("Segnare questa iscrizione come rimborsata? Il rimborso vero va fatto prima dal Dashboard Stripe.")) {
      return;
    }
    apiFetchAuth("/api/eventi/" + stato.eventoCorrenteId + "/iscritti/" + iscrizioneId + "/rimborsato", { method: "POST" })
      .then(function () { caricaIscritti(stato.eventoCorrenteId); })
      .catch(function (err) { window.alert(err.message); });
  }

  // Un checkout Stripe (Gruppo, o Singolo+Aperitivo) genera più righe
  // collegate dallo stesso checkoutEventoId: il rimborso vero è unico sul
  // pagamento, quindi questa azione segna TUTTE le righe ancora "confermata"
  // di quel checkout in una sola chiamata (il backend fa la transazione).
  function segnaGruppoRimborsato(checkoutEventoId) {
    if (!window.confirm("Segnare come rimborsato l'intero gruppo collegato a questo pagamento? Il rimborso vero va fatto prima dal Dashboard Stripe.")) {
      return;
    }
    apiFetchAuth("/api/eventi/" + stato.eventoCorrenteId + "/checkout/" + checkoutEventoId + "/rimborsato", { method: "POST" })
      .then(function () { caricaIscritti(stato.eventoCorrenteId); })
      .catch(function (err) { window.alert(err.message); });
  }

  // Evento con "Pagamento online" disattivato (vedi checkbox in Modifica
  // evento): l'iscritto risulta "in attesa pagamento manuale" finché la
  // segreteria non incassa a parte (es. PayPal diretto) e conferma qui.
  function confermaPagamentoManuale(iscrizioneId) {
    if (!window.confirm("Confermare che il pagamento per questa iscrizione è stato ricevuto?")) {
      return;
    }
    apiFetchAuth("/api/eventi/" + stato.eventoCorrenteId + "/iscritti/" + iscrizioneId + "/conferma-pagamento-manuale", { method: "POST" })
      .then(function () { caricaIscritti(stato.eventoCorrenteId); })
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
    stato.eventoCorrenteTitolo = evento.titolo;
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

  // Eliminazione vera (non annullamento): la riga sparisce, non solo il suo
  // stato — pensata per ripulire iscrizioni di prova (segnalato dall'utente:
  // "Annulla" lascia comunque la riga visibile, con decine di test accumulati
  // nella tabella).
  function eliminaIscrizione(iscrizioneId) {
    if (!window.confirm("Eliminare definitivamente questa iscrizione? L'operazione non è reversibile.")) {
      return;
    }
    apiFetchAuth("/api/eventi/" + stato.eventoCorrenteId + "/iscritti/" + iscrizioneId, { method: "DELETE" })
      .then(function () { caricaIscritti(stato.eventoCorrenteId); })
      .catch(function (err) { window.alert(err.message); });
  }
})();
