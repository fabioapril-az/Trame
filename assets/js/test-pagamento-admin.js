// Pagina di TEST (test-pagamento-admin.html): elenco dei record salvati
// dall'ambiente di test Stripe + azione manuale "Segna come rimborsato"
// (vedi api/src/functions/iscrizioni-test-admin.js). La chiave inserita qui
// viene tenuta solo in sessionStorage del browser, mai salvata altrove.

(function () {
  var inputChiave = document.getElementById("chiave");
  var btnCarica = document.getElementById("btn-carica");
  var inputCerca = document.getElementById("cerca-persona");
  var statusEl = document.getElementById("status");
  var tbody = document.getElementById("tabella-body");
  var emptyEl = document.getElementById("empty");

  // Elenco completo tenuto in memoria dopo il caricamento: la ricerca per
  // nome/email filtra qui, senza dover richiamare l'API ad ogni carattere.
  var righeCorrenti = [];
  var chiaveUsataPerCaricare = null;

  function persone(record) {
    return (record.dati && Array.isArray(record.dati.persone)) ? record.dati.persone : [];
  }

  function testoPersone(record) {
    return persone(record).map(function (p) {
      return (p.nome || "") + " " + (p.cognome || "") + " (" + (p.email || "") + ")";
    }).join(", ") || "—";
  }

  var CHIAVE_SESSIONE = "trame_test_admin_key";
  try {
    var salvata = window.sessionStorage.getItem(CHIAVE_SESSIONE);
    if (salvata) {
      inputChiave.value = salvata;
    }
  } catch (e) { /* storage non disponibile: si può comunque incollare la chiave a mano */ }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function mostraStatus(testo, errore) {
    statusEl.textContent = testo;
    statusEl.hidden = false;
    statusEl.style.color = errore ? "var(--color-terracotta, #b5533c)" : "inherit";
  }

  function caricaElenco() {
    var chiave = inputChiave.value;
    if (!chiave) {
      mostraStatus("Inserisci la chiave admin di test.", true);
      return;
    }
    try { window.sessionStorage.setItem(CHIAVE_SESSIONE, chiave); } catch (e) { /* ignorato */ }

    fetch("/api/iscrizioni-test-admin", {
      headers: { "X-Test-Admin-Key": chiave }
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error(body.error || "Errore nel caricamento.");
          return body;
        });
      })
      .then(function (righe) {
        statusEl.hidden = true;
        righeCorrenti = righe;
        chiaveUsataPerCaricare = chiave;
        renderizzaElenco();
      })
      .catch(function (err) { mostraStatus(err.message, true); });
  }

  // Filtra per nome/cognome/email (case-insensitive, sottostringa) sulle
  // righe già in memoria — nessuna nuova chiamata all'API.
  function renderizzaElenco() {
    var filtro = inputCerca.value.trim().toLowerCase();
    var righe = !filtro ? righeCorrenti : righeCorrenti.filter(function (r) {
      return persone(r).some(function (p) {
        return ((p.nome || "") + " " + (p.cognome || "") + " " + (p.email || "")).toLowerCase().indexOf(filtro) !== -1;
      });
    });

    tbody.innerHTML = "";
    emptyEl.hidden = righe.length > 0;
    righe.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + escapeHtml(testoPersone(r)) + "</td>" +
        "<td>" + escapeHtml(r.tipoPagamento) + "</td>" +
        "<td><code>" + escapeHtml(r.iscrizioneId) + "</code></td>" +
        "<td>" + escapeHtml(r.stato) + "</td>" +
        "<td>" + r.importoTotale.toFixed(2) + " €</td>" +
        "<td><code>" + escapeHtml(r.stripePaymentIntentId || "—") + "</code></td>" +
        "<td>" + new Date(r.createdAt).toLocaleString("it-IT") + "</td>" +
        "<td></td>";
      var tdAzioni = tr.lastElementChild;
      if (r.stato === "confermato") {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn--outline btn--small";
        btn.textContent = "Segna come rimborsato";
        btn.addEventListener("click", function () { segnaRimborsato(r, chiaveUsataPerCaricare); });
        tdAzioni.appendChild(btn);
      } else {
        tdAzioni.textContent = "—";
      }
      tbody.appendChild(tr);
    });
  }

  inputCerca.addEventListener("input", renderizzaElenco);

  function segnaRimborsato(record, chiave) {
    if (!window.confirm("Segnare come rimborsata l'iscrizione " + record.iscrizioneId + "? " +
      "Ricorda: il rimborso vero va fatto dal Dashboard Stripe (payment_intent_id sopra), questo aggiorna solo il record di test.")) {
      return;
    }
    fetch("/api/iscrizioni-test-admin/rimborso", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Test-Admin-Key": chiave },
      body: JSON.stringify({ tipoPagamento: record.tipoPagamento, iscrizioneId: record.iscrizioneId })
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error(body.error || "Errore nel registrare il rimborso.");
          return body;
        });
      })
      .then(function () { caricaElenco(); })
      .catch(function (err) { mostraStatus(err.message, true); });
  }

  btnCarica.addEventListener("click", caricaElenco);

  // --- Sconto socio sugli eventi (vedi config-sconto-test.js) ---
  var inputScontoEuro = document.getElementById("sconto-euro");
  var inputScontoMaxEventi = document.getElementById("sconto-max-eventi");
  var scontoStatus = document.getElementById("sconto-status");

  function mostraScontoStatus(testo, errore) {
    scontoStatus.textContent = testo;
    scontoStatus.hidden = false;
    scontoStatus.style.color = errore ? "var(--color-terracotta, #b5533c)" : "inherit";
  }

  function chiaveCorrente() {
    var chiave = inputChiave.value;
    if (!chiave) {
      mostraScontoStatus("Inserisci prima la chiave admin di test (in cima alla pagina).", true);
      return null;
    }
    return chiave;
  }

  document.getElementById("btn-carica-sconto").addEventListener("click", function () {
    var chiave = chiaveCorrente();
    if (!chiave) return;
    scontoStatus.hidden = true;
    fetch("/api/config-sconto-test", { headers: { "X-Test-Admin-Key": chiave } })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error(body.error || "Errore nel caricamento.");
          return body;
        });
      })
      .then(function (config) {
        inputScontoEuro.value = config.scontoSocioEuro;
        inputScontoMaxEventi.value = config.scontoSocioMaxEventi;
      })
      .catch(function (err) { mostraScontoStatus(err.message, true); });
  });

  document.getElementById("btn-salva-sconto").addEventListener("click", function () {
    var chiave = chiaveCorrente();
    if (!chiave) return;
    scontoStatus.hidden = true;
    fetch("/api/config-sconto-test", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Test-Admin-Key": chiave },
      body: JSON.stringify({
        scontoSocioEuro: parseFloat(inputScontoEuro.value),
        scontoSocioMaxEventi: parseInt(inputScontoMaxEventi.value, 10)
      })
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error(body.error || "Errore nel salvataggio.");
          return body;
        });
      })
      .then(function () { mostraScontoStatus("Salvato.", false); })
      .catch(function (err) { mostraScontoStatus(err.message, true); });
  });
})();
