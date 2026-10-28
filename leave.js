/* leave.js - leave approvals, incidents, student leave forms */

function dur(r) { return App.esc(r.Duration) + (r.Duration === '1' ? ' day' : ' days'); }
function leaveTable(rows) {
  return App.table([{ label: 'Type', html: function (r) { return App.badge(r.LeaveType); } }, { label: 'Reason', html: function (r) { return App.esc(r.Reason); } },
    { label: 'From', html: function (r) { return App.fmtDate(r.StartDate); }, cls: 'nw' }, { label: 'To', html: function (r) { return App.fmtDate(r.EndDate); }, cls: 'nw' }, { label: 'Duration', html: dur, cls: 'nw' },
    { label: 'Status', html: function (r) { return App.badge(r.Status); } }, { label: 'Teacher remarks', html: function (r) { return App.esc(r.TeacherRemarks); } }], rows, 'No leave requests.');
}
function incidentTable(rows) {
  return App.table([{ label: 'Type', html: function (r) { return App.esc(r.IncidentType); } }, { label: 'Absence date', html: function (r) { return App.fmtDate(r.AbsenceDate); }, cls: 'nw' },
    { label: 'Informed / recorded', html: function (r) { return App.fmtDate(r.NotificationDate); }, cls: 'nw' }, { label: 'Reason', html: function (r) { return App.esc(r.Reason); } },
    { label: 'Status', html: function (r) { return App.badge(r.Status); } }, { label: 'Teacher remarks', html: function (r) { return App.esc(r.TeacherRemarks); } }], rows, 'No incidents.');
}

