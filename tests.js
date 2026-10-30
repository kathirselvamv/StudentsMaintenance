/* tests.js - online tests: teacher manages tests, students take them (answers are scored on the server) */

function parseBulk(kind, text) {
  var lines = text.split('\n').map(function (s) { return s.trim(); }).filter(Boolean), out = [];
  if (!lines.length) return { error: 'Add at least one question.' };
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    if (kind === 'MCQ') {
      var a = l.split('|').map(function (s) { return s.trim(); });
      if (a.length !== 6) return { error: 'Line ' + (i + 1) + ': use  Question|Option A|Option B|Option C|Option D|B  (6 parts separated by |).' };
      var c = 'ABCD'.indexOf(a[5].toUpperCase());
      if (a[5].length !== 1 || c < 0) return { error: 'Line ' + (i + 1) + ': the last part must be A, B, C or D.' };
      out.push({ text: a[0], options: a.slice(1, 5), correct: c });
    } else { var p = l.split('||'); out.push({ text: p[0].trim(), model: (p[1] || '').trim() }); }
  }
  return { questions: out };
}
function serializeBulk(kind, qs) {
  return qs.map(function (q) { return kind === 'MCQ' ? [q.text].concat(q.options).concat(['ABCD'.charAt(q.correct)]).join('|') : q.text + (q.model ? ' || ' + q.model : ''); }).join('\n');
}
var FORMAT_HELP = { MCQ: 'One question per line:  Question|Option A|Option B|Option C|Option D|B   (the last letter is the correct answer).', Definition: 'One question per line. Optionally add a model answer for yourself after || :  What is a Company Code? || Smallest unit with complete accounts.' };

