/* app.js - small shared UI helpers */
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
  document.addEventListener('DOMContentLoaded', wirePasswordToggles);
  return { esc: esc, toast: toast, setBusy: setBusy };
})();
