/* ================================================================
   YELLOW BELLY HQ — Bookings page (Ownership tiers only)
   Pulls the Bookings table from Airtable via its REST API.
   Until connected it renders a designed SAMPLE dataset, so the page
   is fully visible in preview. The Airtable token is stored in THIS
   browser only (localStorage) — it is never written into the code
   or the database.
   ================================================================ */

var Bookings = (function () {
  var api = {};
  var CFG_KEY = "ybhq_airtable_cfg";
  var CACHE_KEY = "ybhq_airtable_cache";
  var INK = "#111111";
  var GRID = "#ececec";
  var fetchState = { loading: false, error: null };

  /* ---------------- config ---------------- */
  function getCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)); } catch (e) { return null; }
  }
  api.isConnected = function () { return !!getCfg(); };

  /* ---------------- sample data (deterministic) ---------------- */
  function seededRand(seed) {
    return function () {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
  }
  function sampleData() {
    var rnd = seededRand(42);
    var locations = ["London", "New York", "Los Angeles"];
    var locWeight = [0.5, 0.3, 0.2];
    var statuses = ["Completed", "Confirmed", "Pending", "Cancelled"];
    var clients = ["A. Okafor", "B. Hartley", "C. Nguyen", "D. Silva", "E. Moretti", "F. Adeyemi",
      "G. Kowalski", "H. Tanaka", "I. Rossi", "J. Mbeki", "K. Larsen", "L. Fontaine",
      "M. O'Brien", "N. Petrov", "O. Diallo", "P. Lindqvist", "R. Castellano", "S. Yamamoto"];
    var packages = [249, 349, 449, 549];
    var rows = [];
    var today = new Date();
    for (var i = 0; i < 190; i++) {
      var daysAgo = Math.floor(rnd() * 365) - 21; // includes ~3 weeks of future bookings
      var d = new Date(today); d.setDate(d.getDate() - daysAgo);
      var lw = rnd(), loc = lw < locWeight[0] ? 0 : (lw < locWeight[0] + locWeight[1] ? 1 : 2);
      var status;
      if (d > today) status = rnd() < 0.75 ? "Confirmed" : "Pending";
      else status = rnd() < 0.9 ? "Completed" : "Cancelled";
      rows.push({
        date: d.toISOString().slice(0, 10),
        client: clients[Math.floor(rnd() * clients.length)],
        location: locations[loc],
        status: status,
        amount: packages[Math.floor(rnd() * packages.length)] + (rnd() < 0.3 ? 100 : 0)
      });
    }
    return rows;
  }

  /* ---------------- airtable ---------------- */
  function fetchAirtable(cfg) {
    var all = [];
    function page(offset) {
      var url = "https://api.airtable.com/v0/" + encodeURIComponent(cfg.base) + "/" +
        encodeURIComponent(cfg.table) + "?pageSize=100" + (offset ? "&offset=" + offset : "");
      return fetch(url, { headers: { Authorization: "Bearer " + cfg.token } })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status === 401 || r.status === 403
            ? "Airtable rejected the token — check it has data.records:read access to this base."
            : r.status === 404
              ? "Base or table not found — check the Base ID and table name."
              : "Airtable error (" + r.status + ")");
          return r.json();
        })
        .then(function (j) {
          all = all.concat(j.records || []);
          if (j.offset && all.length < 1000) return page(j.offset);
          return all;
        });
    }
    return page(null);
  }

  /* map whatever the Airtable columns are called onto our shape */
  function normalize(records) {
    if (!records.length) return [];
    // learn field names from the data
    var names = {};
    records.slice(0, 20).forEach(function (r) {
      Object.keys(r.fields || {}).forEach(function (k) { names[k] = r.fields[k]; });
    });
    function findField(patterns, type) {
      var keys = Object.keys(names);
      for (var p = 0; p < patterns.length; p++) {
        for (var i = 0; i < keys.length; i++) {
          if (patterns[p].test(keys[i])) {
            if (!type) return keys[i];
            var v = names[keys[i]];
            if (type === "number" && typeof v === "number") return keys[i];
            if (type === "date" && !isNaN(Date.parse(v))) return keys[i];
            if (type === "string" && typeof v === "string") return keys[i];
          }
        }
      }
      return null;
    }
    var fDate = findField([/^date$/i, /date|when|shoot|session|booking/i], "date");
    var fAmount = findField([/amount|price|revenue|total|value|fee|paid/i], "number");
    var fLoc = findField([/location|studio|city|site/i], "string");
    var fStatus = findField([/status|stage|state/i], "string");
    var fClient = findField([/client|name|customer|talent|actor|who/i], "string");

    return records.map(function (r) {
      var f = r.fields || {};
      var rawDate = fDate ? f[fDate] : null;
      var d = rawDate ? new Date(rawDate) : null;
      return {
        date: d && !isNaN(d) ? d.toISOString().slice(0, 10) : null,
        client: fClient ? String(f[fClient] || "") : "",
        location: fLoc ? String(f[fLoc] || "Unknown") : "Unknown",
        status: fStatus ? String(f[fStatus] || "") : "",
        amount: fAmount && typeof f[fAmount] === "number" ? f[fAmount] : 0
      };
    }).filter(function (r) { return r.date; });
  }

  function refresh(then) {
    var cfg = getCfg();
    if (!cfg) return;
    fetchState.loading = true; fetchState.error = null;
    fetchAirtable(cfg).then(function (records) {
      var rows = normalize(records);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rows: rows }));
      fetchState.loading = false;
      if (then) then();
    }).catch(function (e) {
      fetchState.loading = false;
      fetchState.error = e.message || "Could not reach Airtable";
      if (then) then();
    });
  }

  function currentRows() {
    if (api.isConnected()) {
      try {
        var c = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (c && c.rows) return { rows: c.rows, live: true, at: c.at };
      } catch (e) {}
      return { rows: [], live: true, at: null };
    }
    return { rows: sampleData(), live: false };
  }

  /* ---------------- formatting ---------------- */
  function gbp(n) { return "£" + Math.round(n).toLocaleString("en-GB"); }
  function gbpCompact(n) {
    if (n >= 1000000) return "£" + (n / 1000000).toFixed(1) + "M";
    if (n >= 10000) return "£" + (n / 1000).toFixed(1) + "K";
    return gbp(n);
  }
  function monthKey(iso) { return iso.slice(0, 7); }
  function monthLabel(key) {
    var p = key.split("-");
    return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString("en-GB", { month: "short" });
  }

  /* ---------------- svg helpers ---------------- */
  function roundedTopRect(x, y, w, h, r) {
    if (h <= 0) return "";
    r = Math.min(r, h, w / 2);
    return "M" + x + "," + (y + h) +
      " L" + x + "," + (y + r) +
      " Q" + x + "," + y + " " + (x + r) + "," + y +
      " L" + (x + w - r) + "," + y +
      " Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) +
      " L" + (x + w) + "," + (y + h) + " Z";
  }
  function roundedRightRect(x, y, w, h, r) {
    if (w <= 0) return "";
    r = Math.min(r, w, h / 2);
    return "M" + x + "," + y +
      " L" + (x + w - r) + "," + y +
      " Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) +
      " L" + (x + w) + "," + (y + h - r) +
      " Q" + (x + w) + "," + (y + h) + " " + (x + w - r) + "," + (y + h) +
      " L" + x + "," + (y + h) + " Z";
  }
  function niceMax(v) {
    if (v <= 5) return 5;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / mag;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * mag;
  }

  /* tooltip shared across charts */
  function attachTips(card) {
    var tip = UI.el('<div class="chart-tip hidden"></div>');
    card.appendChild(tip);
    card.querySelectorAll("[data-tip]").forEach(function (el) {
      el.addEventListener("mouseenter", function () {
        tip.innerHTML = el.getAttribute("data-tip");
        tip.classList.remove("hidden");
      });
      el.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        tip.style.left = Math.min(x + 12, r.width - tip.offsetWidth - 8) + "px";
        tip.style.top = (y - tip.offsetHeight - 10 < 0 ? y + 14 : y - tip.offsetHeight - 10) + "px";
      });
      el.addEventListener("mouseleave", function () { tip.classList.add("hidden"); });
    });
  }

  /* ---------------- page ---------------- */
  api.render = function (main) {
    if (!Store.canViewSettings()) { App.go("tasks"); return; }
    var canEdit = Store.canManageTeam();
    var data = currentRows();
    var rows = data.rows;

    main.innerHTML = "";
    var head = UI.el(
      '<div class="page-head">' +
      '  <div><div class="page-title">Bookings' +
      (data.live ? "" : '<span class="chip chip-med" style="margin-left:12px;vertical-align:middle">Sample data</span>') +
      "</div>" +
      '  <div class="page-sub">' + (data.live
        ? "Live from Airtable" + (data.at ? " · updated " + UI.timeAgo(data.at) : "") +
          (fetchState.loading ? " · refreshing…" : "")
        : "This is how the page will look — connect your Airtable bookings table below to see live data.") +
      "</div></div>" +
      '  <div class="page-actions" id="bk-actions"></div>' +
      "</div>"
    );
    var actions = head.querySelector("#bk-actions");
    if (data.live) {
      var re = UI.el('<button class="btn btn-sm">↻ Refresh</button>');
      re.onclick = function () { refresh(function () { if (App.current() === "bookings") api.render(main); }); api.render(main); };
      actions.appendChild(re);
      if (canEdit) {
        var dis = UI.el('<button class="btn btn-sm btn-ghost">Disconnect</button>');
        dis.onclick = function () {
          UI.confirm("Disconnect Airtable?", "The token is removed from this browser. Sample data will show instead.", "Disconnect")
            .then(function (ok) {
              if (ok) { localStorage.removeItem(CFG_KEY); localStorage.removeItem(CACHE_KEY); api.render(main); }
            });
        };
        actions.appendChild(dis);
      }
    }
    main.appendChild(head);

    if (fetchState.error) {
      main.appendChild(UI.el('<div class="bk-error">⚠ ' + UI.esc(fetchState.error) + "</div>"));
    }

    if (!data.live) main.appendChild(connectPanel(main, canEdit));

    if (!rows.length && data.live && !fetchState.loading) {
      main.appendChild(UI.el('<div class="empty" style="margin-top:24px"><b>No bookings found</b>Airtable connected, but no rows with a date column came back — check the table name.</div>'));
      return;
    }

    main.appendChild(tiles(rows));

    var chartsRow = UI.el('<div class="bk-charts"></div>');
    chartsRow.appendChild(monthChart(rows));
    chartsRow.appendChild(locationChart(rows));
    main.appendChild(chartsRow);

    main.appendChild(recentTable(rows));
  };

  /* ---------------- connect panel ---------------- */
  function connectPanel(main, canEdit) {
    if (!canEdit) {
      return UI.el('<div class="bk-connect"><div class="comments-title">Connect Airtable</div>' +
        '<p style="color:#757570;font-size:13px">Only Ownership &amp; Developer can connect the Airtable account.</p></div>');
    }
    var panel = UI.el(
      '<div class="bk-connect">' +
      '  <div class="comments-title">Connect Airtable</div>' +
      '  <div class="field-row">' +
      '    <div class="field"><label>Personal access token</label><input type="password" id="at-token" placeholder="pat…">' +
      '    <div class="hint">airtable.com → account → Developer hub → Personal access tokens. Scope: data.records:read on your bookings base. Stays in this browser only.</div></div>' +
      '    <div class="field"><label>Base ID</label><input type="text" id="at-base" placeholder="app…">' +
      '    <div class="hint">From the base\'s API docs or its URL: airtable.com/<b>appXXXX…</b>/…</div></div>' +
      "  </div>" +
      '  <div class="field"><label>Table name</label><input type="text" id="at-table" value="Bookings">' +
      '  <div class="hint">Exactly as the tab is named in Airtable. Date, price, location and status columns are detected automatically.</div></div>' +
      '  <button class="btn btn-primary btn-sm" id="at-connect">Connect</button>' +
      "</div>"
    );
    panel.querySelector("#at-connect").onclick = function () {
      var cfg = {
        token: panel.querySelector("#at-token").value.trim(),
        base: panel.querySelector("#at-base").value.trim(),
        table: panel.querySelector("#at-table").value.trim() || "Bookings"
      };
      if (!cfg.token || !cfg.base) { UI.toast("Token and Base ID are both needed"); return; }
      localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
      UI.toast("Connecting to Airtable…");
      refresh(function () {
        if (fetchState.error) { localStorage.removeItem(CFG_KEY); }
        api.render(main);
      });
      api.render(main);
    };
    return panel;
  }

  /* ---------------- stat tiles ---------------- */
  function tiles(rows) {
    var today = UI.todayStr();
    var thisM = today.slice(0, 7);
    var lastD = new Date(); lastD.setMonth(lastD.getMonth() - 1);
    var lastM = lastD.toISOString().slice(0, 7);
    var active = rows.filter(function (r) { return r.status !== "Cancelled"; });

    function inMonth(m) { return active.filter(function (r) { return monthKey(r.date) === m; }); }
    var tCount = inMonth(thisM).length, lCount = inMonth(lastM).length;
    var tRev = inMonth(thisM).reduce(function (s, r) { return s + r.amount; }, 0);
    var lRev = inMonth(lastM).reduce(function (s, r) { return s + r.amount; }, 0);
    var avg = active.length ? active.reduce(function (s, r) { return s + r.amount; }, 0) / active.length : 0;
    var horizon = new Date(); horizon.setDate(horizon.getDate() + 14);
    var upcoming = active.filter(function (r) { return r.date > today && r.date <= horizon.toISOString().slice(0, 10); }).length;

    function delta(now, prev) {
      if (!prev) return "";
      var pct = Math.round(((now - prev) / prev) * 100);
      var up = pct >= 0;
      return '<span class="tile-delta ' + (up ? "up" : "down") + '">' +
        (up ? "▲" : "▼") + " " + Math.abs(pct) + "% vs last month</span>";
    }
    return UI.el(
      '<div class="tile-grid">' +
      '  <div class="tile"><div class="eyebrow">Bookings this month</div><div class="tile-value">' + tCount + "</div>" + delta(tCount, lCount) + "</div>" +
      '  <div class="tile"><div class="eyebrow">Revenue this month</div><div class="tile-value">' + gbpCompact(tRev) + "</div>" + delta(tRev, lRev) + "</div>" +
      '  <div class="tile"><div class="eyebrow">Average booking value</div><div class="tile-value">' + gbp(avg) + "</div></div>" +
      '  <div class="tile"><div class="eyebrow">Upcoming — next 14 days</div><div class="tile-value">' + upcoming + "</div></div>" +
      "</div>"
    );
  }

  /* ---------------- chart: bookings per month ---------------- */
  function monthChart(rows) {
    var active = rows.filter(function (r) { return r.status !== "Cancelled"; });
    var months = [];
    var d = new Date(); d.setDate(1);
    for (var i = 11; i >= 0; i--) {
      var m = new Date(d); m.setMonth(m.getMonth() - i);
      months.push(m.toISOString().slice(0, 7));
    }
    var counts = {}, revs = {};
    active.forEach(function (r) {
      var k = monthKey(r.date);
      counts[k] = (counts[k] || 0) + 1;
      revs[k] = (revs[k] || 0) + r.amount;
    });
    var maxV = niceMax(Math.max.apply(null, months.map(function (m) { return counts[m] || 0; }).concat([1])));

    var W = 520, H = 210, padL = 30, padB = 22, padT = 12;
    var plotW = W - padL - 8, plotH = H - padT - padB;
    var band = plotW / 12, barW = Math.min(24, band - 2);
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart-svg" role="img" aria-label="Bookings per month">';
    // hairline grid + clean integer ticks (4 or 5 divisions, whichever divides evenly)
    var divs = (maxV % 4 === 0) ? 4 : 5;
    for (var g = 0; g <= divs; g++) {
      var val = (maxV / divs) * g;
      var y = padT + plotH - (val / maxV) * plotH;
      svg += '<line x1="' + padL + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="' + GRID + '" stroke-width="1"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" class="ax" text-anchor="end">' + Math.round(val) + "</text>";
    }
    months.forEach(function (m, idx) {
      var v = counts[m] || 0;
      var h = (v / maxV) * plotH;
      var x = padL + idx * band + (band - barW) / 2;
      var y = padT + plotH - h;
      svg += '<path d="' + roundedTopRect(x, y, barW, h, 4) + '" fill="' + INK + '" class="bar" data-tip="' +
        UI.esc(monthLabel(m) + " — " + v + " booking" + (v === 1 ? "" : "s") + " · " + gbp(revs[m] || 0)) + '"/>';
      // invisible full-band hit target so hover is easy
      svg += '<rect x="' + (padL + idx * band) + '" y="' + padT + '" width="' + band + '" height="' + plotH +
        '" fill="transparent" data-tip="' + UI.esc(monthLabel(m) + " — " + v + " booking" + (v === 1 ? "" : "s") + " · " + gbp(revs[m] || 0)) + '"/>';
      svg += '<text x="' + (padL + idx * band + band / 2) + '" y="' + (H - 6) + '" class="ax" text-anchor="middle">' + monthLabel(m) + "</text>";
    });
    svg += "</svg>";

    var card = UI.el('<div class="chart-card"><div class="comments-title">Bookings per month</div>' + svg + "</div>");
    attachTips(card);
    return card;
  }

  /* ---------------- chart: revenue by location ---------------- */
  function locationChart(rows) {
    var active = rows.filter(function (r) { return r.status !== "Cancelled"; });
    var byLoc = {};
    active.forEach(function (r) { byLoc[r.location] = (byLoc[r.location] || 0) + r.amount; });
    var locs = Object.keys(byLoc).sort(function (a, b) { return byLoc[b] - byLoc[a]; }).slice(0, 6);
    var maxV = Math.max.apply(null, locs.map(function (l) { return byLoc[l]; }).concat([1]));

    var W = 520, rowH = 40, padT = 6, labelW = 110;
    var H = padT + locs.length * rowH + 6;
    var plotW = W - labelW - 70;
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart-svg" role="img" aria-label="Revenue by location">';
    locs.forEach(function (l, i) {
      var v = byLoc[l];
      var w = (v / maxV) * plotW;
      var y = padT + i * rowH + (rowH - 22) / 2;
      var n = active.filter(function (r) { return r.location === l; }).length;
      svg += '<text x="' + (labelW - 10) + '" y="' + (y + 15) + '" class="ax bk-loc" text-anchor="end">' + UI.esc(l) + "</text>";
      svg += '<path d="' + roundedRightRect(labelW, y, Math.max(w, 3), 22, 4) + '" fill="' + INK + '" class="bar" data-tip="' +
        UI.esc(l + " — " + gbp(v) + " · " + n + " bookings") + '"/>';
      svg += '<text x="' + (labelW + Math.max(w, 3) + 8) + '" y="' + (y + 15) + '" class="ax bk-val">' + gbpCompact(v) + "</text>";
    });
    svg += "</svg>";

    var card = UI.el('<div class="chart-card"><div class="comments-title">Revenue by location</div>' + svg + "</div>");
    attachTips(card);
    return card;
  }

  /* ---------------- recent bookings table ---------------- */
  var STATUS_DOT = { Completed: "#111", Confirmed: "#3bb273", Pending: "#f4e40b", Cancelled: "#c92f2f" };
  function recentTable(rows) {
    var recent = rows.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 10);
    var wrap = UI.el('<div class="chart-card bk-table-card"><div class="comments-title">Recent bookings ( ' + rows.length + " total )</div>" +
      '<div class="table-wrap" style="border:0"><table class="tasks bk-table"><thead><tr>' +
      "<th>Date</th><th>Client</th><th>Location</th><th>Status</th><th style=\"text-align:right\">Amount</th>" +
      "</tr></thead><tbody></tbody></table></div></div>");
    var tbody = wrap.querySelector("tbody");
    recent.forEach(function (r) {
      tbody.appendChild(UI.el(
        "<tr style=\"cursor:default\">" +
        "<td>" + UI.esc(UI.fmtDate(r.date)) + "</td>" +
        "<td>" + UI.esc(r.client || "—") + "</td>" +
        "<td>" + UI.esc(r.location) + "</td>" +
        '<td><span class="bk-status"><span class="bk-dot" style="background:' + (STATUS_DOT[r.status] || "#999") + '"></span>' + UI.esc(r.status || "—") + "</span></td>" +
        '<td class="bk-amount">' + gbp(r.amount) + "</td>" +
        "</tr>"
      ));
    });
    return wrap;
  }

  return api;
})();