/* ---------------- Teacher: manage tests ---------------- */
Pages.Teacher.tests = async function (ctx) {
  var list = [];
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Online tests</h2><p>Students take these on this site. MCQs are scored automatically; definition answers wait for your marks on the Test Marks page.</p></div>' +
    '<div class="actions-row"><button class="btn sm" id="new" type="button">New test</button><button class="btn sm ghost" id="imp" type="button">Import FICO question bank</button></div></div><div id="impres" aria-live="polite"></div><div id="tbl"><div class="loading">Loading...</div></div>';
  function render() {
    document.getElementById('tbl').innerHTML = App.table([{ label: 'Test', html: function (q) { return '<strong>' + App.esc(q.Title) + '</strong>' + (q.Course ? '<br><small>Only for ' + App.esc(q.Course) + '</small>' : ''); } },
      { label: 'Type', html: function (q) { return App.badge(q.Kind === 'MCQ' ? 'Online' : 'Offline').replace(/Online|Offline/, q.Kind).replace(/class="badge [a-z]+"/, 'class="badge info"'); } },
      { label: 'Questions', html: function (q) { return q.Questions; } }, { label: 'Time', html: function (q) { return Number(q.DurationMinutes) ? q.DurationMinutes + ' min' : 'No limit'; }, cls: 'nw' },
      { label: 'Attempts', html: function (q) { return q.Attempts; } }, { label: 'Status', html: function (q) { return q.Status === 'Published' ? '<span class="badge ok">Published</span>' : '<span class="badge muted">Draft</span>'; } },
      { label: '', cls: 'nw', html: function (q) { var id = App.esc(q.QuizID); return '<button class="btn sm ghost" data-t="' + id + '" type="button">' + (q.Status === 'Published' ? 'Unpublish' : 'Publish') + '</button> <button class="btn sm ghost" data-ed="' + id + '" type="button">Edit</button> <button class="btn sm danger" data-del="' + id + '" type="button">Delete</button>'; } }],
      list, 'No tests yet. Create one, or import your FICO question bank.');
    var el = document.getElementById('tbl');
    function one(id) { return list.filter(function (q) { return q.QuizID === id; })[0]; }
    el.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = async function () { var q = one(b.dataset.t); await toggle(q); }; });
    el.querySelectorAll('[data-ed]').forEach(function (b) { b.onclick = function () { openForm(one(b.dataset.ed)); }; });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = async function () {
        var q = one(b.dataset.del), ok = await App.confirm({ title: 'Delete test', message: 'Delete "' + q.Title + '" (' + q.Kind + ') and its ' + q.Questions + ' questions? This cannot be undone.', confirmText: 'Delete', danger: true });
        if (ok && await App.act('deleteQuiz', { quizId: q.QuizID }, 'Test deleted')) load();
      };
    });
  }
  async function toggle(q) {
    var next = q.Status === 'Published' ? 'Draft' : 'Published';
    if (await App.act('updateQuiz', { quizId: q.QuizID, title: q.Title, durationMinutes: q.DurationMinutes, showAnswers: q.ShowAnswers, course: q.Course, status: next }, next === 'Published' ? 'Published - students can take it now' : 'Moved to draft')) load();
  }
  async function openForm(q) {
    var qs = []; if (q) qs = (await Api.call('getQuizQuestions', { quizId: q.QuizID })).data.questions;
    var kind = q ? q.Kind : 'MCQ';
    var dlg = App.dialog(q ? 'Edit test' : 'New test', '<div class="error" id="fe" role="alert" hidden></div><form id="qf" novalidate><div class="grid cols2"><div class="field"><label for="qt">Test title</label><input id="qt" name="title" maxlength="100" required value="' + App.esc(q ? q.Title : '') + '"></div>' +
      '<div class="field"><label for="qk">Type</label><select id="qk" name="kind"' + (q ? ' disabled' : '') + '>' + App.opts(['MCQ', 'Definition'], kind) + '</select></div></div>' +
      '<div class="grid cols3"><div class="field"><label for="qd">Time limit (minutes, 0 = none)</label><input id="qd" name="durationMinutes" type="number" min="0" max="300" step="1" value="' + App.esc(q ? q.DurationMinutes : '0') + '"></div>' +
      '<div class="field"><label for="qs">Show answers after submit (MCQ)</label><select id="qs" name="showAnswers"><option value="yes"' + (q && q.ShowAnswers === 'no' ? '' : ' selected') + '>Yes</option><option value="no"' + (q && q.ShowAnswers === 'no' ? ' selected' : '') + '>No</option></select></div>' +
      '<div class="field"><label for="qc">Only for course (optional)</label><input id="qc" name="course" maxlength="100" value="' + App.esc(q ? q.Course : '') + '"></div></div>' +
      '<div class="field"><label for="qst">Status</label><select id="qst" name="status">' + App.opts(['Draft', 'Published'], q ? q.Status : 'Draft') + '</select></div>' +
      '<div class="field"><label for="qq">Questions</label><textarea id="qq" rows="10" required>' + App.esc(serializeBulk(kind, qs)) + '</textarea><p class="hint" id="qh">' + App.esc(FORMAT_HELP[kind]) + '</p></div>' +
      '<div class="dlg-actions"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" type="submit">' + (q ? 'Save test' : 'Create test') + '</button></div></form>', { wide: true });
    var f = dlg.el.querySelector('#qf');
    f.elements.kind.onchange = function () { dlg.el.querySelector('#qh').textContent = FORMAT_HELP[f.elements.kind.value]; };
    f.onsubmit = async function (e) {
      e.preventDefault(); var er = dlg.el.querySelector('#fe'); er.hidden = true;
      var k = q ? q.Kind : f.elements.kind.value, parsed = parseBulk(k, dlg.el.querySelector('#qq').value);
      if (parsed.error) { er.textContent = parsed.error; er.hidden = false; return; }
      var payload = { title: f.elements.title.value, durationMinutes: f.elements.durationMinutes.value, showAnswers: f.elements.showAnswers.value, course: f.elements.course.value, status: f.elements.status.value, questions: parsed.questions };
      if (q) payload.quizId = q.QuizID; else payload.kind = k;
      var btn = f.querySelector('[type=submit]'); App.setBusy(btn, true);
      try { await Api.call(q ? 'updateQuiz' : 'createQuiz', payload); App.toast('Test saved', 'ok'); dlg.close(); load(); }
      catch (err) { er.textContent = err.message; er.hidden = false; App.setBusy(btn, false); }
    };
  }
  async function importBank() {
    var out = document.getElementById('impres'), ok = await App.confirm({ title: 'Import FICO question bank', message: 'This creates your First Half, Second Half, Full Test and Topic 2-22 tests (MCQ and Definition, about 850 questions) as published tests. Tests you already have with the same name are skipped. It takes a minute or two.', confirmText: 'Import' });
    if (!ok) return;
    var b = document.getElementById('imp'); b.disabled = true;
    try {
      var bank = await (await fetch('fico-bank.json', { cache: 'no-store' })).json(), jobs = [];
      bank.tests.forEach(function (t) { jobs.push({ title: t.title, kind: 'MCQ', questions: t.mcq }); jobs.push({ title: t.title, kind: 'Definition', questions: t.def }); });
      var made = 0, skipped = 0, failed = 0, lastErr = '';
      for (var i = 0; i < jobs.length; i++) {
        out.innerHTML = '<div class="note">Importing ' + (i + 1) + ' of ' + jobs.length + ': ' + App.esc(jobs[i].title) + ' (' + jobs[i].kind + ')...</div>';
        try { await Api.call('createQuiz', { title: jobs[i].title, kind: jobs[i].kind, durationMinutes: 0, showAnswers: 'yes', status: 'Published', questions: jobs[i].questions }); made++; }
        catch (e) { if (e.code === 'DUPLICATE') skipped++; else { failed++; lastErr = e.message; } }
      }
      out.innerHTML = '<div class="' + (failed ? 'error' : 'note') + '"><strong>Import finished.</strong> Created ' + made + ', skipped ' + skipped + ' (already existed), failed ' + failed + (lastErr ? '. Last error: ' + App.esc(lastErr) : '') + '</div>';
    } catch (e) { out.innerHTML = '<div class="error" role="alert">Could not import: ' + App.esc(e.message) + '</div>'; }
    b.disabled = false; load();
  }
  async function load() { list = (await Api.call('getQuizzes', {})).data.quizzes; render(); }
  document.getElementById('new').onclick = function () { openForm(null); };
  document.getElementById('imp').onclick = importBank;
  await load();
};

