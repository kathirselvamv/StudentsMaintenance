/** Utilities.gs - shared helpers. No handler here is exposed to the web. */

var SHEETS = {
  Teachers: ['TeacherID','Name','Email','Role','Status','CreatedAt','UpdatedAt'],
  Students: ['StudentID','TeacherID','Name','Email','Phone','Course','BatchTiming','BatchType','BatchName','EnrollmentDate','Status','Username','CreatedAt','UpdatedAt'],
  StudentPractice: ['PracticeID','StudentID','TeacherID','Topic','Description','AssignedDate','DueDate','ExpectedDuration','Status','CompletionDate','Feedback','CreatedAt','UpdatedAt'],
  LeaveRequests: ['RequestID','StudentID','TeacherID','LeaveType','Reason','StartDate','EndDate','Duration','Status','RequestedAt','ReviewedBy','ReviewedAt','TeacherRemarks','SyncStatus'],
  ApprovedLeaves: ['ApprovalID','RequestID','StudentID','TeacherID','LeaveType','StartDate','EndDate','Duration','ApprovedBy','ApprovedAt'],
  LeaveIncidents: ['IncidentID','StudentID','TeacherID','IncidentType','AbsenceDate','NotificationDate','Reason','TeacherRemarks','Status','CreatedAt','UpdatedAt'],
  Notifications: ['NotificationID','RecipientID','RecipientRole','Title','Message','RelatedRecordID','IsRead','CreatedAt'],
  AuditLogs: ['AuditID','ActorID','ActorRole','Action','EntityType','EntityID','Timestamp','Result'],
  Credentials: ['UserID','Role','Salt','PasswordHash','Iterations','MustChangePassword','SetupCodeHash','SetupCodeExpiry','UpdatedAt'],
  Sessions: ['SessionHash','UserID','Role','TeacherID','CreatedAt','ExpiresAt','Revoked']
};

var CFG = {
  SESSION_HOURS: 8,
  HASH_ITERATIONS: 2000,   // Apps Script has no bcrypt/Argon2; iterated salted SHA-256 + secret pepper
  MAX_FAILS: 5,
  LOCK_MINUTES: 15,
  SETUP_CODE_HOURS: 48,
  MAX_BODY: 100000
};

function AppError(code, message) { this.code = code; this.message = message; }

/* ---------- Spreadsheet access ---------- */
function getSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new AppError('CONFIG', 'Application is not initialised.');
  return SpreadsheetApp.openById(id);
}
function getSheet(name) {
  var sh = getSpreadsheet().getSheetByName(name);
  if (!sh) throw new AppError('CONFIG', 'Missing sheet: ' + name);
  return sh;
}
function readAll(name) {
  var sh = getSheet(name), h = SHEETS[name], last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, h.length).getValues().map(function (r, i) {
    var o = { _row: i + 2 };
    h.forEach(function (k, j) { o[k] = (r[j] === null || r[j] === undefined) ? '' : String(r[j]); });
    return o;
  });
}
function findRecordById(name, idCol, id) {
  if (!id) return null;
  var rows = readAll(name);
  for (var i = 0; i < rows.length; i++) if (rows[i][idCol] === String(id)) return rows[i];
  return null;
}
function appendRecord(name, obj) {
  var row = SHEETS[name].map(function (k) { return obj[k] === undefined ? '' : obj[k]; });
  getSheet(name).appendRow(row);
}
function updateRecord(name, rowNum, changes) {
  var h = SHEETS[name], range = getSheet(name).getRange(rowNum, 1, 1, h.length);
  var vals = range.getValues()[0];
  h.forEach(function (k, j) { if (changes.hasOwnProperty(k)) vals[j] = changes[k]; });
  range.setValues([vals]);
}

