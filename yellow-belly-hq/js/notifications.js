/* ================================================================
   YELLOW BELLY HQ — notification bell + panel
   ================================================================ */

var Notif = (function () {
  var api = {};
  var open = false;

  function panel() { return document.getElementById("notif-panel"); }

  api.render = function () {
    var list = Store.myNotifications();
    var unread = list.filter(function (n) { return !n.read; }).length;

    var badge = document.getElementById("bell-badge");
    badge.textContent = unread > 9 ? "9+" : unread;
    badge.classList.toggle("hidden", unread === 0);

    var listEl = document.getElementById("notif-list");
    if (!list.length) {
      listEl.innerHTML = '<div class="notif-empty">Nothing yet.<br>You’ll see task assignments, comments and @mentions here.</div>';
      return;
    }
    listEl.innerHTML = "";
    list.slice(0, 50).forEach(function (n) {
      var actor = Store.member(n.actorId);
      var item = UI.el(
        '<button class="notif-item' + (n.read ? "" : " unread") + '">' +
        UI.avatar(actor, "sm") +
        '<div class="notif-body"><b>' + UI.esc(actor ? actor.name : "Someone") + "</b> " +
        UI.esc(n.text) +
        '<div class="notif-time" title="' + UI.esc(UI.absTime(n.createdAt, actor ? actor.city : null)) + '">' + UI.timeAgo(n.createdAt) + "</div></div>" +
        (n.read ? "" : '<span class="notif-dot"></span>') +
        "</button>"
      );
      item.onclick = function () {
        if (!n.read) Store.markRead([n.id]);
        api.toggle(false);
        if (n.taskId && Store.task(n.taskId)) {
          App.go("tasks");
          Tasks.openDetail(n.taskId);
        } else if (n.docId) {
          App.go("docs");
        } else if (n.studioId && Store.canAccessStudios()) {
          Studio.open(n.cityId, n.studioId);
        } else if (n.ticketId && Store.ticket(n.ticketId)) {
          if (Store.isTicketAdmin()) Tickets.openTicket(n.ticketId);
          else Tickets.openReport(n.ticketId);
        }
      };
      listEl.appendChild(item);
    });
  };

  api.toggle = function (force) {
    open = force !== undefined ? force : !open;
    panel().classList.toggle("hidden", !open);
    if (open) api.render();
  };

  api.init = function () {
    document.getElementById("btn-bell").onclick = function (e) {
      e.stopPropagation();
      api.toggle();
    };
    document.getElementById("btn-mark-all-read").onclick = function () {
      Store.markAllRead();
    };
    document.addEventListener("click", function (e) {
      if (open && !e.target.closest(".bell-wrap")) api.toggle(false);
    });
  };

  return api;
})();