/* ---------------- Student: list of tests ---------------- */
Pages.Student['student-tests'] = async function (ctx) {
  var list = (await Api.call('getQuizzes', {})).data.quizzes, q = '';
  ctx.view.innerHTML = '<div class="page-head"><div><h2>Online tests</h2><p>Your results appear in My Marks. MCQs are marked straight away; definition answers are marked by your teacher.</p></div></div>' +
    '<div class="filters"><input class="search" id="sq" type="search" placeholder="Search tests" aria-label="Search tests"></div><div id="tbl"></div>';
  function render() {
    var rows = list.filter(function (x) { return !q || x.Title.toLowerCase().indexOf(q) >= 0; });
    document.getElementById('tbl').innerHTML = App.table([{ label: 'Test', html: function (x) { return '<strong>' + App.esc(x.Title) + '</strong>'; } }, { label: 'Type', html: function (x) { return '<span class="badge info">' + App.esc(x.Kind) + '</span>'; } },
      { label: 'Questions', html: function (x) { return x.Questions; } }, { label: 'Time', html: function (x) { return Number(x.DurationMinutes) ? x.DurationMinutes + ' min' : 'No limit'; }, cls: 'nw' },
      { label: 'Taken', html: function (x) { return x.Attempts ? x.Attempts + (x.Best ? ' (best ' + App.esc(x.Best) + '%)' : '') : '-'; }, cls: 'nw' },
      { label: '', html: function (x) { return '<a class="btn sm" href="take-test.html?quiz=' + encodeURIComponent(x.QuizID) + '">' + (x.Attempts ? 'Take again' : 'Start') + '</a>'; } }], rows, list.length ? 'No tests match your search.' : 'No tests are available yet.');
  }
  document.getElementById('sq').oninput = function (e) { q = e.target.value.trim().toLowerCase(); render(); };
  render();
};

