# WHC Portal

This repository contains the WHC Portal frontend and backend in separate folders.

## Requirements
- Node.js 20.19+ (or a current Node.js LTS release)
- npm 10+
- MongoDB Atlas or a local MongoDB server

## 1. Configure the backend

Copy `backend/.env.example` to `backend/.env` and set:

- `MONGO_URI`: your MongoDB connection string
- `JWT_SECRET`: a long random secret (32+ characters)
- `CLIENT_URL`: local frontend origin, normally `http://localhost:5173`
- `SEED_ADMIN_NAME`, `SEED_ADMIN_USERNAME`, and `SEED_ADMIN_PASSWORD`: initial admin account details; password must be at least six characters
- `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PHONE` are optional

## 2. Configure the frontend

Copy `frontend/.env.example` to `frontend/.env`.

`VITE_API_URL` must be the backend API base URL and include `/api`:

```env
VITE_API_URL=http://localhost:5000/api
```

For deployment, set this to your deployed backend URL, for example `https://your-api.onrender.com/api`. Vite environment variables are read at build time, so rebuild/redeploy the frontend after changing this value.

## 3. Install and run

From the project root:

```bash
npm install
npm run seed:admin
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:5000

You can also run them separately:

```bash
npm run dev:backend
npm run dev:frontend
```

## Notes
- `npm run seed:admin` requires a working MongoDB URI and the `SEED_ADMIN_*` values above. It creates the configured admin only if that username does not already exist. Existing accounts and database records are not changed or deleted.
- Do not commit either `.env` file. Only `.env.example` files belong in version control.
- `VITE_API_URL` is public frontend configuration, not a secret. Never put MongoDB credentials or JWT secrets in frontend variables.
- Trainer batches, attendance, project assignments/submissions/marks, and monthly evaluations are persisted through the backend and shared with the student portal. Attendance is visible to students after the trainer saves and publishes the completed session. Other legacy workspace screens may still use browser-local state and should not be treated as centrally saved unless they are connected to an API.
- The backend currently models a student's current batch as a single `batch` reference. Multiple simultaneous batch memberships require a coordinated schema/API migration before the student dashboard can truthfully display multiple active batches.
- The frontend starts with empty live-record lists and does not add sample leads, employees, students, attendance, projects, evaluations, or analytics. Existing MongoDB records are preserved.
- Admins create and edit counsellor and trainer profiles from the **Counsellors** and **Trainers** sections, including login usernames and passwords. Leave the password field blank when editing to keep the current password. Credentials are shown only during the current browser session after creation or reset.
- Counsellors create student accounts from **My Students** or convert a lead to an admission. Student usernames are generated from the student's name plus a unique number and identify each portal account; phone numbers may be shared or left blank. When a phone number is provided it is the initial password, otherwise a temporary password is generated. Credentials are shown after admission and should be shared securely; students should change the initial password after signing in. On startup, the backend removes any legacy unique phone-number index from the student collection.
- Student rosters show the registration date. Admins can filter the student list by counsellor and an inclusive registration-date range; the footer shows the matching student count.
- Admin lead and student lists are loaded from the backend. Lead deletion and the **Delete** action on each admin student row require confirmation and permanently delete the database record. Deleting a student also removes their attendance, evaluations, project submission/evaluation, deadline extension, fee, complaints, and batch-roster records.
- Counsellors can edit their own leads and set their status to New, Follow-up, Enrolled, or Dead. Call and WhatsApp follow-up counts remain visible after enrollment.
- Students can submit complaints to their assigned counsellor, assigned trainer, and/or the active admin team. Each selected staff account must add a written resolution and mark it resolved; students can read each response in their portal. MongoDB's TTL index removes the complaint 24 hours after every selected recipient resolves it (TTL deletion can run shortly after the exact expiry time).
- The leaderboard winner celebration uses a locally synthesized game-style victory jingle followed by the bundled clapping sound from the project root.
- Workspace toast notifications automatically dismiss after 11 seconds; a new notification restarts the timer.
- Admin and counsellor messaging/chat has been removed.
