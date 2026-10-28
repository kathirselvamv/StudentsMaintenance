/* practice.js - teacher practice management, student practice pages */

function practiceTable(rows, withStudent) {
  var cols = [];
  if (withStudent) cols.push({ label: 'Student', html: function (r) { return '<strong>' + App.esc(r.StudentName) + '</strong><br><small>' + App.esc(r.Course) + ' &middot; ' + App.esc(r.BatchName) + '</small>'; } });
  cols = cols.concat([{ label: 'Topic', html: function (r) { return App.esc(r.Topic); } }, { label: 'Assigned', html: function (r) { return App.fmtDate(r.AssignedDate); }, cls: 'nw' },
    { label: 'Due', html: function (r) { return App.fmtDate(r.DueDate); }, cls: 'nw' }, { label: 'Status', html: function (r) { return App.badge(r.EffectiveStatus); } },
    { label: 'Feedback', html: function (r) { return App.esc(r.Feedback); } }]);
  return App.table(cols, rows, 'No practice assignments yet.');
}

Pages.Teacher.practice = async function (ctx) {
  var selected = null, list = [], f = { q: '', status: '' };
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Practice management</h2><p>Find a student by email or phone, confirm them, then assign practice.</p></div></div>' +
    '<section class="panel narrow"><h3>Assign practice</h3><div class="field"><label for="lk">Student email or phone number</label><div class="row"><input id="lk" type="search" autocomplete="off" placeholder="e.g. name@example.com or 98765 43210"><button class="btn" id="find" type="button">Find student</button></div></div>' +
    '<div id="matches" aria-live="polite"></div><form id="pf" hidden novalidate><div class="error" id="fe" role="alert" hidden></div>' +
    '<div class="field"><label for="tp">Practice topic</label><input id="tp" name="topic" maxlength="150" required></div><div class="field"><label for="ds">Practice description</label><textarea id="ds" name="description" rows="3" maxlength="1500" required></textarea></div>' +
    '<div class="grid cols3"><div class="field"><label for="ad">Assignment date</label><input id="ad" name="assignedDate" type="date" required></div><div class="field"><label for="dd">Due date</label><input id="dd" name="dueDate" type="date" required></div>' +
    '<div class="field"><label for="ed">Expected duration</label><input id="ed" name="expectedDuration" maxlength="60" placeholder="e.g. 2 hours"></div></div>' +
    '<div class="field"><label for="in">Additional instructions (optional)</label><textarea id="in" name="instructions" rows="2" maxlength="1000"></textarea></div><button class="btn" type="submit">Assign practice</button></form></section>' +
    '<section class="panel"><h3>All assignments</h3><div class="filters"><input class="search" id="lq" type="search" placeholder="Search student, topic" aria-label="Search assignments"><select id="ls" aria-label="Status">' +
    App.opts(['Assigned', 'In Progress', 'Submitted', 'Reviewed', 'Completed', 'Overdue'], '', 'All statuses') + '</select></div><div id="plist"><div class="loading">Loading...</div></div></section>';
  var lk = document.getElementById('lk'), matches = document.getElementById('matches'), pf = document.getElementById('pf');
  pf.elements.assignedDate.value = App.today();

  async function find() {
    var q = lk.value.trim(); pf.hidden = true; selected = null;
    if (q.length < 3) { matches.innerHTML = '<div class="error">Type at least 3 characters of the email or phone number.</div>'; return; }
    try {
      var s = (await Api.call('searchStudent', { query: q })).data.students;
      if (!s.length) { matches.innerHTML = '<div class="error">No matching student found in your student list.</div>'; return; }
      matches.innerHTML = (s.length > 1 ? '<p>Several students match. Select the correct one.</p>' : '<p>Confirm this is the right student.</p>') + '<div class="list">' + s.map(function (x, i) {
        return '<div class="item"><h4>' + App.esc(x.Name) + ' ' + App.badge(x.Status) + '</h4><div class="meta">' + App.esc(x.StudentID) + ' &middot; ' + App.esc(x.Email) + ' &middot; ' + App.esc(x.Phone) + '</div><div>' + App.esc(x.Course) + ' &middot; ' + App.esc(x.BatchName) + ' (' + App.esc(x.BatchTiming) + ')</div>' +
          '<div class="btns"><button class="btn sm" data-pick="' + i + '" type="button"' + (x.Status !== 'Active' ? ' disabled' : '') + '>' + (x.Status === 'Active' ? 'Select this student' : 'Not active') + '</button></div></div>'; }).join('') + '</div>';
      matches.querySelectorAll('[data-pick]').forEach(function (b) {
        b.onclick = function () {
          selected = s[Number(b.dataset.pick)];
          matches.innerHTML = '<div class="note"><strong>Assigning to: ' + App.esc(selected.Name) + '</strong> (' + App.esc(selected.StudentID) + ')<br>' + App.esc(selected.Course) + ' &middot; ' + App.esc(selected.BatchName) + ' &middot; ' + App.esc(selected.BatchTiming) + '</div>';
          pf.hidden = false; pf.elements.topic.focus();
        };
      });
    } catch (e) { matches.innerHTML = '<div class="error">' + App.esc(e.message) + '</div>'; }
  }
  document.getElementById('find').onclick = find;
  lk.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); find(); } };
  pf.onsubmit = async function (e) {
    e.preventDefault(); var b = document.getElementById('fe'); b.hidden = true;
    if (!selected) { b.textContent = 'Find and select a student first.'; b.hidden = false; return; }
    var btn = pf.querySelector('[type=submit]'); App.setBusy(btn, true);
    try {
      var r = await Api.call('assignPractice', Object.assign(App.formData(pf), { studentId: selected.StudentID }));
      App.toast(r.message, 'ok'); pf.reset(); pf.elements.assignedDate.value = App.today(); pf.hidden = true; matches.innerHTML = ''; lk.value = ''; selected = null; load();
    } catch (err) { b.textContent = err.message; b.hidden = false; }
    App.setBusy(btn, false);
  };

  function render() {
    var q = f.q.toLowerCase(), rows = list.filter(function (r) { return (!f.status || r.EffectiveStatus === f.status) && (!q || (r.StudentName + ' ' + r.Topic + ' ' + r.StudentEmail).toLowerCase().indexOf(q) >= 0); });
    var el = document.getElementById('plist');
    el.innerHTML = App.table([{ label: 'Student', html: function (r) { return '<strong>' + App.esc(r.StudentName) + '</strong><br><small>' + App.esc(r.Course) + ' &middot; ' + App.esc(r.BatchName) + '</small>'; } },
      { label: 'Topic', html: function (r) { return App.esc(r.Topic); } }, { label: 'Due', html: function (r) { return App.fmtDate(r.DueDate); }, cls: 'nw' },
      { label: 'Status', html: function (r) { return App.badge(r.EffectiveStatus); } }, { label: '', html: function (r) { return '<button class="btn sm ghost" data-review="' + App.esc(r.PracticeID) + '" type="button">Open</button>'; } }], rows,
      list.length ? 'No assignments match.' : 'No practice assigned yet.');
    el.querySelectorAll('[data-review]').forEach(function (b) { b.onclick = function () { review(list.filter(function (r) { return r.PracticeID === b.dataset.review; })[0]); }; });
  }
  function review(r) {
    var dlg = App.dialog(r.Topic, App.kv([['Student', r.StudentName], ['Course / batch', r.Course + ' - ' + r.BatchName], ['Assigned', App.fmtDate(r.AssignedDate)], ['Due', App.fmtDate(r.DueDate)], ['Expected duration', r.ExpectedDuration], ['Status', App.badge(r.EffectiveStatus), true],
      ['Submitted', r.SubmittedAt ? App.fmtDateTime(r.SubmittedAt) : ''], ['Actual duration', r.ActualDuration], ['Completed on', r.CompletionDate ? App.fmtDate(r.CompletionDate) : '']]) +
      '<h3 class="mt">Description</h3><p class="ws">' + App.esc(r.Description) + '</p>' + (r.SubmissionNotes ? '<h3>Student notes</h3><p class="ws">' + App.esc(r.SubmissionNotes) + '</p>' : '') +
      '<div class="field"><label for="fb">Feedback</label><textarea id="fb" rows="3" maxlength="1500">' + App.esc(r.Feedback) + '</textarea></div><div class="dlg-actions"><button class="btn ghost" data-do="feedback" type="button">Save feedback</button>' +
      ((['Submitted', 'Reviewed', 'Completed'].indexOf(r.Status) >= 0) ? '<button class="btn ghost" data-do="reopen" type="button">Reopen</button>' : '') + (r.Status !== 'Completed' ? '<button class="btn ok" data-do="complete" type="button">Mark completed</button>' : '') + '</div>', { wide: true });
    dlg.el.querySelectorAll('[data-do]').forEach(function (b) {
      b.onclick = async function () {
        if (await App.act('reviewPractice', { practiceId: r.PracticeID, action: b.dataset.do, feedback: dlg.el.querySelector('#fb').value }, 'Saved')) { dlg.close(); load(); }
      };
    });
  }
  async function load() { list = (await Api.call('getPracticeAssignments', {})).data.practice; render(); }
  document.getElementById('lq').oninput = function (e) { f.q = e.target.value.trim(); render(); };
  document.getElementById('ls').onchange = function (e) { f.status = e.target.value; render(); };
  await load();
  var pre = new URLSearchParams(location.search).get('q'); if (pre) { lk.value = pre; find(); }
};

