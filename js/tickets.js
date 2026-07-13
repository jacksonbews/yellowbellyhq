/* ================================================================
   YELLOW BELLY HQ — Bug / Idea tickets
   • A yellow report bubble (bottom-right) for both Ownership tiers:
     toggle bug/idea, auto-records the page, description + screenshots,
     and a comment thread shared with the admin.
   • A private Tickets page (admin only) to review, comment, and check
     off tickets — resolving notifies the reporter.
   ================================================================ */

var Tickets = (function () {
  var api = {};
  var panelOpen = false;
  var draftType = "bug";
  var staged = [];            // { file, url } screenshots waiting to send
  var capturedPage = "";      // page the reporter opened the bubble on

  var PAGE_LABELS = {
    tasks: "Tasks", docs: "Company Docs", team: "Team", studio: "Studio Checklist",
    reports: "Team Reports", suppliers: "Supplier Contacts", settings: "Settings",
    bookings: "Bookings", tickets: "Tickets"
  };
  function pageLabel(p) { return PAGE_LABELS[p] || p || "—"; }
  function typeLabel(t) { return t === "idea" ? "Idea" : "Bug"; }
  /* did the reporter see the app in the mobile or web layout? (matches the 768px CSS breakpoint) */
  function currentView() { return window.matchMedia("(max-width: 768px)").matches ? "mobile" : "web"; }
  function viewLabel(v) { return v === "mobile" ? "Mobile view" : "Web view"; }

  var BUBBLE_SVG =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M8 3h8a4 4 0 0 1 4 4v6a4 4 0 0 1 -4 4h-4l-4 4v-4a4 4 0 0 1 -4 -4v-6a4 4 0 0 1 4 -4z"/>' +
    '<path d="M12 7v4"/><path d="M12 14v.01"/></svg>';

  /* ---------------- floating bubble + report panel ---------------- */
  api.mountBubble = function () {
    var host = document.getElementById("app");
    if (!host) return;
    var bubble = document.getElementById("report-bubble");
    if (!Store.canReportTickets()) {
      if (bubble) bubble.classList.add("hidden");
      if (panelOpen) closePanel();
      return;
    }
    if (!bubble) {
      bubble = UI.el('<button id="report-bubble" class="report-bubble hidden" title="Report a bug or idea" aria-label="Report a bug or idea">' + BUBBLE_SVG + "</button>");
      bubble.onclick = function (e) { e.stopPropagation(); togglePanel(); };
      host.appendChild(bubble);
      host.appendChild(UI.el('<div id="report-panel" class="report-panel hidden"></div>'));
      document.addEventListener("click", function (e) {
        if (panelOpen && !e.target.closest("#report-panel") && !e.target.closest("#report-bubble")) closePanel();
      });
    }
    bubble.classList.remove("hidden");
    if (panelOpen) renderPanel();   // keep "your reports" list fresh
  };

  function togglePanel() { panelOpen ? closePanel() : openPanel(); }
  function openPanel() {
    panelOpen = true;
    capturedPage = App.current();
    document.getElementById("report-panel").classList.remove("hidden");
    document.getElementById("report-bubble").classList.add("active");
    renderPanel();
  }
  function closePanel() {
    panelOpen = false;
    var p = document.getElementById("report-panel");
    if (p) p.classList.add("hidden");
    var b = document.getElementById("report-bubble");
    if (b) b.classList.remove("active");
    clearStaged();
  }
  api.closePanel = closePanel;

  function clearStaged() {
    staged.forEach(function (s) { URL.revokeObjectURL(s.url); });
    staged = [];
  }

  function renderPanel() {
    var panel = document.getElementById("report-panel");
    if (!panel) return;
    var mine = Store.myTickets();
    panel.innerHTML =
      '<div class="rp-head"><span class="rp-title">Report</span><button class="rp-close" aria-label="Close">×</button></div>' +
      '<div class="rp-seg">' +
      '<button data-t="bug"' + (draftType === "bug" ? ' class="on"' : "") + ">Bug</button>" +
      '<button data-t="idea"' + (draftType === "idea" ? ' class="on"' : "") + ">Idea</button>" +
      "</div>" +
      '<div class="rp-page">On <b>' + UI.esc(pageLabel(capturedPage)) + "</b></div>" +
      '<textarea class="rp-desc" placeholder="Describe the ' + draftType + " — what happened, or your idea…\" maxlength=\"1000\"></textarea>" +
      '<div class="rp-shots"></div>' +
      '<div class="rp-actions"><button class="rp-attach" type="button">+ Add screenshots</button>' +
      '<button class="rp-send btn btn-yellow btn-sm" type="button">Send report</button></div>' +
      '<input type="file" class="rp-file" accept="image/*" multiple style="display:none">' +
      (mine.length ? '<div class="rp-mine-head">Your reports</div><div class="rp-mine"></div>' : "");

    panel.querySelector(".rp-close").onclick = closePanel;
    panel.querySelectorAll(".rp-seg button").forEach(function (b) {
      b.onclick = function () {
        draftType = b.dataset.t;
        panel.querySelectorAll(".rp-seg button").forEach(function (x) { x.classList.toggle("on", x === b); });
        var ta = panel.querySelector(".rp-desc");
        if (!ta.value) ta.placeholder = "Describe the " + draftType + " — what happened, or your idea…";
      };
    });

    var fileInput = panel.querySelector(".rp-file");
    panel.querySelector(".rp-attach").onclick = function () { fileInput.click(); };
    fileInput.onchange = function () {
      Array.prototype.slice.call(fileInput.files).forEach(function (f) {
        if (/^image\//.test(f.type)) staged.push({ file: f, url: URL.createObjectURL(f) });
      });
      fileInput.value = "";
      renderShots(panel);
    };
    renderShots(panel);

    panel.querySelector(".rp-send").onclick = function () {
      var desc = panel.querySelector(".rp-desc").value.trim();
      if (!desc && !staged.length) { panel.querySelector(".rp-desc").focus(); return; }
      var btn = panel.querySelector(".rp-send");
      btn.disabled = true; btn.textContent = "Sending…";
      Store.addTicket({
        type: draftType, page: capturedPage, pageLabel: pageLabel(capturedPage),
        description: desc, view: currentView(), files: staged.map(function (s) { return s.file; })
      }).then(function () {
        clearStaged();
        UI.toast(typeLabel(draftType) + " report sent");
        renderPanel();
      });
    };

    if (mine.length) {
      var list = panel.querySelector(".rp-mine");
      mine.forEach(function (t) {
        var row = UI.el(
          '<button class="rp-ticket">' +
          '<span class="tk-type tk-' + t.type + '">' + typeLabel(t.type) + "</span>" +
          '<span class="rp-tk-desc">' + UI.esc(ticketShort(t)) + "</span>" +
          '<span class="tk-state tk-' + t.status + '">' + (t.status === "done" ? "Done" : "Open") + "</span>" +
          "</button>"
        );
        row.onclick = function () { ticketModal(t.id); };
        list.appendChild(row);
      });
    }
  }

  function renderShots(root) {
    var wrap = root.querySelector(".rp-shots");
    wrap.innerHTML = "";
    staged.forEach(function (s, i) {
      var thumb = UI.el('<div class="rp-thumb"><img alt=""><button class="rp-thumb-x" aria-label="Remove">×</button></div>');
      thumb.querySelector("img").src = s.url;
      thumb.querySelector(".rp-thumb-x").onclick = function () {
        URL.revokeObjectURL(s.url); staged.splice(i, 1); renderShots(root);
      };
      wrap.appendChild(thumb);
    });
  }

  function ticketShort(t) {
    var s = (t.description || "").trim().replace(/\s+/g, " ");
    return s ? (s.length > 40 ? s.slice(0, 40) + "…" : s) : "(screenshot only)";
  }

  /* ---------------- ticket detail modal (shared) ---------------- */
  function ticketModal(id) {
    var t0 = Store.ticket(id); if (!t0) return;
    var sh = UI.modalShell(typeLabel(t0.type) + " report");
    sh.body.classList.add("ticket-modal");

    function repaint() {
      var t = Store.ticket(id); if (!t) { UI.closeModal(); return; }
      var reporter = Store.member(t.reporterId);
      var isAdmin = Store.isTicketAdmin();
      sh.body.innerHTML =
        '<div class="tm-meta">' +
        '<span class="tk-type tk-' + t.type + '">' + typeLabel(t.type) + "</span>" +
        '<span class="tk-chip">' + UI.esc(pageLabel(t.page)) + "</span>" +
        (t.view ? '<span class="tk-chip tk-view">' + viewLabel(t.view) + "</span>" : "") +
        '<span class="tk-state tk-' + t.status + '">' + (t.status === "done" ? "Done" : "Open") + "</span>" +
        "</div>" +
        '<div class="tm-by">' + UI.esc(reporter ? reporter.name : "Someone") +
        ' · <span title="' + UI.esc(UI.absTime(t.createdAt, reporter ? reporter.city : null)) + '">' + UI.timeAgo(t.createdAt) + "</span></div>" +
        '<div class="tm-desc">' + (t.description ? UI.esc(t.description) : '<span class="tm-none">No description.</span>') + "</div>" +
        (t.screenshots && t.screenshots.length ? '<div class="tm-shots"></div>' : "") +
        '<div class="tm-comments"></div>' +
        '<div class="tm-add"><textarea class="tm-input" placeholder="Write a comment…" maxlength="1000"></textarea>' +
        '<button class="btn btn-sm btn-yellow tm-send">Comment</button></div>';

      // screenshots
      if (t.screenshots && t.screenshots.length) {
        var sw = sh.body.querySelector(".tm-shots");
        t.screenshots.forEach(function (shot) {
          var cell = UI.el('<button class="tm-shot" title="' + UI.esc(shot.name || "screenshot") + '"><img alt=""></button>');
          var img = cell.querySelector("img");
          Store.getShotUrl(shot).then(function (url) { if (url) { img.src = url; cell.dataset.url = url; } });
          cell.onclick = function () { if (cell.dataset.url) window.open(cell.dataset.url, "_blank"); };
          sw.appendChild(cell);
        });
      }

      // comments
      var cw = sh.body.querySelector(".tm-comments");
      (t.comments || []).forEach(function (c) {
        var au = Store.member(c.authorId);
        var mineCls = c.authorId === Store.me().id ? " mine" : "";
        cw.appendChild(UI.el(
          '<div class="tm-cmt' + mineCls + '">' +
          '<div class="tm-cmt-head">' + UI.avatar(au, "sm") + "<b>" + UI.esc(au ? au.name : "?") + "</b>" +
          '<span class="tm-cmt-time">' + UI.timeAgo(c.ts) + "</span></div>" +
          '<div class="tm-cmt-text">' + UI.esc(c.text) + "</div></div>"
        ));
      });
      if (!(t.comments || []).length) cw.appendChild(UI.el('<div class="tm-none">No comments yet.</div>'));

      var input = sh.body.querySelector(".tm-input");
      sh.body.querySelector(".tm-send").onclick = function () {
        var v = input.value.trim(); if (!v) { input.focus(); return; }
        Store.addTicketComment(id, v).then(repaint);
      };

      // admin controls in the footer
      sh.foot.innerHTML = "";
      if (isAdmin) {
        var del = UI.el('<button class="btn btn-ghost btn-sm tm-del">Delete</button>');
        del.onclick = function () {
          UI.confirm("Delete this report?", "The report and its screenshots will be removed.", "Delete")
            .then(function (ok) { if (ok) Store.deleteTicket(id).then(function () { UI.closeModal(); UI.toast("Report deleted"); }); });
        };
        sh.foot.appendChild(del);
        var spacer = UI.el('<span style="flex:1"></span>');
        sh.foot.appendChild(spacer);
        if (t.status === "done") {
          var reopen = UI.el('<button class="btn btn-ghost">Reopen</button>');
          reopen.onclick = function () { Store.resolveTicket(id, false).then(repaint); };
          sh.foot.appendChild(reopen);
        } else {
          var done = UI.el('<button class="btn btn-primary">✓ Mark as done</button>');
          done.onclick = function () { Store.resolveTicket(id, true).then(function () { UI.toast("Marked done — reporter notified"); repaint(); }); };
          sh.foot.appendChild(done);
        }
      } else {
        var close = UI.el('<button class="btn btn-ghost">Close</button>');
        close.onclick = UI.closeModal;
        sh.foot.appendChild(close);
      }
    }
    repaint();
  }

  /* open a ticket from a notification */
  api.openTicket = function (id) {                 // admin → Tickets page
    App.go("tickets");
    ticketModal(id);
  };
  api.openReport = function (id) {                 // reporter → bubble thread
    ticketModal(id);
  };

  /* ---------------- admin Tickets page ---------------- */
  var pageFilter = "open";
  api.render = function (main) {
    if (!Store.isTicketAdmin()) { App.go("tasks"); return; }
    var all = Store.tickets();
    var openN = all.filter(function (t) { return t.status === "open"; }).length;
    var rows = all.filter(function (t) {
      return pageFilter === "all" ? true : (pageFilter === "open" ? t.status === "open" : t.status === "done");
    });

    main.innerHTML = "";
    main.appendChild(UI.el(
      '<div class="page-head"><div>' +
      '<div class="page-title">Tickets<span class="count">( ' + openN + " open )</span></div>" +
      '<div class="page-sub">Bug reports and ideas from the team. Check one off to notify the person who raised it.</div>' +
      "</div></div>"
    ));

    var bar = UI.el('<div class="toolbar"></div>');
    var seg = UI.el(
      '<div class="seg">' +
      '<button data-f="open"' + (pageFilter === "open" ? ' class="active"' : "") + ">Open</button>" +
      '<button data-f="done"' + (pageFilter === "done" ? ' class="active"' : "") + ">Done</button>" +
      '<button data-f="all"' + (pageFilter === "all" ? ' class="active"' : "") + ">All</button>" +
      "</div>"
    );
    seg.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () { pageFilter = b.dataset.f; api.render(main); };
    });
    bar.appendChild(seg);
    main.appendChild(bar);

    if (!rows.length) {
      main.appendChild(UI.el('<div class="empty"><b>Nothing here</b>' + (pageFilter === "open" ? "No open tickets — you’re all caught up." : "No tickets to show.") + "</div>"));
      return;
    }
    var list = UI.el('<div class="ticket-list"></div>');
    rows.forEach(function (t) { list.appendChild(ticketRow(t)); });
    main.appendChild(list);
  };

  function ticketRow(t) {
    var reporter = Store.member(t.reporterId);
    var nShots = (t.screenshots || []).length;
    var nCmt = (t.comments || []).length;
    var row = UI.el(
      '<div class="ticket-row' + (t.status === "done" ? " done" : "") + '">' +
      '<label class="tk-check" title="Mark done"><input type="checkbox"' + (t.status === "done" ? " checked" : "") + "></label>" +
      '<span class="tk-type tk-' + t.type + '">' + typeLabel(t.type) + "</span>" +
      '<div class="tk-main">' +
      '<div class="tk-desc">' + UI.esc(ticketShort(t)) + "</div>" +
      '<div class="tk-sub">' + UI.esc(pageLabel(t.page)) + (t.view ? " · " + (t.view === "mobile" ? "Mobile" : "Web") : "") + " · " + UI.esc(reporter ? reporter.name : "?") +
      ' · <span title="' + UI.esc(UI.absTime(t.createdAt, reporter ? reporter.city : null)) + '">' + UI.timeAgo(t.createdAt) + "</span>" +
      (nShots ? " · " + nShots + " shot" + (nShots === 1 ? "" : "s") : "") +
      (nCmt ? " · " + nCmt + " comment" + (nCmt === 1 ? "" : "s") : "") + "</div>" +
      "</div>" +
      '<span class="tk-state tk-' + t.status + '">' + (t.status === "done" ? "Done" : "Open") + "</span>" +
      "</div>"
    );
    var cb = row.querySelector('input[type="checkbox"]');
    row.querySelector(".tk-check").onclick = function (e) { e.stopPropagation(); };
    cb.onchange = function () {
      Store.resolveTicket(t.id, cb.checked).then(function () {
        if (cb.checked) UI.toast("Marked done — reporter notified");
      });
    };
    row.onclick = function () { ticketModal(t.id); };
    return row;
  }

  return api;
})();
