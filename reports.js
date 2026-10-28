/* reports.js - teacher reports with filters and CSV export (data comes only from the teacher's own records) */
Pages.Teacher.reports = async function (ctx) {
  var TYPES = [['students', 'Students'], ['practice-all', 'Practice - all'], ['practice-completed', 'Practice completion'], ['practice-pending', 'Pending practice'], ['practice-overdue', 'Overdue practice'],
    ['leave-approved', 'Approved leave'], ['leave-pending', 'Pending leave'], ['leave-rejected', 'Rejected leave'], ['leave-emergency', 'Emergency leave'], ['incidents-late', 'Late leave incidents'], ['incidents-unreported', 'Unreported absences']];
  var last = null, students = (await Api.call('getStudents', {})).data.students;
  function uniq(k) { return Object.keys(students.reduce(function (o, s) { if (s[k]) o[s[k]] = 1; return o; }, {})).sort(); }
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Reports</h2><p>Reports include only your own students.</p></div></div><section class="panel"><form id="rf"><div class="filters">' +
    '<select name="type" aria-label="Report">' + TYPES.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('') + '</select>' +
    '<input name="from" type="date" aria-label="From date"><input name="to" type="date" aria-label="To date"><select name="course" aria-label="Course">' + App.opts(uniq('Course'), '', 'All courses') + '</select>' +
    '<select name="batch" aria-label="Batch">' + App.opts(uniq('BatchName'), '', 'All batches') + '</select><input class="search" name="q" type="search" placeholder="Search name, email or phone" aria-label="Search"></div>' +
    '<div class="actions-row"><button class="btn sm" type="submit">Run report</button><button class="btn sm ghost" id="csv" type="button" disabled>Export CSV</button></div></form></section><div id="out"></div>';
  var form = document.getElementById('rf'), out = document.getElementById('out'), csvBtn = document.getElementById('csv');
  function sumList(o) { var k = Object.keys(o); return k.length ? k.map(function (x) { return App.esc(x) + ': <strong>' + o[x] + '</strong>'; }).join(' &middot; ') : 'None'; }
  async function run() {
    out.innerHTML = '<div class="loading">Loading...</div>'; csvBtn.disabled = true;
    try {
      var d = (await Api.call('getReport', App.formData(form))).data; last = d; var s = d.summary;
      out.innerHTML = '<section class="panel"><h3>Summary (students matching the course, batch and search filters)</h3><p>Total students: <strong>' + s.totalStudents + '</strong></p><p>By course: ' + sumList(s.byCourse) + '</p><p>By batch: ' + sumList(s.byBatch) + '</p><p>Online / offline: ' + sumList(s.onlineOffline) + '</p><p>Status: ' + sumList(s.statusSplit) + '</p></section>' +
        '<section class="panel"><h3>' + App.esc(form.elements.type.options[form.elements.type.selectedIndex].text) + ' (' + d.rows.length + ')</h3>' + App.table(d.columns.map(function (c) { return { label: c.label, html: function (r) { var v = r[c.key]; return /Date|Requested|At$/.test(c.key) && v ? App.fmtDate(v) : App.esc(v); } }; }), d.rows, 'No records match these filters.') + '</section>';
      csvBtn.disabled = !d.rows.length;
    } catch (e) { out.innerHTML = '<div class="error" role="alert">' + App.esc(e.message) + '</div>'; }
  }
  form.onsubmit = function (e) { e.preventDefault(); run(); };
  csvBtn.onclick = function () { if (last) App.csv(last.type + '-' + App.today() + '.csv', last.columns, last.rows); };
  await run();
};
