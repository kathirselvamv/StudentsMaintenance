/* api.js - the only place that talks to Google Apps Script.
 * Sends JSON as text/plain so the browser makes a "simple" request (no CORS preflight, which Apps Script cannot answer).
 * The server validates the JSON itself and checks the session token on every protected action. */
var Api = (function () {
  var TOKEN = 'tsms_token', USER = 'tsms_user', TIMEOUT_MS = 30000;

  function ApiError(code, message) { this.name = 'ApiError'; this.code = code; this.message = message; }
  ApiError.prototype = Object.create(Error.prototype);

  function endpoint() {
    var u = window.APP_CONFIG && window.APP_CONFIG.API_URL;
    if (!u || u.indexOf('PASTE_') === 0) throw new ApiError('CONFIG', 'The server address is not configured. Edit config.js.');
    return u;
  }
  function getToken() { try { return sessionStorage.getItem(TOKEN) || ''; } catch (e) { return ''; } }
  function getUser() { try { return JSON.parse(sessionStorage.getItem(USER) || 'null'); } catch (e) { return null; } }
  function saveSession(token, user) { sessionStorage.setItem(TOKEN, token); sessionStorage.setItem(USER, JSON.stringify(user)); }
  function clearSession() { sessionStorage.removeItem(TOKEN); sessionStorage.removeItem(USER); }

  async function call(action, payload, opts) {
    opts = opts || {};
    var ctrl = new AbortController(), timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS), res, json;
    try {
      res = await fetch(endpoint(), {
        method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: action, token: opts.auth === false ? undefined : getToken(), payload: payload || {} })
      });
      json = await res.json();
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError('NETWORK', e.name === 'AbortError' ? 'The server took too long to respond. Please try again.' : 'Cannot reach the server. Check your connection and try again.');
    } finally { clearTimeout(timer); }
    if (!json || json.success !== true) {
      var code = (json && json.code) || 'SERVER_ERROR';
      if (code === 'SESSION_EXPIRED' && opts.auth !== false) { clearSession(); location.replace('index.html?expired=1'); }
      throw new ApiError(code, (json && json.message) || 'Request failed.');
    }
    return json; // { success, message, data }
  }
  return { call: call, getToken: getToken, getUser: getUser, saveSession: saveSession, clearSession: clearSession, ApiError: ApiError };
})();
