/** Authentication.gs - setup, login, sessions, password setup/reset. */

var TEACHERS_SEED = [
  { id: 'T001', name: 'Kathirselvam V', email: 'kathirselvamv82@gmail.com' },
  { id: 'T002', name: 'Esakkipandi',    email: 'esakkipandi.dev@gmail.com' }
];

/* ================= SETUP (run manually from the Apps Script editor) ================= */

/** Run once. Safe to run again. Creates sheets/headers, a secret pepper, and the two teacher rows. */
function initializeApplication() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SPREADSHEET_ID')) {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (!active) throw new Error('Open the script from inside your spreadsheet (Extensions > Apps Script), or set Script Property SPREADSHEET_ID.');
    props.setProperty('SPREADSHEET_ID', active.getId());
  }
  if (!props.getProperty('PEPPER')) props.setProperty('PEPPER', randomToken());

  var ss = getSpreadsheet();
  Object.keys(SHEETS).forEach(function (name) {
    var headers = SHEETS[name], sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@'); // plain text: no auto date/number/formula conversion
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#172554').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    if (name === 'Credentials' || name === 'Sessions') sh.hideSheet();
  });
  var def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);

  withLock(function () {
    TEACHERS_SEED.forEach(function (t) {
      if (!findRecordById('Teachers', 'TeacherID', t.id)) {
        appendRecord('Teachers', { TeacherID: t.id, Name: t.name, Email: t.email, Role: 'Teacher', Status: 'Active', CreatedAt: nowIso(), UpdatedAt: nowIso() });
      }
    });
  });
  Logger.log('Initialised. Next: run issueTeacherSetupCodes().');
}

/**
 * Run from the editor. Generates a one-time setup code for each teacher whose password is not set yet
 * and prints it in the Execution log. Each teacher then opens set-password.html and chooses their own password.
 * No password is ever written in code, the sheet, or chat. Run again to re-issue a code (forgot password).
 * Pass an email to re-issue for one teacher only, e.g. issueTeacherSetupCodes('esakkipandi.dev@gmail.com').
 */
function issueTeacherSetupCodes(onlyEmail) {
  withLock(function () {
    readAll('Teachers').forEach(function (t) {
      if (t.Status !== 'Active') return;
      if (onlyEmail && t.Email.toLowerCase() !== String(onlyEmail).toLowerCase()) return;
      var cred = findRecordById('Credentials', 'UserID', t.TeacherID);
      if (!onlyEmail && cred && cred.PasswordHash) return;
      var code = issueSetupCode(t.TeacherID, 'Teacher');
      Logger.log(t.Name + ' <' + t.Email + '>  setup code: ' + code + '  (valid ' + CFG.SETUP_CODE_HOURS + 'h)');
    });
  });
}

/** Optional: run once to purge expired sessions daily. */
function installMaintenanceTrigger() {
  ScriptApp.newTrigger('purgeExpiredSessions').timeBased().everyDays(1).atHour(3).create();
}
function purgeExpiredSessions() {
  withLock(function () {
    var sh = getSheet('Sessions'), rows = readAll('Sessions'), cutoff = Date.now() - 24 * 3600 * 1000;
    for (var i = rows.length - 1; i >= 0; i--) if (Date.parse(rows[i].ExpiresAt) < cutoff) sh.deleteRow(rows[i]._row);
  });
}

/* ================= INTERNAL HELPERS ================= */

function findUser(role, identifier) {
  var id = String(identifier).toLowerCase();
  if (role === 'Teacher') {
    var t = readAll('Teachers').filter(function (r) { return r.Email.toLowerCase() === id; })[0];
    return t ? { id: t.TeacherID, name: t.Name, email: t.Email, status: t.Status, teacherId: t.TeacherID, role: 'Teacher' } : null;
  }
  var s = readAll('Students').filter(function (r) { return r.Email.toLowerCase() === id || (r.Username && r.Username.toLowerCase() === id); })[0];
  return s ? { id: s.StudentID, name: s.Name, email: s.Email, status: s.Status, teacherId: s.TeacherID, role: 'Student' } : null;
}
function userCanLogin(user) { return user.role === 'Teacher' ? user.status === 'Active' : user.status !== 'Inactive'; }

