// Modulo iscrizione socio (diventa-socio.html) → POST /api/soci sull'API
// del gestionale soci. Pagina pubblica, nessun login richiesto.

(function () {
  var CONSENSO_VERSIONE = "1.0"; // versione dell'informativa privacy corrente (privacy.html)

  var form = document.getElementById("socio-form");
  var submitBtn = document.getElementById("submit-btn");
  var statusEl = document.getElementById("form-status");
  var dataNascitaInput = document.getElementById("data-nascita");
  var minorenneNote = document.getElementById("minorenne-note");

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

  dataNascitaInput.addEventListener("change", function () {
    if (!dataNascitaInput.value) {
      minorenneNote.hidden = true;
      return;
    }
    minorenneNote.hidden = calcolaEta(dataNascitaInput.value) >= 18;
  });

  function mostraStato(messaggio, tipo) {
    statusEl.textContent = messaggio;
    statusEl.hidden = false;
    statusEl.style.color = tipo === "errore" ? "var(--color-terracotta, #b5533c)" : "inherit";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.hidden = true;

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
})();
