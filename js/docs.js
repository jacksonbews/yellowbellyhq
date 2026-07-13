/* ================================================================
   YELLOW BELLY HQ — Company Docs page
   Only the Ownership tiers (owner-dev + owner) can add sections,
   upload, delete, assign, and control who sees each file. A file is
   either visible to Everyone or Restricted to specific people (plus
   owners, the uploader, and anyone it's assigned to).
   ================================================================ */

var Docs = (function () {
  var api = {};

  api.render = function (main) {
    var isAdmin = Store.canEditDocs();
    var sections = Store.docSections();
    var me = Store.me();
    /* non-owners only ever see documents shared with them */
    var docs = Store.docs().filter(function (d) { return Store.canSeeDoc(d, me); });

    main.innerHTML = "";
    var head = UI.el(
      '<div class="page-head">' +
      '  <div><div class="page-title">Company Docs<span class="count">( ' + docs.length + " )</span></div>" +
      '  <div class="page-sub">' + (isAdmin
        ? "You can add sections, upload PDFs, control who sees each file, and assign them."
        : "Company handbooks and guidelines. Docs assigned to you appear at the top.") + "</div></div>" +
      (isAdmin ? '<div class="page-actions"><button class="btn btn-yellow" id="btn-add-section">+ Add section</button></div>' : "") +
      "</div>"
    );
    if (isAdmin) head.querySelector("#btn-add-section").onclick = addSection;
    main.appendChild(head);

    /* company core values — visible to everyone at the top of the page */
    main.appendChild(coreValuesPanel());

    /* docs assigned to me */
    var mine = docs.filter(function (d) { return d.assigneeIds.indexOf(me.id) !== -1; });
    if (mine.length) {
      var banner = UI.el('<div class="assigned-banner"><b>Assigned to you</b><div></div></div>');
      var inner = banner.querySelector("div:last-child");
      mine.forEach(function (d, i) {
        var link = UI.el('<span class="doc-link">' + UI.esc(d.name) + "</span>");
        link.onclick = function () { openDoc(d); };
        if (i) inner.appendChild(document.createTextNode("  ·  "));
        inner.appendChild(link);
      });
      main.appendChild(banner);
    }

    if (!sections.length) {
      main.appendChild(UI.el('<div class="empty"><b>No sections yet</b>' + (isAdmin ? "Add your first section to start uploading docs." : "Nothing here yet.") + "</div>"));
      return;
    }

    sections.forEach(function (s) {
      main.appendChild(sectionBlock(s, docs.filter(function (d) { return d.sectionId === s.id; }), isAdmin));
    });
  };

  /* the six company core values — a condensed quick-view at the top of
     Company Docs. `tag` is the at-a-glance line; `lines` is the full copy
     (kept for the hover tooltip so nothing is lost). */
  var CORE_VALUES = [
    { name: "Premium", tag: "Excellence in everything", lines: [
      "We deliver excellence in everything we do.",
      "We take pride in every detail of our work and strive at every opportunity to create the best possible experience for clients.",
      "We go above and beyond at every stage."
    ] },
    { name: "Creativity", tag: "At the heart of our work", lines: [
      "Creativity sits at the heart of our company and all the work we do.",
      "We are inspired by the world around us, the people we employ and our clients, and are constantly driving ourselves to evolve.",
      "We embrace innovative ways of thinking, new ideas and are passionate about our product."
    ] },
    { name: "Authenticity", tag: "Be real", lines: [
      "Be real.",
      "Authenticity builds trust. We always communicate honestly, show up as ourselves, and celebrate individuality.",
      "Our goal is to help every client feel like the best version of themselves."
    ] },
    { name: "Inclusive", tag: "Everyone heard and valued", lines: [
      "We listen, collaborate, and create an environment where everyone feels respected and heard.",
      "Our work is built on trust and teamwork. We celebrate our differences as one of our greatest strengths.",
      "Every client and colleague should feel welcome, supported, valued at every opportunity and part of the YellowBelly community."
    ] },
    { name: "Innovation", tag: "Grow, improve, evolve", lines: [
      "We are always looking to grow, improve, and evolve.",
      "From our work to our processes, we constantly push forward to be better."
    ] },
    { name: "Consistency", tag: "One high standard", lines: [
      "We maintain a high and consistent standard across everything we do.",
      "Across every location and every team, we stay true to who we are and what we represent."
    ] }
  ];

  function coreValuesPanel() {
    var panel = UI.el(
      '<div class="core-values">' +
      '  <div class="cv-head">Our Core Values</div>' +
      '  <div class="cv-row"></div>' +
      "</div>"
    );
    var row = panel.querySelector(".cv-row");
    CORE_VALUES.forEach(function (v, i) {
      var num = (i + 1 < 10 ? "0" : "") + (i + 1);
      var tile = UI.el(
        '<div class="cv-tile" title="' + UI.esc(v.lines.join("\n")) + '">' +
        '  <span class="cv-num">' + num + "</span>" +
        '  <div class="cv-name">' + UI.esc(v.name) + "</div>" +
        '  <div class="cv-tag">' + UI.esc(v.tag) + "</div>" +
        "</div>"
      );
      row.appendChild(tile);
    });
    return panel;
  }

  function sectionBlock(section, docs, isAdmin) {
    var block = UI.el(
      '<div class="section-block">' +
      '  <div class="section-head">' +
      '    <span class="section-name">' + UI.esc(section.name) +
      '    <span class="section-count">( ' + docs.length + " )</span></span>" +
      '    <span class="section-actions"></span>' +
      "  </div>" +
      '  <div class="section-docs"></div>' +
      "</div>"
    );

    if (isAdmin) {
      var actions = block.querySelector(".section-actions");

      var upload = UI.el('<button class="btn btn-sm btn-yellow">↑ Upload PDF</button>');
      var fileInput = UI.el('<input type="file" accept="application/pdf,.pdf" multiple style="display:none">');
      upload.onclick = function () { fileInput.click(); };
      fileInput.onchange = function () {
        var files = Array.prototype.slice.call(fileInput.files);
        var pdfs = files.filter(function (f) { return /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name); });
        if (!pdfs.length) { UI.toast("Please choose PDF files"); return; }
        Promise.all(pdfs.map(function (f) { return Store.uploadDoc(section.id, f); }))
          .then(function () { UI.toast(pdfs.length + " PDF" + (pdfs.length > 1 ? "s" : "") + " uploaded"); })
          .catch(function (e) { console.error(e); UI.toast("Upload failed — try again"); });
      };
      actions.appendChild(upload);
      actions.appendChild(fileInput);

      var rename = UI.el('<button class="btn btn-sm btn-ghost">Rename</button>');
      rename.onclick = function () { renameSection(section); };
      actions.appendChild(rename);

      var del = UI.el('<button class="btn btn-sm btn-ghost">Delete</button>');
      del.onclick = function () {
        UI.confirm("Delete section?",
          "“" + section.name + "”" + (docs.length ? " and its " + docs.length + " document(s)" : "") + " will be removed.",
          "Delete section"
        ).then(function (ok) { if (ok) Store.deleteSection(section.id).then(function () { UI.toast("Section deleted"); }); });
      };
      actions.appendChild(del);
    }

    var docsEl = block.querySelector(".section-docs");
    if (!docs.length) {
      docsEl.appendChild(UI.el('<div class="docs-empty-row">No documents in this section yet.</div>'));
    }
    docs.sort(function (a, b) { return b.uploadedAt - a.uploadedAt; }).forEach(function (d) {
      docsEl.appendChild(docRow(d, isAdmin));
    });
    return block;
  }

  function docRow(d, isAdmin) {
    var by = Store.member(d.uploadedBy);
    var chips = d.assigneeIds.slice(0, 6).map(function (id) { return UI.avatar(Store.member(id), "sm"); }).join("");
    var restricted = (d.visibility || "everyone") === "restricted";
    var seers = restricted ? ((d.viewerIds || []).length + (d.assigneeIds || []).filter(function (id) { return (d.viewerIds || []).indexOf(id) === -1; }).length) : 0;
    var row = UI.el(
      '<div class="doc-row">' +
      '  <span class="doc-icon">PDF</span>' +
      '  <div class="doc-main">' +
      '    <div class="doc-name">' + UI.esc(d.name) +
      (restricted ? ' <span class="chip doc-restricted" title="Only specific people can see this">Restricted</span>' : "") + "</div>" +
      '    <div class="doc-sub">' + UI.prettySize(d.size) + " · uploaded by " + UI.esc(by ? by.name : "?") +
      ' · <span title="' + UI.esc(UI.absTime(d.uploadedAt, by ? by.city : null)) + '">' + UI.timeAgo(d.uploadedAt) + "</span>" +
      (restricted && isAdmin ? " · visible to " + seers + " " + (seers === 1 ? "person" : "people") : "") + "</div>" +
      "  </div>" +
      '  <span class="doc-assignees">' + chips + (d.assigneeIds.length > 6 ? " +" + (d.assigneeIds.length - 6) : "") + "</span>" +
      '  <span class="doc-actions"></span>' +
      "</div>"
    );
    var actions = row.querySelector(".doc-actions");

    var view = UI.el('<button class="btn btn-sm">Open</button>');
    view.onclick = function () { openDoc(d); };
    actions.appendChild(view);

    if (isAdmin) {
      var vis = UI.el('<button class="btn btn-sm btn-ghost">Who can see</button>');
      vis.onclick = function () { visibilityDoc(d); };
      actions.appendChild(vis);

      var del = UI.el('<button class="btn btn-sm btn-ghost" title="Delete">✕</button>');
      del.onclick = function () {
        UI.confirm("Delete document?", "“" + d.name + "” will be removed for everyone.", "Delete PDF")
          .then(function (ok) { if (ok) Store.deleteDoc(d.id).then(function () { UI.toast("Document deleted"); }); });
      };
      actions.appendChild(del);
    }
    return row;
  }

  function openDoc(d) {
    Store.getDocUrl(d).then(function (url) {
      if (!url) { UI.toast("File not found in this browser"); return; }
      window.open(url, "_blank");
    });
  }

  function addSection() {
    var sh = UI.modalShell("Add section");
    sh.body.innerHTML = '<div class="field"><label>Section name</label><input type="text" id="sec-name" placeholder="e.g. Health & Safety" maxlength="60"></div>';
    var save = UI.el('<button class="btn btn-primary">Add section</button>');
    save.onclick = function () {
      var name = sh.body.querySelector("#sec-name").value.trim();
      if (!name) return;
      Store.addSection(name).then(function () { UI.closeModal(); UI.toast("Section added"); });
    };
    sh.foot.appendChild(save);
  }

  function renameSection(section) {
    var sh = UI.modalShell("Rename section");
    sh.body.innerHTML = '<div class="field"><label>Section name</label><input type="text" id="sec-name" maxlength="60"></div>';
    var inp = sh.body.querySelector("#sec-name");
    inp.value = section.name;
    var save = UI.el('<button class="btn btn-primary">Save</button>');
    save.onclick = function () {
      var name = inp.value.trim();
      if (!name) return;
      Store.renameSection(section.id, name).then(function () { UI.closeModal(); });
    };
    sh.foot.appendChild(save);
  }

  function visibilityDoc(d) {
    var visibility = (d.visibility || "everyone");
    var selected = (d.viewerIds || []).slice();
    var sh = UI.modalShell("Who can see “" + d.name + "”");
    sh.body.innerHTML =
      '<div class="field"><label>Visibility</label><div id="doc-vis"></div></div>' +
      '<div class="field" id="doc-vis-people-wrap"><label>People who can see it</label><div id="doc-vis-people"></div>' +
      '<div class="hint">You and the other Ownership members can always see every file. The uploader keeps access too.</div></div>';

    var peopleWrap = sh.body.querySelector("#doc-vis-people-wrap");
    function syncPeople() { peopleWrap.classList.toggle("hidden", visibility !== "restricted"); }

    sh.body.querySelector("#doc-vis").appendChild(UI.segRadios(
      [{ id: "everyone", label: "Everyone on the team" }, { id: "restricted", label: "Only specific people" }],
      visibility, function (v) { visibility = v; syncPeople(); }
    ));
    sh.body.querySelector("#doc-vis-people").appendChild(UI.peopleSelect(selected, {}));
    syncPeople();

    var cancel = UI.el('<button class="btn btn-ghost">Cancel</button>');
    cancel.onclick = UI.closeModal;
    var save = UI.el('<button class="btn btn-primary">Save visibility</button>');
    save.onclick = function () {
      Store.setDocVisibility(d.id, visibility, selected.slice()).then(function () {
        UI.closeModal();
        UI.toast(visibility === "everyone" ? "Visible to everyone" : "Visibility updated");
      });
    };
    sh.foot.appendChild(cancel); sh.foot.appendChild(save);
  }

  function assignDoc(d) {
    var selected = d.assigneeIds.slice();
    var sh = UI.modalShell("Assign “" + d.name + "”");
    sh.body.innerHTML = '<div class="field"><label>Assign to</label><div id="doc-assign"></div>' +
      '<div class="hint">Assigned people get a notification and see this doc pinned at the top of Company Docs.</div></div>';
    sh.body.querySelector("#doc-assign").appendChild(UI.peopleSelect(selected, {}));
    var save = UI.el('<button class="btn btn-primary">Save assignments</button>');
    save.onclick = function () {
      Store.assignDoc(d.id, selected.slice()).then(function () {
        UI.closeModal(); UI.toast("Assignments saved");
      });
    };
    sh.foot.appendChild(save);
  }

  return api;
})();
