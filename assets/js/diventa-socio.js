// Modulo iscrizione socio (diventa-socio.html) → POST /api/soci sull'API
// del gestionale soci. Pagina pubblica, nessun login richiesto.

(function () {
  var CONSENSO_VERSIONE = "1.0"; // versione dell'informativa privacy corrente (privacy.html)

  var form = document.getElementById("socio-form");
  var submitBtn = document.getElementById("submit-btn");
  var statusEl = document.getElementById("form-status");
  var dataNascitaInput = document.getElementById("data-nascita");
  var minorenneNote = document.getElementById("minorenne-note");
  var maggiorenneNote = document.getElementById("maggiorenne-note");

  // "?admin=1": link "+ Registra nuovo socio" da admin-soci.html. La
  // segreteria registra così anche maggiorenni che hanno già pagato offline
  // (contanti, bonifico) — solo per il pubblico dal sito il modulo classico
  // è riservato ai minorenni (pagamento online obbligatorio per tutti gli
  // altri casi).
  var modalitaAdmin = new URLSearchParams(window.location.search).get("admin") === "1";

  function calcolaEta(dataNascita) {
    var oggi = new Date();
    var nascita = new Date(dataNascita);
    var eta = oggi.getFullYear() - nascita.getFullYear();
    var meseGiorno = oggi.getMonth() - nascita.getMonth() || oggi.getDate() - nascita.getDate();
    if (meseGiorno < 0) {
      eta--;
    }
    return eta;
  }

  // Questo form resta solo per i minorenni (consenso genitore, mai gestito
  // da Stripe): un maggiorenne va instradato alla tab "Iscrizione socio",
  // che paga online — coerente col fatto che ogni iscrizione fatta dal sito
  // passa da un pagamento online, salvo questa eccezione dei minorenni.
  dataNascitaInput.addEventListener("change", function () {
    if (!dataNascitaInput.value) {
      minorenneNote.hidden = true;
      maggiorenneNote.hidden = true;
      submitBtn.disabled = false;
      return;
    }
    var maggiorenne = calcolaEta(dataNascitaInput.value) >= 18;
    minorenneNote.hidden = maggiorenne;
    maggiorenneNote.hidden = !maggiorenne || modalitaAdmin;
    submitBtn.disabled = maggiorenne && !modalitaAdmin;
  });

  function mostraStato(messaggio, tipo) {
    statusEl.textContent = messaggio;
    statusEl.hidden = false;
    statusEl.style.color = tipo === "errore" ? "var(--color-terracotta, #b5533c)" : "inherit";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.hidden = true;

    // Guardia anche qui, non solo sul bottone disabilitato al cambio data
    // (difesa in profondità): questo modulo non deve creare iscrizioni di
    // maggiorenni senza pagamento online, salvo la registrazione manuale
    // della segreteria (?admin=1, vedi sopra).
    if (!modalitaAdmin && dataNascitaInput.value && calcolaEta(dataNascitaInput.value) >= 18) {
      mostraStato("Questo modulo è riservato ai minorenni: usa \"Iscrizione socio\" qui sopra.", "errore");
      return;
    }

    var payload = {
      nome: document.getElementById("nome").value.trim(),
      cognome: document.getElementById("cognome").value.trim(),
      email: document.getElementById("email").value.trim(),
      telefono: document.getElementById("telefono").value.trim() || null,
      dataNascita: document.getElementById("data-nascita").value,
      codiceFiscale: document.getElementById("codice-fiscale").value.trim().toUpperCase(),
      indirizzo: document.getElementById("indirizzo").value.trim() || null,
      citta: document.getElementById("citta").value.trim() || null,
      cap: document.getElementById("cap").value.trim() || null,
      consensoAccettato: document.getElementById("consenso").checked,
      consensoVersione: CONSENSO_VERSIONE,
      consensoCanale: "web"
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Invio in corso…";

    window.trameFetch("/api/soci", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (result) {
        form.reset();
        minorenneNote.hidden = true;
        var messaggio = "Iscrizione completata! Riceverai a breve un'email con la tua tessera socio (n. " +
          result.numeroTessera + "), valida fino al " + formattaData(result.dataScadenza) + ".";
        if (result.richiedeConsensoGenitore) {
          messaggio += " Essendo minorenne, un genitore/tutore deve inviarci il modulo di consenso firmato: " +
            "scrivi a info@progettotrame.org per ricevere le istruzioni.";
        }
        mostraStato(messaggio, "successo");
      })
      .catch(function (err) {
        mostraStato(err.message, "errore");
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Invia iscrizione";
      });
  });

  function formattaData(isoDate) {
    var parti = isoDate.split("-");
    return parti[2] + "/" + parti[1] + "/" + parti[0];
  }

  // ================= Iscrizione socio con pagamento online (Stripe) =======
  // Percorso standard per i maggiorenni (1-5 persone in un solo pagamento,
  // tab predefinita). Non gestisce minorenni (deciso con l'utente): chi lo
  // è usa "Iscrizione minorenne" qui sopra, l'unica eccezione senza
  // pagamento online, con il consenso del genitore già previsto lì.

  var params = new URLSearchParams(window.location.search);
  var pagamentoParam = params.get("pagamento"); // "confermato"|"annullato", solo al ritorno da Stripe

  var btnTabSingolo = document.getElementById("btn-tab-singolo");
  var btnTabMultiplo = document.getElementById("btn-tab-multiplo");
  var pannelloMultiplo = document.getElementById("pannello-multiplo");

  // "Iscrizione minorenne" nascosta al pubblico per ora (richiesta
  // dell'utente): resta raggiungibile solo dalla segreteria (?admin=1). Con
  // una sola scelta visibile non ha senso mostrare il toggle delle tab, né
  // la nota che parla di minorenni (nessuna alternativa da indicare).
  var notaMinorenni = document.getElementById("mt-nota-minorenni");
  if (!modalitaAdmin) {
    document.querySelector(".admin-toolbar").hidden = true;
    notaMinorenni.hidden = true;
  } else {
    // Solo per la segreteria la tab esiste ancora: la nota può rimandarci.
    notaMinorenni.innerHTML =
      "Non adatta a chi è minorenne: usa \"Iscrizione minorenne\" qui sopra per quella persona.";
  }

  function mostraTab(tab) {
    form.hidden = tab !== "singolo";
    pannelloMultiplo.hidden = tab !== "multiplo";
    btnTabSingolo.className = "btn btn--small " + (tab === "singolo" ? "btn--primary" : "btn--outline");
    btnTabMultiplo.className = "btn btn--small " + (tab === "multiplo" ? "btn--primary" : "btn--outline");
  }
  btnTabSingolo.addEventListener("click", function () { mostraTab("singolo"); });
  btnTabMultiplo.addEventListener("click", function () { mostraTab("multiplo"); });

  // Esito del ritorno da Stripe: elemento dedicato FUORI da form/
  // pannello-multiplo (entrambi possono essere nascosti qui sotto — un
  // messaggio scritto dentro uno dei due sparirebbe con lui).
  var esitoEl = document.getElementById("pagamento-esito-status");
  function mostraEsito(messaggio, tipo) {
    esitoEl.textContent = messaggio;
    esitoEl.hidden = false;
    esitoEl.style.color = tipo === "errore" ? "var(--color-terracotta, #b5533c)" : "inherit";
  }

  // Ritorno da Stripe: nessun form, solo l'esito.
  if (pagamentoParam === "confermato") {
    form.hidden = true;
    pannelloMultiplo.hidden = true;
    document.querySelector(".admin-toolbar").hidden = true;
    mostraEsito("Pagamento confermato! Riceverai a breve via email le tessere socio per tutte le persone iscritte.", "successo");
  } else if (modalitaAdmin) {
    // Segreteria da admin-soci.html: parte dal modulo classico (registra a
    // mano chi ha già pagato offline), ma entrambe le tab restano scelte
    // valide — è lei a sapere quale usare caso per caso.
    mostraTab("singolo");
  } else {
    // "Iscrizione socio" (pagamento online) è il percorso standard per i
    // maggiorenni, quindi la tab predefinita — "Iscrizione minorenne" resta
    // un'eccezione da scegliere esplicitamente.
    mostraTab("multiplo");
    if (pagamentoParam === "annullato") {
      mostraEsito("Pagamento annullato: puoi riprovare qui sotto.", "errore");
    }
  }

  var quotaTessera = null;
  window.trameFetch("/api/impostazioni")
    .then(function (impostazioni) {
      quotaTessera = (impostazioni && impostazioni.quotaIscrizioneSoci) || null;
      aggiornaTotaleMultiplo();
    })
    .catch(function () { /* niente anteprima: il totale reale si vede comunque al pagamento */ });

  var mtNumero = document.getElementById("mt-numero");
  var mtBlocchi = document.getElementById("mt-blocchi-persone");
  var mtConsenso = document.getElementById("mt-consenso");
  var mtTotale = document.getElementById("mt-totale");
  var mtStatus = document.getElementById("mt-status");
  var mtBtnPaga = document.getElementById("mt-btn-paga");

  for (var n = 1; n <= 5; n++) {
    var option = document.createElement("option");
    option.value = n;
    option.textContent = n;
    mtNumero.appendChild(option);
  }

  function leggiPersoneMultiplo(validare) {
    var blocchi = mtBlocchi.querySelectorAll(".admin-panel");
    var persone = [];
    for (var i = 0; i < blocchi.length; i++) {
      var campi = {
        nome: blocchi[i].querySelector(".mt-nome"),
        cognome: blocchi[i].querySelector(".mt-cognome"),
        email: blocchi[i].querySelector(".mt-email"),
        telefono: blocchi[i].querySelector(".mt-telefono"),
        dataNascita: blocchi[i].querySelector(".mt-data-nascita"),
        codiceFiscale: blocchi[i].querySelector(".mt-cf"),
        indirizzo: blocchi[i].querySelector(".mt-indirizzo"),
        citta: blocchi[i].querySelector(".mt-citta"),
        cap: blocchi[i].querySelector(".mt-cap")
      };
      if (validare) {
        var campiObbligatori = [campi.nome, campi.cognome, campi.email, campi.dataNascita, campi.codiceFiscale];
        var tuttiValidi = campiObbligatori.every(function (c) { return c.reportValidity(); });
        if (!tuttiValidi) {
          return null;
        }
        if (campi.dataNascita.value && calcolaEta(campi.dataNascita.value) < 18) {
          mtStatus.textContent = "La persona " + (i + 1) + " risulta minorenne: questo pagamento multiplo non la supporta" +
            (modalitaAdmin ? ", usa \"Iscrizione minorenne\" qui sopra per lei." : ": contattaci per quella persona.");
          mtStatus.hidden = false;
          return null;
        }
      }
      persone.push({
        nome: campi.nome.value.trim(),
        cognome: campi.cognome.value.trim(),
        email: campi.email.value.trim(),
        telefono: campi.telefono.value.trim() || null,
        dataNascita: campi.dataNascita.value,
        codiceFiscale: campi.codiceFiscale.value.trim().toUpperCase(),
        indirizzo: campi.indirizzo.value.trim() || null,
        citta: campi.citta.value.trim() || null,
        cap: campi.cap.value.trim() || null
      });
    }
    if (validare) {
      var emailViste = {};
      for (var j = 0; j < persone.length; j++) {
        var emailNorm = persone[j].email.toLowerCase();
        if (emailViste[emailNorm]) {
          mtStatus.textContent = "L'email " + persone[j].email + " è ripetuta su più persone: ogni tessera richiede un'email diversa.";
          mtStatus.hidden = false;
          return null;
        }
        emailViste[emailNorm] = true;
      }
    }
    return persone;
  }

  function generaBlocchiMultiplo() {
    var n = parseInt(mtNumero.value, 10);
    var precedenti = leggiPersoneMultiplo(false) || [];
    mtBlocchi.innerHTML = "";
    for (var i = 0; i < n; i++) {
      var blocco = document.createElement("div");
      blocco.className = "admin-panel";
      // Bordo/sfondo/numero in evidenza: senza, i blocchi si confondevano
      // l'uno nell'altro quando le persone sono più di una (.admin-panel di
      // per sé non ha alcun bordo — segnalato dall'utente).
      blocco.style.cssText = "margin:16px 0; padding:16px; border:1px solid var(--color-line); " +
        "border-radius:10px; background:var(--color-cream-alt);";
      blocco.innerHTML =
        "<h4 style=\"margin:0 0 14px; padding-bottom:8px; font-size:1.05rem; " +
        "color:var(--color-terracotta-dark); border-bottom:1px solid var(--color-line);\">Persona " + (i + 1) + "</h4>" +
        "<div class=\"form-row\"><label>Nome</label><input type=\"text\" class=\"mt-nome\" maxlength=\"100\" required></div>" +
        "<div class=\"form-row\"><label>Cognome</label><input type=\"text\" class=\"mt-cognome\" maxlength=\"100\" required></div>" +
        "<div class=\"form-row\"><label>Email</label><input type=\"email\" class=\"mt-email\" maxlength=\"255\" required></div>" +
        "<div class=\"form-row\"><label>Telefono (facoltativo)</label><input type=\"tel\" class=\"mt-telefono\" maxlength=\"20\"></div>" +
        "<div class=\"form-row\"><label>Data di nascita</label><input type=\"date\" class=\"mt-data-nascita\" required></div>" +
        "<div class=\"form-row\"><label>Codice fiscale</label><input type=\"text\" class=\"mt-cf\" maxlength=\"16\" required pattern=\"^[A-Za-z]{6}\\d{2}[A-EHLMPRSTabcdehlmprst]\\d{2}([A-Za-z]\\d{3}|\\d{4})[A-Za-z]$\"></div>" +
        "<div class=\"form-row\"><label>Indirizzo (facoltativo)</label><input type=\"text\" class=\"mt-indirizzo\" maxlength=\"255\"></div>" +
        "<div class=\"form-row\"><label>Città (facoltativo)</label><input type=\"text\" class=\"mt-citta\" maxlength=\"100\"></div>" +
        "<div class=\"form-row\"><label>CAP (facoltativo)</label><input type=\"text\" class=\"mt-cap\" maxlength=\"10\"></div>";
      if (precedenti[i]) {
        blocco.querySelector(".mt-nome").value = precedenti[i].nome;
        blocco.querySelector(".mt-cognome").value = precedenti[i].cognome;
        blocco.querySelector(".mt-email").value = precedenti[i].email;
        blocco.querySelector(".mt-telefono").value = precedenti[i].telefono || "";
        blocco.querySelector(".mt-data-nascita").value = precedenti[i].dataNascita || "";
        blocco.querySelector(".mt-cf").value = precedenti[i].codiceFiscale || "";
        blocco.querySelector(".mt-indirizzo").value = precedenti[i].indirizzo || "";
        blocco.querySelector(".mt-citta").value = precedenti[i].citta || "";
        blocco.querySelector(".mt-cap").value = precedenti[i].cap || "";
      }
      mtBlocchi.appendChild(blocco);
    }
  }

  function aggiornaTotaleMultiplo() {
    var n = parseInt(mtNumero.value, 10);
    if (quotaTessera == null) {
      mtTotale.textContent = "Totale: calcolato al pagamento (quota non ancora caricata)";
      return;
    }
    mtTotale.textContent = "Totale: " + (quotaTessera * n).toFixed(2) + " €";
  }

  mtNumero.addEventListener("change", function () { generaBlocchiMultiplo(); aggiornaTotaleMultiplo(); });
  generaBlocchiMultiplo();

  function nuovoRichiestaId() {
    return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : (Date.now() + "-" + Math.random());
  }

  mtBtnPaga.addEventListener("click", function () {
    mtStatus.hidden = true;
    if (!mtConsenso.checked) {
      mtStatus.textContent = "Devi confermare di aver letto l'informativa privacy per procedere.";
      mtStatus.hidden = false;
      return;
    }
    var persone = leggiPersoneMultiplo(true);
    if (!persone) {
      return;
    }
    persone.forEach(function (p) {
      p.consensoAccettato = true;
      p.consensoVersione = CONSENSO_VERSIONE;
    });

    var testoOriginale = mtBtnPaga.textContent;
    mtBtnPaga.disabled = true;
    mtBtnPaga.textContent = "Reindirizzamento a Stripe…";

    window.trameFetch("/api/soci/checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // origine: usata dal backend (validata contro un allowlist) per
      // costruire il redirect di ritorno da Stripe — campo obbligatorio.
      body: JSON.stringify({ richiestaId: nuovoRichiestaId(), origine: window.location.origin, persone: persone })
    })
      .then(function (result) {
        window.location.href = result.url;
      })
      .catch(function (err) {
        mtBtnPaga.disabled = false;
        mtBtnPaga.textContent = testoOriginale;
        mtStatus.textContent = err.message;
        mtStatus.hidden = false;
      });
  });
})();