/* ---------------- Teacher: Leave Approvals ---------------- */
Pages.Teacher['leave-requests'] = async function (ctx) {
  var TABS = ['All Requests', 'Pending', 'Approved', 'Rejected', 'Emergency Leave', 'Late Leave Notifications', 'Leave Not Reported'], tab = 'Pending', reqs = [], incs = [];
  var p = new URLSearchParams(location.search).get('tab'); if (TABS.indexOf(p) >= 0) tab = p;
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Leave approvals</h2><p>Nothing becomes approved leave until you approve it.</p></div></div><div class="tabs" id="tabs" role="group" aria-label="Request type"></div><div id="tbl"><div class="loading">Loading...</div></div>';
  function render() {
    var el = document.getElementById('tbl');
    document.getElementById('tabs').innerHTML = TABS.map(function (t) { return '<button type="button" data-tab="' + t + '" aria-pressed="' + (t === tab) + '">' + t + (t === 'Pending' ? ' (' + reqs.filter(function (r) { return r.Status === 'Pending'; }).length + ')' : '') + '</button>'; }).join('');
    document.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { tab = b.dataset.tab; render(); }; });
    if (tab === 'Late Leave Notifications' || tab === 'Leave Not Reported') {
      var t = tab === 'Late Leave Notifications' ? 'Late Leave Notification' : 'Leave Not Reported', rows = incs.filter(function (i) { return i.IncidentType === t; });
      el.innerHTML = '<p class="hint">These are separate from approved leave. Manage them on <a href="leave-incidents.html">Leave Incidents</a>.</p>' + App.table([
        { label: 'Student', html: function (r) { return '<strong>' + App.esc(r.StudentName) + '</strong><br><small>' + App.esc(r.Course) + ' &middot; ' + App.esc(r.BatchName) + '</small>'; } },
        { label: 'Absence date', html: function (r) { return App.fmtDate(r.AbsenceDate); }, cls: 'nw' }, { label: 'Informed / recorded', html: function (r) { return App.fmtDate(r.NotificationDate); }, cls: 'nw' },
        { label: 'Reason', html: function (r) { return App.esc(r.Reason); } }, { label: 'Status', html: function (r) { return App.badge(r.Status); } }], rows, 'No incidents of this type.'); return;
    }
    var rr = reqs.filter(function (r) { return tab === 'All Requests' || (tab === 'Emergency Leave' ? r.LeaveType === 'Emergency' : r.Status === tab); });
    el.innerHTML = App.table([{ label: 'Request ID', html: function (r) { return '<small>' + App.esc(r.RequestID) + '</small>'; }, cls: 'nw' },
      { label: 'Student', html: function (r) { return '<strong>' + App.esc(r.StudentName) + '</strong>'; } }, { label: 'Course', html: function (r) { return App.esc(r.Course); } }, { label: 'Batch', html: function (r) { return App.esc(r.BatchName); } },
      { label: 'Type', html: function (r) { return App.badge(r.LeaveType); } }, { label: 'Reason', html: function (r) { return App.esc(r.Reason); } },
      { label: 'Start', html: function (r) { return App.fmtDate(r.StartDate); }, cls: 'nw' }, { label: 'End', html: function (r) { return App.fmtDate(r.EndDate); }, cls: 'nw' }, { label: 'Duration', html: dur, cls: 'nw' },
      { label: 'Requested', html: function (r) { return App.fmtDate(r.RequestedAt); }, cls: 'nw' }, { label: 'Status', html: function (r) { return App.badge(r.Status) + (r.Status === 'Approved' && r.SyncStatus !== 'Synced' ? '<br><small>Sync pending</small>' : ''); } },
      { label: 'Actions', cls: 'nw', html: function (r) {
        var id = App.esc(r.RequestID);
        return '<button class="btn sm ghost" data-v="' + id + '" type="button">View</button> ' + (r.Status === 'Pending' ? '<button class="btn sm ok" data-a="' + id + '" type="button">Approve</button> <button class="btn sm danger" data-r="' + id + '" type="button">Reject</button>' :
          (r.Status === 'Approved' && r.SyncStatus !== 'Synced' ? '<button class="btn sm" data-a="' + id + '" type="button">Retry sync</button>' : '')); } }], rr, 'No requests in this tab.');
    function one(id) { return reqs.filter(function (r) { return r.RequestID === id; })[0]; }
    el.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = function () { view(one(b.dataset.v)); }; });
    el.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { approve(one(b.dataset.a)); }; });
    el.querySelectorAll('[data-r]').forEach(function (b) { b.onclick = function () { reject(one(b.dataset.r)); }; });
  }
  function view(r) {
    App.dialog('Leave request', (r.LeaveType === 'Emergency' ? '<div class="error"><strong>Emergency leave request</strong></div>' : '') + App.kv([['Student', r.StudentName], ['Email', r.StudentEmail], ['Phone', r.StudentPhone], ['Course', r.Course], ['Batch', r.BatchName + ' (' + r.BatchTiming + ')'],
      ['Type', r.LeaveType], ['From', App.fmtDate(r.StartDate)], ['To', App.fmtDate(r.EndDate)], ['Duration', r.Duration + ' day(s)'], ['Requested', App.fmtDateTime(r.RequestedAt)], ['Status', App.badge(r.Status), true],
      ['Reviewed', r.ReviewedAt ? App.fmtDateTime(r.ReviewedAt) : ''], ['Request ID', r.RequestID]]) + '<h3 class="mt">Reason</h3><p class="ws">' + App.esc(r.Reason) + '</p>' + (r.AdditionalDetails ? '<h3>Details</h3><p class="ws">' + App.esc(r.AdditionalDetails) + '</p>' : '') +
      (r.TeacherRemarks ? '<h3>Your remarks</h3><p class="ws">' + App.esc(r.TeacherRemarks) + '</p>' : ''), { wide: true });
  }
  async function approve(r) {
    var ok = await App.confirm({ title: r.Status === 'Approved' ? 'Retry sync' : 'Approve leave', message: r.Status === 'Approved' ? 'Finish saving this approval.' : 'Approve ' + r.StudentName + '\'s leave from ' + r.StartDate + ' to ' + r.EndDate + '?', confirmText: 'Approve', inputLabel: 'Remarks (optional)' });
    if (ok && await App.act('approveLeave', { requestId: r.RequestID, remarks: ok.value })) { await load(); Shell.refreshBell(); }
  }
  async function reject(r) {
    var ok = await App.confirm({ title: 'Reject leave', message: 'Reject ' + r.StudentName + '\'s leave from ' + r.StartDate + ' to ' + r.EndDate + '? The student will see your reason.', confirmText: 'Reject', danger: true, inputLabel: 'Rejection reason', inputRequired: true });
    if (ok && await App.act('rejectLeave', { requestId: r.RequestID, remarks: ok.value })) await load();
  }
  async function load() {
    reqs = (await Api.call('getLeaveRequests', {})).data.requests; incs = (await Api.call('getLeaveIncidents', {})).data.incidents; render();
  }
  await load();
};

