/* teacher.js - dashboard, students, create student, settings */
var STATUSES = ['Active', 'Completed', 'Inactive'];

function studentFields(s) {
  s = s || {};
  function f(name, label, val, type, extra) { return '<div class="field"><label for="f-' + name + '">' + label + '</label><input id="f-' + name + '" name="' + name + '" type="' + (type || 'text') + '" value="' + App.esc(val || '') + '" required ' + (extra || '') + '></div>'; }
  return '<div class="grid cols2">' + f('name', 'Student name', s.Name, 'text', 'maxlength="100"') + f('email', 'Email address', s.Email, 'email', 'maxlength="150"') +
    f('phone', 'Phone number', s.Phone, 'tel', 'maxlength="20"') + f('course', 'Course', s.Course, 'text', 'maxlength="100" placeholder="e.g. SAP FICO"') +
    f('batchTiming', 'Batch timing', s.BatchTiming, 'text', 'maxlength="60" placeholder="e.g. 10:00 AM - 12:00 PM"') +
    '<div class="field"><label for="f-batchType">Batch type</label><select id="f-batchType" name="batchType" required>' + App.opts(['Online', 'Offline'], s.BatchType) + '</select></div>' +
    f('batchName', 'Batch name', s.BatchName, 'text', 'maxlength="100"') + f('enrollmentDate', 'Enrollment date', s.EnrollmentDate || App.today(), 'date') +
    '<div class="field"><label for="f-status">Status</label><select id="f-status" name="status">' + App.opts(STATUSES, s.Status || 'Active') + '</select></div></div>' +
    '<div class="field"><label for="f-notes">Additional notes (optional)</label><textarea id="f-notes" name="notes" rows="2" maxlength="1000">' + App.esc(s.Notes || '') + '</textarea></div>';
}

