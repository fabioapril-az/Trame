// Vista unificata di tutti i pagamenti (eventi + tessere/rinnovi), pensata
// per non dover più aprire "Vedi iscritti" evento per evento (segnalato
// dall'utente come amministrativamente scomodo). Login MSAL condiviso con
// admin.html/admin-soci.html: qui basta il ruolo VistaSoci (Segretario/
// Presidente/Vicepresidente-Tesoriere/Admin), verificato dall'API a ogni
// chiamata — questa pagina non decide da sola chi può fare cosa.

(function () {
  var DIMENSIONE_PAGINA = 10;
  var stato = { pagina: 1, totale: 0 };

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
    caricaEventiFiltro();
    cercaPagamenti();
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

  // --- Filtro Evento: elenco eventi per la dropdown (lista aperta a
  // qualunque utente autenticato, indipendentemente dal ruolo — non serve
  // GestioneEventi, solo essere loggati). ---

  function caricaEventiFiltro() {
    apiFetchAuth("/api/eventi")
      .then(function (eventi) {
        var select = document.getElementById("pag-filtro-evento");
        eventi.forEach(function (ev) {
          var option = document.createElement("option");
          option.value = ev.id;
          option.textContent = ev.titolo;
          select.appendChild(option);
        });
      })
      .catch(function () { /* dropdown resta con solo "Tutti gli eventi": non blocca il resto della pagina */ });
  }

  // --- Elenco pagamenti ---

  var TIPO_LABELS = { evento: "Evento", tessera: "Tessera" };
  var STATO_LABELS = {
    confermata: "Confermata", in_attesa: "In attesa pagamento", annullata: "Annullata",
    rimborso_richiesto: "Rimborso richiesto", rimborsato: "Rimborsato",
    in_attesa_pagamento_manuale: "In attesa pagamento manuale"
  };
  var METODO_PAGAMENTO_LABELS = {
    card: "Carta", paypal: "PayPal", klarna: "Klarna", satispay: "Satispay",
    amazon_pay: "Amazon Pay", link: "Link", apple_pay: "Apple Pay", google_pay: "Google Pay",
    bonifico: "Bonifico", contante: "Contante"
  };

  function cercaPagamenti() {
    var tipo = document.getElementById("pag-filtro-tipo").value;
    var eventoId = document.getElementById("pag-filtro-evento").value;
    var mese = document.getElementById("pag-filtro-mese").value;
    var anno = document.getElementById("pag-filtro-anno").value;

    var query = "?pagina=" + stato.pagina + "&dimensionePagina=" + DIMENSIONE_PAGINA;
    if (tipo) query += "&tipo=" + encodeURIComponent(tipo);
    if (eventoId) query += "&eventoId=" + encodeURIComponent(eventoId);
    if (mese) query += "&mese=" + encodeURIComponent(mese);
    if (anno) query += "&anno=" + encodeURIComponent(anno);

    apiFetchAuth("/api/pagamenti" + query)
      .then(function (result) {
        stato.totale = result.totale;
        var tbody = document.getElementById("pagamenti-tabella-body");
        tbody.innerHTML = "";
        document.getElementById("pagamenti-empty").hidden = result.risultati.length > 0;

        result.risultati.forEach(function (p) {
          var nomeCompleto = (p.nome || p.cognome) ? ((p.nome || "") + " " + (p.cognome || "")).trim() : "—";
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + escapeHtml(TIPO_LABELS[p.tipo] || p.tipo) + "</td>" +
            "<td>" + escapeHtml(p.riferimento) + "</td>" +
            "<td>" + escapeHtml(nomeCompleto) + "</td>" +
            "<td>" + escapeHtml(p.email) + "</td>" +
            "<td>" + (p.numeroPersone || 1) + "</td>" +
            "<td>" + escapeHtml(p.opzionePartecipazioneNome || "—") + "</td>" +
            "<td>" + escapeHtml(STATO_LABELS[p.stato] || p.stato) + "</td>" +
            "<td>" + (p.importoPagato != null ? p.importoPagato + " €" : "—") + "</td>" +
            "<td>" + escapeHtml(METODO_PAGAMENTO_LABELS[p.metodoPagamento] || p.metodoPagamento || "—") + "</td>" +
            "<td>" + escapeHtml(p.allergieNote || "—") + "</td>" +
            "<td>" + escapeHtml(p.data || "—") + "</td>";
          tbody.appendChild(tr);
        });

        var totalePagine = Math.max(1, Math.ceil(stato.totale / DIMENSIONE_PAGINA));
        document.getElementById("pagamenti-pagina-label").textContent =
          "Pagina " + stato.pagina + " di " + totalePagine + " (" + stato.totale + " pagamenti)";
        document.getElementById("btn-pagina-prec").disabled = stato.pagina <= 1;
        document.getElementById("btn-pagina-succ").disabled = stato.pagina >= totalePagine;
      })
      .catch(function (err) { window.alert(err.message); });
  }

  document.getElementById("btn-cerca-pagamenti").addEventListener("click", function () {
    stato.pagina = 1;
    cercaPagamenti();
  });
  document.getElementById("btn-reset-pagamenti").addEventListener("click", function () {
    document.getElementById("pag-filtro-tipo").value = "";
    document.getElementById("pag-filtro-evento").value = "";
    document.getElementById("pag-filtro-mese").value = "";
    document.getElementById("pag-filtro-anno").value = "";
    stato.pagina = 1;
    cercaPagamenti();
  });
  document.getElementById("btn-pagina-prec").addEventListener("click", function () { stato.pagina--; cercaPagamenti(); });
  document.getElementById("btn-pagina-succ").addEventListener("click", function () { stato.pagina++; cercaPagamenti(); });
})();
