// Gestione talenti (admin.html, sezione "Talenti"). Login condiviso col
// resto della pagina — vedi admin-auth.js. Stesso ruolo Azure AD App Roles
// di Eventi (GestioneEventi: Presidente/Admin), verificato dall'API .NET a
// ogni chiamata. Pubblicati sulla pagina "I Fili di TraMe" (fili.html) solo
// quando stato = "pubblicato" — GET pubblico, quindi nessun controllo di
// permesso qui: è la stessa API a decidere cosa restituire in base al login
// (vedi commento nel backend: qui autenticati vediamo sempre tutti gli stati).

(function () {
  var stato = { talentoCorrenteId: null };

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

  var STATO_LABELS = { bozza: "Bozza", pubblicato: "Pubblicato" };

  // --- Editor rich text (Descrizione) — stesso schema di admin-eventi.js:
  //     grassetto/corsivo/colore/elenchi sempre, il bottone immagine (per
  //     loghi o foto inline nel testo, es. il logo dell'attività della
  //     persona) solo nel pannello Modifica, dove esiste già un id. ---
  var TOOLBAR_BASE = [["bold", "italic"], [{ color: [] }], [{ list: "ordered" }, { list: "bullet" }]];
  var TOOLBAR_CON_IMMAGINE = TOOLBAR_BASE.concat([["image"]]);
  var quillEditors = {};

  function inizializzaEditor(id, conImmagine) {
    var quill = new Quill("#" + id + "-editor", {
      theme: "snow",
      modules: { toolbar: conImmagine ? TOOLBAR_CON_IMMAGINE : TOOLBAR_BASE }
    });
    if (conImmagine) {
      registraGestoreImmagineInline(quill);
    }
    quillEditors[id] = quill;
  }

  inizializzaEditor("tal-descrizione", false);
  inizializzaEditor("mod-tal-descrizione", true);

  function contenutoQuill(quill) {
    return quill.getText().trim() === "" ? null : quill.root.innerHTML;
  }

  // Compatibilità con eventuali talenti creati prima dell'editor rich text
  // (nessuno ancora in produzione, ma stesso criterio degli eventi: se il
  // valore non contiene già tag HTML, è testo semplice con eventuali "\n" a
  // separare i paragrafi).
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
      if (!stato.talentoCorrenteId) {
        window.alert("Salva prima il talento per poter inserire immagini nel testo.");
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
            return apiFetchAuth("/api/talenti/" + stato.talentoCorrenteId + "/immagini-contenuto", {
              method: "POST",
              body: formData
            });
          })
          .then(function (result) {
            quill.insertEmbed(range.index, "image", result.url, "user");
            quill.setSelection(range.index + 1);
          })
          .catch(function (err) { window.alert(err.message); });
      };
      input.click();
    });
  }

  // --- Elenco ---

  function caricaTalenti() {
    apiFetchAuth("/api/talenti")
      .then(function (talenti) {
        var filtro = document.getElementById("tal-filtro-stato").value;
        var righe = filtro ? talenti.filter(function (t) { return t.stato === filtro; }) : talenti;
        var tbody = document.getElementById("talenti-tabella-body");
        tbody.innerHTML = "";
        document.getElementById("talenti-empty").hidden = righe.length > 0;

        righe.forEach(function (t) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" + escapeHtml(t.nome) + "</td>" +
            "<td>" + escapeHtml(t.ambito) + "</td>" +
            "<td>" + escapeHtml(STATO_LABELS[t.stato] || t.stato) + "</td>" +
            '<td><button type="button" class="btn btn--outline btn--small" data-action="modifica">Modifica</button> ' +
            '<button type="button" class="btn btn--outline btn--small" data-action="elimina">Elimina</button></td>';
          tr.querySelector('[data-action="modifica"]').addEventListener("click", function () { apriModifica(t); });
          tr.querySelector('[data-action="elimina"]').addEventListener("click", function () { eliminaTalento(t); });
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) { window.alert(err.message); });
  }

  document.getElementById("btn-carica-talenti").addEventListener("click", caricaTalenti);
  document.getElementById("tal-filtro-stato").addEventListener("change", caricaTalenti);

  // --- Nuovo talento (crea sempre in bozza: l'API ignora deliberatamente
  //     uno stato mandato in creazione — vedi commento backend) ---

  document.getElementById("btn-mostra-nuovo-talento").addEventListener("click", function () {
    document.getElementById("tal-nome").value = "";
    document.getElementById("tal-ambito").value = "";
    quillEditors["tal-descrizione"].setText("");
    document.getElementById("crea-talento-status").hidden = true;
    document.getElementById("pannello-nuovo-talento").hidden = false;
    document.getElementById("pannello-nuovo-talento").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("btn-annulla-nuovo-talento").addEventListener("click", function () {
    document.getElementById("pannello-nuovo-talento").hidden = true;
  });

  document.getElementById("btn-crea-talento").addEventListener("click", function () {
    var statusEl = document.getElementById("crea-talento-status");
    var payload = {
      nome: document.getElementById("tal-nome").value.trim(),
      ambito: document.getElementById("tal-ambito").value.trim(),
      descrizione: contenutoQuill(quillEditors["tal-descrizione"])
    };
    apiFetchAuth("/api/talenti", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (talento) {
        document.getElementById("pannello-nuovo-talento").hidden = true;
        caricaTalenti();
        apriModifica(talento);
      })
      .catch(function (err) { mostraMessaggio(statusEl, err.message, true); });
  });

  // --- Modifica (nome/ambito/descrizione/stato + immagine) ---

  function aggiornaAnteprimaImmagine(url) {
    var img = document.getElementById("mod-tal-immagine-anteprima");
    if (url) {
      img.src = url;
      img.hidden = false;
    } else {
      img.hidden = true;
      img.removeAttribute("src");
    }
  }

  function apriModifica(talento) {
    stato.talentoCorrenteId = talento.id;
    document.getElementById("mod-tal-nome").value = talento.nome || "";
    document.getElementById("mod-tal-ambito").value = talento.ambito || "";
    impostaContenutoQuill(quillEditors["mod-tal-descrizione"], talento.descrizione);
    document.getElementById("mod-tal-stato").value = talento.stato;
    aggiornaAnteprimaImmagine(talento.immagineUrl);
    document.getElementById("mod-tal-immagine-file").value = "";
    document.getElementById("immagine-talento-status").hidden = true;
    document.getElementById("modifica-talento-status").hidden = true;
    document.getElementById("pannello-modifica-talento").hidden = false;
    document.getElementById("pannello-modifica-talento").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("btn-chiudi-modifica-talento").addEventListener("click", function () {
    document.getElementById("pannello-modifica-talento").hidden = true;
  });

  document.getElementById("btn-salva-talento").addEventListener("click", function () {
    var statusEl = document.getElementById("modifica-talento-status");
    // stato è obbligatorio in PUT (422 richiede_stato altrimenti, vedi
    // backend): il select ha sempre un valore selezionato, quindi qui non
    // può mai capitare di mandarlo vuoto.
    var payload = {
      nome: document.getElementById("mod-tal-nome").value.trim(),
      ambito: document.getElementById("mod-tal-ambito").value.trim(),
      descrizione: contenutoQuill(quillEditors["mod-tal-descrizione"]),
      stato: document.getElementById("mod-tal-stato").value
    };
    apiFetchAuth("/api/talenti/" + stato.talentoCorrenteId, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function () {
        mostraMessaggio(statusEl, "Modifiche salvate.", false);
        caricaTalenti();
      })
      .catch(function (err) { mostraMessaggio(statusEl, err.message, true); });
  });

  function eliminaTalento(talento) {
    if (!window.confirm('Eliminare definitivamente "' + talento.nome + '"? L\'operazione non è reversibile.')) {
      return;
    }
    apiFetchAuth("/api/talenti/" + talento.id, { method: "DELETE" })
      .then(function () { caricaTalenti(); })
      .catch(function (err) { window.alert(err.message); });
  }

  // --- Immagine: stesso pattern eventi (ridimensionata lato client a
  //     1600px/JPEG 80% prima dell'upload) — vedi admin-eventi.js per i
  //     commenti sulla scelta di ridimensionare qui e non lato server. ---

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

  document.getElementById("btn-carica-immagine-talento").addEventListener("click", function () {
    var input = document.getElementById("mod-tal-immagine-file");
    var status = document.getElementById("immagine-talento-status");
    status.hidden = true;
    if (!input.files || !input.files[0]) {
      mostraMessaggio(status, "Seleziona prima un file immagine.", true);
      return;
    }

    ridimensionaImmagine(input.files[0], 1600, 0.8)
      .then(function (blob) {
        var formData = new FormData();
        formData.append("file", blob, "talento.jpg");
        return apiFetchAuth("/api/talenti/" + stato.talentoCorrenteId + "/immagine", {
          method: "POST",
          body: formData
        });
      })
      .then(function (talento) {
        mostraMessaggio(status, "Immagine caricata.", false);
        aggiornaAnteprimaImmagine(talento.immagineUrl);
        caricaTalenti();
      })
      .catch(function (err) { mostraMessaggio(status, err.message, true); });
  });

  document.getElementById("btn-rimuovi-immagine-talento").addEventListener("click", function () {
    var status = document.getElementById("immagine-talento-status");
    apiFetchAuth("/api/talenti/" + stato.talentoCorrenteId + "/immagine", { method: "DELETE" })
      .then(function (talento) {
        mostraMessaggio(status, "Immagine rimossa.", false);
        aggiornaAnteprimaImmagine(talento.immagineUrl);
        document.getElementById("mod-tal-immagine-file").value = "";
        caricaTalenti();
      })
      .catch(function (err) { mostraMessaggio(status, err.message, true); });
  });

  window.trameAuthUiReady.then(caricaTalenti);
})();
