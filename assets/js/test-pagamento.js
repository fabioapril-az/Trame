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

  // Un blocco nome/cognome/email per persona, condiviso da Flusso A
  // (Singolo/Gruppo: serve un'email a testa per lo sconto socio) e Flusso B
  // (tessere nominali). "precedentiGetter" ripopola i blocchi che restano
  // con i valori già inseriti, invece di azzerare tutto quando cambia solo
  // il numero di persone.
  function generaBlocchiPersone(container, classPrefix, n, precedentiGetter) {
    var precedenti = precedentiGetter ? precedentiGetter() : [];
    container.innerHTML = "";
    for (var i = 0; i < n; i++) {
      var blocco = document.createElement("div");
      blocco.className = "admin-panel";
      blocco.style.cssText = "margin:12px 0; padding:14px;";
      blocco.innerHTML =
        "<p class=\"form-note\" style=\"margin-top:0;\">Persona " + (i + 1) + "</p>" +
        "<div class=\"form-row\"><label>Nome</label><input type=\"text\" class=\"" + classPrefix + "-nome\" maxlength=\"100\" required></div>" +
        "<div class=\"form-row\"><label>Cognome</label><input type=\"text\" class=\"" + classPrefix + "-cognome\" maxlength=\"100\" required></div>" +
        "<div class=\"form-row\"><label>Email</label><input type=\"email\" class=\"" + classPrefix + "-email\" maxlength=\"255\" required></div>";
      if (precedenti[i]) {
        blocco.querySelector("." + classPrefix + "-nome").value = precedenti[i].nome;
        blocco.querySelector("." + classPrefix + "-cognome").value = precedenti[i].cognome;
        blocco.querySelector("." + classPrefix + "-email").value = precedenti[i].email;
      }
      container.appendChild(blocco);
    }
  }

  function leggiPersoneDaBlocchi(container, classPrefix, validare, statusEl) {
    var blocchi = container.querySelectorAll(".admin-panel");
    var persone = [];
    for (var i = 0; i < blocchi.length; i++) {
      var nome = blocchi[i].querySelector("." + classPrefix + "-nome");
      var cognome = blocchi[i].querySelector("." + classPrefix + "-cognome");
      var email = blocchi[i].querySelector("." + classPrefix + "-email");
      if (validare) {
        if (!nome.reportValidity() || !cognome.reportValidity() || !email.reportValidity()) {
          return null;
        }
      }
      persone.push({ nome: nome.value.trim(), cognome: cognome.value.trim(), email: email.value.trim() });
    }
    if (validare) {
      // Stessa email su più blocchi: quasi certamente un errore di
      // battitura (il server la rifiuta comunque, ma qui si vede subito).
      var emailViste = {};
      for (var j = 0; j < persone.length; j++) {
        var emailNorm = persone[j].email.toLowerCase();
        if (emailViste[emailNorm]) {
          statusEl.textContent = "L'email " + persone[j].email + " è ripetuta su più persone: ogni persona richiede un'email diversa.";
          statusEl.hidden = false;
          return null;
        }
        emailViste[emailNorm] = true;
      }
    }
    return persone;
  }

  // ================= FLUSSO A: evento =================

  var evScelta = document.getElementById("ev-scelta");
  var evCampoModalita = document.getElementById("ev-campo-scelta-modalita");
  var evModalita = document.getElementById("ev-modalita");
  var evCampoNumeroGruppo = document.getElementById("ev-campo-numero-gruppo");
  var evNumeroGruppo = document.getElementById("ev-numero-gruppo");
  var evBlocchiPersone = document.getElementById("ev-blocchi-persone");
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

  // Anteprima sconto socio: email -> { socio, scontoApplicabile, scontoEuro }
  // (o "loading" mentre si aspetta la risposta), riempita quando si esce da
  // un campo email — stessa verifica che il server rifà comunque al submit
  // (il contatore potrebbe cambiare nel frattempo, questa resta un'anteprima).
  var scontoCache = {};

  function verificaScontoEmail(email) {
    var emailNorm = email.trim().toLowerCase();
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return;
    }
    scontoCache[emailNorm] = "loading";
    fetch("/api/verifica-sconto-persona-test?email=" + encodeURIComponent(emailNorm))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (risultato) {
        scontoCache[emailNorm] = risultato || { socio: false, scontoApplicabile: false };
        aggiornaTotaleEvento();
      })
      .catch(function () { delete scontoCache[emailNorm]; });
  }

  function collegaVerificaScontoEmail() {
    evBlocchiPersone.querySelectorAll(".ev-persona-email").forEach(function (campo) {
      campo.addEventListener("blur", function () { verificaScontoEmail(campo.value); });
    });
  }

  function generaBlocchiEvento() {
    var n = modalitaAttiva() === "singolo" ? 1 : parseInt(evNumeroGruppo.value, 10);
    generaBlocchiPersone(evBlocchiPersone, "ev-persona", n, function () {
      return leggiPersoneDaBlocchi(evBlocchiPersone, "ev-persona", false);
    });
    collegaVerificaScontoEmail();
  }

  function aggiornaCampiEvento() {
    var evento = EVENTI_TEST[evScelta.value];
    var entrambe = evento.prezzoSingolo != null && evento.prezzoGruppoPersona != null;
    evCampoModalita.hidden = !entrambe;

    var modalita = modalitaAttiva();
    evCampoNumeroGruppo.hidden = modalita !== "gruppo";
    evCampoAperitivo.hidden = evento.prezzoAperitivoPersona == null;

    generaBlocchiEvento();
    aggiornaTotaleEvento();
  }

  function aggiornaTotaleEvento() {
    // Prezzo per persona: pieno finché l'email non è stata verificata (o
    // non è ancora stata inserita), scontato se scontoCache dice che spetta
    // — la verifica vera parte quando si esce dal campo email (vedi
    // verificaScontoEmail/collegaVerificaScontoEmail). Resta un'anteprima:
    // il server ricalcola comunque tutto da zero al momento del pagamento.
    var evento = EVENTI_TEST[evScelta.value];
    var modalita = modalitaAttiva();
    var prezzoBase = modalita === "singolo" ? (evento.prezzoSingolo || 0) : (evento.prezzoGruppoPersona || 0);

    var totale = 0;
    var inVerifica = false;
    evBlocchiPersone.querySelectorAll(".ev-persona-email").forEach(function (campo) {
      var emailNorm = campo.value.trim().toLowerCase();
      var info = emailNorm ? scontoCache[emailNorm] : null;
      if (info === "loading") {
        inVerifica = true;
        totale += prezzoBase;
      } else if (info && info.scontoApplicabile) {
        totale += Math.max(0, prezzoBase - info.scontoEuro);
      } else {
        totale += prezzoBase;
      }
    });

    var personeAperitivo = evCampoAperitivo.hidden ? 0 : parseInt(evAperitivo.value, 10);
    if (personeAperitivo > 0) {
      totale += evento.prezzoAperitivoPersona * personeAperitivo;
    }
    evTotale.textContent = "Totale" + (inVerifica ? " (provvisorio, verifica sconto socio in corso…)" : "") +
      ": " + totale.toFixed(2) + " €";
  }

  evScelta.addEventListener("change", aggiornaCampiEvento);
  evModalita.addEventListener("change", aggiornaCampiEvento);
  evNumeroGruppo.addEventListener("change", function () { generaBlocchiEvento(); aggiornaTotaleEvento(); });
  evAperitivo.addEventListener("change", aggiornaTotaleEvento);
  aggiornaCampiEvento();

  evBtnPaga.addEventListener("click", function () {
    evStatus.hidden = true;
    var persone = leggiPersoneDaBlocchi(evBlocchiPersone, "ev-persona", true, evStatus);
    if (!persone) {
      return;
    }
    var payload = {
      tipoPagamento: "evento",
      richiestaId: nuovoRichiestaId(),
      eventoId: evScelta.value,
      modalita: modalitaAttiva(),
      persone: persone,
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

  function generaBlocchiTessera() {
    var n = parseInt(teNumero.value, 10);
    generaBlocchiPersone(teBlocchi, "te-persona", n, function () {
      return leggiPersoneDaBlocchi(teBlocchi, "te-persona", false);
    });
    aggiornaTotaleTessera();
  }

  function aggiornaTotaleTessera() {
    var n = parseInt(teNumero.value, 10);
    if (quotaTesseraCorrente == null) {
      teTotale.textContent = "Totale: calcolato al pagamento (quota non ancora caricata)";
      return;
    }
    teTotale.textContent = "Totale: " + (quotaTesseraCorrente * n).toFixed(2) + " €";
  }

  teNumero.addEventListener("change", generaBlocchiTessera);
  generaBlocchiTessera();

  teBtnPaga.addEventListener("click", function () {
    teStatus.hidden = true;
    var persone = leggiPersoneDaBlocchi(teBlocchi, "te-persona", true, teStatus);
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
