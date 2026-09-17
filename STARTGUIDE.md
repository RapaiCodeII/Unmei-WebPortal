# STARTGUIDE — UNMEI Nihongo Center Web System

How to **start** the whole system, use it, and **stop** it — with zero errors.
Firebase project: `unmei-nihongo-center` · live Realtime Database (asia-southeast1) · no re-imports, rules never change.

---

## What changed vs the old workflow (for the team)

Nothing is broken — the system is the same pages, same portals, same live database (no re-imports, rules untouched). Changes since the first build, each with a reason:

1. **Port: 5000 → 5002.** The old static server let the browser cache stale HTML, which caused the "nawala styles" confusion after file changes. The Firebase Hosting emulator on 5002 sends `no-cache` on HTML, serves the same files, and matches production hosting exactly. Port 5000 is retired.
2. **Website rebuilt from the live unmei-ph.com.** The old local copy and the old deployment referenced versioned asset URLs that no longer exist on the live server — that is why the deployed site previously rendered unstyled. The rebuild stores every style/font/image locally; the look is identical to the real site.
3. **Login emails are now `@unmei-ph.com`.** The backend updated the live database roster (new professor names/emails). The old `@unmei.edu` accounts no longer exist in the DB, so those credentials fail. Passwords are unchanged. See the Logins table below — verified against the live DB.
4. **stop/start scripts fixed.** The hosting emulator binds IPv6, which `stop-all.ps1` could not see before (stale processes lingered and caused port confusion). It now stops and starts cleanly every time.
5. **One served copy: `public/`.** All deployed folders moved inside `public/` so nothing is deployed twice; the old mirror-style duplicates are gone. The instructor Student View also gained the merged team panels (Study Activity Calendar + Course Grades & Performance) reading the live schema.
6. **Cleanup.** Old plans and one-off tools moved to `archive/` — nothing was deleted, just organized out of the way.

For demos and UAT: `start-all.ps1` → open **http://localhost:5002/** → use the credentials below. Never open `.html` files directly (double-click shows raw unstyled HTML — that is expected browser behavior, not a bug).

## ▶ START (this is all you need)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-all.ps1
```

This starts the **Firebase Hosting emulator on fixed port 5002**. It serves the exact same files as production hosting, supports both the folder routes and the short portal routes (`/UNMEIstudentsportal/login.html` and `/student-login`, with equivalent Admin and Instructor routes), and sends `no-cache` on HTML so the browser always shows fresh pages.

Success looks like this:

```
PREREQ_PASS: node, npm, npx, firebase are available.
START_ALL_INFO: Firebase hosting is live on port 5002 (pid=…)
START_ALL_MODE=HOSTING (pretty URLs active: /register, /student-login, /admin-login, /instructor-login)
START_ALL_PASS
PORTAL_URL=http://localhost:5002/
```

Then open: **http://localhost:5002/**

Notes:
- `-EnableFirebaseHosting` is no longer needed — hosting **is** the default. The old static server on port 5000 is retired (it let the browser cache stale HTML, which is why styles once looked broken there).
- If an emulator is already running on 5002, the script reuses it (`Reusing Firebase hosting already live on port 5002`).
- If 5002 is taken by something else, the emulator shifts to 5003+ — trust only the printed `PORTAL_URL=` line.
- If `firebase login` is not active, the script auto-falls back to a static server on 5000 (`START_ALL_MODE=STATIC_FALLBACK`); pretty URLs will not work there — run `firebase login` and start again.
- First-ever run may take up to 40 s while the CLI warms up.

### What to open (copy-paste)

```powershell
Start-Process "http://localhost:5002/"; Start-Process "http://localhost:5002/register"; Start-Process "http://localhost:5002/student-login"; Start-Process "http://localhost:5002/admin-login"; Start-Process "http://localhost:5002/instructor-login"
```

| Page | URL |
|---|---|
| Main website (Pre-Enroll + Login in header) | `http://localhost:5002/` |
| Website pages | `http://localhost:5002/UNMEIwebsite/about.html` · `services.html` · `posts.html` · `contact.html` · `beginner-course.html` · `jlpt-n4-course.html` · `study-in-japan.html` |
| Registration app | `http://localhost:5002/register` (or `/UNMEIwebsite/register/`) |
| Student login | `http://localhost:5002/student-login` or `http://localhost:5002/UNMEIstudentsportal/login.html` |
| Admin login | `http://localhost:5002/admin-login` or `http://localhost:5002/UNMEIadminportal/admin-login.html` |
| Instructor login | `http://localhost:5002/instructor-login` or `http://localhost:5002/UNMEIinstructorportal/instructor-login.html` |
| Live hosting (after deploy) | https://unmei-nihongo-center.web.app/ |

