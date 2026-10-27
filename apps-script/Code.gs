/**
 * Code.gs - web entry points and the request router.
 * Only actions listed in ROUTES can be called. Everything else is unreachable from the web.
 * Add later-phase handlers to ROUTES with the roles allowed to call them.
 */
var ROUTES = {
  login:                 { fn: login,                 auth: false },
  completePasswordSetup: { fn: completePasswordSetup, auth: false },
  getMe:                 { fn: getMe,                 roles: ['Teacher', 'Student'] },
  logout:                { fn: logout,                roles: ['Teacher', 'Student'] },
  changePassword:        { fn: changePassword,        roles: ['Teacher', 'Student'] },
  resetPassword:         { fn: resetPassword,         roles: ['Teacher'] }
};

function doGet() { return jsonOut({ success: true, message: 'API is running.', data: {} }); }

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > CFG.MAX_BODY) throw new AppError('BAD_REQUEST', 'Invalid request.');
    var req; try { req = JSON.parse(raw); } catch (x) { throw new AppError('BAD_REQUEST', 'Invalid request.'); }
    var route = Object.prototype.hasOwnProperty.call(ROUTES, req.action) ? ROUTES[req.action] : null;
    if (!route) throw new AppError('BAD_REQUEST', 'Unknown action.');
    var payload = (req.payload && typeof req.payload === 'object') ? req.payload : {};
    var session = null;
    if (route.auth !== false) {
      session = validateSession(req.token);
      if (route.roles.indexOf(session.role) < 0) throw new AppError('FORBIDDEN', 'You do not have access to this action.');
    }
    var data = route.fn(payload, session, req.token);
    return jsonOut({ success: true, message: (data && data._message) || 'OK', data: stripMeta(data) });
  } catch (err) {
    if (err instanceof AppError) return jsonOut({ success: false, code: err.code, message: err.message });
    console.error(err && err.stack ? err.stack : err);
    return jsonOut({ success: false, code: 'SERVER_ERROR', message: 'Unexpected server error. Please try again.' });
  }
}

function stripMeta(d) { if (d && d._message) { var c = {}; for (var k in d) if (k !== '_message') c[k] = d[k]; return c; } return d || {}; }
function jsonOut(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
