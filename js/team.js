/* ================================================================
   YELLOW BELLY HQ — Team page + profile editing
   Everyone edits their own photo / pronouns / title / email / phone.
   Admins can also set login emails for anyone. Access level, departments
   and city / studio are managed only in Settings.
   ================================================================ */

var Team = (function () {
  var api = {};
  var filterCity = "all";   // 'all' | city id

  function roleLabel(id) {
    var r = ROLES.find(function (x) { return x.id === id; });
    return r ? r.label : id;
  }

  api.render = function (main) {
    var me = Store.me();
    var isAdmin = Store.canManageTeam();
    var team = Store.team();
    if (filterCity !== "all") {
      team = team.filter(function (m) { return m.city === filterCity; });
    }

    main.innerHTML = "";
    main.appendChild(UI.el(
      '<div class="page-head">' +
      '  <div><div class="page-title">Team<span class="count">( ' + team.length + " )</span></div>" +
      '  <div class="page-sub">' + (isAdmin
        ? "Set each person's Gmail address so they can sign in. Everyone manages their own profile."
        : "The Yellowbelly crew. Click your own card to update your profile.") + "</div></div>" +
      "</div>"
    ));

    /* toolbar: city filter (live clocks now live in the sidebar) */
    var bar = UI.el('<div class="toolbar"></div>');
    var selCity = UI.el('<select class="filter-select" title="Filter by city"></select>');
    selCity.innerHTML = '<option value="all">All cities</option>' +
      Store.cities().map(function (c) { return '<option value="' + c.id + '">' + UI.esc(c.label) + "</option>"; }).join("");
    selCity.value = filterCity;
    selCity.onchange = function () { filterCity = selCity.value; api.render(main); };
    bar.appendChild(selCity);
    main.appendChild(bar);

    if (!team.length) {
      main.appendChild(UI.el('<div class="empty"><b>No one in ' + UI.esc(UI.cityLabel(filterCity)) + " yet</b>Assign people to this city from their profile.</div>"));
      return;
    }

    var grid = UI.el('<div class="team-grid"></div>');
    team.forEach(function (m) {
      var isMe = m.id === me.id;
      var card = UI.el(
        '<div class="member-card">' +
        UI.avatar(m, "lg") +
        '  <div class="member-name">' + UI.esc(m.name) + (isMe ? ' <span style="color:#999;font-weight:400">(you)</span>' : "") + "</div>" +
        (m.pronouns ? '<div class="member-pronouns">' + UI.esc(m.pronouns) + "</div>" : "") +
        '  <div><span class="member-title">' + UI.esc(m.title) + "</span></div>" +
        '  <div class="member-city"><span class="member-city-name">' + UI.esc(UI.cityLabel(m.city)) + "</span>" +
        '<span class="member-city-time" data-citytime="' + UI.esc(m.city) + '">' + UI.cityTime(m.city) + "</span></div>" +
        '  <div class="member-email">' + (m.email ? UI.esc(m.email) : '<span style="color:#c5a900">No sign-in email set yet</span>') + "</div>" +
        (m.phone ? '<div class="member-phone">' + UI.esc(m.phone) + "</div>" : "") +
        (m.role !== "team" ? '<div class="member-role-tag"><span class="chip ' + (m.role === "owner-dev" || m.role === "owner" ? "chip-med" : "chip-status") + '">' + UI.esc(roleLabel(m.role)) + "</span></div>" : "") +
        '  <div class="member-edit"></div>' +
        "</div>"
      );
      var editWrap = card.querySelector(".member-edit");
      if (isMe) {
        var b = UI.el('<button class="btn btn-sm btn-yellow">Edit my profile</button>');
        b.onclick = function () { api.openProfile(m.id); };
        editWrap.appendChild(b);
      } else if (isAdmin) {
        var b2 = UI.el('<button class="btn btn-sm btn-ghost">Manage</button>');
        b2.onclick = function () { api.openProfile(m.id); };
        editWrap.appendChild(b2);
      }
      grid.appendChild(card);
    });
    main.appendChild(grid);
  };

  /* profile editor — own profile, or any profile for admins */
  api.openProfile = function (memberId) {
    var me = Store.me();
    var m = Store.member(memberId);
    if (!m) return;
    var isMe = m.id === me.id;
    var isAdmin = Store.canManageTeam();
    if (!isMe && !isAdmin) return;

    var photo = m.photo || null;

    var sh = UI.modalShell(isMe ? "My profile" : m.name);
    sh.body.innerHTML =
      '<div class="avatar-picker">' +
      '  <span id="pf-avatar">' + UI.avatar(m, "lg") + "</span>" +
      '  <div><button class="btn btn-sm" id="pf-photo-btn">Change photo</button>' +
      '  <input type="file" id="pf-photo" accept="image/*">' +
      '  <div class="hint" style="font-size:12px;color:#6b6b6b;margin-top:6px">JPG or PNG — it will be cropped to a circle.</div></div>' +
      "</div>" +
      '<div class="field-row">' +
      '  <div class="field"><label>Pronouns</label><input type="text" id="pf-pronouns" placeholder="e.g. she/her" maxlength="30"></div>' +
      '  <div class="field"><label>Title at Yellowbelly</label><input type="text" id="pf-title" maxlength="120"></div>' +
      "</div>" +
      '<div class="field-row">' +
      '  <div class="field"><label>Email (sign-in + shown to team)</label>' +
      '    <input type="email" id="pf-email" placeholder="name@gmail.com">' +
      '    <div class="hint">Must match the Google account used to sign in.</div></div>' +
      '  <div class="field"><label>Phone number</label>' +
      '    <input type="tel" id="pf-phone" placeholder="' + UI.esc(UI.phoneExample(m.city)) + '">' +
      '    <div class="hint">Shown on your team card.</div></div>' +
      "</div>";

    sh.body.querySelector("#pf-pronouns").value = m.pronouns || "";
    sh.body.querySelector("#pf-title").value = m.title || "";
    sh.body.querySelector("#pf-email").value = m.email || "";
    sh.body.querySelector("#pf-phone").value = m.phone || "";

    /* Outreach email signature — only for your own profile, and only if you have Outreach access */
    var sigImg = (m.emailSignature && m.emailSignature.image) || "";
    var showSig = isMe && Store.canViewPage("outreach", m);
    if (showSig) {
      var sigSec = UI.el(
        '<div class="pf-sig">' +
        '  <div class="pf-sig-head"><label>Outreach email signature</label><span class="pf-sig-badge">Outreach only</span></div>' +
        '  <textarea id="pf-sig-text" class="pf-sig-text" placeholder="Hannah McIver&#10;Yellowbelly Photo&#10;hannah@yellowbellyphoto.com"></textarea>' +
        '  <div class="pf-sig-imgrow"><span class="pf-sig-prev" id="pf-sig-prev"></span>' +
        '    <button type="button" class="btn btn-sm" id="pf-sig-img-btn">Add image</button>' +
        '    <button type="button" class="btn btn-sm btn-ghost hidden" id="pf-sig-img-rm">Remove</button>' +
        '    <input type="file" id="pf-sig-img" accept="image/*" style="display:none"></div>' +
        '  <div class="hint">A bit of text plus an optional logo or headshot. Drop it into any email with the <b>Insert</b> menu when you write a template. Only people with Outreach access have this.</div>' +
        '</div>'
      );
      sh.body.appendChild(sigSec);
      sigSec.querySelector("#pf-sig-text").value = (m.emailSignature && m.emailSignature.text) || "";
      var drawSigPrev = function () {
        sigSec.querySelector("#pf-sig-prev").innerHTML = sigImg ? '<img src="' + sigImg + '" alt="signature image">' : "";
        sigSec.querySelector("#pf-sig-img-rm").classList.toggle("hidden", !sigImg);
        sigSec.querySelector("#pf-sig-img-btn").textContent = sigImg ? "Change image" : "Add image";
      };
      drawSigPrev();
      var sigInput = sigSec.querySelector("#pf-sig-img");
      sigSec.querySelector("#pf-sig-img-btn").onclick = function () { sigInput.click(); };
      sigInput.onchange = function () {
        var f = sigInput.files[0]; if (!f) return;
        UI.readImageScaled(f, 600).then(function (dataUrl) { sigImg = dataUrl; drawSigPrev(); }).catch(function () { UI.toast("Couldn't read that image"); });
      };
      sigSec.querySelector("#pf-sig-img-rm").onclick = function () { sigImg = ""; drawSigPrev(); };
    }

    var photoInput = sh.body.querySelector("#pf-photo");
    sh.body.querySelector("#pf-photo-btn").onclick = function () { photoInput.click(); };
    photoInput.onchange = function () {
      var f = photoInput.files[0];
      if (!f) return;
      UI.readImageScaled(f, 400).then(function (dataUrl) {
        photo = dataUrl;
        sh.body.querySelector("#pf-avatar").innerHTML = '<span class="avatar lg"><img src="' + dataUrl + '" alt=""></span>';
      }).catch(function () { UI.toast("Couldn't read that image"); });
    };

    /* your own profile carries the account controls */
    if (isMe) {
      var logout = UI.el('<button class="btn btn-ghost">Log out</button>');
      logout.onclick = function () { UI.closeModal(); Store.signOut(); };
      var login = UI.el('<button class="btn btn-ghost">Log in</button>');
      login.onclick = function () { UI.closeModal(); Store.signInGoogle(); };
      sh.foot.appendChild(logout);
      sh.foot.appendChild(login);
      sh.foot.appendChild(UI.el('<span class="foot-spacer"></span>'));
    }

    var cancel = UI.el('<button class="btn btn-ghost">Cancel</button>');
    cancel.onclick = UI.closeModal;
    var save = UI.el('<button class="btn btn-primary">Save profile</button>');
    save.onclick = function () {
      var patch = {
        pronouns: sh.body.querySelector("#pf-pronouns").value.trim(),
        title: sh.body.querySelector("#pf-title").value.trim() || m.title,
        email: sh.body.querySelector("#pf-email").value.trim().toLowerCase(),
        phone: sh.body.querySelector("#pf-phone").value.trim()
      };
      if (photo) patch.photo = photo;
      if (showSig) patch.emailSignature = { text: sh.body.querySelector("#pf-sig-text").value.trim(), image: sigImg };
      Store.updateMember(m.id, patch).then(function () {
        UI.closeModal();
        UI.toast("Profile saved");
      });
    };
    sh.foot.appendChild(cancel); sh.foot.appendChild(save);
  };

  return api;
})();
