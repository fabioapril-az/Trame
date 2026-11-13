// TraMe Analytics: statistiche interne, aggregate, senza cookie né
// identificativi del visitatore. Il sito invia solo "+1 visita/clic" per un
// evento o pacchetto, con la categoria di provenienza; il backend tiene
// contatori giornalieri. Provenienza in sessionStorage (una per scheda del
// browser, sparisce alla chiusura). L'unico dato che resta sul dispositivo è
// l'esclusione scelta dallo staff dalla dashboard (localStorage), che non
// identifica nessuno.
//
// Attribuzione "ultima sorgente significativa": UTM espliciti e arrivi da un
// sito esterno aggiornano la sorgente; navigazione interna, ritorno da Stripe
// o dal login, Indietro e ricarica no.

(function () {
  var config = window.TRAME_CONFIG || {};
  var attivo = !(config.analytics && config.analytics.attivo === false);

  var CHIAVE_ATTRIBUZIONE = "trame-statistiche-provenienza";
  var CHIAVE_INVIATI = "trame-statistiche-inviati";
  var CHIAVE_ESCLUSO = "trame-statistiche-escluse";

  var UTM_PAGAMENTO = ["paid", "cpc", "ppc", "paid_social", "paidsocial", "ads", "ad"];
  var SORGENTI_FACEBOOK = ["facebook", "fb"];
  var SORGENTI_INSTAGRAM = ["instagram", "ig"];
  // Host da cui un arrivo non è una nuova sorgente: ritorno dal pagamento,
  // dal login Microsoft, o passaggi interni al sito e alle sue anteprime.
  var HOST_IGNORATI = [/(^|\.)stripe\.com$/, /(^|\.)login\.microsoftonline\.com$/, /\.azurestaticapps\.net$/];

  function leggiSessione(chiave) {
    try {
      var valore = window.sessionStorage.getItem(chiave);
      return valore ? JSON.parse(valore) : null;
    } catch (e) {
      return null;
    }
  }

  function scriviSessione(chiave, valore) {
    try {
      window.sessionStorage.setItem(chiave, JSON.stringify(valore));
    } catch (e) {
      // Storage non disponibile (navigazione privata, ecc.): si conta
      // comunque, al massimo con qualche doppio conteggio in più.
    }
  }

  function dispositivoEscluso() {
    try {
      return window.localStorage.getItem(CHIAVE_ESCLUSO) === "1";
    } catch (e) {
      return false;
    }
  }

  function pulisci(valore) {
    return valore ? String(valore).trim().toLowerCase().slice(0, 100) : "";
  }

  function tipoNavigazione() {
    try {
      var nav = window.performance && performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      return nav ? nav.type : "navigate";
    } catch (e) {
      return "navigate";
    }
  }

  function categoriaDaUtm(source, medium) {
    var pagamento = UTM_PAGAMENTO.indexOf(medium) !== -1;
    if (SORGENTI_FACEBOOK.indexOf(source) !== -1) {
      return pagamento ? "facebook_ads" : "facebook_organico";
    }
    if (SORGENTI_INSTAGRAM.indexOf(source) !== -1) {
      return pagamento ? "instagram_ads" : "instagram_organico";
    }
    return "altre_campagne";
  }

  function categoriaDaHost(host) {
    if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(host)) return "facebook_organico";
    if (/(^|\.)instagram\.com$/.test(host)) return "instagram_organico";
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return "google";
    return "altre_sorgenti";
  }

  // Restituisce una nuova attribuzione se questa pagina porta un segnale di
  // provenienza significativo, altrimenti null (resta quella salvata).
  function segnaleDiProvenienza() {
    var params = new URLSearchParams(window.location.search);
    var source = pulisci(params.get("utm_source"));
    var medium = pulisci(params.get("utm_medium"));
    var campaign = pulisci(params.get("utm_campaign"));
    if (source || medium || campaign) {
      return { categoria: categoriaDaUtm(source, medium), utmSource: source, utmMedium: medium, utmCampaign: campaign };
    }

    var tipo = tipoNavigazione();
    if (tipo === "reload" || tipo === "back_forward") {
      return null;
    }

    var host = "";
    if (document.referrer) {
      try {
        host = new URL(document.referrer).hostname.toLowerCase();
      } catch (e) {
        host = "";
      }
    }
    var interno = host === window.location.hostname.toLowerCase() ||
      HOST_IGNORATI.some(function (re) { return re.test(host); });

    if (host && !interno) {
      return { categoria: categoriaDaHost(host), utmSource: "", utmMedium: "", utmCampaign: "" };
    }
    if (!host && params.get("fbclid")) {
      return { categoria: "meta_non_distinguibile", utmSource: "", utmMedium: "", utmCampaign: "" };
    }
    if (!host && params.get("gclid")) {
      return { categoria: "google", utmSource: "", utmMedium: "", utmCampaign: "" };
    }
    return null;
  }

  var attribuzione = segnaleDiProvenienza() || leggiSessione(CHIAVE_ATTRIBUZIONE) ||
    { categoria: "diretto_o_non_identificato", utmSource: "", utmMedium: "", utmCampaign: "" };
  scriviSessione(CHIAVE_ATTRIBUZIONE, attribuzione);

  function invia(dati) {
    var url = config.apiBaseUrl + "/api/statistiche/azioni";
    var corpo = JSON.stringify(dati);
    // text/plain: richiesta "semplice", senza preflight CORS; il backend
    // legge comunque il JSON. Nessuna attesa della risposta.
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([corpo], { type: "text/plain" }))) {
        return;
      }
    } catch (e) {
      // si prova con fetch qui sotto
    }
    try {
      fetch(url, { method: "POST", body: corpo, headers: { "Content-Type": "text/plain" }, keepalive: true })
        .catch(function () { /* statistiche: un invio perso non è un problema */ });
    } catch (e) {
      // idem
    }
  }

  function quandoVisibile(fn) {
    if (document.prerendering) {
      document.addEventListener("prerenderingchange", function () { quandoVisibile(fn); }, { once: true });
      return;
    }
    if (document.visibilityState === "visible") {
      fn();
      return;
    }
    document.addEventListener("visibilitychange", function attendi() {
      if (document.visibilityState === "visible") {
        document.removeEventListener("visibilitychange", attendi);
        fn();
      }
    });
  }

  // Una volta per scheda del browser, per azione e risorsa: ricaricare o
  // tornare indietro non conta di nuovo. Per i clic vale il primo, con la
  // sua variante (scheda o dettaglio).
  function traccia(azione, risorsaTipo, risorsaId, variante) {
    if (!attivo || dispositivoEscluso() || navigator.webdriver || !config.apiBaseUrl) {
      return;
    }
    var id = parseInt(risorsaId, 10);
    if (!id || (risorsaTipo !== "evento" && risorsaTipo !== "pacchetto")) {
      return;
    }
    var chiave = azione + ":" + risorsaTipo + ":" + id;
    var inviati = leggiSessione(CHIAVE_INVIATI) || {};
    if (inviati[chiave]) {
      return;
    }
    inviati[chiave] = true;
    scriviSessione(CHIAVE_INVIATI, inviati);
    invia({
      azione: azione,
      risorsaTipo: risorsaTipo,
      risorsaId: id,
      variante: variante || "",
      attribuzione: { categoria: attribuzione.categoria, utmCampaign: attribuzione.utmCampaign }
    });
  }

  window.TrameAnalytics = {
    visita: function (risorsaTipo, risorsaId) {
      quandoVisibile(function () { traccia("event_view", risorsaTipo, risorsaId, ""); });
    },
    clicPrenota: function (risorsaTipo, risorsaId, variante) {
      traccia("booking_click", risorsaTipo, risorsaId, variante);
    },
    // Da aggiungere alla richiesta di pagamento: il backend salva la
    // provenienza sull'acquisto e conta l'avvio del pagamento.
    datiCheckout: function () {
      if (!attivo) {
        return {};
      }
      return {
        attribuzione: {
          categoria: attribuzione.categoria,
          utmSource: attribuzione.utmSource,
          utmMedium: attribuzione.utmMedium,
          utmCampaign: attribuzione.utmCampaign
        },
        escludiStatistiche: dispositivoEscluso()
      };
    },
    dispositivoEscluso: dispositivoEscluso,
    impostaEsclusione: function (escluso) {
      try {
        if (escluso) {
          window.localStorage.setItem(CHIAVE_ESCLUSO, "1");
        } else {
          window.localStorage.removeItem(CHIAVE_ESCLUSO);
        }
      } catch (e) {
        // senza storage l'esclusione non può restare: lo dice la dashboard
      }
    }
  };
})();