/* ---------- Student ---------- */
Pages.Student['student-practice'] = async function (ctx) {
  async function draw() {
    var rows = (await Api.call('getPracticeAssignments', {})).data.practice.filter(function (r) { return ['Completed', 'Reviewed'].indexOf(r.Status) < 0; });
    ctx.view.innerHTML = '<div class="page-head"><div><h2>My practice</h2><p>Open work and work waiting for your teacher.</p></div></div>' +
      (rows.length ? '<div class="list">' + rows.map(function (r) {
        var can = r.Status === 'Assigned' || r.Status === 'In Progress';
        return '<div class="item"><h4>' + App.esc(r.Topic) + ' ' + App.badge(r.EffectiveStatus) + '</h4><div class="meta">Assigned ' + App.fmtDate(r.AssignedDate) + ' &middot; Due ' + App.fmtDate(r.DueDate) + (r.ExpectedDuration ? ' &middot; Expected ' + App.esc(r.ExpectedDuration) : '') + '</div>' +
          '<p class="ws">' + App.esc(r.Description) + '</p>' + (r.Feedback ? '<div class="note"><strong>Teacher feedback:</strong> ' + App.esc(r.Feedback) + '</div>' : '') +
          (can ? '<div class="btns">' + (r.Status === 'Assigned' ? '<button class="btn sm ghost" data-start="' + App.esc(r.PracticeID) + '" type="button">Mark in progress</button>' : '') + '<button class="btn sm" data-submit="' + App.esc(r.PracticeID) + '" type="button">Submit practice</button></div>' : '<div class="meta">Submitted ' + App.fmtDateTime(r.SubmittedAt) + ' - waiting for review.</div>') + '</div>';
      }).join('') + '</div>' : '<div class="empty">No open practice. Nice work!</div>');
    ctx.view.querySelectorAll('[data-start]').forEach(function (b) { b.onclick = async function () { if (await App.act('updatePracticeStatus', { practiceId: b.dataset.start }, 'Marked as in progress')) draw(); }; });
    ctx.view.querySelectorAll('[data-submit]').forEach(function (b) {
      b.onclick = function () {
        var dlg = App.dialog('Submit practice', '<div class="error" id="fe" hidden></div><form id="sf"><div class="field"><label for="ad">Time you spent practising (optional)</label><input id="ad" name="actualDuration" maxlength="60" placeholder="e.g. 90 minutes"></div>' +
          '<div class="field"><label for="sn">Notes for your teacher (optional)</label><textarea id="sn" name="notes" rows="4" maxlength="1000"></textarea></div><div class="dlg-actions"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Submit</button></div></form>');
        dlg.el.querySelector('#sf').onsubmit = async function (e) {
          e.preventDefault(); var btn = e.target.querySelector('[type=submit]'); App.setBusy(btn, true);
          try { await Api.call('submitPractice', Object.assign(App.formData(e.target), { practiceId: b.dataset.submit })); App.toast('Practice submitted', 'ok'); dlg.close(); draw(); }
          catch (err) { var x = dlg.el.querySelector('#fe'); x.textContent = err.message; x.hidden = false; App.setBusy(btn, false); }
        };
      };
    });
  }
  await draw();
};

Pages.Student['practice-history'] = async function (ctx) {
  var rows = (await Api.call('getPracticeHistory', {})).data.practice;
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Practice history</h2><p>Completed and reviewed work.</p></div></div>' + App.table([
    { label: 'Topic', html: function (r) { return App.esc(r.Topic); } }, { label: 'Assigned', html: function (r) { return App.fmtDate(r.AssignedDate); }, cls: 'nw' }, { label: 'Due', html: function (r) { return App.fmtDate(r.DueDate); }, cls: 'nw' },
    { label: 'Completed', html: function (r) { return r.CompletionDate ? App.fmtDate(r.CompletionDate) : '-'; }, cls: 'nw' }, { label: 'Status', html: function (r) { return App.badge(r.Status); } }, { label: 'Feedback', html: function (r) { return App.esc(r.Feedback); } }], rows, 'No completed practice yet.');
};
