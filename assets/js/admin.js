// Logica della pagina di amministrazione (admin.html) — solo Impostazioni
// (link social + galleria) ora: la gestione eventi si è spostata
// interamente in admin-soci.html/admin-soci.js (eventi con posti/quote/
// iscrizioni, unico sistema — il vecchio CMS eventi separato su questa
// pagina è stato rimosso, mai avuto dati reali).
// La protezione vera è a livello di routing (staticwebapp.config.json,
// ruolo "editor") e di API (controllo x-ms-client-principal lato server):
// questo script assume di girare già in un contesto autorizzato e si
// occupa solo di caricare/mostrare/modificare i dati.

(function () {
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
  loadSettings();
})();
