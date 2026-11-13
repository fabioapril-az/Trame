// Dashboard TraMe Analytics (admin-analytics.html). Legge solo il riepilogo
// già aggregato dal backend (GET /api/statistiche/riepilogo, stesse
// autorizzazioni di Pagamenti): nessun dato personale passa da qui.
// Grafico disegnato in SVG, senza librerie esterne.

(function () {
  var NOMI_SORGENTI = {
    facebook_ads: "Facebook Ads",
    instagram_ads: "Instagram Ads",
    altre_campagne: "Altre campagne",
    facebook_organico: "Facebook organico",
    instagram_organico: "Instagram organico",
    meta_non_distinguibile: "Facebook o Instagram (non distinguibile)",
    google: "Google",
    altre_sorgenti: "Altri siti",
    diretto_o_non_identificato: "Diretto o non identificato",
    non_registrata: "Non registrata"
  };
  var NOMI_METRICHE = {
    visite: "Visite", clic: "Clic su Prenota", avvii: "Avvii di pagamento",
    acquisti: "Acquisti", partecipanti: "Partecipanti"
  };
  var COLORE_SERIE = "#a9603a";

  var authGateNote = document.getElementById("auth-gate-note");
  var areaRiservata = document.getElementById("area-riservata");
  var userLabel = document.getElementById("auth-user-label");
  var btnLogin = document.getElementById("btn-login");
  var btnLogout = document.getElementById("btn-logout");
  var statusEl = document.getElementById("an-status");
  var contenutoEl = document.getElementById("an-contenuto");

  var ultimoRiepilogo = null;

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

  function numero(n) {
    return Number(n || 0).toLocaleString("it-IT");
  }

  // Rapporto tra due conteggi, mai un tasso di persone: "—" se manca la base.
  function rapporto(parte, base) {
    if (!base) {
      return "—";
    }
    return Math.round((parte / base) * 100).toLocaleString("it-IT") + "%";
  }

  function isoOggi(scartoGiorni) {
    var d = new Date();
    d.setDate(d.getDate() - (scartoGiorni || 0));
    var mese = String(d.getMonth() + 1).padStart(2, "0");
    var giorno = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mese + "-" + giorno;
  }

  function formattaGiorno(iso) {
    var p = iso.split("-");
    return p[2] + "/" + p[1];
  }

  // --- Autenticazione (stesso schema di admin-pagamenti.js) ---

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
    caricaRisorse();
    carica();
  }

  btnLogin.addEventListener("click", function () {
    window.trameAuth.login().catch(function (err) {
      authGateNote.textContent = "Accesso non riuscito: " + err.message;
    });
  });
  btnLogout.addEventListener("click", function () {
    window.trameAuth.logout().then(function () { window.location.reload(); });
  });
  window.trameAuth.ready.then(refreshUi);

  // --- Filtri ---

  var selPeriodo = document.getElementById("an-periodo");
  var inputDa = document.getElementById("an-da");
  var inputA = document.getElementById("an-a");
  var selRisorsa = document.getElementById("an-risorsa");
  var selAmbiente = document.getElementById("an-ambiente");

  selPeriodo.addEventListener("change", function () {
    var personalizzato = selPeriodo.value === "personalizzato";
    document.getElementById("an-campo-da").hidden = !personalizzato;
    document.getElementById("an-campo-a").hidden = !personalizzato;
    if (personalizzato && !inputDa.value) {
      inputDa.value = isoOggi(29);
      inputA.value = isoOggi(0);
    }
    if (!personalizzato) {
      carica();
    }
  });
  [selRisorsa, selAmbiente].forEach(function (s) { s.addEventListener("change", carica); });
  document.getElementById("an-aggiorna").addEventListener("click", carica);

  function caricaRisorse() {
    Promise.all([
      apiFetchAuth("/api/eventi").catch(function () { return []; }),
      apiFetchAuth("/api/pacchetti-eventi").catch(function () { return []; })
    ]).then(function (risultati) {
      [["evento", "Eventi", risultati[0], "titolo"], ["pacchetto", "Pacchetti (più date)", risultati[1], "nome"]]
        .forEach(function (gruppo) {
          if (!gruppo[2].length) return;
          var og = document.createElement("optgroup");
          og.label = gruppo[1];
          gruppo[2].forEach(function (r) {
            var o = document.createElement("option");
            o.value = gruppo[0] + ":" + r.id;
            o.textContent = r[gruppo[3]] + (r.stato === "annullato" ? " (annullato)" : "");
            og.appendChild(o);
          });
          selRisorsa.appendChild(og);
        });
    });
  }

  function intervallo() {
    if (selPeriodo.value === "personalizzato") {
      return { da: inputDa.value, a: inputA.value };
    }
    var giorni = parseInt(selPeriodo.value, 10);
    return { da: isoOggi(giorni - 1), a: isoOggi(0) };
  }

  function carica() {
    var periodo = intervallo();
    if (!periodo.da || !periodo.a || periodo.da > periodo.a) {
      mostraStatus("Scegli un periodo valido: la data di inizio deve venire prima di quella di fine.");
      return;
    }
    var query = "?da=" + periodo.da + "&a=" + periodo.a + "&ambiente=" + selAmbiente.value;
    if (selRisorsa.value) {
      var parti = selRisorsa.value.split(":");
      query += "&risorsaTipo=" + parti[0] + "&risorsaId=" + parti[1];
    }
    mostraStatus("Caricamento…");
    apiFetchAuth("/api/statistiche/riepilogo" + query)
      .then(function (r) {
        statusEl.hidden = true;
        ultimoRiepilogo = r;
        disegna(r);
      })
      .catch(function (err) {
        contenutoEl.hidden = true;
        mostraStatus(err.status === 403
          ? "Il tuo account non ha i permessi per vedere le statistiche."
          : "Statistiche non disponibili: " + err.message);
      });
  }

  function mostraStatus(testo) {
    statusEl.textContent = testo;
    statusEl.hidden = false;
  }

  // --- Disegno ---

  function disegna(r) {
    contenutoEl.hidden = false;
    document.getElementById("an-spento").hidden = r.analyticsAttivo !== false;
    var t = r.totali || {};
    var clic = (t.clicScheda || 0) + (t.clicDettaglio || 0);
    var avvii = (t.avviiOnline || 0) + (t.avviiManuali || 0);

    disegnaKpi([
      { etichetta: "Visite", valore: t.visite, nota: "aperture del dettaglio" },
      { etichetta: "Clic su Prenota", valore: clic, nota: "scheda " + numero(t.clicScheda) + " · dettaglio " + numero(t.clicDettaglio) },
      { etichetta: "Avvii di pagamento", valore: avvii, nota: t.avviiManuali ? "di cui manuali " + numero(t.avviiManuali) : "" },
      { etichetta: "Acquisti", valore: t.acquisti, nota: t.acquistiRimborsatiInteramente ? "rimborsati interamente " + numero(t.acquistiRimborsatiInteramente) : "netti dai rimborsi" },
      { etichetta: "Partecipanti", valore: t.partecipanti, nota: t.partecipantiRimborsati ? "rimborsati " + numero(t.partecipantiRimborsati) : "netti dai rimborsi" }
    ]);

    disegnaFunnel([
      { etichetta: "Visite", valore: t.visite || 0, rapporto: "" },
      { etichetta: "Clic su Prenota", valore: clic, rapporto: rapporto(clic, t.visite) + " delle visite" },
      { etichetta: "Avvii di pagamento", valore: avvii, rapporto: rapporto(avvii, clic) + " dei clic" },
      { etichetta: "Acquisti", valore: t.acquisti || 0, rapporto: rapporto(t.acquisti, avvii) + " degli avvii" }
    ]);

    disegnaAndamento();
    disegnaTabellaSorgenti(r.perSorgente || []);
    disegnaTabellaCampagne(r.perCampagna || []);
    disegnaTabellaRisorse(r.perRisorsa || null);

    var altri = r.altriPercorsi || {};
    var testiAltri = [];
    if (altri.inAttesaConfermaManuale) testiAltri.push(numero(altri.inAttesaConfermaManuale) + " iscrizioni in attesa di conferma del pagamento manuale");
    if (altri.iscrizioniDirette) testiAltri.push(numero(altri.iscrizioniDirette) + " iscrizioni dirette, senza pagamento online");
    var altriEl = document.getElementById("an-altri-percorsi");
    altriEl.textContent = testiAltri.length ? "Fuori dal percorso con pagamento online: " + testiAltri.join("; ") + "." : "";
    altriEl.hidden = !testiAltri.length;
  }

  function disegnaKpi(voci) {
    document.getElementById("an-kpi").innerHTML = voci.map(function (v) {
      return "<div class=\"an-kpi__tile\"><span class=\"an-kpi__etichetta\">" + escapeHtml(v.etichetta) + "</span>" +
        "<span class=\"an-kpi__valore\">" + numero(v.valore) + "</span>" +
        (v.nota ? "<span class=\"an-kpi__nota\">" + escapeHtml(v.nota) + "</span>" : "") + "</div>";
    }).join("");
  }

  // Barre orizzontali, un solo colore: la lunghezza è relativa alle visite
  // (o al valore massimo, se i clic dalle schede superano le visite).
  function disegnaFunnel(passi) {
    var massimo = Math.max.apply(null, passi.map(function (p) { return p.valore; })) || 1;
    document.getElementById("an-funnel").innerHTML = passi.map(function (p) {
      var larghezza = p.valore ? Math.max(1, (p.valore / massimo) * 100) : 0;
      return "<div class=\"an-funnel__riga\">" +
        "<span class=\"an-funnel__nome\">" + escapeHtml(p.etichetta) + "</span>" +
        "<span class=\"an-funnel__barra\" role=\"img\" aria-label=\"" + escapeHtml(p.etichetta + ": " + numero(p.valore)) + "\">" +
        "<span style=\"width:" + larghezza + "%\"></span></span>" +
        "<span class=\"an-funnel__valore\">" + numero(p.valore) +
        (p.rapporto ? " <span class=\"an-funnel__rapporto\">" + escapeHtml(p.rapporto) + "</span>" : "") + "</span></div>";
    }).join("");
  }

  var selMetrica = document.getElementById("an-metrica");
  var btnTabella = document.getElementById("an-tabella-toggle");
  var tabellaGiorni = document.getElementById("an-tabella-giorni");
  selMetrica.addEventListener("change", disegnaAndamento);
  var timerRidimensiona = null;
  window.addEventListener("resize", function () {
    clearTimeout(timerRidimensiona);
    timerRidimensiona = setTimeout(disegnaAndamento, 150);
  });
  btnTabella.addEventListener("click", function () {
    var mostra = tabellaGiorni.hidden;
    tabellaGiorni.hidden = !mostra;
    btnTabella.setAttribute("aria-expanded", String(mostra));
    btnTabella.textContent = mostra ? "Nascondi tabella" : "Vedi tabella";
  });

  // Tutti i giorni del periodo, anche quelli senza dati (valore 0): senza,
  // la linea salterebbe i giorni vuoti e falserebbe l'andamento.
  function serieGiornaliera(perGiorno, metrica) {
    var perData = {};
    perGiorno.forEach(function (g) { perData[g.giorno] = g; });
    var periodo = intervallo();
    var punti = [];
    var d = new Date(periodo.da + "T00:00:00");
    var fine = new Date(periodo.a + "T00:00:00");
    while (d <= fine) {
      var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      punti.push({ giorno: iso, valore: perData[iso] ? (perData[iso][metrica] || 0) : 0 });
      d.setDate(d.getDate() + 1);
    }
    return punti;
  }

  function tacche(massimo) {
    if (massimo <= 4) {
      var piccole = [];
      for (var i = 0; i <= Math.max(1, massimo); i++) piccole.push(i);
      return piccole;
    }
    var passo = Math.pow(10, Math.floor(Math.log10(massimo / 4)));
    [1, 2, 5, 10].some(function (m) {
      if (massimo / (passo * m) <= 5) { passo = passo * m; return true; }
      return false;
    });
    var valori = [];
    for (var v = 0; v <= massimo + passo * 0.001; v += passo) valori.push(v);
    if (valori[valori.length - 1] < massimo) valori.push(valori[valori.length - 1] + passo);
    return valori;
  }

  function disegnaAndamento() {
    if (!ultimoRiepilogo) return;
    var metrica = selMetrica.value;
    var punti = serieGiornaliera(ultimoRiepilogo.perGiorno || [], metrica);
    document.getElementById("an-andamento-titolo").textContent = NOMI_METRICHE[metrica] + " al giorno";

    // Disegnato sulla larghezza reale del riquadro, ad altezza fissa: con un
    // viewBox fisso il grafico (e le sue scritte) si ingrandiva con lo schermo.
    var contenitore = document.getElementById("an-grafico");
    var L = Math.max(300, Math.round(contenitore.clientWidth || 640)), A = 240, mSx = 40, mDx = 16, mSu = 12, mGiu = 28;
    var massimoDati = Math.max.apply(null, punti.map(function (p) { return p.valore; }));
    var ticks = tacche(massimoDati);
    var massimo = ticks[ticks.length - 1] || 1;
    var x = function (i) { return mSx + (punti.length === 1 ? (L - mSx - mDx) / 2 : i * (L - mSx - mDx) / (punti.length - 1)); };
    var y = function (v) { return mSu + (A - mSu - mGiu) * (1 - v / massimo); };

    var svg = "<svg width=\"" + L + "\" height=\"" + A + "\" viewBox=\"0 0 " + L + " " + A + "\" class=\"an-grafico__svg\" role=\"img\" aria-label=\"" +
      escapeHtml(NOMI_METRICHE[metrica] + " al giorno; i valori sono nella tabella") + "\">";
    ticks.forEach(function (t) {
      svg += "<line x1=\"" + mSx + "\" x2=\"" + (L - mDx) + "\" y1=\"" + y(t) + "\" y2=\"" + y(t) + "\" class=\"an-grafico__griglia\"/>" +
        "<text x=\"" + (mSx - 8) + "\" y=\"" + (y(t) + 4) + "\" text-anchor=\"end\" class=\"an-grafico__asse\">" + numero(t) + "</text>";
    });
    // Etichette dei giorni: abbastanza rade da non sovrapporsi; prima e
    // ultima allineate al bordo, così non escono dal grafico.
    var ogni = Math.max(1, Math.ceil(punti.length / Math.max(2, Math.floor((L - mSx - mDx) / 70))));
    punti.forEach(function (p, i) {
      var ultima = i === punti.length - 1;
      if ((i % ogni === 0 && (punti.length - 1 - i) >= ogni) || ultima) {
        var ancora = i === 0 ? "start" : (ultima ? "end" : "middle");
        svg += "<text x=\"" + x(i) + "\" y=\"" + (A - 8) + "\" text-anchor=\"" + ancora + "\" class=\"an-grafico__asse\">" + formattaGiorno(p.giorno) + "</text>";
      }
    });
    var linea = punti.map(function (p, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.valore).toFixed(1); }).join(" ");
    var area = linea + " L" + x(punti.length - 1).toFixed(1) + " " + y(0) + " L" + x(0).toFixed(1) + " " + y(0) + " Z";
    svg += "<path d=\"" + area + "\" fill=\"" + COLORE_SERIE + "\" fill-opacity=\"0.1\"/>";
    svg += "<path d=\"" + linea + "\" fill=\"none\" stroke=\"" + COLORE_SERIE + "\" stroke-width=\"2\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>";
    var ultimo = punti[punti.length - 1];
    svg += "<circle cx=\"" + x(punti.length - 1) + "\" cy=\"" + y(ultimo.valore) + "\" r=\"4\" fill=\"" + COLORE_SERIE + "\" stroke=\"#fff\" stroke-width=\"2\"/>";
    svg += "<line class=\"an-grafico__mirino\" style=\"display:none\" y1=\"" + mSu + "\" y2=\"" + (A - mGiu) + "\"/>";
    svg += "<circle class=\"an-grafico__punto\" style=\"display:none\" r=\"5\" fill=\"" + COLORE_SERIE + "\" stroke=\"#fff\" stroke-width=\"2\"/>";
    svg += "<rect class=\"an-grafico__area-mouse\" x=\"" + mSx + "\" y=\"0\" width=\"" + (L - mSx - mDx) + "\" height=\"" + A + "\" fill=\"transparent\"/>";
    svg += "</svg><div class=\"an-grafico__tooltip\" hidden></div>";

    contenitore.innerHTML = svg;
    agganciaMirino(contenitore, punti, x, y, L, metrica);

    tabellaGiorni.innerHTML = "<table class=\"admin-table\"><thead><tr><th>Giorno</th><th>Visite</th><th>Clic</th><th>Avvii</th><th>Acquisti</th><th>Partecipanti</th></tr></thead><tbody>" +
      ["visite", "clic", "avvii", "acquisti", "partecipanti"].reduce(function (righe, m) {
        serieGiornaliera(ultimoRiepilogo.perGiorno || [], m).forEach(function (p, i) {
          righe[i] = righe[i] || { giorno: p.giorno };
          righe[i][m] = p.valore;
        });
        return righe;
      }, []).reverse().map(function (r) {
        return "<tr><td>" + formattaGiorno(r.giorno) + "</td><td>" + numero(r.visite) + "</td><td>" + numero(r.clic) + "</td><td>" +
          numero(r.avvii) + "</td><td>" + numero(r.acquisti) + "</td><td>" + numero(r.partecipanti) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  // Mirino + tooltip sul giorno più vicino al cursore.
  function agganciaMirino(contenitore, punti, x, y, L, metrica) {
    var svgEl = contenitore.querySelector("svg");
    var mirino = contenitore.querySelector(".an-grafico__mirino");
    var punto = contenitore.querySelector(".an-grafico__punto");
    var tooltip = contenitore.querySelector(".an-grafico__tooltip");
    var area = contenitore.querySelector(".an-grafico__area-mouse");
    function muovi(evento) {
      var rett = svgEl.getBoundingClientRect();
      var xSvg = (evento.clientX - rett.left) * (L / rett.width);
      var indice = 0;
      var distanza = Infinity;
      punti.forEach(function (p, i) {
        var d = Math.abs(x(i) - xSvg);
        if (d < distanza) { distanza = d; indice = i; }
      });
      var p = punti[indice];
      mirino.setAttribute("x1", x(indice));
      mirino.setAttribute("x2", x(indice));
      mirino.style.display = "";
      punto.setAttribute("cx", x(indice));
      punto.setAttribute("cy", y(p.valore));
      punto.style.display = "";
      tooltip.innerHTML = "<strong>" + formattaGiorno(p.giorno) + "</strong> · " + escapeHtml(NOMI_METRICHE[metrica]) + ": " + numero(p.valore);
      tooltip.hidden = false;
      var sinistra = (x(indice) / L) * rett.width;
      tooltip.style.left = Math.min(Math.max(sinistra, 60), rett.width - 60) + "px";
    }
    area.addEventListener("mousemove", muovi);
    area.addEventListener("mouseleave", function () {
      mirino.style.display = "none";
      punto.style.display = "none";
      tooltip.hidden = true;
    });
  }

  function tabella(intestazioni, righe) {
    return "<table class=\"admin-table\"><thead><tr>" + intestazioni.map(function (h) { return "<th>" + h + "</th>"; }).join("") +
      "</tr></thead><tbody>" + righe.join("") + "</tbody></table>";
  }

  function disegnaTabellaSorgenti(lista) {
    var ordinata = lista.slice().sort(function (a, b) { return (b.visite || 0) - (a.visite || 0) || (b.acquisti || 0) - (a.acquisti || 0); });
    document.getElementById("an-sorgenti").innerHTML = ordinata.length ? tabella(
      ["Provenienza", "Visite", "Clic scheda", "Clic dettaglio", "Avvii", "Acquisti", "Partecipanti", "Acquisti / visite"],
      ordinata.map(function (s) {
        return "<tr><td>" + escapeHtml(NOMI_SORGENTI[s.sorgente] || s.sorgente) + "</td><td>" + numero(s.visite) + "</td><td>" +
          numero(s.clicScheda) + "</td><td>" + numero(s.clicDettaglio) + "</td><td>" + numero(s.avvii) + "</td><td>" +
          numero(s.acquisti) + "</td><td>" + numero(s.partecipanti) + "</td><td>" + rapporto(s.acquisti, s.visite) + "</td></tr>";
      })) : "<p class=\"form-note\">Nessun dato nel periodo.</p>";
  }

  function disegnaTabellaCampagne(lista) {
    var pannello = document.getElementById("an-pannello-campagne");
    pannello.hidden = !lista.length;
    if (!lista.length) return;
    document.getElementById("an-campagne").innerHTML = tabella(
      ["Campagna", "Provenienza", "Visite", "Clic", "Avvii", "Acquisti", "Partecipanti"],
      lista.slice().sort(function (a, b) { return (b.acquisti || 0) - (a.acquisti || 0) || (b.visite || 0) - (a.visite || 0); })
        .map(function (c) {
          return "<tr><td>" + escapeHtml(c.campagna) + "</td><td>" + escapeHtml(NOMI_SORGENTI[c.sorgente] || c.sorgente) + "</td><td>" +
            numero(c.visite) + "</td><td>" + numero(c.clic) + "</td><td>" + numero(c.avvii) + "</td><td>" +
            numero(c.acquisti) + "</td><td>" + numero(c.partecipanti) + "</td></tr>";
        }));
  }

  var chkAnnullati = document.getElementById("an-mostra-annullati");
  chkAnnullati.addEventListener("change", function () {
    if (ultimoRiepilogo) disegnaTabellaRisorse(ultimoRiepilogo.perRisorsa || null);
  });

  function disegnaTabellaRisorse(lista) {
    var pannello = document.getElementById("an-pannello-risorse");
    pannello.hidden = !lista;
    if (!lista) return;
    var visibili = lista.filter(function (r) {
      return chkAnnullati.checked || (r.stato !== "annullato" && r.stato !== "bozza");
    }).sort(function (a, b) { return (b.visite || 0) - (a.visite || 0); });
    document.getElementById("an-risorse").innerHTML = visibili.length ? tabella(
      ["Evento", "Visite", "Clic scheda", "Clic dettaglio", "Avvii", "Acquisti", "Partecipanti"],
      visibili.map(function (r) {
        return "<tr><td>" + escapeHtml(r.titolo) + (r.risorsaTipo === "pacchetto" ? " <span class=\"form-note\">(più date)</span>" : "") +
          "</td><td>" + numero(r.visite) + "</td><td>" + numero(r.clicScheda) + "</td><td>" + numero(r.clicDettaglio) + "</td><td>" +
          numero(r.avvii) + "</td><td>" + numero(r.acquisti) + "</td><td>" + numero(r.partecipanti) + "</td></tr>";
      })) : "<p class=\"form-note\">Nessun evento con dati nel periodo.</p>";
  }

  // --- Esclusione di questo dispositivo ---

  var esclusioneStato = document.getElementById("an-esclusione-stato");
  var esclusioneBtn = document.getElementById("an-esclusione-btn");
  function aggiornaEsclusione() {
    var escluso = window.TrameAnalytics && window.TrameAnalytics.dispositivoEscluso();
    esclusioneStato.textContent = escluso
      ? "Questo browser è escluso dalle statistiche."
      : "Questo browser viene contato come quello di qualunque visitatore.";
    esclusioneBtn.textContent = escluso ? "Torna a contare questo dispositivo" : "Escludi questo dispositivo dalle statistiche";
  }
  esclusioneBtn.addEventListener("click", function () {
    if (!window.TrameAnalytics) return;
    window.TrameAnalytics.impostaEsclusione(!window.TrameAnalytics.dispositivoEscluso());
    aggiornaEsclusione();
  });
  aggiornaEsclusione();
})();
