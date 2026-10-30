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

## Update 3 (optional): import OLD results from ficotestapp.vercel.app
Only needed if you want the results students already submitted on the old test website. New tests are taken inside Institute Desk (Update 4).
No change is needed on the test website. Institute Desk reads its results through the test site's existing Google Script.
1. Apps Script: replace `AcademicRecords`, `Utilities`, `Code`, `Reports` with the new versions, run `initializeApplication` (adds columns to TestMarks).
2. **Project Settings > Script Properties > Add property** (twice):
   - `TESTSITE_URL` = the `/exec` URL of the test site's Google Script (the `SCRIPT_URL` inside the test site's `index.html`).
   - `TESTSITE_PASSWORD` = that script's teacher password (the `PASSWORD` line in its Code.gs). Keep it only here; never paste it in chat or code.
3. In the editor run `testSiteConnectionCheck` once. Approve the new permission ("connect to an external service"). The log shows how many results were found.
4. **Deploy > Manage deployments > Edit > New version > Deploy**, then re-upload the frontend files.
5. Optional: run `installTestSiteSyncTrigger` to auto-import every 30 minutes. Otherwise press **Sync from test website** on the Test Marks page.
- **MCQ** results are added automatically (marks out of total). **Definition** answers appear under "Waiting for your marks": read them, enter marks and the maximum, Save. The student sees them only after you do.
- **Practice test** and **Oral/Viva** marks: Enter marks section, pick the category, marks only.
- Matching: by the email the student types on the test site (phone is the fallback), and only to the teacher's own students. Students must use the same email as their account here. Retakes appear as separate results.
- Security: the test website has no student login, so anyone can type another student's email. Check unusual marks. If the test site script still has `PASSWORD = "change-this-password"`, change it now: anyone who guesses it can read every result.

## Update 4: online tests inside Institute Desk (like ficotestapp)
1. Apps Script: add the new file `TestEngine.gs`; replace `Utilities`, `Code`, `AcademicRecords`, `Reports`. Run `initializeApplication` (creates `Quizzes`, `QuizQuestions`, `QuizAttempts`). Deploy a **New version**.
2. Re-upload the whole frontend folder, including the new `tests.js`, the new pages and **`fico-bank.json`** (your 24 FICO tests).
3. Teacher > **Online Tests** > **Import FICO question bank**. It creates First Half, Second Half, Full Test and Topic 2-22, each as an MCQ test and a Definition test (540 MCQs, 310 definition questions, 107 model answers), published, no time limit. Takes 1-2 minutes. Running it again skips tests that already exist. Use **New test** to add your own: paste one question per line (the format is shown in the form).
4. Students: **Online Tests** > Start. MCQs are scored on the server and saved to Test Marks at once. Definition answers go to Test Marks > **Waiting for your marks**, where you read the answer, see the model answer (if any), enter marks and "out of" and save; then the student sees it.
- Correct answers and model answers are never sent to the student's browser while testing (the old site kept them in the page, so they could be read). After an MCQ test students see the green/red review unless you set "Show answers" to No.
- Rules enforced: 3 warnings (leaving the page/window) auto-submit; copy/paste blocked; the timer is enforced on the server (2 minutes grace); a refresh resumes the same attempt. Students can retake tests (each attempt is saved). Blocking copy/paste and tab switching is a deterrent, not proof against cheating.
- A test that has attempts cannot be deleted (set it to Draft). "Only for course" limits a test to students whose course matches exactly (ignoring capitals).
- Practice test and viva marks: Test Marks > Enter marks, choose the category.
- The old ficotestapp site is untouched and keeps working on its own.

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
Automated checks with mocked Google services: 151 backend checks (ownership isolation, duplicate/overlap blocking, approval idempotency and repair, report scoping, session revocation) and 72 page checks (every page renders for both roles; filters, search, create student, practice lookup, approve/reject/submit buttons) with no JavaScript errors.
**Not tested against your real spreadsheet/Apps Script/Vercel or on a phone.** Please run the checklist in section 24 of your brief after deploying.
