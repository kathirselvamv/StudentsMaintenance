/* records.js - test marks and progress log (teacher enters, student views own) */
function pctBadge(p) { var n = Number(p); return '<span class="badge ' + (n >= 75 ? 'ok' : n >= 50 ? 'warn' : 'bad') + '">' + App.esc(p) + '%</span>'; }

/* ---------------- Teacher: Test marks ---------------- */
var MARK_CATS = ['MCQ', 'Definition', 'Practice Test', 'Oral/Viva', 'Other'];
Pages.Teacher['test-marks'] = async function (ctx) {
  var students = (await Api.call('getStudents', {})).data.students.filter(function (s) { return s.Status !== 'Inactive'; }), marks = [], f = { q: '', course: '', test: '', cat: '' };
  function uniq(list, k) { return Object.keys(list.reduce(function (o, s) { if (s[k]) o[s[k]] = 1; return o; }, {})).sort(); }
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Test marks</h2><p>Online test results arrive automatically; you add practice test and viva marks. Students see their own marks only.</p></div></div>' +
    '<section class="panel"><h3>Results from the old test website (optional)</h3><p>Tests taken on this site appear below automatically. Only use this if you also want results from ficotestapp.vercel.app (it must be connected in Script Properties).</p>' +
    '<div class="actions-row"><button class="btn sm" id="sync" type="button">Import old results</button></div><div id="syncres" aria-live="polite"></div></section>' +
    '<section class="panel" id="pendpanel" hidden><h3>Waiting for your marks</h3><div id="pend"></div></section>' +
    '<section class="panel"><h3>Enter marks (practice test, viva, other)</h3><div class="error" id="fe" role="alert" hidden></div><form id="mf" novalidate><div class="grid cols2"><div class="field"><label for="ct">Category</label><select id="ct" name="category">' + App.opts(MARK_CATS, 'Practice Test') + '</select></div>' +
    '<div class="field"><label for="tn">Test name</label><input id="tn" name="testName" maxlength="100" placeholder="e.g. Practice test 1 or Viva round 1" required></div></div>' +
    '<div class="grid cols2"><div class="field"><label for="td">Date</label><input id="td" name="testDate" type="date" required></div><div class="field"><label for="mm">Maximum marks</label><input id="mm" name="maxMarks" type="number" min="1" max="1000" step="0.01" required></div></div>' +
    '<div class="filters"><select id="bc" aria-label="Course">' + App.opts(uniq(students, 'Course'), '', 'All courses') + '</select><select id="bb" aria-label="Batch">' + App.opts(uniq(students, 'BatchName'), '', 'All batches') + '</select></div>' +
    '<p class="hint">Marks only, no questions needed. Leave marks empty for students who did not take part.</p><div id="rows"></div><button class="btn sm" type="submit">Save marks</button></form></section>' +
    '<section class="panel"><h3>Marks records</h3><div class="filters"><input class="search" id="rq" type="search" placeholder="Search student" aria-label="Search student"><select id="rc" aria-label="Course"></select><select id="rt" aria-label="Test"></select><select id="rk" aria-label="Category">' + App.opts(MARK_CATS, '', 'All categories') + '</select></div><div id="tbl"><div class="loading">Loading...</div></div></section>';
  var form = document.getElementById('mf'); form.elements.testDate.value = App.today();
  var typed = {};
  function keep() { Array.prototype.forEach.call(document.querySelectorAll('[data-m]'), function (i) { typed[i.dataset.m] = { m: i.value, r: (document.querySelector('[data-r="' + i.dataset.m + '"]') || {}).value || '' }; }); }
  function drawRows() {
    keep(); var c = document.getElementById('bc').value, b = document.getElementById('bb').value;
    var list = students.filter(function (s) { return (!c || s.Course === c) && (!b || s.BatchName === b); });
    document.getElementById('rows').innerHTML = App.table([{ label: 'Student', html: function (s) { return '<strong>' + App.esc(s.Name) + '</strong><br><small>' + App.esc(s.Course) + ' &middot; ' + App.esc(s.BatchName) + '</small>'; } },
      { label: 'Marks', html: function (s) { return '<input type="number" min="0" step="0.01" data-m="' + App.esc(s.StudentID) + '" aria-label="Marks for ' + App.esc(s.Name) + '" value="' + App.esc((typed[s.StudentID] || {}).m || '') + '">'; } },
      { label: 'Remarks (optional)', html: function (s) { return '<input maxlength="300" data-r="' + App.esc(s.StudentID) + '" aria-label="Remarks for ' + App.esc(s.Name) + '" value="' + App.esc((typed[s.StudentID] || {}).r || '') + '">'; } }], list, 'No students match.');
  }
  document.getElementById('bc').onchange = drawRows; document.getElementById('bb').onchange = drawRows; drawRows();
  form.onsubmit = async function (e) {
    e.preventDefault(); var er = document.getElementById('fe'); er.hidden = true; keep();
    var entries = []; Object.keys(typed).forEach(function (id) { if (String(typed[id].m).trim() !== '') entries.push({ studentId: id, marks: typed[id].m, remarks: typed[id].r }); });
    if (!entries.length) { er.textContent = 'Enter marks for at least one student.'; er.hidden = false; return; }
    var btn = form.querySelector('[type=submit]'); App.setBusy(btn, true);
    try { var r = await Api.call('saveTestMarks', { category: form.elements.category.value, testName: form.elements.testName.value, testDate: form.elements.testDate.value, maxMarks: form.elements.maxMarks.value, entries: entries }); App.toast(r.message, 'ok'); typed = {}; form.elements.testName.value = ''; drawRows(); load(); }
    catch (err) { er.textContent = err.message; er.hidden = false; }
    App.setBusy(btn, false);
  };
  document.getElementById('sync').onclick = async function () {
    var b = this, out = document.getElementById('syncres'); App.setBusy(b, true);
    try {
      var d = (await Api.call('syncTestSite', {})).data;
      out.innerHTML = '<div class="note"><strong>Synced.</strong> New MCQ results: ' + d.imported + ' &middot; Definition answers waiting for marks: ' + d.pendingDefinitions + ' &middot; Already imported: ' + d.alreadyImported +
        ' &middot; Not matched to your students: ' + d.notMatched + (d.notMatched ? '<br><small>Students must use the same email as their account when taking a test.</small>' : '') + '</div>';
      await load(); Shell.refreshBell();
    } catch (err) { out.innerHTML = '<div class="error" role="alert">' + App.esc(err.message) + '</div>'; }
    App.setBusy(b, false);
  };
  function catBadge(c) { return '<span class="badge info">' + App.esc(c || 'Other') + '</span>'; }
  function renderPending() {
    var p = marks.filter(function (m) { return m.MarkStatus === 'Pending'; }); document.getElementById('pendpanel').hidden = !p.length;
    var el = document.getElementById('pend');
    el.innerHTML = App.table([{ label: 'Student', html: function (m) { return '<strong>' + App.esc(m.StudentName) + '</strong><br><small>' + App.esc(m.Course) + ' &middot; ' + App.esc(m.BatchName) + '</small>'; } },
      { label: 'Test', html: function (m) { return App.esc(m.TestName) + ' ' + catBadge(m.Category); } }, { label: 'Submitted', html: function (m) { return App.fmtDate(m.TestDate); }, cls: 'nw' },
      { label: '', html: function (m) { return '<button class="btn sm" data-g="' + App.esc(m.TestID) + '" type="button">Read answers and give marks</button>'; } }], p, '');
    el.querySelectorAll('[data-g]').forEach(function (b) {
      b.onclick = async function () {
        var m = marks.filter(function (x) { return x.TestID === b.dataset.g; })[0], dlg = App.dialog('Give marks - ' + m.StudentName, '<div class="loading">Loading answers...</div>', { wide: true });
        try {
          var d = (await Api.call('getTestSubmission', { testId: m.TestID })).data;
          dlg.el.querySelector('.dlg-body').innerHTML = '<p><strong>' + App.esc(d.testName) + '</strong> ' + catBadge(d.category) + '</p><p class="hint">Marks are out of the number you enter below (suggested: one mark per question).</p>' +
            (d.answers.length ? '<div class="list">' + d.answers.map(function (x, i) { return '<div class="item"><h4>' + (i + 1) + '. ' + App.esc(x.q) + '</h4><div class="ws">' + (x.a ? App.esc(x.a) : '<em>(no answer)</em>') + '</div>' + (x.m ? '<div class="note mt"><strong>Model answer:</strong> ' + App.esc(x.m) + '</div>' : '') + '</div>'; }).join('') + '</div>' : '<div class="empty">No answers were saved. Check the test website.</div>') +
            '<div class="error mt" id="ee" role="alert" hidden></div><form id="gf"><div class="grid cols2"><div class="field"><label for="gm">Marks obtained</label><input id="gm" name="marks" type="number" min="0" step="0.01" required></div><div class="field"><label for="gx">Out of</label><input id="gx" name="maxMarks" type="number" min="1" step="0.01" required></div></div>' +
            '<div class="field"><label for="gr">Remarks (optional)</label><textarea id="gr" name="remarks" rows="2" maxlength="300"></textarea></div><div class="dlg-actions"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save marks</button></div></form>';
          dlg.el.querySelector('#gx').value = d.answers.length || ''; dlg.el.querySelector('#gf').onsubmit = async function (ev) {
            ev.preventDefault();
            try { await Api.call('updateTestMark', Object.assign(App.formData(ev.target), { testId: m.TestID })); App.toast('Marks saved', 'ok'); dlg.close(); load(); }
            catch (err) { var x = dlg.el.querySelector('#ee'); x.textContent = err.message; x.hidden = false; }
          };
        } catch (err) { dlg.el.querySelector('.dlg-body').innerHTML = '<div class="error">' + App.esc(err.message) + '</div>'; }
      };
    });
  }
  function render() {
    var q = f.q.toLowerCase(), rows = marks.filter(function (m) { return m.MarkStatus !== 'Pending' && (!q || m.StudentName.toLowerCase().indexOf(q) >= 0) && (!f.course || m.Course === f.course) && (!f.test || m.TestName === f.test) && (!f.cat || m.Category === f.cat); });
    var el = document.getElementById('tbl');
    el.innerHTML = App.table([{ label: 'Test', html: function (m) { return '<strong>' + App.esc(m.TestName) + '</strong><br>' + catBadge(m.Category) + (m.Source && m.Source !== 'Manual' ? ' <small>auto</small>' : ''); } }, { label: 'Date', html: function (m) { return App.fmtDate(m.TestDate); }, cls: 'nw' },
      { label: 'Student', html: function (m) { return App.esc(m.StudentName) + '<br><small>' + App.esc(m.Course) + ' &middot; ' + App.esc(m.BatchName) + '</small>'; } },
      { label: 'Marks', html: function (m) { return App.esc(m.MarksObtained) + ' / ' + App.esc(m.MaxMarks); }, cls: 'nw' }, { label: '%', html: function (m) { return pctBadge(m.Percentage); } },
      { label: 'Remarks', html: function (m) { return App.esc(m.Remarks); } }, { label: '', html: function (m) { return '<button class="btn sm ghost" data-e="' + App.esc(m.TestID) + '" type="button">Edit</button>'; } }], rows, marks.length ? 'No records match.' : 'No marks entered yet.');
    el.querySelectorAll('[data-e]').forEach(function (b) {
      b.onclick = function () {
        var m = marks.filter(function (x) { return x.TestID === b.dataset.e; })[0];
        var dlg = App.dialog('Edit marks', App.kv([['Student', m.StudentName], ['Test', m.TestName], ['Category', m.Category], ['Date', App.fmtDate(m.TestDate)], ['Maximum marks', m.MaxMarks]]) +
          '<div class="error mt" id="ee" hidden></div><form id="ef"><div class="field"><label for="em">Marks obtained</label><input id="em" name="marks" type="number" min="0" max="' + App.esc(m.MaxMarks) + '" step="0.01" value="' + App.esc(m.MarksObtained) + '" required></div>' +
          '<div class="field"><label for="er">Remarks</label><textarea id="er" name="remarks" rows="2" maxlength="300">' + App.esc(m.Remarks) + '</textarea></div><div class="dlg-actions"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save</button></div></form>');
        dlg.el.querySelector('#ef').onsubmit = async function (ev) {
          ev.preventDefault();
          try { await Api.call('updateTestMark', Object.assign(App.formData(ev.target), { testId: m.TestID })); App.toast('Marks updated', 'ok'); dlg.close(); load(); }
          catch (err) { var x = dlg.el.querySelector('#ee'); x.textContent = err.message; x.hidden = false; }
        };
      };
    });
  }
  async function load() {
    marks = (await Api.call('getTestMarks', {})).data.marks;
    document.getElementById('rc').innerHTML = App.opts(uniq(marks, 'Course'), f.course, 'All courses'); document.getElementById('rt').innerHTML = App.opts(uniq(marks, 'TestName'), f.test, 'All tests'); renderPending(); render();
  }
  document.getElementById('rq').oninput = function (e) { f.q = e.target.value.trim(); render(); };
  document.getElementById('rc').onchange = function (e) { f.course = e.target.value; render(); }; document.getElementById('rt').onchange = function (e) { f.test = e.target.value; render(); }; document.getElementById('rk').onchange = function (e) { f.cat = e.target.value; render(); };
  await load();
};