/* ---------- Locking ---------- */
function withLock(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { throw new AppError('BUSY', 'The system is busy. Please try again.'); }
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ---------- IDs, time, crypto ---------- */
function nowIso() { return new Date().toISOString(); }
function generateUniqueId(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), 'UTC', 'yyMMdd') + '-' + Utilities.getUuid().replace(/-/g, '').substring(0, 8).toUpperCase();
}
function sha256Hex(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function getPepper() {
  var p = PropertiesService.getScriptProperties().getProperty('PEPPER');
  if (!p) throw new AppError('CONFIG', 'Application is not initialised.');
  return p;
}
function hashPassword(password, salt, iterations) {
  var pepper = getPepper(), h = sha256Hex(salt + ':' + pepper + ':' + password);
  for (var i = 0; i < iterations; i++) h = sha256Hex(h + salt + password);
  return h;
}
function hashSetupCode(code, salt) { return sha256Hex(salt + ':' + getPepper() + ':setup:' + String(code).toUpperCase()); }
function randomToken() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }
/** 32-character alphabet => no modulo bias when mapping random bytes. */
function randomSetupCode() {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', hex = Utilities.getUuid().replace(/-/g, ''), out = '';
  for (var i = 0; i < 8; i++) out += alphabet.charAt(parseInt(hex.substr(i * 2, 2), 16) % 32);
  return out;
}
function safeEquals(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var r = 0; for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ---------- Rate limiting (CacheService) ---------- */
function assertNotLocked(key) {
  var n = Number(CacheService.getScriptCache().get('rl:' + sha256Hex(key).substring(0, 32)) || 0);
  if (n >= CFG.MAX_FAILS) throw new AppError('RATE_LIMIT', 'Too many failed attempts. Try again in ' + CFG.LOCK_MINUTES + ' minutes.');
}
function recordFail(key) {
  var c = CacheService.getScriptCache(), k = 'rl:' + sha256Hex(key).substring(0, 32);
  c.put(k, String(Number(c.get(k) || 0) + 1), CFG.LOCK_MINUTES * 60);
}
function clearFails(key) { CacheService.getScriptCache().remove('rl:' + sha256Hex(key).substring(0, 32)); }

/* ---------- Validation ---------- */
function validateInput(obj, rules) {
  obj = obj || {}; var out = {};
  Object.keys(rules).forEach(function (k) {
    var r = rules[k], v = obj[k], label = r.label || k;
    if (v === undefined || v === null) v = '';
    if (typeof v !== 'string' && typeof v !== 'number') throw new AppError('VALIDATION', 'Invalid value for ' + label + '.');
    v = String(v); if (r.trim !== false) v = v.trim();
    if (!v) { if (r.required) throw new AppError('VALIDATION', label + ' is required.'); out[k] = ''; return; }
    if (v.length > (r.max || 500)) throw new AppError('VALIDATION', label + ' is too long.');
    if (r.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new AppError('VALIDATION', 'Enter a valid email address.');
    if (r.type === 'phone' && !/^\+?[0-9]{10,15}$/.test(v.replace(/[\s-]/g, ''))) throw new AppError('VALIDATION', 'Enter a valid phone number.');
    if (r.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v)))) throw new AppError('VALIDATION', label + ' must be a valid date.');
    if (r.oneOf && r.oneOf.indexOf(v) < 0) throw new AppError('VALIDATION', 'Invalid ' + label + '.');
    out[k] = v;
  });
  return out;
}
function assertStrongPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8 || pw.length > 128 || !/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw))
    throw new AppError('VALIDATION', 'Password must be 8-128 characters and include a letter and a number.');
}

/* ---------- Authorization helpers ---------- */
function verifyTeacherOwnership(session, record) {
  if (!session || session.role !== 'Teacher' || !record || String(record.TeacherID) !== session.teacherId)
    throw new AppError('FORBIDDEN', 'You do not have access to this record.');
}
function verifyStudentOwnership(session, studentId) {
  if (!session || session.role !== 'Student' || session.userId !== String(studentId))
    throw new AppError('FORBIDDEN', 'You do not have access to this record.');
}
/** Teacher -> student must belong to them; Student -> only themselves. Returns the Students row. */
function getAuthorizedStudent(session, studentId) {
  var s = findRecordById('Students', 'StudentID', studentId);
  if (!s) throw new AppError('NOT_FOUND', 'Student not found.');
  if (session.role === 'Teacher') verifyTeacherOwnership(session, s); else verifyStudentOwnership(session, studentId);
  return s;
}

function appendAuditLog(actorId, role, action, entityType, entityId, result) {
  try {
    appendRecord('AuditLogs', { AuditID: generateUniqueId('AUD'), ActorID: actorId || '', ActorRole: role || '',
      Action: action, EntityType: entityType || '', EntityID: entityId || '', Timestamp: nowIso(), Result: result });
  } catch (e) { console.error('audit failed', e); }
}
