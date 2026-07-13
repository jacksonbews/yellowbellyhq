/* ================================================================
   YELLOW BELLY HQ — Team Reports  (Ownership only)
   Two sections:
     1. KPI Report      — leaderboard of KPI completion (moved here
                          from the Tasks page).
     2. Studio Manager  — weekly leaderboard of the three studio
        Leaderboard       managers, ranked by how much of their
                          studios' checklist they've ticked off this
                          week, with a per-studio % breakdown.
   Access: Ownership & Developer + Ownership only.
   ================================================================ */

var Reports = (function () {
  var api = {};
  var studioWeekView = "current";   // "current" | "last" — leaderboard week toggle

  /* remember which sections are open, per user */
  function secOpen(key) { return localStorage.getItem("ybhq_report_" + key + "_" + Store.me().id) !== "closed"; }
  function setSecOpen(key, v) { localStorage.setItem("ybhq_report_" + key + "_" + Store.me().id, v ? "open" : "closed"); }

  function track(pct) { return '<div class="kr-track"><i style="width:' + pct + '%"></i></div>'; }

  /* ---------- 1. KPI report ---------- */
  function kpiLeaderboard() {
    var tally = {};
    Store.tasks().forEach(function (t) {
      if (!t.isKpi) return;
      var done = t.status === "complete";   // the MAIN task, not subtasks
      (t.assigneeIds || []).forEach(function (id) {
        if (!tally[id]) tally[id] = { total: 0, done: 0 };
        tally[id].total++;
        if (done) tally[id].done++;
      });
    });
    return Object.keys(tally).map(function (id) {
      var m = Store.member(id), d = tally[id];
      return { member: m, total: d.total, done: d.done, pct: d.total ? Math.round(d.done / d.total * 100) : 0 };
    }).filter(function (r) { return r.member; }).sort(function (a, b) {
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (b.done !== a.done) return b.done - a.done;
      return a.member.name.localeCompare(b.member.name);
    });
  }

  function renderKpiReport(main) {
    var rows = kpiLeaderboard();
    var open = secOpen("kpi");
    var allKpis = Store.tasks().filter(function (t) { return t.isKpi; });
    var doneKpis = allKpis.filter(function (t) { return t.status === "complete"; }).length;
    var sec = UI.el(
      '<div class="kpi-report' + (open ? "" : " collapsed") + '">' +
      '  <button class="kpi-report-head" type="button">' +
      '    <span class="kr-chev">▾</span>' +
      '    <span class="kr-title">KPI Report</span>' +
      '    <span class="kr-count">( ' + rows.length + " " + (rows.length === 1 ? "person" : "people") + " )</span>" +
      '    <span class="kr-overall">' + doneKpis + " / " + allKpis.length + " KPIs complete</span>" +
      "  </button>" +
      '  <div class="kpi-report-body"></div>' +
      "</div>"
    );
    sec.querySelector(".kpi-report-head").onclick = function () {
      setSecOpen("kpi", !secOpen("kpi"));
      sec.classList.toggle("collapsed");
    };
    var body = sec.querySelector(".kpi-report-body");
    if (!rows.length) {
      body.appendChild(UI.el('<div class="kr-empty">No KPIs assigned yet — use <b>+ Add KPI</b> on the Tasks page to set some.</div>'));
    } else {
      rows.forEach(function (r, i) {
        body.appendChild(UI.el(
          '<div class="kr-row">' +
          '  <span class="kr-rank' + (i === 0 ? " top" : "") + '">' + (i + 1) + "</span>" +
          UI.avatar(r.member, "sm") +
          '  <span class="kr-name">' + UI.esc(r.member.name) + "</span>" +
          track(r.pct) +
          '  <span class="kr-stat"><b>' + r.done + "</b>/" + r.total + "</span>" +
          '  <span class="kr-pct">' + r.pct + "%</span>" +
          "</div>"
        ));
      });
    }
    main.appendChild(sec);
  }

  /* ---------- 2. Studio manager leaderboard ---------- */
  /* one entry per studio manager: their studios (excluding Ownership-
     only ones they don't check), and this week's checklist progress   */
  function studioLeaderboard(weekOf) {
    return Store.team().filter(function (m) { return m.role === "studio-admin"; }).map(function (m) {
      var cityIds = (m.studioAccess || []);
      var studios = [];
      cityIds.forEach(function (cid) {
        Store.studiosInCity(cid).forEach(function (s) { if (!s.ownerOnly) studios.push(s); });
      });
      var total = 0, done = 0;
      var perStudio = studios.map(function (s) {
        var tot, d;
        if (weekOf) {                                   // a past week — read from the archive
          var items = Store.studioArchiveFor(s.id, weekOf) || [];
          tot = items.length; d = items.filter(function (i) { return i.done; }).length;
        } else {                                        // this week — live checklist state
          var ts = Store.studioTasks(s.id);
          tot = ts.length; d = ts.filter(function (t) { return t.done; }).length;
        }
        total += tot; done += d;
        return { studio: s, total: tot, done: d, pct: tot ? Math.round(d / tot * 100) : 0 };
      });
      var city = cityIds.length ? Store.city(cityIds[0]) : null;
      return {
        member: m, cityLabel: city ? city.label : "",
        studios: perStudio, total: total, done: done,
        pct: total ? Math.round(done / total * 100) : 0
      };
    }).sort(function (a, b) {
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (b.done !== a.done) return b.done - a.done;
      return a.member.name.localeCompare(b.member.name);
    });
  }

  function renderStudioReport(main) {
    var lastWeek = Store.lastArchivedWeek();
    if (studioWeekView === "last" && !lastWeek) studioWeekView = "current";
    var viewingLast = studioWeekView === "last";
    var weekOf = viewingLast ? lastWeek : null;

    var rows = studioLeaderboard(weekOf);
    var open = secOpen("studio");
    var total = 0, done = 0;
    rows.forEach(function (r) { total += r.total; done += r.done; });
    var when = viewingLast ? "Last week · " + Store.weekRangeLabel(lastWeek) : "This week";
    var sec = UI.el(
      '<div class="kpi-report' + (open ? "" : " collapsed") + '">' +
      '  <button class="kpi-report-head" type="button">' +
      '    <span class="kr-chev">▾</span>' +
      '    <span class="kr-title">Studio Manager Checklist Progress</span>' +
      '    <span class="kr-count">( ' + rows.length + " " + (rows.length === 1 ? "manager" : "managers") + " )</span>" +
      '    <span class="kr-overall">' + UI.esc(when) + " · " + done + " / " + total + " checks done</span>" +
      "  </button>" +
      '  <div class="kpi-report-body"></div>' +
      "</div>"
    );
    sec.querySelector(".kpi-report-head").onclick = function () {
      setSecOpen("studio", !secOpen("studio"));
      sec.classList.toggle("collapsed");
    };
    var body = sec.querySelector(".kpi-report-body");

    /* This week / Last week toggle */
    var seg = UI.el(
      '<div class="seg sr-weekseg">' +
      '<button data-w="current"' + (viewingLast ? "" : ' class="active"') + ">This week</button>" +
      '<button data-w="last"' + (viewingLast ? ' class="active"' : "") + (lastWeek ? "" : " disabled") + ">Last week</button>" +
      "</div>"
    );
    seg.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () {
        if (b.disabled) return;
        studioWeekView = b.dataset.w;
        api.render(main);
      };
    });
    body.appendChild(seg);

    if (!rows.length) {
      body.appendChild(UI.el('<div class="kr-empty">No studio managers found.</div>'));
    } else {
      rows.forEach(function (r, i) {
        body.appendChild(UI.el(
          '<div class="kr-row">' +
          '  <span class="kr-rank' + (i === 0 ? " top" : "") + '">' + (i + 1) + "</span>" +
          UI.avatar(r.member, "sm") +
          '  <span class="kr-name">' + UI.esc(r.member.name) +
          '    <span class="kr-sub">' + UI.esc(r.cityLabel) + "</span></span>" +
          track(r.pct) +
          '  <span class="kr-stat"><b>' + r.done + "</b>/" + r.total + "</span>" +
          '  <span class="kr-pct">' + r.pct + "%</span>" +
          "</div>"
        ));
        /* per-studio breakdown for this manager */
        var bd = UI.el('<div class="sr-breakdown"></div>');
        if (!r.studios.length) {
          bd.appendChild(UI.el('<div class="sr-studio sr-none">No studios assigned.</div>'));
        }
        r.studios.forEach(function (s) {
          // clickable → jumps to that exact city + studio's checklist.
          // data-driven via Studio.open, so new cities/studios link automatically.
          var srow = UI.el(
            '<button type="button" class="sr-studio sr-studio-link" title="Open ' + UI.esc(s.studio.name) + " checklist\">" +
            '<span class="sr-studio-name">' + UI.esc(s.studio.name) + "</span>" +
            track(s.pct) +
            '<span class="sr-studio-stat">' + s.done + "/" + s.total + "</span>" +
            '<span class="sr-studio-pct">' + s.pct + "%</span>" +
            "</button>"
          );
          srow.onclick = function () { Studio.open(s.studio.cityId, s.studio.id); };
          bd.appendChild(srow);
        });
        body.appendChild(bd);
      });
    }
    main.appendChild(sec);
  }

  /* ---------- page ---------- */
  api.render = function (main) {
    if (!Store.canViewSettings()) { App.go("tasks"); return; }
    main.innerHTML = "";
    main.appendChild(UI.el(
      '<div class="page-head"><div>' +
      '<div class="page-title">Team Reports</div>' +
      '<div class="page-sub">KPI progress and weekly studio checks — updated live as the team ticks work off.</div>' +
      "</div></div>"
    ));
    renderKpiReport(main);
    renderStudioReport(main);
  };

  return api;
})();
