/* student.js - student dashboard and profile */
Pages.Student['student-dashboard'] = async function (ctx) {
  var d = (await Api.call('getStudentDashboard', {})).data, p = d.profile, c = d.cards;
  var defs = [['Total practice', 'totalPractice'], ['Pending practice', 'pendingPractice'], ['Completed practice', 'completedPractice'], ['Overdue practice', 'overduePractice'], ['Pending leave requests', 'pendingLeaves'], ['Approved leaves', 'approvedLeaves']];
  var notes = (await Api.call('getNotifications', {})).data.notifications.slice(0, 5);
  ctx.view.innerHTML = '<div class="page-head"><div><h2>My dashboard</h2></div></div><section class="panel">' + App.kv([['Student ID', p.StudentID], ['Email', p.Email], ['Phone', p.Phone], ['Course', p.Course], ['Batch timing', p.BatchTiming], ['Batch type', p.BatchType], ['Assigned teacher', p.TeacherName]]) + '</section>' +
    '<div class="grid stats">' + defs.map(function (x, i) { return '<div class="stat g' + (i % 4) + '"><b>' + c[x[1]] + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div>' +
    '<div class="actions-row"><a class="btn sm" href="student-leave.html">Normal leave request</a><a class="btn sm ghost" href="student-late.html">Late leave / leave not reported</a><a class="btn sm danger" href="student-emergency.html">Emergency leave</a></div>' +
    '<div class="grid cols2"><section class="panel"><h3>Upcoming deadlines</h3>' + (d.upcoming.length ? '<div class="list">' + d.upcoming.map(function (r) { return '<div class="item"><h4>' + App.esc(r.Topic) + ' ' + App.badge(r.EffectiveStatus) + '</h4><div class="meta">Due ' + App.fmtDate(r.DueDate) + '</div></div>'; }).join('') + '</div><p><a href="student-practice.html">Open my practice</a></p>' : '<div class="empty">No open deadlines.</div>') + '</section>' +
    '<section class="panel"><h3>Recent assignments</h3>' + (d.recent.length ? '<div class="list">' + d.recent.map(function (r) { return '<div class="item"><h4>' + App.esc(r.Topic) + ' ' + App.badge(r.EffectiveStatus) + '</h4><div class="meta">Assigned ' + App.fmtDate(r.AssignedDate) + '</div></div>'; }).join('') + '</div>' : '<div class="empty">Nothing assigned yet.</div>') + '</section>' +
    '<section class="panel"><h3>Recent teacher feedback</h3>' + (d.feedback.length ? '<div class="list">' + d.feedback.map(function (r) { return '<div class="item"><h4>' + App.esc(r.Topic) + '</h4><div class="ws">' + App.esc(r.Feedback) + '</div></div>'; }).join('') + '</div>' : '<div class="empty">No feedback yet.</div>') + '</section>' +
    '<section class="panel"><h3>Recent leave requests</h3>' + (d.recentLeaves.length ? '<div class="list">' + d.recentLeaves.map(function (r) { return '<div class="item"><h4>' + App.esc(r.LeaveType) + ' leave ' + App.badge(r.Status) + '</h4><div class="meta">' + App.fmtDate(r.StartDate) + ' to ' + App.fmtDate(r.EndDate) + '</div>' + (r.TeacherRemarks ? '<div>' + App.esc(r.TeacherRemarks) + '</div>' : '') + '</div>'; }).join('') + '</div>' : '<div class="empty">No leave requests.</div>') + '</section></div>' +
    '<section class="panel"><h3>Notifications</h3>' + (notes.length ? '<div class="list">' + notes.map(function (n) { return '<div class="item' + (n.IsRead === 'TRUE' ? '' : ' unread') + '"><h4>' + App.esc(n.Title) + '</h4><div>' + App.esc(n.Message) + '</div><div class="meta">' + App.fmtDateTime(n.CreatedAt) + '</div></div>'; }).join('') + '</div><p><a href="notifications.html">See all</a></p>' : '<div class="empty">No notifications.</div>') + '</section>';
};

Pages.Student['student-profile'] = async function (ctx) {
  var s = (await Api.call('getStudentById', { studentId: ctx.user.id })).data.student;
  ctx.view.innerHTML = '<div class="page-head"><div><h2>My profile</h2><p>Only your teacher can change these details.</p></div></div><section class="panel narrow">' + App.kv([['Name', s.Name], ['Student ID', s.StudentID], ['Email', s.Email], ['Phone', s.Phone], ['Course', s.Course], ['Batch timing', s.BatchTiming], ['Batch type', s.BatchType],
    ['Batch name', s.BatchName], ['Enrolled', App.fmtDate(s.EnrollmentDate)], ['Status', App.badge(s.Status), true], ['Assigned teacher', s.TeacherName], ['Username', s.Username]]) + '</section>' +
    '<section class="panel narrow"><h3>Change password</h3><div class="error" id="fe" role="alert" hidden></div><form id="pf" novalidate><div class="field"><label for="cp">Current password</label><input id="cp" name="currentPassword" type="password" autocomplete="current-password" required></div>' +
    '<div class="field"><label for="np">New password</label><input id="np" name="newPassword" type="password" autocomplete="new-password" required><p class="hint">At least 8 characters, with a letter and a number.</p></div><div class="field"><label for="cn">Confirm new password</label><input id="cn" name="confirm" type="password" autocomplete="new-password" required></div><button class="btn" type="submit">Change password</button></form></section>';
  var form = document.getElementById('pf');
  form.onsubmit = async function (e) {
    e.preventDefault(); var b = document.getElementById('fe'); b.hidden = true;
    if (form.elements.newPassword.value !== form.elements.confirm.value) { b.textContent = 'The two new passwords do not match.'; b.hidden = false; return; }
    var btn = form.querySelector('[type=submit]'); App.setBusy(btn, true);
    try { await Api.call('changePassword', { currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value }); App.toast('Password changed', 'ok'); form.reset(); } catch (err) { b.textContent = err.message; b.hidden = false; }
    App.setBusy(btn, false);
  };
};
