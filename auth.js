/* auth.js - login, first-time password setup, route guard, logout */
var Auth = (function () {
  function $(s) { return document.querySelector(s); }
  function showError(msg) { var b = $('#form-error'); if (b) { b.textContent = msg || ''; b.hidden = !msg; } }
  var HOME = { Teacher: 'teacher-dashboard.html', Student: 'student-dashboard.html' };

  function initLogin() {
    var form = $('#login-form'); if (!form) return;
    var role = document.body.dataset.role;
    if (new URLSearchParams(location.search).get('expired')) showError('Your session expired. Please log in again.');
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); showError('');
      var id = form.identifier.value.trim(), pw = form.password.value;
      if (!id || !pw) { showError('Enter your ' + (role === 'Teacher' ? 'email' : 'email or username') + ' and password.'); return; }
      var btn = form.querySelector('button[type=submit]'); App.setBusy(btn, true);
      try {
        var r = await Api.call('login', { role: role, identifier: id, password: pw }, { auth: false });
        Api.saveSession(r.data.token, r.data.user);
        location.href = HOME[role];
      } catch (err) { showError(err.message); form.password.value = ''; App.setBusy(btn, false); }
    });
  }

  function initSetup() {
    var form = $('#setup-form'); if (!form) return;
    var roleParam = new URLSearchParams(location.search).get('role');
    if (roleParam === 'Teacher' || roleParam === 'Student') form.role.value = roleParam;
    form.addEventListener('submit', async function (e) {
      e.preventDefault(); showError('');
      if (form.newPassword.value !== form.confirm.value) { showError('The two passwords do not match.'); return; }
      var btn = form.querySelector('button[type=submit]'); App.setBusy(btn, true);
      try {
        await Api.call('completePasswordSetup', { role: form.role.value, identifier: form.identifier.value.trim(), setupCode: form.setupCode.value.trim(), newPassword: form.newPassword.value }, { auth: false });
        App.toast('Password saved. Redirecting to login...', 'ok');
        setTimeout(function () { location.href = form.role.value === 'Teacher' ? 'teacher-login.html' : 'student-login.html'; }, 1200);
      } catch (err) { showError(err.message); App.setBusy(btn, false); }
    });
  }

  /** Call at the top of every protected page. Returns the verified user, or null after redirecting. */
  async function requireSession(role) {
    if (!Api.getToken()) { location.replace('index.html'); return null; }
    try {
      var r = await Api.call('getMe', {});
      if (r.data.user.role !== role) { location.replace('index.html'); return null; }
      return r.data.user;
    } catch (e) { if (e.code !== 'SESSION_EXPIRED') showError(e.message); return null; }
  }
  async function logout() {
    try { await Api.call('logout', {}); } catch (e) { /* session may already be gone */ }
    Api.clearSession(); location.replace('index.html');
  }
  function initShell(role) {
    requireSession(role).then(function (u) {
      if (!u) return;
      document.querySelectorAll('[data-user-name]').forEach(function (n) { n.textContent = u.name; });
      document.querySelectorAll('[data-user-email]').forEach(function (n) { n.textContent = u.email; });
      document.querySelectorAll('[data-teacher-name]').forEach(function (n) { n.textContent = u.teacherName || ''; });
      document.querySelectorAll('[data-user-id]').forEach(function (n) { n.textContent = u.id; });
      document.body.hidden = false;
    });
    document.querySelectorAll('[data-logout]').forEach(function (b) { b.addEventListener('click', logout); });
  }
  document.addEventListener('DOMContentLoaded', function () { initLogin(); initSetup(); });
  return { requireSession: requireSession, logout: logout, initShell: initShell };
})();
