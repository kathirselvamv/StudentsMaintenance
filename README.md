# Institute Desk - Phase 1 & 2 (design system, login, authentication)

Included: home page, teacher/student login, first-time password setup, session-protected placeholder dashboards, and the Apps Script backend core (router, sessions, hashing, rate limiting, ownership helpers, Sheets setup).
Not built yet: students, practice, leave, reports, notifications (Phases 3-7).

## 1. Backend setup (Google)
1. Create a Google Spreadsheet. Open **Extensions > Apps Script**.
2. Add three script files and paste in `apps-script/Utilities.gs`, `Authentication.gs`, `Code.gs`.
3. Select `initializeApplication` and click **Run** (authorize when asked). It creates all 10 sheets, hides `Credentials` and `Sessions`, creates a secret pepper in Script Properties, and adds the two teacher rows.
4. Run `issueTeacherSetupCodes`. Open **Execution log**: it prints one setup code per teacher. Give each teacher their own code privately.
5. Optional: run `installMaintenanceTrigger` once (daily cleanup of old sessions).
6. **Deploy > New deployment > Web app**: Execute as **Me**, Who has access **Anyone**. Copy the URL ending in `/exec`.
   - Trade-off: the endpoint is publicly reachable. Security rests entirely on the server-side session, role and ownership checks. Only actions in `ROUTES` (Code.gs) can be called.
   - After every backend code change: **Deploy > Manage deployments > Edit > New version**.

## 2. Frontend setup
1. Put the Web App URL in `config.js`.
2. Push this folder (everything except `apps-script/`, which is optional to keep) to GitHub, import it in Vercel as a static project (no build command). `vercel.json` adds security headers and a CSP.
3. Each teacher opens `set-password.html?role=Teacher`, enters their email, the setup code, and chooses their own password.

## 3. How requests work
`fetch(API_URL, {method:'POST', headers:{'Content-Type':'text/plain'}, body: JSON.stringify({action, token, payload})})`.
`text/plain` avoids a CORS preflight that Apps Script cannot answer; the server parses and validates the JSON itself. **You must verify this on your deployed URL** (browser DevTools > Network).

## 4. Security notes (be aware of the limits)
- Passwords: salted, iterated SHA-256 plus a secret pepper held in Script Properties. Apps Script has no bcrypt/Argon2, so this is weaker than those. Use long passwords.
- Sessions: random 256-bit token; only its hash is stored; 8-hour expiry; revoked on logout/password change.
- The token is kept in `sessionStorage` (cleared when the tab closes). Any XSS bug could read it, so all user text must be escaped with `App.esc` when rendered (future pages must follow this).
- 5 failed logins per account locks it for 15 minutes (CacheService).
- The "account has not been created yet" message (required by the brief) lets someone test whether a student email exists. Accepted trade-off.
- Students with status Completed can still log in to see history; Inactive cannot.
- Teacher identity always comes from the session; the frontend never sends a TeacherID.

## 5. Tests
Backend logic was tested with a mocked Google services harness (25 checks: setup codes, hashing, sessions, forged/missing tokens, route whitelist, ownership, lockout). It has **not** been tested against a real spreadsheet, real Apps Script deployment, or Vercel; do that with the checklist in section 24 of your brief.
