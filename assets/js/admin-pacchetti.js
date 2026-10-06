// Gestione pacchetti (admin.html, sezione "Pacchetti") — eventi a più date
// collegate (es. le due giornate di un corso): chi si iscrive scegli una
// sola data o tutte, con uno sconto sul totale se le prende tutte. Login
// condiviso col resto della pagina — vedi admin-auth.js. Stesso ruolo Azure
// AD App Roles di Eventi (GestioneEventi: Presidente/Admin), verificato
// dall'API .NET a ogni chiamata.
//
// Un pacchetto collega 2+ eventi già esistenti (creati come sempre nel tab
// Eventi): qui non si crea nessuna data, solo si scelgono quelle da
// collegare, nell'ordine in cui devono comparire. Pubblicamente il
// pacchetto è l'unico evento visibile — le date collegate non compaiono mai
// come card proprie (vedi fili.js — non loro — anzi events.js/pacchetti.js
// sul sito pubblico).

(function () {
  var stato = { pacchettoCorrenteId: null };

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

  function formattaData(isoDate) {
    if (!isoDate) return "—";
    var parti = isoDate.split("-");
    return parti[2] + "/" + parti[1] + "/" + parti[0];
  }

  var STATO_LABELS = {
    bozza: "Bozza", annunciato: "Annunciato", aperto: "Aperto", chiuso: "Chiuso", annullato: "Annullato"
  };

  // --- Editor rich text (Descrizione) — stesso schema di admin-talenti.js:
  //     grassetto/corsivo/colore/elenchi sempre, il bottone immagine solo nel
  //     pannello Modifica, dove esiste già un id. ---
  var TOOLBAR_BASE = [["bold", "italic"], [{ color: [] }], [{ align: [] }], [{ list: "ordered" }, { list: "bullet" }]];
  var TOOLBAR_CON_IMMAGINE = TOOLBAR_BASE.concat([["image"]]);
  var quillEditors = {};

  // Stessa variante inline di admin-eventi.js/admin-talenti.js (caricati
  // prima di questo file sulla stessa pagina): Quill.register con lo stesso
  // blotName sovrascrive silenziosamente, senza errori — ri-registrarla qui
  // è ridondante ma inoffensivo, più semplice che tenere tre file in
  // sincronia su "chi la registra per primo".
  var EmbedBlot = Quill.import("blots/embed");
  class ImmagineInline extends EmbedBlot {
    static create(url) {
      var node = super.create(url);
      node.setAttribute("src", url);
      node.setAttribute("alt", "");
      return node;
    }
    static value(node) {
      return node.getAttribute("src");
    }
  }
  ImmagineInline.blotName = "immagineInline";
  ImmagineInline.tagName = "IMG";
  Quill.register(ImmagineInline);

  function inizializzaEditor(id, conImmagine) {
    var quill = new Quill("#" + id + "-editor", {
      theme: "snow",
      modules: { toolbar: conImmagine ? TOOLBAR_CON_IMMAGINE : TOOLBAR_BASE }
    });
    if (conImmagine) {
      registraGestoreImmagineInline(quill);
      registraRidimensionamentoImmagini(quill);
    }
    quillEditors[id] = quill;
  }

  inizializzaEditor("pac-descrizione", false);
  inizializzaEditor("mod-pac-descrizione", true);

  function contenutoQuill(quill) {
    return quill.getText().trim() === "" ? null : quill.root.innerHTML;
  }

  function sembraHtml(testo) {
    return /<[a-z][\s\S]*>/i.test(testo);
  }

  function testoSempliceInHtml(testo) {
    return testo.split(/\n{2,}/).map(function (paragrafo) {
      return "<p>" + escapeHtml(paragrafo).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }

  function impostaContenutoQuill(quill, valore) {
    if (!valore) {
      quill.setText("");
      return;
    }
    var html = sembraHtml(valore) ? valore : testoSempliceInHtml(valore);
    quill.root.innerHTML = DOMPurify.sanitize(html);
  }

  function registraGestoreImmagineInline(quill) {
    quill.getModule("toolbar").addHandler("image", function () {
      if (!stato.pacchettoCorrenteId) {
        window.alert("Salva prima il pacchetto per poter inserire immagini nel testo.");
        return;
      }
      var input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.onchange = function () {
        if (!input.files || !input.files[0]) return;
        var range = quill.getSelection(true);
        ridimensionaImmagine(input.files[0], 1600, 0.8)
          .then(function (blob) {
            var formData = new FormData();
            formData.append("file", blob, "immagine.jpg");
            return apiFetchAuth("/api/pacchetti-eventi/" + stato.pacchettoCorrenteId + "/immagini-contenuto", {
              method: "POST",
              body: formData
            });
          })
          .then(function (result) {
            quill.insertEmbed(range.index, "immagineInline", result.url, "user");
            quill.setSelection(range.index + 1);
            var img = quill.root.querySelector('img[src="' + result.url + '"]');
            if (img) {
              img.style.width = "120px";
              img.style.height = "auto";
            }
          })
          .catch(function (err) { window.alert(err.message); });
      };
      input.click();
    });
  }

  function registraRidimensionamentoImmagini(quill) {
    quill.root.addEventListener("click", function (e) {
      if (e.target.tagName !== "IMG") return;
      var img = e.target;
      var attuale = img.style.width || Math.round(img.getBoundingClientRect().width) + "px";
      var valore = window.prompt(
        "Larghezza dell'immagine (es. 5mm, 1cm, 40px). L'altezza si adatta da sola, senza deformarla.",
        attuale
      );
      if (valore === null) return;
      valore = valore.trim();
      if (!valore) {
        img.style.width = "";
        img.style.height = "";
        return;
      }
      img.style.width = valore;
      img.style.height = "auto";
    });
  }

  // --- Selettore delle date collegate: un <select> coi soli eventi
  //     candidabili (vedi caricaEventiDisponibili) + "+ Aggiungi" che
  //     sposta la scelta in un elenco ordinato sotto, con un bottone
  //     "Rimuovi" per riga — stesso principio delle "Modalità di
  //     partecipazione" in admin-eventi.js, qui su eventi invece che su
  //     nome/prezzo liberi. ---

  var eventiCandidati = []; // [{id, titolo, dataEvento}], caricati una volta per apertura pannello

  function creaRigaSottoEvento(container, select, eventoId, titolo, dataEvento) {
    var riga = document.createElement("div");
    riga.className = "admin-opzione-riga";
    riga.style.cssText = "display:flex; gap:10px; align-items:center; margin-bottom:8px;";
    riga.dataset.eventoId = eventoId;
    riga.innerHTML =
      '<span style="flex:1;">' + escapeHtml(titolo) + " — " + formattaData(dataEvento) + "</span>" +
      '<button type="button" class="btn btn--outline btn--small">Rimuovi</button>';
    riga.querySelector("button").addEventListener("click", function () {
      riga.remove();
      // Rimesso disponibile nel select, da dove era stato tolto.
      var opzione = document.createElement("option");
      opzione.value = eventoId;
      opzione.textContent = titolo + " — " + formattaData(dataEvento);
      select.appendChild(opzione);
    });
    container.appendChild(riga);
  }

  function leggiSottoEventoIds(containerId) {
    var righe = document.querySelectorAll("#" + containerId + " .admin-opzione-riga");
    return Array.prototype.map.call(righe, function (riga) { return parseInt(riga.dataset.eventoId, 10); });
  }

  // Candidabili: non già in un ALTRO pacchetto. Se stiamo modificando un
  // pacchetto esistente, le sue date attuali vanno incluse comunque (altrimenti
  // non si vedrebbero più nel select una volta rimosse dall'elenco e poi
  // ri-aggiunte) — per questo il filtro esclude solo chi appartiene a un
  // pacchetto DIVERSO da quello corrente.
  function caricaEventiDisponibili(pacchettoIdCorrente) {
    return apiFetchAuth("/api/eventi")
      .then(function (eventi) {
        eventiCandidati = eventi.filter(function (ev) {
          return !ev.pacchettoEventoId || ev.pacchettoEventoId === pacchettoIdCorrente;
        });
      });
  }

  function popolaSelectSottoEventi(selectId, esclusiIds) {
    var select = document.getElementById(selectId);
    select.innerHTML = '<option value="">— scegli una data —</option>';
    eventiCandidati.forEach(function (ev) {
      if (esclusiIds.indexOf(ev.id) !== -1) return;
      var opzione = document.createElement("option");
      opzione.value = ev.id;
      opzione.textContent = ev.titolo + " — " + formattaData(ev.dataEvento);
      select.appendChild(opzione);
    });
  }

  function aggiungiSottoEvento(selectId, listaId) {
    var select = document.getElementById(selectId);
    var eventoId = parseInt(select.value, 10);
    if (!eventoId) return;
    var evento = eventiCandidati.filter(function (ev) { return ev.id === eventoId; })[0];
    if (!evento) return;
    select.querySelector('option[value="' + eventoId + '"]').remove();
    select.value = "";
    creaRigaSottoEvento(document.getElementById(listaId), select, evento.id, evento.titolo, evento.dataEvento);
  }

  document.getElementById("pac-sottoeventi-aggiungi").addEventListener("click", function () {
    aggiungiSottoEvento("pac-sottoeventi-select", "pac-sottoeventi-lista");
  });
  document.getElementById("mod-pac-sottoeventi-aggiungi").addEventListener("click", function () {
    aggiungiSottoEvento("mod-pac-sottoeventi-select", "mod-pac-sottoeventi-lista");
  });

  // --- Elenco ---

  function formattaDateElenco(sottoEventi) {
    return (sottoEventi || []).map(function (ev) { return formattaData(ev.dataEvento); }).join(", ") || "—";
  }

  function caricaPacchetti() {
    apiFetchAuth("/api/pacchetti-eventi")
      .then(function (pacchetti) {
        var filtro = document.getElementById("pac-filtro-stato").value;
        var righe = filtro ? pacchetti.filter(function (p) { return p.stato === filtro; }) : pacchetti;
        var tbody = document.getElementById("pacchetti-tabella-body");
        tbody.innerHTML = "";
        document.getElementById("pacchetti-empty").hidden = righe.length > 0;

        righe.forEach(function (p) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + escapeHtml(p.nome) + "</td>" +
            "<td>" + escapeHtml(formattaDateElenco(p.sottoEventi)) + "</td>" +
            '<td><span class="status-badge status-badge--' + escapeHtml(p.stato) + '">' +
            escapeHtml(STATO_LABELS[p.stato] || p.stato) + "</span></td>" +
            '<td><button type="button" class="btn btn--outline btn--small" data-action="modifica">Modifica</button> ' +
            '<button type="button" class="btn btn--outline btn--small" data-action="elimina">Elimina</button></td>';
          tr.querySelector('[data-action="modifica"]').addEventListener("click", function () { apriModifica(p); });
          tr.querySelector('[data-action="elimina"]').addEventListener("click", function () { eliminaPacchetto(p); });
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) { window.alert(err.message); });
  }

  document.getElementById("btn-carica-pacchetti").addEventListener("click", caricaPacchetti);
  document.getElementById("pac-filtro-stato").addEventListener("change", caricaPacchetti);

  // --- Nuovo pacchetto (crea sempre in bozza) ---

  document.getElementById("btn-mostra-nuovo-pacchetto").addEventListener("click", function () {
    document.getElementById("pac-nome").value = "";
    quillEditors["pac-descrizione"].setText("");
    document.getElementById("pac-sconto").value = "";
    document.getElementById("pac-sottoeventi-lista").innerHTML = "";
    document.getElementById("crea-pacchetto-status").hidden = true;
    caricaEventiDisponibili(null).then(function () {
      popolaSelectSottoEventi("pac-sottoeventi-select", []);
    });
    document.getElementById("pannello-nuovo-pacchetto").hidden = false;
    document.getElementById("pannello-nuovo-pacchetto").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("btn-annulla-nuovo-pacchetto").addEventListener("click", function () {
    document.getElementById("pannello-nuovo-pacchetto").hidden = true;
  });

  document.getElementById("btn-crea-pacchetto").addEventListener("click", function () {
    var statusEl = document.getElementById("crea-pacchetto-status");
    var sottoEventoIds = leggiSottoEventoIds("pac-sottoeventi-lista");
    if (sottoEventoIds.length < 2) {
      mostraMessaggio(statusEl, "Servono almeno due date collegate.", true);
      return;
    }
    var scontoVal = document.getElementById("pac-sconto").value;
    var payload = {
      nome: document.getElementById("pac-nome").value.trim(),
      descrizione: contenutoQuill(quillEditors["pac-descrizione"]),
      sottoEventoIds: sottoEventoIds,
      scontoTutteLeDate: scontoVal === "" ? null : parseFloat(scontoVal)
    };
    apiFetchAuth("/api/pacchetti-eventi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (pacchetto) {
        document.getElementById("pannello-nuovo-pacchetto").hidden = true;
        caricaPacchetti();
        apriModifica(pacchetto);
      })
      .catch(function (err) { mostraMessaggio(statusEl, err.message, true); });
  });

  // --- Modifica ---

  function aggiornaAnteprimaImmagine(url) {
    var img = document.getElementById("mod-pac-immagine-anteprima");
    if (url) {
      img.src = url;
      img.hidden = false;
    } else {
      img.hidden = true;
      img.removeAttribute("src");
    }
  }

  function apriModifica(pacchetto) {
    stato.pacchettoCorrenteId = pacchetto.id;
    document.getElementById("mod-pac-nome").value = pacchetto.nome || "";
    impostaContenutoQuill(quillEditors["mod-pac-descrizione"], pacchetto.descrizione);
    document.getElementById("mod-pac-sconto").value = pacchetto.scontoTutteLeDate != null ? pacchetto.scontoTutteLeDate : "";
    document.getElementById("mod-pac-stato").value = pacchetto.stato;
    aggiornaAnteprimaImmagine(pacchetto.immagineUrl);
    document.getElementById("mod-pac-immagine-file").value = "";
    document.getElementById("immagine-pacchetto-status").hidden = true;
    document.getElementById("modifica-pacchetto-status").hidden = true;

    var lista = document.getElementById("mod-pac-sottoeventi-lista");
    lista.innerHTML = "";
    var idAttuali = (pacchetto.sottoEventi || []).map(function (ev) { return ev.id; });
    caricaEventiDisponibili(pacchetto.id).then(function () {
      popolaSelectSottoEventi("mod-pac-sottoeventi-select", idAttuali);
      var select = document.getElementById("mod-pac-sottoeventi-select");
      (pacchetto.sottoEventi || []).forEach(function (ev) {
        creaRigaSottoEvento(lista, select, ev.id, ev.titolo, ev.dataEvento);
      });
    });

    document.getElementById("pannello-modifica-pacchetto").hidden = false;
    document.getElementById("pannello-modifica-pacchetto").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("btn-chiudi-modifica-pacchetto").addEventListener("click", function () {
    document.getElementById("pannello-modifica-pacchetto").hidden = true;
  });

  document.getElementById("btn-salva-pacchetto").addEventListener("click", function () {
    var statusEl = document.getElementById("modifica-pacchetto-status");
    var sottoEventoIds = leggiSottoEventoIds("mod-pac-sottoeventi-lista");
    if (sottoEventoIds.length < 2) {
      mostraMessaggio(statusEl, "Servono almeno due date collegate.", true);
      return;
    }
    var scontoVal = document.getElementById("mod-pac-sconto").value;
    // sottoEventoIds sostituisce SEMPRE l'elenco intero lato server, non lo
    // fonde: va mandato per intero ad ogni salvataggio, anche se non è stato
    // toccato in questa modifica — vedi commento nel pannello stesso.
    var payload = {
      nome: document.getElementById("mod-pac-nome").value.trim(),
      descrizione: contenutoQuill(quillEditors["mod-pac-descrizione"]),
      sottoEventoIds: sottoEventoIds,
      scontoTutteLeDate: scontoVal === "" ? null : parseFloat(scontoVal),
      stato: document.getElementById("mod-pac-stato").value
    };
    apiFetchAuth("/api/pacchetti-eventi/" + stato.pacchettoCorrenteId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function () {
        mostraMessaggio(statusEl, "Modifiche salvate.", false);
        caricaPacchetti();
      })
      .catch(function (err) { mostraMessaggio(statusEl, err.message, true); });
  });

  function eliminaPacchetto(pacchetto) {
    if (!window.confirm('Eliminare il pacchetto "' + pacchetto.nome + '"? Le date collegate NON vengono eliminate: ' +
      "tornano eventi normali, di nuovo visibili singolarmente, con tutti i loro iscritti e pagamenti intatti.")) {
      return;
    }
    apiFetchAuth("/api/pacchetti-eventi/" + pacchetto.id, { method: "DELETE" })
      .then(function () { caricaPacchetti(); })
      .catch(function (err) { window.alert(err.message); });
  }

  // --- Immagine di copertina: stesso pattern eventi/talenti. ---

  function ridimensionaImmagine(file, latoMassimo, qualita) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scala = Math.min(1, latoMassimo / Math.max(img.width, img.height));
        var larghezza = Math.round(img.width * scala);
        var altezza = Math.round(img.height * scala);
        var canvas = document.createElement("canvas");
        canvas.width = larghezza;
        canvas.height = altezza;
        canvas.getContext("2d").drawImage(img, 0, 0, larghezza, altezza);
        canvas.toBlob(function (blob) {
          if (!blob) {
            reject(new Error("Impossibile elaborare l'immagine."));
            return;
          }
          resolve(blob);
        }, "image/jpeg", qualita);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("File immagine non valido."));
      };
      img.src = url;
    });
  }

  document.getElementById("btn-carica-immagine-pacchetto").addEventListener("click", function () {
    var input = document.getElementById("mod-pac-immagine-file");
    var status = document.getElementById("immagine-pacchetto-status");
    status.hidden = true;
    if (!input.files || !input.files[0]) {
      mostraMessaggio(status, "Seleziona prima un file immagine.", true);
      return;
    }

    ridimensionaImmagine(input.files[0], 1600, 0.8)
      .then(function (blob) {
        var formData = new FormData();
        formData.append("file", blob, "pacchetto.jpg");
        return apiFetchAuth("/api/pacchetti-eventi/" + stato.pacchettoCorrenteId + "/immagine", {
          method: "POST",
          body: formData
        });
      })
      .then(function (pacchetto) {
        mostraMessaggio(status, "Immagine caricata.", false);
        aggiornaAnteprimaImmagine(pacchetto.immagineUrl);
        caricaPacchetti();
      })
      .catch(function (err) { mostraMessaggio(status, err.message, true); });
  });

  document.getElementById("btn-rimuovi-immagine-pacchetto").addEventListener("click", function () {
    var status = document.getElementById("immagine-pacchetto-status");
    apiFetchAuth("/api/pacchetti-eventi/" + stato.pacchettoCorrenteId + "/immagine", { method: "DELETE" })
      .then(function (pacchetto) {
        mostraMessaggio(status, "Immagine rimossa.", false);
        aggiornaAnteprimaImmagine(pacchetto.immagineUrl);
        document.getElementById("mod-pac-immagine-file").value = "";
        caricaPacchetti();
      })
      .catch(function (err) { mostraMessaggio(status, err.message, true); });
  });

  window.trameAuthUiReady.then(caricaPacchetti);
})();
