/* shell.js - sidebar, top bar, session guard, shared Notifications page */
var Shell = (function () {
  var NAV = {
    Teacher: [['teacher-dashboard', 'Dashboard'], ['students', 'Students'], ['create-student', 'Create Student'], ['practice', 'Practice Management'], ['tests', 'Online Tests'], ['test-marks', 'Test Marks'], ['progress-log', 'Progress Log'],
      ['leave-requests', 'Leave Approvals'], ['leave-incidents', 'Leave Incidents'], ['reports', 'Reports'], ['notifications', 'Notifications'], ['settings', 'Settings']],
    Student: [['student-dashboard', 'My Dashboard'], ['student-profile', 'My Profile'], ['student-practice', 'My Practice'], ['practice-history', 'Practice History'], ['student-tests', 'Online Tests'], ['student-marks', 'My Marks'], ['student-progress', 'My Progress'],
      ['student-leave', 'Normal Leave Request'], ['student-late', 'Late Leave / Leave Not Reported'], ['student-emergency', 'Emergency Leave'], ['leave-history', 'Leave History'], ['notifications', 'Notifications']]
  };
  var BELL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  var LOGO = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="#fff" fill-opacity=".16"/><path d="M20 9 6 16l14 7 14-7-14-7Z" fill="#06B6D4"/><path d="M11 20.5v6c0 2 4 4.5 9 4.5s9-2.5 9-4.5v-6l-9 4.5-9-4.5Z" fill="#fff"/></svg>';

  function fail(msg) {
    document.body.hidden = false;
    document.body.innerHTML = '<div class="auth-main"><div class="card"><h2>Cannot load this page</h2><p class="sub">' + App.esc(msg) + '</p><button class="btn" id="retry" type="button">Try again</button></div></div>';
    document.getElementById('retry').onclick = function () { location.reload(); };
  }
  async function boot() {
    var role = document.body.dataset.role || (Api.getUser() || {}).role, page = document.body.dataset.page;
    if (!Api.getToken()) { location.replace('index.html'); return; }
    var user;
    try { user = (await Api.call('getMe', {})).data.user; } catch (e) { if (e.code !== 'SESSION_EXPIRED') fail(e.message); return; }
    if (user.role !== role) { location.replace('index.html'); return; }
    var links = NAV[role].map(function (n) { return '<a href="' + n[0] + '.html"' + (n[0] === page ? ' aria-current="page"' : '') + '>' + App.esc(n[1]) + '</a>'; }).join('');
    document.body.innerHTML = '<div class="shell"><nav class="sidebar" id="sidebar" aria-label="Main"><a class="brand" href="' + NAV[role][0][0] + '.html">' + LOGO + '<span>Institute Desk</span></a>' + links +
      '<div class="spacer"></div><button type="button" data-logout>Logout</button></nav><div><header class="topbar"><button type="button" class="icon-btn menu-btn" id="menu" aria-label="Open menu">&#9776;</button>' +
      '<div class="grow"><strong>Welcome back, ' + App.esc(user.name) + '</strong><div class="date">' + new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + '</div></div>' +
      '<a class="icon-btn bell" href="notifications.html" aria-label="Notifications">' + BELL + '<span class="count" id="bell-count" hidden>0</span></a>' +
      '<div class="who"><div>' + App.esc(user.name) + '</div><small>' + App.esc(user.email) + '</small></div>' +
      '<details class="profile"><summary aria-label="Profile menu">' + App.esc(user.name.charAt(0).toUpperCase()) + '</summary><div class="menu"><strong>' + App.esc(user.name) + '</strong><small>' + App.esc(user.email) + '</small>' +
      (role === 'Teacher' ? '<a href="settings.html">Settings</a>' : '<a href="student-profile.html">My profile</a>') + '<button type="button" data-logout>Logout</button></div></details></header>' +
      '<main class="content" id="view" tabindex="-1"><div class="loading">Loading...</div></main></div></div>';
    document.body.hidden = false;
    document.getElementById('menu').onclick = function () { document.getElementById('sidebar').classList.toggle('open'); };
    document.querySelectorAll('[data-logout]').forEach(function (b) { b.onclick = Auth.logout; });
    refreshBell();
    var fn = Pages[role] && Pages[role][page], view = document.getElementById('view');
    if (!fn) { view.innerHTML = '<div class="empty">Page not found.</div>'; return; }
    try { await fn({ view: view, user: user, role: role }); }
    catch (e) { if (e.code !== 'SESSION_EXPIRED') view.innerHTML = '<div class="error" role="alert">' + App.esc(e.message || 'Something went wrong.') + '</div>'; }
  }
  async function refreshBell() {
    try { var n = (await Api.call('getNotifications', {})).data.unread, b = document.getElementById('bell-count'); if (b) { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; } } catch (e) { /* non-critical */ }
  }
  return { boot: boot, refreshBell: refreshBell };
})();

/* Notifications page (both roles) */
Pages.Teacher.notifications = Pages.Student.notifications = async function (ctx) {
  async function draw() {
    var d = (await Api.call('getNotifications', {})).data;
    ctx.view.innerHTML = '<div class="page-head"><div><h2>Notifications</h2><p>' + d.unread + ' unread</p></div>' + (d.unread ? '<button class="btn sm ghost" id="all" type="button">Mark all as read</button>' : '') + '</div>' +
      (d.notifications.length ? '<div class="list">' + d.notifications.map(function (n) {
        return '<div class="item' + (n.IsRead === 'TRUE' ? '' : ' unread') + '"><h4>' + App.esc(n.Title) + '</h4><div>' + App.esc(n.Message) + '</div><div class="meta">' + App.fmtDateTime(n.CreatedAt) + '</div>' +
          (n.IsRead === 'TRUE' ? '' : '<div class="btns"><button class="btn sm ghost" data-read="' + App.esc(n.NotificationID) + '" type="button">Mark as read</button></div>') + '</div>';
      }).join('') + '</div>' : '<div class="empty">No notifications yet.</div>');
    var all = document.getElementById('all');
    if (all) all.onclick = async function () { if (await App.act('markNotificationRead', { all: true }, 'All marked as read')) { draw(); Shell.refreshBell(); } };
    ctx.view.querySelectorAll('[data-read]').forEach(function (b) { b.onclick = async function () { if (await App.act('markNotificationRead', { notificationId: b.dataset.read }, 'Marked as read')) { draw(); Shell.refreshBell(); } }; });
  }
  await draw();
};
