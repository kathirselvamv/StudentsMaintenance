/* app.js - shared UI helpers. ALWAYS escape user data with App.esc before putting it into HTML. */
var App = (function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg, type) {
    var box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    var t = document.createElement('div'); t.className = 'toast ' + (type || 'info'); t.textContent = msg; box.appendChild(t);
    setTimeout(function () { t.remove(); }, 4500);
  }
  function setBusy(btn, busy) {
    if (!btn) return;
    if (busy) { btn.dataset.label = btn.textContent; btn.textContent = 'Please wait...'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }
  function wirePasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = document.getElementById(b.dataset.togglePassword), show = input.type === 'password';
        input.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show';
        b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }
  function fmtDate(s) {
    if (!s) return '-';
    var d = new Date(String(s).length <= 10 ? s + 'T00:00:00' : s);
    return isNaN(d) ? esc(s) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtDateTime(s) {
    var d = new Date(s); if (!s || isNaN(d)) return '-';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  var BADGE = { Active: 'ok', Completed: 'info', Inactive: 'muted', Pending: 'warn', 'Pending Review': 'warn', Approved: 'ok', Rejected: 'bad', Overdue: 'bad',
    Assigned: 'info', 'In Progress': 'warn', Submitted: 'violet', Reviewed: 'violet', Resolved: 'ok', Emergency: 'emerg', Normal: 'muted', Online: 'info', Offline: 'muted' };
  function badge(s) { return '<span class="badge ' + (BADGE[s] || 'muted') + '">' + esc(s) + '</span>'; }
  /** cols: [{label, html:function(row)->trusted html string (use esc!), cls}] */
  function table(cols, rows, emptyMsg) {
    if (!rows.length) return '<div class="empty">' + esc(emptyMsg || 'Nothing to show yet.') + '</div>';
    return '<div class="tbl-wrap"><table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td' + (c.cls ? ' class="' + c.cls + '"' : '') + '>' + c.html(r) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function dialog(title, body, opts) {
    opts = opts || {};
    var d = document.createElement('dialog'); d.className = 'dlg' + (opts.wide ? ' wide' : '');
    d.innerHTML = '<div class="dlg-head"><h3>' + esc(title) + '</h3><button type="button" class="x" data-close aria-label="Close">&times;</button></div><div class="dlg-body">' + body + '</div>';
    document.body.appendChild(d);
    function close() { if (d.open) d.close(); else d.remove(); }
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-close]')) close(); });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
    return { el: d, close: close };
  }
  /** Resolves {value} when confirmed, or null when cancelled. */
  function confirmDialog(o) {
    return new Promise(function (resolve) {
      var h = '<p>' + esc(o.message || '') + '</p>' + (o.inputLabel ? '<div class="field"><label for="cf-in">' + esc(o.inputLabel) + '</label><textarea id="cf-in" rows="3" maxlength="500"></textarea><div class="error" id="cf-err" hidden></div></div>' : '') +
        '<div class="dlg-actions"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn ' + (o.danger ? 'danger' : '') + '" id="cf-ok" type="button">' + esc(o.confirmText || 'Confirm') + '</button></div>';
      var dlg = dialog(o.title, h), done = false;
      dlg.el.querySelector('#cf-ok').onclick = function () {
        var v = '';
        if (o.inputLabel) {
          v = dlg.el.querySelector('#cf-in').value.trim();
          if (o.inputRequired && !v) { var er = dlg.el.querySelector('#cf-err'); er.textContent = o.inputLabel + ' is required.'; er.hidden = false; return; }
        }
        done = true; dlg.close(); resolve({ value: v });
      };
      dlg.el.addEventListener('close', function () { if (!done) resolve(null); });
    });
  }
  function csv(filename, cols, rows) {
    function cell(v) { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; } // blocks spreadsheet formula injection
    var lines = [cols.map(function (c) { return cell(c.label); }).join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return cell(r[c.key]); }).join(','); }));
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = filename; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function formData(form) { var o = {}; new FormData(form).forEach(function (v, k) { o[k] = v; }); return o; }
  function kv(pairs) { return '<dl class="kv">' + pairs.map(function (p) { return '<div><dt>' + esc(p[0]) + '</dt><dd>' + (p[2] ? p[1] : esc(p[1] || '-')) + '</dd></div>'; }).join('') + '</dl>'; }
  function opts(list, sel, blank) { return (blank != null ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); }
  /** Runs an API action, shows success/error toasts. Returns response or null on error. */
  async function act(action, payload, okMsg) {
    try { var r = await Api.call(action, payload); App.toast(okMsg || r.message, 'ok'); return r; }
    catch (e) { App.toast(e.message, 'err'); return null; }
  }
  document.addEventListener('DOMContentLoaded', wirePasswordToggles);
  return { esc: esc, toast: toast, setBusy: setBusy, fmtDate: fmtDate, fmtDateTime: fmtDateTime, today: today, badge: badge, table: table, dialog: dialog,
    confirm: confirmDialog, csv: csv, formData: formData, kv: kv, opts: opts, act: act };
})();
var Pages = { Teacher: {}, Student: {} };
