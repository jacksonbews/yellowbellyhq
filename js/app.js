/* ================================================================
   YELLOW BELLY HQ — app shell: auth, routing, topbar
   ================================================================ */

var App = (function () {
  var api = {};
  var page = "tasks";
  var PAGES = { tasks: Tasks, docs: Docs, team: Team, studio: Studio, reports: Reports, suppliers: Suppliers, tickets: Tickets, settings: Settings, bookings: Bookings };
  api.current = function () { return page; };

  function show(id) {
    ["login-screen", "denied-screen", "app"].forEach(function (x) {
      document.getElementById(x).classList.toggle("hidden", x !== id);
    });
  }

  /* collapse the mobile hamburger menu */
  function closeNav() {
    var app = document.getElementById("app");
    if (app) app.classList.remove("nav-open");
    var hb = document.getElementById("btn-hamburger");
    if (hb) hb.setAttribute("aria-expanded", "false");
  }

  api.go = function (p) {
    if ((p === "settings" || p === "bookings" || p === "reports" || p === "suppliers") && !Store.canViewSettings()) p = "tasks";
    if (p === "studio" && !Store.canAccessStudios()) p = "tasks";
    if (p === "tickets" && !Store.isTicketAdmin()) p = "tasks";
    page = p;
    document.querySelectorAll(".nav-link").forEach(function (b) {
      b.classList.toggle("active", b.dataset.page === p);
    });
    PAGES[p].render(document.getElementById("main"));
    closeNav();
  };

  function renderTopbar() {
    var me = Store.me();
    if (!me) return;
    document.getElementById("btn-me").innerHTML = UI.avatar(me);
    document.getElementById("nav-settings").classList.toggle("hidden", !Store.canViewSettings());
    document.getElementById("nav-bookings").classList.toggle("hidden", !Store.canViewSettings());
    document.getElementById("nav-studio").classList.toggle("hidden", !Store.canAccessStudios());
    document.getElementById("nav-reports").classList.toggle("hidden", !Store.canViewSettings());
    document.getElementById("nav-suppliers").classList.toggle("hidden", !Store.canViewSettings());
    var nt = document.getElementById("nav-tickets");
    nt.classList.toggle("hidden", !Store.isTicketAdmin());
    nt.querySelector(".nav-badge").textContent = Store.openTicketCount() || "";
    Tickets.mountBubble();
    renderSidebarClocks();
    Notif.render();

    /* "Preview as" — both Ownership tiers can view the HQ as any teammate */
    var wrap = document.getElementById("demo-switcher-wrap");
    if (Store.canPreviewAs()) {
      wrap.classList.remove("hidden");
      wrap.classList.toggle("previewing", Store.isPreviewing());
      var sel = document.getElementById("demo-user-select");
      if (sel.options.length !== Store.team().length) {
        sel.innerHTML = Store.team().map(function (m) {
          return '<option value="' + m.id + '">' + UI.esc(m.name) + "</option>";
        }).join("");
      }
      sel.value = me.id;
    } else {
      wrap.classList.add("hidden");
    }
  }

  /* live city clocks in the sidebar, driven by the managed cities list */
  function renderSidebarClocks() {
    var wrap = document.getElementById("sidebar-clocks");
    if (!wrap) return;
    var cities = Store.cities();
    wrap.innerHTML = cities.map(function (c) {
      return '<div class="sb-clock"><span class="sb-clock-name">' + UI.esc(c.label) + "</span>" +
        '<span class="sb-clock-time" data-citytime="' + UI.esc(c.id) + '">' + UI.cityTime(c.id) + "</span></div>";
    }).join("");
  }

  function boot() {
    /* nav */
    document.querySelectorAll(".nav-link").forEach(function (b) {
      b.onclick = function () { api.go(b.dataset.page); closeNav(); };
    });
    /* mobile hamburger menu */
    var hb = document.getElementById("btn-hamburger");
    if (hb) {
      hb.onclick = function () {
        var open = document.getElementById("app").classList.toggle("nav-open");
        hb.setAttribute("aria-expanded", open ? "true" : "false");
      };
    }
    document.getElementById("btn-me").onclick = function () {
      Team.openProfile(Store.me().id);
    };
    document.getElementById("btn-google-signin").onclick = function () {
      Store.signInGoogle().catch(function (e) {
        var el = document.getElementById("login-error");
        el.textContent = e.message || "Sign-in failed — try again.";
        el.classList.remove("hidden");
      });
    };
    document.getElementById("btn-denied-signout").onclick = function () {
      Store.signOut().then(function () { show("login-screen"); });
    };
    document.getElementById("demo-user-select").onchange = function (e) {
      Store.previewAs(e.target.value);
      UI.closeModal();
    };
    Notif.init();

    /* keep every city clock ticking (Team page + anywhere else) */
    UI.refreshClocks();
    setInterval(UI.refreshClocks, 20000);

    /* move any To Do task that's due today into the Due Today column */
    setInterval(function () { if (Store.me()) { Store.promoteDueToday(); Store.resetWeeklyStudioTasks(); } }, 5 * 60 * 1000);

    /* live re-render on any data change */
    Store.onChange(function () {
      if (!Store.me()) return;
      renderTopbar();
      /* don't wipe the page while a modal is open (e.g. typing a comment) */
      if (!document.querySelector(".modal-overlay")) {
        PAGES[page].render(document.getElementById("main"));
      }
    });

    Store.onAuth(function (status) {
      if (status === "in" && Store.me()) {
        show("app");
        Store.promoteDueToday();
        Store.resetWeeklyStudioTasks();
        renderTopbar();
        api.go(page);
      } else if (status === "denied") {
        document.getElementById("denied-email").textContent = "Signed in as: " + (Store.authEmail() || "unknown");
        show("denied-screen");
      } else if (status === "out") {
        show("login-screen");
      } else if (status === "error") {
        show("login-screen");
        var el = document.getElementById("login-error");
        el.textContent = "Couldn't reach Firebase — check your internet connection and config.";
        el.classList.remove("hidden");
      }
    });

    Store.init();
  }

  document.addEventListener("DOMContentLoaded", boot);
  return api;
})();