Pages.Teacher['teacher-dashboard'] = async function (ctx) {
  var d = (await Api.call('getDashboardStatistics', {})).data, c = d.cards;
  var defs = [['Total Students', 'totalStudents'], ['Active Students', 'activeStudents'], ['Completed Students', 'completedStudents'], ['Online (active)', 'onlineStudents'], ['Offline (active)', 'offlineStudents'],
    ['Pending Practice', 'pendingPractice'], ['Overdue Practice', 'overduePractice'], ['Awaiting Review', 'awaitingReview'], ['Pending Leave Requests', 'pendingLeaves'],
    ['Approved Leaves', 'approvedLeaves'], ['Rejected Leaves', 'rejectedLeaves'], ['Pending Leave Incidents', 'pendingIncidents']];
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Dashboard</h2><p>Only your students and records are counted here.</p></div></div>' +
    '<div class="actions-row"><a class="btn sm" href="create-student.html">Create student</a><a class="btn sm ghost" href="students.html">View students</a><a class="btn sm ghost" href="practice.html">Assign practice</a>' +
    '<a class="btn sm ghost" href="leave-requests.html">Review leave requests</a><a class="btn sm ghost" href="leave-incidents.html">Record leave incident</a><a class="btn sm ghost" href="reports.html">View reports</a></div>' +
    '<section class="panel"><h3>Pending approvals' + (d.emergencyPending ? ' ' + App.badge('Emergency').replace('Emergency', d.emergencyPending + ' emergency') : '') + '</h3>' +
    (d.pending.length ? '<div class="list">' + d.pending.map(function (r) {
      return '<div class="item' + (r.LeaveType === 'Emergency' ? ' emergency' : '') + '"><h4>' + (r.LeaveType === 'Emergency' ? App.badge('Emergency') + ' ' : '') + App.esc(r.StudentName) + ' &middot; ' + App.esc(r.Course) + '</h4><div>' + App.esc(r.Reason) +
        '</div><div class="meta">' + App.fmtDate(r.StartDate) + ' to ' + App.fmtDate(r.EndDate) + ' (' + App.esc(r.Duration) + ' day' + (r.Duration === '1' ? '' : 's') + ')</div></div>';
    }).join('') + '</div><p><a href="leave-requests.html">Open Leave Approvals</a></p>' : '<div class="empty">No leave requests are waiting for you.</div>') + '</section>' +
    '<div class="grid stats">' + defs.map(function (x, i) { return '<div class="stat g' + (i % 4) + '"><b>' + c[x[1]] + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div>' +
    '<div class="grid charts">' + [['Students by course', 'c1'], ['Online vs offline (active)', 'c2'], ['Student status', 'c3'], ['Practice status', 'c4'], ['Leave requests', 'c5']].map(function (x) {
      return '<section class="panel"><h3>' + x[0] + '</h3><div class="chart-box"><canvas id="' + x[1] + '" role="img" aria-label="' + x[0] + '"></canvas></div></section>'; }).join('') + '</div>';
  if (typeof Chart === 'undefined') { ctx.view.querySelectorAll('.chart-box').forEach(function (b) { b.innerHTML = '<div class="empty">Charts could not load.</div>'; }); return; }
  var pal = ['#4F46E5', '#7C3AED', '#06B6D4', '#172554', '#0891b2', '#a78bfa', '#f59e0b'];
  function chart(id, type, obj) {
    var labels = Object.keys(obj), vals = labels.map(function (k) { return obj[k]; });
    if (!vals.some(Boolean)) { document.getElementById(id).parentNode.innerHTML = '<div class="empty">No data yet.</div>'; return; }
    new Chart(document.getElementById(id), { type: type, data: { labels: labels, datasets: [{ data: vals, backgroundColor: pal, borderWidth: 0 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: type !== 'bar', position: 'bottom' } }, scales: type === 'bar' ? { y: { beginAtZero: true, ticks: { precision: 0 } } } : {} } });
  }
  chart('c1', 'bar', d.charts.byCourse); chart('c2', 'doughnut', d.charts.onlineOffline); chart('c3', 'doughnut', d.charts.studentStatus);
  chart('c4', 'bar', d.charts.practiceStatus); chart('c5', 'doughnut', d.charts.leaveStatus);
};

Pages.Teacher.students = async function (ctx) {
  var all = [], f = { q: '', course: '', timing: '', type: '', status: '' };
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Students</h2><p id="count"></p></div><a class="btn sm" href="create-student.html">Create student</a></div>' +
    '<div class="filters"><input class="search" id="q" type="search" placeholder="Search name, email or phone" aria-label="Search students"><select id="fc" aria-label="Course"></select><select id="ft" aria-label="Batch timing"></select>' +
    '<select id="fy" aria-label="Online or offline"><option value="">Online + Offline</option><option>Online</option><option>Offline</option></select>' +
    '<select id="fs" aria-label="Status"><option value="">All statuses</option><option>Active</option><option>Completed</option><option>Inactive</option></select></div><div id="tbl"><div class="loading">Loading...</div></div>';
  function uniq(k) { return Object.keys(all.reduce(function (o, s) { if (s[k]) o[s[k]] = 1; return o; }, {})).sort(); }
  function digits(x) { return String(x).replace(/\D/g, ''); }
  function filtered() {
    var q = f.q.toLowerCase(), qd = digits(f.q);
    return all.filter(function (s) {
      return (!q || s.Name.toLowerCase().indexOf(q) >= 0 || s.Email.toLowerCase().indexOf(q) >= 0 || (qd.length >= 3 && digits(s.Phone).indexOf(qd) >= 0)) &&
        (!f.course || s.Course === f.course) && (!f.timing || s.BatchTiming === f.timing) && (!f.type || s.BatchType === f.type) && (!f.status || s.Status === f.status);
    });
  }
  function render() {
    var rows = filtered(); document.getElementById('count').textContent = rows.length + ' of ' + all.length + ' students';
    document.getElementById('tbl').innerHTML = App.table([
      { label: 'Student ID', html: function (s) { return App.esc(s.StudentID); }, cls: 'nw' }, { label: 'Name', html: function (s) { return '<strong>' + App.esc(s.Name) + '</strong>'; } },
      { label: 'Email', html: function (s) { return App.esc(s.Email); } }, { label: 'Phone', html: function (s) { return App.esc(s.Phone); }, cls: 'nw' },
      { label: 'Course', html: function (s) { return App.esc(s.Course); } }, { label: 'Batch timing', html: function (s) { return App.esc(s.BatchTiming); } },
      { label: 'Type', html: function (s) { return App.badge(s.BatchType); } }, { label: 'Batch', html: function (s) { return App.esc(s.BatchName); } },
      { label: 'Enrolled', html: function (s) { return App.fmtDate(s.EnrollmentDate); }, cls: 'nw' }, { label: 'Status', html: function (s) { return App.badge(s.Status); } },
      { label: 'Actions', html: function (s) {
        return '<select data-id="' + App.esc(s.StudentID) + '" aria-label="Actions for ' + App.esc(s.Name) + '"><option value="">Choose...</option><option value="view">View details</option><option value="edit">Edit student</option>' +
          '<option value="assign">Assign practice</option><option value="practice">View practice history</option><option value="leave">View leave history</option>' +
          (s.Status !== 'Completed' ? '<option value="complete">Mark as completed</option>' : '') + (s.Status !== 'Active' ? '<option value="reactivate">Reactivate student</option>' : '') +
          (s.Status !== 'Inactive' ? '<option value="deactivate">Deactivate account</option>' : '') + '<option value="setup">New setup code</option></select>'; } }
    ], rows, all.length ? 'No students match your search and filters.' : 'No students yet. Create your first student to get started.');
  }
  async function load() {
    all = (await Api.call('getStudents', {})).data.students;
    document.getElementById('fc').innerHTML = App.opts(uniq('Course'), f.course, 'All courses'); document.getElementById('ft').innerHTML = App.opts(uniq('BatchTiming'), f.timing, 'All batch timings'); render();
  }
  document.getElementById('q').oninput = function (e) { f.q = e.target.value.trim(); render(); };
  [['fc', 'course'], ['ft', 'timing'], ['fy', 'type'], ['fs', 'status']].forEach(function (p) { document.getElementById(p[0]).onchange = function (e) { f[p[1]] = e.target.value; render(); }; });
  function find(id) { return all.filter(function (s) { return s.StudentID === id; })[0]; }

  async function setStatus(s, status, title, msg) {
    var ok = await App.confirm({ title: title, message: msg, confirmText: 'Yes, continue', danger: status === 'Inactive' });
    if (ok && await App.act('updateStudentStatus', { studentId: s.StudentID, status: status })) load();
  }
  function showEdit(s) {
    var dlg = App.dialog('Edit ' + s.Name, '<div class="error" id="fe" role="alert" hidden></div><form id="ef" novalidate>' + studentFields(s) + '<div class="dlg-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn" type="submit">Save changes</button></div></form>', { wide: true });
    dlg.el.querySelector('#ef').onsubmit = async function (e) {
      e.preventDefault(); var btn = e.target.querySelector('[type=submit]'); App.setBusy(btn, true);
      try { await Api.call('updateStudent', Object.assign(App.formData(e.target), { studentId: s.StudentID })); App.toast('Student updated', 'ok'); dlg.close(); load(); }
      catch (err) { var b = dlg.el.querySelector('#fe'); b.textContent = err.message; b.hidden = false; App.setBusy(btn, false); }
    };
  }
  async function showDetails(s) {
    var dlg = App.dialog(s.Name, '<div class="loading">Loading...</div>', { wide: true }), body = dlg.el.querySelector('.dlg-body');
    var pr = (await Api.call('getPracticeAssignments', { studentId: s.StudentID })).data.practice, lv = (await Api.call('getLeaveHistory', { studentId: s.StudentID })).data;
    body.innerHTML = App.kv([['Student ID', s.StudentID], ['Email', s.Email], ['Phone', s.Phone], ['Course', s.Course], ['Batch timing', s.BatchTiming], ['Batch type', s.BatchType], ['Batch name', s.BatchName],
      ['Enrolled', App.fmtDate(s.EnrollmentDate)], ['Status', App.badge(s.Status), true], ['Username', s.Username], ['Notes', s.Notes]]) +
      '<h3 class="mt">Practice (' + pr.length + ')</h3>' + practiceTable(pr, false) + '<h3>Leave requests (' + lv.requests.length + ')</h3>' + leaveTable(lv.requests) +
      '<h3>Leave incidents (' + lv.incidents.length + ')</h3>' + incidentTable(lv.incidents);
  }
  async function showHistory(s, kind) {
    var dlg = App.dialog((kind === 'practice' ? 'Practice history - ' : 'Leave history - ') + s.Name, '<div class="loading">Loading...</div>', { wide: true }), body = dlg.el.querySelector('.dlg-body');
    if (kind === 'practice') body.innerHTML = practiceTable((await Api.call('getPracticeAssignments', { studentId: s.StudentID })).data.practice, false);
    else { var lv = (await Api.call('getLeaveHistory', { studentId: s.StudentID })).data; body.innerHTML = '<h3>Leave requests</h3>' + leaveTable(lv.requests) + '<h3>Incidents</h3>' + incidentTable(lv.incidents); }
  }
  async function newCode(s) {
    var ok = await App.confirm({ title: 'New setup code', message: 'This signs ' + s.Name + ' out everywhere and creates a one-time code for setting a new password.', confirmText: 'Create code' });
    if (!ok) return;
    var r = await App.act('resetPassword', { studentId: s.StudentID }, 'Setup code created'); if (!r) return;
    App.dialog('Setup code for ' + s.Name, '<p>Give this code to the student privately. It works once and expires in ' + r.data.validHours + ' hours.</p><div class="code-box">' + App.esc(r.data.setupCode) +
      '</div><p>The student opens <strong>' + App.esc(location.origin) + '/set-password.html</strong> and enters their email, this code and a new password.</p>');
  }
  document.getElementById('tbl').addEventListener('change', async function (e) {
    var sel = e.target.closest('select[data-id]'); if (!sel || !sel.value) return;
    var s = find(sel.dataset.id), act = sel.value; sel.value = ''; if (!s) return;
    try {
      if (act === 'view') await showDetails(s); else if (act === 'edit') showEdit(s); else if (act === 'assign') location.href = 'practice.html?q=' + encodeURIComponent(s.Email);
      else if (act === 'practice' || act === 'leave') await showHistory(s, act); else if (act === 'setup') await newCode(s);
      else if (act === 'complete') await setStatus(s, 'Completed', 'Mark as completed', s.Name + ' will be marked as completed. Practice and leave history is kept.');
      else if (act === 'reactivate') await setStatus(s, 'Active', 'Reactivate student', s.Name + ' will be able to log in again.');
      else if (act === 'deactivate') await setStatus(s, 'Inactive', 'Deactivate account', s.Name + ' will be signed out and will not be able to log in. Records are kept.');
    } catch (err) { App.toast(err.message, 'err'); }
  });
  await load();
};

Pages.Teacher['create-student'] = async function (ctx) {
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Create student</h2><p>The student is added to your list automatically.</p></div></div><section class="panel narrow"><div class="error" id="fe" role="alert" hidden></div>' +
    '<form id="sf" novalidate>' + studentFields() + '<button class="btn" type="submit">Create student</button></form></section><div id="result"></div>';
  var form = document.getElementById('sf');
  form.onsubmit = async function (e) {
    e.preventDefault(); var b = document.getElementById('fe'); b.hidden = true; var btn = form.querySelector('[type=submit]'); App.setBusy(btn, true);
    try {
      var r = (await Api.call('createStudent', App.formData(form))).data;
      App.toast('Student created', 'ok'); form.reset(); form.elements.enrollmentDate.value = App.today();
      document.getElementById('result').innerHTML = '<section class="panel narrow"><h3>' + App.esc(r.student.Name) + ' was created</h3><p>Student ID: <strong>' + App.esc(r.student.StudentID) + '</strong> &middot; Username: <strong>' + App.esc(r.student.Username) + '</strong></p>' +
        '<p>Give this one-time setup code to the student privately (valid ' + r.validHours + ' hours):</p><div class="code-box">' + App.esc(r.setupCode) + '</div><p>The student opens <strong>' + App.esc(location.origin) + '/set-password.html</strong>, enters their email, this code and a new password.</p>' +
        '<p class="hint">The code is shown only now. If it is lost, use "New setup code" on the Students page.</p></section>';
      document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
    } catch (err) { b.textContent = err.message; b.hidden = false; }
    App.setBusy(btn, false);
  };
};

Pages.Teacher.settings = async function (ctx) {
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Settings</h2></div></div><section class="panel narrow"><h3>Change password</h3><div class="error" id="fe" role="alert" hidden></div><form id="pf" novalidate>' +
    '<div class="field"><label for="cp">Current password</label><input id="cp" name="currentPassword" type="password" autocomplete="current-password" required></div>' +
    '<div class="field"><label for="np">New password</label><input id="np" name="newPassword" type="password" autocomplete="new-password" required><p class="hint">At least 8 characters, with a letter and a number.</p></div>' +
    '<div class="field"><label for="cn">Confirm new password</label><input id="cn" name="confirm" type="password" autocomplete="new-password" required></div><button class="btn" type="submit">Change password</button></form></section>';
  var form = document.getElementById('pf');
  form.onsubmit = async function (e) {
    e.preventDefault(); var b = document.getElementById('fe'); b.hidden = true;
    if (form.elements.newPassword.value !== form.elements.confirm.value) { b.textContent = 'The two new passwords do not match.'; b.hidden = false; return; }
    var btn = form.querySelector('[type=submit]'); App.setBusy(btn, true);
    try { await Api.call('changePassword', { currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value }); App.toast('Password changed. Other devices were signed out.', 'ok'); form.reset(); }
    catch (err) { b.textContent = err.message; b.hidden = false; }
    App.setBusy(btn, false);
  };
};
