/* ================================================================
   YELLOW BELLY HQ — OUTREACH (prototype)
   Contact-led outreach tracker for drama schools, casting directors
   and talent agents. Dummy data only — no real email, no database.
   The unit is a CONTACT (a person/email at an organisation).
   Access: Hannah + Harriet (+ owner-dev to manage/test).
   ================================================================ */

var Outreach = (function () {
  var api = {};
  var TODAY = "2026-08-12";

  var COLUMNS = [
    { id: "to-contact", label: "To contact",   hint: "Added, not yet emailed", preContact: true },
    { id: "contacted",  label: "Contacted",     hint: "Outreach sent, awaiting reply" },
    { id: "replied",    label: "Replied",       hint: "They've come back" },
    { id: "scheduling", label: "Scheduling",    hint: "Said yes — sorting a date" },
    { id: "booked",     label: "Booked",        hint: "Date in the diary" },
    { id: "delivered",  label: "Delivered",     hint: "Talk happened" },
    { id: "closed",     label: "Not interested / no response", hint: "Closed off — revisit next cycle" }
  ];
  var TYPES = { school: "School", casting: "Casting Director", agent: "Agent" };
  var OWNERS = ["Hannah", "Liv", "Matt"];
  var MAX_BATCH = 50;   // safe number to send at once from Gmail without bounces / spam flags

  function d(days) { var x = new Date(TODAY + "T00:00:00"); x.setDate(x.getDate() - days); return x.toISOString().slice(0, 10); }
  function canSeeOwner() { var m = Store.me(); return !!m && (m.role === "owner" || m.role === "owner-dev"); }

  /* ---------- dummy data: flat list of contacts ---------- */
  var DATA;
  function seed() {
    var C = [];
    function add(o) { o.id = "c" + (C.length + 1); C.push(o); }
    add({ org: "RADA", type: "school", region: "London", website: "rada.ac.uk", name: "", jobTitle: "Enquiries", email: "enquiries@rada.ac.uk", phone: "020 7636 7076", owner: "Hannah", status: "contacted", campaign: "Autumn 2026 schools", last: d(12), next: "", notes: "Generic inbox — passed to relevant dept, no reply yet." });
    add({ org: "RADA", type: "school", region: "London", website: "rada.ac.uk", name: "Mark Inman", jobTitle: "Development", email: "development@rada.ac.uk", phone: "", owner: "Hannah", status: "replied", campaign: "Autumn 2026 schools", last: d(2), next: "Reply re: talk dates", notes: "Came back keen after a chase." });
    add({ org: "Guildhall (GSMD)", type: "school", region: "London", website: "gsmd.ac.uk", name: "Caroline Hawley", jobTitle: "Head of Acting", email: "caroline.hawley@gsmd.ac.uk", phone: "", owner: "Hannah", status: "contacted", campaign: "Autumn 2026 schools", last: d(11), next: "", notes: "" });
    add({ org: "Guildhall (GSMD)", type: "school", region: "London", website: "gsmd.ac.uk", name: "Meg Ryan", jobTitle: "Marketing", email: "meg.ryan@gsmd.ac.uk", phone: "", owner: "Hannah", status: "contacted", campaign: "Autumn 2026 schools", last: d(11), next: "", notes: "" });
    add({ org: "Guildhall (GSMD)", type: "school", region: "London", website: "gsmd.ac.uk", name: "Rebecca Muress", jobTitle: "Admissions", email: "rebecca.muress@gsmd.ac.uk", phone: "", owner: "Hannah", status: "contacted", campaign: "Autumn 2026 schools", last: d(11), next: "", notes: "" });
    add({ org: "Guildhall (GSMD)", type: "school", region: "London", website: "gsmd.ac.uk", name: "Willow Welch", jobTitle: "Student Services", email: "willow.welch@gsmd.ac.uk", phone: "", owner: "Hannah", status: "replied", campaign: "Autumn 2026 schools", last: d(3), next: "Send info pack", notes: "Spoke on the phone — positive, wants details." });
    add({ org: "Mountview", type: "school", region: "London", website: "mountview.org.uk", name: "", jobTitle: "Development", email: "development@mountview.org.uk", phone: "", owner: "Hannah", status: "closed", campaign: "Autumn 2026 schools", last: d(17), next: "", closedReason: "Already has a talk", notes: "Already got a headshot talk booked in this year." });
    add({ org: "LAMDA", type: "school", region: "London", website: "lamda.ac.uk", name: "Elissa Gerrand", jobTitle: "Head of Musical Theatre", email: "elissa.gerrand@lamda.ac.uk", phone: "", owner: "Hannah", status: "closed", campaign: "Autumn 2026 schools", last: d(22), next: "", closedReason: "Existing relationship", notes: "Already have existing relationships here." });
    add({ org: "GSA (Guildford)", type: "school", region: "Surrey", website: "gsauk.org", name: "Darren Tunstall", jobTitle: "Head of Acting", email: "d.tunstall@gsauk.org", phone: "", owner: "Liv", status: "scheduling", campaign: "Autumn 2026 schools", last: d(10), next: "Chase Liv for dates", notes: "Agreed to a talk; Liv arranging.", scheduling: { requested: true, offered: [], agreed: "" } });
    add({ org: "Italia Conti", type: "school", region: "London", website: "italiaconti.co.uk", name: "", jobTitle: "Info", email: "info@italiaconti.co.uk", phone: "", owner: "Liv", status: "booked", campaign: "Autumn 2026 schools", last: d(6), next: "Liv to deliver 18 Sep", notes: "Talk agreed and in the diary.", scheduling: { requested: true, offered: [d(-32), d(-40)], agreed: d(-38) } });
    add({ org: "ArtsEd", type: "school", region: "London", website: "artsed.co.uk", name: "M. Malthouse", jobTitle: "Head of Musical Theatre", email: "mmalthouse@artsed.co.uk", phone: "", owner: "Hannah", status: "contacted", campaign: "Autumn 2026 schools", last: d(3), next: "Follow-up 1 due in 4 days", notes: "Called the school; Liv followed up by email." });
    add({ org: "Rose Bruford", type: "school", region: "Kent", website: "bruford.ac.uk", name: "", jobTitle: "Admissions", email: "hello@bruford.ac.uk", phone: "", owner: "Hannah", status: "to-contact", campaign: "Autumn 2026 schools", last: "", next: "Send intro email", notes: "" });
    add({ org: "Central School of Speech & Drama", type: "school", region: "London", website: "cssd.ac.uk", name: "", jobTitle: "Enquiries", email: "enquiries@cssd.ac.uk", phone: "", owner: "Liv", status: "delivered", campaign: "Autumn 2026 schools", last: d(24), next: "", notes: "Liv delivered the talk; posters + discount codes sent." });
    add({ org: "Tring Park", type: "school", region: "Herts", website: "tringpark.com", name: "Simon Larter-Evans", jobTitle: "Principal", email: "principal@tringpark.com", phone: "", owner: "Hannah", status: "to-contact", campaign: "Autumn 2026 schools", last: "", next: "Send intro email", notes: "" });
    add({ org: "Bristol Old Vic Theatre School", type: "school", region: "Bristol", website: "oldvic.ac.uk", name: "", jobTitle: "Admissions", email: "admissions@oldvic.ac.uk", phone: "", owner: "Matt", status: "contacted", campaign: "Autumn 2026 schools", last: d(4), next: "Awaiting reply", notes: "" });
    add({ org: "Oxford School of Drama", type: "school", region: "Oxon", website: "oxforddrama.ac.uk", name: "George Peck", jobTitle: "Principal", email: "principal@oxforddrama.ac.uk", phone: "", owner: "Hannah", status: "scheduling", campaign: "Autumn 2026 schools", last: d(5), next: "Confirm date with school", notes: "Keen — waiting to lock a date.", scheduling: { requested: true, offered: [d(-20), d(-27)], agreed: "" } });
    add({ org: "Rowan & Vine Casting", type: "casting", region: "London", website: "rowanvine.example", name: "Priya Anand", jobTitle: "Casting Director", email: "priya@rowanvine.example", phone: "", owner: "Hannah", status: "contacted", campaign: "Autumn 2026 casting", last: d(3), next: "Awaiting reply", notes: "Sent the casting director series invitation." });
    add({ org: "Marlowe Casting", type: "casting", region: "London", website: "marlowecasting.example", name: "Tom Beckett", jobTitle: "Casting Director", email: "tom@marlowecasting.example", phone: "", owner: "Hannah", status: "replied", campaign: "Autumn 2026 casting", last: d(1), next: "Send series details", notes: "Interested — asked for more on the series." });
    add({ org: "Bloomsbury Talent", type: "agent", region: "London", website: "bloomsburytalent.example", name: "", jobTitle: "New Talent", email: "hello@bloomsburytalent.example", phone: "", owner: "Hannah", status: "to-contact", campaign: "Autumn 2026 agents", last: "", next: "Send profile shoot invite", notes: "" });
    add({ org: "The Hart Agency", type: "agent", region: "Manchester", website: "hartagency.example", name: "Nadia Hart", jobTitle: "Founder / Agent", email: "nadia@hartagency.example", phone: "", owner: "Hannah", status: "contacted", campaign: "Autumn 2026 agents", last: d(12), next: "", notes: "No reply yet to the agent series invitation." });
    var templates = [
      { id: "t1", name: "Headshot talk + rising star offer", audience: "school", subject: "A free headshot talk for {{organisation}} students",
        body: "Hi {{name}},\n\nI'm Hannah from Yellowbelly — a photography studio that works with drama schools across the UK.\n\nWe'd love to offer {{organisation}} a free headshot talk, delivered in person at the school: practical, industry-focused guidance for your students on getting shoot-ready. On each visit we also pick one student as our ‘rising star’, who gets a complimentary shoot at our studio.\n\nWould you be open to a quick chat about setting this up this term?\n\nBest,\nHannah\nYellowbelly" },
      { id: "t2", name: "Casting director series invitation", audience: "casting", subject: "Yellowbelly × casting — a short session series",
        body: "Hi {{name}},\n\nI'm Hannah from Yellowbelly. We're putting together a short series of sessions with casting directors and would love to include you.\n\nIt's a relaxed, no-cost way to connect with fresh talent and share what you look for. Could I send a few dates?\n\nBest,\nHannah\nYellowbelly" },
      { id: "t3", name: "Agent series invitation", audience: "agent", subject: "An invitation for {{organisation}}'s roster",
        body: "Hi {{name}},\n\nI'm Hannah from Yellowbelly. We run a series designed for agents and their rosters — a chance for your clients to get high-quality, industry-ready images.\n\nWould {{organisation}} be interested in taking part this season?\n\nBest,\nHannah\nYellowbelly" },
      { id: "t4", name: "Profile client shoot invitation", audience: "agent", subject: "Complimentary profile shoot for a {{organisation}} client",
        body: "Hi {{name}},\n\nHannah at Yellowbelly here. We'd like to offer one {{organisation}} client a complimentary profile shoot at our studio — a simple way to see how we work together.\n\nShall I send some details?\n\nBest,\nHannah\nYellowbelly" }
    ];
    var sequences = [
      { id: "s1", name: "Schools — talk offer (+2 follow-ups)", audience: "school", steps: [
        { type: "initial", templateId: "t1", waitDays: 0 },
        { type: "followup", waitDays: 3, copy: "Hi {{name}}, just following up on my note about a free headshot talk for {{organisation}} — happy to work around your calendar. Best, Hannah" },
        { type: "followup", waitDays: 7, copy: "Hi {{name}}, last nudge on this — we've had a lovely response from other schools this term and would love to include {{organisation}}. Shall I send a couple of dates? Best, Hannah" }
      ] },
      { id: "s2", name: "Casting — series invite (+1 follow-up)", audience: "casting", steps: [
        { type: "initial", templateId: "t2", waitDays: 0 },
        { type: "followup", waitDays: 5, copy: "Hi {{name}}, following up on the casting series invite — would love to have you involved. Best, Hannah" }
      ] },
      { id: "s3", name: "Agents — series invite (+1 follow-up)", audience: "agent", steps: [
        { type: "initial", templateId: "t3", waitDays: 0 },
        { type: "followup", waitDays: 5, copy: "Hi {{name}}, circling back on the agent series invitation — happy to share more. Best, Hannah" }
      ] }
    ];
    DATA = { campaigns: ["Autumn 2026 schools", "Autumn 2026 casting", "Autumn 2026 agents"], contacts: C, templates: templates, sequences: sequences };
  }
  seed();

  /* ---------- helpers ---------- */
  function esc(s) { return UI.esc(s); }
  function contact(id) { return DATA.contacts.filter(function (c) { return c.id === id; })[0]; }
  function siblings(c) { return DATA.contacts.filter(function (x) { return x.org === c.org && x.id !== c.id; }); }
  function daysSince(iso) { if (!iso) return null; var a = new Date(iso.replace(/^-/, "") + "T00:00:00"), b = new Date(TODAY + "T00:00:00"); return Math.round((b - a) / 86400000); }
  function fmtDate(iso) { if (!iso) return "—"; var p = iso.replace(/^-/, "").split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
  function colLabel(id) { var c = COLUMNS.filter(function (x) { return x.id === id; })[0]; return c ? c.label.replace(" / no response", "") : id; }
  /* Mock: in the live tool this writes the change to the shared Google Sheet in Drive */
  function driveSaved() { UI.toast("Saved in Google Drive — sheet updated"); }
  function isStale(c) {
    if (c.status !== "contacted" && c.status !== "scheduling") return false;
    var ds = daysSince(c.last); if (ds == null || ds < 7) return false;
    if (c.status === "scheduling") return !(c.scheduling && (c.scheduling.agreed || (c.scheduling.offered || []).length));
    return !c.next;
  }

  /* ---------- state ---------- */
  var fCampaign = "all", fType = "all", fOwner = "all";
  var tab = "pipeline";
  var cSearch = "", colFilters = {}, sortKey = null, sortDir = 1;

  function pipeContacts() {
    return DATA.contacts.filter(function (c) {
      if (fCampaign !== "all" && c.campaign !== fCampaign) return false;
      if (fType !== "all" && c.type !== fType) return false;
      if (fOwner !== "all" && c.owner !== fOwner) return false;
      return true;
    });
  }
  function contactsBy(status) { return pipeContacts().filter(function (c) { return c.status === status; }); }

  /* ================= PAGE SHELL ================= */
  var TABS = [
    { id: "templates", label: "Templates & sequences", start: true },
    { id: "pipeline", label: "Pipeline" },
    { id: "contacts", label: "Contacts" },
    { id: "overview", label: "Overview" }
  ];
  api.render = function (main) {
    if (!Store.canViewPage("outreach")) { App.go("tasks"); return; }
    main.innerHTML = "";
    var head = UI.el(
      '<div class="page-head ot-head"><div>' +
      '<div class="page-title">Outreach <span class="ot-proto">Prototype</span></div>' +
      '<div class="page-sub">Track outreach to drama schools, casting directors and agents. This is a preview with dummy data — no emails are sent.</div>' +
      '<button class="ot-help" id="ot-help"><span class="ot-help-i">i</span> How to use this page</button>' +
      "</div></div>"
    );
    head.querySelector("#ot-help").onclick = openHelp;
    main.appendChild(head);
    var tabs = UI.el('<div class="ot-tabs">' + TABS.map(function (t) {
      return '<button class="ot-tab' + (tab === t.id ? " on" : "") + (t.start ? " ot-tab-start" : "") + '" data-t="' + t.id + '">' +
        (t.start ? '<span class="ot-step">1</span>' : "") + esc(t.label) + "</button>";
    }).join("") + "</div>");
    tabs.querySelectorAll(".ot-tab").forEach(function (b) { b.onclick = function () { tab = b.dataset.t; api.render(main); }; });
    main.appendChild(tabs);

    var body = UI.el('<div class="ot-body"></div>');
    main.appendChild(body);
    if (tab === "pipeline") renderPipeline(body, main);
    else if (tab === "contacts") renderContacts(body, main);
    else if (tab === "templates") renderTemplates(body, main);
    else body.appendChild(UI.el('<div class="empty ot-soon"><b>Overview</b>Coming in the next step — I’ll build this after your feedback on Pipeline and Contacts.</div>'));
  };

  /* ---------- how-to guide ---------- */
  function openHelp() {
    var sh = UI.modalShell("How to use Outreach", { wide: true });
    sh.body.innerHTML =
      '<div class="ot-help-body">' +
      '<p class="ot-help-lede">Outreach keeps everyone you’re contacting — drama schools, casting directors and agents — in one place, from first email to booked talk. It replaces the spreadsheet: no more lost dates, TRUE/FALSE ticks or notes you can’t find.</p>' +
      '<h4 class="ot-help-h">The four tabs, in the order you’ll use them</h4>' +
      '<ol class="ot-help-steps">' +
      '<li><b>Templates &amp; sequences</b> <span class="ot-help-tag">start here</span><br>Write your email and its follow-ups once. A <i>sequence</i> is your first email plus automatic nudges (say, after 3 days, then 7). You reuse these every round.</li>' +
      '<li><b>Contacts</b><br>Everyone you’re contacting — one row per person or email. Add people with <b>+ Add contact</b>, or bring in a whole spreadsheet with <b>Import CSV</b> (it even splits a cell holding several emails into separate people). Click any column heading to filter or sort.</li>' +
      '<li><b>Pipeline</b><br>The heart of it. Each contact is a card that moves left → right through the stages. <b>Drag a card</b> to move it along. Cards that have gone quiet get a ⚠ flag so you can chase them, and the <b>Scheduling</b> column has extra buttons for agreeing a date with Liv.</li>' +
      '<li><b>Overview</b><br>The headline numbers for you and Harriet: how many contacted, response rate, and talks booked and delivered.</li>' +
      '</ol>' +
      '<h4 class="ot-help-h">Running a round of outreach</h4>' +
      '<ol class="ot-help-steps ot-help-flow">' +
      '<li>Add or import your contacts in <b>Contacts</b> — they start in <b>To contact</b>.</li>' +
      '<li>Go to <b>Templates &amp; sequences → Start a send</b>: pick a sequence, choose who it goes to, preview each email, and confirm. That moves them to <b>Contacted</b>.</li>' +
      '<li>As people reply, drag their cards along the <b>Pipeline</b> until a talk is Booked and Delivered.</li>' +
      '</ol>' +
      '<div class="ot-help-note">✉︎ Emails send from <b>your own Yellowbelly Gmail</b>, and replies come back to <b>Gmail</b> as normal. This tool <b>tracks</b> the outreach — it isn’t an inbox, so there’s no reply screen here.</div>' +
      '<div class="ot-help-note">📤 <b>Sending safely:</b> to avoid bounces or being marked as spam, emails go out in small batches of up to <b>' + MAX_BATCH + ' at a time</b>, and everyone is <b>BCC’d</b> so no one ever sees anyone else’s address. If you pick more than ' + MAX_BATCH + ', they’re split into batches automatically.</div>' +
      "</div>";
    sh.foot.appendChild(btn("Got it", UI.closeModal, "primary"));
  }

  /* ================= PIPELINE ================= */
  function renderPipeline(body, main) {
    var bar = UI.el('<div class="toolbar ot-bar"></div>');
    bar.appendChild(sel("Campaign", ["all"].concat(DATA.campaigns), fCampaign, function (v) { fCampaign = v; api.render(main); }, { all: "All campaigns" }));
    bar.appendChild(sel("Type", ["all", "school", "casting", "agent"], fType, function (v) { fType = v; api.render(main); }, mergeLabels({ all: "All types" }, TYPES)));
    if (canSeeOwner()) bar.appendChild(sel("Owner", ["all"].concat(OWNERS), fOwner, function (v) { fOwner = v; api.render(main); }, { all: "All owners" }));
    bar.appendChild(UI.el('<span class="ot-bar-spacer"></span>'));
    var stale = pipeContacts().filter(isStale).length;
    if (stale) bar.appendChild(UI.el('<span class="ot-stale-count">⚠ ' + stale + ' need a nudge</span>'));
    body.appendChild(bar);

    var board = UI.el('<div class="ot-board"></div>');
    COLUMNS.forEach(function (col) {
      if (col.preContact) return;   // "To contact" lives in the Contacts tab now, not the pipeline
      var list = contactsBy(col.id);
      var column = UI.el('<div class="ot-col" data-col="' + col.id + '"><div class="ot-col-head"><span class="ot-col-name">' + esc(col.label) + '</span><span class="ot-col-n">' + list.length + '</span></div><div class="ot-col-hint">' + esc(col.hint) + '</div><div class="ot-col-body"></div></div>');
      var cb = column.querySelector(".ot-col-body");
      list.forEach(function (c) { cb.appendChild(card(c, main)); });
      column.addEventListener("dragover", function (e) { e.preventDefault(); column.classList.add("drag-over"); });
      column.addEventListener("dragleave", function () { column.classList.remove("drag-over"); });
      column.addEventListener("drop", function (e) {
        e.preventDefault(); column.classList.remove("drag-over");
        var c = contact(e.dataTransfer.getData("text/plain"));
        if (c && c.status !== col.id) {
          c.status = col.id;
          if (col.id === "scheduling" && !c.scheduling) c.scheduling = { requested: false, offered: [], agreed: "" };
          if (col.id === "closed" && !c.closedReason) c.closedReason = "No response";
          UI.toast((c.name || c.email) + " → " + col.label); driveSaved(); api.render(main);
        }
      });
      board.appendChild(column);
    });
    body.appendChild(board);
  }

  function card(c, main) {
    var ds = daysSince(c.last), stale = isStale(c);
    var big = c.name ? c.name : c.email;
    var small = c.name ? c.email : c.org;
    var el = UI.el(
      '<div class="ot-card' + (stale ? " stale" : "") + '" draggable="true">' +
      '<div class="ot-card-top"><span class="ot-type ot-type-' + c.type + '">' + esc(TYPES[c.type]) + '</span>' + (stale ? '<span class="ot-flag" title="Gone quiet — needs a nudge">⚠</span>' : "") + "</div>" +
      '<div class="ot-card-name">' + esc(big) + "</div>" +
      '<div class="ot-card-org">' + esc(small) + "</div>" +
      '<div class="ot-card-meta"><span class="ot-owner">' + (canSeeOwner() ? esc(c.owner) : esc(c.org)) + '</span><span class="ot-since">' + (ds == null ? "not contacted" : ds + "d since contact") + "</span></div>" +
      (c.next ? '<div class="ot-next"><span class="ot-next-lbl">Next</span> ' + esc(c.next) + "</div>" : (c.status === "closed" && c.closedReason ? '<div class="ot-next ot-closed"><span class="ot-next-lbl">Reason</span> ' + esc(c.closedReason) + "</div>" : "")) +
      '</div>'
    );
    if (c.status === "scheduling") el.appendChild(schedulingPanel(c, main));
    el.addEventListener("dragstart", function (e) { e.dataTransfer.setData("text/plain", c.id); el.classList.add("dragging"); });
    el.addEventListener("dragend", function () { el.classList.remove("dragging"); });
    var down = null;
    el.addEventListener("mousedown", function (e) { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener("click", function (e) {
      if (e.target.closest(".ot-sched-actions")) return;   // don't open when using scheduling buttons
      if (down && Math.abs(e.clientX - down.x) < 5 && Math.abs(e.clientY - down.y) < 5) openContact(c.id, main);
    });
    return el;
  }

  function schedulingPanel(c, main) {
    var s = c.scheduling || (c.scheduling = { requested: false, offered: [], agreed: "" });
    var wrap = UI.el('<div class="ot-sched"></div>');
    function line(done, active, txt) { return '<div class="ot-sched-step ' + (done ? "done" : active ? "active" : "") + '"><span class="ot-dot"></span>' + txt + "</div>"; }
    var offeredTxt = s.offered.length ? s.offered.map(fmtDate).join(", ") : "none yet";
    wrap.innerHTML = line(s.requested, !s.requested, "Dates requested from Liv") + line(s.offered.length, s.requested && !s.offered.length, "Dates offered: " + esc(offeredTxt)) + line(s.agreed, s.offered.length && !s.agreed, "Agreed with school: " + (s.agreed ? fmtDate(s.agreed) : "—"));
    var actions = UI.el('<div class="ot-sched-actions"></div>');
    if (!s.requested) actions.appendChild(btn("Request dates", function () { s.requested = true; UI.toast("Marked as requested from Liv"); api.render(main); }));
    else if (!s.offered.length) actions.appendChild(btn("Add offered dates", function () { s.offered = [d(-14), d(-21)]; UI.toast("Recorded 2 dates from Liv (demo)"); api.render(main); }));
    else if (!s.agreed) actions.appendChild(btn("Mark date agreed", function () { s.agreed = s.offered[0]; UI.toast("Date agreed with school"); api.render(main); }));
    else actions.appendChild(btn("Move to Booked", function () { c.status = "booked"; c.next = "Liv to deliver " + fmtDate(s.agreed); api.render(main); }));
    wrap.appendChild(actions);
    return wrap;
  }

  /* ================= CONTACTS (spreadsheet-style, header filters) ================= */
  var CCOLS = [
    { key: "org", label: "Organisation", kind: "filter", val: function (c) { return c.org; }, disp: function (v) { return v; } },
    { key: "type", label: "Type", kind: "filter", val: function (c) { return c.type; }, disp: function (v) { return TYPES[v]; } },
    { key: "name", label: "Name", kind: "sort", val: function (c) { return (c.name || "").toLowerCase(); } },
    { key: "email", label: "Email", kind: "sort", val: function (c) { return c.email.toLowerCase(); } },
    { key: "owner", label: "Owner", kind: "filter", val: function (c) { return c.owner; }, disp: function (v) { return v; }, ownerOnly: true },
    { key: "status", label: "Status", kind: "filter", val: function (c) { return c.status; }, disp: function (v) { return colLabel(v); } },
    { key: "last", label: "Last contacted", kind: "sort", val: function (c) { return c.last || ""; } }
  ];
  function cols() { return CCOLS.filter(function (c) { return !c.ownerOnly || canSeeOwner(); }); }

  function renderContacts(body, main) {
    var selected = {};       // contact id -> true (survives filter/repaint)
    var lastRows = [];       // the rows currently shown (after search + filters + sort)
    var bar = UI.el('<div class="toolbar ot-bar"></div>');
    var search = UI.el('<input class="ot-search" placeholder="Search organisation, person, email…">');
    search.value = cSearch; search.oninput = function () { cSearch = search.value; repaint(); };
    bar.appendChild(search);
    bar.appendChild(UI.el('<span class="ot-bar-spacer"></span>'));
    bar.appendChild(UI.el('<span class="ot-hint-inline">Click a column heading to filter or sort</span>'));
    var exportBtn = btn("⭳ Export", function () { exportContacts(); });
    bar.appendChild(exportBtn);
    bar.appendChild(btn("Import CSV", function () { openImport(main); }));
    bar.appendChild(btn("+ Add contact", function () { openAdd(main); }, "primary"));
    body.appendChild(bar);

    function selectedIn(list) { return list.filter(function (c) { return selected[c.id]; }); }
    function refreshExportBtn() {
      var n = selectedIn(lastRows).length;
      exportBtn.textContent = n ? "⭳ Export (" + n + ")" : "⭳ Export";
    }
    function exportContacts() {
      var chosen = selectedIn(lastRows);
      if (!chosen.length) chosen = lastRows;      // nothing ticked → export the whole filtered list
      if (!chosen.length) { UI.toast("Nothing to export"); return; }
      downloadContactsCsv(chosen);
    }

    var host = UI.el('<div class="ot-contacts"></div>');
    body.appendChild(host);

    function repaint() {
      host.innerHTML = "";
      // active filter chips
      var active = Object.keys(colFilters).filter(function (k) { return cols().some(function (c) { return c.key === k; }); });
      if (active.length || sortKey) {
        var fbar = UI.el('<div class="ot-active"></div>');
        active.forEach(function (k) {
          var cfg = CCOLS.filter(function (c) { return c.key === k; })[0];
          var chip = UI.el('<span class="ot-fchip">' + esc(cfg.label + ": " + cfg.disp(colFilters[k])) + ' <b>✕</b></span>');
          chip.onclick = function () { delete colFilters[k]; repaint(); };
          fbar.appendChild(chip);
        });
        if (sortKey) { var sc = UI.el('<span class="ot-fchip ot-fchip-sort">Sorted: ' + esc((CCOLS.filter(function (c) { return c.key === sortKey; })[0] || {}).label) + ' <b>✕</b></span>'); sc.onclick = function () { sortKey = null; repaint(); }; fbar.appendChild(sc); }
        host.appendChild(fbar);
      }

      var rows = DATA.contacts.filter(matchContact);
      if (sortKey) { var cfg = CCOLS.filter(function (c) { return c.key === sortKey; })[0]; rows = rows.slice().sort(function (a, b) { var av = cfg.val(a), bv = cfg.val(b); return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir; }); }

      lastRows = rows;
      var thead = '<th class="ot-th-check"><input type="checkbox" class="ot-check-all" title="Select all"></th>' +
        cols().map(function (c) { return '<th class="ot-th" data-k="' + c.key + '">' + esc(c.label) + ' <span class="ot-th-caret">▾</span></th>'; }).join("") + "<th></th>";
      var wrap = UI.el('<div class="table-wrap"><table class="ot-table"><thead><tr>' + thead + "</tr></thead><tbody></tbody></table></div>");
      wrap.querySelectorAll(".ot-th").forEach(function (th) { th.onclick = function (e) { e.stopPropagation(); openHeaderMenu(th, CCOLS.filter(function (c) { return c.key === th.dataset.k; })[0], repaint); }; });
      var allChk = wrap.querySelector(".ot-check-all");
      allChk.checked = rows.length > 0 && rows.every(function (c) { return selected[c.id]; });
      allChk.indeterminate = !allChk.checked && rows.some(function (c) { return selected[c.id]; });
      allChk.onchange = function () { rows.forEach(function (c) { selected[c.id] = allChk.checked; }); repaint(); };
      var tb = wrap.querySelector("tbody");
      rows.forEach(function (c) {
        var tds = '<td class="ot-td-check"><input type="checkbox"></td>' + cols().map(function (cfg) {
          if (cfg.key === "org") return '<td class="ot-cell-name">' + esc(c.org) + '<span class="ot-region">' + esc(c.region) + "</span></td>";
          if (cfg.key === "type") return '<td><span class="ot-type ot-type-' + c.type + '">' + esc(TYPES[c.type]) + "</span></td>";
          if (cfg.key === "name") return "<td>" + (c.name ? esc(c.name) + (c.jobTitle ? '<span class="ot-region">' + esc(c.jobTitle) + "</span>" : "") : '<span class="ot-muted">— unknown —</span>') + "</td>";
          if (cfg.key === "email") return '<td class="ot-email">' + esc(c.email) + "</td>";
          if (cfg.key === "owner") return "<td>" + esc(c.owner) + "</td>";
          if (cfg.key === "status") return '<td class="ot-status-cell">' + statusChip(c.status, true) + "</td>";
          if (cfg.key === "last") return "<td>" + (c.last ? fmtDate(c.last) : '<span class="ot-muted">—</span>') + "</td>";
          return "<td></td>";
        }).join("") + '<td class="ot-open">Open ›</td>';
        var tr = UI.el('<tr class="ot-row">' + tds + "</tr>");
        tr.onclick = function () { openContact(c.id, main); };
        // status chip filters the grid
        var sc = tr.querySelector(".ot-status-cell .ot-status");
        if (sc) sc.onclick = function (e) { e.stopPropagation(); colFilters.status = c.status; repaint(); };
        var rc = tr.querySelector(".ot-td-check input");
        rc.checked = !!selected[c.id];
        rc.onclick = function (e) { e.stopPropagation(); };
        rc.onchange = function () {
          selected[c.id] = rc.checked;
          refreshExportBtn();
          allChk.checked = rows.length > 0 && rows.every(function (x) { return selected[x.id]; });
          allChk.indeterminate = !allChk.checked && rows.some(function (x) { return selected[x.id]; });
        };
        tb.appendChild(tr);
      });
      host.appendChild(wrap);
      if (!rows.length) host.appendChild(UI.el('<div class="empty">No contacts match.</div>'));
      refreshExportBtn();
    }
    repaint();
  }

  /* CSV export — respects the exact rows the user filtered/selected to */
  function csvCell(v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function downloadContactsCsv(list) {
    var headers = ["Organisation", "Type", "Region", "Name", "Job title", "Email", "Phone"];
    if (canSeeOwner()) headers.push("Owner");
    headers = headers.concat(["Status", "Campaign", "Last contacted", "Next action", "Notes"]);
    var lines = [headers.map(csvCell).join(",")];
    list.forEach(function (c) {
      var row = [c.org, TYPES[c.type] || c.type, c.region, c.name || "", c.jobTitle || "", c.email, c.phone || ""];
      if (canSeeOwner()) row.push(c.owner || "");
      row = row.concat([colLabel(c.status), c.campaign || "", c.last || "", c.next || "", c.notes || ""]);
      lines.push(row.map(csvCell).join(","));
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "yellowbelly-contacts-" + list.length + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    UI.toast(list.length + " contact" + (list.length === 1 ? "" : "s") + " exported to CSV");
  }
  function matchContact(c) {
    var q = cSearch.trim().toLowerCase();
    if (q) { var hay = [c.org, c.name, c.email, c.jobTitle, c.region, c.owner].join(" ").toLowerCase(); if (hay.indexOf(q) === -1) return false; }
    var ok = true;
    Object.keys(colFilters).forEach(function (k) { var cfg = CCOLS.filter(function (c2) { return c2.key === k; })[0]; if (cfg && String(cfg.val(c)) !== String(colFilters[k])) ok = false; });
    return ok;
  }

  function openHeaderMenu(th, cfg, repaint) {
    closeMenus();
    var r = th.getBoundingClientRect();
    var items = [];
    if (cfg.kind === "filter") {
      items.push({ label: "All", on: function () { delete colFilters[cfg.key]; } });
      var vals = {}; DATA.contacts.forEach(function (c) { var v = cfg.val(c); if (v !== "" && v != null) vals[v] = true; });
      Object.keys(vals).sort().forEach(function (v) { items.push({ label: cfg.disp(v), active: String(colFilters[cfg.key]) === String(v), on: function () { colFilters[cfg.key] = v; } }); });
    } else {
      var aL = cfg.key === "last" ? "Newest first" : "A → Z", bL = cfg.key === "last" ? "Oldest first" : "Z → A";
      items.push({ label: aL, active: sortKey === cfg.key && sortDir === (cfg.key === "last" ? -1 : 1), on: function () { sortKey = cfg.key; sortDir = cfg.key === "last" ? -1 : 1; } });
      items.push({ label: bL, active: sortKey === cfg.key && sortDir === (cfg.key === "last" ? 1 : -1), on: function () { sortKey = cfg.key; sortDir = cfg.key === "last" ? 1 : -1; } });
      items.push({ label: "Clear sort", on: function () { sortKey = null; } });
    }
    var menu = UI.el('<div class="ot-hmenu">' + items.map(function (it, i) { return '<button class="ot-hmenu-item' + (it.active ? " active" : "") + '" data-i="' + i + '">' + esc(it.label) + "</button>"; }).join("") + "</div>");
    menu.style.left = Math.min(r.left, window.innerWidth - 220) + "px"; menu.style.top = (r.bottom + 4) + "px";
    document.body.appendChild(menu);
    menu.querySelectorAll(".ot-hmenu-item").forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); items[+b.dataset.i].on(); closeMenus(); repaint(); }; });
    setTimeout(function () { document.addEventListener("click", closeMenus); }, 0);
  }
  function closeMenus() { document.querySelectorAll(".ot-hmenu").forEach(function (m) { m.remove(); }); document.removeEventListener("click", closeMenus); }

  /* contact detail */
  function openContact(id, main) {
    var c = contact(id);
    var sh = UI.modalShell(c.name ? c.name : c.email, { wide: true });
    var others = siblings(c);
    sh.body.innerHTML =
      '<div class="ot-org-meta"><span class="ot-type ot-type-' + c.type + '">' + esc(TYPES[c.type]) + "</span>" + statusChip(c.status) +
      (canSeeOwner() ? '<span class="ot-chip-plain">Owner: ' + esc(c.owner) + "</span>" : "") + '<span class="ot-chip-plain">' + esc(c.campaign) + "</span></div>" +
      '<div class="ot-detail-grid">' +
      field("Organisation", c.org) + field("Region", c.region) +
      field("Name", c.name || '<span class="ot-muted">unknown</span>', true) + field("Job title", c.jobTitle || "—") +
      field("Email", '<span class="ot-email">' + esc(c.email) + "</span>", true) + field("Phone", c.phone || "—") +
      field("Last contacted", c.last ? fmtDate(c.last) : "—") + field("Next action", c.next || "—") + "</div>" +
      (c.status === "closed" ? '<div class="ot-closed-note">Closed — <b>' + esc(c.closedReason || "No response") + "</b> · won’t be re-emailed next cycle.</div>" : "") +
      '<div class="ot-org-sec"><div class="ot-sec-head"><span>Notes</span></div><div class="ot-notes">' + (c.notes ? esc(c.notes) : '<span class="ot-muted">No notes yet.</span>') + "</div></div>" +
      '<div class="ot-org-sec"><div class="ot-sec-head"><span>Others at ' + esc(c.org) + " (" + others.length + ')</span><button class="ot-find" id="ot-find">✨ Find contacts</button></div><div id="ot-find-panel"></div><div class="ot-people"></div></div>';
    var pl = sh.body.querySelector(".ot-people");
    others.forEach(function (o) { pl.appendChild(UI.el('<div class="ot-person"><div class="ot-person-main"><span class="ot-person-name">' + esc(o.name || "Unknown") + '</span><span class="ot-person-title">' + esc(o.jobTitle || "") + "</span>" + statusChip(o.status) + '</div><div class="ot-person-email">' + esc(o.email) + "</div></div>")); });
    if (!others.length) pl.appendChild(UI.el('<div class="ot-muted" style="padding:6px 0">No other contacts at this organisation yet.</div>'));
    sh.body.querySelector("#ot-find").onclick = function () {
      var panel = sh.body.querySelector("#ot-find-panel");
      if (panel.innerHTML) { panel.innerHTML = ""; return; }
      var sugg = [{ name: "Head of Acting", email: "acting@" + c.website }, { name: "Head of Musical Theatre", email: "mt@" + c.website }, { name: "Marketing & Outreach", email: "outreach@" + c.website }];
      panel.innerHTML = '<div class="ot-find-warn">⚠ These are AI suggestions for a real tool — always check before emailing. (Mocked for this prototype.)</div>' + sugg.map(function (s) { return '<div class="ot-sugg"><div><span class="ot-person-name">' + esc(s.name) + '</span><span class="ot-person-email">' + esc(s.email) + '</span></div><button class="ot-add-sugg">Add</button></div>'; }).join("");
      panel.querySelectorAll(".ot-add-sugg").forEach(function (b) { b.onclick = function () { b.textContent = "Added ✓"; b.disabled = true; }; });
    };
    sh.foot.appendChild(btn("Close", UI.closeModal, ""));
  }
  function field(label, val, raw) { return '<div class="ot-fld"><span class="ot-fld-l">' + esc(label) + '</span><span class="ot-fld-v">' + (raw ? val : esc(val)) + '</span></div>'; }

  /* campaign picker (shared by Add + Import) */
  function campaignSelectHtml(id) {
    return '<select id="' + id + '">' + DATA.campaigns.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + '<option value="__new">＋ New campaign…</option></select>';
  }
  function resolveCampaign(selEl) {
    if (selEl.value === "__new") { var name = prompt("Name the new campaign (e.g. Spring 2027 schools):"); if (name && name.trim()) { name = name.trim(); if (DATA.campaigns.indexOf(name) === -1) DATA.campaigns.push(name); return name; } return DATA.campaigns[0]; }
    return selEl.value;
  }

  function openAdd(main) {
    var sh = UI.modalShell("Add contact");
    sh.body.innerHTML =
      '<div class="field"><label>Organisation</label><input id="a-org" placeholder="e.g. Guildford School of Acting"></div>' +
      '<div class="field"><label>Type</label><select id="a-type"><option value="school">School</option><option value="casting">Casting Director</option><option value="agent">Agent</option></select></div>' +
      '<div class="field"><label>Email</label><input id="a-email" placeholder="name@school.ac.uk"></div>' +
      '<div class="field-row"><div class="field"><label>Contact name <span class="ot-opt">(optional)</span></label><input id="a-name" placeholder="Often unknown — leave blank"></div>' +
      '<div class="field"><label>Job title / dept</label><input id="a-title" placeholder="e.g. Head of Musical Theatre"></div></div>' +
      '<div class="field-row"><div class="field"><label>Phone</label><input id="a-phone"></div><div class="field"><label>Region</label><input id="a-region" placeholder="e.g. London"></div></div>' +
      '<div class="field"><label>Notes</label><textarea id="a-notes"></textarea></div>' +
      '<div class="ot-hint-box">New contacts start in <b>To contact</b>. Run a sequence from Templates &amp; sequences to email them and move them to Contacted.</div>';
    var save = btn("Add contact", function () {
      var org = sh.body.querySelector("#a-org").value.trim(), email = sh.body.querySelector("#a-email").value.trim();
      if (!org && !email) { sh.body.querySelector("#a-org").focus(); return; }
      DATA.contacts.unshift({ id: "n" + Date.now(), org: org, type: sh.body.querySelector("#a-type").value, region: sh.body.querySelector("#a-region").value.trim(), website: "", name: sh.body.querySelector("#a-name").value.trim(), jobTitle: sh.body.querySelector("#a-title").value.trim(), email: email, phone: sh.body.querySelector("#a-phone").value.trim(), owner: "Hannah", status: "to-contact", campaign: DATA.campaigns[0], last: "", next: "Send intro email", notes: sh.body.querySelector("#a-notes").value.trim() });
      UI.closeModal(); UI.toast((org || email) + " added to To contact"); driveSaved(); api.render(main);
    }, "primary");
    sh.foot.appendChild(btn("Cancel", UI.closeModal, "")); sh.foot.appendChild(save);
  }

  function openImport(main) {
    var sh = UI.modalShell("Import from spreadsheet", { wide: true });
    var SAMPLE = "School,Contact,Outreach date,Notes\nGuildford School of Acting,\"gsamarketing@gsa.surrey.ac.uk - gsaenquiries@gsa.surrey.ac.uk - p.treharne@gsa.surrey.ac.uk\",22nd Sept,Head of acting keen\nEmil Dale Academy,\"beatrice@emildale.co.uk, emil@emildale.co.uk\",22nd Sept,Setting up talk and prize\nBird College,marketing@birdcollege.co.uk,22nd Sept,";
    var step = 1, split = true;
    function draw() {
      if (step === 1) {
        sh.body.innerHTML = '<p class="ot-imp-intro">Paste your existing sheet (or a few rows) — headers on the first line. These become a batch of <b>To contact</b> records for the campaign you choose.</p>' +
          '<div class="field" style="max-width:320px"><label>Add to campaign</label>' + campaignSelectHtml("imp-camp") + "</div><textarea id=\"imp-text\" class=\"ot-imp-text\"></textarea>";
        sh.body.querySelector("#imp-text").value = SAMPLE;
        sh.foot.innerHTML = ""; sh.foot.appendChild(btn("Cancel", UI.closeModal, ""));
        sh.foot.appendChild(btn("Next: map columns", function () { window._impText = sh.body.querySelector("#imp-text").value; window._impCamp = resolveCampaign(sh.body.querySelector("#imp-camp")); step = 2; draw(); }, "primary"));
      } else if (step === 2) {
        var lines = (window._impText || "").trim().split(/\n/), headers = splitCsv(lines[0] || "");
        var targets = ["— skip —", "Organisation", "Email(s)", "Contact name", "Job title", "Outreach date", "Phone", "Region", "Notes"];
        var guess = { school: "Organisation", contact: "Email(s)", "outreach date": "Outreach date", notes: "Notes" };
        sh.body.innerHTML = '<p class="ot-imp-intro">Map each column to a field. Detected <b>' + (lines.length - 1) + '</b> rows → campaign <b>' + esc(window._impCamp) + '</b>.</p><div class="ot-map">' +
          headers.map(function (h, i) { var g = guess[h.trim().toLowerCase()] || "— skip —"; return '<div class="ot-map-row"><span class="ot-map-from">' + esc(h) + '</span><span class="ot-map-arrow">→</span><select data-i="' + i + '" class="ot-map-sel">' + targets.map(function (t) { return "<option" + (t === g ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select></div>"; }).join("") +
          '</div><label class="ot-split"><input type="checkbox" id="imp-split"' + (split ? " checked" : "") + "> Split cells with multiple emails into separate contacts (recommended)</label>";
        sh.foot.innerHTML = ""; sh.foot.appendChild(btn("Back", function () { step = 1; draw(); }, ""));
        sh.foot.appendChild(btn("Next: preview", function () { var m = {}; sh.body.querySelectorAll(".ot-map-sel").forEach(function (s) { m[s.dataset.i] = s.value; }); window._impMap = m; split = sh.body.querySelector("#imp-split").checked; step = 3; draw(); }, "primary"));
      } else {
        var parsed = parseImport(window._impText, window._impMap, split);
        var total = parsed.reduce(function (n, o) { return n + o.emails.length; }, 0);
        sh.body.innerHTML = '<p class="ot-imp-intro">Preview — creates <b>' + total + '</b> contact(s) across <b>' + parsed.length + '</b> organisation(s), all landing in <b>To contact</b> for <b>' + esc(window._impCamp) + '</b>.</p><div class="ot-imp-prev">' + parsed.map(function (o) { return '<div class="ot-imp-card"><div class="ot-person-name">' + esc(o.name || "(no org)") + "</div>" + o.emails.map(function (e) { return '<div class="ot-person-email">' + esc(e) + "</div>"; }).join("") + (o.date ? '<div class="ot-imp-tag">date: ' + esc(o.date) + "</div>" : "") + "</div>"; }).join("") + "</div>";
        sh.foot.innerHTML = ""; sh.foot.appendChild(btn("Back", function () { step = 2; draw(); }, ""));
        sh.foot.appendChild(btn("Import " + total + " contacts", function () {
          parsed.forEach(function (o) { o.emails.forEach(function (em) { DATA.contacts.unshift({ id: "i" + Date.now() + Math.random().toString(36).slice(2, 5), org: o.name, type: "school", region: o.region || "", website: "", name: "", jobTitle: "", email: em, phone: "", owner: "Hannah", status: "to-contact", campaign: window._impCamp, last: "", next: "Send intro email", notes: o.notes || "" }); }); });
          UI.closeModal(); UI.toast(total + " contacts imported to To contact"); driveSaved(); api.render(main);
        }, "primary"));
      }
    }
    draw();
  }

  /* ================= TEMPLATES & SEQUENCES ================= */
  function template(id) { return DATA.templates.filter(function (t) { return t.id === id; })[0]; }
  function sequence(id) { return DATA.sequences.filter(function (s) { return s.id === id; })[0]; }
  function mergeFields(text, c) { return String(text).replace(/\{\{\s*name\s*\}\}/g, c.name || "there").replace(/\{\{\s*organisation\s*\}\}/g, c.org).replace(/\{\{\s*jobTitle\s*\}\}/g, c.jobTitle || "the team"); }

  function renderTemplates(body, main) {
    var intro = UI.el('<div class="ot-tpl-intro"><div><div class="ot-tpl-h">Set up your outreach here</div><div class="ot-tpl-sub">Write a template, build a follow-up sequence, then send it to a batch of contacts. New contacts you add or import start in <b>To contact</b> — running a sequence moves them to <b>Contacted</b>.</div></div><button class="btn btn-ot">▶ Start a send</button></div>');
    intro.querySelector("button").onclick = function () { openSend(main); };
    body.appendChild(intro);
    body.appendChild(UI.el('<div class="ot-gmail-note">✉︎ Emails go out from <b>your Yellowbelly Gmail</b>, and replies come back to <b>Gmail</b> as normal. This tool tracks the outreach — it isn’t an inbox, so there’s no reply screen here.</div>'));

    var tsec = UI.el('<div class="ot-sec2"><div class="ot-sec2-head"><h3>Email templates</h3></div><div class="ot-tpl-groups"></div></div>');
    var groups = tsec.querySelector(".ot-tpl-groups");
    ["school", "casting", "agent"].forEach(function (aud) {
      var list = DATA.templates.filter(function (t) { return t.audience === aud; });
      if (!list.length) return;
      var g = UI.el('<div class="ot-tpl-group"><div class="ot-tpl-group-h">' + esc(TYPES[aud]) + 's</div><div class="ot-tpl-cards"></div></div>');
      var cw = g.querySelector(".ot-tpl-cards");
      list.forEach(function (t) {
        var card = UI.el('<div class="ot-tpl-card"><div class="ot-tpl-name">' + esc(t.name) + '</div><div class="ot-tpl-subj">' + esc(t.subject) + '</div><div class="ot-tpl-snip">' + esc(t.body.replace(/\n+/g, " ").slice(0, 96)) + '…</div></div>');
        card.onclick = function () { openTemplate(t.id, main); };
        cw.appendChild(card);
      });
      groups.appendChild(g);
    });
    body.appendChild(tsec);

    var ssec = UI.el('<div class="ot-sec2"><div class="ot-sec2-head"><h3>Sequences</h3></div><div class="ot-seq-cards"></div></div>');
    var sw = ssec.querySelector(".ot-seq-cards");
    DATA.sequences.forEach(function (s) {
      var card = UI.el('<div class="ot-seq-card"><div class="ot-tpl-name">' + esc(s.name) + '</div><div class="ot-seq-meta"><span class="ot-type ot-type-' + s.audience + '">' + esc(TYPES[s.audience]) + '</span> · ' + s.steps.length + ' step' + (s.steps.length > 1 ? "s" : "") + '</div><div class="ot-seq-mini"></div></div>');
      var mini = card.querySelector(".ot-seq-mini");
      s.steps.forEach(function (step, i) { mini.appendChild(UI.el('<span class="ot-seq-chip">' + (step.type === "initial" ? "Initial email" : "Follow-up " + i) + (step.waitDays ? " · +" + step.waitDays + "d" : "") + '</span>')); if (i < s.steps.length - 1) mini.appendChild(UI.el('<span class="ot-seq-arrow">→</span>')); });
      card.onclick = function () { openSequence(s.id, main); };
      sw.appendChild(card);
    });
    body.appendChild(ssec);
  }

  function openTemplate(id, main) {
    var t = template(id);
    var sh = UI.modalShell(t.name, { wide: true });
    sh.modal.classList.add("ot-tpl-modal");
    sh.body.innerHTML =
      '<div class="ot-org-meta"><span class="ot-type ot-type-' + t.audience + '">' + esc(TYPES[t.audience]) + '</span></div>' +
      '<div class="field"><label>Template name</label><input type="text" id="tp-name" value="' + esc(t.name) + '"></div>' +
      '<div class="field"><label>Subject</label><input type="text" id="tp-subj" value="' + esc(t.subject) + '"></div>' +
      '<div class="field"><label>Body</label><textarea id="tp-body" class="ot-tpl-body-edit">' + esc(t.body) + '</textarea></div>' +
      '<div class="ot-merge">Merge fields: <code>{{name}}</code> <code>{{organisation}}</code> <code>{{jobTitle}}</code> — filled in per contact when you send.</div>';
    var save = btn("Save template", function () { t.name = sh.body.querySelector("#tp-name").value; t.subject = sh.body.querySelector("#tp-subj").value; t.body = sh.body.querySelector("#tp-body").value; UI.closeModal(); UI.toast("Template saved"); api.render(main); }, "primary");
    sh.foot.appendChild(btn("Cancel", UI.closeModal, "")); sh.foot.appendChild(save);
  }

  function openSequence(id, main) {
    var s = sequence(id);
    var sh = UI.modalShell(s.name, { wide: true });
    sh.modal.classList.add("ot-tpl-modal");
    function draw() {
      sh.body.innerHTML =
        '<div class="ot-org-meta"><span class="ot-type ot-type-' + s.audience + '">' + esc(TYPES[s.audience]) + '</span></div>' +
        '<div class="field"><label>Sequence name</label><input type="text" id="sq-name" value="' + esc(s.name) + '"></div>' +
        '<div class="ot-steps"></div><button class="btn btn-sm btn-ghost" id="sq-add">+ Add follow-up</button>';
      var stepsEl = sh.body.querySelector(".ot-steps");
      s.steps.forEach(function (step, i) {
        var stepEl = UI.el('<div class="ot-step"><div class="ot-step-dot">' + (i + 1) + '</div><div class="ot-step-body"></div></div>');
        var sb = stepEl.querySelector(".ot-step-body");
        if (i > 0) sb.appendChild(UI.el('<div class="ot-step-wait">Wait <input type="number" min="0" class="ot-wait" value="' + step.waitDays + '"> days, then send:</div>'));
        if (step.type === "initial") {
          var tpl = template(step.templateId);
          sb.appendChild(UI.el('<div class="ot-step-title">Initial email</div><div class="ot-step-tpl">Uses template: <b>' + esc(tpl ? tpl.name : "—") + '</b></div>'));
        } else {
          sb.appendChild(UI.el('<div class="ot-step-title">Follow-up ' + i + '</div>'));
          var ta = UI.el('<textarea class="ot-step-copy">' + esc(step.copy || "") + '</textarea>');
          sb.appendChild(ta);
          var rm = UI.el('<button class="ot-step-rm">Remove step</button>');
          rm.onclick = function () { s.steps.splice(i, 1); draw(); };
          sb.appendChild(rm);
        }
        var w = stepEl.querySelector(".ot-wait"); if (w) w.onchange = function () { step.waitDays = +w.value || 0; };
        var cc = stepEl.querySelector(".ot-step-copy"); if (cc) cc.onchange = function () { step.copy = cc.value; };
        stepsEl.appendChild(stepEl);
      });
      sh.body.querySelector("#sq-add").onclick = function () { s.steps.push({ type: "followup", waitDays: 5, copy: "Hi {{name}}, just following up…" }); draw(); };
    }
    draw();
    sh.foot.appendChild(btn("Cancel", UI.closeModal, ""));
    sh.foot.appendChild(btn("Save sequence", function () { s.name = sh.body.querySelector("#sq-name").value; UI.closeModal(); UI.toast("Sequence saved"); api.render(main); }, "primary"));
  }

  /* send flow — preview only, never sends */
  function openSend(main) {
    var sh = UI.modalShell("Start a send", { wide: true });
    var st = { seqId: null, selected: {}, step: 1, previewIdx: 0 };
    function recipients() { var s = sequence(st.seqId); return DATA.contacts.filter(function (c) { return c.status === "to-contact" && c.type === s.audience; }); }
    function chosen() { return recipients().filter(function (c) { return st.selected[c.id]; }); }
    function draw() {
      if (st.step === 1) {
        sh.body.innerHTML = '<p class="ot-imp-intro">Pick a sequence. Contacts sitting in <b>To contact</b> for that audience become the recipients.</p><div class="ot-send-seqs"></div>';
        var w = sh.body.querySelector(".ot-send-seqs");
        DATA.sequences.forEach(function (s) {
          var n = DATA.contacts.filter(function (c) { return c.status === "to-contact" && c.type === s.audience; }).length;
          var card = UI.el('<div class="ot-send-seq' + (st.seqId === s.id ? " on" : "") + '"><div class="ot-tpl-name">' + esc(s.name) + '</div><div class="ot-seq-meta"><span class="ot-type ot-type-' + s.audience + '">' + esc(TYPES[s.audience]) + '</span> · ' + s.steps.length + ' steps · <b>' + n + '</b> in To contact</div></div>');
          card.onclick = function () { st.seqId = s.id; draw(); };
          w.appendChild(card);
        });
        sh.foot.innerHTML = ""; sh.foot.appendChild(btn("Cancel", UI.closeModal, ""));
        sh.foot.appendChild(btn("Next: choose recipients", function () { if (!st.seqId) { UI.toast("Pick a sequence"); return; } recipients().forEach(function (c) { st.selected[c.id] = true; }); st.step = 2; draw(); }, "primary"));
      } else if (st.step === 2) {
        var recs = recipients();
        sh.body.innerHTML = '<p class="ot-imp-intro">Choose who this goes to — ' + recs.length + ' in To contact for this audience.</p>' +
          '<div class="ot-batch-note">📤 Everyone is <b>BCC’d</b> (no one sees anyone else), and sends go out in batches of up to <b>' + MAX_BATCH + '</b> to avoid bounces.</div><div class="ot-send-recs"></div>';
        var w = sh.body.querySelector(".ot-send-recs");
        recs.forEach(function (c) {
          var row = UI.el('<label class="ot-send-rec"><input type="checkbox"' + (st.selected[c.id] ? " checked" : "") + '><span class="ot-person-name">' + esc(c.name || c.email) + '</span><span class="ot-person-title">' + esc(c.org) + '</span></label>');
          row.querySelector("input").onchange = function (e) { st.selected[c.id] = e.target.checked; };
          w.appendChild(row);
        });
        if (!recs.length) w.appendChild(UI.el('<div class="ot-muted" style="padding:8px 0">Nothing in To contact for this audience yet — add or import some contacts first.</div>'));
        sh.foot.innerHTML = ""; sh.foot.appendChild(btn("Back", function () { st.step = 1; draw(); }, ""));
        sh.foot.appendChild(btn("Next: preview", function () { if (!chosen().length) { UI.toast("Select at least one"); return; } st.previewIdx = 0; st.step = 3; draw(); }, "primary"));
      } else if (st.step === 3) {
        var s = sequence(st.seqId), recs = chosen(), c = recs[st.previewIdx] || recs[0];
        var initial = template(s.steps[0].templateId);
        sh.body.innerHTML =
          '<div class="ot-send-prevbar">Previewing for <select id="prev-sel">' + recs.map(function (r, i) { return '<option value="' + i + '"' + (i === st.previewIdx ? " selected" : "") + '>' + esc((r.name || r.email) + " — " + r.org) + '</option>'; }).join("") + '</select> · <b>' + recs.length + '</b> recipients, each personalised.</div>' +
          '<div class="ot-email"><div class="ot-email-h"><b>To:</b> ' + esc(c.email) + '</div><div class="ot-email-h"><b>Subject:</b> ' + esc(mergeFields(initial.subject, c)) + '</div><div class="ot-email-body">' + esc(mergeFields(initial.body, c)) + '</div></div>' +
          '<div class="ot-sec2-head" style="margin-top:16px"><h3>Then, if no reply</h3></div><div class="ot-fups"></div>';
        var fw = sh.body.querySelector(".ot-fups");
        s.steps.slice(1).forEach(function (step) { fw.appendChild(UI.el('<div class="ot-fup"><div class="ot-fup-when">+' + step.waitDays + ' days</div><div class="ot-email-body ot-fup-body">' + esc(mergeFields(step.copy || "", c)) + '</div></div>')); });
        sh.body.querySelector("#prev-sel").onchange = function (e) { st.previewIdx = +e.target.value; draw(); };
        sh.foot.innerHTML = ""; sh.foot.appendChild(btn("Back", function () { st.step = 2; draw(); }, ""));
        sh.foot.appendChild(btn("Continue", function () { st.step = 4; draw(); }, "primary"));
      } else {
        var recs = chosen();
        sh.body.innerHTML =
          '<div class="ot-send-done"><div class="ot-send-count">' + recs.length + '</div><div class="ot-send-count-l">recipients ready · ' + Math.ceil(recs.length / MAX_BATCH) + ' batch' + (Math.ceil(recs.length / MAX_BATCH) > 1 ? "es" : "") + ' of up to ' + MAX_BATCH + ', all BCC’d</div>' +
          '<div class="ot-preview-only">✋ Preview only — <b>nothing was sent.</b> In the real tool, this is where the sequence would go out from your Gmail — BCC’d, in batches of ' + MAX_BATCH + ', so nothing bounces.</div>' +
          '<div class="ot-gmail-note" style="margin-top:12px">Replies come back to <b>your Gmail</b>, not here — the tool just tracks the outreach.</div></div>';
        sh.foot.innerHTML = ""; sh.foot.appendChild(btn("Back", function () { st.step = 3; draw(); }, ""));
        sh.foot.appendChild(btn("Log as contacted →", function () { recs.forEach(function (c) { c.status = "contacted"; c.last = TODAY; c.next = "Awaiting reply"; }); UI.closeModal(); UI.toast(recs.length + " moved to Contacted (nothing was emailed)"); driveSaved(); api.render(main); }, "primary"));
      }
    }
    draw();
  }

  /* ---------- utils ---------- */
  function splitCsv(line) { var out = [], cur = "", q = false; for (var i = 0; i < line.length; i++) { var ch = line[i]; if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out.map(function (s) { return s.trim(); }); }
  function parseImport(text, map, split) {
    var lines = (text || "").trim().split(/\n/), idx = {}; Object.keys(map || {}).forEach(function (i) { idx[map[i]] = +i; });
    var out = [];
    lines.slice(1).forEach(function (ln) { if (!ln.trim()) return; var cells = splitCsv(ln);
      var name = idx["Organisation"] != null ? cells[idx["Organisation"]] : "";
      var emailCell = idx["Email(s)"] != null ? cells[idx["Email(s)"]] : "";
      var emails = split ? emailCell.split(/[,;]|\s-\s|\s\/\s|\s+/).map(function (s) { return s.trim(); }).filter(function (s) { return /@/.test(s); }) : (emailCell && /@/.test(emailCell) ? [emailCell.trim()] : []);
      out.push({ name: name, emails: emails, date: idx["Outreach date"] != null ? cells[idx["Outreach date"]] : "", notes: idx["Notes"] != null ? cells[idx["Notes"]] : "", region: idx["Region"] != null ? cells[idx["Region"]] : "" });
    });
    return out;
  }
  function statusChip(id, clickable) { return '<span class="ot-status ot-status-' + id + (clickable ? " ot-status-click" : "") + '"' + (clickable ? ' title="Filter by this status"' : "") + ">" + esc(colLabel(id)) + "</span>"; }
  function colLabels() { var m = {}; COLUMNS.forEach(function (c) { m[c.id] = c.label; }); return m; }
  function mergeLabels(a, b) { Object.keys(b).forEach(function (k) { a[k] = b[k]; }); return a; }
  function sel(title, values, current, onChange, labels) { var s = UI.el('<select class="filter-select ot-sel" title="' + esc(title) + '"></select>'); s.innerHTML = values.map(function (v) { return '<option value="' + esc(v) + '"' + (v === current ? " selected" : "") + ">" + esc((labels && labels[v]) || v) + "</option>"; }).join(""); s.onchange = function () { onChange(s.value); }; return s; }
  function btn(label, onClick, kind) { var b = UI.el('<button class="btn ' + (kind === "primary" ? "btn-ot" : "btn-sm btn-ghost") + '">' + esc(label) + "</button>"); b.onclick = onClick; return b; }

  return api;
})();
