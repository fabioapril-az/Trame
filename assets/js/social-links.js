// Aggiorna i link social (Instagram, Facebook, galleria fotografica) con i
// valori impostati dagli editor nella pagina di amministrazione. Finché
// non sono configurati, i link restano nascosti (hidden nell'HTML) e la
// nota "in fase di attivazione" resta visibile.

(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var links = document.querySelectorAll("[data-social]");
    if (!links.length) return;

    fetch("/api/settings")
      .then(function (res) {
        if (!res.ok) throw new Error("Richiesta impostazioni non riuscita");
        return res.json();
      })
      .then(function (settings) {
        var urls = {
          instagram: settings && settings.instagramUrl,
          facebook: settings && settings.facebookUrl,
          gallery: settings && settings.galleryUrl,
        };
        var anyVisible = false;

        links.forEach(function (link) {
          var key = link.getAttribute("data-social");
          var url = urls[key];
          if (url) {
            link.href = url;
            link.hidden = false;
            anyVisible = true;
          }
        });

        if (anyVisible) {
          document.querySelectorAll("[data-social-note]").forEach(function (note) {
            note.hidden = true;
          });
        }
      })
      .catch(function () {
        // Nessun problema: i link restano nascosti come da HTML di partenza.
      });
  });
})();
