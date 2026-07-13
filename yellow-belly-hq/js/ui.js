/* ================================================================
   YELLOW BELLY HQ — shared UI helpers
   ================================================================ */

var UI = (function () {
  var api = {};

  /* escape text for safe HTML injection */
  api.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  /* create element from html string */
  api.el = function (html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  api.initials = function (name) {
    return (name || "?").split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase();
  };

  /* avatar html for a member */
  api.avatar = function (member, size) {
    var cls = "avatar" + (size ? " " + size : "");
    if (!member) return '<span class="' + cls + '">?</span>';
    if (member.photo) {
      return '<span class="' + cls + '" title="' + api.esc(member.name) + '"><img src="' + member.photo + '" alt=""></span>';
    }
    return '<span class="' + cls + '" title="' + api.esc(member.name) + '">' + api.esc(api.initials(member.name)) + "</span>";
  };

  /* ---------- dates ---------- */
  api.todayStr = function () {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  api.fmtDate = function (iso) {
    if (!iso) return "";
    var p = iso.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  api.dueInfo = function (iso, status) {
    if (!iso) return { cls: "", label: "No due date" };
    var today = api.todayStr();
    if (status === "complete") return { cls: "", label: api.fmtDate(iso) };
    if (iso < today) return { cls: "overdue", label: "Overdue · " + api.fmtDate(iso) };
    if (iso === today) {
      // only the Due Today column gets the orange pill; a task due today
      // that's already in another column (In Progress, Recurring) just
      // reads "Today" so the badge never contradicts the column it's in
      if (status === "due-today") return { cls: "today", label: "Due today" };
      return { cls: "", label: "Today" };
    }
    return { cls: "", label: api.fmtDate(iso) };
  };
  api.timeAgo = function (ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    var m = Math.floor(s / 60); if (m < 60) return m + "m ago";
    var h = Math.floor(m / 60); if (h < 24) return h + "h ago";
    var d = Math.floor(h / 24); if (d < 7) return d + "d ago";
    return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  /* ---------- cities & timezones ----------
     All zone maths goes through Intl.DateTimeFormat with an IANA id,
     so DST (BST / EDT / PDT) is applied automatically — never hardcoded. */
  api.cityLabel = function (id) {
    var c = Store.city(id);
    return c ? c.label : "";
  };
  api.tzOf = function (id) {
    var c = Store.city(id);
    return c ? c.tz : "Europe/London";
  };
  /* example phone number for a city's dialling code (for placeholders) */
  api.phoneExample = function (id) {
    var c = Store.city(id);
    return c && c.dialExample ? c.dialExample : "+";
  };
  /* short code for a city, e.g. London→LON, New York→NY, Los Angeles→LA */
  api.cityShort = function (id) {
    var c = Store.city(id);
    if (!c) return "";
    if (c.short) return c.short;
    var words = c.label.trim().split(/\s+/);
    if (words.length > 1) return words.map(function (w) { return w[0]; }).join("").toUpperCase().slice(0, 3);
    return c.label.slice(0, 3).toUpperCase();
  };
  /* when-and-where a task was created, in the creator's city time.
     e.g. "25 Jul 2026, 14:32 · LON" (full) or without the year (compact) */
  api.createdStamp = function (ts, cityId, compact) {
    try {
      var opts = { timeZone: api.tzOf(cityId), day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false };
      if (!compact) opts.year = "numeric";
      var s = new Intl.DateTimeFormat("en-GB", opts).format(new Date(ts));
      var sc = api.cityShort(cityId);
      return s + (sc ? " · " + sc : "");
    } catch (e) { return new Date(ts).toLocaleString(); }
  };
  /* current wall-clock time in a city, e.g. "14:32" */
  api.cityTime = function (id) {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: api.tzOf(id), hour: "2-digit", minute: "2-digit", hour12: false
      }).format(new Date());
    } catch (e) { return ""; }
  };
  /* an instant rendered in a given city's local time, DST-safe */
  api.absTime = function (ts, cityId) {
    try {
      var s = new Intl.DateTimeFormat("en-GB", {
        timeZone: api.tzOf(cityId), weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit", hour12: false
      }).format(new Date(ts));
      var lbl = api.cityLabel(cityId);
      return s + (lbl ? " · " + lbl + " time" : "");
    } catch (e) { return new Date(ts).toLocaleString(); }
  };
  /* relative label ("2h ago") with an absolute local-time tooltip */
  api.stamp = function (ts, cityId) {
    return '<span class="ts" title="' + api.esc(api.absTime(ts, cityId)) + '">' + api.esc(api.timeAgo(ts)) + "</span>";
  };
  /* update every live clock on the page (elements with data-citytime) */
  api.refreshClocks = function () {
    document.querySelectorAll("[data-citytime]").forEach(function (el) {
      el.textContent = api.cityTime(el.getAttribute("data-citytime"));
    });
  };

  /* ---------- modal ---------- */
  api.openModal = function (contentEl, opts) {
    opts = opts || {};
    api.closeModal();
    var overlay = api.el('<div class="modal-overlay' + (opts.full ? " full" : "") + '"></div>');
    var modal = api.el('<div class="modal' + (opts.wide ? " wide" : "") + (opts.full ? " full" : "") + '"></div>');
    modal.appendChild(contentEl);
    overlay.appendChild(modal);
    overlay.addEventListener("mousedown", function (e) {
      if (e.target === overlay) api.closeModal();
    });
    document.getElementById("modal-root").appendChild(overlay);
    var first = modal.querySelector("input, textarea");
    if (first && opts.focus !== false) setTimeout(function () { first.focus(); }, 30);
    return modal;
  };
  api.closeModal = function () {
    document.getElementById("modal-root").innerHTML = "";
  };
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") api.closeModal();
  });

  /* standard modal skeleton: returns {modal, body, foot} */
  api.modalShell = function (title, opts) {
    var wrap = api.el(
      '<div>' +
      '  <div class="modal-head">' +
      '    <div class="modal-title">' + api.esc(title) + "</div>" +
      '    <button class="modal-close" aria-label="Close">×</button>' +
      "  </div>" +
      '  <div class="modal-body"></div>' +
      '  <div class="modal-foot"></div>' +
      "</div>"
    );
    wrap.querySelector(".modal-close").onclick = api.closeModal;
    var modal = api.openModal(wrap, opts);
    return { modal: modal, body: wrap.querySelector(".modal-body"), foot: wrap.querySelector(".modal-foot") };
  };

  /* simple confirm */
  api.confirm = function (title, message, confirmLabel) {
    return new Promise(function (res) {
      var sh = api.modalShell(title);
      sh.body.innerHTML = '<p style="color:#444">' + api.esc(message) + "</p>";
      var cancel = api.el('<button class="btn btn-ghost">Cancel</button>');
      var ok = api.el('<button class="btn btn-danger">' + api.esc(confirmLabel || "Delete") + "</button>");
      cancel.onclick = function () { api.closeModal(); res(false); };
      ok.onclick = function () { api.closeModal(); res(true); };
      sh.foot.appendChild(cancel); sh.foot.appendChild(ok);
    });
  };

  /* ---------- toast ---------- */
  api.toast = function (msg) {
    var t = api.el('<div class="toast"><span class="tick">✓</span>' + api.esc(msg) + "</div>");
    document.getElementById("toast-root").appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  };

  /* ---------- pill multi-select (assignees) ---------- */
  /* members: array, selected: array of ids, lockedTo: restrict selectable to one id (member role) */
  api.pillSelect = function (members, selected, opts) {
    opts = opts || {};
    var wrap = api.el('<div class="pill-list"></div>');
    members.forEach(function (m) {
      var on = selected.indexOf(m.id) !== -1;
      var disabled = opts.onlyId && m.id !== opts.onlyId;
      var pill = api.el(
        '<button type="button" class="pill' + (on ? " on" : "") + (disabled ? " disabled" : "") + '" data-id="' + m.id + '">' +
        api.avatar(m, "sm") + api.esc(m.name) + "</button>"
      );
      pill.onclick = function () {
        var i = selected.indexOf(m.id);
        if (i === -1) { if (!opts.single || selected.length === 0) selected.push(m.id); else { selected.length = 0; selected.push(m.id); } }
        else selected.splice(i, 1);
        pill.classList.toggle("on", selected.indexOf(m.id) !== -1);
        if (opts.onChange) opts.onChange(selected);
      };
      wrap.appendChild(pill);
    });
    return wrap;
  };

  /* ---------- people picker: dropdown with role groups ---------- */
  /* selected: array of member ids (mutated in place)
     opts.onlyId: lock selection to one person (Team Access role)
     opts.members: restrict who can be picked (e.g. own department)
     opts.onChange(selected) */
  api.peopleSelect = function (selected, opts) {
    opts = opts || {};
    var team = Store.team();               // for showing existing tokens
    var pickable = opts.members || team;   // who this user may add

    /* role groups derived from titles */
    var GROUPS = [
      { id: "all",     label: pickable.length === team.length ? "All Team" : "Everyone I can assign", test: function () { return true; } },
      { id: "photo",   label: "Photographers",    test: function (m) { return /photographer/i.test(m.title); } },
      { id: "edit",    label: "Editors",          test: function (m) { return /editor/i.test(m.title); } },
      { id: "studio",  label: "Studio Managers",  test: function (m) { return /studio manager/i.test(m.title); } },
      { id: "cs",      label: "Customer Success", test: function (m) { return /customer success/i.test(m.title); } },
      { id: "founder", label: "Founders",         test: function (m) { return /founder/i.test(m.title); } }
    ];
    GROUPS.forEach(function (g) { g.members = pickable.filter(g.test); });

    var wrap = api.el('<div class="ppl-select"></div>');
    var tokens = api.el('<div class="ppl-tokens"></div>');
    wrap.appendChild(tokens);

    function renderTokens() {
      tokens.innerHTML = "";
      if (!selected.length) {
        tokens.appendChild(api.el('<span class="ppl-none">No one selected</span>'));
      }
      selected.forEach(function (id) {
        var m = team.find(function (x) { return x.id === id; });
        if (!m) return;
        var tk = api.el('<span class="ppl-token">' + api.avatar(m, "sm") + api.esc(m.name) +
          (opts.onlyId ? "" : '<button type="button" class="ppl-x" aria-label="Remove">×</button>') + "</span>");
        var x = tk.querySelector(".ppl-x");
        if (x) x.onclick = function () {
          selected.splice(selected.indexOf(id), 1);
          renderTokens(); renderMenu();
          if (opts.onChange) opts.onChange(selected);
        };
        tokens.appendChild(tk);
      });
    }

    if (opts.onlyId) {   /* locked to self — no dropdown needed */
      renderTokens();
      return wrap;
    }

    var addWrap = api.el('<div class="ppl-add-wrap"></div>');
    var addBtn = api.el('<button type="button" class="btn btn-sm">+ Add people ▾</button>');
    var menu = api.el('<div class="ppl-menu hidden"></div>');
    addWrap.appendChild(addBtn); addWrap.appendChild(menu);
    wrap.appendChild(addWrap);

    function countIn(g) {
      return g.members.filter(function (m) { return selected.indexOf(m.id) !== -1; }).length;
    }
    function renderMenu() {
      menu.innerHTML = '<div class="ppl-menu-label">Quick select</div>';
      GROUPS.forEach(function (g) {
        if (!g.members.length) return;
        var n = countIn(g), all = n === g.members.length;
        var row = api.el('<button type="button" class="ppl-row ppl-group' + (all ? " on" : "") + '">' +
          '<span class="ppl-check">' + (all ? "✓" : (n ? "–" : "")) + "</span>" +
          api.esc(g.label) +
          '<span class="ppl-n">( ' + (n ? n + "/" : "") + g.members.length + " )</span></button>");
        row.onclick = function () {
          if (all) {
            g.members.forEach(function (m) {
              var i = selected.indexOf(m.id);
              if (i !== -1) selected.splice(i, 1);
            });
          } else {
            g.members.forEach(function (m) {
              if (selected.indexOf(m.id) === -1) selected.push(m.id);
            });
          }
          renderTokens(); renderMenu();
          if (opts.onChange) opts.onChange(selected);
        };
        menu.appendChild(row);
      });
      menu.appendChild(api.el('<div class="ppl-menu-label">People</div>'));
      pickable.forEach(function (m) {
        var on = selected.indexOf(m.id) !== -1;
        var row = api.el('<button type="button" class="ppl-row' + (on ? " on" : "") + '">' +
          '<span class="ppl-check">' + (on ? "✓" : "") + "</span>" +
          api.avatar(m, "sm") + api.esc(m.name) + "</button>");
        row.onclick = function () {
          var i = selected.indexOf(m.id);
          if (i === -1) selected.push(m.id); else selected.splice(i, 1);
          renderTokens(); renderMenu();
          if (opts.onChange) opts.onChange(selected);
        };
        menu.appendChild(row);
      });
    }

    addBtn.onclick = function (e) {
      e.stopPropagation();
      var opening = menu.classList.contains("hidden");
      if (opening) renderMenu();
      menu.classList.toggle("hidden", !opening);
    };
    /* clicks inside the menu re-render its rows, so they must not
       bubble to the document listener that closes it */
    menu.addEventListener("click", function (e) { e.stopPropagation(); });
    document.addEventListener("click", function (e) {
      if (!menu.classList.contains("hidden") && !addWrap.contains(e.target)) {
        menu.classList.add("hidden");
      }
    });

    renderTokens();
    return wrap;
  };

  /* ---------- generic multi-select dropdown (e.g. departments) ----------
     options: array of strings. selected: array of strings (mutated). */
  api.tagSelect = function (options, selected, opts) {
    opts = opts || {};
    var wrap = api.el('<div class="tag-select"></div>');
    var btn = api.el('<button type="button" class="tag-select-btn"></button>');
    var menu = api.el('<div class="tag-select-menu hidden"></div>');
    wrap.appendChild(btn); wrap.appendChild(menu);
    function renderBtn() {
      btn.innerHTML = selected.length
        ? selected.map(function (s) { return api.esc(s); }).join('<span class="tag-sep">·</span>')
        : '<span class="tag-placeholder">' + api.esc(opts.placeholder || "Select…") + "</span>";
    }
    function renderMenu() {
      menu.innerHTML = "";
      (opts.getOptions ? opts.getOptions() : options).forEach(function (o) {
        var on = selected.indexOf(o) !== -1;
        var row = api.el('<button type="button" class="tag-opt' + (on ? " on" : "") + '"><span class="tag-check">' + (on ? "✓" : "") + "</span>" + api.esc(o) + "</button>");
        row.onclick = function () {
          var i = selected.indexOf(o);
          if (i === -1) selected.push(o); else selected.splice(i, 1);
          renderMenu(); renderBtn();
          if (opts.onChange) opts.onChange(selected);
        };
        menu.appendChild(row);
      });
    }
    btn.onclick = function (e) {
      e.stopPropagation();
      var opening = menu.classList.contains("hidden");
      if (opening) renderMenu();
      menu.classList.toggle("hidden", !opening);
    };
    menu.addEventListener("click", function (e) { e.stopPropagation(); });
    document.addEventListener("click", function (e) {
      if (!menu.classList.contains("hidden") && !wrap.contains(e.target)) menu.classList.add("hidden");
    });
    renderBtn();
    return wrap;
  };

  /* ---------- segmented radio ---------- */
  api.segRadios = function (options, value, onChange) {
    var wrap = api.el('<div class="seg-radios"></div>');
    options.forEach(function (o) {
      var b = api.el('<button type="button" class="seg-radio' + (o.id === value ? " on" : "") + '" data-id="' + o.id + '">' + api.esc(o.label) + "</button>");
      b.onclick = function () {
        wrap.querySelectorAll(".seg-radio").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        onChange(o.id);
      };
      wrap.appendChild(b);
    });
    return wrap;
  };

  /* read an image file, downscale, return dataURL */
  api.readImageScaled = function (file, maxPx) {
    return new Promise(function (res, rej) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        var scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = rej;
      img.src = url;
    });
  };

  api.prettySize = function (bytes) {
    if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + " MB";
    if (bytes > 1024) return Math.round(bytes / 1024) + " KB";
    return bytes + " B";
  };

  return api;
})();