### Verify before UAT

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1 -IncludeWebsiteRoutes
```

→ `SMOKE_MODE=HOSTING` · 20 routes all `SMOKE_URL_PASS` · `SMOKE_TEST_PASS` (includes the pretty URLs; if hosting is down it tests the static fallback on 5000 instead and says so).

### If a portal looks unstyled or Sign In does not navigate

1. Confirm the browser address is `http://localhost:5002/...`, not a `file://` URL or the retired port 5000.
2. Run `.\scripts\stop-all.ps1`, then `.\scripts\start-all.ps1` to ensure the Firebase Hosting emulator has loaded the current `firebase.json` rewrites.
3. Open the pretty route again and hard-refresh with `Ctrl+F5`.
4. The portal login pages use absolute asset and dashboard paths, so `/student-login`, `/admin-login`, and `/instructor-login` work consistently with or without a trailing slash.

## ■ STOP

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-all.ps1
```

Success looks like this:

```
STOP_ALL_INFO: Stopped process=… via listener-port
STOP_ALL_PASS: Stopped processes: …
```

It kills every listener on port 5000 and the hosting-emulator range (5001–5010) and removes `firebase-debug.log`. After `STOP_ALL_PASS` nothing of the system is running. Start again any time — stop/start is safe to repeat.

## One-time setup (new machine)

1. Install **Node.js LTS 18+** (includes npm/npx — the rebuild script uses native fetch): https://nodejs.org
2. Firebase CLI: `npm install -g firebase-tools` then `firebase login` (required for hosting mode, deploy, and DB tools)
3. Project is already linked via `.firebaserc` (default: `unmei-nihongo-center`)

> This machine has no `git`; the project is folder-based. VS Code launch config opens `http://localhost:5002/` (never open `index.html` as `file://` — styles and absolute paths break).

## Logins (live RTDB — nothing hardcoded)

> **All emails are `@unmei-ph.com`** — they match the live database exactly. The database roster was updated by the backend (professor names/emails changed; older `@unmei.edu` addresses no longer exist), so old credentials from previous docs will fail.

| Portal | Email | Password |
|---|---|---|
| Student | `liam.reyes1@unmei-ph.com` | `student_001` |
| Student | `noah.santos2@unmei-ph.com` | `student_002` |
| Student | `ethan.cruz3@unmei-ph.com` | `student_003` |
| Instructor | `aiko.tanaka@unmei-ph.com` | `prof_001` |
| Instructor | `kenji.watanabe@unmei-ph.com` | `prof_002` |
| Admin | `admin@unmei-ph.com` | `admin_main` |

- Student/instructor resolve via Firebase Auth first, RTDB fallback (password = student UID / professor key; revoked or deactivated accounts rejected).
- Admin resolves through `admins/` + a `permissions` object; `admin@unmei.edu` intentionally fails (no permissions) — use `admin@unmei-ph.com`.
- Full live professor roster (6): aiko.tanaka, kenji.watanabe, maria.nakamura, hiroshi.yamamoto, rico.cruz, yuka.takahashi — all `@unmei-ph.com`, passwords are their `prof_00X` keys.
- Login issues: hard refresh (`Ctrl+F5`); student → `localStorage.clear()`; instructor/admin → `sessionStorage.clear(); location.reload();`.

## Data (live, shared with the mobile app)

- Every portal connects directly to `https://unmei-nihongo-center-default-rtdb.asia-southeast1.firebasedatabase.app` via its own `firebase-config.js`. 28 root nodes; 30 seeded students + real accounts; 6 professors; 6 courses. A `contact_leads` node is provisioned in the rules for the website contact form.
- The live roster evolves with the backend (current professor emails/names are in the Logins table above — always re-verify against the DB before demos; do not trust older documents).
- The Android app writes to the **same database**: `students/{uid}/appSyncData` (streak, minutes, modules, characters) and `activityCalendar/{uid}/{YYYY-MM-DD}` (daily `skillsPracticed`, `minutesStudied`, `sessionsCompleted`) — the instructor Student View reads them live, including the dedicated **Reading / Writing / Listening** panels (weekly grade trend from `grades/`, current grade, best week, app practice days).
- **No re-imports. Never modify rules.** `database.rules.json` stays as deployed.
- Firebase MCP works — pass the explicit `databaseUrl` above to Realtime Database tools (default instance detection alone is not enough).
- Read-only backup (CLI): `firebase database:get / --project unmei-nihongo-center --instance unmei-nihongo-center-default-rtdb > backup-before-change.json`

