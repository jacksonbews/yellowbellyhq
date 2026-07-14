/* ================================================================
   YELLOW BELLY HQ — Bookings page (Ownership tiers only)
   Pulls the Bookings table from Airtable via its REST API and shows
   booking VOLUME by location, month and photographer (no revenue).
   Columns are auto-detected from the data (Country/Location,
   Photographer, Date or Month, Client). Until connected it renders a
   designed SAMPLE dataset so the page is fully visible in preview.
   The token is stored in THIS browser only (localStorage).
   ================================================================ */

var Bookings = (function () {
  var api = {};
  var CFG_KEY = "ybhq_airtable_cfg";
  var CACHE_KEY = "ybhq_airtable_cache";
  var INK = "#111111";
  var GRID = "#ececec";
  var fetchState = { loading: false, error: null };
  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  var MON3 = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  /* ---------------- config ---------------- */
  function getCfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)); } catch (e) { return null; }
  }
  api.isConnected = function () { return !!getCfg(); };

  function str(v) { return Array.isArray(v) ? v.join(", ") : String(v == null ? "" : v); }
  function monthIndex(name) {
    if (!name) return -1;
    return MON3.indexOf(String(name).trim().toLowerCase().slice(0, 3));
  }

  /* ---------------- sample data (deterministic) ---------------- */
  function seededRand(seed) {
    return function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  }
  function sampleData() {
    var rnd = seededRand(42);
    var locations = ["London", "New York", "Los Angeles"];
    var locWeight = [0.5, 0.3, 0.2];
    var photographers = {
      "London": ["Jack", "Will", "Sam Tom", "Kalene", "Sam Larner", "Liv", "Rosie"],
      "New York": ["Adam", "Shelby", "Matt", "Jalen", "Angela"],
      "Los Angeles": ["Shantell", "Grace S."]
    };
    var statuses = ["Completed", "Confirmed", "Pending"];
    var clients = ["A. Okafor", "B. Hartley", "C. Nguyen", "D. Silva", "E. Moretti", "F. Adeyemi",
      "G. Kowalski", "H. Tanaka", "I. Rossi", "J. Mbeki", "K. Larsen", "L. Fontaine",
      "M. O'Brien", "N. Petrov", "O. Diallo", "P. Lindqvist", "R. Castellano", "S. Yamamoto"];
    var rows = [], today = new Date();
    for (var i = 0; i < 320; i++) {
      var daysAgo = Math.floor(rnd() * 330) - 7;
      var d = new Date(today); d.setDate(d.getDate() - daysAgo);
      var lw = rnd(), loc = lw < locWeight[0] ? 0 : (lw < locWeight[0] + locWeight[1] ? 1 : 2);
      var locName = locations[loc], pool = photographers[locName];
      rows.push({
        date: d.toISOString().slice(0, 10),
        monthName: MONTHS[d.getMonth()],
        client: clients[Math.floor(rnd() * clients.length)],
        location: locName,
        photographer: pool[Math.floor(rnd() * pool.length)],
        status: statuses[Math.floor(rnd() * statuses.length)]
      });
    }
    return rows;
  }

  /* ---------------- airtable ---------------- */
  var GALLERY_TABLE = "Galleries and top 10";
  var TRAFFIC_TABLE = "Website traffic";
  var EDITS_TABLE = "Edits";
  function fetchTable(base, token, table) {
    var all = [];
    function page(offset) {
      var url = "https://api.airtable.com/v0/" + encodeURIComponent(base) + "/" +
        encodeURIComponent(table) + "?pageSize=100" + (offset ? "&offset=" + offset : "");
      return fetch(url, { headers: { Authorization: "Bearer " + token } })
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
          if (j.offset && all.length < 6000) return page(j.offset);
          return all;
        });
    }
    return page(null);
  }
  function fetchAirtable(cfg) { return fetchTable(cfg.base, cfg.token, cfg.table); }

  /* map whatever the Airtable columns are called onto our shape */
  function detectFields(records) {
    var names = {};
    records.slice(0, 30).forEach(function (r) {
      Object.keys(r.fields || {}).forEach(function (k) {
        if (names[k] === undefined || names[k] === "" || names[k] == null) names[k] = r.fields[k];
      });
    });
    function find(patterns, type) {
      var keys = Object.keys(names);
      for (var p = 0; p < patterns.length; p++) {
        for (var i = 0; i < keys.length; i++) {
          if (!patterns[p].test(keys[i])) continue;
          if (!type) return keys[i];
          var v = names[keys[i]];
          if (type === "date" && v != null && !isNaN(Date.parse(v)) && /[-/]/.test(String(v))) return keys[i];
          if (type === "string" && (typeof v === "string" || Array.isArray(v))) return keys[i];
          if (type === "number" && typeof v === "number") return keys[i];
        }
      }
      return null;
    }
    var out = {
      loc: find([/^country$/i, /country|location|studio|city|site|region|office|branch/i], "string"),
      photographer: find([/^photographer$/i, /photograph|shooter|creative|snapper/i], "string"),
      date: find([/^date$/i, /date|shoot day|when|session|scheduled|booked/i], "date"),
      month: find([/^month$/i, /month/i], "string"),
      client: find([/client|customer/i, /^name$/i, /name/i], "string"),
      status: find([/status|stage|state/i], "string"),
      gallery: find([/gallery/i]),
      top10: find([/top ?10|top ?ten/i]),
      value: find([/^edits?$/i, /^total edits?$/i, /traffic|visit|session|view|user|pageview|hits|clicks|sessions|impressions/i, /count|total|number|amount/i, /edit/i], "number"),
      reEdits: find([/re.?edit/i], "number"),
      express: find([/express/i], "number")
    };
    // value-based date fallback: catches a "Month" column that is actually a
    // date field (Airtable returns ISO strings like 2025-10-01 for those).
    if (!out.date) {
      var keys = Object.keys(names);
      for (var i = 0; i < keys.length; i++) {
        if (names[keys[i]] != null && /^\d{4}-\d\d-\d\d/.test(String(names[keys[i]]))) { out.date = keys[i]; break; }
      }
    }
    // don't also treat the date field as a month-name field
    if (out.month && out.month === out.date) out.month = null;
    return out;
  }

  function normalize(records) {
    if (!records.length) return [];
    var F = detectFields(records);
    return records.map(function (r) {
      var f = r.fields || {};
      var d = F.date && f[F.date] != null ? new Date(f[F.date]) : null;
      var iso = d && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
      var mName = F.month ? str(f[F.month]) : (iso ? MONTHS[d.getMonth()] : "");
      return {
        date: iso,
        monthName: mName,
        location: F.loc ? (str(f[F.loc]) || "Unknown") : "Unknown",
        photographer: F.photographer ? str(f[F.photographer]) : "",
        client: F.client ? str(f[F.client]) : "",
        status: F.status ? str(f[F.status]) : ""
      };
    }).filter(function (r) { return (r.location && r.location !== "Unknown") || r.date || r.monthName; });
  }

  /* rows from the "Galleries and top 10" table (own shape + gallery flag) */
  function normalizeGallery(records) {
    if (!records.length) return [];
    var F = detectFields(records);
    return records.map(function (r) {
      var f = r.fields || {};
      var d = F.date && f[F.date] != null ? new Date(f[F.date]) : null;
      var iso = d && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
      var mName = F.month ? str(f[F.month]) : (iso ? MONTHS[d.getMonth()] : "");
      function truthy(v) { return v === true || v === 1 || v === "checked" || v === "true" || v === "Yes"; }
      return {
        date: iso,
        monthName: mName,
        location: F.loc ? (str(f[F.loc]) || "Unknown") : "Unknown",
        photographer: F.photographer ? str(f[F.photographer]) : "",
        client: F.client ? str(f[F.client]) : "",
        // if there's no explicit Gallery? column, treat every row as a gallery
        isGallery: F.gallery ? truthy(f[F.gallery]) : true,
        isTop10: F.top10 ? truthy(f[F.top10]) : false
      };
    }).filter(function (r) { return (r.location && r.location !== "Unknown") || r.date || r.monthName; });
  }

  /* the numeric column for value-based tables (traffic, edits): use the
     name-detected one, else fall back to the first numeric field that isn't the date */
  function detectValueField(records, F) {
    if (F.value) return F.value;
    var names = {}, vf = null;
    records.slice(0, 30).forEach(function (r) {
      Object.keys(r.fields || {}).forEach(function (k) { if (names[k] === undefined) names[k] = r.fields[k]; });
    });
    Object.keys(names).forEach(function (k) { if (!vf && typeof names[k] === "number" && k !== F.date) vf = k; });
    return vf;
  }
  function numVal(raw) { return typeof raw === "number" ? raw : (raw != null ? parseFloat(raw) || 0 : 0); }

  /* rows from the "Website traffic" table: a numeric value per date per location */
  function normalizeTraffic(records) {
    if (!records.length) return [];
    var F = detectFields(records), valField = detectValueField(records, F);
    return records.map(function (r) {
      var f = r.fields || {};
      var d = F.date && f[F.date] != null ? new Date(f[F.date]) : null;
      var iso = d && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
      return { date: iso, location: F.loc ? (str(f[F.loc]) || "Unknown") : "Unknown", value: valField != null ? numVal(f[valField]) : 0 };
    }).filter(function (r) { return r.date; });
  }

  /* rows from the "Edits" table: a numeric edit count per month per location */
  function normalizeEdits(records) {
    if (!records.length) return [];
    var F = detectFields(records), valField = detectValueField(records, F);
    return records.map(function (r) {
      var f = r.fields || {};
      var d = F.date && f[F.date] != null ? new Date(f[F.date]) : null;
      var iso = d && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
      var mName = F.month ? str(f[F.month]) : (iso ? MONTHS[d.getMonth()] : "");
      return {
        date: iso, monthName: mName,
        location: F.loc ? (str(f[F.loc]) || "Unknown") : "Unknown",
        value: valField != null ? numVal(f[valField]) : 0,
        reEdits: F.reEdits ? (f[F.reEdits] != null ? numVal(f[F.reEdits]) : null) : null,
        express: F.express ? numVal(f[F.express]) : null
      };
    }).filter(function (r) { return (r.location && r.location !== "Unknown") || r.date || r.monthName; });
  }

  function sampleTraffic() {
    var rnd = seededRand(7), locs = ["London", "New York", "Los Angeles"], base = { "London": 420, "New York": 210, "Los Angeles": 240 };
    var out = [], today = new Date();
    for (var i = 260; i >= 0; i--) {
      var d = new Date(today); d.setDate(d.getDate() - i); var iso = d.toISOString().slice(0, 10);
      locs.forEach(function (l) { out.push({ date: iso, location: l, value: Math.round(base[l] * (0.55 + rnd() * 0.95)) }); });
    }
    return out;
  }
  function sampleEdits() {
    var rnd = seededRand(11), locs = ["London", "New York", "Los Angeles"], base = { "London": 55, "New York": 35, "Los Angeles": 10 };
    var out = [], today = new Date();
    for (var i = 270; i >= 0; i--) {
      var d = new Date(today); d.setDate(d.getDate() - i); var iso = d.toISOString().slice(0, 10);
      locs.forEach(function (l) {
        out.push({
          date: iso, monthName: MONTHS[d.getMonth()], location: l,
          value: Math.round(base[l] * (0.5 + rnd() * 1.2)),
          reEdits: (2 + rnd() * 8) / 100,               // stored as a fraction, like Airtable percent fields
          express: Math.round(base[l] * 0.35 * (0.4 + rnd()))
        });
      });
    }
    return out;
  }

  function refresh(then) {
    var cfg = getCfg();
    if (!cfg) return;
    fetchState.loading = true; fetchState.error = null;
    var galTable = cfg.galleryTable || GALLERY_TABLE, trafTable = cfg.trafficTable || TRAFFIC_TABLE, editTable = cfg.editsTable || EDITS_TABLE;
    fetchAirtable(cfg).then(function (records) {
      var rows = normalize(records);
      // the galleries + traffic + edits tables are optional — never fail the whole refresh
      var pGal = fetchTable(cfg.base, cfg.token, galTable).then(normalizeGallery).catch(function () { return []; });
      var pTraf = fetchTable(cfg.base, cfg.token, trafTable).then(normalizeTraffic).catch(function () { return []; });
      var pEd = fetchTable(cfg.base, cfg.token, editTable).then(normalizeEdits).catch(function () { return []; });
      return Promise.all([pGal, pTraf, pEd]).then(function (res) { return { rows: rows, galleries: res[0], traffic: res[1], edits: res[2] }; });
    }).then(function (data) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rows: data.rows, galleries: data.galleries, traffic: data.traffic, edits: data.edits }));
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
        if (c && c.rows) return { rows: c.rows, galleries: c.galleries || [], traffic: c.traffic || [], edits: c.edits || [], live: true, at: c.at };
      } catch (e) {}
      return { rows: [], galleries: [], traffic: [], edits: [], live: true, at: null };
    }
    var s = sampleData();
    var galleries = s.map(function (r) {
      return { date: r.date, monthName: r.monthName, location: r.location, photographer: r.photographer, client: r.client, isGallery: true, isTop10: false };
    });
    return { rows: s, galleries: galleries, traffic: sampleTraffic(), edits: sampleEdits(), live: false };
  }

  /* ---------------- svg helpers ---------------- */
  function roundedTopRect(x, y, w, h, r) {
    if (h <= 0) return "";
    r = Math.min(r, h, w / 2);
    return "M" + x + "," + (y + h) + " L" + x + "," + (y + r) + " Q" + x + "," + y + " " + (x + r) + "," + y +
      " L" + (x + w - r) + "," + y + " Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) +
      " L" + (x + w) + "," + (y + h) + " Z";
  }
  function roundedRightRect(x, y, w, h, r) {
    if (w <= 0) return "";
    r = Math.min(r, w, h / 2);
    return "M" + x + "," + y + " L" + (x + w - r) + "," + y + " Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) +
      " L" + (x + w) + "," + (y + h - r) + " Q" + (x + w) + "," + (y + h) + " " + (x + w - r) + "," + (y + h) +
      " L" + x + "," + (y + h) + " Z";
  }
  function niceMax(v) {
    if (v <= 5) return 5;
    var mag = Math.pow(10, Math.floor(Math.log10(v))), n = v / mag;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * mag;
  }
  function attachTips(card) {
    var tip = UI.el('<div class="chart-tip hidden"></div>');
    card.appendChild(tip);
    card.querySelectorAll("[data-tip]").forEach(function (el) {
      el.addEventListener("mouseenter", function () { tip.innerHTML = el.getAttribute("data-tip"); tip.classList.remove("hidden"); });
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
      '<div class="page-head"><div><div class="page-title">Bookings' +
      (data.live ? "" : '<span class="chip chip-med" style="margin-left:12px;vertical-align:middle">Sample data</span>') +
      "</div><div class=\"page-sub\">" + (data.live
        ? "Live from Airtable" + (data.at ? " · updated " + UI.timeAgo(data.at) : "") + (fetchState.loading ? " · refreshing…" : "")
        : "This is how the page will look — connect your Airtable bookings table below to see live data.") +
      "</div></div><div class=\"page-actions\" id=\"bk-actions\"></div></div>"
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
            .then(function (ok) { if (ok) { localStorage.removeItem(CFG_KEY); localStorage.removeItem(CACHE_KEY); api.render(main); } });
        };
        actions.appendChild(dis);
      }
    }
    main.appendChild(head);

    if (fetchState.error) main.appendChild(UI.el('<div class="bk-error">⚠ ' + UI.esc(fetchState.error) + "</div>"));
    if (!data.live) main.appendChild(connectPanel(main, canEdit));

    if (!rows.length && data.live && !fetchState.loading) {
      main.appendChild(UI.el('<div class="empty" style="margin-top:24px"><b>No bookings found</b>Airtable connected, but no rows came back — check the table name matches your Bookings tab.</div>'));
      return;
    }

    main.appendChild(tiles(rows));

    var daily = dailyChart(rows);
    if (daily) main.appendChild(daily);
    var weekly = weeklyChart(rows);
    if (weekly) main.appendChild(weekly);
    var monthly = monthlyBookingsChart(rows);
    if (monthly) main.appendChild(monthly); else main.appendChild(monthChart(rows));
    var clients = clientsShotChart(rows);
    if (clients) main.appendChild(clients);

    var pies = photographerPies(rows);
    if (pies.length) pies.forEach(function (c) { main.appendChild(c); });
    else main.appendChild(photographerChart(rows) || locationChart(rows));

    // Galleries and top 10 (from the second Airtable table)
    var galLoc = galleriesLocationChart(data.galleries);
    if (galLoc) { main.appendChild(UI.el('<div class="bk-section-head">Galleries and top 10</div>')); main.appendChild(galLoc); }
    var galPhot = galleriesPhotographerChart(data.galleries);
    if (galPhot) main.appendChild(galPhot);
    var top10 = top10LocationChart(data.galleries);
    if (top10) main.appendChild(top10);
    var top10Phot = top10PhotographerChart(data.galleries);
    if (top10Phot) main.appendChild(top10Phot);

    // Website traffic (from the third Airtable table)
    var traffic = trafficChart(data.traffic);
    if (traffic) { main.appendChild(UI.el('<div class="bk-section-head">Website traffic</div>')); main.appendChild(traffic); }

    // Edits (from the fourth Airtable table)
    var edLoc = editsLocationChart(data.edits), edTot = editsTotalChart(data.edits),
      edRe = reEditsChart(data.edits), edEx = expressChart(data.edits);
    if (edLoc || edTot || edRe || edEx) {
      main.appendChild(UI.el('<div class="bk-section-head">Edits</div>'));
      if (edLoc) main.appendChild(edLoc);
      if (edTot) main.appendChild(edTot);
      if (edRe) main.appendChild(edRe);
      if (edEx) main.appendChild(edEx);
    }

    main.appendChild(recentTable(rows));
  };

  /* ---------------- connect panel ---------------- */
  function connectPanel(main, canEdit) {
    if (!canEdit) {
      return UI.el('<div class="bk-connect"><div class="comments-title">Connect Airtable</div>' +
        '<p style="color:#757570;font-size:13px">Only Ownership &amp; Developer can connect the Airtable account.</p></div>');
    }
    var panel = UI.el(
      '<div class="bk-connect"><div class="comments-title">Connect Airtable</div>' +
      '<div class="field-row">' +
      '<div class="field"><label>Personal access token</label><input type="password" id="at-token" placeholder="pat…">' +
      '<div class="hint">airtable.com → Builder Hub → Personal access tokens. Scope: data.records:read, with access to your bookings base. Stays in this browser only.</div></div>' +
      '<div class="field"><label>Base ID</label><input type="text" id="at-base" placeholder="app…">' +
      '<div class="hint">From the base\'s URL: airtable.com/<b>appXXXX…</b>/…</div></div></div>' +
      '<div class="field"><label>Table name</label><input type="text" id="at-table" value="Bookings">' +
      '<div class="hint">Exactly as the tab is named in Airtable. Location, photographer, date and month columns are detected automatically.</div></div>' +
      '<button class="btn btn-primary btn-sm" id="at-connect">Connect</button></div>'
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
      refresh(function () { if (fetchState.error) localStorage.removeItem(CFG_KEY); api.render(main); });
      api.render(main);
    };
    return panel;
  }

  /* ---------------- stat tiles: total + per location ---------------- */
  function locCounts(rows) {
    var byLoc = {};
    rows.forEach(function (r) { if (r.location && r.location !== "Unknown") byLoc[r.location] = (byLoc[r.location] || 0) + 1; });
    return byLoc;
  }
  function tile(label, sub, val) {
    return '<div class="tile"><div class="eyebrow">' + UI.esc(label) + "</div>" +
      (sub ? '<div class="tile-sub">' + UI.esc(sub) + "</div>" : "") +
      '<div class="tile-value">' + val.toLocaleString("en-GB") + "</div></div>";
  }
  function tiles(rows) {
    var byLoc = locCounts(rows);
    var locs = Object.keys(byLoc).sort(function (a, b) { return byLoc[b] - byLoc[a]; }).slice(0, 3);
    var hasDate = rows.some(function (r) { return r.date; });

    if (hasDate && locs.length) {
      // Today + Last 7 days per location (from the booking date)
      var today = UI.todayStr();
      var since = new Date(); since.setDate(since.getDate() - 6);
      var sinceStr = since.toISOString().slice(0, 10);
      function cnt(loc, from, to) {
        return rows.filter(function (r) { return r.date && r.location === loc && r.date >= from && r.date <= to; }).length;
      }
      var html = "";
      locs.forEach(function (l) { html += tile(l, "Today", cnt(l, today, today)); });
      locs.forEach(function (l) { html += tile(l, "Last 7 days", cnt(l, sinceStr, today)); });
      return UI.el('<div class="tile-grid bk-loc-tiles">' + html + "</div>");
    }

    // fallback (no date column): total + per-location totals
    var html2 = tile("Total bookings", "", rows.length);
    locs.forEach(function (l) { html2 += tile(l, "", byLoc[l]); });
    return UI.el('<div class="tile-grid">' + html2 + "</div>");
  }

  /* colour per location — Yellowbelly brand palette */
  function locColor(loc, idx) {
    var n = String(loc).toLowerCase();
    if (/lond|ldn|^lon/.test(n)) return "#f4e40b";      // London — brand yellow
    if (/nyc|new ?york|^ny/.test(n)) return "#ff521a";  // NYC — brand orange
    if (/^la$|los ?angeles/.test(n)) return "#26406a";  // LA — brand navy
    var pal = ["#1a2d05", "#f4e40b", "#ff521a", "#26406a", "#757570", "#e85c33"];
    return pal[idx % pal.length];
  }

  /* the distinct locations to chart (up to 4, alphabetical), or null */
  function chartLocs(rows) {
    var byLoc = locCounts(rows);
    var locs = Object.keys(byLoc).filter(function (l) { return l && l !== "Unknown"; }).sort();
    return locs.length ? locs.slice(0, 4) : null;
  }
  function mondayISO(iso) {
    var x = new Date(iso + "T00:00:00");
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x.toISOString().slice(0, 10);
  }

  /* ---------------- shared grouped bar chart (bars per bucket × series) ----------------
     series  = array of category names (locations, or photographers)
     opts    = { colorFn, legend, showLabels } — defaults suit the location charts */
  function groupedBarChart(title, buckets, counts, series, W, H, opts) {
    opts = opts || {};
    var colorFn = opts.colorFn || locColor;
    var legend = opts.legend || "Location";
    var showLabels = opts.showLabels !== false && series.length <= 4;
    var padL = 34, padT = 22, padB = 62, legendW = 132;
    var plotW = W - padL - legendW, plotH = H - padT - padB;
    var band = plotW / buckets.length;
    var groupW = Math.min(band - 4, band * 0.82), barW = groupW / series.length;
    var allVals = [1];
    buckets.forEach(function (b) { series.forEach(function (l) { allVals.push(counts[b] && counts[b][l] || 0); }); });
    var maxV = niceMax(Math.max.apply(null, allVals));

    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart-svg" role="img" aria-label="' + UI.esc(title) + '">';
    var divs = (maxV % 4 === 0) ? 4 : 5;
    for (var g = 0; g <= divs; g++) {
      var val = (maxV / divs) * g, y = padT + plotH - (val / maxV) * plotH;
      svg += '<line x1="' + padL + '" x2="' + (padL + plotW) + '" y1="' + y + '" y2="' + y + '" stroke="' + GRID + '" stroke-width="1"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" class="ax" text-anchor="end">' + Math.round(val) + "</text>";
    }
    buckets.forEach(function (b, di) {
      var gx = padL + di * band + (band - groupW) / 2;
      series.forEach(function (l, li) {
        var v = (counts[b] && counts[b][l]) || 0, h = (v / maxV) * plotH, x = gx + li * barW, yy = padT + plotH - h, bw = Math.max(barW - 1.5, 1);
        svg += '<path d="' + roundedTopRect(x, yy, bw, h, 2) + '" fill="' + colorFn(l, li) + '" class="bar" data-tip="' + UI.esc(b + " · " + l + " — " + v) + '"/>';
        if (showLabels && v > 0) svg += '<text x="' + (x + bw / 2) + '" y="' + (yy - 4) + '" class="ax" text-anchor="middle" font-size="8">' + v + "</text>";
      });
      var lx = padL + di * band + band / 2, ly = padT + plotH + 14;
      svg += '<text transform="rotate(-38 ' + lx + " " + ly + ')" x="' + lx + '" y="' + ly + '" class="ax" text-anchor="end">' + UI.esc(b) + "</text>";
    });
    var legX = padL + plotW + 22;
    svg += '<text x="' + legX + '" y="' + (padT + 2) + '" class="ax" style="font-weight:500">' + UI.esc(legend) + "</text>";
    series.forEach(function (l, li) {
      var ly = padT + 22 + li * 18;
      svg += '<circle cx="' + (legX + 5) + '" cy="' + (ly - 4) + '" r="5" fill="' + colorFn(l, li) + '"/>';
      svg += '<text x="' + (legX + 16) + '" y="' + ly + '" class="ax">' + UI.esc(l) + "</text>";
    });
    svg += "</svg>";
    var card = UI.el('<div class="chart-card bk-daily-card"><div class="comments-title">' + UI.esc(title) + "</div>" + svg + "</div>");
    attachTips(card);
    return card;
  }
  function catColor(n, i) { return CAT[i % CAT.length]; }

  /* ---------------- daily bookings (last 14 days) ---------------- */
  function dailyChart(rows) {
    if (!rows.some(function (r) { return r.date; })) return null;
    var locs = chartLocs(rows); if (!locs) return null;
    var days = [], t = new Date(); t.setHours(0, 0, 0, 0);
    for (var i = 13; i >= 0; i--) { var d = new Date(t); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
    var counts = {};
    days.forEach(function (day) { counts[day] = {}; locs.forEach(function (l) { counts[day][l] = 0; }); });
    rows.forEach(function (r) { if (r.date && counts[r.date] && counts[r.date][r.location] !== undefined) counts[r.date][r.location]++; });
    return groupedBarChart("Daily bookings", days, counts, locs, 980, 300);
  }

  /* ---------------- weekly bookings (last 26 weeks) ---------------- */
  function weeklyChart(rows) {
    if (!rows.some(function (r) { return r.date; })) return null;
    var locs = chartLocs(rows); if (!locs) return null;
    var WEEKS = 26;
    var mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    var weeks = [];
    for (var i = WEEKS - 1; i >= 0; i--) { var d = new Date(mon); d.setDate(d.getDate() - i * 7); weeks.push(d.toISOString().slice(0, 10)); }
    var counts = {};
    weeks.forEach(function (w) { counts[w] = {}; locs.forEach(function (l) { counts[w][l] = 0; }); });
    rows.forEach(function (r) { if (r.date) { var wk = mondayISO(r.date); if (counts[wk] && counts[wk][r.location] !== undefined) counts[wk][r.location]++; } });
    var W = Math.max(980, weeks.length * 50 + 160);
    return groupedBarChart("Weekly bookings", weeks, counts, locs, W, 320);
  }

  /* ---------------- monthly bookings by location (grouped) ---------------- */
  function monthKeysPresent(rows) {
    var set = {};
    rows.forEach(function (r) { if (r.date) set[r.date.slice(0, 7)] = true; });
    return Object.keys(set).sort();
  }
  function monthLabelFull(ym) {
    var p = ym.split("-");
    return new Date(+p[0], +p[1] - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  }
  function monthlyBookingsChart(rows) {
    var locs = chartLocs(rows); if (!locs) return null;
    var buckets = [], counts = {};
    if (rows.some(function (r) { return r.date; })) {
      var months = monthKeysPresent(rows).slice(-12);
      if (!months.length) return null;
      var lbl = {}; months.forEach(function (ym) { lbl[ym] = monthLabelFull(ym); });
      buckets = months.map(function (ym) { return lbl[ym]; });
      buckets.forEach(function (b) { counts[b] = {}; locs.forEach(function (l) { counts[b][l] = 0; }); });
      rows.forEach(function (r) { if (r.date) { var b = lbl[r.date.slice(0, 7)]; if (b && counts[b][r.location] !== undefined) counts[b][r.location]++; } });
    } else {
      var present = {};
      rows.forEach(function (r) { var i = monthIndex(r.monthName); if (i >= 0) present[i] = true; });
      var order = []; for (var m = 0; m < 12; m++) if (present[m]) order.push(m);
      if (!order.length) return null;
      var mlbl = {}; order.forEach(function (m) { mlbl[m] = MONTHS[m].slice(0, 3); });
      buckets = order.map(function (m) { return mlbl[m]; });
      buckets.forEach(function (b) { counts[b] = {}; locs.forEach(function (l) { counts[b][l] = 0; }); });
      rows.forEach(function (r) { var b = mlbl[monthIndex(r.monthName)]; if (b && counts[b][r.location] !== undefined) counts[b][r.location]++; });
    }
    return groupedBarChart("Monthly bookings", buckets, counts, locs, Math.max(760, buckets.length * 92 + 160), 320);
  }

  /* ---------------- clients shot per month (distinct clients, by location) ---------------- */
  function clientsShotChart(rows) {
    if (!rows.some(function (r) { return r.date; }) || !rows.some(function (r) { return r.client; })) return null;
    var locs = chartLocs(rows); if (!locs) return null;
    var years = {}; rows.forEach(function (r) { if (r.date) years[r.date.slice(0, 4)] = true; });
    var yr = Object.keys(years).sort().pop(); if (!yr) return null;
    var buckets = []; for (var m = 1; m <= 12; m++) buckets.push(yr + "-" + (m < 10 ? "0" : "") + m);
    var seen = {}; buckets.forEach(function (b) { locs.forEach(function (l) { seen[b + "|" + l] = Object.create(null); }); });
    rows.forEach(function (r) {
      if (r.date && r.date.slice(0, 4) === yr && r.client) {
        var key = r.date.slice(0, 7) + "|" + r.location;
        if (seen[key]) seen[key][r.client.toLowerCase().trim()] = 1;
      }
    });
    var counts = {};
    buckets.forEach(function (b) { counts[b] = {}; locs.forEach(function (l) { counts[b][l] = Object.keys(seen[b + "|" + l] || {}).length; }); });
    return groupedBarChart("Clients shot per month", buckets, counts, locs, Math.max(980, buckets.length * 82 + 160), 320);
  }

  /* ---------------- galleries table: monthly grouped by any series ---------------- */
  /* buckets rows into months (or month names) × series, returns {buckets, counts} */
  function buildMonthlyCounts(rows, series, seriesOf, valueOf) {
    valueOf = valueOf || function () { return 1; };
    var buckets = [], counts = {};
    if (rows.some(function (r) { return r.date; })) {
      var months = monthKeysPresent(rows).slice(-12);
      if (!months.length) return { buckets: [], counts: {} };
      var lbl = {}; months.forEach(function (ym) { lbl[ym] = monthLabelFull(ym); });
      buckets = months.map(function (ym) { return lbl[ym]; });
      buckets.forEach(function (b) { counts[b] = {}; series.forEach(function (s) { counts[b][s] = 0; }); });
      rows.forEach(function (r) { if (r.date) { var b = lbl[r.date.slice(0, 7)], s = seriesOf(r); if (b && counts[b][s] !== undefined) counts[b][s] += valueOf(r); } });
    } else {
      var present = {};
      rows.forEach(function (r) { var i = monthIndex(r.monthName); if (i >= 0) present[i] = true; });
      var order = []; for (var m = 0; m < 12; m++) if (present[m]) order.push(m);
      if (!order.length) return { buckets: [], counts: {} };
      var mlbl = {}; order.forEach(function (m) { mlbl[m] = MONTHS[m].slice(0, 3); });
      buckets = order.map(function (m) { return mlbl[m]; });
      buckets.forEach(function (b) { counts[b] = {}; series.forEach(function (s) { counts[b][s] = 0; }); });
      rows.forEach(function (r) { var b = mlbl[monthIndex(r.monthName)], s = seriesOf(r); if (b && counts[b][s] !== undefined) counts[b][s] += valueOf(r); });
    }
    return { buckets: buckets, counts: counts };
  }
  /* only the rows that are actually galleries (falls back to all rows if the
     table has no Gallery? column) */
  function galleryRows(galleries) {
    if (!galleries || !galleries.length) return [];
    var gal = galleries.filter(function (g) { return g.isGallery; });
    return gal.length ? gal : galleries;
  }

  function galleriesLocationChart(galleries) {
    var gal = galleryRows(galleries); if (!gal.length) return null;
    var locs = chartLocs(gal); if (!locs) return null;
    var mc = buildMonthlyCounts(gal, locs, function (r) { return r.location; });
    if (!mc.buckets.length) return null;
    return groupedBarChart("Galleries per month", mc.buckets, mc.counts, locs, Math.max(760, mc.buckets.length * 92 + 170), 320);
  }

  function galleriesPhotographerChart(galleries) {
    var gal = galleryRows(galleries); if (!gal.length) return null;
    var by = {};
    gal.forEach(function (g) { if (g.photographer) by[g.photographer] = (by[g.photographer] || 0) + 1; });
    var phots = Object.keys(by).sort();  // alphabetical, for a stable legend/colour
    if (!phots.length) return null;
    var mc = buildMonthlyCounts(gal, phots, function (r) { return r.photographer; });
    if (!mc.buckets.length) return null;
    var W = Math.max(1000, mc.buckets.length * 108 + 200);
    var H = Math.max(340, 60 + phots.length * 18);
    return groupedBarChart("Galleries per month · by photographer", mc.buckets, mc.counts, phots, W, H,
      { colorFn: catColor, legend: "Photographer", showLabels: false });
  }

  function top10LocationChart(galleries) {
    var top = (galleries || []).filter(function (g) { return g.isTop10; });
    if (!top.length) return null;
    var locs = chartLocs(top); if (!locs) return null;
    var mc = buildMonthlyCounts(top, locs, function (r) { return r.location; });
    if (!mc.buckets.length) return null;
    return groupedBarChart("Top 10 per month per Location", mc.buckets, mc.counts, locs, Math.max(760, mc.buckets.length * 92 + 170), 320);
  }

  function top10PhotographerChart(galleries) {
    var top = (galleries || []).filter(function (g) { return g.isTop10; });
    if (!top.length) return null;
    var by = {};
    top.forEach(function (g) { if (g.photographer) by[g.photographer] = (by[g.photographer] || 0) + 1; });
    var phots = Object.keys(by).sort();
    if (!phots.length) return null;
    var mc = buildMonthlyCounts(top, phots, function (r) { return r.photographer; });
    if (!mc.buckets.length) return null;
    var W = Math.max(1000, mc.buckets.length * 108 + 200);
    var H = Math.max(340, 60 + phots.length * 18);
    return groupedBarChart("Photographer Top 10 per month", mc.buckets, mc.counts, phots, W, H,
      { colorFn: catColor, legend: "Photographer", showLabels: false });
  }

  /* ---------------- website traffic (multi-line, from the traffic table) ---------------- */
  function fmtShortDate(iso) { var p = iso.split("-"); return (+p[1]) + "/" + (+p[2]) + "/" + p[0]; }
  function lineChart(title, dates, val, series, opts) {
    opts = opts || {};
    var colorFn = opts.colorFn || locColor, legend = opts.legend || "Location", dots = opts.dots, hideLegend = opts.hideLegend;
    var padL = 52, padT = 18, padB = 56, legendW = hideLegend ? 24 : 120, W = 1200, H = 320;
    var plotW = W - padL - legendW, plotH = H - padT - padB, n = dates.length;
    var maxV = 1;
    series.forEach(function (l) { dates.forEach(function (d) { var v = (val[l] && val[l][d]) || 0; if (v > maxV) maxV = v; }); });
    maxV = niceMax(maxV);
    function X(i) { return padL + (n === 1 ? 0 : (i / (n - 1)) * plotW); }
    function Y(v) { return padT + plotH - (v / maxV) * plotH; }

    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart-svg" role="img" aria-label="' + UI.esc(title) + '">';
    var divs = (maxV % 4 === 0) ? 4 : 5;
    for (var g = 0; g <= divs; g++) {
      var gv = (maxV / divs) * g, gy = Y(gv);
      svg += '<line x1="' + padL + '" x2="' + (padL + plotW) + '" y1="' + gy + '" y2="' + gy + '" stroke="' + GRID + '" stroke-width="1"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (gy + 3) + '" class="ax" text-anchor="end">' + Math.round(gv).toLocaleString("en-GB") + "</text>";
    }
    var step = Math.max(1, Math.round(n / 9));
    for (var i = 0; i < n; i += step) {
      var lx = X(i), ly = padT + plotH + 14;
      svg += '<text transform="rotate(-38 ' + lx + " " + ly + ')" x="' + lx + '" y="' + ly + '" class="ax" text-anchor="end">' + UI.esc(fmtShortDate(dates[i])) + "</text>";
    }
    series.forEach(function (l, li) {
      var pts = [];
      dates.forEach(function (d, ix) { pts.push(X(ix).toFixed(1) + "," + Y((val[l] && val[l][d]) || 0).toFixed(1)); });
      svg += '<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + colorFn(l, li) + '" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>';
    });
    if (dots) series.forEach(function (l, li) {
      dates.forEach(function (d, ix) {
        var v = (val[l] && val[l][d]) || 0;
        svg += '<circle cx="' + X(ix).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="3.2" fill="' + colorFn(l, li) + '" class="bar" data-tip="' + UI.esc(fmtShortDate(d) + " — " + Math.round(v).toLocaleString("en-GB")) + '"/>';
      });
    });
    if (!hideLegend) {
      var legX = padL + plotW + 22;
      svg += '<text x="' + legX + '" y="' + (padT + 2) + '" class="ax" style="font-weight:500">' + UI.esc(legend) + "</text>";
      series.forEach(function (l, li) {
        var yy = padT + 22 + li * 20;
        svg += '<circle cx="' + (legX + 5) + '" cy="' + (yy - 4) + '" r="5" fill="' + colorFn(l, li) + '"/>';
        svg += '<text x="' + (legX + 16) + '" y="' + yy + '" class="ax">' + UI.esc(l) + "</text>";
      });
    }
    svg += "</svg>";
    var card = UI.el('<div class="chart-card bk-daily-card"><div class="comments-title">' + UI.esc(title) + "</div>" + svg + "</div>");
    attachTips(card);
    return card;
  }
  function trafficChart(traffic) {
    if (!traffic || !traffic.length) return null;
    var locs = chartLocs(traffic); if (!locs) return null;
    var dset = {}; traffic.forEach(function (t) { if (t.date) dset[t.date] = true; });
    var dates = Object.keys(dset).sort();
    if (dates.length < 2) return null;
    var val = {}; locs.forEach(function (l) { val[l] = {}; });
    traffic.forEach(function (t) { if (t.date && val[t.location]) val[t.location][t.date] = (val[t.location][t.date] || 0) + t.value; });
    return lineChart("Website traffic", dates, val, locs, { colorFn: locColor, legend: "Location" });
  }

  /* ---------------- edits: summed value per month (from the edits table) ---------------- */
  function lastDayIso(ym) {
    var p = ym.split("-"), y = +p[0], m = +p[1], last = new Date(y, m, 0).getDate();
    return y + "-" + (m < 10 ? "0" : "") + m + "-" + (last < 10 ? "0" : "") + last;
  }
  function editsLocationChart(edits) {
    if (!edits || !edits.length) return null;
    var locs = chartLocs(edits); if (!locs) return null;
    var mc = buildMonthlyCounts(edits, locs, function (r) { return r.location; }, function (r) { return r.value; });
    if (!mc.buckets.length) return null;
    return groupedBarChart("Edits per location", mc.buckets, mc.counts, locs, Math.max(760, mc.buckets.length * 92 + 170), 320,
      { colorFn: locColor, legend: "Location", showLabels: false });
  }
  function editsTotalChart(edits) {
    if (!edits || !edits.length || !edits.some(function (r) { return r.date; })) return null;
    var months = monthKeysPresent(edits).slice(-12);
    if (months.length < 2) return null;
    var order = months.map(lastDayIso), total = {};
    order.forEach(function (iso) { total[iso] = 0; });
    edits.forEach(function (r) { if (r.date) { var iso = lastDayIso(r.date.slice(0, 7)); if (total[iso] !== undefined) total[iso] += r.value; } });
    return lineChart("Total Edits", order, { "Total": total }, ["Total"], { colorFn: function () { return "#ff521a"; }, dots: true, hideLegend: true });
  }

  /* single-series bar chart (used for Re-edits %) */
  function simpleBarChart(title, labels, values, opts) {
    opts = opts || {};
    var color = opts.color || INK, pct = opts.pct, W = opts.W || 760, H = opts.H || 300;
    var padL = 46, padT = 20, padB = 60, padR = 20, plotW = W - padL - padR, plotH = H - padT - padB;
    var band = plotW / labels.length, barW = Math.min(band - 8, band * 0.6);
    var maxV = niceMax(Math.max.apply(null, values.concat([1])));
    function fmt(v) { return pct ? v.toFixed(1) + "%" : Math.round(v).toLocaleString("en-GB"); }
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart-svg" role="img" aria-label="' + UI.esc(title) + '">';
    var divs = (maxV % 4 === 0) ? 4 : 5;
    for (var g = 0; g <= divs; g++) {
      var gv = (maxV / divs) * g, gy = padT + plotH - (gv / maxV) * plotH;
      svg += '<line x1="' + padL + '" x2="' + (padL + plotW) + '" y1="' + gy + '" y2="' + gy + '" stroke="' + GRID + '" stroke-width="1"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (gy + 3) + '" class="ax" text-anchor="end">' + fmt(gv) + "</text>";
    }
    labels.forEach(function (lab, i) {
      var v = values[i] || 0, h = (v / maxV) * plotH, x = padL + i * band + (band - barW) / 2, y = padT + plotH - h;
      svg += '<path d="' + roundedTopRect(x, y, barW, h, 3) + '" fill="' + color + '" class="bar" data-tip="' + UI.esc(lab + " — " + fmt(v)) + '"/>';
      var lx = padL + i * band + band / 2, ly = padT + plotH + 14;
      svg += '<text transform="rotate(-38 ' + lx + " " + ly + ')" x="' + lx + '" y="' + ly + '" class="ax" text-anchor="end">' + UI.esc(lab) + "</text>";
    });
    svg += "</svg>";
    var card = UI.el('<div class="chart-card bk-daily-card"><div class="comments-title">' + UI.esc(title) + "</div>" + svg + "</div>");
    attachTips(card);
    return card;
  }
  function reEditsChart(edits) {
    var rows = (edits || []).filter(function (r) { return r.reEdits != null && !isNaN(r.reEdits) && r.date; });
    if (!rows.length) return null;
    var maxRaw = Math.max.apply(null, rows.map(function (r) { return r.reEdits; }));
    var scale = maxRaw <= 1.5 ? 100 : 1;   // Airtable percent fields come through as fractions
    var months = monthKeysPresent(rows).slice(-12);
    if (!months.length) return null;
    var sum = {}, cnt = {};
    months.forEach(function (ym) { sum[ym] = 0; cnt[ym] = 0; });
    rows.forEach(function (r) { var ym = r.date.slice(0, 7); if (sum[ym] !== undefined) { sum[ym] += r.reEdits * scale; cnt[ym]++; } });
    var labels = months.map(monthLabelFull);
    var values = months.map(function (ym) { return cnt[ym] ? sum[ym] / cnt[ym] : 0; });
    return simpleBarChart("Re-edits %", labels, values, { color: "#f4c430", pct: true, W: Math.max(760, labels.length * 92 + 120) });
  }
  function expressChart(edits) {
    var rows = (edits || []).filter(function (r) { return r.express != null; });
    if (!rows.length) return null;
    var locs = chartLocs(rows); if (!locs) return null;
    var mc = buildMonthlyCounts(rows, locs, function (r) { return r.location; }, function (r) { return r.express || 0; });
    if (!mc.buckets.length) return null;
    return groupedBarChart("Express", mc.buckets, mc.counts, locs, Math.max(760, mc.buckets.length * 92 + 170), 320,
      { colorFn: locColor, legend: "Location", showLabels: false });
  }

  /* ---------------- chart: bookings per month ---------------- */
  function periods(rows) {
    var hasDate = rows.some(function (r) { return r.date; });
    if (hasDate) {
      var arr = [], counts = {}, d = new Date(); d.setDate(1);
      for (var i = 11; i >= 0; i--) {
        var m = new Date(d); m.setMonth(m.getMonth() - i);
        arr.push({ key: m.toISOString().slice(0, 7), label: m.toLocaleDateString("en-GB", { month: "short" }) });
      }
      rows.forEach(function (r) { if (r.date) { var k = r.date.slice(0, 7); counts[k] = (counts[k] || 0) + 1; } });
      return arr.map(function (o) { return { label: o.label, count: counts[o.key] || 0 }; });
    }
    var c2 = {};
    rows.forEach(function (r) { var idx = monthIndex(r.monthName); if (idx >= 0) c2[idx] = (c2[idx] || 0) + 1; });
    var out = [];
    for (var i = 0; i < 12; i++) if (c2[i] !== undefined) out.push({ label: MONTHS[i].slice(0, 3), count: c2[i] });
    return out;
  }
  function monthChart(rows) {
    var ps = periods(rows);
    if (!ps.length) ps = [{ label: "—", count: 0 }];
    var maxV = niceMax(Math.max.apply(null, ps.map(function (p) { return p.count; }).concat([1])));
    var W = 520, H = 210, padL = 30, padB = 22, padT = 12;
    var plotW = W - padL - 8, plotH = H - padT - padB;
    var band = plotW / ps.length, barW = Math.min(26, band - 3);
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart-svg" role="img" aria-label="Bookings per month">';
    var divs = (maxV % 4 === 0) ? 4 : 5;
    for (var g = 0; g <= divs; g++) {
      var val = (maxV / divs) * g, y = padT + plotH - (val / maxV) * plotH;
      svg += '<line x1="' + padL + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="' + GRID + '" stroke-width="1"/>';
      svg += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" class="ax" text-anchor="end">' + Math.round(val) + "</text>";
    }
    ps.forEach(function (p, idx) {
      var h = (p.count / maxV) * plotH, x = padL + idx * band + (band - barW) / 2, y = padT + plotH - h;
      var tip = UI.esc(p.label + " — " + p.count + " booking" + (p.count === 1 ? "" : "s"));
      svg += '<path d="' + roundedTopRect(x, y, barW, h, 4) + '" fill="' + INK + '" class="bar" data-tip="' + tip + '"/>';
      svg += '<rect x="' + (padL + idx * band) + '" y="' + padT + '" width="' + band + '" height="' + plotH + '" fill="transparent" data-tip="' + tip + '"/>';
      svg += '<text x="' + (padL + idx * band + band / 2) + '" y="' + (H - 6) + '" class="ax" text-anchor="middle">' + UI.esc(p.label) + "</text>";
    });
    svg += "</svg>";
    var card = UI.el('<div class="chart-card"><div class="comments-title">Bookings per month</div>' + svg + "</div>");
    attachTips(card);
    return card;
  }

  /* ---------------- chart: top photographers ---------------- */
  function photographerChart(rows) {
    var by = {};
    rows.forEach(function (r) { if (r.photographer) by[r.photographer] = (by[r.photographer] || 0) + 1; });
    var names = Object.keys(by);
    if (!names.length) return null;
    names.sort(function (a, b) { return by[b] - by[a]; });
    names = names.slice(0, 8);
    var maxV = Math.max.apply(null, names.map(function (n) { return by[n]; }).concat([1]));
    var W = 520, rowH = 34, padT = 6, labelW = 118;
    var H = padT + names.length * rowH + 6, plotW = W - labelW - 60;
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart-svg" role="img" aria-label="Top photographers">';
    names.forEach(function (n, i) {
      var v = by[n], w = (v / maxV) * plotW, y = padT + i * rowH + (rowH - 20) / 2;
      svg += '<text x="' + (labelW - 10) + '" y="' + (y + 14) + '" class="ax bk-loc" text-anchor="end">' + UI.esc(n) + "</text>";
      svg += '<path d="' + roundedRightRect(labelW, y, Math.max(w, 3), 20, 4) + '" fill="' + INK + '" class="bar" data-tip="' +
        UI.esc(n + " — " + v + " booking" + (v === 1 ? "" : "s")) + '"/>';
      svg += '<text x="' + (labelW + Math.max(w, 3) + 8) + '" y="' + (y + 14) + '" class="ax bk-val">' + v + "</text>";
    });
    svg += "</svg>";
    var card = UI.el('<div class="chart-card"><div class="comments-title">Top photographers</div>' + svg + "</div>");
    attachTips(card);
    return card;
  }

  /* ---------------- photographer split per city (pie) ---------------- */
  var CAT = ["#4ec3dd", "#f4c430", "#e8506e", "#3d6fd4", "#5bb95b", "#9b6cf0", "#f0883e", "#d94f4f", "#40b5ad", "#b0928a", "#c65fb0", "#7a8b3a"];
  function textOn(hex) {
    var c = hex.replace("#", ""), r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#17130f" : "#ffffff";
  }
  function photographerPie(rows, city) {
    var inCity = rows.filter(function (r) { return r.location === city && r.photographer; });
    if (!inCity.length) return null;
    var by = {};
    inCity.forEach(function (r) { by[r.photographer] = (by[r.photographer] || 0) + 1; });
    var names = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
    var total = inCity.length;

    var W = 900, H = Math.max(300, 44 + names.length * 20), cx = 340, cy = H / 2, rad = Math.min(118, cy - 16), legX = 630;
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart-svg" role="img" aria-label="Photographers in ' + UI.esc(city) + '">';
    var ang = -Math.PI / 2;
    names.forEach(function (n, i) {
      var frac = by[n] / total, a2 = ang + frac * 2 * Math.PI, col = CAT[i % CAT.length], pct = (frac * 100).toFixed(1);
      var x1 = cx + rad * Math.cos(ang), y1 = cy + rad * Math.sin(ang), x2 = cx + rad * Math.cos(a2), y2 = cy + rad * Math.sin(a2);
      var d = frac >= 0.9999
        ? "M" + cx + "," + (cy - rad) + " A" + rad + "," + rad + " 0 1 1 " + (cx - 0.01) + "," + (cy - rad) + " Z"
        : "M" + cx + "," + cy + " L" + x1 + "," + y1 + " A" + rad + "," + rad + " 0 " + (frac > 0.5 ? 1 : 0) + " 1 " + x2 + "," + y2 + " Z";
      svg += '<path d="' + d + '" fill="' + col + '" stroke="#fff" stroke-width="1" class="bar" data-tip="' + UI.esc(n + " — " + by[n] + " (" + pct + "%)") + '"/>';
      if (frac > 0.045) {
        var mid = (ang + a2) / 2, lr = rad * 0.62, lx = cx + lr * Math.cos(mid), ly = cy + lr * Math.sin(mid);
        svg += '<text x="' + lx + '" y="' + (ly + 3) + '" text-anchor="middle" font-size="11" fill="' + textOn(col) + '">' + pct + "%</text>";
      }
      ang = a2;
    });
    svg += '<text x="' + legX + '" y="' + (cy - rad + 4) + '" class="ax" style="font-weight:500;font-size:12px">Photographer</text>';
    names.forEach(function (n, i) {
      var ly = (cy - rad + 24) + i * 20;
      svg += '<circle cx="' + (legX + 5) + '" cy="' + (ly - 4) + '" r="5" fill="' + CAT[i % CAT.length] + '"/>';
      svg += '<text x="' + (legX + 16) + '" y="' + ly + '" class="ax">' + UI.esc(n) + "</text>";
    });
    svg += "</svg>";
    var card = UI.el('<div class="chart-card bk-pie-card"><div class="comments-title">Photographers</div><div class="bk-pie-sub">' + UI.esc(city) + "</div>" + svg + "</div>");
    attachTips(card);
    return card;
  }
  function photographerPies(rows) {
    var locs = chartLocs(rows);
    if (!locs || !rows.some(function (r) { return r.photographer; })) return [];
    var cards = [];
    locs.forEach(function (city) { var c = photographerPie(rows, city); if (c) cards.push(c); });
    return cards;
  }

  /* ---------------- chart: bookings by location (fallback) ---------------- */
  function locationChart(rows) {
    var by = locCounts(rows);
    var locs = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).slice(0, 6);
    var maxV = Math.max.apply(null, locs.map(function (l) { return by[l]; }).concat([1]));
    var W = 520, rowH = 40, padT = 6, labelW = 118, plotW = W - labelW - 60;
    var H = padT + locs.length * rowH + 6;
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart-svg" role="img" aria-label="Bookings by location">';
    locs.forEach(function (l, i) {
      var v = by[l], w = (v / maxV) * plotW, y = padT + i * rowH + (rowH - 22) / 2;
      svg += '<text x="' + (labelW - 10) + '" y="' + (y + 15) + '" class="ax bk-loc" text-anchor="end">' + UI.esc(l) + "</text>";
      svg += '<path d="' + roundedRightRect(labelW, y, Math.max(w, 3), 22, 4) + '" fill="' + INK + '" class="bar" data-tip="' +
        UI.esc(l + " — " + v + " bookings") + '"/>';
      svg += '<text x="' + (labelW + Math.max(w, 3) + 8) + '" y="' + (y + 15) + '" class="ax bk-val">' + v + "</text>";
    });
    svg += "</svg>";
    var card = UI.el('<div class="chart-card"><div class="comments-title">Bookings by location</div>' + svg + "</div>");
    attachTips(card);
    return card;
  }

  /* ---------------- recent bookings table ---------------- */
  function recentTable(rows) {
    var hasStatus = rows.some(function (r) { return r.status; });
    var hasPhotog = rows.some(function (r) { return r.photographer; });
    var recent = rows.slice();
    if (rows.some(function (r) { return r.date; })) {
      recent.sort(function (a, b) { return (a.date || "") < (b.date || "") ? 1 : -1; });
    }
    recent = recent.slice(0, 12);
    var cols = "<th>" + (rows.some(function (r) { return r.date; }) ? "Date" : "Month") + "</th><th>Client</th><th>Location</th>" +
      (hasPhotog ? "<th>Photographer</th>" : "") + (hasStatus ? "<th>Status</th>" : "");
    var wrap = UI.el('<div class="chart-card bk-table-card"><div class="comments-title">Recent bookings ( ' + rows.length.toLocaleString("en-GB") + " total )</div>" +
      '<div class="table-wrap" style="border:0"><table class="tasks bk-table"><thead><tr>' + cols +
      "</tr></thead><tbody></tbody></table></div></div>");
    var tbody = wrap.querySelector("tbody");
    recent.forEach(function (r) {
      var when = r.date ? UI.fmtDate(r.date) : (r.monthName || "—");
      tbody.appendChild(UI.el(
        "<tr style=\"cursor:default\"><td>" + UI.esc(when) + "</td>" +
        "<td>" + UI.esc(r.client || "—") + "</td>" +
        "<td>" + UI.esc(r.location) + "</td>" +
        (hasPhotog ? "<td>" + UI.esc(r.photographer || "—") + "</td>" : "") +
        (hasStatus ? "<td>" + UI.esc(r.status || "—") + "</td>" : "") +
        "</tr>"
      ));
    });
    return wrap;
  }

  return api;
})();
