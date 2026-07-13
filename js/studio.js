/* ================================================================
   YELLOW BELLY HQ — Studio Checklist page
   Toggle by city → tabs per studio → a weekly checklist per studio
   (tick + Date Checked / Any Issues-Notes / Actions Taken columns).
   Access: Ownership tiers see all cities; studio managers see the
   city they're assigned (Liv → London, Matthew → New York,
   Grace Stockdale → Los Angeles). Recurring items reset each week.
   ================================================================ */

var Studio = (function () {
  var api = {};
  var curCity = null, curStudio = null, curWeek = null;

  function accessibleCities() {
    var ids = Store.studioCitiesFor();
    return Store.cities().filter(function (c) { return ids.indexOf(c.id) !== -1; });
  }

  /* open the page at a specific city/studio (e.g. from a notification or
     the Team Reports leaderboard) — lands on the current week */
  api.open = function (cityId, studioId) {
    if (cityId) curCity = cityId;
    if (studioId) curStudio = studioId;
    curWeek = null;
    App.go("studio");
  };

  api.render = function (main) {
    if (!Store.canAccessStudios()) { App.go("tasks"); return; }
    var cities = accessibleCities();

    main.innerHTML = "";
    main.appendChild(UI.el(
      '<div class="page-head"><div>' +
      '<div class="page-title">Studio Checklist</div>' +
      '<div class="page-sub">Weekly studio checks — tick each item off and log any issues or actions.</div>' +
      "</div></div>"
    ));
    if (!cities.length) {
      main.appendChild(UI.el('<div class="empty"><b>No studios assigned to you</b>Ask an owner for studio access.</div>'));
      return;
    }

    if (!curCity || !cities.some(function (c) { return c.id === curCity; })) curCity = cities[0].id;

    /* city toggle (only when more than one is accessible) */
    var canOwner = Store.canViewSettings();
    if (cities.length > 1) {
      var bar = UI.el('<div class="toolbar"></div>');
      var seg = UI.el('<div class="seg seg-city"></div>');
      cities.forEach(function (c) {
        var mgr = "";
        if (canOwner) {   // Ownership tiers see who manages each city
          var names = Store.team()
            .filter(function (m) { return (m.studioAccess || []).indexOf(c.id) !== -1; })
            .map(function (m) { return m.name; });
          if (names.length) mgr = '<span class="studio-city-mgr">' + UI.esc(names.join(", ")) + "</span>";
        }
        var b = UI.el("<button" + (c.id === curCity ? ' class="active"' : "") + ">" + UI.esc(c.label) + mgr + "</button>");
        b.onclick = function () { curCity = c.id; curStudio = null; curWeek = null; api.render(main); };
        seg.appendChild(b);
      });
      bar.appendChild(seg);
      main.appendChild(bar);
    }

    /* studio tabs (some studios, e.g. the London Office, are Ownership-only) */
    var studios = Store.studiosInCity(curCity).filter(function (s) { return !s.ownerOnly || canOwner; });
    if (!studios.length) {
      main.appendChild(UI.el('<div class="empty">No studios in ' + UI.esc(UI.cityLabel(curCity)) + " yet.</div>"));
      return;
    }
    if (!curStudio || !studios.some(function (s) { return s.id === curStudio; })) curStudio = studios[0].id;
    var tabs = UI.el('<div class="studio-tabs"></div>');
    studios.forEach(function (s) {
      // Ownership-only studios (e.g. the Office) have no studio manager assigned
      var note = (canOwner && s.ownerOnly) ? '<span class="studio-tab-note">Not assigned yet</span>' : "";
      var b = UI.el('<button class="studio-tab' + (s.id === curStudio ? " active" : "") + '">' + UI.esc(s.name) + note + "</button>");
      b.onclick = function () { curStudio = s.id; curWeek = null; api.render(main); };
      tabs.appendChild(b);
    });
    main.appendChild(tabs);

    renderChecklist(main, curStudio);
  };

  function checklistTableShell() {
    return UI.el(
      '<div class="table-wrap"><table class="studio-check"><thead><tr>' +
      '<th class="sc-tick"></th><th>Task</th>' +
      '<th>Any Issues / Notes<span class="sc-hint">Equipment needing replacing, cleanliness, maintenance needed</span></th>' +
      '<th>Actions Taken<span class="sc-hint">Items ordered / maintenance carried out / equipment sent to be repaired etc</span></th>' +
      "<th></th>" +
      "</tr></thead><tbody></tbody></table></div>"
    );
  }

  function renderChecklist(main, studioId) {
    /* which weeks can we look at: any archived past weeks + this week */
    var current = Store.currentWeek();
    var weeks = Store.studioArchiveWeeks(studioId);
    weeks = weeks.concat([current]).filter(function (w, i, a) { return a.indexOf(w) === i; }).sort();
    if (!curWeek || weeks.indexOf(curWeek) === -1) curWeek = current;
    var idx = weeks.indexOf(curWeek);
    var isCurrent = curWeek === current;

    var wrap = UI.el('<div class="studio-check-wrap"></div>');

    /* ---- week navigation ---- */
    var nav = UI.el('<div class="sc-weeknav"></div>');
    var prev = UI.el('<button class="sc-week-arrow"' + (idx <= 0 ? " disabled" : "") + ' aria-label="Previous week">‹</button>');
    var next = UI.el('<button class="sc-week-arrow"' + (isCurrent ? " disabled" : "") + ' aria-label="Next week">›</button>');
    var label = UI.el(
      '<div class="sc-week-label"><span class="sc-week-when">' + (isCurrent ? "This week" : "Week of") + "</span>" +
      '<span class="sc-week-range">' + UI.esc(Store.weekRangeLabel(curWeek)) + "</span>" +
      (isCurrent ? "" : '<span class="chip chip-past">Past week · read only</span>') + "</div>"
    );
    prev.onclick = function () { if (idx > 0) { curWeek = weeks[idx - 1]; api.render(main); } };
    next.onclick = function () { if (idx < weeks.length - 1) { curWeek = weeks[idx + 1]; api.render(main); } };
    nav.appendChild(prev); nav.appendChild(label); nav.appendChild(next);
    wrap.appendChild(nav);

    if (isCurrent) renderLiveChecklist(wrap, studioId);
    else renderArchivedChecklist(wrap, studioId, curWeek);

    main.appendChild(wrap);
  }

  /* the editable current-week checklist */
  function renderLiveChecklist(wrap, studioId) {
    var tasks = Store.studioTasks(studioId);
    var doneCount = tasks.filter(function (t) { return t.done; }).length;
    wrap.appendChild(UI.el('<div class="studio-check-head">This week <span class="ppl-n">( ' + doneCount + " / " + tasks.length + " checked )</span></div>"));

    var table = checklistTableShell();
    var tbody = table.querySelector("tbody");
    if (!tasks.length) {
      tbody.appendChild(UI.el('<tr><td colspan="5" class="sc-empty">No checklist items yet — add one below.</td></tr>'));
    }
    tasks.forEach(function (t) { tbody.appendChild(taskRow(t)); });
    wrap.appendChild(table);

    /* add a checklist task */
    var weekly = true;
    var add = UI.el(
      '<div class="sc-add">' +
      '<input type="text" id="sc-add-input" placeholder="Add a checklist item…" maxlength="160">' +
      '<button type="button" class="pill on" id="sc-add-weekly">Weekly</button>' +
      '<button type="button" class="btn btn-sm btn-yellow" id="sc-add-btn">Add task</button>' +
      "</div>"
    );
    var wbtn = add.querySelector("#sc-add-weekly");
    wbtn.title = "Repeats every week — resets each Monday";
    wbtn.onclick = function () { weekly = !weekly; wbtn.classList.toggle("on", weekly); };
    var inp = add.querySelector("#sc-add-input");
    function addTask() {
      var v = inp.value.trim(); if (!v) return;
      Store.addStudioTask(studioId, v, weekly);
    }
    add.querySelector("#sc-add-btn").onclick = addTask;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addTask(); } });
    wrap.appendChild(add);
  }

  /* a read-only snapshot of a previous week's checks */
  function renderArchivedChecklist(wrap, studioId, weekOf) {
    var items = Store.studioArchiveFor(studioId, weekOf) || [];
    var doneCount = items.filter(function (i) { return i.done; }).length;
    wrap.appendChild(UI.el('<div class="studio-check-head">Completed <span class="ppl-n">( ' + doneCount + " / " + items.length + " checked )</span></div>"));

    var table = checklistTableShell();
    var tbody = table.querySelector("tbody");
    if (!items.length) {
      tbody.appendChild(UI.el('<tr><td colspan="5" class="sc-empty">No record kept for this week.</td></tr>'));
    }
    items.forEach(function (it) { tbody.appendChild(archiveRow(it)); });
    wrap.appendChild(table);
  }

  function archiveRow(it) {
    return UI.el(
      '<tr class="sc-archive' + (it.done ? " sc-done" : "") + '">' +
      '<td class="sc-tick"><input type="checkbox" disabled' + (it.done ? " checked" : "") + "></td>" +
      '<td class="sc-task"><span class="sc-task-ro">' + UI.esc(it.text) + "</span>" +
      (it.recurring ? ' <span class="chip chip-recur">↻ Weekly</span>' : "") +
      '<div class="sc-checked' + (it.done && it.checkedAt ? "" : " hidden") + '">' +
      (it.checkedAt ? "Checked " + UI.esc(UI.createdStamp(it.checkedAt, curCity)) : "") + "</div></td>" +
      '<td class="sc-ro-cell">' + (it.notes ? UI.esc(it.notes) : '<span class="sc-dash">—</span>') + "</td>" +
      '<td class="sc-ro-cell">' + (it.actions ? UI.esc(it.actions) : '<span class="sc-dash">—</span>') + "</td>" +
      "<td></td></tr>"
    );
  }

  function taskRow(t) {
    var row = UI.el(
      '<tr class="' + (t.done ? "sc-done" : "") + '">' +
      '<td class="sc-tick"><input type="checkbox"' + (t.done ? " checked" : "") + "></td>" +
      '<td class="sc-task"><input type="text" class="sc-task-input" maxlength="160" title="Click to edit">' +
      (t.recurring ? ' <span class="chip chip-recur">↻ Weekly</span>' : "") +
      '<div class="sc-checked' + (t.done && t.checkedAt ? "" : " hidden") + '">' +
      (t.checkedAt ? "Checked " + UI.esc(UI.createdStamp(t.checkedAt, curCity)) : "") + "</div></td>" +
      '<td><input type="text" class="sc-notes" placeholder="—" maxlength="240"></td>' +
      '<td><input type="text" class="sc-actions" placeholder="—" maxlength="240"></td>' +
      '<td><button type="button" class="sc-x" aria-label="Remove item">×</button></td>' +
      "</tr>"
    );
    row.querySelector(".sc-task-input").value = t.text || "";
    row.querySelector(".sc-notes").value = t.notes || "";
    row.querySelector(".sc-actions").value = t.actions || "";

    row.querySelector(".sc-task-input").onchange = function (e) {
      var v = e.target.value.trim();
      if (v && v !== t.text) Store.updateStudioTask(t.id, { text: v });
      else e.target.value = t.text;   // ignore blanks
    };

    row.querySelector('input[type="checkbox"]').onchange = function (e) {
      // tick auto-stamps the date + time; untick clears it
      var checked = e.target.checked;
      Store.updateStudioTask(t.id, checked
        ? { done: true, checkedAt: Date.now() }
        : { done: false, checkedAt: 0 })
        .then(function () { if (checked) Store.checkStudioComplete(t.studioId); });
    };
    row.querySelector(".sc-notes").onchange = function (e) { Store.updateStudioTask(t.id, { notes: e.target.value.trim() }); };
    row.querySelector(".sc-actions").onchange = function (e) { Store.updateStudioTask(t.id, { actions: e.target.value.trim() }); };
    row.querySelector(".sc-x").onclick = function () {
      UI.confirm("Remove item?", "“" + t.text + "” will be removed from this studio's checklist.", "Remove")
        .then(function (ok) { if (ok) Store.deleteStudioTask(t.id); });
    };
    return row;
  }

  return api;
})();