## Website refresh & deploy

```powershell
node .\scripts\rebuild-website.mjs --dry-run   # preview
node .\scripts\rebuild-website.mjs             # re-fetch 8 pages from unmei-ph.com, localize assets, re-inject CTAs
firebase deploy --only hosting --project unmei-nihongo-center
```

Do not hand-edit `UNMEIwebsite/*.html` to point at `https://unmei-ph.com/...` — that is what broke the styles on the old deployment. CSS is cached immutably on hosting; changed CSS must get a new `?ver=` (the script already does this for `unmei-portal.css`). After any change: re-run the smoke test, then `Ctrl+F5` in the browser.

## Troubleshooting

| Symptom | Fix |
|---|---|
| **"HTML classic" — page renders with no styles** | You opened the `.html` file directly (double-click / editor preview). Styles live in separate CSS files and absolute-path links only work through the server. Always view via `http://localhost:5002/` |
| 404 everywhere on 5002 | Emulator died or port moved → `STOP`, then `START`; trust `PORTAL_URL=` |
| Styles look broken | Hard refresh `Ctrl+F5`. If it persists only on 5000 — that port is retired; use 5002 |
| `START_ALL_MODE=STATIC_FALLBACK` | `firebase login` is missing/expired → `firebase login`, re-run START |
| Nothing on port 3000 | No 3000 server exists in this project; registration app is pre-built |
| Emulator slow on first start | CLI cold start, wait up to 40 s |
| Styles missing on the live URL | `node scripts\rebuild-website.mjs` + `firebase deploy --only hosting`, then `Ctrl+F5` |
| File looks empty/wrong | OneDrive cloud-only placeholder → "Always keep on this device" |

## Folders

```
public/                 THE served site (firebase.json points here)
  UNMEIwebsite/           website replica + register/ (pre-built React)
  UNMEIstudentsportal/    student portal
  UNMEIadminportal/       admin portal
  UNMEIinstructorportal/  instructor portal (Reading/Writing/Listening panels, activity calendar, grades)
  index.html              entry stub -> redirects to UNMEIwebsite/
UNMEIregis/             registration React source (only to rebuild register/)
scripts/                start-all.ps1 · stop-all.ps1 · smoke-test.ps1 · rebuild-website.mjs
firebase.json           hosting config (public: "public") + rewrites + headers + DB rules pointer
.firebaserc             default project: unmei-nihongo-center
unmei_fdd_*.xml         functional decomposition diagrams (documentation deliverables)
system-demo.md          step-by-step demo walkthrough for panels and clients
VOICEOVER-SCRIPT.md     narration script for recorded demos
SCREENSHARE-GUIDE.md    Xbox Game Bar / meeting share prep and live-failure playbook
archive/                old plans and one-off tools kept out of the way (not deployed, do not serve)
```

There is exactly one copy of every served file, inside `public/` — nothing outside it is deployed. The static fallback (if Firebase login is down) also serves `public/`. All portal/website pages use **relative paths**; data is always live from the cloud RTDB, identical on any machine. The portals are a working system, not a mockup: every figure on every page (student radar, teacher panels, payments, admin stats) is read from — or written to — the same live database the mobile app uses.

## Demo prep pointers

- **Panel or client walkthrough** → `system-demo.md` (flow, timing, credentials, talking points, failure recovery).
- **Recording a narration** → `VOICEOVER-SCRIPT.md` (spoken-word script with timestamps).
- **Sharing your screen in a meeting or via Xbox Game Bar** → `SCREENSHARE-GUIDE.md` (setup, tab order, pre-share checklist, live-failure playbook).
- Validation status, verified against the live DB on 2026-09-06: registration reads its rules live from `validation_rules/enrollment` (patterns, lengths, allowed values, uniqueness), blocks disposable domains, and scans duplicates across `users/`, `students/`, and `enrollments/`. All three login pages handle wrong password, invalid email, rate limiting, revoked/suspended accounts, and network failure with clear messages; session guards re-check account status and idle timeout on every page load. Empty announcement templates and missing app download URLs render as clean empty states, not broken pages.
