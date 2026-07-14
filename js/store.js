/* ================================================================
   YELLOW BELLY HQ — data layer
   One Store API, two backends:
     • PREVIEW mode  — localStorage + IndexedDB (no setup needed)
     • FIREBASE mode — Auth / Firestore / Storage (set FIREBASE_CONFIG)
   UI code only ever talks to `Store`.
   ================================================================ */

var Store = (function () {

  var MODE = FIREBASE_CONFIG ? "firebase" : "demo";
  var state = { team: [], tasks: [], notifications: [], docSections: [], docs: [], cities: [], departments: [], studios: [], studioTasks: [], studioArchive: [], suppliers: [], tickets: [] };
  var me = null;               // current member object (effective — may be a preview)
  var realMe = null;           // the genuine logged-in account (never a preview)
  var previewId = null;        // set when an Ownership user previews as a teammate
  var authUser = null;         // firebase auth user (firebase mode)
  var changeListeners = [];
  var authListeners = [];

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function now() { return Date.now(); }
  function emitChange() { changeListeners.forEach(function (cb) { cb(); }); }
  function emitAuth(status) { authListeners.forEach(function (cb) { cb(status); }); }

  /* =========================================================
     PREVIEW MODE (localStorage + IndexedDB for PDF files)
     ========================================================= */
  var LS_KEY = "ybhq_data_v1";

  /* older saves used admin/manager/member roles and had no departments */
  function migrateTeam() {
    var seedById = {};
    TEAM_SEED.forEach(function (s) { seedById[s.id] = s; });
    var OLD = { admin: "owner", manager: "manager-admin", member: "team" };
    state.team.forEach(function (m) {
      var seed = seedById[m.id];
      if (OLD[m.role]) m.role = seed ? seed.role : OLD[m.role];
      // departments are now multi-select (array); migrate the old single value
      if (!m.depts) {
        var first = m.dept || (seed ? seed.dept : DEPARTMENTS_SEED[0]);
        m.depts = first ? [first] : [];
      }
      delete m.dept;
      if (!m.city) m.city = seed ? seed.city : DEFAULT_CITY;
    });
  }

  /* keep doc sections in step with the seed for existing saved data,
     without clobbering any renames/sections the admin has made */
  function migrateDocSections() {
    state.docSections = state.docSections || [];
    state.docSections.forEach(function (s) {
      if (s.id === "roles" && s.name === "Roles & Responsibilities") {
        s.name = "Job Roles and Responsibilities";
      }
    });
    var hasPolicies = state.docSections.some(function (s) {
      return s.id === "policies" || s.name === "Company Policies";
    });
    if (!hasPolicies) {
      state.docSections.push({ id: "policies", name: "Company Policies", order: state.docSections.length });
    }
  }

  /* built-in department renames — applied to existing saved data on load */
  var DEPT_RENAMES = {
    "Editing": "Editor",
    "Studio": "Studio Manager",
    "Customer Success": "Customer Success Associate",
    "Photography": "Photographer"
  };
  function migrateDepartments() {
    state.departments = state.departments || [];
    Object.keys(DEPT_RENAMES).forEach(function (oldN) {
      var newN = DEPT_RENAMES[oldN];
      var i = state.departments.indexOf(oldN);
      if (i !== -1 && state.departments.indexOf(newN) === -1) {
        state.departments[i] = newN;
        (state.team || []).forEach(function (m) {
          if (m.depts) m.depts = m.depts.map(function (d) { return d === oldN ? newN : d; });
        });
      }
    });
  }

  function studioTaskSeed(studioId) {
    return DEFAULT_STUDIO_CHECKLIST.map(function (text) {
      return { id: uid(), studioId: studioId, text: text, recurring: true, done: false, checkedAt: 0, notes: "", actions: "", weekOf: "" };
    });
  }
  /* seed studios + their default checklists if missing, and grant the
     seeded studio-managers access to their city */
  function migrateStudios() {
    if (!state.studios || !state.studios.length) {
      state.studios = JSON.parse(JSON.stringify(STUDIOS_SEED));
      state.studioTasks = [];
      state.studios.forEach(function (s) { state.studioTasks = state.studioTasks.concat(studioTaskSeed(s.id)); });
    }
    (state.team || []).forEach(function (m) {
      if (!m.studioAccess && STUDIO_ACCESS_SEED[m.id]) m.studioAccess = STUDIO_ACCESS_SEED[m.id].slice();
    });
    // the London Office is Ownership-only, even for the London studio manager
    (state.studios || []).forEach(function (s) {
      if (s.id === "ldn-office" && s.ownerOnly === undefined) s.ownerOnly = true;
    });
    if (!state.studioArchive) state.studioArchive = [];
    seedStudioArchiveSample();
  }
  /* demo only: give the "last week" view something to show on first use.
     Production (Firebase) accrues real history as weeks roll over. */
  function seedStudioArchiveSample() {
    if (MODE !== "demo") return;
    if (state.studioArchive && state.studioArchive.length) return;
    var lastWeek = shiftWeekStr(mondayOf(new Date()), -1);
    var base = new Date(lastWeek + "T09:30:00").getTime();
    state.studioArchive = [];
    state.studios.forEach(function (s, si) {
      var tasks = state.studioTasks.filter(function (t) { return t.studioId === s.id; });
      if (!tasks.length) return;
      // vary completion a little so the leaderboard has a realistic spread
      var undone = si % 3;                       // 0,1,2 items left unchecked
      var items = tasks.map(function (t, i) {
        var done = i < tasks.length - undone;
        return { text: t.text, recurring: t.recurring, done: done,
          checkedAt: done ? base + (si * 5 + i) * 3600000 : 0, notes: "", actions: "" };
      });
      state.studioArchive.push({ id: uid(), weekOf: lastWeek, studioId: s.id, items: items });
    });
  }

  function demoLoad() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) {}
    if (raw && raw.team && raw.team.length) {
      state = raw;
      // merge in any newly-seeded members (keeps existing edits)
      TEAM_SEED.forEach(function (m) {
        if (!state.team.some(function (t) { return t.id === m.id; })) state.team.push(JSON.parse(JSON.stringify(m)));
      });
      migrateTeam();
      migrateDocSections();
      if (!state.cities || !state.cities.length) state.cities = JSON.parse(JSON.stringify(CITIES_SEED));
      if (!state.departments || !state.departments.length) state.departments = JSON.parse(JSON.stringify(DEPARTMENTS_SEED));
      migrateDepartments();
      migrateStudios();
      if (!state.suppliers) state.suppliers = JSON.parse(JSON.stringify(SUPPLIERS_SEED));
      if (!state.tickets) state.tickets = [];
      // Back-Log column removed — move any leftover tasks into To Do
      (state.tasks || []).forEach(function (t) { if (t.status === "back-log") t.status = "to-do"; });
      demoSave();
    } else {
      state.team = JSON.parse(JSON.stringify(TEAM_SEED));
      state.docSections = JSON.parse(JSON.stringify(DOC_SECTIONS_SEED));
      state.cities = JSON.parse(JSON.stringify(CITIES_SEED));
      state.departments = JSON.parse(JSON.stringify(DEPARTMENTS_SEED));
      migrateTeam();   // convert seed dept → depts, etc.
      migrateStudios();
      state.suppliers = JSON.parse(JSON.stringify(SUPPLIERS_SEED));
      state.tickets = [];
      state.docs = [];
      state.notifications = [];
      state.tasks = SAMPLE_TASKS.map(function (t) {
        var c = JSON.parse(JSON.stringify(t));
        c.id = uid(); c.createdAt = now(); c.comments = [];
        return c;
      });
      demoSave();
    }
  }
  function demoSave() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) { console.warn("Could not save", e); }
  }

  /* --- IndexedDB for uploaded PDF blobs + object URL cache --- */
  var idb = null;
  var urlCache = {};
  function idbOpen() {
    return new Promise(function (res, rej) {
      if (idb) return res(idb);
      var req = indexedDB.open("ybhq-files", 1);
      req.onupgradeneeded = function () { req.result.createObjectStore("files"); };
      req.onsuccess = function () { idb = req.result; res(idb); };
      req.onerror = function () { rej(req.error); };
    });
  }
  function idbPut(key, blob) {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put(blob, key);
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function idbGet(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (res, rej) {
        var req = db.transaction("files").objectStore("files").get(key);
        req.onsuccess = function () { res(req.result); };
        req.onerror = function () { rej(req.error); };
      });
    });
  }
  function idbDel(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction("files", "readwrite");
        tx.objectStore("files").delete(key);
        tx.oncomplete = res; tx.onerror = res;
      });
    });
  }

  /* =========================================================
     FIREBASE MODE
     ========================================================= */
  var db = null, fbAuth = null, fbStorage = null;
  var unsubs = [];

  function fbLoadSdk() {
    var base = "https://www.gstatic.com/firebasejs/10.12.2/";
    function script(src) {
      return new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    return script(base + "firebase-app-compat.js")
      .then(function () { return script(base + "firebase-auth-compat.js"); })
      .then(function () { return script(base + "firebase-firestore-compat.js"); })
      .then(function () { return script(base + "firebase-storage-compat.js"); });
  }

  function fbListen() {
    unsubs.forEach(function (u) { u(); });
    unsubs = [];
    unsubs.push(db.collection("team").onSnapshot(function (snap) {
      state.team = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      state.team.sort(function (a, b) { return a.name.localeCompare(b.name); });
      // refresh `me` in case my profile changed (but keep any active preview)
      if (authUser) {
        var mine = findMemberByEmail(authUser.email);
        if (mine) { realMe = mine; resolveMe(); }
      }
      emitChange();
    }));
    unsubs.push(db.collection("tasks").onSnapshot(function (snap) {
      state.tasks = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      emitChange();
    }));
    unsubs.push(db.collection("docSections").onSnapshot(function (snap) {
      state.docSections = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      state.docSections.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      emitChange();
    }));
    unsubs.push(db.collection("docs").onSnapshot(function (snap) {
      state.docs = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      emitChange();
    }));
    unsubs.push(db.collection("cities").onSnapshot(function (snap) {
      state.cities = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      state.cities.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      emitChange();
    }));
    unsubs.push(db.collection("meta").doc("departments").onSnapshot(function (doc) {
      var d = doc.data();
      state.departments = (d && d.list) ? d.list.slice() : [];
      emitChange();
    }));
    unsubs.push(db.collection("studios").onSnapshot(function (snap) {
      state.studios = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      state.studios.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      emitChange();
    }));
    unsubs.push(db.collection("studioTasks").onSnapshot(function (snap) {
      state.studioTasks = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      emitChange();
    }));
    unsubs.push(db.collection("studioArchive").onSnapshot(function (snap) {
      state.studioArchive = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      emitChange();
    }));
    unsubs.push(db.collection("suppliers").onSnapshot(function (snap) {
      state.suppliers = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      emitChange();
    }));
    unsubs.push(db.collection("tickets").onSnapshot(function (snap) {
      state.tickets = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      emitChange();
    }));
  }
  function fbListenNotifications() {
    if (!me) return;
    unsubs.push(db.collection("notifications").where("userId", "==", me.id)
      .onSnapshot(function (snap) {
        state.notifications = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        emitChange();
      }));
  }

  function fbSeedIfEmpty() {
    return db.collection("team").limit(1).get().then(function (snap) {
      if (!snap.empty) return;
      var batch = db.batch();
      TEAM_SEED.forEach(function (m) {
        var copy = Object.assign({}, m); delete copy.id;
        batch.set(db.collection("team").doc(m.id), copy);
        // security rules identify people by an email → member mapping
        if (m.email) {
          batch.set(db.collection("emails").doc(m.email.toLowerCase()),
            { memberId: m.id, role: m.role });
        }
      });
      DOC_SECTIONS_SEED.forEach(function (s, i) {
        batch.set(db.collection("docSections").doc(s.id), { name: s.name, order: i });
      });
      CITIES_SEED.forEach(function (c, i) {
        var copy = Object.assign({ order: i }, c); delete copy.id;
        batch.set(db.collection("cities").doc(c.id), copy);
      });
      batch.set(db.collection("meta").doc("departments"), { list: DEPARTMENTS_SEED.slice() });
      STUDIOS_SEED.forEach(function (s, i) {
        batch.set(db.collection("studios").doc(s.id), { cityId: s.cityId, name: s.name, order: i, ownerOnly: !!s.ownerOnly });
        DEFAULT_STUDIO_CHECKLIST.forEach(function (text) {
          var id = uid();
          batch.set(db.collection("studioTasks").doc(id), { studioId: s.id, text: text, recurring: true, done: false, checkedAt: 0, notes: "", actions: "", weekOf: "" });
        });
      });
      Object.keys(STUDIO_ACCESS_SEED).forEach(function (mid) {
        batch.update(db.collection("team").doc(mid), { studioAccess: STUDIO_ACCESS_SEED[mid] });
      });
      SUPPLIERS_SEED.forEach(function (s) {
        var copy = Object.assign({}, s); delete copy.id;
        batch.set(db.collection("suppliers").doc(s.id), copy);
      });
      return batch.commit();
    });
  }

  function findMemberByEmail(email) {
    if (!email) return null;
    var e = email.toLowerCase().trim();
    return state.team.find(function (m) { return (m.email || "").toLowerCase().trim() === e; }) || null;
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */
  var api = {};
  api.mode = MODE;

  api.onChange = function (cb) { changeListeners.push(cb); };
  api.onAuth = function (cb) { authListeners.push(cb); };

  api.init = function () {
    if (MODE === "demo") {
      demoLoad();
      // clear legacy identity keys that could otherwise hijack who you open as
      localStorage.removeItem("ybhq_demo_user");
      localStorage.removeItem("ybhq_demo_preview");
      // the login page is a gate — show it first, unless already signed in on this device
      if (localStorage.getItem("ybhq_demo_signedin") === "1") {
        demoResolveIdentity();
        setTimeout(function () { emitAuth("in"); }, 0);
      } else {
        setTimeout(function () { emitAuth("out"); }, 0);
      }
      return;
    }
    fbLoadSdk().then(function () {
      firebase.initializeApp(FIREBASE_CONFIG);
      fbAuth = firebase.auth();
      db = firebase.firestore();
      fbStorage = firebase.storage();
      // keep people signed in across refreshes and browser restarts
      fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
      fbAuth.onAuthStateChanged(function (user) {
        authUser = user;
        if (!user) { me = null; emitAuth("out"); return; }
        // load team once to resolve who this is
        db.collection("team").get().then(function (snap) {
          state.team = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
          realMe = findMemberByEmail(user.email); resolveMe();
          if (!realMe) {
            // maybe first-ever login: seed then re-check
            fbSeedIfEmpty().then(function () {
              return db.collection("team").get();
            }).then(function (snap2) {
              state.team = snap2.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
              realMe = findMemberByEmail(user.email); resolveMe();
              if (realMe) { fbListen(); fbListenNotifications(); emitAuth("in"); }
              else emitAuth("denied");
            }).catch(function () { emitAuth("denied"); });
            return;
          }
          fbListen(); fbListenNotifications(); emitAuth("in");
        }).catch(function () {
          // a non-team account can't even read the team list → show the gate,
          // not a hang, with a "try a different account" way out
          emitAuth("denied");
        });
      });
    }).catch(function (e) {
      console.error("Firebase failed to load", e);
      emitAuth("error");
    });
  };

  /* demo mode: resolve the default account (you) so log in / out can round-trip */
  function demoResolveIdentity() {
    var realId = localStorage.getItem("ybhq_demo_realuser") || "nikki-chadwick";
    realMe = state.team.find(function (m) { return m.id === realId; })
      || state.team.find(function (m) { return m.id === "nikki-chadwick"; })
      || state.team[0];
    previewId = null;   // always open as yourself; "Preview as" is session-only
    resolveMe();
  }

  api.signInGoogle = function () {
    if (MODE === "demo") {
      localStorage.setItem("ybhq_demo_signedin", "1");   // remember the sign-in on this device
      demoResolveIdentity(); emitAuth("in"); return Promise.resolve();
    }
    var provider = new firebase.auth.GoogleAuthProvider();
    // always let people choose which Google account (so they can switch)
    provider.setCustomParameters({ prompt: "select_account" });
    return fbAuth.signInWithPopup(provider);
  };
  api.signOut = function () {
    if (MODE === "demo") {
      localStorage.removeItem("ybhq_demo_signedin");
      me = null; realMe = null; previewId = null; emitAuth("out"); return Promise.resolve();
    }
    unsubs.forEach(function (u) { u(); }); unsubs = [];
    return fbAuth.signOut();
  };
  api.authEmail = function () { return authUser ? authUser.email : (me ? me.email : ""); };

  /* ---- identity & permissions ----
     Access levels (see ROLES in config.js):
       owner-dev     — access + edit everything (Settings, team, roles, docs)
       owner         — access everything (docs editing, Settings view)
       studio-admin  — assign tasks to anyone
       manager-admin — assign tasks within own department
       team          — assign tasks to self only                       */
  api.me = function () { return me; };
  function roleOf(m) { m = m || me; return m ? m.role : "team"; }
  api.isOwnerDev = function (m) { return roleOf(m) === "owner-dev"; };
  api.canManageTeam = function (m) { return roleOf(m) === "owner-dev"; };
  /* add / remove team members — both Ownership tiers */
  api.canAddRemoveMembers = function (m) { var r = roleOf(m); return r === "owner-dev" || r === "owner"; };
  /* create KPIs — both Ownership tiers */
  api.canAddKpi = function (m) { var r = roleOf(m); return r === "owner-dev" || r === "owner"; };
  api.canViewSettings = function (m) { var r = roleOf(m); return r === "owner-dev" || r === "owner"; };
  api.canEditDocs = function (m) { var r = roleOf(m); return r === "owner-dev" || r === "owner"; };
  api.assignScope = function (m) {
    var r = roleOf(m);
    if (r === "owner-dev" || r === "owner" || r === "studio-admin") return "all";
    if (r === "manager-admin") return "dept";
    return "self";
  };
  api.canAssignOthers = function (m) { return api.assignScope(m) !== "self"; };
  api.assignableMembers = function (m) {
    m = m || me;
    var scope = api.assignScope(m);
    if (scope === "all") return api.team();
    if (scope === "dept") return api.team().filter(function (t) { return t.id === m.id || api.sharesDept(t, m); });
    return [m];
  };

  /* ---- Preview as (both Ownership tiers) ----
     Owners and Owner-Developers can view the HQ exactly as any teammate
     sees it. The genuine account is kept in `realMe`, so previewing a
     lower-access role never hides the switcher or traps you.            */
  function resolveMe() {
    var pv = previewId && state.team.find(function (m) { return m.id === previewId; });
    me = pv || realMe;
  }
  api.realMe = function () { return realMe || me; };
  api.isPreviewing = function () { return !!(previewId && realMe && previewId !== realMe.id); };
  api.canPreviewAs = function () {
    var r = realMe || me;
    return !!r && (r.role === "owner-dev" || r.role === "owner");
  };
  api.previewAs = function (id) {
    if (!api.canPreviewAs()) return;
    var real = realMe || me;
    // session-only: previewing doesn't persist, so a fresh open is always you
    previewId = (id && id !== real.id) ? id : null;
    resolveMe();
    emitChange(); emitAuth("in");
  };
  /* back-compat alias */
  api.demoSwitchUser = function (id) { api.previewAs(id); };

  /* ---- snapshots ---- */
  api.team = function () {
    return state.team.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
  };
  api.member = function (id) { return state.team.find(function (m) { return m.id === id; }) || null; };
  api.tasks = function () { return state.tasks.slice(); };
  api.task = function (id) { return state.tasks.find(function (t) { return t.id === id; }) || null; };
  api.myNotifications = function () {
    if (!me) return [];
    return state.notifications
      .filter(function (n) { return n.userId === me.id; })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
  };
  api.cities = function () { return state.cities.slice(); };
  api.city = function (id) { return state.cities.find(function (c) { return c.id === id; }) || null; };
  api.departments = function () { return state.departments.slice(); };
  api.studios = function () { return state.studios.slice(); };
  api.studiosInCity = function (cityId) { return state.studios.filter(function (s) { return s.cityId === cityId; }); };
  api.studioTasks = function (studioId) { return state.studioTasks.filter(function (t) { return t.studioId === studioId; }); };
  /* which cities' studios can this member see? Ownership tiers see all. */
  api.studioCitiesFor = function (m) {
    m = m || me;
    if (!m) return [];
    if (api.canViewSettings(m)) return state.cities.map(function (c) { return c.id; });
    return (m.studioAccess || []).slice();
  };
  api.canAccessStudios = function (m) { return api.studioCitiesFor(m).length > 0; };
  api.docSections = function () { return state.docSections.slice(); };
  api.docs = function () { return state.docs.slice(); };
  api.doc = function (id) { return state.docs.find(function (d) { return d.id === id; }) || null; };

  /* ---- team mutations ---- */
  api.updateMember = function (id, patch) {
    if (MODE === "demo") {
      var m = state.team.find(function (t) { return t.id === id; });
      if (m) Object.assign(m, patch);
      demoSave(); emitChange();
      return Promise.resolve();
    }
    // keep the email → member security mapping in sync
    var before = api.member(id) || {};
    var oldEmail = (before.email || "").toLowerCase().trim();
    var newEmail = ("email" in patch ? patch.email : oldEmail || "").toLowerCase().trim();
    var newRole = "role" in patch ? patch.role : before.role;
    var batch = db.batch();
    batch.update(db.collection("team").doc(id), patch);
    if (oldEmail && oldEmail !== newEmail) batch.delete(db.collection("emails").doc(oldEmail));
    if (newEmail) batch.set(db.collection("emails").doc(newEmail), { memberId: id, role: newRole });
    return batch.commit();
  };

  api.addMember = function (data) {
    var base = (data.name || "member").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member";
    var id = base, n = 2;
    while (state.team.some(function (t) { return t.id === id; })) { id = base + "-" + n; n++; }
    var m = {
      id: id, name: data.name, title: data.title || "",
      role: data.role || "team",
      depts: (data.depts && data.depts.length) ? data.depts.slice() : [state.departments[0] || DEPARTMENTS_SEED[0]],
      city: data.city || DEFAULT_CITY,
      email: (data.email || "").toLowerCase().trim(), pronouns: ""
    };
    if (MODE === "demo") {
      state.team.push(m);
      demoSave(); emitChange();
      return Promise.resolve(id);
    }
    var batch = db.batch();
    var copy = Object.assign({}, m); delete copy.id;
    batch.set(db.collection("team").doc(id), copy);
    if (m.email) batch.set(db.collection("emails").doc(m.email), { memberId: id, role: m.role });
    return batch.commit().then(function () { return id; });
  };

  api.deleteMember = function (id) {
    var m = api.member(id) || {};
    if (MODE === "demo") {
      state.team = state.team.filter(function (t) { return t.id !== id; });
      // tidy up: unassign their tasks and drop their notifications
      state.tasks.forEach(function (t) {
        t.assigneeIds = t.assigneeIds.filter(function (a) { return a !== id; });
      });
      state.notifications = state.notifications.filter(function (n) { return n.userId !== id; });
      demoSave(); emitChange();
      return Promise.resolve();
    }
    var batch = db.batch();
    batch.delete(db.collection("team").doc(id));
    if (m.email) batch.delete(db.collection("emails").doc(m.email.toLowerCase().trim()));
    return batch.commit();
  };

  /* ---- notifications ---- */
  function pushNotification(n) {
    n.id = uid(); n.read = false; n.createdAt = now();
    if (MODE === "demo") {
      state.notifications.push(n);
      demoSave(); emitChange();
      return Promise.resolve();
    }
    return db.collection("notifications").doc(n.id).set(n);
  }
  api.notify = function (userIds, base) {
    // never notify yourself
    var targets = (userIds || []).filter(function (id, i, arr) {
      return id && id !== me.id && arr.indexOf(id) === i;
    });
    return Promise.all(targets.map(function (userId) {
      return pushNotification(Object.assign({ userId: userId, actorId: me.id }, base));
    }));
  };
  api.markRead = function (ids) {
    if (MODE === "demo") {
      state.notifications.forEach(function (n) { if (ids.indexOf(n.id) !== -1) n.read = true; });
      demoSave(); emitChange();
      return Promise.resolve();
    }
    var batch = db.batch();
    ids.forEach(function (id) { batch.update(db.collection("notifications").doc(id), { read: true }); });
    return batch.commit();
  };
  api.markAllRead = function () {
    var ids = api.myNotifications().filter(function (n) { return !n.read; }).map(function (n) { return n.id; });
    if (!ids.length) return Promise.resolve();
    return api.markRead(ids);
  };

  /* ---- tasks ---- */
  api.createTask = function (data) {
    var t = Object.assign({
      title: "", description: "", assigneeIds: [], assignedBy: me.id,
      status: "to-do", priority: "med", dueDate: "", isKpi: false,
      recurrence: { freq: "none", days: [] }, subtasks: [], comments: []
    }, data, { id: uid(), createdAt: now(), assignedBy: me.id, createdCity: me.city });
    var done;
    if (MODE === "demo") {
      state.tasks.push(t); demoSave(); emitChange();
      done = Promise.resolve();
    } else {
      var copy = Object.assign({}, t); delete copy.id;
      done = db.collection("tasks").doc(t.id).set(copy);
    }
    return done.then(function () {
      return api.notify(t.assigneeIds, {
        type: "assigned", taskId: t.id,
        text: "assigned you a task: “" + t.title + "”"
      });
    }).then(function () { return t.id; });
  };

  /* ---- recurrence: work out the next due date ---- */
  function toISOd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function nextDueDate(rec, fromISO) {
    var base = fromISO ? new Date(fromISO + "T00:00:00") : new Date();
    base.setHours(0, 0, 0, 0);
    if (rec.freq === "weekly") {
      var days = (rec.days && rec.days.length) ? rec.days : [base.getDay()];
      for (var i = 1; i <= 7; i++) {
        var d = new Date(base); d.setDate(base.getDate() + i);
        if (days.indexOf(d.getDay()) !== -1) return toISOd(d);
      }
      return toISOd(base);
    }
    var n = new Date(base);
    if (rec.freq === "monthly") n.setMonth(n.getMonth() + 1);
    else if (rec.freq === "quarterly") n.setMonth(n.getMonth() + 3);
    else if (rec.freq === "yearly") n.setFullYear(n.getFullYear() + 1);
    else return "";
    return toISOd(n);
  }
  /* spawn the next occurrence of a recurring task once it's completed */
  function spawnNextOccurrence(before) {
    var rec = before.recurrence;
    var nd = nextDueDate(rec, before.dueDate);
    if (!nd) return Promise.resolve();
    var t = {
      id: uid(), title: before.title, description: before.description || "",
      assigneeIds: (before.assigneeIds || []).slice(),
      assignedBy: before.assignedBy,   // keep the original assigner
      createdCity: before.createdCity || (api.member(before.assignedBy) || {}).city || DEFAULT_CITY,
      status: nd === toISOd(new Date()) ? "due-today" : "to-do",
      priority: before.priority, dueDate: nd, isKpi: !!before.isKpi,
      recurrence: { freq: rec.freq, days: (rec.days || []).slice() },
      subtasks: (before.subtasks || []).map(function (s) { return { id: uid(), text: s.text, done: false }; }),
      comments: [], createdAt: now()
    };
    var done;
    if (MODE === "demo") {
      state.tasks.push(t); demoSave(); emitChange();
      done = Promise.resolve();
    } else {
      var copy = Object.assign({}, t); delete copy.id;
      done = db.collection("tasks").doc(t.id).set(copy);
    }
    return done.then(function () {
      return api.notify(t.assigneeIds, {
        type: "assigned", taskId: t.id,
        text: "recurring task is due again: “" + t.title + "”"
      });
    });
  }

  api.updateTask = function (id, patch, opts) {
    opts = opts || {};
    var before = api.task(id);
    var newAssignees = [];
    if (patch.assigneeIds && before) {
      newAssignees = patch.assigneeIds.filter(function (a) { return before.assigneeIds.indexOf(a) === -1; });
    }
    var becameComplete = patch.status === "complete" && before && before.status !== "complete";
    var isRecurring = before && before.recurrence && before.recurrence.freq && before.recurrence.freq !== "none";
    var done;
    if (MODE === "demo") {
      var t = state.tasks.find(function (x) { return x.id === id; });
      if (t) Object.assign(t, patch);
      demoSave(); emitChange();
      done = Promise.resolve();
    } else {
      done = db.collection("tasks").doc(id).update(patch);
    }
    return done.then(function () {
      if (newAssignees.length && !opts.silent) {
        return api.notify(newAssignees, {
          type: "assigned", taskId: id,
          text: "assigned you a task: “" + (patch.title || before.title) + "”"
        });
      }
    }).then(function () {
      if (becameComplete && isRecurring && !opts.noRecur) return spawnNextOccurrence(before);
    });
  };

  api.deleteTask = function (id) {
    if (MODE === "demo") {
      state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
      demoSave(); emitChange();
      return Promise.resolve();
    }
    return db.collection("tasks").doc(id).delete();
  };

  /* any To Do task whose due date is today jumps into the Due Today column —
     runs on load and on a timer so it keeps up as the day rolls over */
  api.promoteDueToday = function () {
    var today = toISOd(new Date());
    var changed = [];
    state.tasks.forEach(function (t) {
      if (t.status === "to-do" && t.dueDate === today) { t.status = "due-today"; changed.push(t.id); }
    });
    if (!changed.length) return false;
    if (MODE === "demo") { demoSave(); emitChange(); return true; }
    var batch = db.batch();
    changed.forEach(function (id) { batch.update(db.collection("tasks").doc(id), { status: "due-today" }); });
    batch.commit();
    return true;
  };

  api.addComment = function (taskId, text, mentionIds) {
    var t = api.task(taskId);
    if (!t) return Promise.resolve();
    var c = { id: uid(), authorId: me.id, text: text, mentionIds: mentionIds || [], createdAt: now() };
    var done;
    if (MODE === "demo") {
      t.comments = t.comments || [];
      t.comments.push(c);
      demoSave(); emitChange();
      done = Promise.resolve();
    } else {
      done = db.collection("tasks").doc(taskId).update({
        comments: firebase.firestore.FieldValue.arrayUnion(c)
      });
    }
    return done.then(function () {
      var short = text.length > 60 ? text.slice(0, 60) + "…" : text;
      // mentions get a mention notification…
      var p1 = api.notify(mentionIds || [], {
        type: "mention", taskId: taskId,
        text: "mentioned you on “" + t.title + "”: " + short
      });
      // …assignees (not already mentioned) get a comment notification
      var rest = (t.assigneeIds || []).filter(function (id) { return (mentionIds || []).indexOf(id) === -1; });
      var p2 = api.notify(rest, {
        type: "comment", taskId: taskId,
        text: "commented on “" + t.title + "”: " + short
      });
      return Promise.all([p1, p2]);
    });
  };

  /* ---- docs ---- */
  api.addSection = function (name) {
    var s = { id: uid(), name: name, order: state.docSections.length };
    if (MODE === "demo") {
      state.docSections.push(s); demoSave(); emitChange();
      return Promise.resolve();
    }
    var copy = { name: s.name, order: s.order };
    return db.collection("docSections").doc(s.id).set(copy);
  };
  api.renameSection = function (id, name) {
    if (MODE === "demo") {
      var s = state.docSections.find(function (x) { return x.id === id; });
      if (s) s.name = name;
      demoSave(); emitChange();
      return Promise.resolve();
    }
    return db.collection("docSections").doc(id).update({ name: name });
  };
  api.deleteSection = function (id) {
    var docsIn = state.docs.filter(function (d) { return d.sectionId === id; });
    return Promise.all(docsIn.map(function (d) { return api.deleteDoc(d.id); })).then(function () {
      if (MODE === "demo") {
        state.docSections = state.docSections.filter(function (s) { return s.id !== id; });
        demoSave(); emitChange();
        return Promise.resolve();
      }
      return db.collection("docSections").doc(id).delete();
    });
  };

  /* can this member see this document?
     Owners see everything; otherwise the doc must be public, theirs,
     shared with them, or assigned to them. */
  api.canSeeDoc = function (doc, m) {
    m = m || me;
    if (!doc) return false;
    if (api.canEditDocs(m)) return true;
    if ((doc.visibility || "everyone") === "everyone") return true;
    if (doc.uploadedBy === m.id) return true;
    if ((doc.viewerIds || []).indexOf(m.id) !== -1) return true;
    if ((doc.assigneeIds || []).indexOf(m.id) !== -1) return true;
    return false;
  };

  api.setDocVisibility = function (id, visibility, viewerIds) {
    var patch = { visibility: visibility, viewerIds: visibility === "restricted" ? (viewerIds || []) : [] };
    if (MODE === "demo") {
      var d = api.doc(id);
      if (d) Object.assign(d, patch);
      demoSave(); emitChange();
      return Promise.resolve();
    }
    return db.collection("docs").doc(id).update(patch);
  };

  /* ---- cities / timezones ---- */
  api.addCity = function (name, tz, dialExample) {
    var base = (name || "city").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "city";
    var id = base, n = 2;
    while (state.cities.some(function (c) { return c.id === id; })) { id = base + "-" + n; n++; }
    var c = { id: id, label: name, tz: tz, dialExample: dialExample || "", order: state.cities.length };
    if (MODE === "demo") {
      state.cities.push(c); demoSave(); emitChange();
      return Promise.resolve(id);
    }
    var copy = Object.assign({}, c); delete copy.id;
    return db.collection("cities").doc(id).set(copy).then(function () { return id; });
  };
  api.deleteCity = function (id) {
    // reassign anyone in this city to the first remaining city
    var remaining = state.cities.filter(function (c) { return c.id !== id; });
    var fallback = remaining.length ? remaining[0].id : DEFAULT_CITY;
    var affected = state.team.filter(function (m) { return m.city === id; });
    return Promise.all(affected.map(function (m) { return api.updateMember(m.id, { city: fallback }); }))
      .then(function () {
        if (MODE === "demo") {
          state.cities = state.cities.filter(function (c) { return c.id !== id; });
          demoSave(); emitChange();
          return Promise.resolve();
        }
        return db.collection("cities").doc(id).delete();
      });
  };

  /* ---- supplier contacts (Ownership tiers only) ---- */
  api.suppliers = function () {
    return state.suppliers.slice().sort(function (a, b) {
      return (a.category || "").localeCompare(b.category || "") || (a.name || "").localeCompare(b.name || "");
    });
  };
  /* the seed categories plus any custom ones already in use, for filters + suggestions */
  api.supplierCategories = function () {
    var set = {};
    SUPPLIER_CATEGORIES.forEach(function (c) { set[c] = true; });
    state.suppliers.forEach(function (s) { if (s.category) set[s.category] = true; });
    return Object.keys(set).sort();
  };
  api.addSupplier = function (data) {
    var s = {
      id: uid(), name: data.name || "", company: data.company || "", category: data.category || "",
      phone: data.phone || "", email: data.email || "", cityId: data.cityId || "", createdAt: now()
    };
    if (MODE === "demo") { state.suppliers.push(s); demoSave(); emitChange(); return Promise.resolve(s.id); }
    var copy = Object.assign({}, s); delete copy.id;
    return db.collection("suppliers").doc(s.id).set(copy).then(function () { return s.id; });
  };
  api.updateSupplier = function (id, patch) {
    if (MODE === "demo") {
      var s = state.suppliers.find(function (x) { return x.id === id; });
      if (s) Object.assign(s, patch);
      demoSave(); emitChange(); return Promise.resolve();
    }
    return db.collection("suppliers").doc(id).update(patch);
  };
  api.deleteSupplier = function (id) {
    if (MODE === "demo") {
      state.suppliers = state.suppliers.filter(function (x) { return x.id !== id; });
      demoSave(); emitChange(); return Promise.resolve();
    }
    return db.collection("suppliers").doc(id).delete();
  };

  /* ---- departments (managed list of names; Ownership & Developer) ---- */
  function saveDepartments(affected) {
    if (MODE === "demo") { demoSave(); emitChange(); return Promise.resolve(); }
    var batch = db.batch();
    batch.set(db.collection("meta").doc("departments"), { list: state.departments.slice() });
    (affected || []).forEach(function (m) { batch.update(db.collection("team").doc(m.id), { depts: m.depts }); });
    return batch.commit();
  }
  api.addDepartment = function (name) {
    name = (name || "").trim();
    if (!name || state.departments.some(function (d) { return d.toLowerCase() === name.toLowerCase(); })) return Promise.resolve();
    state.departments.push(name);
    return saveDepartments();
  };
  api.renameDepartment = function (oldName, newName) {
    newName = (newName || "").trim();
    var i = state.departments.indexOf(oldName);
    if (!newName || i === -1) return Promise.resolve();
    state.departments[i] = newName;
    var affected = state.team.filter(function (m) { return (m.depts || []).indexOf(oldName) !== -1; });
    affected.forEach(function (m) { m.depts = m.depts.map(function (d) { return d === oldName ? newName : d; }); });
    return saveDepartments(affected);
  };
  api.deleteDepartment = function (name) {
    state.departments = state.departments.filter(function (d) { return d !== name; });
    var affected = state.team.filter(function (m) { return (m.depts || []).indexOf(name) !== -1; });
    affected.forEach(function (m) { m.depts = m.depts.filter(function (d) { return d !== name; }); });
    return saveDepartments(affected);
  };
  api.sharesDept = function (a, b) {
    var ad = (a && a.depts) || [], bd = (b && b.depts) || [];
    return ad.some(function (d) { return bd.indexOf(d) !== -1; });
  };

  /* ---- studio checklist tasks ---- */
  function mondayOf(d) {
    var x = new Date(d); x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return toISOd(x);
  }
  /* shift a week-of (Monday) string by whole weeks, staying a Monday */
  function shiftWeekStr(weekOf, delta) {
    var d = new Date(weekOf + "T00:00:00");
    d.setDate(d.getDate() + delta * 7);
    return mondayOf(d);
  }
  var MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  api.currentWeek = function () { return mondayOf(new Date()); };
  api.shiftWeek = function (weekOf, delta) { return shiftWeekStr(weekOf, delta); };
  api.weekRangeLabel = function (weekOf) {
    var start = new Date(weekOf + "T00:00:00");
    var end = new Date(start); end.setDate(end.getDate() + 6);
    if (start.getMonth() === end.getMonth())
      return start.getDate() + "–" + end.getDate() + " " + MON_SHORT[end.getMonth()] + " " + end.getFullYear();
    return start.getDate() + " " + MON_SHORT[start.getMonth()] + " – " + end.getDate() + " " + MON_SHORT[end.getMonth()] + " " + end.getFullYear();
  };
  /* archived checklist snapshot for a studio in a past week (or null) */
  api.studioArchiveFor = function (studioId, weekOf) {
    var r = (state.studioArchive || []).find(function (a) { return a.studioId === studioId && a.weekOf === weekOf; });
    return r ? r.items : null;
  };
  /* the past weeks (ascending) we hold an archive for, for one studio */
  api.studioArchiveWeeks = function (studioId) {
    return (state.studioArchive || [])
      .filter(function (a) { return a.studioId === studioId; })
      .map(function (a) { return a.weekOf; })
      .sort();
  };
  /* the most recent archived week before this one (for "last week" views) */
  api.lastArchivedWeek = function () {
    var wk = mondayOf(new Date());
    var weeks = (state.studioArchive || []).map(function (a) { return a.weekOf; })
      .filter(function (w) { return w < wk; });
    weeks.sort();
    return weeks.length ? weeks[weeks.length - 1] : null;
  };
  /* snapshot a studio's current checklist under a closing week (once) */
  function archiveStudioWeek(studioId, weekOf) {
    if (state.studioArchive.some(function (a) { return a.studioId === studioId && a.weekOf === weekOf; })) return null;
    var items = state.studioTasks.filter(function (t) { return t.studioId === studioId; }).map(function (t) {
      return { text: t.text, recurring: t.recurring, done: t.done, checkedAt: t.checkedAt, notes: t.notes, actions: t.actions };
    });
    var rec = { id: uid(), weekOf: weekOf, studioId: studioId, items: items };
    state.studioArchive.push(rec);
    return rec;
  }
  /* create a studio in a city, seeded with the standard weekly checklist —
     it appears immediately as a tab under that city in Studio Checklist */
  api.addStudio = function (cityId, name, ownerOnly) {
    var s = { id: uid(), cityId: cityId, name: name, ownerOnly: !!ownerOnly, order: state.studios.length };
    var seed = studioTaskSeed(s.id);
    if (MODE === "demo") {
      state.studios.push(s);
      state.studioTasks = state.studioTasks.concat(seed);
      demoSave(); emitChange();
      return Promise.resolve(s.id);
    }
    var batch = db.batch();
    batch.set(db.collection("studios").doc(s.id), { cityId: cityId, name: name, ownerOnly: !!ownerOnly, order: s.order });
    seed.forEach(function (t) { var c = Object.assign({}, t); delete c.id; batch.set(db.collection("studioTasks").doc(t.id), c); });
    return batch.commit().then(function () { return s.id; });
  };
  api.deleteStudio = function (id) {
    var doomedTasks = state.studioTasks.filter(function (t) { return t.studioId === id; });
    if (MODE === "demo") {
      state.studios = state.studios.filter(function (s) { return s.id !== id; });
      state.studioTasks = state.studioTasks.filter(function (t) { return t.studioId !== id; });
      demoSave(); emitChange();
      return Promise.resolve();
    }
    var batch = db.batch();
    batch.delete(db.collection("studios").doc(id));
    doomedTasks.forEach(function (t) { batch.delete(db.collection("studioTasks").doc(t.id)); });
    return batch.commit();
  };
  api.addStudioTask = function (studioId, text, recurring) {
    var t = { id: uid(), studioId: studioId, text: text, recurring: !!recurring, done: false, checkedAt: 0, notes: "", actions: "", weekOf: recurring ? mondayOf(new Date()) : "" };
    var studio = state.studios.find(function (s) { return s.id === studioId; });
    var done;
    if (MODE === "demo") { state.studioTasks.push(t); demoSave(); emitChange(); done = Promise.resolve(); }
    else { var copy = Object.assign({}, t); delete copy.id; done = db.collection("studioTasks").doc(t.id).set(copy); }
    return done.then(function () {
      // notify the studio manager(s) for that studio's city
      if (studio) {
        var managers = state.team
          .filter(function (m) { return (m.studioAccess || []).indexOf(studio.cityId) !== -1; })
          .map(function (m) { return m.id; });
        return api.notify(managers, {
          type: "studio", studioId: studioId, cityId: studio.cityId,
          text: "added a new checklist item to " + studio.name + ": “" + text + "”"
        });
      }
    }).then(function () { return t.id; });
  };
  /* when every item in a studio is ticked, tell the Ownership tiers
     (once per week per studio) which studio has been fully checked off */
  api.checkStudioComplete = function (studioId) {
    var tasks = state.studioTasks.filter(function (t) { return t.studioId === studioId; });
    if (!tasks.length || !tasks.every(function (t) { return t.done; })) return Promise.resolve();
    var studio = state.studios.find(function (s) { return s.id === studioId; });
    if (!studio) return Promise.resolve();
    var wk = mondayOf(new Date());
    if (studio.completedWeek === wk) return Promise.resolve();
    studio.completedWeek = wk;
    if (MODE === "demo") demoSave();
    else db.collection("studios").doc(studioId).update({ completedWeek: wk });
    var cityLabel = (api.city(studio.cityId) || {}).label || "";
    var owners = state.team.filter(function (m) { return m.role === "owner-dev" || m.role === "owner"; }).map(function (m) { return m.id; });
    return api.notify(owners, {
      type: "studio", studioId: studioId, cityId: studio.cityId,
      text: "checked off the last item — " + studio.name + (cityLabel ? " (" + cityLabel + ")" : "") + " is fully checked this week"
    });
  };
  api.updateStudioTask = function (id, patch) {
    var t = state.studioTasks.find(function (x) { return x.id === id; });
    if (t && t.recurring) patch = Object.assign({ weekOf: mondayOf(new Date()) }, patch);
    if (MODE === "demo") {
      if (t) Object.assign(t, patch);
      demoSave(); emitChange(); return Promise.resolve();
    }
    return db.collection("studioTasks").doc(id).update(patch);
  };
  api.deleteStudioTask = function (id) {
    if (MODE === "demo") {
      state.studioTasks = state.studioTasks.filter(function (t) { return t.id !== id; });
      demoSave(); emitChange(); return Promise.resolve();
    }
    return db.collection("studioTasks").doc(id).delete();
  };
  /* recurring checks reset at the start of each week so they need doing
     again — but first we archive the closing week so it can be viewed
     later under "last week" in Studio Checklist and Team Reports */
  api.resetWeeklyStudioTasks = function () {
    var wk = mondayOf(new Date());
    var toReset = state.studioTasks.filter(function (t) { return t.recurring && t.weekOf !== wk; });
    if (!toReset.length) return false;

    // per studio, the most recent real past week we're closing out
    var closing = {};
    toReset.forEach(function (t) {
      if (t.weekOf && t.weekOf < wk) {
        if (!closing[t.studioId] || t.weekOf > closing[t.studioId]) closing[t.studioId] = t.weekOf;
      }
    });
    var newArchives = [];
    Object.keys(closing).forEach(function (sid) {
      var rec = archiveStudioWeek(sid, closing[sid]);
      if (rec) newArchives.push(rec);
      var s = state.studios.find(function (x) { return x.id === sid; });
      if (s) delete s.completedWeek;   // a fresh week can be completed & re-notify
    });

    var changed = [];
    toReset.forEach(function (t) {
      t.done = false; t.checkedAt = 0; t.notes = ""; t.actions = ""; t.weekOf = wk;
      changed.push(t.id);
    });

    if (MODE === "demo") { demoSave(); emitChange(); return true; }
    var batch = db.batch();
    newArchives.forEach(function (rec) {
      var c = Object.assign({}, rec); delete c.id;
      batch.set(db.collection("studioArchive").doc(rec.id), c);
    });
    Object.keys(closing).forEach(function (sid) { batch.update(db.collection("studios").doc(sid), { completedWeek: firebase.firestore.FieldValue.delete() }); });
    changed.forEach(function (id) { batch.update(db.collection("studioTasks").doc(id), { done: false, checkedAt: 0, notes: "", actions: "", weekOf: wk }); });
    batch.commit();
    return true;
  };

  api.uploadDoc = function (sectionId, file) {
    var d = {
      id: uid(), sectionId: sectionId, name: file.name,
      size: file.size, uploadedBy: me.id, uploadedAt: now(),
      assigneeIds: [], visibility: "everyone", viewerIds: []
    };
    if (MODE === "demo") {
      return idbPut(d.id, file).then(function () {
        state.docs.push(d); demoSave(); emitChange();
        return d.id;
      });
    }
    var ref = fbStorage.ref("docs/" + d.id + ".pdf");
    return ref.put(file).then(function () { return ref.getDownloadURL(); }).then(function (url) {
      var copy = Object.assign({}, d, { url: url }); delete copy.id;
      return db.collection("docs").doc(d.id).set(copy);
    }).then(function () { return d.id; });
  };

  api.deleteDoc = function (id) {
    if (MODE === "demo") {
      if (urlCache[id]) { URL.revokeObjectURL(urlCache[id]); delete urlCache[id]; }
      return idbDel(id).then(function () {
        state.docs = state.docs.filter(function (d) { return d.id !== id; });
        demoSave(); emitChange();
      });
    }
    return fbStorage.ref("docs/" + id + ".pdf").delete().catch(function () {})
      .then(function () { return db.collection("docs").doc(id).delete(); });
  };

  api.assignDoc = function (id, memberIds) {
    var d = api.doc(id);
    var added = memberIds.filter(function (m) { return d.assigneeIds.indexOf(m) === -1; });
    var done;
    if (MODE === "demo") {
      d.assigneeIds = memberIds;
      demoSave(); emitChange();
      done = Promise.resolve();
    } else {
      done = db.collection("docs").doc(id).update({ assigneeIds: memberIds });
    }
    return done.then(function () {
      return api.notify(added, {
        type: "doc", docId: id,
        text: "assigned you a document: “" + d.name + "”"
      });
    });
  };

  api.getDocUrl = function (doc) {
    if (MODE === "demo") {
      if (urlCache[doc.id]) return Promise.resolve(urlCache[doc.id]);
      return idbGet(doc.id).then(function (blob) {
        if (!blob) return null;
        urlCache[doc.id] = URL.createObjectURL(blob);
        return urlCache[doc.id];
      });
    }
    return Promise.resolve(doc.url || null);
  };

  /* ================= bug / idea tickets =================
     Reporting: both Ownership tiers. Ticket page + resolving: admin only. */
  function ticketSnippet(s) {
    s = (s || "").trim().replace(/\s+/g, " ");
    return s ? (s.length > 48 ? s.slice(0, 48) + "…" : s) : "(no description)";
  }
  api.isTicketAdmin = function (m) { m = m || me; return !!m && m.id === TICKET_ADMIN_ID; };
  api.canReportTickets = function (m) { return api.canViewSettings(m); };
  api.tickets = function () {
    return state.tickets.slice().sort(function (a, b) {
      if ((a.status === "open") !== (b.status === "open")) return a.status === "open" ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  };
  api.ticket = function (id) { return state.tickets.find(function (t) { return t.id === id; }) || null; };
  api.myTickets = function () {
    return state.tickets.filter(function (t) { return t.reporterId === me.id; })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
  };
  api.openTicketCount = function () { return state.tickets.filter(function (t) { return t.status === "open"; }).length; };

  api.addTicket = function (data) {
    var t = {
      id: uid(), type: data.type === "idea" ? "idea" : "bug",
      page: data.page || "", pageLabel: data.pageLabel || "",
      description: data.description || "", screenshots: [],
      reporterId: me.id, createdAt: now(), status: "open",
      comments: [], resolvedAt: 0,
      view: data.view === "mobile" ? "mobile" : "web"   // where the reporter saw it
    };
    var files = data.files || [];
    var uploads = files.map(function (f) {
      var sid = uid();
      var shot = { id: sid, name: f.name };
      if (MODE === "demo") return idbPut(sid, f).then(function () { return shot; });
      var ref = fbStorage.ref("tickets/" + sid);
      return ref.put(f).then(function () { return ref.getDownloadURL(); }).then(function (url) { shot.url = url; return shot; });
    });
    return Promise.all(uploads).then(function (shots) {
      t.screenshots = shots;
      var done;
      if (MODE === "demo") { state.tickets.push(t); demoSave(); emitChange(); done = Promise.resolve(); }
      else { var copy = Object.assign({}, t); delete copy.id; done = db.collection("tickets").doc(t.id).set(copy); }
      return done.then(function () {
        return api.notify([TICKET_ADMIN_ID], {
          type: "ticket", ticketId: t.id,
          text: "reported a " + t.type + (t.pageLabel ? " on " + t.pageLabel : "") + ": “" + ticketSnippet(t.description) + "”"
        });
      }).then(function () { return t.id; });
    });
  };

  api.addTicketComment = function (id, text) {
    var t = api.ticket(id); if (!t || !text) return Promise.resolve();
    var c = { id: uid(), authorId: me.id, text: text, ts: now() };
    t.comments = (t.comments || []).concat([c]);
    var done;
    if (MODE === "demo") { demoSave(); emitChange(); done = Promise.resolve(); }
    else done = db.collection("tickets").doc(id).update({ comments: t.comments });
    return done.then(function () {
      var target = me.id === TICKET_ADMIN_ID ? t.reporterId : TICKET_ADMIN_ID;
      return api.notify([target], {
        type: "ticket", ticketId: id,
        text: "commented on the " + t.type + " report: “" + ticketSnippet(text) + "”"
      });
    });
  };

  api.resolveTicket = function (id, done) {
    var t = api.ticket(id); if (!t) return Promise.resolve();
    t.status = done ? "done" : "open";
    t.resolvedAt = done ? now() : 0;
    var save;
    if (MODE === "demo") { demoSave(); emitChange(); save = Promise.resolve(); }
    else save = db.collection("tickets").doc(id).update({ status: t.status, resolvedAt: t.resolvedAt });
    return save.then(function () {
      if (done) return api.notify([t.reporterId], {
        type: "ticket", ticketId: id,
        text: "marked your " + t.type + " report as done: “" + ticketSnippet(t.description) + "”"
      });
    });
  };

  api.deleteTicket = function (id) {
    var t = api.ticket(id);
    if (MODE === "demo") {
      ((t && t.screenshots) || []).forEach(function (s) {
        idbDel(s.id); if (urlCache[s.id]) { URL.revokeObjectURL(urlCache[s.id]); delete urlCache[s.id]; }
      });
      state.tickets = state.tickets.filter(function (x) { return x.id !== id; });
      demoSave(); emitChange(); return Promise.resolve();
    }
    return db.collection("tickets").doc(id).delete();
  };

  /* object URL (demo) or download URL (firebase) for a ticket screenshot */
  api.getShotUrl = function (shot) {
    if (MODE !== "demo") return Promise.resolve(shot.url || null);
    if (urlCache[shot.id]) return Promise.resolve(urlCache[shot.id]);
    return idbGet(shot.id).then(function (blob) {
      if (!blob) return null;
      urlCache[shot.id] = URL.createObjectURL(blob);
      return urlCache[shot.id];
    });
  };

  return api;
})();