/* ---------------- Teacher: Progress log ---------------- */
function progressFields(l) {
  l = l || {};
  return '<div class="grid cols3"><div class="field"><label for="pf1">From date</label><input id="pf1" name="fromDate" type="date" value="' + App.esc(l.FromDate || '') + '" required></div><div class="field"><label for="pf2">To date</label><input id="pf2" name="toDate" type="date" value="' + App.esc(l.ToDate || '') + '" required></div>' +
    '<div class="field"><label for="pf3">Days practiced</label><input id="pf3" name="daysPracticed" type="number" min="0" step="1" value="' + App.esc(l.DaysPracticed || '') + '" required></div></div>' +
    '<div class="field"><label for="pf4">Topics covered</label><textarea id="pf4" name="topics" rows="3" maxlength="1000" required>' + App.esc(l.TopicsCovered || '') + '</textarea></div><div class="field"><label for="pf5">Notes (optional)</label><textarea id="pf5" name="notes" rows="2" maxlength="500">' + App.esc(l.Notes || '') + '</textarea></div>';
}
Pages.Teacher['progress-log'] = async function (ctx) {
  var selected = null, logs = [], f = { q: '', course: '' };
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Progress log</h2><p>Record how many days a student practiced and which topics they covered.</p></div></div><section class="panel narrow"><h3>Add progress</h3>' +
    '<div class="field"><label for="lk">Student email or phone number</label><div class="row"><input id="lk" type="search" autocomplete="off"><button class="btn" id="find" type="button">Find student</button></div></div><div id="matches" aria-live="polite"></div>' +
    '<form id="pf" hidden novalidate><div class="error" id="fe" role="alert" hidden></div>' + progressFields() + '<button class="btn" type="submit">Save progress</button></form></section>' +
    '<section class="panel"><h3>All progress records</h3><div class="filters"><input class="search" id="lq" type="search" placeholder="Search student or topic" aria-label="Search"><select id="lc" aria-label="Course"></select></div><div id="tbl"><div class="loading">Loading...</div></div></section>';
  var lk = document.getElementById('lk'), matches = document.getElementById('matches'), pf = document.getElementById('pf');
  async function find() {
    var q = lk.value.trim(); pf.hidden = true; selected = null;
    if (q.length < 3) { matches.innerHTML = '<div class="error">Type at least 3 characters of the email or phone number.</div>'; return; }
    try {
      var s = (await Api.call('searchStudent', { query: q })).data.students;
      if (!s.length) { matches.innerHTML = '<div class="error">No matching student found in your student list.</div>'; return; }
      matches.innerHTML = '<p>' + (s.length > 1 ? 'Several students match. Select the correct one.' : 'Confirm this is the right student.') + '</p><div class="list">' + s.map(function (x, i) {
        return '<div class="item"><h4>' + App.esc(x.Name) + ' ' + App.badge(x.Status) + '</h4><div class="meta">' + App.esc(x.Email) + ' &middot; ' + App.esc(x.Phone) + ' &middot; ' + App.esc(x.Course) + ' &middot; ' + App.esc(x.BatchName) + '</div><div class="btns"><button class="btn sm" data-pick="' + i + '" type="button"' + (x.Status === 'Inactive' ? ' disabled' : '') + '>Select this student</button></div></div>'; }).join('') + '</div>';
      matches.querySelectorAll('[data-pick]').forEach(function (b) { b.onclick = function () { selected = s[Number(b.dataset.pick)]; matches.innerHTML = '<div class="note"><strong>Adding progress for: ' + App.esc(selected.Name) + '</strong> (' + App.esc(selected.Course) + ' &middot; ' + App.esc(selected.BatchName) + ')</div>'; pf.hidden = false; }; });
    } catch (e) { matches.innerHTML = '<div class="error">' + App.esc(e.message) + '</div>'; }
  }
  document.getElementById('find').onclick = find; lk.onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); find(); } };
  pf.onsubmit = async function (e) {
    e.preventDefault(); var er = document.getElementById('fe'); er.hidden = true; if (!selected) { er.textContent = 'Find and select a student first.'; er.hidden = false; return; }
    var btn = pf.querySelector('[type=submit]'); App.setBusy(btn, true);
    try { var r = await Api.call('addProgressLog', Object.assign(App.formData(pf), { studentId: selected.StudentID })); App.toast(r.message, 'ok'); pf.reset(); pf.hidden = true; matches.innerHTML = ''; lk.value = ''; selected = null; load(); }
    catch (err) { er.textContent = err.message; er.hidden = false; }
    App.setBusy(btn, false);
  };
  function render() {
    var q = f.q.toLowerCase(), rows = logs.filter(function (l) { return (!q || (l.StudentName + ' ' + l.TopicsCovered).toLowerCase().indexOf(q) >= 0) && (!f.course || l.Course === f.course); });
    var el = document.getElementById('tbl');
    el.innerHTML = App.table([{ label: 'Student', html: function (l) { return '<strong>' + App.esc(l.StudentName) + '</strong><br><small>' + App.esc(l.Course) + ' &middot; ' + App.esc(l.BatchName) + '</small>'; } },
      { label: 'Period', html: function (l) { return App.fmtDate(l.FromDate) + ' to ' + App.fmtDate(l.ToDate); }, cls: 'nw' }, { label: 'Days practiced', html: function (l) { return '<strong>' + App.esc(l.DaysPracticed) + '</strong>'; } },
      { label: 'Topics covered', html: function (l) { return '<span class="ws">' + App.esc(l.TopicsCovered) + '</span>'; } }, { label: '', html: function (l) { return '<button class="btn sm ghost" data-e="' + App.esc(l.LogID) + '" type="button">Edit</button>'; } }], rows, logs.length ? 'No records match.' : 'No progress recorded yet.');
    el.querySelectorAll('[data-e]').forEach(function (b) {
      b.onclick = function () {
        var l = logs.filter(function (x) { return x.LogID === b.dataset.e; })[0];
        var dlg = App.dialog('Edit progress - ' + l.StudentName, '<div class="error" id="ee" hidden></div><form id="ef">' + progressFields(l) + '<div class="dlg-actions"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">Save</button></div></form>', { wide: true });
        dlg.el.querySelector('#ef').onsubmit = async function (ev) {
          ev.preventDefault();
          try { await Api.call('updateProgressLog', Object.assign(App.formData(ev.target), { logId: l.LogID })); App.toast('Progress updated', 'ok'); dlg.close(); load(); }
          catch (err) { var x = dlg.el.querySelector('#ee'); x.textContent = err.message; x.hidden = false; }
        };
      };
    });
  }
  async function load() {
    logs = (await Api.call('getProgressLogs', {})).data.logs; var cs = Object.keys(logs.reduce(function (o, l) { o[l.Course] = 1; return o; }, {})).sort();
    document.getElementById('lc').innerHTML = App.opts(cs, f.course, 'All courses'); render();
  }
  document.getElementById('lq').oninput = function (e) { f.q = e.target.value.trim(); render(); }; document.getElementById('lc').onchange = function (e) { f.course = e.target.value; render(); };
  await load();
};