/* ---------------- Teacher: Leave Incidents ---------------- */
Pages.Teacher['leave-incidents'] = async function (ctx) {
  var selected = null, list = [], f = { q: '', course: '', type: '', status: '', from: '', to: '' };
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Leave incidents</h2><p>Unreported absences and late notifications. These never create approved leave.</p></div></div>' +
    '<section class="panel narrow"><h3>Record an incident</h3><div class="field"><label for="lk">Student email or phone number</label><div class="row"><input id="lk" type="search" autocomplete="off"><button class="btn" id="find" type="button">Find student</button></div></div><div id="matches" aria-live="polite"></div>' +
    '<form id="nf" hidden novalidate><div class="error" id="fe" role="alert" hidden></div><div class="field"><label for="it">Incident type</label><select id="it" name="incidentType">' + App.opts(['Leave Not Reported', 'Late Leave Notification']) + '</select></div>' +
    '<div class="grid cols2"><div class="field"><label for="ab">Absence date</label><input id="ab" name="absenceDate" type="date" required></div><div class="field" id="nd-wrap"><label for="nd">Date recorded</label><input id="nd" name="notificationDate" type="date"></div></div>' +
    '<div class="field"><label for="rs">Reason (if known)</label><textarea id="rs" name="reason" rows="2" maxlength="500"></textarea></div><div class="field"><label for="rm">Teacher remarks</label><textarea id="rm" name="remarks" rows="2" maxlength="500"></textarea></div><button class="btn" type="submit">Save incident</button></form></section>' +
    '<section class="panel"><h3>All incidents</h3><div class="filters"><input class="search" id="fq" type="search" placeholder="Search student" aria-label="Search student"><select id="fc" aria-label="Course"></select><select id="ft" aria-label="Type">' + App.opts(['Leave Not Reported', 'Late Leave Notification'], '', 'All types') + '</select>' +
    '<select id="fs" aria-label="Status">' + App.opts(['Pending Review', 'Reviewed', 'Resolved'], '', 'All statuses') + '</select><input id="ff" type="date" aria-label="Absence from"><input id="fto" type="date" aria-label="Absence to"></div><div id="tbl"><div class="loading">Loading...</div></div></section>';
  var lk = document.getElementById('lk'), matches = document.getElementById('matches'), nf = document.getElementById('nf'), late = function () { return nf.elements.incidentType.value === 'Late Leave Notification'; };
  function syncType() { document.querySelector('#nd-wrap label').textContent = late() ? 'Date teacher was informed' : 'Date recorded'; nf.elements.notificationDate.required = late(); if (!late() && !nf.elements.notificationDate.value) nf.elements.notificationDate.value = App.today(); }
  nf.elements.incidentType.onchange = syncType; syncType();
  async function find() {
    var q = lk.value.trim(); nf.hidden = true; selected = null;
    if (q.length < 3) { matches.innerHTML = '<div class="error">Type at least 3 characters of the email or phone number.</div>'; return; }
    try {
      var s = (await Api.call('searchStudent', { query: q })).data.students;
      if (!s.length) { matches.innerHTML = '<div class="error">No matching student found in your student list.</div>'; return; }
      matches.innerHTML = '<p>' + (s.length > 1 ? 'Several students match. Select the correct one.' : 'Confirm this is the right student.') + '</p><div class="list">' + s.map(function (x, i) {
        return '<div class="item"><h4>' + App.esc(x.Name) + '</h4><div class="meta">' + App.esc(x.Email) + ' &middot; ' + App.esc(x.Phone) + ' &middot; ' + App.esc(x.Course) + ' &middot; ' + App.esc(x.BatchName) + '</div><div class="btns"><button class="btn sm" data-pick="' + i + '" type="button">Select this student</button></div></div>'; }).join('') + '</div>';
      matches.querySelectorAll('[data-pick]').forEach(function (b) { b.onclick = function () { selected = s[Number(b.dataset.pick)]; matches.innerHTML = '<div class="note"><strong>Recording for: ' + App.esc(selected.Name) + '</strong> (' + App.esc(selected.Course) + ' &middot; ' + App.esc(selected.BatchName) + ')</div>'; nf.hidden = false; }; });
    } catch (e) { matches.innerHTML = '<div class="error">' + App.esc(e.message) + '</div>'; }
  }
  document.getElementById('find').onclick = find; lk.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); find(); } };
  nf.onsubmit = async function (e) {
    e.preventDefault(); var b = document.getElementById('fe'); b.hidden = true; if (!selected) { b.textContent = 'Find and select a student first.'; b.hidden = false; return; }
    var btn = nf.querySelector('[type=submit]'); App.setBusy(btn, true);
    try { var r = await Api.call('submitLeaveIncident', Object.assign(App.formData(nf), { studentId: selected.StudentID })); App.toast(r.message, 'ok'); nf.reset(); syncType(); nf.hidden = true; matches.innerHTML = ''; lk.value = ''; selected = null; load(); }
    catch (err) { b.textContent = err.message; b.hidden = false; }
    App.setBusy(btn, false);
  };
  function render() {
    var q = f.q.toLowerCase(), rows = list.filter(function (r) { return (!q || (r.StudentName + ' ' + r.StudentEmail).toLowerCase().indexOf(q) >= 0) && (!f.course || r.Course === f.course) && (!f.type || r.IncidentType === f.type) && (!f.status || r.Status === f.status) && (!f.from || r.AbsenceDate >= f.from) && (!f.to || r.AbsenceDate <= f.to); });
    var el = document.getElementById('tbl');
    el.innerHTML = App.table([{ label: 'Student', html: function (r) { return '<strong>' + App.esc(r.StudentName) + '</strong><br><small>' + App.esc(r.Course) + ' &middot; ' + App.esc(r.BatchName) + '</small>'; } },
      { label: 'Type', html: function (r) { return App.esc(r.IncidentType); } }, { label: 'Absence date', html: function (r) { return App.fmtDate(r.AbsenceDate); }, cls: 'nw' }, { label: 'Informed / recorded', html: function (r) { return App.fmtDate(r.NotificationDate); }, cls: 'nw' },
      { label: 'Reason', html: function (r) { return App.esc(r.Reason) + (r.SubmittedBy === 'Student' ? '<br><small>Submitted by student</small>' : ''); } }, { label: 'Status', html: function (r) { return App.badge(r.Status); } }, { label: 'Remarks', html: function (r) { return App.esc(r.TeacherRemarks); } },
      { label: '', html: function (r) { return '<button class="btn sm ghost" data-u="' + App.esc(r.IncidentID) + '" type="button">Update</button>'; } }], rows, list.length ? 'No incidents match.' : 'No incidents recorded yet.');
    el.querySelectorAll('[data-u]').forEach(function (b) {
      b.onclick = function () {
        var r = list.filter(function (x) { return x.IncidentID === b.dataset.u; })[0];
        var dlg = App.dialog('Update incident', App.kv([['Student', r.StudentName], ['Type', r.IncidentType], ['Absence date', App.fmtDate(r.AbsenceDate)], ['Informed / recorded', App.fmtDate(r.NotificationDate)], ['Reason', r.Reason]]) +
          '<form id="uf"><div class="field mt"><label for="us">Status</label><select id="us" name="status">' + App.opts(['Pending Review', 'Reviewed', 'Resolved'], r.Status) + '</select></div><div class="field"><label for="ur">Teacher remarks</label><textarea id="ur" name="remarks" rows="3" maxlength="500">' + App.esc(r.TeacherRemarks) + '</textarea></div>' +
          '<div class="dlg-actions"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save</button></div></form>');
        dlg.el.querySelector('#uf').onsubmit = async function (e) { e.preventDefault(); if (await App.act('updateLeaveIncident', Object.assign(App.formData(e.target), { incidentId: r.IncidentID }), 'Incident updated')) { dlg.close(); load(); } };
      };
    });
  }
  async function load() {
    list = (await Api.call('getLeaveIncidents', {})).data.incidents;
    var courses = Object.keys(list.reduce(function (o, r) { o[r.Course] = 1; return o; }, {})).sort(); document.getElementById('fc').innerHTML = App.opts(courses, f.course, 'All courses'); render();
  }
  [['fq', 'q', 'oninput'], ['fc', 'course', 'onchange'], ['ft', 'type', 'onchange'], ['fs', 'status', 'onchange'], ['ff', 'from', 'onchange'], ['fto', 'to', 'onchange']].forEach(function (x) { document.getElementById(x[0])[x[2]] = function (e) { f[x[1]] = e.target.value.trim(); render(); }; });
  await load();
};

