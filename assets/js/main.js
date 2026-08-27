// Progetto TraMe — script condiviso

document.addEventListener("DOMContentLoaded", function () {
  /* Logo header: l'effetto "a cavallo" tra barra e onda ha senso solo
     in cima alla pagina. Appena si scorre, la barra sticky può trovarsi
     sopra contenuto qualsiasi (non più solo lo sfondo decorativo), quindi
     il logo torna dentro i bordi (vedi .site-header.is-scrolled in CSS). */
  var siteHeader = document.querySelector(".site-header");
  if (siteHeader) {
    var updateHeaderScrolled = function () {
      siteHeader.classList.toggle("is-scrolled", window.scrollY > 4);
    };
    updateHeaderScrolled();
    window.addEventListener("scroll", updateHeaderScrolled, { passive: true });
  }

  /* Menu mobile */
  var toggle = document.querySelector(".nav__toggle");
  var nav = document.querySelector(".nav");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    nav.querySelectorAll(".nav__link").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* Anno corrente nel footer */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* Filtro eventi (solo pagina eventi.html) */
  var filterButtons = document.querySelectorAll(".filter-btn");
  var eventCards = document.querySelectorAll(".event-card");

  if (filterButtons.length && eventCards.length) {
    filterButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var category = btn.getAttribute("data-filter");

        filterButtons.forEach(function (b) {
          b.classList.remove("is-active");
        });
        btn.classList.add("is-active");

        eventCards.forEach(function (card) {
          var cardCategory = card.getAttribute("data-category");
          var show = category === "tutti" || category === cardCategory;
          card.classList.toggle("is-hidden", !show);
        });
      });
    });
  }

});
