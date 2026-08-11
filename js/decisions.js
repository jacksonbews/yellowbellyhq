/* ================================================================
   YELLOW BELLY HQ — Decision Log
   A running log of key company decisions, mirroring the Decision Log
   spreadsheet: Date, Status, Decision, Category, Location, Decision
   owner, Consulted, Rationale, Action required, Due date.
   Access: Ownership & Developer + Manager Admin only.
   ================================================================ */

var Decisions = (function () {
  var api = {};
  var fStatus = "all", fCat = "all", fSearch = "";
  var STATUSES = ["In Progress", "Complete", "On Hold"];

  function statusChip(s) {
    var cls = /complete/i.test(s) ? "dl-done" : /hold/i.test(s) ? "dl-hold" : "dl-progress";
    return '<span class="chip dl-status ' + cls + '">' + UI.esc(s || "—") + "</span>";
  }

  function filtered() {
    var q = fSearch.trim().toLowerCase();
    return Store.decisions().filter(function (d) {
      if (fStatus !== "all" && d.status !== fStatus) return false;
      if (fCat !== "all" && d.category !== fCat) return false;
      if (q) {
        var hay = [d.decision, d.category, d.location, d.owner, d.consulted, d.rationale, d.action, d.status].join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /* a truncating cell with the full text on hover */
  function cell(text, cls) {
    return '<td class="' + (cls || "") + '" title="' + UI.esc(text || "") + '">' +
      (text ? UI.esc(text) : '<span class="dl-dash">—</span>') + "</td>";
  }

  function rowEl(d, main) {
    var row = UI.el(
      "<tr>" +
      cell(d.date ? UI.fmtDate(d.date) : "", "dl-date") +
      "<td>" + statusChip(d.status) + "</td>" +
      cell(d.decision, "dl-decision") +
      "<td>" + (d.category ? '<span class="chip dl-cat">' + UI.esc(d.category) + "</span>" : '<span class="dl-dash">—</span>') + "</td>" +
      cell(d.location, "dl-clip-sm") +
      cell(d.owner, "dl-clip-sm") +
      cell(d.consulted, "dl-clip") +
      cell(d.rationale, "dl-clip") +
      cell(d.action, "dl-clip") +
      cell(d.dueDate ? UI.fmtDate(d.dueDate) : "", "dl-date") +
      '<td class="dl-actions"></td>' +
      "</tr>"
    );
    var del = UI.el('<button class="btn btn-sm btn-ghost" title="Remove decision">✕</button>');
    del.onclick = function (e) {
      e.stopPropagation();
      UI.confirm("Remove this decision?", "This decision log entry will be deleted. This can't be undone.", "Remove")
        .then(function (ok) { if (ok) Store.deleteDecision(d.id).then(function () { UI.toast("Decision removed"); }); });
    };
    row.querySelector(".dl-actions").appendChild(del);
    row.onclick = function () { editModal(d, main); };
    return row;
  }

  api.render = function (main) {
    if (!Store.canViewDecisionLog()) { App.go("tasks"); return; }
    var all = Store.decisions();

    main.innerHTML = "";
    var head = UI.el(
      '<div class="page-head">' +
      '  <div><div class="page-title">Decision Log<span class="count">( ' + all.length + " )</span></div>" +
      '  <div class="page-sub">Key company decisions — what was decided, who owned it and what happens next. Visible to Ownership &amp; Developer and Manager Admin only.</div></div>' +
      '  <div class="page-actions"><button class="btn btn-yellow" id="btn-add-decision">+ Add decision</button></div>' +
      "</div>"
    );
    head.querySelector("#btn-add-decision").onclick = function () { editModal(null, main); };
    main.appendChild(head);

    /* filters */
    var bar = UI.el('<div class="toolbar"></div>');
    var stSel = UI.el('<select class="filter-select" title="Filter by status"></select>');
    stSel.innerHTML = '<option value="all">Status: all</option>' +
      STATUSES.map(function (s) { return '<option value="' + UI.esc(s) + '">' + UI.esc(s) + "</option>"; }).join("");
    stSel.value = fStatus;
    var catSel = UI.el('<select class="filter-select" title="Filter by category"></select>');
    catSel.innerHTML = '<option value="all">Category: all</option>' +
      Store.decisionCategories().map(function (c) { return '<option value="' + UI.esc(c) + '">' + UI.esc(c) + "</option>"; }).join("");
    catSel.value = fCat;
    var search = UI.el('<input type="text" class="supplier-search" placeholder="Search decisions, owner, rationale…">');
    search.value = fSearch;
    bar.appendChild(stSel); bar.appendChild(catSel);
    bar.appendChild(UI.el('<span class="toolbar-spacer"></span>'));
    bar.appendChild(search);
    main.appendChild(bar);

    /* table */
    var wrap = UI.el('<div class="table-wrap"></div>');
    var table = UI.el(
      '<table class="supplier-table dl-table"><thead><tr>' +
      "<th>Date</th><th>Status</th><th>Decision</th><th>Category</th><th>Location</th><th>Decision owner</th>" +
      "<th>Consulted</th><th>Rationale</th><th>Action required</th><th>Due date</th><th></th>" +
      "</tr></thead><tbody></tbody></table>"
    );
    var tbody = table.querySelector("tbody");
    wrap.appendChild(table);
    main.appendChild(wrap);
    var empty = UI.el('<div class="empty" style="display:none"><b>No decisions match</b>Try a different filter, or add a new decision.</div>');
    main.appendChild(empty);

    function paint() {
      var rows = filtered();
      tbody.innerHTML = "";
      rows.forEach(function (d) { tbody.appendChild(rowEl(d, main)); });
      wrap.style.display = rows.length ? "" : "none";
      empty.style.display = rows.length ? "none" : "";
    }
    stSel.onchange = function () { fStatus = stSel.value; paint(); };
    catSel.onchange = function () { fCat = catSel.value; paint(); };
    search.oninput = function () { fSearch = search.value; paint(); };
    paint();
  };

  /* add / edit a decision */
  function editModal(dec, main) {
    var isEdit = !!dec;
    dec = dec || {};
    var sh = UI.modalShell(isEdit ? "Edit decision" : "Add decision", { wide: true });
    var cats = Store.decisionCategories();
    var locs = Store.cities().map(function (c) { return c.label; });
    function opt(v, sel) { return '<option value="' + UI.esc(v) + '"' + (sel ? " selected" : "") + ">" + UI.esc(v) + "</option>"; }
    sh.body.innerHTML =
      '<div class="field-row">' +
      '  <div class="field"><label>Date</label><input type="date" id="dl-date" value="' + UI.esc(dec.date || "") + '"></div>' +
      '  <div class="field"><label>Status</label><select id="dl-status">' + STATUSES.map(function (s) { return opt(s, dec.status === s); }).join("") + "</select></div>" +
      "</div>" +
      '<div class="field"><label>Decision</label><textarea id="dl-decision" placeholder="What was decided?">' + UI.esc(dec.decision || "") + "</textarea></div>" +
      '<div class="field-row">' +
      '  <div class="field"><label>Category</label><input type="text" id="dl-cat" list="dl-cat-list" placeholder="e.g. Staffing" maxlength="40" value="' + UI.esc(dec.category || "") + '"><datalist id="dl-cat-list">' + cats.map(function (c) { return '<option value="' + UI.esc(c) + '">'; }).join("") + "</datalist></div>" +
      '  <div class="field"><label>Location</label><input type="text" id="dl-loc" list="dl-loc-list" placeholder="e.g. London" maxlength="40" value="' + UI.esc(dec.location || "") + '"><datalist id="dl-loc-list">' + locs.map(function (c) { return '<option value="' + UI.esc(c) + '">'; }).join("") + '<option value="Company-wide"></datalist></div>' +
      "</div>" +
      '<div class="field-row">' +
      '  <div class="field"><label>Decision owner</label><input type="text" id="dl-owner" placeholder="Who owns it?" maxlength="120" value="' + UI.esc(dec.owner || "") + '"></div>' +
      '  <div class="field"><label>Consulted</label><input type="text" id="dl-consulted" placeholder="Who was consulted?" maxlength="160" value="' + UI.esc(dec.consulted || "") + '"></div>' +
      "</div>" +
      '<div class="field"><label>Rationale</label><textarea id="dl-rationale" placeholder="Why this decision?">' + UI.esc(dec.rationale || "") + "</textarea></div>" +
      '<div class="field"><label>Action required</label><textarea id="dl-action" placeholder="What happens next?">' + UI.esc(dec.action || "") + "</textarea></div>" +
      '<div class="field"><label>Due date</label><input type="date" id="dl-due" value="' + UI.esc(dec.dueDate || "") + '"></div>';

    var cancel = UI.el('<button class="btn btn-ghost">Cancel</button>');
    cancel.onclick = UI.closeModal;
    var save = UI.el('<button class="btn btn-primary">' + (isEdit ? "Save changes" : "Add decision") + "</button>");
    save.onclick = function () {
      var data = {
        date: sh.body.querySelector("#dl-date").value,
        status: sh.body.querySelector("#dl-status").value,
        decision: sh.body.querySelector("#dl-decision").value.trim(),
        category: sh.body.querySelector("#dl-cat").value.trim(),
        location: sh.body.querySelector("#dl-loc").value.trim(),
        owner: sh.body.querySelector("#dl-owner").value.trim(),
        consulted: sh.body.querySelector("#dl-consulted").value.trim(),
        rationale: sh.body.querySelector("#dl-rationale").value.trim(),
        action: sh.body.querySelector("#dl-action").value.trim(),
        dueDate: sh.body.querySelector("#dl-due").value
      };
      if (!data.decision) { sh.body.querySelector("#dl-decision").focus(); return; }
      var done = isEdit ? Store.updateDecision(dec.id, data) : Store.addDecision(data);
      done.then(function () {
        UI.closeModal();
        UI.toast(isEdit ? "Decision updated" : "Decision added");
        api.render(main);
      });
    };
    sh.foot.appendChild(cancel); sh.foot.appendChild(save);
  }

  return api;
})();