/* ---------------- Student forms ---------------- */
function studentForm(ctx, o) {
  ctx.view.innerHTML = '<div class="page-head"><div><h2>' + o.title + '</h2><p>' + o.sub + '</p></div></div><section class="panel narrow"><div class="error" id="fe" role="alert" hidden></div><form id="lf" novalidate>' + o.fields + '<button class="btn" type="submit">' + o.button + '</button></form></section>';
  var form = document.getElementById('lf');
  if (o.init) o.init(form);
  form.onsubmit = async function (e) {
    e.preventDefault(); var b = document.getElementById('fe'); b.hidden = true; var btn = form.querySelector('[type=submit]'); App.setBusy(btn, true);
    try { var r = await Api.call(o.action, App.formData(form)); App.toast(r.message, 'ok'); form.reset(); if (o.init) o.init(form); setTimeout(function () { location.href = o.after; }, 900); }
    catch (err) { b.textContent = err.message; b.hidden = false; App.setBusy(btn, false); }
  };
}
function fld(id, label, html) { return '<div class="field"><label for="' + id + '">' + label + '</label>' + html + '</div>'; }

Pages.Student['student-leave'] = async function (ctx) {
  studentForm(ctx, { title: 'Normal leave request', sub: 'Your teacher approves or rejects it. It is not leave until approved.', action: 'submitLeaveRequest', button: 'Send leave request', after: 'leave-history.html',
    fields: fld('rs', 'Leave reason', '<input id="rs" name="reason" maxlength="300" required>') + '<div class="grid cols2">' + fld('sd', 'Start date', '<input id="sd" name="startDate" type="date" required>') + fld('ed', 'End date', '<input id="ed" name="endDate" type="date" required>') + '</div>' +
      '<div class="field"><label><input type="checkbox" id="hd" name="halfDay" value="yes"> Half-day leave (single date only)</label></div><div class="note" id="dur">Choose your dates to see the duration.</div>' + fld('dt', 'Additional details (optional)', '<textarea id="dt" name="details" rows="3" maxlength="1000"></textarea>') +
      '<p class="hint">Duration counts calendar days including both the start and end date. A half day counts as 0.5.</p>',
    init: function (form) {
      function calc() {
        var s = form.elements.startDate.value, e = form.elements.endDate.value, el = document.getElementById('dur');
        if (!s || !e) { el.textContent = 'Choose your dates to see the duration.'; return; } if (s > e) { el.textContent = 'The start date is after the end date.'; return; }
        var d = Math.round((Date.parse(e) - Date.parse(s)) / 86400000) + 1; el.textContent = 'Duration: ' + (form.elements.halfDay.checked && d === 1 ? '0.5 day (half day)' : d + (d === 1 ? ' day' : ' days'));
      }
      form.elements.startDate.onchange = function () { if (!form.elements.endDate.value || form.elements.endDate.value < form.elements.startDate.value) form.elements.endDate.value = form.elements.startDate.value; calc(); }; form.elements.endDate.onchange = calc; form.elements.halfDay.onchange = calc;
    } });
};
Pages.Student['student-emergency'] = async function (ctx) {
  studentForm(ctx, { title: 'Emergency leave', sub: 'Your teacher sees this at the top of their list. It still needs their approval.', action: 'submitEmergencyLeave', button: 'Send emergency request', after: 'leave-history.html',
    fields: fld('rs', 'Reason for emergency', '<input id="rs" name="reason" maxlength="300" required>') + '<div class="grid cols2">' + fld('dt', 'Emergency leave date', '<input id="dt" name="date" type="date" required>') +
      fld('ex', 'Expected duration (days)', '<input id="ex" name="expectedDays" type="number" min="1" max="30" step="1" value="1" required>') + '</div>' + fld('dd', 'Additional details (optional)', '<textarea id="dd" name="details" rows="3" maxlength="1000"></textarea>') });
};
Pages.Student['student-late'] = async function (ctx) {
  studentForm(ctx, { title: 'Late leave / leave not reported', sub: 'Explain an absence you did not report, or reported late. Your teacher will review it.', action: 'submitLeaveIncident', button: 'Send explanation', after: 'leave-history.html',
    fields: fld('it', 'What happened?', '<select id="it" name="incidentType"><option>Leave Not Reported</option><option>Late Leave Notification</option></select>') + '<div class="grid cols2">' + fld('ab', 'Absence date', '<input id="ab" name="absenceDate" type="date" required>') +
      '<div class="field" id="nw" hidden><label for="nd">Date you informed your teacher</label><input id="nd" name="notificationDate" type="date"></div></div>' + fld('rs', 'Reason', '<textarea id="rs" name="reason" rows="3" maxlength="500" required></textarea>'),
    init: function (form) { function sync() { var l = form.elements.incidentType.value === 'Late Leave Notification'; document.getElementById('nw').hidden = !l; form.elements.notificationDate.required = l; if (!l) form.elements.notificationDate.value = ''; } form.elements.incidentType.onchange = sync; sync(); } });
};
Pages.Student['leave-history'] = async function (ctx) {
  var d = (await Api.call('getLeaveHistory', {})).data;
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Leave history</h2></div></div><div class="actions-row"><a class="btn sm" href="student-leave.html">Normal leave</a><a class="btn sm ghost" href="student-emergency.html">Emergency leave</a><a class="btn sm ghost" href="student-late.html">Late / not reported</a></div>' +
    '<section class="panel"><h3>Leave requests</h3>' + leaveTable(d.requests) + '</section><section class="panel"><h3>Late leave / not reported</h3>' + incidentTable(d.incidents) + '</section>';
};
