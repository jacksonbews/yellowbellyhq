/* ================================================================
   YELLOW BELLY HQ — Settings page
   Team management (add/remove people, titles, departments, access
   levels), access-level reference, and app connections.
   Visible to Ownership & Developer + Ownership.
   Editable by Ownership & Developer only.
   ================================================================ */

var Settings = (function () {
  var api = {};

  api.render = function (main) {
    if (!Store.canViewSettings()) { App.go("tasks"); return; }
    var canEdit = Store.canManageTeam();
    var canAddRemove = Store.canAddRemoveMembers();
    var me = Store.me();
    var team = Store.team();

    main.innerHTML = "";
    main.appendChild(UI.el(
      '<div class="page-head">' +
      '  <div><div class="page-title">Settings</div>' +
      '  <div class="page-sub">' + (canEdit
        ? "Manage the team, access levels and app connections."
        : canAddRemove
          ? "Add or remove team members. Access levels &amp; connections are set by Ownership &amp; Developer."
          : "Read-only view.") + "</div></div>" +
      "</div>"
    ));

    /* ============ TEAM MANAGEMENT ============ */
    var teamSec = UI.el(
      '<div class="st-section">' +
      '  <div class="section-head">' +
      '    <span class="section-name">Team Management <span class="section-count">( ' + team.length + " )</span></span>" +
      '    <span class="section-actions"></span>' +
      "  </div>" +
      '  <div class="st-rows"></div>' +
      "</div>"
    );
    if (canAddRemove) {
      var addBtn = UI.el('<button class="btn btn-sm btn-yellow">+ Add member</button>');
      addBtn.onclick = addMemberModal;
      teamSec.querySelector(".section-actions").appendChild(addBtn);
    }
    var rowsEl = teamSec.querySelector(".st-rows");
    team.forEach(function (m) { rowsEl.appendChild(memberRow(m, canEdit, canAddRemove, me)); });
    main.appendChild(teamSec);

    /* ============ ACCESS LEVELS ============ */
    var lvlSec = UI.el(
      '<div class="st-section">' +
      '  <div class="section-head"><span class="section-name">Access Levels</span></div>' +
      '  <div class="st-rows" id="lvl-rows"></div>' +
      "</div>"
    );
    var lvlRows = lvlSec.querySelector("#lvl-rows");
    ROLES.forEach(function (r) {
      var count = team.filter(function (m) { return m.role === r.id; }).length;
      lvlRows.appendChild(UI.el(
        '<div class="role-item">' +
        '  <div class="role-item-head"><span class="role-name">' + UI.esc(r.label) + "</span>" +
        '  <span class="ppl-n">( ' + count + " )</span></div>" +
        '  <div class="role-desc">' + UI.esc(r.desc) + "</div>" +
        "</div>"
      ));
    });
    main.appendChild(lvlSec);

    /* ============ CITIES & TIMEZONES ============ */
    var canCities = Store.canAddRemoveMembers();
    var cities = Store.cities();
    var citySec = UI.el(
      '<div class="st-section">' +
      '  <div class="section-head">' +
      '    <span class="section-name">Cities &amp; Timezones <span class="section-count">( ' + cities.length + " )</span></span>" +
      '    <span class="section-actions"></span>' +
      "  </div>" +
      '  <div class="st-rows" id="city-rows"></div>' +
      "</div>"
    );
    if (canCities) {
      var addCityBtn = UI.el('<button class="btn btn-sm btn-yellow">+ Add city</button>');
      addCityBtn.onclick = addCityModal;
      citySec.querySelector(".section-actions").appendChild(addCityBtn);
    }
    var cityRows = citySec.querySelector("#city-rows");
    cities.forEach(function (c) {
      var count = team.filter(function (m) { return m.city === c.id; }).length;
      var row = UI.el(
        '<div class="city-row">' +
        '  <span class="city-row-time" data-citytime="' + UI.esc(c.id) + '">' + UI.cityTime(c.id) + "</span>" +
        '  <div class="city-row-main"><div class="city-row-name">' + UI.esc(c.label) + "</div>" +
        '    <div class="city-row-tz">' + UI.esc(c.tz) + "</div></div>" +
        '  <span class="city-row-count">' + count + " " + (count === 1 ? "person" : "people") + "</span>" +
        '  <span class="city-row-actions"></span>' +
        "</div>"
      );
      if (canCities) {
        var del = UI.el('<button class="btn btn-sm btn-ghost" title="Remove city">✕</button>');
        del.onclick = function () {
          if (cities.length <= 1) { UI.toast("Keep at least one city"); return; }
          UI.confirm("Remove " + c.label + "?",
            (count ? "The " + count + " person" + (count === 1 ? "" : "s") + " in " + c.label + " will be moved to another city. " : "") +
            "Its clock is removed from the sidebar.",
            "Remove city"
          ).then(function (ok) {
            if (ok) Store.deleteCity(c.id).then(function () { UI.toast(c.label + " removed"); });
          });
        };
        row.querySelector(".city-row-actions").appendChild(del);
      }
      cityRows.appendChild(row);
    });
    main.appendChild(citySec);

    /* ============ STUDIOS ============ */
    var canStudios = Store.canAddRemoveMembers();
    var studios = Store.studios();
    var studioSec = UI.el(
      '<div class="st-section">' +
      '  <div class="section-head">' +
      '    <span class="section-name">Studios <span class="section-count">( ' + studios.length + " )</span></span>" +
      '    <span class="section-actions"></span>' +
      "  </div>" +
      '  <div class="st-rows" id="studio-rows"></div>' +
      "</div>"
    );
    if (canStudios) {
      var addStudioBtn = UI.el('<button class="btn btn-sm btn-yellow">+ Add studio</button>');
      addStudioBtn.onclick = addStudioModal;
      studioSec.querySelector(".section-actions").appendChild(addStudioBtn);
    }
    var studioRows = studioSec.querySelector("#studio-rows");
    cities.forEach(function (c) {
      var inCity = Store.studiosInCity(c.id);
      if (!inCity.length) return;
      studioRows.appendChild(UI.el('<div class="studio-city-group">' + UI.esc(c.label) + "</div>"));
      inCity.forEach(function (s) {
        var taskCount = Store.studioTasks(s.id).length;
        var row = UI.el(
          '<div class="studio-row">' +
          '  <span class="studio-row-name">' + UI.esc(s.name) +
            (s.ownerOnly ? ' <span class="chip chip-owneronly">Ownership only</span>' : "") + "</span>" +
          '  <span class="studio-row-count">' + taskCount + " checklist item" + (taskCount === 1 ? "" : "s") + "</span>" +
          '  <span class="studio-row-actions"></span>' +
          "</div>"
        );
        if (canStudios) {
          var sdel = UI.el('<button class="btn btn-sm btn-ghost" title="Remove studio">✕</button>');
          sdel.onclick = function () {
            UI.confirm("Remove " + s.name + "?",
              "Its weekly checklist (" + taskCount + " item" + (taskCount === 1 ? "" : "s") +
              ") is removed from " + c.label + " in Studio Checklist. This can't be undone.",
              "Remove studio"
            ).then(function (ok) { if (ok) Store.deleteStudio(s.id).then(function () { UI.toast(s.name + " removed"); }); });
          };
          row.querySelector(".studio-row-actions").appendChild(sdel);
        }
        studioRows.appendChild(row);
      });
    });
    main.appendChild(studioSec);

    /* ============ DEPARTMENTS ============ */
    var departments = Store.departments();
    var deptSec = UI.el(
      '<div class="st-section">' +
      '  <div class="section-head">' +
      '    <span class="section-name">Departments <span class="section-count">( ' + departments.length + " )</span></span>" +
      '    <span class="section-actions"></span>' +
      "  </div>" +
      '  <div class="st-rows" id="dept-rows"></div>' +
      "</div>"
    );
    if (canEdit) {
      var addDeptBtn = UI.el('<button class="btn btn-sm btn-yellow">+ Add department</button>');
      addDeptBtn.onclick = addDepartmentModal;
      deptSec.querySelector(".section-actions").appendChild(addDeptBtn);
    }
    var deptRows = deptSec.querySelector("#dept-rows");
    departments.forEach(function (name) {
      var count = team.filter(function (mm) { return (mm.depts || []).indexOf(name) !== -1; }).length;
      var row = UI.el(
        '<div class="dept-row">' +
        '  <span class="dept-row-name">' + UI.esc(name) + "</span>" +
        '  <span class="dept-row-count">' + count + " " + (count === 1 ? "person" : "people") + "</span>" +
        '  <span class="dept-row-actions"></span>' +
        "</div>"
      );
      if (canEdit) {
        var rename = UI.el('<button class="btn btn-sm btn-ghost">Rename</button>');
        rename.onclick = function () { renameDepartmentModal(name); };
        row.querySelector(".dept-row-actions").appendChild(rename);
        var ddel = UI.el('<button class="btn btn-sm btn-ghost" title="Remove department">✕</button>');
        ddel.onclick = function () {
          if (departments.length <= 1) { UI.toast("Keep at least one department"); return; }
          UI.confirm("Remove " + name + "?",
            (count ? "It will be removed from the " + count + " person" + (count === 1 ? "" : "s") + " it's assigned to. " : "") +
            "This can't be undone.",
            "Remove department"
          ).then(function (ok) { if (ok) Store.deleteDepartment(name).then(function () { UI.toast(name + " removed"); }); });
        };
        row.querySelector(".dept-row-actions").appendChild(ddel);
      }
      deptRows.appendChild(row);
    });
    main.appendChild(deptSec);

    /* ============ APP CONNECTIONS ============ */
    var connSec = UI.el(
      '<div class="st-section">' +
      '  <div class="section-head"><span class="section-name">App Connections</span></div>' +
      '  <div class="conn-grid"></div>' +
      "</div>"
    );
    var grid = connSec.querySelector(".conn-grid");
    CONNECTIONS.forEach(function (c) {
      var isAirtable = c.id === "airtable";
      var connected = isAirtable && Bookings.isConnected();
      var card = UI.el(
        '<div class="conn-card">' +
        '  <div class="conn-top"><span class="conn-logo">' + UI.esc(c.name[0]) + "</span>" +
        (connected ? '<span class="chip chip-med">Connected</span>' : '<span class="chip chip-low">Not connected</span>') +
        "</div>" +
        '  <div class="conn-name">' + UI.esc(c.name) + "</div>" +
        '  <div class="conn-desc">' + UI.esc(c.desc) + "</div>" +
        '  <button class="btn btn-sm" ' + (canEdit || isAirtable ? "" : "disabled") + ">" +
        (isAirtable ? (connected ? "View Bookings" : "Set up in Bookings") : "Connect") + "</button>" +
        "</div>"
      );
      card.querySelector("button").onclick = function () {
        if (isAirtable) { App.go("bookings"); return; }
        UI.toast(c.name + " connects once the site is live — it needs the deployed version");
      };
      grid.appendChild(card);
    });
    main.appendChild(connSec);
  };

  /* one team row: avatar | name+email | title | dept | access | actions */
  function memberRow(m, canEdit, canAddRemove, me) {
    var isMe = m.id === me.id;
    var row = UI.el(
      '<div class="st-row">' +
      UI.avatar(m) +
      '  <div class="st-main">' +
      '    <div class="st-name">' + UI.esc(m.name) + (isMe ? ' <span style="color:#999;font-weight:400">(you)</span>' : "") + "</div>" +
      '    <div class="st-email">' + (m.email ? UI.esc(m.email) : '<span style="color:#c5a900">no sign-in email</span>') + "</div>" +
      "  </div>" +
      '  <span class="st-profile"></span>' +
      '  <span class="st-dept-mount" title="Departments"></span>' +
      '  <select class="st-select st-city" title="City / studio" ' + (canEdit ? "" : "disabled") + ">" +
      Store.cities().map(function (c) { return '<option value="' + c.id + '">' + UI.esc(c.label) + "</option>"; }).join("") +
      "  </select>" +
      '  <select class="st-select st-role" title="Access level" ' + (canEdit ? "" : "disabled") + ">" +
      ROLES.map(function (r) { return '<option value="' + r.id + '">' + UI.esc(r.label) + "</option>"; }).join("") +
      "  </select>" +
      '  <span class="st-actions"></span>' +
      "</div>"
    );

    var deptMount = row.querySelector(".st-dept-mount");
    if (canEdit) {
      var deptSel = (m.depts || []).slice();
      deptMount.appendChild(UI.tagSelect(Store.departments(), deptSel, {
        placeholder: "Departments…",
        onChange: function () { Store.updateMember(m.id, { depts: deptSel.slice() }); }
      }));
    } else {
      deptMount.innerHTML = '<span class="st-dept-text">' + UI.esc((m.depts || []).join(", ") || "—") + "</span>";
    }

    var citySel = row.querySelector(".st-city");
    citySel.value = m.city || DEFAULT_CITY;
    citySel.onchange = function () {
      Store.updateMember(m.id, { city: citySel.value }).then(function () { UI.toast("City updated"); });
    };

    var roleSel = row.querySelector(".st-role");
    roleSel.value = m.role;
    roleSel.onchange = function () {
      if (isMe && m.role === "owner-dev" && roleSel.value !== "owner-dev") {
        UI.confirm("Change your own access?",
          "You are about to give up Ownership & Developer access. You won't be able to undo this yourself.",
          "Change my access"
        ).then(function (ok) {
          if (ok) Store.updateMember(m.id, { role: roleSel.value }).then(function () { UI.toast("Access updated"); });
          else roleSel.value = m.role;
        });
        return;
      }
      Store.updateMember(m.id, { role: roleSel.value }).then(function () { UI.toast("Access updated"); });
    };

    if (canEdit) {
      var edit = UI.el('<button class="btn btn-sm btn-ghost">Profile</button>');
      edit.onclick = function () { Team.openProfile(m.id); };
      row.querySelector(".st-profile").appendChild(edit);
    }
    var actions = row.querySelector(".st-actions");
    if (canAddRemove && !isMe) {
      var del = UI.el('<button class="btn btn-sm btn-ghost" title="Remove from team">✕</button>');
      del.onclick = function () {
        UI.confirm("Remove " + m.name + "?",
          "They will lose access to the HQ and be unassigned from all tasks. Their comments stay.",
          "Remove member"
        ).then(function (ok) {
          if (ok) Store.deleteMember(m.id).then(function () { UI.toast(m.name + " removed"); });
        });
      };
      actions.appendChild(del);
    }
    return row;
  }

  function addCityModal() {
    var sh = UI.modalShell("Add city");
    sh.body.innerHTML =
      '<div class="field"><label>City / studio name</label><input type="text" id="ct-name" placeholder="e.g. Paris" maxlength="40"></div>' +
      '<div class="field"><label>Timezone</label><select id="ct-tz">' +
      TIMEZONE_OPTIONS.map(function (t) { return '<option value="' + UI.esc(t.tz) + '">' + UI.esc(t.label) + "</option>"; }).join("") +
      '</select><div class="hint">Its live time updates automatically, with daylight-saving handled for you.</div></div>' +
      '<div class="field"><label>Example phone number <span style="text-transform:none;letter-spacing:0;font-weight:400;color:#999">(optional)</span></label>' +
      '<input type="tel" id="ct-dial" placeholder="+33 6 12 34 56 78">' +
      '<div class="hint">Used as the placeholder when someone in this city adds their number.</div></div>';

    var cancel = UI.el('<button class="btn btn-ghost">Cancel</button>');
    cancel.onclick = UI.closeModal;
    var save = UI.el('<button class="btn btn-primary">Add city</button>');
    save.onclick = function () {
      var name = sh.body.querySelector("#ct-name").value.trim();
      if (!name) { sh.body.querySelector("#ct-name").focus(); return; }
      Store.addCity(name, sh.body.querySelector("#ct-tz").value, sh.body.querySelector("#ct-dial").value.trim())
        .then(function () { UI.closeModal(); UI.toast(name + " added"); });
    };
    sh.foot.appendChild(cancel); sh.foot.appendChild(save);
  }

  function addStudioModal() {
    var cities = Store.cities();
    var sh = UI.modalShell("Add studio");
    sh.body.innerHTML =
      '<div class="field"><label>Studio name</label><input type="text" id="sd-name" placeholder="e.g. Studio 305" maxlength="40"></div>' +
      '<div class="field"><label>City</label><select id="sd-city">' +
      cities.map(function (c) { return '<option value="' + c.id + '">' + UI.esc(c.label) + "</option>"; }).join("") +
      '</select><div class="hint">It appears as a tab under this city in Studio Checklist, seeded with the standard weekly checklist.</div></div>' +
      '<label class="sd-owner-check"><input type="checkbox" id="sd-owner"> Ownership only ' +
      '<span>(hidden from studio managers — like the London Office)</span></label>';

    var cancel = UI.el('<button class="btn btn-ghost">Cancel</button>');
    cancel.onclick = UI.closeModal;
    var save = UI.el('<button class="btn btn-primary">Add studio</button>');
    save.onclick = function () {
      var name = sh.body.querySelector("#sd-name").value.trim();
      if (!name) { sh.body.querySelector("#sd-name").focus(); return; }
      Store.addStudio(sh.body.querySelector("#sd-city").value, name, sh.body.querySelector("#sd-owner").checked)
        .then(function () { UI.closeModal(); UI.toast(name + " added"); });
    };
    sh.foot.appendChild(cancel); sh.foot.appendChild(save);
  }

  function addDepartmentModal() {
    var sh = UI.modalShell("Add department");
    sh.body.innerHTML = '<div class="field"><label>Department name</label><input type="text" id="dp-name" placeholder="e.g. Retouching" maxlength="40"></div>';
    var save = UI.el('<button class="btn btn-primary">Add department</button>');
    save.onclick = function () {
      var name = sh.body.querySelector("#dp-name").value.trim();
      if (!name) { sh.body.querySelector("#dp-name").focus(); return; }
      Store.addDepartment(name).then(function () { UI.closeModal(); UI.toast(name + " added"); });
    };
    sh.foot.appendChild(save);
  }

  function renameDepartmentModal(oldName) {
    var sh = UI.modalShell("Rename department");
    sh.body.innerHTML = '<div class="field"><label>Department name</label><input type="text" id="dp-name" maxlength="40">' +
      '<div class="hint">Everyone assigned to “' + UI.esc(oldName) + "” moves to the new name.</div></div>";
    var inp = sh.body.querySelector("#dp-name");
    inp.value = oldName;
    var save = UI.el('<button class="btn btn-primary">Save</button>');
    save.onclick = function () {
      var name = inp.value.trim();
      if (!name) return;
      Store.renameDepartment(oldName, name).then(function () { UI.closeModal(); UI.toast("Department renamed"); });
    };
    sh.foot.appendChild(save);
  }

  function addMemberModal() {
    var sh = UI.modalShell("Add team member");
    sh.body.innerHTML =
      '<div class="field"><label>Full name</label><input type="text" id="nm-name" placeholder="e.g. Jamie Smith" maxlength="80"></div>' +
      '<div class="field"><label>Job title</label><input type="text" id="nm-title" placeholder="e.g. Photographer / Editor" maxlength="120"></div>' +
      '<div class="field"><label>Gmail address (for sign-in)</label><input type="email" id="nm-email" placeholder="name@gmail.com">' +
      '<div class="hint">They can only log in once this matches their Google account. You can add it later.</div></div>' +
      '<div class="field-row">' +
      '  <div class="field"><label>Departments</label><div id="nm-dept"></div></div>' +
      '  <div class="field"><label>Access level</label><select id="nm-role">' +
      ROLES.map(function (r) { return '<option value="' + r.id + '"' + (r.id === "team" ? " selected" : "") + ">" + UI.esc(r.label) + "</option>"; }).join("") +
      "  </select></div>" +
      "</div>" +
      '<div class="field"><label>City / studio</label><select id="nm-city">' +
      Store.cities().map(function (c) { return '<option value="' + c.id + '">' + UI.esc(c.label) + "</option>"; }).join("") +
      "</select></div>";

    var nmDepts = [];
    sh.body.querySelector("#nm-dept").appendChild(UI.tagSelect(Store.departments(), nmDepts, { placeholder: "Select departments…" }));

    var cancel = UI.el('<button class="btn btn-ghost">Cancel</button>');
    cancel.onclick = UI.closeModal;
    var save = UI.el('<button class="btn btn-primary">Add member</button>');
    save.onclick = function () {
      var name = sh.body.querySelector("#nm-name").value.trim();
      if (!name) { sh.body.querySelector("#nm-name").focus(); return; }
      Store.addMember({
        name: name,
        title: sh.body.querySelector("#nm-title").value.trim(),
        email: sh.body.querySelector("#nm-email").value.trim(),
        depts: nmDepts.slice(),
        role: sh.body.querySelector("#nm-role").value,
        city: sh.body.querySelector("#nm-city").value
      }).then(function () {
        UI.closeModal();
        UI.toast(name + " added to the team");
      });
    };
    sh.foot.appendChild(cancel); sh.foot.appendChild(save);
  }

  return api;
})();
