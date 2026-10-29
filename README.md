# Institute Desk - Teacher-Student Management System

Frontend: HTML/CSS/vanilla JS on Vercel. Backend: Google Apps Script. Database: Google Sheets.

## Updating an existing deployment (you already did Phase 1-2)
1. In Apps Script, add new files and paste in: `StudentManagement`, `PracticeManagement`, `LeaveManagement`, `Reports`, `Notifications`. **Replace** the contents of `Utilities`, `Authentication` and `Code` with the new versions.
2. Run `initializeApplication` again. It is safe: it adds the new columns (Students.Notes, StudentPractice.SubmissionNotes/ActualDuration/SubmittedAt, LeaveRequests.AdditionalDetails, LeaveIncidents.SubmittedBy) and keeps existing data and passwords.
3. Project Settings (gear icon) > set the **time zone** to your local zone (e.g. Asia/Kolkata). Overdue dates and "today" use it.
4. Optional: run `installMaintenanceTrigger` once (daily session cleanup + deadline/pending-approval reminders).
5. **Deploy > Manage deployments > Edit > Version: New version > Deploy.** The URL stays the same. Without this step the website still talks to the old code.
6. Upload the whole frontend folder to GitHub (replace old files, keep your `config.js` with your real URL). Vercel redeploys automatically.

## Update 2: test marks and progress log
Add the new file `AcademicRecords.gs`, replace `Utilities`, `Code` and `Reports`, run `initializeApplication` (creates the `TestMarks` and `ProgressLog` sheets), then deploy a **New version**. Re-upload the whole frontend folder (new: `records.js`, `test-marks.html`, `progress-log.html`, `student-marks.html`, `student-progress.html`; other files gained small changes).
- Teacher > **Test Marks**: name the test, set date and maximum marks, type marks for students (blank = skipped), Save. Edit a mark later with Edit. Students are notified.
- Teacher > **Progress Log**: find the student by email/phone, set the period, **days practiced** (cannot exceed days in the period) and **topics covered**.
- Student > **My Marks** (average and best score) and **My Progress** (total days practiced, topics per period). Students only see their own.
- Both appear in Reports with CSV export. Marks cannot be deleted (history is kept); correct them with Edit.

## Using it
- Teacher: Create Student shows a one-time setup code. Give it to the student; they open `set-password.html`, enter email + code + new password. "New setup code" on the Students page handles forgotten passwords.
- Practice and Leave Incidents: type a student's email or phone, press Find, confirm the student, then fill the form. Name, course and batch come from the server.
- Leave: students submit (always Pending). Teachers approve/reject on Leave Approvals. Approved requests get exactly one row in `ApprovedLeaves`.
- Reports: choose a report, filters, Run, Export CSV (spreadsheet formula characters are neutralised).

## Design decisions
- Teacher identity comes only from the server session. Every record read/write checks the owning TeacherID; students can only touch their own rows.
- Approval is crash-safe: request -> Approved (SyncStatus PendingSync) -> ApprovedLeaves row -> Synced. If a step fails, the teacher sees "Retry sync" and approving again completes it without duplicates.
- Overdue is computed from the due date, never stored. Opening an assignment never changes its status.
- Online/Offline dashboard cards count Active students only.
- Students with status Completed can still log in; Inactive cannot (and are signed out immediately).
- Apps Script access must be "Anyone"; all protection is the server-side session/role/ownership checks.

## Not implemented (be aware)
- **Supporting document upload** for leave (optional in your brief): would need Google Drive access; not built.
- **Email notifications** (optional in your brief): in-app only.
- Passwords use salted, iterated SHA-256 with a secret pepper (Apps Script has no bcrypt/Argon2).
- Session token lives in `sessionStorage`; all displayed user text is escaped.

## What was tested
Automated checks with mocked Google services: 83 backend checks (ownership isolation, duplicate/overlap blocking, approval idempotency and repair, report scoping, session revocation) and 47 UI checks (every page renders for both roles; filters, search, create student, practice lookup, approve/reject/submit buttons) with no JavaScript errors.
**Not tested against your real spreadsheet/Apps Script/Vercel or on a phone.** Please run the checklist in section 24 of your brief after deploying.
