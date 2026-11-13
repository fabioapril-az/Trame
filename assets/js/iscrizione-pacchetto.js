// Wizard di iscrizione a un pacchetto (iscrizione-pacchetto.html?id=ID) — un
// evento a più date collegate (vedi pacchetto.html). Sempre pagamento
// online Stripe, chiunque sia: nessun percorso "socio già riconosciuto
// senza pagamento" come in iscrizione-evento.html — lo sconto socio (se
// spetta) lo calcola il server persona per persona, qui si mostra solo un
// totale senza sconti come anteprima, stesso principio del wizard a tre
// prezzi degli eventi normali.

(function () {
  var CONSENSO_VERSIONE = "1.0"; // versione dell'informativa privacy corrente (privacy.html)

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function formattaData(isoDate) {
    if (!isoDate) return "Data da definire";
    var parti = isoDate.split("-");
    return parti[2] + "/" + parti[1] + "/" + parti[0];
  }

  function formattaPrezzo(valore) {
    return Number(valore).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  // Quota tessera e testo vantaggi per il passaggio "Associati a TraMe".
  var impostazioni = null;
  window.trameFetch("/api/impostazioni")
    .then(function (valori) { impostazioni = valori; })
    .catch(function () { /* il passaggio funziona anche senza, solo senza importo */ });

  var pacchettoId = new URLSearchParams(window.location.search).get("id");
  var params = new URLSearchParams(window.location.search);
  var pagamentoParam = params.get("pagamento"); // "confermato"|"annullato", solo al ritorno da Stripe

  var titoloEl = document.getElementById("pacchetto-titolo");
  var sottotitoloEl = document.getElementById("pacchetto-sottotitolo");
  var loadingEl = document.getElementById("pacchetto-loading");
  var chiusoEl = document.getElementById("pacchetto-chiuso");
  var wizardEl = document.getElementById("wizard-pagamento");
  var esitoEl = document.getElementById("esito-finale");

  if (!pacchettoId) {
    loadingEl.hidden = true;
    chiusoEl.hidden = false;
    chiusoEl.textContent = "Manca l'identificativo dell'evento nel link.";
    return;
  }

  window.trameFetch("/api/pacchetti-eventi/" + encodeURIComponent(pacchettoId))
    .then(function (pacchetto) {
      loadingEl.hidden = true;
      titoloEl.textContent = pacchetto.nome;
      var sottoEventi = pacchetto.sottoEventi || [];
      var dateTesto = sottoEventi.map(function (ev) { return formattaData(ev.dataEvento); }).join(" e ");
      sottotitoloEl.textContent = "Più date: " + dateTesto + ". Puoi partecipare a una sola o a tutte.";

      if (pacchetto.stato !== "aperto") {
        chiusoEl.hidden = false;
        chiusoEl.textContent = "Le iscrizioni a questo evento non sono attualmente aperte.";
        return;
      }

      if (pagamentoParam === "confermato") {
        esitoEl.hidden = false;
        esitoEl.innerHTML = "<h3>Pagamento confermato!</h3><p>Ti aspettiamo all'evento. Riceverai conferma via email.</p>";
        return;
      }

      if (pagamentoParam === "annullato") {
        document.getElementById("pagamento-annullato-nota").hidden = false;
      }

      inizializzaWizard(pacchetto, sottoEventi);
      wizardEl.hidden = false;
    })
    .catch(function (err) {
      loadingEl.hidden = true;
      titoloEl.textContent = "Evento non disponibile";
      chiusoEl.hidden = false;
      chiusoEl.textContent = err.message;
    });

  function inizializzaWizard(pacchetto, sottoEventi) {
    var pgCombinazione = document.getElementById("pg-combinazione");
    var pgNumeroPersone = document.getElementById("pg-numero-persone");
    var pgBlocchiPersone = document.getElementById("pg-blocchi-persone");
    var pgBlocchiAperitivo = document.getElementById("pg-blocchi-aperitivo");
    var pgTotale = document.getElementById("pg-totale");
    var pgStatus = document.getElementById("pg-status");
    var pgBtnPaga = document.getElementById("pg-btn-paga");

    document.getElementById("pg-date-info").textContent =
      "Date collegate: " + sottoEventi.map(function (ev) {
        return ev.titolo + " (" + formattaData(ev.dataEvento) + ")";
      }).join(" · ");

    function popolaSelectNumerico(select, min, max) {
      select.innerHTML = "";
      for (var n = min; n <= max; n++) {
        var option = document.createElement("option");
        option.value = n;
        option.textContent = n;
        select.appendChild(option);
      }
    }
    popolaSelectNumerico(pgNumeroPersone, 1, 6);

    // "Tutte le date" in cima (richiesto dall'utente: è la scelta che
    // l'associazione vuole in evidenza, con lo sconto incluso), poi le
    // singole date. Solo se il pacchetto ha davvero uno sconto configurato
    // — altrimenti il server la rifiuterebbe (409 sconto_non_configurato) e
    // non avrebbe senso offrirla.
    if (pacchetto.scontoTutteLeDate != null) {
      var opzioneTutte = document.createElement("option");
      opzioneTutte.value = "tutte";
      opzioneTutte.textContent = "Tutte le date (sconto incluso)";
      pgCombinazione.appendChild(opzioneTutte);
    }
    sottoEventi.forEach(function (ev) {
      var opzione = document.createElement("option");
      opzione.value = String(ev.id);
      opzione.textContent = "Solo " + ev.titolo + " — " + formattaData(ev.dataEvento);
      pgCombinazione.appendChild(opzione);
    });

    function sottoEventiScelti() {
      if (pgCombinazione.value === "tutte") {
        return sottoEventi;
      }
      var id = parseInt(pgCombinazione.value, 10);
      return sottoEventi.filter(function (ev) { return ev.id === id; });
    }

    function leggiPersoneDaBlocchi(validare) {
      var blocchi = pgBlocchiPersone.querySelectorAll(".admin-panel");
      var persone = [];
      for (var i = 0; i < blocchi.length; i++) {
        var nome = blocchi[i].querySelector(".pg-persona-nome");
        var cognome = blocchi[i].querySelector(".pg-persona-cognome");
        var email = blocchi[i].querySelector(".pg-persona-email");
        var consenso = blocchi[i].querySelector(".pg-persona-consenso");
        var newsletter = blocchi[i].querySelector(".pg-persona-newsletter");
        if (validare) {
          if (!nome.reportValidity() || !cognome.reportValidity() || !email.reportValidity() || !consenso.reportValidity()) {
            return null;
          }
        }
        // Mostrata a tutti indistintamente, socio o non-socio: per chi
        // risulta già socio il backend non scrive né legge questi tre
        // campi (stesso principio già verificato sul checkout eventi).
        persone.push({
          nome: nome.value.trim(),
          cognome: cognome.value.trim(),
          email: email.value.trim(),
          consensoAccettato: consenso.checked,
          consensoVersione: CONSENSO_VERSIONE,
          consensoNewsletter: newsletter.checked
        });
      }
      if (validare) {
        var viste = {};
        for (var j = 0; j < persone.length; j++) {
          var norm = persone[j].email.toLowerCase();
          if (viste[norm]) {
            pgStatus.textContent = "L'email " + persone[j].email + " è ripetuta su più persone: ogni persona richiede un'email diversa.";
            pgStatus.hidden = false;
            return null;
          }
          viste[norm] = true;
        }
      }
      return persone;
    }

    function generaBlocchiPersone(n) {
      var precedenti = leggiPersoneDaBlocchi(false) || [];
      pgBlocchiPersone.innerHTML = "";
      for (var i = 0; i < n; i++) {
        var blocco = document.createElement("div");
        blocco.className = "admin-panel";
        blocco.style.cssText = "margin:16px 0; padding:16px; border:1px solid var(--color-line); " +
          "border-radius:10px; background:var(--color-cream-alt);";
        blocco.innerHTML =
          "<h4 style=\"margin:0 0 14px; padding-bottom:8px; font-size:1.05rem; " +
          "color:var(--color-terracotta-dark); border-bottom:1px solid var(--color-line);\">Persona " + (i + 1) + "</h4>" +
          "<div class=\"form-row\"><label>Nome</label><input type=\"text\" class=\"pg-persona-nome\" maxlength=\"100\" required></div>" +
          "<div class=\"form-row\"><label>Cognome</label><input type=\"text\" class=\"pg-persona-cognome\" maxlength=\"100\" required></div>" +
          "<div class=\"form-row\"><label>Email</label><input type=\"email\" class=\"pg-persona-email\" maxlength=\"255\" required></div>" +
          "<div class=\"form-row form-row--checkbox\"><label><input type=\"checkbox\" class=\"pg-persona-newsletter\"> " +
          "Vuole ricevere anche la nostra newsletter, con gli altri eventi e novità di TraMe?</label></div>" +
          "<div class=\"form-row form-row--checkbox\"><label><input type=\"checkbox\" class=\"pg-persona-consenso\" required> " +
          "<span>Ho letto e accetto <a href=\"privacy.html\" target=\"_blank\" rel=\"noopener\" class=\"link-documentazione\">l'informativa privacy</a> per questa persona.</span></label></div>";
        if (precedenti[i]) {
          blocco.querySelector(".pg-persona-nome").value = precedenti[i].nome;
          blocco.querySelector(".pg-persona-cognome").value = precedenti[i].cognome;
          blocco.querySelector(".pg-persona-email").value = precedenti[i].email;
          blocco.querySelector(".pg-persona-consenso").checked = Boolean(precedenti[i].consensoAccettato);
          blocco.querySelector(".pg-persona-newsletter").checked = Boolean(precedenti[i].consensoNewsletter);
        }
        pgBlocchiPersone.appendChild(blocco);
      }
    }

    // Un numero (0-6) per ciascuna data scelta che ha un prezzo aperitivo
    // configurato — indipendente da chi partecipa all'evento vero e
    // proprio, come per gli eventi normali, ma qui ripetuto per ogni data
    // incluse nella combinazione scelta (non per l'intero pacchetto).
    function generaBlocchiAperitivo() {
      var precedenti = {};
      pgBlocchiAperitivo.querySelectorAll("[data-evento-id]").forEach(function (blocco) {
        precedenti[blocco.getAttribute("data-evento-id")] = blocco.querySelector("select").value;
      });
      pgBlocchiAperitivo.innerHTML = "";
      sottoEventiScelti().forEach(function (ev) {
        if (ev.prezzoAperitivoPersona == null) return;
        var riga = document.createElement("div");
        riga.className = "form-row";
        riga.setAttribute("data-evento-id", ev.id);
        riga.innerHTML =
          "<label>Persone solo aperitivo il " + formattaData(ev.dataEvento) + " (0-6)</label><select></select>";
        var select = riga.querySelector("select");
        for (var n = 0; n <= 6; n++) {
          var opzione = document.createElement("option");
          opzione.value = n;
          opzione.textContent = n;
          select.appendChild(opzione);
        }
        if (precedenti[ev.id]) {
          select.value = precedenti[ev.id];
        }
        select.addEventListener("change", aggiornaTotale);
        pgBlocchiAperitivo.appendChild(riga);
      });
    }

    function leggiPersoneAperitivo() {
      var risultato = [];
      pgBlocchiAperitivo.querySelectorAll("[data-evento-id]").forEach(function (blocco) {
        var numero = parseInt(blocco.querySelector("select").value, 10);
        if (numero > 0) {
          risultato.push({ eventoId: parseInt(blocco.getAttribute("data-evento-id"), 10), numero: numero });
        }
      });
      return risultato;
    }

    // Teaser senza alcuno sconto (né socio né pacchetto): lo stesso
    // principio già usato per gli eventi, dove il totale vero lo decide
    // solo il server al momento del pagamento.
    function aggiornaTotale() {
      pgTotale.textContent = "Totale (senza eventuale sconto socio): " + formattaPrezzo(calcolaTotale());
    }

    // Stessi prezzi che usa il server: "tutte le date" con lo sconto del
    // pacchetto già incluso (prezzoTutteLeDate*), e il prezzo di gruppo
    // quando le persone sono più di una. Prima il totale mostrato era la
    // somma delle date senza sconto (es. 67 € a fronte dei 60 € chiesti da
    // Stripe), segnalato dall'utente come fonte di confusione.
    function calcolaTotale() {
      var n = parseInt(pgNumeroPersone.value, 10);
      var gruppo = n > 1;
      var totale = 0;
      var prezzoTutte = gruppo ? pacchetto.prezzoTutteLeDateGruppoPersona : pacchetto.prezzoTutteLeDateSingolo;
      if (pgCombinazione.value === "tutte" && prezzoTutte != null) {
        totale += prezzoTutte * n;
      } else {
        sottoEventiScelti().forEach(function (ev) {
          var prezzo = gruppo && ev.prezzoGruppoPersona != null ? ev.prezzoGruppoPersona : ev.prezzoSingolo;
          totale += (prezzo || 0) * n;
        });
      }
      leggiPersoneAperitivo().forEach(function (voce) {
        var ev = sottoEventi.filter(function (e) { return e.id === voce.eventoId; })[0];
        if (ev && ev.prezzoAperitivoPersona != null) {
          totale += ev.prezzoAperitivoPersona * voce.numero;
        }
      });
      return totale;
    }

    function aggiornaCampi() {
      generaBlocchiPersone(parseInt(pgNumeroPersone.value, 10));
      generaBlocchiAperitivo();
      aggiornaTotale();
    }

    pgCombinazione.addEventListener("change", aggiornaCampi);
    pgNumeroPersone.addEventListener("change", aggiornaCampi);
    aggiornaCampi();

    function nuovoRichiestaId() {
      return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : (Date.now() + "-" + Math.random());
    }

    function inviaCheckout(persone, btn, statusEl) {
      var dateScelte = sottoEventiScelti().map(function (ev) { return ev.id; });
      var payload = {
        richiestaId: nuovoRichiestaId(),
        origine: window.location.origin,
        modalita: persone.length === 1 ? "singolo" : "gruppo",
        persone: persone,
        dateScelte: dateScelte,
        personeAperitivo: leggiPersoneAperitivo()
      };
      // Statistiche: provenienza dell'acquisto, facoltativa (il backend la
      // ignora se manca o non è valida).
      if (window.TrameAnalytics) {
        Object.assign(payload, window.TrameAnalytics.datiCheckout());
      }
      btn.disabled = true;
      btn.textContent = "Reindirizzamento a Stripe…";
      window.trameFetch("/api/pacchetti-eventi/" + encodeURIComponent(pacchettoId) + "/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (result) {
          if (result && result.url) {
            window.location.href = result.url;
            return;
          }
          esitoEl.hidden = false;
          wizardEl.hidden = true;
          esitoEl.innerHTML = "<h3>Iscrizione registrata!</h3><p>Ti contatteremo a breve per completare il pagamento.</p>";
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = "Vai al pagamento";
          statusEl.textContent = err.message;
          statusEl.hidden = false;
        });
    }

    // ---------- Passaggio "Associati a TraMe" ----------
    // Stessa logica di iscrizione-evento.js (duplicata: nessun modulo
    // condiviso in questo sito). Un pacchetto non ha un proprio "aperto ai
    // non soci": associarsi è obbligatorio se almeno una delle date scelte è
    // riservata ai soci, facoltativo se lo sono tutte. Se il dato manca
    // (apertoNonSoci assente) la data conta come riservata.
    var pgStepDati = document.getElementById("pg-step-dati");
    var pgStepAssoc = document.getElementById("pg-step-associazione");
    var pgAssocIntro = document.getElementById("pg-assoc-intro");
    var pgAssocVantaggi = document.getElementById("pg-assoc-vantaggi");
    var pgAssocBlocchi = document.getElementById("pg-assoc-blocchi");
    var pgAssocTotale = document.getElementById("pg-assoc-totale");
    var pgAssocPaga = document.getElementById("pg-assoc-paga");
    var pgAssocStatus = document.getElementById("pg-assoc-status");

    var CF_PATTERN = "^[A-Za-z]{6}\\d{2}[A-EHLMPRSTabcdehlmprst]\\d{2}([A-Za-z]\\d{3}|\\d{4})[A-Za-z]$";
    var personeInAttesa = null;
    var associazioneObbligatoria = true;

    function quotaTessera() {
      var quota = impostazioni && impostazioni.quotaIscrizioneSoci;
      return quota != null ? Number(quota) : null;
    }

    function etaInAnni(isoDate) {
      var nascita = new Date(isoDate + "T00:00:00");
      var oggi = new Date();
      var eta = oggi.getFullYear() - nascita.getFullYear();
      var m = oggi.getMonth() - nascita.getMonth();
      if (m < 0 || (m === 0 && oggi.getDate() < nascita.getDate())) {
        eta--;
      }
      return eta;
    }

    function bloccoAssociazioneHtml(persona, indice, tipo, obbligatoria) {
      var html = "<h4 style=\"margin:0 0 10px; font-size:1.05rem; color:var(--color-terracotta-dark);\">" +
        escapeHtml(persona.nome + " " + persona.cognome) +
        " <span style=\"font-weight:400; font-size:0.85rem; color:var(--color-ink-soft);\">(" +
        escapeHtml(persona.email) + ")</span></h4>";
      if (!obbligatoria) {
        html += "<div class=\"form-row form-row--checkbox\"><label><input type=\"checkbox\" class=\"pg-assoc-scelta\"> <span>" +
          (tipo === "rinnovo" ? "Rinnova anche la tessera di questa persona" : "Associa anche questa persona a TraMe") +
          "</span></label></div>";
      }
      html += "<div class=\"pg-assoc-campi\"" + (obbligatoria ? "" : " hidden") + ">";
      if (tipo === "rinnovo") {
        html += "<p class=\"form-note\">La tessera di questa persona è scaduta: viene rinnovata per altri 12 mesi.</p>";
      } else {
        var fotoName = "pg-assoc-foto-" + indice;
        html +=
          "<div class=\"form-row\"><label>Data di nascita</label><input type=\"date\" class=\"pg-assoc-nascita\" required></div>" +
          "<div class=\"form-row\"><label>Codice fiscale</label><input type=\"text\" class=\"pg-assoc-cf\" maxlength=\"16\" required pattern=\"" + CF_PATTERN + "\" title=\"Formato codice fiscale non valido\"></div>" +
          "<div class=\"form-row\"><label>Telefono (facoltativo)</label><input type=\"tel\" class=\"pg-assoc-telefono\" maxlength=\"20\"></div>" +
          "<div class=\"form-row\"><label>Indirizzo (facoltativo)</label><input type=\"text\" class=\"pg-assoc-indirizzo\" maxlength=\"255\"></div>" +
          "<div class=\"form-row\"><label>Città (facoltativo)</label><input type=\"text\" class=\"pg-assoc-citta\" maxlength=\"100\"></div>" +
          "<div class=\"form-row\"><label>CAP (facoltativo)</label><input type=\"text\" class=\"pg-assoc-cap\" maxlength=\"10\"></div>" +
          "<div class=\"form-row\"><label>Autorizzi Progetto TraMe, i suoi amministratori e i talenti che conducono gli eventi a pubblicare, sui propri canali social e nel materiale promozionale, foto e video in cui compari? " +
          "<a href=\"consenso-foto.html\" target=\"_blank\" rel=\"noopener\" class=\"link-documentazione\">(documentazione)</a></label>" +
          "<div class=\"form-row--radio-pair\">" +
          "<label><input type=\"radio\" name=\"" + fotoName + "\" class=\"pg-assoc-foto\" value=\"si\" required> Sì</label>" +
          "<label><input type=\"radio\" name=\"" + fotoName + "\" class=\"pg-assoc-foto\" value=\"no\" required> No</label>" +
          "</div></div>";
      }
      html += "</div>";
      return html;
    }

    function aggiornaTotaleAssociazione() {
      var tessere = associazioneObbligatoria
        ? pgAssocBlocchi.querySelectorAll(".admin-panel").length
        : pgAssocBlocchi.querySelectorAll(".pg-assoc-scelta:checked").length;
      var totale = calcolaTotale() + (quotaTessera() || 0) * tessere;
      pgAssocTotale.textContent = "Totale (evento" + (tessere ? " + " + tessere + (tessere === 1 ? " tessera" : " tessere") : "") +
        ", senza eventuale sconto socio): " + formattaPrezzo(totale);
    }

    function mostraStepAssociazione(persone, daAssociare) {
      associazioneObbligatoria = sottoEventiScelti().some(function (ev) { return ev.apertoNonSoci !== true; });
      var quota = quotaTessera();
      var testoQuota = quota != null ? " (" + formattaPrezzo(quota) + ", valida 12 mesi)" : "";
      pgAssocIntro.textContent = associazioneObbligatoria
        ? "Per partecipare a questo evento serve essere soci di TraMe. Completa i dati qui sotto: la tessera" + testoQuota + " viene aggiunta allo stesso pagamento dell'evento."
        : "Questo evento è aperto anche a chi non è socio. Se vuoi puoi associarti ora: la tessera" + testoQuota + " viene aggiunta allo stesso pagamento dell'evento.";
      var vantaggi = impostazioni && impostazioni.testoVantaggiIscrizione;
      pgAssocVantaggi.textContent = vantaggi || "";
      pgAssocVantaggi.hidden = !vantaggi;

      pgAssocBlocchi.innerHTML = "";
      daAssociare.forEach(function (voce) {
        var blocco = document.createElement("div");
        blocco.className = "admin-panel";
        blocco.style.cssText = "margin:16px 0; padding:16px; border:1px solid var(--color-line); " +
          "border-radius:10px; background:var(--color-cream-alt);";
        blocco.setAttribute("data-indice", voce.indice);
        blocco.setAttribute("data-tipo", voce.tipo);
        blocco.innerHTML = bloccoAssociazioneHtml(persone[voce.indice], voce.indice, voce.tipo, associazioneObbligatoria);
        var scelta = blocco.querySelector(".pg-assoc-scelta");
        if (scelta) {
          scelta.addEventListener("change", function () {
            blocco.querySelector(".pg-assoc-campi").hidden = !scelta.checked;
            aggiornaTotaleAssociazione();
          });
        }
        pgAssocBlocchi.appendChild(blocco);
      });

      personeInAttesa = persone;
      pgAssocStatus.hidden = true;
      aggiornaTotaleAssociazione();
      pgStepDati.hidden = true;
      pgStepAssoc.hidden = false;
      pgStepAssoc.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    document.getElementById("pg-assoc-indietro").addEventListener("click", function () {
      pgStepAssoc.hidden = true;
      pgStepDati.hidden = false;
      personeInAttesa = null;
    });

    pgAssocPaga.addEventListener("click", function () {
      pgAssocStatus.hidden = true;
      var persone = personeInAttesa.map(function (p) {
        var copia = {};
        Object.keys(p).forEach(function (k) { copia[k] = p[k]; });
        return copia;
      });
      var blocchi = pgAssocBlocchi.querySelectorAll(".admin-panel");
      for (var i = 0; i < blocchi.length; i++) {
        var blocco = blocchi[i];
        var scelta = blocco.querySelector(".pg-assoc-scelta");
        if (!associazioneObbligatoria && !scelta.checked) {
          continue;
        }
        var indice = parseInt(blocco.getAttribute("data-indice"), 10);
        if (blocco.getAttribute("data-tipo") === "rinnovo") {
          persone[indice].tessera = { tipo: "rinnovo" };
          continue;
        }
        var campi = blocco.querySelectorAll(".pg-assoc-campi input");
        for (var c = 0; c < campi.length; c++) {
          if (!campi[c].reportValidity()) {
            return;
          }
        }
        var dataNascita = blocco.querySelector(".pg-assoc-nascita").value;
        if (etaInAnni(dataNascita) < 18) {
          pgAssocStatus.textContent = persone[indice].nome + " risulta minorenne: per i minorenni l'iscrizione all'associazione richiede il consenso di un genitore. Scrivici a info@progettotrame.org e ti aiutiamo noi.";
          pgAssocStatus.hidden = false;
          return;
        }
        var valoreOpzionale = function (cls) {
          var v = blocco.querySelector(cls).value.trim();
          return v || null;
        };
        persone[indice].tessera = {
          tipo: "nuova",
          dataNascita: dataNascita,
          codiceFiscale: blocco.querySelector(".pg-assoc-cf").value.trim().toUpperCase(),
          telefono: valoreOpzionale(".pg-assoc-telefono"),
          indirizzo: valoreOpzionale(".pg-assoc-indirizzo"),
          citta: valoreOpzionale(".pg-assoc-citta"),
          cap: valoreOpzionale(".pg-assoc-cap"),
          consensoFoto: blocco.querySelector(".pg-assoc-foto:checked").value === "si"
        };
      }
      inviaCheckout(persone, pgAssocPaga, pgAssocStatus);
    });

    pgBtnPaga.addEventListener("click", function () {
      pgStatus.hidden = true;
      var persone = leggiPersoneDaBlocchi(true);
      if (!persone) {
        return;
      }
      pgBtnPaga.disabled = true;
      pgBtnPaga.textContent = "Verifica in corso…";
      var richieste = persone.map(function (p) {
        return window.trameFetch("/api/soci/verifica?email=" + encodeURIComponent(p.email) +
          "&nome=" + encodeURIComponent(p.nome) + "&cognome=" + encodeURIComponent(p.cognome));
      });
      if (quotaTessera() == null) {
        richieste.push(window.trameFetch("/api/impostazioni")
          .then(function (valori) { impostazioni = valori; })
          .catch(function () { /* il passaggio funziona anche senza, solo senza importo */ }));
      }
      Promise.all(richieste)
        .then(function (risultati) {
          pgBtnPaga.disabled = false;
          pgBtnPaga.textContent = "Vai al pagamento";
          // Senza dire a chi appartiene l'email (vedi iscrizione-evento.js).
          var nomeDiverso = persone.filter(function (p, i) { return risultati[i].nomeCorrisponde === false; })[0];
          if (nomeDiverso) {
            pgStatus.textContent = "L'email " + nomeDiverso.email + " è già associata a un altro socio, con un nome diverso. " +
              "Usa la tua email personale: se non sei ancora socio potrai associarti nello stesso pagamento. " +
              "Se l'email è tua, scrivi nome e cognome come li hai indicati all'iscrizione, oppure scrivici a info@progettotrame.org.";
            pgStatus.hidden = false;
            return;
          }
          var daAssociare = [];
          persone.forEach(function (p, i) {
            var v = risultati[i];
            if (!v.trovato) {
              daAssociare.push({ indice: i, tipo: "nuova" });
            } else if (v.richiedeRinnovoObbligatorio) {
              daAssociare.push({ indice: i, tipo: "rinnovo" });
            }
          });
          if (!daAssociare.length) {
            inviaCheckout(persone, pgBtnPaga, pgStatus);
            return;
          }
          mostraStepAssociazione(persone, daAssociare);
        })
        .catch(function (err) {
          pgBtnPaga.disabled = false;
          pgBtnPaga.textContent = "Vai al pagamento";
          pgStatus.textContent = err.message;
          pgStatus.hidden = false;
        });
    });
  }
})();
