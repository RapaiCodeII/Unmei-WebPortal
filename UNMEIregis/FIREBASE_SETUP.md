# Firebase Setup Guide for Unmei Nihongo Center

This guide walks you through setting up Firebase Authentication and Realtime Database for the enrollment system.

---

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** (or "Add project")
3. Enter project name: `unmei-nihongo-center`
4. Disable Google Analytics (optional for this project)
5. Click **"Create project"**

---

## Step 2: Enable Authentication

1. In Firebase Console, go to **Build → Authentication**
2. Click **"Get started"**
3. Go to **Sign-in method** tab
4. Enable **Email/Password** provider:
   - Click on "Email/Password"
   - Toggle the first switch to **Enable**
   - Click **Save**

---

## Step 3: Create Realtime Database

1. Go to **Build → Realtime Database**
2. Click **"Create Database"**
3. Choose your database location (recommend: `asia-southeast1` for Philippines)
4. Start in **locked mode** (we'll set rules next)
5. Click **"Enable"**

---

## Step 4: Set Database Rules

1. In Realtime Database, go to **Rules** tab
2. Replace with the following rules:

```json
{
  "rules": {
    "enrollments": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    },
    "enrollments_admin": {
      ".read": "auth != null",
      ".write": false
    }
  }
}
```

3. Click **"Publish"**

> **Note:** These rules allow users to read/write only their own data. Admin access is read-only.

---

## Step 5: Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. Scroll to **"Your apps"** section
3. Click the web icon `</>`
4. Register app with nickname: `unmei-enrollment`
5. Copy the `firebaseConfig` object
6. Update `src/firebase.js` with your config

**How to find your `databaseURL`:**
1. Go to **Build → Realtime Database** in the left sidebar.
2. Look at the top of the **Data** tab.
3. Copy the URL shown there (e.g., `https://your-project-id.region.firebasedatabase.app`).
4. Add it to your `firebaseConfig` object manually if it's missing (sometimes the auto-copy doesn't include it).

```javascript
databaseURL: "https://unmei-nihongo-center-default-rtdb.asia-southeast1.firebasedatabase.app"
```

---

## Step 6: Import Initial Data (Optional)

1. Go to **Realtime Database**
2. Click the **three dots menu** (⋮) → **Import JSON**
3. Select the `firebase-database-structure.json` file from this project
4. Click **Import**

---

## Database Structure

The enrollment data is stored with the following structure:

```
enrollments/
  └── {userId}/
       ├── fullName: "Juan Dela Cruz"
       ├── email: "juan@email.com"
       ├── country: "Philippines"
       ├── countryCode: "+63"
       ├── mobileNumber: "+63 912 345 6789"
       ├── address: "123 Main St, Manila"
       ├── course: "JLPT N4"
       ├── classSetup: "Online"
       ├── status: "pending"
       ├── assessmentScore: 4
       ├── assessmentPassed: true
       ├── assessmentAnswers: { "n4_q1": "a", "n4_q2": "a", ... }
       ├── essayAnswer: null (or string for N2)
       ├── createdAt: 1704067200000
       └── updatedAt: 1704067200000
```

---

## Course Assessment Requirements

| Course | Assessment Required | Passing Score | Total Questions |
|--------|---------------------|---------------|-----------------|
| JLPT N5 | ❌ No | - | - |
| JLPT N4 | ✅ Yes | 3 | 5 |
| JLPT N3 | ✅ Yes | 3 | 4 |
| JLPT N2 | ✅ Yes | 2 | 4 (+ 1 essay) |
| Bundle N5+N4 | ❌ No | - | - |
| Bundle N5-N3 | ❌ No | - | - |

> **Note:** If a student fails the assessment, enrollment is **blocked**. They are advised to select JLPT N5 or a bundle course.

---

## Enrollment Status Values

| Status | Description |
|--------|-------------|
| `pending` | New enrollment, awaiting review |
| `approved` | Enrollment approved by admin |
| `rejected` | Enrollment rejected |
| `enrolled` | Student actively enrolled |
| `completed` | Course completed |

---

## Quick Test

After setup, test by:
1. Run `npm run dev`
2. Fill out the registration form
3. Select JLPT N4/N3/N2 to trigger the assessment modal
4. Complete the assessment and submit
5. Check Firebase Console → Realtime Database
6. You should see data under `enrollments/{uid}` with assessment results

---

## Troubleshooting

**"Permission denied" error:**
- Check that Authentication is enabled
- Verify user is logged in before writing
- Review database rules

**Data not appearing:**
- Check browser console for errors
- Verify `databaseURL` in config is correct
- Ensure Realtime Database (not Firestore) is enabled

**Assessment not showing:**
- Make sure you selected JLPT N4, N3, or N2 (not N5 or bundles)
- Check browser console for JavaScript errors

---

## Security Reminders

- Never commit Firebase credentials to public repos
- Use environment variables for production
- Regularly review database rules
- Enable App Check for production
