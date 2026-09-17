# System Demo Guide — Japanese Language Learning Gaming AI for Unmei Nihongo Center

Use this guide when presenting the system to a panel, adviser, or client. Pair it with VOICEOVER-SCRIPT.md if you are recording a narration.

## Before you start

1. Run the system: `powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1`
2. Wait for `PORTAL_URL=http://localhost:5002/` then open that address.
3. Quick check: `powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -IncludeWebsiteRoutes` (should end with SMOKE_TEST_PASS).
4. Have these logins ready (verified against the live database):

| Role | Email | Password |
|---|---|---|
| Student | `liam.reyes1@unmei-ph.com` | `student_001` |
| Instructor | `aiko.tanaka@unmei-ph.com` | `prof_001` |
| Admin | `admin@unmei-ph.com` | `admin_main` |

5. Sign out of any old sessions first (browser console: `localStorage.clear()` for student pages, `sessionStorage.clear(); location.reload();` for instructor/admin).

## Demo flow

### Part 1 — The website (about 1 minute)

Open `http://localhost:5002/`. You land on the UNMEI Nihongo Center website, the same look as their real site, served from our own files. Point out the header: Home, About Us, Services, Posts, Contact Us, and our two additions on the right side: **Pre-Enroll** (red button) and **Login** (outlined button).

Scroll through the homepage briefly — courses, features, contact section. Mention that everything loads from our own hosting, including the styles and fonts, so the site works even with the real website offline.

### Part 2 — Pre-Enroll and registration (about 2 minutes)

Click **Pre-Enroll**. The registration application opens. Walk through:

- Fill the form normally first (name, email, phone, password) to show the flow.
- Then type an email like `test@gmail.com` changed to something like `abc@email.com` and show the validation blocking disposable domains. Wait for the inline message.
- Type an email that already exists (for example `liam.reyes1@unmei-ph.com`) and show the duplicate check firing across the database.
- Fill everything correctly to finish the demo of this page. You do not need to actually submit; you can stop before the assessment or take the short placement assessment if the panel wants to see it. The assessment questions come live from the database.

Talking point: all validation rules are fetched from the database, so the school can update the rules without touching the code.

### Part 3 — Student portal (about 4 minutes)

Go to either `http://localhost:5002/student-login` or `http://localhost:5002/UNMEIstudentsportal/login.html`. Both load the same student portal login and connect to the live database. Log in with the student account above.

- If it is the first login for that account, the Portal Usage Agreement appears first. Accept it and the guided tour walks through the dashboard once.
- On the dashboard, show the six visualizations: the skill radar, weekly progress line, activity heatmap, module completion, announcements, and quick stats. All of these come from what the student did in the mobile app (the app syncs daily study data: minutes, sessions, kanji reviewed).
- Open **Courses**: pick the student's course, open a module, then open the Kanji Reference and look up one kanji (show stroke count and readings).
- Open **Payments**: show the record list and the upload receipt flow.
- Open **Schedules**: show the class schedule with the professor's name.
- Briefly open **Profile** (attendance and account settings).

Talking point: the mobile app and this portal share one database. Whatever the student practices in the app tonight appears here the next time they log in.

### Part 4 — Instructor portal (about 4 minutes)

Sign out from the student portal, then go to either `http://localhost:5002/instructor-login` or `http://localhost:5002/UNMEIinstructorportal/instructor-login.html`. Log in with the instructor account above.

- Dashboard: three charts built from the assigned students' data.
- Open **My Students**: pick Liam Reyes from the roster and open the student view. This is the strongest page of the demo:
  - Weekly progress line and the six-axis skill radar.
  - The three dedicated panels: **Reading**, **Writing**, **Listening**, each with the weekly grade trend, current score, best week, and how many days the student practiced that skill in the app.
  - **Study Activity Calendar**: the daily grid synced from the mobile app, with totals for days studied, minutes, kanji reviewed, sessions, and longest streak.
  - **Course Grades and Performance**: average grade plus Reading, Writing, Listening, and Speaking bars with recent history.
- Go back and open **Ratings and Feedback**: ratings written by students for this professor.

Talking point: instructors used to keep paper records. Now everything the student does in the app shows up here automatically, per skill, per week.

### Part 5 — Admin portal (about 3 minutes)

Sign out, then go to either `http://localhost:5002/admin-login` or `http://localhost:5002/UNMEIadminportal/admin-login.html`. Log in with the admin account above.

- Dashboard: stat cards (students, enrollments, revenue, pending payments) and four charts, all counted live from the database.
- **Students**: open the list, open View Performance on any student.
- **Payments**: pick a pending payment and approve it. Then point out that the student would see the notification and updated balance on their own dashboard.
- **Announcements**: post one short announcement, then (if time permits) show it appearing in the student dashboard.

Talking point: one database behind everything. Admin approves a payment, the student sees it. A student practices in the app, the instructor sees it.

### Part 6 — Wrap up (about 30 seconds)

Close by summarizing: one Unity mobile app for learning, one web portal for the school, one shared live database, and a public website for the center. Then thank the panel and open the floor for questions.

## If something fails during the demo

- Page looks unstyled: you opened a file directly. Go back to `http://localhost:5002/`.
- Login rejected: re-check the email (`@unmei-ph.com`), clear storage as noted above, and try again.
- Anything else: stop the system (`stop-all.ps1`), start it again (`start-all.ps1`), and reload the page.
