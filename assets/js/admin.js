// Logica della pagina di amministrazione (admin.html).
// La protezione vera è a livello di routing (staticwebapp.config.json,
// ruolo "editor") e di API (controllo x-ms-client-principal lato server):
// questo script assume di girare già in un contesto autorizzato e si
// occupa solo di caricare/mostrare/modificare i dati.

(function () {
  var CATEGORY_LABELS = {
    yoga: "Yoga",
    fotografia: "Fotografia",
    pasticceria: "Pasticceria",
    canto: "Canto",
    ballo: "Ballo",
    disegno: "Disegno",
    "trekking-urbano": "Trekking urbano",
    viaggi: "Viaggi",
  };

  var STATUS_LABELS = {
    bozza: "Bozza",
    pubblicato: "Pubblicato",
    fatto: "Fatto",
  };

  var eventsListEl = document.getElementById("events-list");
  var eventsEmptyEl = document.getElementById("events-empty");
  var formPanel = document.getElementById("event-form-panel");
  var form = document.getElementById("event-form");
  var formTitle = document.getElementById("event-form-title");
  var formError = document.getElementById("event-form-error");

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function showUserLabel() {
    var label = document.getElementById("admin-user-label");
    fetch("/.auth/me")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var principal = data && data.clientPrincipal;
        label.textContent = principal ? principal.userDetails : "Accesso non riconosciuto";
      })
      .catch(function () {
        label.textContent = "";
      });
  }

  function openForm(event) {
    form.reset();
    document.getElementById("event-id").value = event ? event.id : "";
    formTitle.textContent = event ? "Modifica evento" : "Nuovo evento";
    document.getElementById("event-title").value = event ? event.title : "";
    document.getElementById("event-category").value = event ? event.category : "yoga";
    document.getElementById("event-when").value = event ? event.whenLabel : "";
    document.getElementById("event-where").value = event ? event.whereLabel : "";
    document.getElementById("event-desc").value = event ? event.description : "";
    document.getElementById("event-cta").value = event ? event.ctaLabel : "";
    document.getElementById("event-status").value = event ? event.status : "bozza";
    formError.hidden = true;
    formPanel.hidden = false;
    formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeForm() {
    formPanel.hidden = true;
    form.reset();
  }

  function renderEventRow(event) {
    var row = document.createElement("article");
    row.className = "admin-event";

    row.innerHTML =
      '<div class="admin-event__info">' +
      '<span class="status-badge status-badge--' + escapeHtml(event.status) + '">' +
      escapeHtml(STATUS_LABELS[event.status] || event.status) +
      "</span>" +
      "<h3>" + escapeHtml(event.title) + "</h3>" +
      '<p class="admin-event__meta">' +
      escapeHtml(CATEGORY_LABELS[event.category] || event.category || "—") +
      (event.whenLabel ? " · " + escapeHtml(event.whenLabel) : "") +
      (event.whereLabel ? " · " + escapeHtml(event.whereLabel) : "") +
      "</p>" +
      "</div>" +
      '<div class="admin-event__actions">' +
      '<button type="button" class="btn btn--outline btn--small" data-action="edit">Modifica</button>' +
      (event.status !== "pubblicato"
        ? '<button type="button" class="btn btn--outline btn--small" data-action="publish">Pubblica</button>'
        : '<button type="button" class="btn btn--outline btn--small" data-action="unpublish">Metti in bozza</button>') +
      (event.status !== "fatto"
        ? '<button type="button" class="btn btn--outline btn--small" data-action="done">Segna come fatto</button>'
        : "") +
      '<button type="button" class="btn btn--outline btn--small" data-action="delete">Elimina</button>' +
      "</div>";

    row.querySelector('[data-action="edit"]').addEventListener("click", function () {
      openForm(event);
    });
    row.querySelector('[data-action="delete"]').addEventListener("click", function () {
      if (window.confirm('Eliminare definitivamente "' + event.title + '"?')) {
        deleteEvent(event.id);
      }
    });
    var publishBtn = row.querySelector('[data-action="publish"]');
    if (publishBtn) {
      publishBtn.addEventListener("click", function () {
        updateEventStatus(event.id, "pubblicato");
      });
    }
    var unpublishBtn = row.querySelector('[data-action="unpublish"]');
    if (unpublishBtn) {
      unpublishBtn.addEventListener("click", function () {
        updateEventStatus(event.id, "bozza");
      });
    }
    var doneBtn = row.querySelector('[data-action="done"]');
    if (doneBtn) {
      doneBtn.addEventListener("click", function () {
        updateEventStatus(event.id, "fatto");
      });
    }

    return row;
  }

  function loadEvents() {
    fetch("/api/events?all=1")
      .then(function (res) {
        if (!res.ok) throw new Error("Impossibile caricare gli eventi.");
        return res.json();
      })
      .then(function (data) {
        var events = (data && data.events) || [];
        eventsListEl.innerHTML = "";
        eventsEmptyEl.hidden = events.length > 0;
        events.forEach(function (event) {
          eventsListEl.appendChild(renderEventRow(event));
        });
      })
      .catch(function (err) {
        eventsListEl.innerHTML = "";
        eventsEmptyEl.hidden = false;
        eventsEmptyEl.textContent = err.message || "Errore nel caricamento degli eventi.";
      });
  }

  function updateEventStatus(id, status) {
    fetch("/api/events/" + encodeURIComponent(id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Aggiornamento non riuscito.");
        loadEvents();
      })
      .catch(function (err) {
        window.alert(err.message);
      });
  }

  function deleteEvent(id) {
    fetch("/api/events/" + encodeURIComponent(id), { method: "DELETE" })
      .then(function (res) {
        if (!res.ok && res.status !== 204) throw new Error("Eliminazione non riuscita.");
        loadEvents();
      })
      .catch(function (err) {
        window.alert(err.message);
      });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formError.hidden = true;

    var id = document.getElementById("event-id").value;
    var payload = {
      title: document.getElementById("event-title").value,
      category: document.getElementById("event-category").value,
      whenLabel: document.getElementById("event-when").value,
      whereLabel: document.getElementById("event-where").value,
      description: document.getElementById("event-desc").value,
      ctaLabel: document.getElementById("event-cta").value,
      status: document.getElementById("event-status").value,
    };

    var request = id
      ? fetch("/api/events/" + encodeURIComponent(id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    request
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) {
            throw new Error((data && data.error) || "Salvataggio non riuscito.");
          });
        }
        closeForm();
        loadEvents();
      })
      .catch(function (err) {
        formError.textContent = err.message;
        formError.hidden = false;
      });
  });

  document.getElementById("new-event-btn").addEventListener("click", function () {
    openForm(null);
  });
  document.getElementById("event-form-cancel").addEventListener("click", closeForm);

  // --- Impostazioni (link social + galleria) ---
  var settingsForm = document.getElementById("settings-form");
  var settingsStatus = document.getElementById("settings-form-status");

  function loadSettings() {
    fetch("/api/settings")
      .then(function (res) { return res.json(); })
      .then(function (settings) {
        document.getElementById("settings-instagram").value = (settings && settings.instagramUrl) || "";
        document.getElementById("settings-facebook").value = (settings && settings.facebookUrl) || "";
        document.getElementById("settings-gallery").value = (settings && settings.galleryUrl) || "";
      })
      .catch(function () {
        // Campi vuoti: si può comunque compilare e salvare da zero.
      });
  }

  settingsForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var payload = {
      instagramUrl: document.getElementById("settings-instagram").value,
      facebookUrl: document.getElementById("settings-facebook").value,
      galleryUrl: document.getElementById("settings-gallery").value,
    };

    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Salvataggio non riuscito.");
        settingsStatus.textContent = "Impostazioni salvate.";
        settingsStatus.hidden = false;
      })
      .catch(function (err) {
        settingsStatus.textContent = err.message;
        settingsStatus.hidden = false;
      });
  });

  showUserLabel();
  loadEvents();
  loadSettings();
})();
