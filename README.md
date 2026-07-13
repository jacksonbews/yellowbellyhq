# YELLOW BELLY HQ

Internal team dashboard for [Yellowbelly](https://yellowbellyphoto.com) — tasks,
company docs and team profiles, styled to match the main site.

## What's inside

| Page | What it does | Who can edit |
|---|---|---|
| **Tasks** | Trello-style board + Notion-style table (toggle is remembered per person). Due dates, High/Med/Low priority, statuses (Due Today / In-Progress / On-Going / Back-Log / Complete), assignee filter, comments with @mentions. | Team members create tasks for **themselves**; managers & admins can assign **anyone**. |
| **Company Docs** | PDF uploads organised into sections (Onboarding, Roles & Responsibilities, Brand Guidelines + add your own). Docs can be assigned to people — they get a notification and see it pinned. | **Admins only** (Nikki + founders). Everyone can view/download. |
| **Team** | Everyone's profile: photo, pronouns, title, email. | Each person edits their own; Ownership & Developer manages everyone. |
| **Settings** | Team management (add/remove members, job titles, departments, access levels), access-level reference, and app connections (Slack, Gmail, Airtable, Granola, Calendly — placeholders until live). | Visible to Ownership tiers; editable by **Ownership & Developer** only. |
| **🔔 Notifications** | Top-right bell — fires when you're assigned a task, someone comments on your task, you're @mentioned, or a doc is assigned to you. | — |

**Access levels** (changed in Settings → Team Management):

| Level | Who starts with it | What it can do |
|---|---|---|
| Ownership & Developer | Nikki | Everything, incl. editing team/roles/docs/connections |
| Ownership | Jackson, Ross | Everything incl. Company Docs editing; Settings read-only |
| Studio Manager Admin | Grace S, Matthew S, Liv | Assign tasks to anyone |
| Manager Admin | Hannah, Harryet, Polly | Assign tasks within their own department |
| Team Access | everyone else | Assign tasks to themselves only |

## Preview it right now (no setup)

Open `index.html` in a browser — that's it. The app runs in **preview mode**:
everything works (tasks, comments, uploads, notifications) and saves in your
browser only. Use the **"PREVIEW AS"** dropdown in the top bar to see the app
as any team member — great for checking what managers vs. members can do.

## Going live for the whole team

Everything below happens at [console.firebase.google.com](https://console.firebase.google.com)
(free tier is fine for a 27-person team).

1. **Create a Firebase project** — call it `yellow-belly-hq`.
2. **Enable Google sign-in** — Build → Authentication → Get started →
   Sign-in method → Google → Enable.
3. **Create the database** — Build → Firestore Database → Create database →
   production mode.
4. **Enable Storage** — Build → Storage → Get started (for the PDF uploads).
5. **Register a web app** — Project overview → `</>` (Web) → register → copy the
   `firebaseConfig` block it shows you.
6. **Paste the config** into `js/config.js`, replacing `var FIREBASE_CONFIG = null;`.
7. **Check your email** — `nikkichadwickbews@gmail.com` is set as the bootstrap
   admin in `js/config.js`, `firestore.rules` and `storage.rules`. If you sign in
   with a different Google account, change it in all three files.
8. **Deploy** — in Terminal:
   ```
   cd "/Users/nikkichadwick/Desktop/WEBSITE SLIDESHOW/yellow-belly-hq"
   npm install -g firebase-tools     (first time only)
   firebase login
   firebase use --add               (pick your new project)
   firebase deploy
   ```
   This publishes the site AND the security rules in one go, and prints your
   live URL (e.g. `https://yellow-belly-hq.web.app`).
9. **First sign-in** — sign in with your Google account. The app automatically
   creates the full 27-person team list on first login.
10. **Add everyone's Gmail addresses** — Team page → *Manage* on each person →
    enter the Gmail address they'll sign in with. Until an email is set, that
    person can't log in. Then send the team the URL. Done!

### Notes

- The security rules (`firestore.rules` / `storage.rules`) enforce all the
  permissions on the server, so nobody can work around them — only admins can
  touch Company Docs, and only managers/admins can assign tasks to others.
- Preview-mode data lives in this browser only; it does not carry over to the
  live site.
- Profile emails must match the Google account the person signs in with.
