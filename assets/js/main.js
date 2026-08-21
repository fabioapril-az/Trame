// Progetto TraMe — script condiviso

document.addEventListener("DOMContentLoaded", function () {
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

  /* Form contatti: costruisce una mail (nessun backend sul sito statico) */
  var contactForm = document.getElementById("contact-form");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var nome = contactForm.querySelector("#nome").value.trim();
      var email = contactForm.querySelector("#email").value.trim();
      var argomento = contactForm.querySelector("#argomento").value;
      var messaggio = contactForm.querySelector("#messaggio").value.trim();

      var destinatario = "info@progettotrame.it";
      var oggetto = encodeURIComponent("[Progetto TraMe] " + (argomento || "Richiesta dal sito"));
      var corpo = encodeURIComponent(
        "Nome: " + nome + "\nEmail: " + email + "\n\n" + messaggio
      );

      window.location.href = "mailto:" + destinatario + "?subject=" + oggetto + "&body=" + corpo;
    });
  }
});
