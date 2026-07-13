/* ================================================================
   YELLOW BELLY HQ — Supplier Contacts  (Ownership only)
   A filterable list of trusted suppliers (cleaners, catering, hire…)
   per city. Category first, then the contact's details. Email links
   open a Gmail compose window. Add a contact any time.
   Access: Ownership & Developer + Ownership only.
   ================================================================ */

var Suppliers = (function () {
  var api = {};
  var fCat = "all", fCity = "all", fSearch = "";

  /* open Gmail's compose window in the browser, pre-addressed */
  function gmailHref(email) {
    return "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(email);
  }

  function filtered() {
    var q = fSearch.trim().toLowerCase();
    return Store.suppliers().filter(function (s) {
      if (fCat !== "all" && s.category !== fCat) return false;
      if (fCity !== "all" && s.cityId !== fCity) return false;
      if (q) {
        var hay = [s.name, s.company, s.phone, s.email, s.category, UI.cityLabel(s.cityId)].join(" ").toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function rowEl(s, main) {
    var city = s.cityId ? UI.cityLabel(s.cityId) : "";
    var row = UI.el(
      "<tr>" +
      '<td>' + (s.category ? '<span class="chip supplier-cat">' + UI.esc(s.category) + "</span>" : '<span class="sup-dash">—</span>') + "</td>" +
      '<td class="sup-name">' + (s.name ? UI.esc(s.name) : '<span class="sup-dash">—</span>') + "</td>" +
      "<td>" + (s.company ? UI.esc(s.company) : '<span class="sup-dash">—</span>') + "</td>" +
      '<td class="sup-phone">' + (s.phone ? UI.esc(s.phone) : '<span class="sup-dash">—</span>') + "</td>" +
      "<td></td>" +
      "<td>" + (city ? UI.esc(city) : '<span class="sup-dash">—</span>') + "</td>" +
      '<td class="sup-actions"></td>' +
      "</tr>"
    );

    // email → Gmail compose (don't trigger the row's edit handler)
    var emailCell = row.children[4];
    if (s.email) {
      var a = UI.el('<a class="supplier-email" target="_blank" rel="noopener" title="Email in Gmail">' + UI.esc(s.email) + "</a>");
      a.href = gmailHref(s.email);
      a.onclick = function (e) { e.stopPropagation(); };
      emailCell.appendChild(a);
    } else {
      emailCell.appendChild(UI.el('<span class="sup-dash">—</span>'));
    }

    // delete
    var del = UI.el('<button class="btn btn-sm btn-ghost" title="Remove contact">✕</button>');
    del.onclick = function (e) {
      e.stopPropagation();
      UI.confirm("Remove " + (s.name || s.company || "this contact") + "?",
        "This supplier contact will be removed. This can't be undone.", "Remove")
        .then(function (ok) { if (ok) Store.deleteSupplier(s.id).then(function () { UI.toast("Contact removed"); }); });
    };
    row.children[6].appendChild(del);

    row.onclick = function () { editModal(s, main); };
    return row;
  }

  api.render = function (main) {
    if (!Store.canViewSettings()) { App.go("tasks"); return; }
    var all = Store.suppliers();

    main.innerHTML = "";
    var head = UI.el(
      '<div class="page-head">' +
      '  <div><div class="page-title">Supplier Contacts<span class="count">( ' + all.length + " )</span></div>" +
      '  <div class="page-sub">Trusted suppliers across every city — cleaners, catering, hire and more. Click an email to write in Gmail.</div></div>' +
      '  <div class="page-actions"><button class="btn btn-yellow" id="btn-add-supplier">+ Add contact</button></div>' +
      "</div>"
    );
    head.querySelector("#btn-add-supplier").onclick = function () { editModal(null, main); };
    main.appendChild(head);

    /* filters */
    var bar = UI.el('<div class="toolbar"></div>');
    var catSel = UI.el('<select class="filter-select" title="Filter by category"></select>');
    catSel.innerHTML = '<option value="all">Category: all</option>' + Store.supplierCategories().map(function (c) {
      return '<option value="' + UI.esc(c) + '">' + UI.esc(c) + "</option>";
    }).join("");
    catSel.value = fCat;
    var citySel = UI.el('<select class="filter-select" title="Filter by city"></select>');
    citySel.innerHTML = '<option value="all">City: all</option>' + Store.cities().map(function (c) {
      return '<option value="' + UI.esc(c.id) + '">' + UI.esc(c.label) + "</option>";
    }).join("");
    citySel.value = fCity;
    var search = UI.el('<input type="text" class="supplier-search" placeholder="Search name, company, phone…">');
    search.value = fSearch;
    bar.appendChild(catSel); bar.appendChild(citySel);
    bar.appendChild(UI.el('<span class="toolbar-spacer"></span>'));
    bar.appendChild(search);
    main.appendChild(bar);

    /* table */
    var wrap = UI.el('<div class="table-wrap"></div>');
    var table = UI.el(
      '<table class="supplier-table"><thead><tr>' +
      "<th>Category</th><th>Name</th><th>Company</th><th>Phone</th><th>Email</th><th>City</th><th></th>" +
      "</tr></thead><tbody></tbody></table>"
    );
    var tbody = table.querySelector("tbody");
    wrap.appendChild(table);
    main.appendChild(wrap);
    var empty = UI.el('<div class="empty" style="display:none"><b>No contacts match</b>Try a different filter, or add a new contact.</div>');
    main.appendChild(empty);

    function paint() {
      var rows = filtered();
      tbody.innerHTML = "";
      rows.forEach(function (s) { tbody.appendChild(rowEl(s, main)); });
      wrap.style.display = rows.length ? "" : "none";
      empty.style.display = rows.length ? "none" : "";
    }
    catSel.onchange = function () { fCat = catSel.value; paint(); };
    citySel.onchange = function () { fCity = citySel.value; paint(); };
    search.oninput = function () { fSearch = search.value; paint(); };
    paint();
  };

  /* add / edit a contact */
  function editModal(supplier, main) {
    var isEdit = !!supplier;
    var sh = UI.modalShell(isEdit ? "Edit contact" : "Add contact");
    var cats = Store.supplierCategories();
    var cities = Store.cities();
    sh.body.innerHTML =
      '<div class="field"><label>Supplier category</label>' +
      '<input type="text" id="sp-cat" list="sp-cat-list" placeholder="e.g. Cleaner" maxlength="40" value="' + (isEdit ? UI.esc(supplier.category) : "") + '">' +
      '<datalist id="sp-cat-list">' + cats.map(function (c) { return '<option value="' + UI.esc(c) + '">'; }).join("") + "</datalist></div>" +
      '<div class="field"><label>Contact name</label><input type="text" id="sp-name" placeholder="e.g. Maria Gonzalez" maxlength="60" value="' + (isEdit ? UI.esc(supplier.name) : "") + '"></div>' +
      '<div class="field"><label>Company</label><input type="text" id="sp-company" placeholder="e.g. SparkleClean Ltd" maxlength="80" value="' + (isEdit ? UI.esc(supplier.company) : "") + '"></div>' +
      '<div class="field"><label>Phone number</label><input type="tel" id="sp-phone" placeholder="+44 20 7946 0000" value="' + (isEdit ? UI.esc(supplier.phone) : "") + '"></div>' +
      '<div class="field"><label>Email address</label><input type="email" id="sp-email" placeholder="hello@supplier.com" value="' + (isEdit ? UI.esc(supplier.email) : "") + '"></div>' +
      '<div class="field"><label>City it applies to</label><select id="sp-city">' +
      cities.map(function (c) { return '<option value="' + UI.esc(c.id) + '"' + (isEdit && supplier.cityId === c.id ? " selected" : "") + ">" + UI.esc(c.label) + "</option>"; }).join("") +
      "</select></div>";

    var cancel = UI.el('<button class="btn btn-ghost">Cancel</button>');
    cancel.onclick = UI.closeModal;
    var save = UI.el('<button class="btn btn-primary">' + (isEdit ? "Save changes" : "Add contact") + "</button>");
    save.onclick = function () {
      var data = {
        category: sh.body.querySelector("#sp-cat").value.trim(),
        name: sh.body.querySelector("#sp-name").value.trim(),
        company: sh.body.querySelector("#sp-company").value.trim(),
        phone: sh.body.querySelector("#sp-phone").value.trim(),
        email: sh.body.querySelector("#sp-email").value.trim(),
        cityId: sh.body.querySelector("#sp-city").value
      };
      if (!data.name && !data.company) { sh.body.querySelector("#sp-name").focus(); return; }
      var done = isEdit ? Store.updateSupplier(supplier.id, data) : Store.addSupplier(data);
      done.then(function () {
        UI.closeModal();
        UI.toast(isEdit ? "Contact updated" : (data.name || data.company) + " added");
        api.render(main);
      });
    };
    sh.foot.appendChild(cancel); sh.foot.appendChild(save);
  }

  return api;
})();