/** Caller must hold the script lock. */
function upsertCredential(userId, role, changes) {
  var cred = findRecordById('Credentials', 'UserID', userId);
  changes.UpdatedAt = nowIso();
  if (cred) { updateRecord('Credentials', cred._row, changes); return; }
  var base = { UserID: userId, Role: role, Salt: randomToken(), PasswordHash: '', Iterations: CFG.HASH_ITERATIONS, MustChangePassword: 'TRUE', SetupCodeHash: '', SetupCodeExpiry: '' };
  for (var k in changes) base[k] = changes[k];
  appendRecord('Credentials', base);
}
/** Caller must hold the script lock. Returns the plaintext code (shown once to the issuer). */
function issueSetupCode(userId, role) {
  var cred = findRecordById('Credentials', 'UserID', userId), salt = cred && cred.Salt ? cred.Salt : randomToken(), code = randomSetupCode();
  upsertCredential(userId, role, { Salt: salt, SetupCodeHash: hashSetupCode(code, salt), SetupCodeExpiry: new Date(Date.now() + CFG.SETUP_CODE_HOURS * 3600 * 1000).toISOString() });
  return code;
}
function setPassword(userId, role, password) {
  var salt = randomToken();
  upsertCredential(userId, role, { Salt: salt, PasswordHash: hashPassword(password, salt, CFG.HASH_ITERATIONS), Iterations: CFG.HASH_ITERATIONS, MustChangePassword: 'FALSE', SetupCodeHash: '', SetupCodeExpiry: '' });
}
function revokeUserSessions(userId, exceptHash) {
  var sh = getSheet('Sessions'), col = SHEETS.Sessions.indexOf('Revoked') + 1;
  readAll('Sessions').forEach(function (s) {
    if (s.UserID === userId && s.Revoked !== 'TRUE' && s.SessionHash !== exceptHash) sh.getRange(s._row, col).setValue('TRUE');
  });
}
function createSession(user) {
  var token = randomToken(), exp = new Date(Date.now() + CFG.SESSION_HOURS * 3600 * 1000).toISOString();
  appendRecord('Sessions', { SessionHash: sha256Hex(token), UserID: user.id, Role: user.role, TeacherID: user.teacherId, CreatedAt: nowIso(), ExpiresAt: exp, Revoked: 'FALSE' });
  return { token: token, expiresAt: exp };
}
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role }; }

/* ================= SESSION VALIDATION (called by the router) ================= */

function getCurrentSession(token) { return validateSession(token); }

function validateSession(token) {
  var expired = new AppError('SESSION_EXPIRED', 'Your session has expired. Please log in again.');
  if (typeof token !== 'string' || token.length < 64 || token.length > 100) throw expired;
  var rec = findRecordById('Sessions', 'SessionHash', sha256Hex(token));
  if (!rec || rec.Revoked === 'TRUE' || !(Date.parse(rec.ExpiresAt) > Date.now())) throw expired;
  var user = rec.Role === 'Teacher'
    ? (function () { var t = findRecordById('Teachers', 'TeacherID', rec.UserID); return t && { id: t.TeacherID, name: t.Name, email: t.Email, status: t.Status, teacherId: t.TeacherID, role: 'Teacher' }; })()
    : (function () { var s = findRecordById('Students', 'StudentID', rec.UserID); return s && { id: s.StudentID, name: s.Name, email: s.Email, status: s.Status, teacherId: s.TeacherID, role: 'Student' }; })();
  if (!user || !userCanLogin(user)) throw expired;
  return { userId: user.id, role: user.role, teacherId: user.teacherId, name: user.name, email: user.email, sessionHash: rec.SessionHash };
}

/* ================= ROUTED HANDLERS ================= */

function login(p) {
  var v = validateInput(p, {
    role: { required: true, oneOf: ['Teacher', 'Student'] },
    identifier: { required: true, max: 200, label: 'Email or username' },
    password: { required: true, max: 200, trim: false, label: 'Password' }
  });
  var key = 'login:' + v.role + ':' + v.identifier.toLowerCase();
  assertNotLocked(key);
  var user = findUser(v.role, v.identifier);
  if (!user) {
    recordFail(key);
    appendAuditLog('', v.role, 'LOGIN', 'User', '', 'FAIL:unknown');
    if (v.role === 'Student') throw new AppError('NO_ACCOUNT', 'Your account has not been created yet. Please contact your teacher.');
    throw new AppError('INVALID_CREDENTIALS', 'Incorrect email or password.');
  }
  if (!userCanLogin(user)) { appendAuditLog(user.id, v.role, 'LOGIN', 'User', user.id, 'FAIL:inactive'); throw new AppError('INACTIVE', 'This account is inactive. Please contact your teacher.'); }
  var cred = findRecordById('Credentials', 'UserID', user.id);
  if (!cred || !cred.PasswordHash) throw new AppError('NO_PASSWORD', 'Your password is not set yet. Use "Forgot password / first-time setup" with the code from your ' + (v.role === 'Teacher' ? 'administrator.' : 'teacher.'));
  var ok = safeEquals(hashPassword(v.password, cred.Salt, Number(cred.Iterations) || CFG.HASH_ITERATIONS), cred.PasswordHash);
  if (!ok) { recordFail(key); appendAuditLog(user.id, v.role, 'LOGIN', 'User', user.id, 'FAIL:password'); throw new AppError('INVALID_CREDENTIALS', 'Incorrect email or password.'); }
  clearFails(key);
  var s = withLock(function () { return createSession(user); });
  appendAuditLog(user.id, v.role, 'LOGIN', 'User', user.id, 'OK');
  return { token: s.token, expiresAt: s.expiresAt, user: publicUser(user), _message: 'Login successful' };
}

