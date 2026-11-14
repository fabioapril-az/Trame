// Iscrizione a un evento (iscrizione-evento.html?id=EVENTO_ID): solo il
// wizard con pagamento Stripe, per gli eventi con i prezzi Singolo/Gruppo/
// Aperitivo. Il vecchio modulo senza pagamento (POST /api/eventi/{id}/
// iscriviti, "modalità di partecipazione", richiesta di associazione via
// email) è stato tolto il 2026-11-14 su decisione dell'utente: un evento
// senza prezzi mostra solo un messaggio con il contatto della segreteria.

(function () {
  var CONSENSO_VERSIONE = "1.0"; // versione dell'informativa privacy corrente (privacy.html)

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  // Volutamente senza dire a chi appartiene l'email: non va rivelato il
  // nome del socio a chi ha scritto la sua email.
  function messaggioNomeDiverso(email) {
    return "L'email " + email + " è già associata a un altro socio, con un nome diverso. " +
      "Usa la tua email personale: se non sei ancora socio potrai associarti nello stesso pagamento. " +
      "Se l'email è tua, scrivi nome e cognome come li hai indicati all'iscrizione, oppure scrivici a info@progettotrame.org.";
  }

  // "32,00 €": stesso formato delle schede in eventi.html.
  function formattaEuro(valore) {
    return Number(valore).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  // condizioniCancellazione arriva dall'editor Quill di admin.html (HTML),
  // quindi va sanitizzato prima di inserirlo con innerHTML — stesso pattern
  // di events.js/evento-dettaglio.js, duplicato qui per la stessa ragione
  // (nessun modulo condiviso in questo sito).
  function sanitizzaHtml(html) {
    if (!window.DOMPurify) {
      var div = document.createElement("div");
      div.innerHTML = html;
      return escapeHtml(div.textContent);
    }
    return window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "span", "ol", "ul", "li", "a"],
      ALLOWED_ATTR: ["href", "target", "rel", "class", "data-list"]
    });
  }

  var paramsUrl = new URLSearchParams(window.location.search);
  var eventoId = paramsUrl.get("id");
  var pagamentoParam = paramsUrl.get("pagamento"); // "confermato"|"annullato", solo al ritorno da Stripe

  var titoloEl = document.getElementById("evento-titolo");
  var sottotitoloEl = document.getElementById("evento-sottotitolo");
  var loadingEl = document.getElementById("evento-loading");
  var chiusoEl = document.getElementById("evento-chiuso");
  var esitoEl = document.getElementById("esito-finale");

  var stato = { apertoNonSoci: false, impostazioni: null };

  if (!eventoId) {
    titoloEl.textContent = "Link non valido";
    loadingEl.hidden = true;
    chiusoEl.hidden = false;
    chiusoEl.textContent = "Manca l'identificativo dell'evento nel link.";
    return;
  }

  window.trameFetch("/api/impostazioni")
    .then(function (impostazioni) { stato.impostazioni = impostazioni; })
    .catch(function () { /* quota/testo vantaggi non essenziali per il resto del flusso */ });

  window.trameFetch("/api/eventi/" + encodeURIComponent(eventoId))
    .then(function (evento) {
      loadingEl.hidden = true;
      titoloEl.textContent = evento.titolo;
      stato.apertoNonSoci = Boolean(evento.apertoNonSoci);
      // Un evento annunciato può non avere ancora la data.
      var dettagli = [evento.dataEvento ? formattaData(evento.dataEvento) : null, evento.luogo || null]
        .filter(Boolean).join(" · ");
      if (evento.quotaEvento) {
        dettagli += " · quota: " + evento.quotaEvento + " €";
      }
      sottotitoloEl.textContent = dettagli;

      if (evento.stato !== "aperto") {
        chiusoEl.hidden = false;
        chiusoEl.textContent = "Le iscrizioni a questo evento non sono attualmente aperte.";
        return;
      }

      // Ritorno da Stripe dopo un pagamento riuscito: nessun wizard, solo
      // l'esito (l'URL è quello che il backend .NET genera nel redirect).
      if (pagamentoParam === "confermato") {
        esitoEl.hidden = false;
        esitoEl.innerHTML = "<h3>Pagamento confermato!</h3><p>Ti aspettiamo all'evento. Riceverai conferma via email.</p>";
        return;
      }

      // Ci si iscrive solo con i prezzi Singolo/Gruppo/Aperitivo. Il vecchio
      // modulo senza prezzi (iscrizione con la sola email, "modalità di
      // partecipazione", richiesta di associazione) è stato tolto su
      // decisione dell'utente: per aprire le iscrizioni l'admin richiede
      // almeno un prezzo. Un evento gratuito andrà progettato a parte.
      var usaPrezziPagamento = evento.prezzoSingolo != null || evento.prezzoGruppoPersona != null || evento.prezzoAperitivoPersona != null;
      if (!usaPrezziPagamento) {
        chiusoEl.hidden = false;
        chiusoEl.innerHTML = "L'iscrizione online a questo evento non è disponibile. Per informazioni scrivici a " +
          '<a href="mailto:info@progettotrame.org">info@progettotrame.org</a>.';
        return;
      }
      if (pagamentoParam === "annullato") {
        document.getElementById("pagamento-annullato-nota").hidden = false;
      }
      inizializzaWizardPagamento(evento);
      document.getElementById("wizard-pagamento").hidden = false;
    })
    .catch(function (err) {
      loadingEl.hidden = true;
      titoloEl.textContent = "Evento non disponibile";
      chiusoEl.hidden = false;
      chiusoEl.textContent = err.message;
    });

  function formattaData(isoDate) {
    var parti = isoDate.split("-");
    return parti[2] + "/" + parti[1] + "/" + parti[0];
  }

  // ================= Wizard di pagamento (Stripe) =================
  // Attivo solo per eventi con prezzoSingolo/prezzoGruppoPersona/
  // prezzoAperitivoPersona (vedi sopra) — nessuna verifica socio qui, lo
  // sconto (se spetta) lo calcola il server persona per persona al submit.
  // Stessa logica già validata in Fase 1 (test-pagamento.html/js).
  function inizializzaWizardPagamento(evento) {
    var pgModalita = document.getElementById("pg-modalita");
    var pgCampoModalita = document.getElementById("pg-campo-modalita");
    var pgCampoNumeroGruppo = document.getElementById("pg-campo-numero-gruppo");
    var pgNumeroGruppo = document.getElementById("pg-numero-gruppo");
    var pgBlocchiPersone = document.getElementById("pg-blocchi-persone");
    var pgCampoAperitivo = document.getElementById("pg-campo-aperitivo");
    var pgAperitivo = document.getElementById("pg-aperitivo");
    var pgCampoAllergie = document.getElementById("pg-campo-allergie");
    var pgAllergie = document.getElementById("pg-allergie");
    var pgTotale = document.getElementById("pg-totale");
    var pgStatus = document.getElementById("pg-status");
    var pgBtnPaga = document.getElementById("pg-btn-paga");

    // Testo libero facoltativo impostato in admin: mostrato prima di pagare,
    // non sulla scheda pubblica dell'evento (segnalato dall'utente come
    // informazione mancante).
    var pgCondizioniCancellazione = document.getElementById("pg-condizioni-cancellazione");
    if (evento.condizioniCancellazione) {
      pgCondizioniCancellazione.innerHTML = "<strong>Politica di cancellazione e rimborsi:</strong> " + sanitizzaHtml(evento.condizioniCancellazione);
      pgCondizioniCancellazione.hidden = false;
    }

    // Assente sugli eventi creati prima di questo campo: di default attivo
    // (comportamento di sempre). Se disattivato dall'admin (es. Stripe
    // temporaneamente sospeso per questo evento), il bottone non promette
    // un pagamento online: registra e basta, si paga a parte.
    var pagamentoOnlineAttivo = evento.pagamentoOnlineAttivo !== false;
    var testoBtnPaga = pagamentoOnlineAttivo ? "Vai al pagamento" : "Invia iscrizione";
    pgBtnPaga.textContent = testoBtnPaga;

    function popolaSelectNumerico(select, min, max) {
      select.innerHTML = "";
      for (var n = min; n <= max; n++) {
        var option = document.createElement("option");
        option.value = n;
        option.textContent = n;
        select.appendChild(option);
      }
    }
    popolaSelectNumerico(pgAperitivo, 0, 6);

    // Quali modalità offrire dipende da quali prezzi ha l'evento — "Solo
    // aperitivo" per chi vuole unirsi solo al dopo evento, senza
    // partecipare a quello principale (richiesta utente).
    var ETICHETTE_MODALITA = { singolo: "Singolo", gruppo: "Gruppo (2-6 persone)", aperitivo: "Solo aperitivo (1-6 persone)" };
    function modalitaDisponibili() {
      var opzioni = [];
      if (evento.prezzoSingolo != null) opzioni.push("singolo");
      if (evento.prezzoGruppoPersona != null) opzioni.push("gruppo");
      if (evento.prezzoAperitivoPersona != null) opzioni.push("aperitivo");
      return opzioni;
    }
    function modalitaAttiva() {
      var opzioni = modalitaDisponibili();
      return opzioni.length > 1 ? pgModalita.value : opzioni[0];
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
        // risulta già socio al momento del pagamento il backend non scrive
        // né legge questi tre campi (verificato), quindi non serve
        // determinarlo qui prima — una chiamata in più per persona (fino a
        // 6) senza alcun beneficio di correttezza, solo estetico.
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
          // Mostrate a tutti: chi risulta già socio non le vede scritte da
          // nessuna parte (il server le ignora per lui), quindi non c'è un
          // caso in cui vadano nascoste. Facoltativa la newsletter, come
          // ovunque; obbligatorio il consenso, come sull'altro wizard.
          "<div class=\"form-row form-row--checkbox\"><label><input type=\"checkbox\" class=\"pg-persona-newsletter\"> " +
          "Vuole ricevere anche la nostra newsletter, con gli altri eventi e novità di TraMe?</label></div>" +
          "<div class=\"form-row form-row--checkbox\"><label><input type=\"checkbox\" class=\"pg-persona-consenso\" required> " +
          // <span>: senza, il flex della label mette testo e link in
          // colonne separate invece che su una frase sola.
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

    function aggiornaTotale() {
      pgTotale.textContent = "Totale (senza eventuale sconto socio): " + formattaEuro(calcolaTotaleEvento());
    }

    function calcolaTotaleEvento() {
      var modalita = modalitaAttiva();
      var prezzoBase = modalita === "singolo" ? evento.prezzoSingolo
        : modalita === "gruppo" ? evento.prezzoGruppoPersona
        : evento.prezzoAperitivoPersona; // "aperitivo"
      var n = modalita === "singolo" ? 1 : parseInt(pgNumeroGruppo.value, 10);
      var totale = (prezzoBase || 0) * n;
      // Aggiunta aperitivo: nascosta (quindi ignorata) quando la modalità
      // primaria è già "aperitivo", per non contare le stesse persone due
      // volte — vedi nota sul campo in iscrizione-evento.html.
      var personeAperitivo = pgCampoAperitivo.hidden ? 0 : parseInt(pgAperitivo.value, 10);
      if (personeAperitivo > 0) {
        totale += evento.prezzoAperitivoPersona * personeAperitivo;
      }
      return totale;
    }

    // Ripopolata solo quando il minimo cambia davvero (2 per "gruppo", 1 per
    // "aperitivo"), non ad ogni aggiornaCampi(): altrimenti anche il change
    // della select stessa la faceva ripartire dal primo valore, annullando
    // la scelta appena fatta (bug reale, segnalato dall'utente).
    var numeroGruppoMinAttuale = null;

    function aggiornaCampi() {
      var opzioni = modalitaDisponibili();
      pgCampoModalita.hidden = opzioni.length <= 1;
      if (opzioni.length > 1 && !pgModalita.options.length) {
        opzioni.forEach(function (valore) {
          var option = document.createElement("option");
          option.value = valore;
          option.textContent = ETICHETTE_MODALITA[valore];
          pgModalita.appendChild(option);
        });
      }
      var modalita = modalitaAttiva();
      var mostraGruppo = modalita !== "singolo"; // "gruppo" o "aperitivo"
      pgCampoNumeroGruppo.hidden = !mostraGruppo;
      if (mostraGruppo) {
        var minRichiesto = modalita === "aperitivo" ? 1 : 2;
        if (numeroGruppoMinAttuale !== minRichiesto) {
          popolaSelectNumerico(pgNumeroGruppo, minRichiesto, 6);
          numeroGruppoMinAttuale = minRichiesto;
        }
      }
      pgCampoAperitivo.hidden = evento.prezzoAperitivoPersona == null || modalita === "aperitivo";
      pgCampoAllergie.hidden = evento.prezzoAperitivoPersona == null;
      var n = modalita === "singolo" ? 1 : parseInt(pgNumeroGruppo.value, 10);
      generaBlocchiPersone(n);
      aggiornaTotale();
    }

    pgModalita.addEventListener("change", aggiornaCampi);
    pgNumeroGruppo.addEventListener("change", aggiornaCampi);
    pgAperitivo.addEventListener("change", aggiornaTotale);
    aggiornaCampi();

    function nuovoRichiestaId() {
      return (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : (Date.now() + "-" + Math.random());
    }

    function inviaCheckout(persone, btn, statusEl) {
      var payload = {
        richiestaId: nuovoRichiestaId(),
        // Il backend usa questa origine (validata contro un allowlist) per
        // costruire il redirect di ritorno da Stripe — niente più dominio
        // fisso, funziona da sola sia su produzione sia su ogni anteprima
        // PR. Campo obbligatorio lato server.
        origine: window.location.origin,
        modalita: modalitaAttiva(),
        persone: persone,
        personeAperitivo: pgCampoAperitivo.hidden ? 0 : parseInt(pgAperitivo.value, 10),
        allergieNote: pgCampoAllergie.hidden ? null : pgAllergie.value.trim()
      };
      // Statistiche: provenienza dell'acquisto, facoltativa (il backend la
      // ignora se manca o non è valida).
      if (window.TrameAnalytics) {
        Object.assign(payload, window.TrameAnalytics.datiCheckout());
      }
      btn.disabled = true;
      btn.textContent = pagamentoOnlineAttivo ? "Reindirizzamento a Stripe…" : "Invio in corso…";
      window.trameFetch("/api/eventi/" + encodeURIComponent(eventoId) + "/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (result) {
          if (result && result.url) {
            window.location.href = result.url;
            return;
          }
          // Pagamento online disattivato per questo evento: nessun redirect,
          // l'iscrizione è già registrata (stato "in attesa di pagamento
          // manuale") — il pagamento va raccolto a parte.
          document.getElementById("wizard-pagamento").hidden = true;
          esitoEl.hidden = false;
          esitoEl.innerHTML = "<h3>Iscrizione registrata!</h3>" +
            "<p>Il pagamento online non è attivo per questo evento: ti contatteremo a breve per completare il pagamento.</p>";
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = testoBtnPaga;
          statusEl.textContent = err.message;
          statusEl.hidden = false;
        });
    }

    // ---------- Passaggio "Associati a TraMe" ----------
    // Dopo "Vai al pagamento" si verifica ogni email: chi non è socio (o ha
    // la tessera scaduta) passa da qui prima di pagare, e la tessera finisce
    // nello stesso pagamento dell'evento (persone[i].tessera, vedi backend).
    // Obbligatorio se l'evento non è aperto ai non soci, facoltativo
    // (una casella per persona) se lo è — deciso con l'utente.
    var pgStepDati = document.getElementById("pg-step-dati");
    var pgStepAssoc = document.getElementById("pg-step-associazione");
    var pgAssocIntro = document.getElementById("pg-assoc-intro");
    var pgAssocVantaggi = document.getElementById("pg-assoc-vantaggi");
    var pgAssocBlocchi = document.getElementById("pg-assoc-blocchi");
    var pgAssocTotale = document.getElementById("pg-assoc-totale");
    var pgAssocPaga = document.getElementById("pg-assoc-paga");
    var pgAssocStatus = document.getElementById("pg-assoc-status");
    pgAssocPaga.textContent = testoBtnPaga;

    // Stesso formato già usato in diventa-socio.html.
    var CF_PATTERN = "^[A-Za-z]{6}\\d{2}[A-EHLMPRSTabcdehlmprst]\\d{2}([A-Za-z]\\d{3}|\\d{4})[A-Za-z]$";
    var personeInAttesa = null;

    function quotaTessera() {
      var quota = stato.impostazioni && stato.impostazioni.quotaIscrizioneSoci;
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
      var nomeCompleto = escapeHtml(persona.nome + " " + persona.cognome);
      var html = "<h4 style=\"margin:0 0 10px; font-size:1.05rem; color:var(--color-terracotta-dark);\">" +
        nomeCompleto + " <span style=\"font-weight:400; font-size:0.85rem; color:var(--color-ink-soft);\">(" +
        escapeHtml(persona.email) + ")</span></h4>";
      if (!obbligatoria) {
        html += "<div class=\"form-row form-row--checkbox\"><label><input type=\"checkbox\" class=\"pg-assoc-scelta\"> " +
          (tipo === "rinnovo" ? "Rinnova anche la tessera di questa persona" : "Associa anche questa persona a TraMe") +
          "</label></div>";
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
      var quota = quotaTessera() || 0;
      var tessere = stato.apertoNonSoci
        ? pgAssocBlocchi.querySelectorAll(".pg-assoc-scelta:checked").length
        : pgAssocBlocchi.querySelectorAll(".admin-panel").length;
      var totale = calcolaTotaleEvento() + quota * tessere;
      pgAssocTotale.textContent = "Totale (evento" + (tessere ? " + " + tessere + (tessere === 1 ? " tessera" : " tessere") : "") +
        ", senza eventuale sconto socio): " + formattaEuro(totale);
    }

    function mostraStepAssociazione(persone, daAssociare) {
      var obbligatoria = !stato.apertoNonSoci;
      var quota = quotaTessera();
      var testoQuota = quota != null ? " (" + formattaEuro(quota) + ", valida 12 mesi)" : "";
      pgAssocIntro.textContent = obbligatoria
        ? "Per partecipare a questo evento serve essere soci di TraMe. Completa i dati qui sotto: la tessera" + testoQuota + " viene aggiunta allo stesso pagamento dell'evento."
        : "Questo evento è aperto anche a chi non è socio. Se vuoi puoi associarti ora: la tessera" + testoQuota + " viene aggiunta allo stesso pagamento dell'evento.";
      var vantaggi = stato.impostazioni && stato.impostazioni.testoVantaggiIscrizione;
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
        blocco.innerHTML = bloccoAssociazioneHtml(persone[voce.indice], voce.indice, voce.tipo, obbligatoria);
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
      var obbligatoria = !stato.apertoNonSoci;
      // Copia: se si torna indietro e si riprova, non devono restare tessere
      // da un tentativo precedente.
      var persone = personeInAttesa.map(function (p) {
        var copia = {};
        Object.keys(p).forEach(function (k) { copia[k] = p[k]; });
        return copia;
      });
      var blocchi = pgAssocBlocchi.querySelectorAll(".admin-panel");
      for (var i = 0; i < blocchi.length; i++) {
        var blocco = blocchi[i];
        var scelta = blocco.querySelector(".pg-assoc-scelta");
        if (!obbligatoria && !scelta.checked) {
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
        // Come in diventa-socio.html: l'iscrizione online con pagamento è
        // solo per maggiorenni, i minorenni richiedono il consenso di un
        // genitore e passano da un altro percorso.
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
      // Quota/vantaggi: di solito già caricati a inizio pagina, ma se quella
      // chiamata non era ancora finita (o era fallita) si riprova qui.
      if (quotaTessera() == null) {
        richieste.push(window.trameFetch("/api/impostazioni")
          .then(function (impostazioni) { stato.impostazioni = impostazioni; })
          .catch(function () { /* il passaggio funziona anche senza, solo senza importo */ }));
      }
      Promise.all(richieste)
        .then(function (risultati) {
          pgBtnPaga.disabled = false;
          pgBtnPaga.textContent = testoBtnPaga;
          var nomeDiverso = persone.filter(function (p, i) { return risultati[i].nomeCorrisponde === false; })[0];
          if (nomeDiverso) {
            pgStatus.textContent = messaggioNomeDiverso(nomeDiverso.email);
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
          pgBtnPaga.textContent = testoBtnPaga;
          pgStatus.textContent = err.message;
          pgStatus.hidden = false;
        });
    });
  }
})();