/* ---------------- Student: take a test ---------------- */
Pages.Student['take-test'] = async function (ctx) {
  var id = new URLSearchParams(location.search).get('quiz');
  if (!id) { ctx.view.innerHTML = '<div class="empty">Choose a test from <a href="student-tests.html">Online tests</a>.</div>'; return; }
  var a = (await Api.call('startAttempt', { quizId: id })).data, isM = a.kind === 'MCQ', warns = 0, done = false, lastWarn = 0, timer = null, endsAt = Date.parse(a.endsAt), timed = a.durationMinutes > 0;
  ctx.view.innerHTML = '<div class="page-head"><div><h2>' + App.esc(a.title) + '</h2><p>' + a.kind + ' test &middot; ' + a.questions.length + ' questions' + (timed ? ' &middot; ' + a.durationMinutes + ' minutes' : '') + '</p></div></div>' +
    '<div class="note"><strong>Rules:</strong> stay on this page. Leaving the page or switching windows gives a warning; after 3 warnings the test is submitted automatically. Copy and paste are blocked.</div>' +
    '<div class="timer" id="timer"' + (timed ? '' : ' hidden') + '>--:--</div><form id="tf" novalidate>' +
    a.questions.map(function (q, i) {
      return '<fieldset class="q"><legend><span class="qn">' + q.n + '.</span> ' + App.esc(q.text) + '</legend>' + (isM ? q.options.map(function (o, j) {
        return '<label class="opt"><input type="radio" name="q' + i + '" value="' + j + '"><span><b>' + 'ABCD'.charAt(j) + '.</b> ' + App.esc(o) + '</span></label>'; }).join('') : '<textarea name="q' + i + '" rows="5" maxlength="1500" aria-label="Your answer to question ' + q.n + '"></textarea>') + '</fieldset>';
    }).join('') + '<div class="error" id="fe" role="alert" hidden></div><button class="btn" type="submit">Submit test</button></form><div id="result"></div>';
  var form = document.getElementById('tf');
  function block(e) { e.preventDefault(); }
  function warn(why) {
    if (done || Date.now() - lastWarn < 1500) return; lastWarn = Date.now(); warns++;
    if (warns >= 3) { App.toast('Warning 3 of 3 - submitting your test now.', 'err'); finish(true); } else App.toast('Warning ' + warns + ' of 3: ' + why, 'err');
  }
  function onVis() { if (document.hidden) warn('do not leave the test page.'); }
  function onBlur() { warn('do not switch windows during the test.'); }
  function onLeave(e) { if (!done) { e.preventDefault(); e.returnValue = ''; } }
  ['copy', 'cut', 'paste', 'contextmenu'].forEach(function (n) { document.addEventListener(n, block); });
  document.addEventListener('visibilitychange', onVis); window.addEventListener('blur', onBlur); window.addEventListener('beforeunload', onLeave);
  function stop() { clearInterval(timer); ['copy', 'cut', 'paste', 'contextmenu'].forEach(function (n) { document.removeEventListener(n, block); }); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur); window.removeEventListener('beforeunload', onLeave); }
  if (timed) {
    var tick = function () { var s = Math.max(0, Math.round((endsAt - Date.now()) / 1000)), el = document.getElementById('timer'); el.textContent = ('0' + Math.floor(s / 60)).slice(-3) + ':' + ('0' + (s % 60)).slice(-2); el.classList.toggle('low', s < 60); if (s <= 0) { clearInterval(timer); finish(true); } };
    tick(); timer = setInterval(tick, 1000);
  }
  var busy = false;
  async function finish(auto) {
    if (done || busy) return; busy = true;
    var answers = a.questions.map(function (q, i) {
      if (isM) { var c = form.querySelector('input[name=q' + i + ']:checked'); return c ? Number(c.value) : -1; }
      return form.querySelector('textarea[name=q' + i + ']').value.trim();
    });
    var btn = form.querySelector('[type=submit]'), er = document.getElementById('fe'); er.hidden = true; App.setBusy(btn, true);
    try {
      var r = (await Api.call('submitAttempt', { attemptId: a.attemptId, answers: answers, warnings: warns, auto: auto ? 'yes' : 'no' })).data;
      done = true; stop(); form.remove(); document.getElementById('timer').hidden = true; show(r);
    } catch (err) { er.textContent = err.message + (err.code === 'EXPIRED' ? '' : ' Your answers are still here - press Submit again.'); er.hidden = false; App.setBusy(btn, false); if (err.code === 'EXPIRED') { done = true; stop(); } }
    busy = false;
  }
  function show(r) {
    var el = document.getElementById('result');
    if (!isM) { el.innerHTML = '<section class="panel"><h3>Answers submitted</h3><p>Your teacher will read your answers and add your marks. You will be notified, and the result will appear in <a href="student-marks.html">My Marks</a>.</p></section>'; return; }
    el.innerHTML = '<section class="panel"><h3>Your score</h3><div class="stat g0 result-stat"><b>' + r.score + ' / ' + r.total + '</b><span>' + r.percentage + '%</span></div><p><a href="student-marks.html">See all my marks</a> &middot; <a href="student-tests.html">Back to tests</a></p></section>' +
      (r.review ? '<h3>Review</h3>' + r.review.map(function (q, i) {
        return '<fieldset class="q"><legend><span class="qn">' + (i + 1) + '.</span> ' + App.esc(q.q) + '</legend>' + q.options.map(function (o, j) {
          return '<div class="opt ' + (j === q.correct ? 'ok' : (j === q.chosen ? 'bad' : '')) + '"><span><b>' + 'ABCD'.charAt(j) + '.</b> ' + App.esc(o) + (j === q.correct ? ' (correct)' : (j === q.chosen ? ' (your answer)' : '')) + '</span></div>'; }).join('') + (q.chosen < 0 ? '<p class="hint">You did not answer this question.</p>' : '') + '</fieldset>'; }).join('') : '');
    window.scrollTo(0, 0);
  }
  form.onsubmit = function (e) { e.preventDefault(); App.confirm({ title: 'Submit test', message: 'Submit your answers now? You cannot change them afterwards.', confirmText: 'Submit' }).then(function (r) { if (r) finish(false); }); };
};