/* ---------------- Student: My marks / My progress ---------------- */
Pages.Student['student-marks'] = async function (ctx) {
  var m = (await Api.call('getTestMarks', {})).data.marks, pcts = m.map(function (x) { return Number(x.Percentage); });
  var avg = pcts.length ? Math.round(pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length * 10) / 10 : 0, best = pcts.length ? Math.max.apply(null, pcts) : 0;
  var by = {}; m.forEach(function (x) { (by[x.Category] = by[x.Category] || []).push(Number(x.Percentage)); });
  var cats = Object.keys(by).map(function (c) { var l = by[c]; return '<div class="stat g' + (Object.keys(by).indexOf(c) % 4) + '"><b>' + Math.round(l.reduce(function (a, b) { return a + b; }, 0) / l.length * 10) / 10 + '%</b><span>' + App.esc(c) + ' average (' + l.length + ')</span></div>'; }).join('');
  ctx.view.innerHTML = '<div class="page-head"><div><h2>My marks</h2><p>Test results from your teacher and the online tests.</p></div><a class="btn sm" href="student-tests.html">Take an online test</a></div>' +
    '<div class="grid stats"><div class="stat g0"><b>' + m.length + '</b><span>Results</span></div><div class="stat g1"><b>' + (m.length ? avg + '%' : '-') + '</b><span>Overall average</span></div><div class="stat g2"><b>' + (m.length ? best + '%' : '-') + '</b><span>Best score</span></div>' + cats + '</div>' +
    App.table([{ label: 'Test', html: function (x) { return '<strong>' + App.esc(x.TestName) + '</strong>'; } }, { label: 'Category', html: function (x) { return '<span class="badge info">' + App.esc(x.Category) + '</span>'; } }, { label: 'Date', html: function (x) { return App.fmtDate(x.TestDate); }, cls: 'nw' },
      { label: 'Marks', html: function (x) { return App.esc(x.MarksObtained) + ' / ' + App.esc(x.MaxMarks); }, cls: 'nw' }, { label: 'Percentage', html: function (x) { return pctBadge(x.Percentage); } }, { label: 'Teacher remarks', html: function (x) { return App.esc(x.Remarks); } }], m, 'No results yet.');
};
Pages.Student['student-progress'] = async function (ctx) {
  var l = (await Api.call('getProgressLogs', {})).data.logs, days = l.reduce(function (a, x) { return a + Number(x.DaysPracticed); }, 0);
  ctx.view.innerHTML = '<div class="page-head"><div><h2>My progress</h2><p>Days you practiced and topics covered, recorded by your teacher.</p></div></div><div class="grid stats"><div class="stat g0"><b>' + days + '</b><span>Total days practiced</span></div><div class="stat g1"><b>' + l.length + '</b><span>Progress records</span></div></div>' +
    (l.length ? '<div class="list">' + l.map(function (x) { return '<div class="item"><h4>' + App.fmtDate(x.FromDate) + ' to ' + App.fmtDate(x.ToDate) + ' &middot; ' + App.esc(x.DaysPracticed) + ' day' + (x.DaysPracticed === '1' ? '' : 's') + ' practiced</h4><div class="ws"><strong>Topics:</strong> ' + App.esc(x.TopicsCovered) + '</div>' + (x.Notes ? '<div class="meta ws">' + App.esc(x.Notes) + '</div>' : '') + '</div>'; }).join('') + '</div>' : '<div class="empty">No progress recorded yet.</div>');
};
