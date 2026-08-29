// Pagina di TEST (test-pagamento.html): riproduce i due flussi di
// pagamento (iscrizione evento, tessera associazione) contro l'endpoint
// Function di test di QUESTO repo (/api/create-checkout-session-test),
// separato dal backend .NET reale — vedi api/src/functions/pagamenti-test-shared.js.
// Il catalogo EVENTI_TEST qui sotto deve restare identico a quello lato
// server: il totale mostrato qui è solo un'anteprima, il server ricalcola
// sempre da zero (non fidarsi mai di un importo mandato dal client).

(function () {
  var EVENTI_TEST = {
    "evt-cena": { id: "evt-cena", titolo: "Cena conviviale (test)", prezzoSingolo: 25, prezzoGruppoPersona: 20, prezzoAperitivoPersona: 8 },
    "evt-laboratorio": { id: "evt-laboratorio", titolo: "Laboratorio creativo (test)", prezzoSingolo: 15, prezzoGruppoPersona: null, prezzoAperitivoPersona: null },
    "evt-aperitivo-gruppo": { id: "evt-aperitivo-gruppo", titolo: "Uscita di gruppo (test)", prezzoSingolo: null, prezzoGruppoPersona: 18, prezzoAperitivoPersona: 10 }
  };

  // Prezzo tessera: NON hardcoded, letto dal backend .NET reale
  // (quotaIscrizioneSoci, admin-soci.html) — qui è solo un'anteprima, il
  // totale vero è sempre ricalcolato dal server al momento del pagamento.
  var quotaTesseraCorrente = null;
  fetch("https://app-trame-prod.azurewebsites.net/api/impostazioni")
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (impostazioni) {
      quotaTesseraCorrente = (impostazioni && impostazioni.quotaIscrizioneSoci) || null;
      aggiornaTotaleTessera();
    })
    .catch(function () { /* niente anteprima: il totale reale si vede comunque al pagamento */ });

  // Generato una sola volta per tentativo di pagamento (non ad ogni
  // click): se lo stesso fetch venisse ripetuto per un problema di rete,
  // arriva sempre lo stesso valore, che il server usa come idempotency key
  // verso Stripe per non creare due sessioni/due addebiti per lo stesso invio.
  function nuovoRichiestaId() {
    return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : (Date.now() + "-" + Math.random());
  }

  var params = new URLSearchParams(window.location.search);
  if (params.get("annullato")) {
    document.getElementById("nota-annullato").hidden = false;
  }

  // --- Tab switch ---
  var btnTabEvento = document.getElementById("btn-tab-evento");
  var btnTabTessera = document.getElementById("btn-tab-tessera");
  var pannelloEvento = document.getElementById("pannello-evento");
  var pannelloTessera = document.getElementById("pannello-tessera");

  function mostraTab(tab) {
    pannelloEvento.hidden = tab !== "evento";
    pannelloTessera.hidden = tab !== "tessera";
    btnTabEvento.className = "btn btn--small " + (tab === "evento" ? "btn--primary" : "btn--outline");
    btnTabTessera.className = "btn btn--small " + (tab === "tessera" ? "btn--primary" : "btn--outline");
  }
  btnTabEvento.addEventListener("click", function () { mostraTab("evento"); });
  btnTabTessera.addEventListener("click", function () { mostraTab("tessera"); });
  mostraTab("evento");

  function popolaSelect(select, min, max) {
    select.innerHTML = "";
    for (var n = min; n <= max; n++) {
      var option = document.createElement("option");
      option.value = n;
      option.textContent = n;
      select.appendChild(option);
    }
  }

  // ================= FLUSSO A: evento =================

  var evScelta = document.getElementById("ev-scelta");
  var evEmail = document.getElementById("ev-email");
  var evCampoModalita = document.getElementById("ev-campo-scelta-modalita");
  var evModalita = document.getElementById("ev-modalita");
  var evCampoNumeroGruppo = document.getElementById("ev-campo-numero-gruppo");
  var evNumeroGruppo = document.getElementById("ev-numero-gruppo");
  var evCampoAperitivo = document.getElementById("ev-campo-aperitivo");
  var evAperitivo = document.getElementById("ev-aperitivo");
  var evTotale = document.getElementById("ev-totale");
  var evStatus = document.getElementById("ev-status");
  var evBtnPaga = document.getElementById("ev-btn-paga");

  Object.keys(EVENTI_TEST).forEach(function (id) {
    var option = document.createElement("option");
    option.value = id;
    option.textContent = EVENTI_TEST[id].titolo;
    evScelta.appendChild(option);
  });
  popolaSelect(evNumeroGruppo, 2, 6);
  popolaSelect(evAperitivo, 0, 6);

  // Determina, in base ai prezzi impostati per l'evento scelto, quale
  // modalità è "attiva": se solo una delle due (singolo/gruppo) è prevista
  // si usa quella senza mostrare la scelta; se sono previste entrambe si
  // mostra il selettore.
  function modalitaAttiva() {
    var evento = EVENTI_TEST[evScelta.value];
    if (evento.prezzoSingolo != null && evento.prezzoGruppoPersona != null) {
      return evModalita.value;
    }
    return evento.prezzoSingolo != null ? "singolo" : "gruppo";
  }

  function aggiornaCampiEvento() {
    var evento = EVENTI_TEST[evScelta.value];
    var entrambe = evento.prezzoSingolo != null && evento.prezzoGruppoPersona != null;
    evCampoModalita.hidden = !entrambe;

    var modalita = modalitaAttiva();
    evCampoNumeroGruppo.hidden = modalita !== "gruppo";
    evCampoAperitivo.hidden = evento.prezzoAperitivoPersona == null;

    aggiornaTotaleEvento();
  }

  function aggiornaTotaleEvento() {
    var evento = EVENTI_TEST[evScelta.value];
    var modalita = modalitaAttiva();
    var totale = 0;
    if (modalita === "singolo") {
      totale += evento.prezzoSingolo || 0;
    } else {
      totale += (evento.prezzoGruppoPersona || 0) * parseInt(evNumeroGruppo.value, 10);
    }
    var personeAperitivo = evCampoAperitivo.hidden ? 0 : parseInt(evAperitivo.value, 10);
    if (personeAperitivo > 0) {
      totale += evento.prezzoAperitivoPersona * personeAperitivo;
    }
    evTotale.textContent = "Totale: " + totale.toFixed(2) + " €";
  }

  evScelta.addEventListener("change", aggiornaCampiEvento);
  evModalita.addEventListener("change", aggiornaCampiEvento);
  evNumeroGruppo.addEventListener("change", aggiornaTotaleEvento);
  evAperitivo.addEventListener("change", aggiornaTotaleEvento);
  aggiornaCampiEvento();

  evBtnPaga.addEventListener("click", function () {
    evStatus.hidden = true;
    if (!evEmail.checkValidity()) {
      evEmail.reportValidity();
      return;
    }
    var payload = {
      tipoPagamento: "evento",
      richiestaId: nuovoRichiestaId(),
      eventoId: evScelta.value,
      email: evEmail.value.trim(),
      modalita: modalitaAttiva(),
      numeroPersoneGruppo: modalitaAttiva() === "gruppo" ? parseInt(evNumeroGruppo.value, 10) : null,
      personeAperitivo: evCampoAperitivo.hidden ? 0 : parseInt(evAperitivo.value, 10)
    };
    avviaCheckout(payload, evBtnPaga, evStatus);
  });

  // ================= FLUSSO B: tessera =================

  var teNumero = document.getElementById("te-numero");
  var teBlocchi = document.getElementById("te-blocchi-persone");
  var teTotale = document.getElementById("te-totale");
  var teStatus = document.getElementById("te-status");
  var teBtnPaga = document.getElementById("te-btn-paga");

  popolaSelect(teNumero, 1, 5);

  function generaBlocchiPersone() {
    var n = parseInt(teNumero.value, 10);
    // Mantiene i valori già inseriti nei blocchi che restano, invece di
    // azzerare tutto quando si cambia solo il numero di tessere.
    var precedenti = leggiPersone(false);
    teBlocchi.innerHTML = "";
    for (var i = 0; i < n; i++) {
      var blocco = document.createElement("div");
      blocco.className = "admin-panel";
      blocco.style.cssText = "margin:12px 0; padding:14px;";
      blocco.innerHTML =
        "<p class=\"form-note\" style=\"margin-top:0;\">Persona " + (i + 1) + "</p>" +
        "<div class=\"form-row\"><label>Nome</label><input type=\"text\" class=\"te-nome\" maxlength=\"100\" required></div>" +
        "<div class=\"form-row\"><label>Cognome</label><input type=\"text\" class=\"te-cognome\" maxlength=\"100\" required></div>" +
        "<div class=\"form-row\"><label>Email</label><input type=\"email\" class=\"te-persona-email\" maxlength=\"255\" required></div>";
      if (precedenti[i]) {
        blocco.querySelector(".te-nome").value = precedenti[i].nome;
        blocco.querySelector(".te-cognome").value = precedenti[i].cognome;
        blocco.querySelector(".te-persona-email").value = precedenti[i].email;
      }
      teBlocchi.appendChild(blocco);
    }
    aggiornaTotaleTessera();
  }

  function leggiPersone(validare) {
    var blocchi = teBlocchi.querySelectorAll(".admin-panel");
    var persone = [];
    for (var i = 0; i < blocchi.length; i++) {
      var nome = blocchi[i].querySelector(".te-nome");
      var cognome = blocchi[i].querySelector(".te-cognome");
      var email = blocchi[i].querySelector(".te-persona-email");
      if (validare) {
        if (!nome.reportValidity() || !cognome.reportValidity() || !email.reportValidity()) {
          return null;
        }
      }
      persone.push({ nome: nome.value.trim(), cognome: cognome.value.trim(), email: email.value.trim() });
    }
    if (validare) {
      // Stessa email su più blocchi: quasi certamente un errore di
      // battitura, non un caso legittimo (il server la rifiuta comunque,
      // ma qui si vede subito senza aspettare il giro col server).
      var emailViste = {};
      for (var j = 0; j < persone.length; j++) {
        var emailNorm = persone[j].email.toLowerCase();
        if (emailViste[emailNorm]) {
          teStatus.textContent = "L'email " + persone[j].email + " è ripetuta su più persone: ogni tessera richiede un'email diversa.";
          teStatus.hidden = false;
          return null;
        }
        emailViste[emailNorm] = true;
      }
    }
    return persone;
  }

  function aggiornaTotaleTessera() {
    var n = parseInt(teNumero.value, 10);
    if (quotaTesseraCorrente == null) {
      teTotale.textContent = "Totale: calcolato al pagamento (quota non ancora caricata)";
      return;
    }
    teTotale.textContent = "Totale: " + (quotaTesseraCorrente * n).toFixed(2) + " €";
  }

  teNumero.addEventListener("change", generaBlocchiPersone);
  generaBlocchiPersone();

  teBtnPaga.addEventListener("click", function () {
    teStatus.hidden = true;
    var persone = leggiPersone(true);
    if (!persone) {
      return;
    }
    var payload = {
      tipoPagamento: "tessera",
      richiestaId: nuovoRichiestaId(),
      numeroTessere: parseInt(teNumero.value, 10),
      persone: persone
    };
    avviaCheckout(payload, teBtnPaga, teStatus);
  });

  // ================= Comune: avvia il checkout di test =================

  function avviaCheckout(payload, pulsante, statusEl) {
    var testoOriginale = pulsante.textContent;
    pulsante.disabled = true;
    pulsante.textContent = "Reindirizzamento a Stripe…";

    fetch("/api/create-checkout-session-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            throw new Error(body.error || "Errore nella creazione della sessione di pagamento.");
          }
          return body;
        });
      })
      .then(function (result) {
        window.location.href = result.url;
      })
      .catch(function (err) {
        pulsante.disabled = false;
        pulsante.textContent = testoOriginale;
        statusEl.textContent = err.message;
        statusEl.hidden = false;
      });
  }
})();
