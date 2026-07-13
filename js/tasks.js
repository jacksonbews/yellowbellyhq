/* ================================================================
   YELLOW BELLY HQ — Tasks page (board + table views)
   ================================================================ */

var Tasks = (function () {
  var api = {};
  var filterAssignee = "all";   // 'all' | 'me' | member id
  var filterPriority = "all";
  var filterType = "all";       // 'all' | 'kpi'

  /* ---------- view preference (per person, per browser) ---------- */
  function viewPref() {
    return localStorage.getItem("ybhq_view_" + Store.me().id) || "board";
  }
  function setViewPref(v) {
    localStorage.setItem("ybhq_view_" + Store.me().id, v);
  }

  /* ---------- filtering ---------- */
  function visibleTasks() {
    var tasks = Store.tasks();
    if (filterAssignee === "me") {
      tasks = tasks.filter(function (t) { return t.assigneeIds.indexOf(Store.me().id) !== -1; });
    } else if (filterAssignee !== "all") {
      tasks = tasks.filter(function (t) { return t.assigneeIds.indexOf(filterAssignee) !== -1; });
    }
    if (filterPriority !== "all") {
      tasks = tasks.filter(function (t) { return t.priority === filterPriority; });
    }
    if (filterType === "kpi") {
      tasks = tasks.filter(function (t) { return !!t.isKpi; });
    }
    return tasks;
  }

  function priChip(p) {
    var lbl = { high: "High", med: "Med", low: "Low" }[p] || p;
    return '<span class="chip chip-' + p + '">' + lbl + "</span>";
  }
  function dueChip(t) {
    var d = UI.dueInfo(t.dueDate, t.status);
    return '<span class="chip chip-due ' + d.cls + '">' + UI.esc(d.label) + "</span>";
  }
  function kpiChip(t) {
    return t.isKpi ? '<span class="chip chip-kpi">KPI</span>' : "";
  }
  /* human label for a task's recurrence, e.g. "Weekly · Mon, Wed" */
  function recurrenceLabel(rec) {
    if (!rec || !rec.freq || rec.freq === "none") return "";
    var base = (RECURRENCE.find(function (r) { return r.id === rec.freq; }) || {}).label || rec.freq;
    if (rec.freq === "weekly" && rec.days && rec.days.length) {
      var names = WEEKDAYS.filter(function (d) { return rec.days.indexOf(d.id) !== -1; })
        .map(function (d) { return d.label; });
      return base + " · " + names.join(", ");
    }
    return base;
  }
  function recurs(t) { return t.recurrence && t.recurrence.freq && t.recurrence.freq !== "none"; }
  function recurFreq(rec) { var r = RECURRENCE.find(function (x) { return x.id === rec.freq; }); return r ? r.label : ""; }
  function createdCityOf(t) { return t.createdCity || (Store.member(t.assignedBy) || {}).city || DEFAULT_CITY; }
  function sid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* can this user edit/delete this task? */
  function canEditTask(t) {
    var me = Store.me();
    var scope = Store.assignScope();
    if (scope === "all") return true;
    if (t.assignedBy === me.id || t.assigneeIds.indexOf(me.id) !== -1) return true;
    // Manager Admins can manage tasks involving their department
    if (scope === "dept") {
      return t.assigneeIds.some(function (id) {
        var m = Store.member(id);
        return m && Store.sharesDept(m, me);
      });
    }
    return false;
  }

  function scopeSubtitle() {
    var scope = Store.assignScope();
    if (scope === "all") return "You can assign tasks to anyone on the team.";
    if (scope === "dept") return "You can assign tasks to anyone in your department" + ((Store.me().depts || []).length > 1 ? "s" : "") + ".";
    return "You can create tasks for yourself — managers assign the rest.";
  }

  /* ================= PAGE ================= */
  api.render = function (main) {
    var me = Store.me();
    var tasks = visibleTasks();
    var view = viewPref();

    main.innerHTML = "";
    var head = UI.el(
      '<div class="page-head">' +
      '  <div><div class="page-title">Tasks<span class="count">( ' + tasks.length + " )</span></div>" +
      '  <div class="page-sub">' + scopeSubtitle() + "</div></div>" +
      '  <div class="page-actions">' +
      (Store.canAddKpi() ? '<button class="btn btn-kpi" id="btn-new-kpi">+ Add KPI</button>' : "") +
      '<button class="btn btn-yellow" id="btn-new-task">+ New task</button></div>' +
      "</div>"
    );
    head.querySelector("#btn-new-task").onclick = function () { api.openEditor(null); };
    if (Store.canAddKpi()) head.querySelector("#btn-new-kpi").onclick = function () { api.openKpiEditor(); };
    main.appendChild(head);

    /* toolbar */
    var bar = UI.el('<div class="toolbar"></div>');
    var seg = UI.el(
      '<div class="seg">' +
      '<button data-v="board"' + (view === "board" ? ' class="active"' : "") + ">Board</button>" +
      '<button data-v="table"' + (view === "table" ? ' class="active"' : "") + ">Table</button>" +
      '<button data-v="week"' + (view === "week" ? ' class="active"' : "") + ">Week</button>" +
      '<button data-v="month"' + (view === "month" ? ' class="active"' : "") + ">Month</button>" +
      "</div>"
    );
    seg.querySelectorAll("button").forEach(function (b) {
      b.onclick = function () { setViewPref(b.dataset.v); api.render(main); };
    });
    bar.appendChild(seg);

    var selA = UI.el('<select class="filter-select" title="Filter by assignee"></select>');
    selA.innerHTML = '<option value="all">Assignee: everyone</option><option value="me">Assignee: me</option>' +
      Store.team().map(function (m) {
        return '<option value="' + m.id + '">' + UI.esc(m.name) + "</option>";
      }).join("");
    selA.value = filterAssignee;
    selA.onchange = function () { filterAssignee = selA.value; api.render(main); };
    bar.appendChild(selA);

    var selP = UI.el('<select class="filter-select" title="Filter by priority"></select>');
    selP.innerHTML = '<option value="all">Priority: all</option><option value="high">High</option><option value="med">Med</option><option value="low">Low</option>';
    selP.value = filterPriority;
    selP.onchange = function () { filterPriority = selP.value; api.render(main); };
    bar.appendChild(selP);

    var selT = UI.el('<select class="filter-select" title="Filter by type"></select>');
    selT.innerHTML = '<option value="all">All tasks</option><option value="kpi">KPIs only</option>';
    selT.value = filterType;
    selT.onchange = function () { filterType = selT.value; api.render(main); };
    bar.appendChild(selT);

    main.appendChild(bar);

    if (view === "board") renderBoard(main, tasks);
    else if (view === "table") renderTable(main, tasks);
    else if (view === "week") renderWeek(main, tasks);
    else if (view === "month") renderMonth(main, tasks);
  };

  /* ================= CALENDAR SHARED ================= */
  var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  var MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var PRI_ORDER = { high: 0, med: 1, low: 2 };

  /* anchor date the calendar is centred on — persists across re-renders */
  var calAnchor = null;
  function todayLocal() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function ensureAnchor() { if (!calAnchor) calAnchor = todayLocal(); return calAnchor; }
  function toISO(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function startOfWeek(d) { var x = new Date(d); var wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; }

  function byDueDate(tasks) {
    var map = {};
    tasks.forEach(function (t) { if (t.dueDate) (map[t.dueDate] = map[t.dueDate] || []).push(t); });
    return map;
  }
  function sortForCal(a, b) {
    var ac = a.status === "complete", bc = b.status === "complete";
    if (ac !== bc) return ac ? 1 : -1;
    return (PRI_ORDER[a.priority] == null ? 3 : PRI_ORDER[a.priority]) -
           (PRI_ORDER[b.priority] == null ? 3 : PRI_ORDER[b.priority]);
  }
  function calPill(t) {
    var el = UI.el(
      '<button class="cal-pill pri-' + t.priority + (t.status === "complete" ? " done" : "") + (t.isKpi ? " is-kpi" : "") + '" title="' + UI.esc(t.title) + (t.isKpi ? " (KPI)" : "") + '">' +
      '<span class="cal-pill-dot"></span><span class="cal-pill-text">' + UI.esc(t.title) + "</span></button>"
    );
    el.onclick = function (e) { e.stopPropagation(); api.openDetail(t.id); };
    return el;
  }
  function calNav(label, onStep, onToday) {
    var nav = UI.el(
      '<div class="cal-nav">' +
      '<div class="cal-steps"><button class="cal-arrow" data-d="-1" aria-label="Previous">‹</button>' +
      '<button class="cal-arrow" data-d="1" aria-label="Next">›</button></div>' +
      '<span class="cal-label">' + UI.esc(label) + "</span>" +
      '<button class="btn btn-sm btn-ghost cal-today">Today</button>' +
      "</div>"
    );
    nav.querySelectorAll(".cal-arrow").forEach(function (b) {
      b.onclick = function () { onStep(parseInt(b.dataset.d, 10)); };
    });
    nav.querySelector(".cal-today").onclick = onToday;
    return nav;
  }

  /* ================= WEEK VIEW ================= */
  function renderWeek(main, tasks) {
    var start = startOfWeek(ensureAnchor());
    var end = addDays(start, 6);
    var map = byDueDate(tasks);
    var todayISO = UI.todayStr();
    var canCreate = true;

    var label = start.getMonth() === end.getMonth()
      ? start.getDate() + " – " + end.getDate() + " " + MONTHS_SHORT[end.getMonth()] + " " + end.getFullYear()
      : start.getDate() + " " + MONTHS_SHORT[start.getMonth()] + " – " + end.getDate() + " " + MONTHS_SHORT[end.getMonth()] + " " + end.getFullYear();

    main.appendChild(calNav(label,
      function (dir) { calAnchor = addDays(startOfWeek(calAnchor), dir * 7); api.render(main); },
      function () { calAnchor = todayLocal(); api.render(main); }));

    var grid = UI.el('<div class="week-grid"></div>');
    for (var i = 0; i < 7; i++) {
      var day = addDays(start, i);
      var iso = toISO(day);
      var list = (map[iso] || []).slice().sort(sortForCal);
      var col = UI.el(
        '<div class="week-col' + (iso === todayISO ? " today" : "") + '">' +
        '<div class="week-col-head"><span class="week-dow">' + DOW[i] + "</span>" +
        '<span class="week-dom">' + day.getDate() + "</span></div>" +
        '<div class="week-col-body"></div></div>'
      );
      var body = col.querySelector(".week-col-body");
      list.forEach(function (t) { body.appendChild(calPill(t)); });
      if (canCreate) {
        (function (isoDay) {
          body.addEventListener("click", function () { api.openEditor(null, isoDay); });
        })(iso);
      }
      grid.appendChild(col);
    }
    main.appendChild(grid);
    appendUnscheduled(main, tasks);
  }

  /* ================= MONTH VIEW ================= */
  function renderMonth(main, tasks) {
    var anchor = ensureAnchor();
    var monthIdx = anchor.getMonth();
    var first = new Date(anchor.getFullYear(), monthIdx, 1);
    var gridStart = startOfWeek(first);
    var map = byDueDate(tasks);
    var todayISO = UI.todayStr();

    var leading = (first.getDay() + 6) % 7;
    var daysInMonth = new Date(anchor.getFullYear(), monthIdx + 1, 0).getDate();
    var cells = Math.ceil((leading + daysInMonth) / 7) * 7;

    main.appendChild(calNav(MONTHS[monthIdx] + " " + first.getFullYear(),
      function (dir) { calAnchor = new Date(anchor.getFullYear(), monthIdx + dir, 1); api.render(main); },
      function () { calAnchor = todayLocal(); api.render(main); }));

    var grid = UI.el('<div class="month-grid"></div>');
    DOW.forEach(function (d) { grid.appendChild(UI.el('<div class="month-dow">' + d + "</div>")); });

    for (var i = 0; i < cells; i++) {
      var day = addDays(gridStart, i);
      var iso = toISO(day);
      var inMonth = day.getMonth() === monthIdx;
      var list = (map[iso] || []).slice().sort(sortForCal);
      var cell = UI.el(
        '<div class="month-cell' + (inMonth ? "" : " muted") + (iso === todayISO ? " today" : "") + '">' +
        '<div class="month-daynum">' + day.getDate() + "</div>" +
        '<div class="month-cell-body"></div></div>'
      );
      var body = cell.querySelector(".month-cell-body");
      list.slice(0, 3).forEach(function (t) { body.appendChild(calPill(t)); });
      if (list.length > 3) {
        var more = UI.el('<button class="cal-more">+ ' + (list.length - 3) + " more</button>");
        (function (isoDay) {
          more.onclick = function (e) {
            e.stopPropagation();
            setViewPref("week"); calAnchor = new Date(isoDay + "T00:00:00"); api.render(main);
          };
        })(iso);
        body.appendChild(more);
      }
      (function (isoDay) {
        cell.addEventListener("click", function () { api.openEditor(null, isoDay); });
      })(iso);
      grid.appendChild(cell);
    }
    main.appendChild(grid);
    appendUnscheduled(main, tasks);
  }

  /* tasks with no due date — shown under both calendar views */
  function appendUnscheduled(main, tasks) {
    var none = tasks.filter(function (t) { return !t.dueDate; }).sort(sortForCal);
    if (!none.length) return;
    var wrap = UI.el('<div class="cal-unscheduled"><div class="cal-unscheduled-head">No due date <span class="ppl-n">( ' + none.length + " )</span></div><div class=\"cal-unscheduled-body\"></div></div>");
    var body = wrap.querySelector(".cal-unscheduled-body");
    none.forEach(function (t) { body.appendChild(calPill(t)); });
    main.appendChild(wrap);
  }

  /* ================= BOARD ================= */
  function renderBoard(main, tasks) {
    var board = UI.el('<div class="board"></div>');
    STATUSES.forEach(function (st) {
      var inCol = tasks.filter(function (t) { return t.status === st.id; })
        .sort(function (a, b) { return (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1; });
      var col = UI.el(
        '<div class="col" data-status="' + st.id + '">' +
        '  <div class="col-head" style="border-bottom:2px solid ' + st.dot + '"><span class="col-title"><span class="col-dot" style="background:' + st.dot + '"></span>' +
        UI.esc(st.label) + '</span><span class="col-count">( ' + inCol.length + " )</span></div>" +
        '  <div class="col-cards"></div>' +
        "</div>"
      );
      var cardsEl = col.querySelector(".col-cards");
      inCol.forEach(function (t) { cardsEl.appendChild(taskCard(t)); });

      /* drop target */
      col.addEventListener("dragover", function (e) { e.preventDefault(); col.classList.add("drag-over"); });
      col.addEventListener("dragleave", function () { col.classList.remove("drag-over"); });
      col.addEventListener("drop", function (e) {
        e.preventDefault();
        col.classList.remove("drag-over");
        var id = e.dataTransfer.getData("text/plain");
        var t = Store.task(id);
        if (t && t.status !== st.id) Store.updateTask(id, { status: st.id });
      });
      board.appendChild(col);
    });
    main.appendChild(board);
    if (!tasks.length) {
      main.appendChild(UI.el('<div class="empty" style="margin-top:14px"><b>No tasks match</b>Try a different filter, or create a new task.</div>'));
    }
  }

  function taskCard(t) {
    var people = t.assigneeIds.map(function (id) { return UI.avatar(Store.member(id), "sm"); }).join("");
    var nc = (t.comments || []).length;
    var card = UI.el(
      '<div class="card" draggable="true" data-id="' + t.id + '">' +
      '  <div class="card-title' + (t.status === "complete" ? " done" : "") + '">' + UI.esc(t.title) + "</div>" +
      '  <div class="card-meta">' + kpiChip(t) + priChip(t.priority) + dueChip(t) +
      (recurs(t) ? '<span class="chip chip-recur" title="' + UI.esc(recurrenceLabel(t.recurrence)) + '">↻ ' + UI.esc(recurFreq(t.recurrence)) + "</span>" : "") + "</div>" +
      '  <div class="card-foot">' +
      '    <span class="card-avatars">' + people + "</span>" +
      (nc ? '<span class="card-comments">( ' + nc + ' )</span>' : "") +
      "  </div>" +
      "</div>"
    );
    card.addEventListener("dragstart", function (e) {
      e.dataTransfer.setData("text/plain", t.id);
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", function () { card.classList.remove("dragging"); });
    card.onclick = function () { api.openDetail(t.id); };
    return card;
  }

  /* ================= TABLE ================= */
  function renderTable(main, tasks) {
    tasks = tasks.slice().sort(function (a, b) {
      if (a.status === "complete" && b.status !== "complete") return 1;
      if (b.status === "complete" && a.status !== "complete") return -1;
      return (a.dueDate || "9999") < (b.dueDate || "9999") ? -1 : 1;
    });
    if (!tasks.length) {
      main.appendChild(UI.el('<div class="empty"><b>No tasks match</b>Try a different filter, or create a new task.</div>'));
      return;
    }
    var wrap = UI.el('<div class="table-wrap"></div>');
    var table = UI.el(
      '<table class="tasks"><thead><tr>' +
      "<th>Task</th><th>Assignees</th><th>Assigned by</th><th>Due</th><th>Priority</th><th>Status</th><th>Comments</th>" +
      "</tr></thead><tbody></tbody></table>"
    );
    var tbody = table.querySelector("tbody");
    tasks.forEach(function (t) {
      var people = t.assigneeIds.map(function (id) { return UI.avatar(Store.member(id), "sm"); }).join("");
      var by = Store.member(t.assignedBy);
      var row = UI.el(
        "<tr>" +
        '<td class="td-title' + (t.status === "complete" ? " done" : "") + '">' + UI.esc(t.title) + (t.isKpi ? " " + kpiChip(t) : "") + "</td>" +
        '<td><span class="cell-people">' + (people || '<span style="color:#999">—</span>') + "</span></td>" +
        "<td>" + UI.esc(by ? by.name : "—") + "</td>" +
        "<td>" + dueChip(t) + "</td>" +
        "<td>" + priChip(t.priority) + "</td>" +
        "<td></td>" +
        '<td style="color:#888">' + ((t.comments || []).length || "") + "</td>" +
        "</tr>"
      );
      var sel = UI.el('<select class="status-select">' + STATUSES.map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === t.status ? " selected" : "") + ">" + UI.esc(s.label) + "</option>";
      }).join("") + "</select>");
      sel.onclick = function (e) { e.stopPropagation(); };
      sel.onchange = function () { Store.updateTask(t.id, { status: sel.value }); };
      row.children[5].appendChild(sel);
      row.onclick = function () { api.openDetail(t.id); };
      tbody.appendChild(row);
    });
    wrap.appendChild(table);
    main.appendChild(wrap);
  }

  /* ================= CREATE / EDIT MODAL ================= */
  api.openEditor = function (taskId, prefillDate) {
    var me = Store.me();
    var t = taskId ? Store.task(taskId) : null;
    var selected = t ? t.assigneeIds.slice() : [me.id];
    var priority = t ? t.priority : "med";
    // "Due Today" is auto-assigned by date, not hand-picked; if a task is
    // currently Due Today, edit it as a normal "To Do" in the picker.
    var status = t ? (t.status === "due-today" || t.status === "back-log" ? "to-do" : t.status) : "to-do";
    var STATUS_OPTIONS = STATUSES.filter(function (s) { return s.id !== "due-today"; });
    var isKpi = t ? !!t.isKpi : false;
    var recur = (t && t.recurrence)
      ? { freq: t.recurrence.freq || "none", days: (t.recurrence.days || []).slice() }
      : { freq: "none", days: [] };
    var subtasks = t ? (t.subtasks || []).map(function (s) { return { id: s.id, text: s.text, done: !!s.done }; }) : [];

    var sh = UI.modalShell(t ? "Edit task" : "New task", { wide: true });
    sh.body.innerHTML =
      '<div class="field"><label>Task</label><input type="text" id="tk-title" placeholder="What needs doing?" maxlength="140"></div>' +
      '<div class="field"><label>Details (optional)</label><textarea id="tk-desc" placeholder="Anything the assignee needs to know…"></textarea></div>' +
      '<div class="field"><label>Subtasks / checklist (optional)</label>' +
      '  <div id="tk-subtasks" class="subtask-edit"></div>' +
      '  <div class="subtask-add">' +
      '    <input type="text" id="tk-subtask-input" placeholder="Add a checklist item…" maxlength="160">' +
      '    <button type="button" class="btn btn-sm" id="tk-subtask-add">Add</button>' +
      "  </div></div>" +
      '<div class="field-row">' +
      '  <div class="field"><label>Due date</label><input type="date" id="tk-due"></div>' +
      '  <div class="field"><label>Priority</label><div id="tk-pri"></div></div>' +
      "</div>" +
      '<div class="field"><label>Repeats</label>' +
      '  <select id="tk-recur">' + RECURRENCE.map(function (r) {
        return '<option value="' + r.id + '">' + UI.esc(r.label) + "</option>";
      }).join("") + "</select>" +
      '  <div id="tk-recur-days" class="recur-days hidden"><div class="pill-list"></div>' +
      '    <div class="hint">Repeats every week on the selected day(s). Each occurrence is created when you mark the previous one complete.</div></div>' +
      "</div>" +
      '<div class="field-row">' +
      '  <div class="field"><label>Status</label><div id="tk-status"></div></div>' +
      '  <div class="field"><label>Tag</label>' +
      '    <button type="button" class="kpi-toggle" id="tk-kpi"><span class="kpi-dot"></span>KPI</button>' +
      '    <div class="hint">Mark this task as a company KPI.</div></div>' +
      "</div>" +
      '<div class="field"><label>Assign to</label><div id="tk-assign"></div>' +
      (Store.assignScope() === "self" ? '<div class="hint">Your access level can only assign tasks to yourself — managers assign the rest.</div>' : "") +
      (Store.assignScope() === "dept" ? '<div class="hint">As a Manager Admin you can assign people in ' + UI.esc((me.depts || []).join(", ")) + ".</div>" : "") +
      "</div>";

    sh.body.querySelector("#tk-title").value = t ? t.title : "";
    sh.body.querySelector("#tk-desc").value = t ? t.description : "";
    sh.body.querySelector("#tk-due").value = t ? t.dueDate : (prefillDate || "");
    sh.body.querySelector("#tk-pri").appendChild(UI.segRadios(PRIORITIES, priority, function (v) { priority = v; }));
    sh.body.querySelector("#tk-status").appendChild(UI.segRadios(STATUS_OPTIONS, status, function (v) { status = v; }));
    var kpiBtn = sh.body.querySelector("#tk-kpi");
    kpiBtn.classList.toggle("on", isKpi);
    kpiBtn.onclick = function () { isKpi = !isKpi; kpiBtn.classList.toggle("on", isKpi); };

    /* recurrence: frequency select + weekly day multi-select */
    var recurSel = sh.body.querySelector("#tk-recur");
    var daysWrap = sh.body.querySelector("#tk-recur-days");
    var daysList = daysWrap.querySelector(".pill-list");
    WEEKDAYS.forEach(function (d) {
      var on = recur.days.indexOf(d.id) !== -1;
      var pill = UI.el('<button type="button" class="pill' + (on ? " on" : "") + '" data-day="' + d.id + '">' + UI.esc(d.label) + "</button>");
      pill.onclick = function () {
        var i = recur.days.indexOf(d.id);
        if (i === -1) recur.days.push(d.id); else recur.days.splice(i, 1);
        pill.classList.toggle("on", recur.days.indexOf(d.id) !== -1);
      };
      daysList.appendChild(pill);
    });
    recurSel.value = recur.freq;
    daysWrap.classList.toggle("hidden", recur.freq !== "weekly");
    recurSel.onchange = function () {
      recur.freq = recurSel.value;
      daysWrap.classList.toggle("hidden", recur.freq !== "weekly");
    };

    /* subtasks: build the checklist items for this task */
    var subWrap = sh.body.querySelector("#tk-subtasks");
    function renderSubEdit() {
      subWrap.innerHTML = "";
      subtasks.forEach(function (s, idx) {
        var row = UI.el(
          '<div class="subtask-edit-item"><label class="subtask-check">' +
          '<input type="checkbox"' + (s.done ? " checked" : "") + ">" +
          '<span class="subtask-text' + (s.done ? " done" : "") + '">' + UI.esc(s.text) + "</span></label>" +
          '<button type="button" class="subtask-x" aria-label="Remove">×</button></div>'
        );
        row.querySelector("input").onchange = function (e) {
          s.done = e.target.checked;
          row.querySelector(".subtask-text").classList.toggle("done", s.done);
        };
        row.querySelector(".subtask-x").onclick = function () { subtasks.splice(idx, 1); renderSubEdit(); };
        subWrap.appendChild(row);
      });
    }
    renderSubEdit();
    var subInput = sh.body.querySelector("#tk-subtask-input");
    function addSub() {
      var v = subInput.value.trim();
      if (!v) return;
      subtasks.push({ id: sid(), text: v, done: false });
      subInput.value = ""; renderSubEdit(); subInput.focus();
    }
    sh.body.querySelector("#tk-subtask-add").onclick = addSub;
    subInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addSub(); }
    });
    sh.body.querySelector("#tk-assign").appendChild(
      UI.peopleSelect(selected, Store.assignScope() === "self"
        ? { onlyId: me.id }
        : { members: Store.assignableMembers() })
    );

    var cancel = UI.el('<button class="btn btn-ghost">Cancel</button>');
    cancel.onclick = UI.closeModal;
    var save = UI.el('<button class="btn btn-primary">' + (t ? "Save changes" : "Create task") + "</button>");
    save.onclick = function () {
      var title = sh.body.querySelector("#tk-title").value.trim();
      if (!title) { sh.body.querySelector("#tk-title").focus(); return; }
      var dueDate = sh.body.querySelector("#tk-due").value;
      // if it's due today and not already being worked or finished,
      // drop it straight into the Due Today column
      var finalStatus = status;
      if (dueDate === UI.todayStr() && status === "to-do") {
        finalStatus = "due-today";
      }
      var data = {
        title: title,
        description: sh.body.querySelector("#tk-desc").value.trim(),
        dueDate: dueDate,
        priority: priority,
        status: finalStatus,
        isKpi: isKpi,
        recurrence: { freq: recur.freq, days: recur.freq === "weekly" ? recur.days.slice() : [] },
        subtasks: subtasks.slice(),
        assigneeIds: selected.slice()
      };
      var p = t ? Store.updateTask(t.id, data) : Store.createTask(data);
      p.then(function () {
        UI.closeModal();
        UI.toast(t ? "Task updated" : "Task created");
      });
    };
    sh.foot.appendChild(cancel); sh.foot.appendChild(save);
  };

  /* ================= ADD KPIs MODAL (Ownership tiers) =================
     A list/table view: one row per KPI. Each is auto-tagged as a KPI and
     routed to To Do (or Due Today if dated today). Click the Due date
     or Priority headers to sort the rows. */
  api.openKpiEditor = function () {
    var me = Store.me();
    var isOwner = Store.canAddKpi();
    var team = isOwner ? Store.assignableMembers() : [me];
    var assignOptions = '<option value="">+ Assign</option>' +
      team.map(function (m) { return '<option value="' + m.id + '">' + UI.esc(m.name) + "</option>"; }).join("");

    var sh = UI.modalShell("Add KPIs", { full: true });
    sh.body.innerHTML =
      '<div class="kpi-banner"><span class="chip chip-kpi">KPI</span>' +
      "Fill a row per KPI. All auto-tagged and routed to <b>To Do</b>, or <b>Due Today</b> if dated today.</div>" +
      '<div class="kpi-table-wrap"><table class="kpi-table"><thead><tr>' +
      '<th style="width:42%">KPI</th>' +
      '<th class="sortable" data-sort="due" title="Sort by due date">Due date <span class="kpi-caret">↕</span></th>' +
      '<th class="sortable" data-sort="pri" title="Sort by priority (high to low)">Priority <span class="kpi-caret">↕</span></th>' +
      "<th>Assign to</th><th></th>" +
      '</tr></thead><tbody id="kpi-rows"></tbody></table></div>' +
      '<span class="kpi-addrow" id="kpi-addrow">+ Add row</span>';

    var tbody = sh.body.querySelector("#kpi-rows");

    function addRow() {
      var subtasks = [];
      var tr = UI.el(
        "<tr>" +
        '<td><input class="kpi-title-input" type="text" placeholder="What KPI needs tracking?" maxlength="160">' +
        '  <button type="button" class="kpi-subtoggle">+ Subtasks</button>' +
        '  <div class="kpi-subpanel hidden"><div class="kpi-sublist"></div>' +
        '    <div class="kpi-subadd"><input type="text" class="kpi-subinput" placeholder="Add a subtask…" maxlength="160">' +
        '    <button type="button" class="btn btn-sm kpi-subaddbtn">Add</button></div></div></td>' +
        '<td><input class="kpi-date" type="date"></td>' +
        '<td><span class="kpi-pri"><span data-p="high">H</span><span data-p="med" class="on-med">M</span><span data-p="low">L</span></span></td>' +
        '<td><select class="kpi-assign">' + assignOptions + "</select></td>" +
        '<td><button type="button" class="kpi-x" aria-label="Remove row">×</button></td>' +
        "</tr>"
      );
      tr.querySelectorAll(".kpi-pri span").forEach(function (sp) {
        sp.onclick = function () {
          tr.querySelectorAll(".kpi-pri span").forEach(function (x) { x.className = ""; });
          sp.className = "on-" + sp.dataset.p;
        };
      });

      /* subtasks for this KPI row */
      var subToggle = tr.querySelector(".kpi-subtoggle");
      var subPanel = tr.querySelector(".kpi-subpanel");
      var subList = tr.querySelector(".kpi-sublist");
      var subInput = tr.querySelector(".kpi-subinput");
      function updateToggle() {
        subToggle.textContent = subtasks.length ? "Subtasks ( " + subtasks.length + " )" : "+ Subtasks";
      }
      function renderSub() {
        subList.innerHTML = "";
        subtasks.forEach(function (s, idx) {
          var item = UI.el(
            '<div class="subtask-edit-item"><label class="subtask-check">' +
            '<input type="checkbox"' + (s.done ? " checked" : "") + ">" +
            '<span class="subtask-text' + (s.done ? " done" : "") + '">' + UI.esc(s.text) + "</span></label>" +
            '<button type="button" class="subtask-x" aria-label="Remove">×</button></div>'
          );
          item.querySelector("input").onchange = function (e) {
            s.done = e.target.checked;
            item.querySelector(".subtask-text").classList.toggle("done", s.done);
          };
          item.querySelector(".subtask-x").onclick = function () { subtasks.splice(idx, 1); renderSub(); updateToggle(); };
          subList.appendChild(item);
        });
      }
      subToggle.onclick = function () { subPanel.classList.toggle("hidden"); if (!subPanel.classList.contains("hidden")) subInput.focus(); };
      function addSub() {
        var v = subInput.value.trim(); if (!v) return;
        subtasks.push({ id: sid(), text: v, done: false });
        subInput.value = ""; renderSub(); updateToggle(); subInput.focus();
      }
      tr.querySelector(".kpi-subaddbtn").onclick = addSub;
      subInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addSub(); } });
      tr._getSubtasks = function () { return subtasks.slice(); };

      tr.querySelector(".kpi-x").onclick = function () {
        if (tbody.children.length > 1) tr.remove();
        else { tr.querySelector(".kpi-title-input").value = ""; tr.querySelector(".kpi-date").value = ""; subtasks.length = 0; renderSub(); updateToggle(); subPanel.classList.add("hidden"); }
      };
      tbody.appendChild(tr);
      return tr;
    }
    addRow(); addRow(); addRow();
    setTimeout(function () { var f = tbody.querySelector(".kpi-title-input"); if (f) f.focus(); }, 30);

    sh.body.querySelector("#kpi-addrow").onclick = function () {
      var tr = addRow(); tr.querySelector(".kpi-title-input").focus();
    };

    /* sortable headers */
    function priVal(tr) {
      var on = tr.querySelector('.kpi-pri span[class^="on-"]');
      if (!on) return 9;
      var p = on.dataset.p; return p === "high" ? 0 : p === "med" ? 1 : 2;
    }
    function dueVal(tr) { return tr.querySelector(".kpi-date").value || "9999-99-99"; }
    sh.body.querySelectorAll("th.sortable").forEach(function (th) {
      th.onclick = function () {
        var key = th.dataset.sort;
        sh.body.querySelectorAll("th.sortable").forEach(function (h) { h.classList.remove("active"); h.querySelector(".kpi-caret").textContent = "↕"; });
        th.classList.add("active");
        th.querySelector(".kpi-caret").textContent = key === "pri" ? "↓" : "↑";
        Array.prototype.slice.call(tbody.children).sort(function (a, b) {
          return key === "pri" ? priVal(a) - priVal(b) : (dueVal(a) < dueVal(b) ? -1 : dueVal(a) > dueVal(b) ? 1 : 0);
        }).forEach(function (r) { tbody.appendChild(r); });
      };
    });

    var cancel = UI.el('<button class="btn btn-ghost">Cancel</button>');
    cancel.onclick = UI.closeModal;
    var save = UI.el('<button class="btn btn-primary">Create KPIs</button>');
    save.onclick = function () {
      var toCreate = [];
      Array.prototype.slice.call(tbody.children).forEach(function (tr) {
        var title = tr.querySelector(".kpi-title-input").value.trim();
        if (!title) return;
        var due = tr.querySelector(".kpi-date").value;
        var onPri = tr.querySelector('.kpi-pri span[class^="on-"]');
        var priority = onPri ? onPri.dataset.p : "med";
        var assignee = tr.querySelector(".kpi-assign").value;
        toCreate.push({
          title: title, dueDate: due, priority: priority,
          status: due === UI.todayStr() ? "due-today" : "to-do",
          isKpi: true, assigneeIds: assignee ? [assignee] : [],
          subtasks: tr._getSubtasks ? tr._getSubtasks() : []
        });
      });
      if (!toCreate.length) { var f = tbody.querySelector(".kpi-title-input"); if (f) f.focus(); return; }
      Promise.all(toCreate.map(function (d) { return Store.createTask(d); })).then(function () {
        UI.closeModal();
        UI.toast(toCreate.length + " KPI" + (toCreate.length > 1 ? "s" : "") + " created");
      });
    };
    sh.foot.appendChild(cancel); sh.foot.appendChild(save);
  };

  /* ================= DETAIL MODAL ================= */
  api.openDetail = function (taskId) {
    var t = Store.task(taskId);
    if (!t) return;
    var me = Store.me();
    var by = Store.member(t.assignedBy);
    var st = STATUSES.find(function (s) { return s.id === t.status; });

    var sh = UI.modalShell(t.title, { wide: true, focus: false });

    var assignees = t.assigneeIds.map(function (id) {
      var m = Store.member(id);
      return m ? '<span class="person-tag">' + UI.avatar(m, "sm") + UI.esc(m.name) + "</span>" : "";
    }).join("") || '<span style="color:#999">No one yet</span>';

    var dueLabel = t.dueDate ? "Due " + UI.fmtDate(t.dueDate) : "No due date";
    var dueCls = UI.dueInfo(t.dueDate, t.status).cls;
    sh.body.innerHTML =
      '<div class="card-meta">' + kpiChip(t) + priChip(t.priority) +
      '<span class="chip chip-due ' + dueCls + '">' + UI.esc(dueLabel) + "</span>" +
      '<span class="chip chip-status">' + UI.esc(st ? st.label : t.status) + "</span></div>" +
      (t.description ? '<p class="detail-desc">' + UI.esc(t.description) + "</p>" : "") +
      '<div class="detail-grid">' +
      '  <span class="eyebrow">Assigned to</span><span class="detail-people">' + assignees + "</span>" +
      '  <span class="eyebrow">Assigned by</span><span class="detail-people">' +
      (by ? '<span class="person-tag">' + UI.avatar(by, "sm") + UI.esc(by.name) + "</span>" : "—") + "</span>" +
      (recurs(t) ? '<span class="eyebrow">Repeats</span><span><span class="chip chip-recur">↻ ' + UI.esc(recurrenceLabel(t.recurrence)) + "</span></span>" : "") +
      (t.createdAt ? '<span class="eyebrow">Created</span><span class="detail-created">' + UI.esc(UI.createdStamp(t.createdAt, createdCityOf(t))) + "</span>" : "") +
      '  <span class="eyebrow">Move to</span><span id="dt-status"></span>' +
      "</div>" +
      '<div class="checklist">' +
      '  <div class="checklist-head">Checklist / Subtasks <span id="dt-checklist-progress" class="checklist-progress"></span></div>' +
      '  <div id="dt-subtasks"></div>' +
      '  <div class="subtask-add">' +
      '    <input type="text" id="dt-subtask-input" placeholder="Add a checklist item…" maxlength="160">' +
      '    <button class="btn btn-sm" id="dt-subtask-add">Add</button>' +
      "  </div>" +
      "</div>" +
      '<div class="comments">' +
      '  <div class="comments-title">Comments ( ' + (t.comments || []).length + " )</div>" +
      '  <div id="dt-comments"></div>' +
      '  <div class="comment-form">' + UI.avatar(me, "sm") +
      '    <div class="comment-input-wrap">' +
      '      <textarea id="dt-comment-input" placeholder="Write a comment… type @ to tag someone" rows="2"></textarea>' +
      '      <div id="mention-menu" class="mention-menu hidden"></div>' +
      "    </div>" +
      '    <button class="btn btn-primary btn-sm" id="dt-comment-send" style="margin-top:4px">Send</button>' +
      "  </div>" +
      "</div>";

    /* status quick-move */
    sh.body.querySelector("#dt-status").appendChild(
      UI.segRadios(STATUSES, t.status, function (v) {
        Store.updateTask(t.id, { status: v }).then(function () { UI.toast("Moved to " + (STATUSES.find(function (s) { return s.id === v; }) || {}).label); });
      })
    );

    /* checklist — tick, add and remove subtasks in place */
    var checklistEl = sh.body.querySelector("#dt-subtasks");
    var progressEl = sh.body.querySelector("#dt-checklist-progress");
    function persistSubs(mutator) {
      var task = Store.task(taskId); if (!task) return;
      var list = (task.subtasks || []).map(function (x) { return { id: x.id, text: x.text, done: !!x.done }; });
      mutator(list);
      Store.updateTask(taskId, { subtasks: list }).then(drawChecklist);
    }
    function drawChecklist() {
      var task = Store.task(taskId); if (!task) return;
      var subs = task.subtasks || [];
      var doneCount = subs.filter(function (s) { return s.done; }).length;
      progressEl.textContent = subs.length ? "( " + doneCount + " / " + subs.length + " )" : "";
      checklistEl.innerHTML = "";
      subs.forEach(function (s) {
        var row = UI.el(
          '<div class="subtask-item"><label class="subtask-check">' +
          '<input type="checkbox"' + (s.done ? " checked" : "") + ">" +
          '<span class="subtask-text' + (s.done ? " done" : "") + '">' + UI.esc(s.text) + "</span></label>" +
          '<button type="button" class="subtask-x" aria-label="Remove">×</button></div>'
        );
        row.querySelector("input").onchange = function (e) {
          var checked = e.target.checked;
          persistSubs(function (list) { var x = list.find(function (i) { return i.id === s.id; }); if (x) x.done = checked; });
        };
        row.querySelector(".subtask-x").onclick = function () {
          persistSubs(function (list) { var i = list.map(function (x) { return x.id; }).indexOf(s.id); if (i > -1) list.splice(i, 1); });
        };
        checklistEl.appendChild(row);
      });
    }
    var addSubInput = sh.body.querySelector("#dt-subtask-input");
    function addDetailSub() {
      var v = addSubInput.value.trim();
      if (!v) return;
      addSubInput.value = "";
      persistSubs(function (list) { list.push({ id: sid(), text: v, done: false }); });
      addSubInput.focus();
    }
    sh.body.querySelector("#dt-subtask-add").onclick = addDetailSub;
    addSubInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addDetailSub(); } });
    drawChecklist();

    /* comments list */
    var listEl = sh.body.querySelector("#dt-comments");
    (t.comments || []).slice().sort(function (a, b) { return a.createdAt - b.createdAt; }).forEach(function (c) {
      var author = Store.member(c.authorId);
      var textHtml = UI.esc(c.text);
      (c.mentionIds || []).forEach(function (id) {
        var m = Store.member(id);
        if (m) textHtml = textHtml.split("@" + UI.esc(m.name)).join('<span class="mention">@' + UI.esc(m.name) + "</span>");
      });
      listEl.appendChild(UI.el(
        '<div class="comment">' + UI.avatar(author, "sm") +
        '<div class="comment-bubble">' +
        '  <div class="comment-head"><span class="comment-name">' + UI.esc(author ? author.name : "?") + '</span>' +
        '  <span class="comment-time" title="' + UI.esc(UI.absTime(c.createdAt, author ? author.city : null)) + '">' + UI.timeAgo(c.createdAt) + "</span></div>" +
        '  <div class="comment-text">' + textHtml + "</div>" +
        "</div></div>"
      ));
    });

    /* ---- @mention autocomplete ---- */
    var input = sh.body.querySelector("#dt-comment-input");
    var menu = sh.body.querySelector("#mention-menu");
    var taggedIds = [];

    function closeMenu() { menu.classList.add("hidden"); menu.innerHTML = ""; }
    function currentMentionQuery() {
      var upto = input.value.slice(0, input.selectionStart);
      var m = upto.match(/@([\w ]{0,24})$/);
      return m ? { q: m[1].toLowerCase(), start: upto.length - m[0].length } : null;
    }
    input.addEventListener("input", function () {
      var q = currentMentionQuery();
      if (!q) return closeMenu();
      var matches = Store.team().filter(function (m) {
        return m.id !== me.id && m.name.toLowerCase().indexOf(q.q) === 0 && q.q.length <= m.name.length;
      });
      if (!q.q) matches = Store.team().filter(function (m) { return m.id !== me.id; });
      if (!matches.length) return closeMenu();
      menu.innerHTML = "";
      matches.slice(0, 6).forEach(function (m) {
        var item = UI.el('<button type="button" class="mention-item">' + UI.avatar(m, "sm") + UI.esc(m.name) + "</button>");
        item.onclick = function () {
          var after = input.value.slice(input.selectionStart);
          input.value = input.value.slice(0, q.start) + "@" + m.name + " " + after;
          if (taggedIds.indexOf(m.id) === -1) taggedIds.push(m.id);
          closeMenu();
          input.focus();
        };
        menu.appendChild(item);
      });
      menu.classList.remove("hidden");
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeMenu(); e.stopPropagation(); }
      if (e.key === "Enter" && !e.shiftKey && menu.classList.contains("hidden")) {
        e.preventDefault(); send();
      }
    });

    function send() {
      var text = input.value.trim();
      if (!text) return;
      var mentionIds = taggedIds.filter(function (id) {
        var m = Store.member(id);
        return m && text.indexOf("@" + m.name) !== -1;
      });
      Store.addComment(t.id, text, mentionIds).then(function () {
        api.openDetail(t.id);  // re-render with new comment
      });
    }
    sh.body.querySelector("#dt-comment-send").onclick = send;

    /* footer: edit + delete for people with rights */
    if (canEditTask(t)) {
      var del = UI.el('<button class="btn btn-danger btn-sm">Delete</button>');
      del.onclick = function () {
        UI.confirm("Delete task?", "“" + t.title + "” will be removed for everyone.", "Delete task").then(function (ok) {
          if (ok) Store.deleteTask(t.id).then(function () { UI.closeModal(); UI.toast("Task deleted"); });
        });
      };
      var edit = UI.el('<button class="btn btn-sm">Edit task</button>');
      edit.onclick = function () { api.openEditor(t.id); };
      sh.foot.appendChild(del); sh.foot.appendChild(edit);
    }
  };

  return api;
})();