function getMe(p, session) {
  var out = { id: session.userId, name: session.name, email: session.email, role: session.role };
  if (session.role === 'Student') { var t = findRecordById('Teachers', 'TeacherID', session.teacherId); out.teacherName = t ? t.Name : ''; }
  return { user: out };
}

function logout(p, session, token) {
  withLock(function () {
    var rec = findRecordById('Sessions', 'SessionHash', sha256Hex(token));
    if (rec) updateRecord('Sessions', rec._row, { Revoked: 'TRUE' });
  });
  appendAuditLog(session.userId, session.role, 'LOGOUT', 'User', session.userId, 'OK');
  return { _message: 'Logged out' };
}

/** First-time password setup / forgot password, using a one-time code issued by an admin (teachers) or teacher (students). */
function completePasswordSetup(p) {
  var v = validateInput(p, {
    role: { required: true, oneOf: ['Teacher', 'Student'] },
    identifier: { required: true, max: 200, label: 'Email or username' },
    setupCode: { required: true, max: 20, label: 'Setup code' },
    newPassword: { required: true, max: 128, trim: false, label: 'New password' }
  });
  var key = 'setup:' + v.role + ':' + v.identifier.toLowerCase();
  assertNotLocked(key);
  var bad = new AppError('INVALID_CODE', 'The email/username or setup code is not valid, or the code has expired.');
  var user = findUser(v.role, v.identifier);
  if (!user || !userCanLogin(user)) { recordFail(key); throw bad; }
  assertStrongPassword(v.newPassword);
  withLock(function () {
    var cred = findRecordById('Credentials', 'UserID', user.id);
    if (!cred || !cred.SetupCodeHash || !(Date.parse(cred.SetupCodeExpiry) > Date.now()) || !safeEquals(hashSetupCode(v.setupCode, cred.Salt), cred.SetupCodeHash)) {
      recordFail(key); throw bad;
    }
    setPassword(user.id, v.role, v.newPassword);
    revokeUserSessions(user.id, '');
  });
  clearFails(key);
  appendAuditLog(user.id, v.role, 'PASSWORD_SETUP', 'User', user.id, 'OK');
  return { _message: 'Password saved. You can now log in.' };
}

function changePassword(p, session) {
  var v = validateInput(p, {
    currentPassword: { required: true, max: 128, trim: false, label: 'Current password' },
    newPassword: { required: true, max: 128, trim: false, label: 'New password' }
  });
  var key = 'chg:' + session.userId; assertNotLocked(key);
  var cred = findRecordById('Credentials', 'UserID', session.userId);
  if (!cred || !safeEquals(hashPassword(v.currentPassword, cred.Salt, Number(cred.Iterations) || CFG.HASH_ITERATIONS), cred.PasswordHash)) {
    recordFail(key); throw new AppError('INVALID_CREDENTIALS', 'Current password is incorrect.');
  }
  assertStrongPassword(v.newPassword);
  withLock(function () { setPassword(session.userId, session.role, v.newPassword); revokeUserSessions(session.userId, session.sessionHash); });
  clearFails(key);
  appendAuditLog(session.userId, session.role, 'PASSWORD_CHANGE', 'User', session.userId, 'OK');
  return { _message: 'Password changed' };
}

/** Teacher issues a new one-time setup code for one of THEIR OWN students (first-time setup or forgotten password). */
function resetPassword(p, session) {
  var v = validateInput(p, { studentId: { required: true, max: 50, label: 'Student ID' } });
  var student = getAuthorizedStudent(session, v.studentId); // ownership verified server-side
  var code = withLock(function () { var c = issueSetupCode(student.StudentID, 'Student'); revokeUserSessions(student.StudentID, ''); return c; });
  appendAuditLog(session.userId, 'Teacher', 'PASSWORD_RESET_CODE', 'Student', student.StudentID, 'OK');
  return { studentName: student.Name, setupCode: code, validHours: CFG.SETUP_CODE_HOURS, _message: 'Setup code created' };
}
