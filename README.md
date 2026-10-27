# Entry — Visitor management

A responsive visitor management app with an admin dashboard, guard QR scanner, and personal visitor accounts. Visitor IDs, hashed passwords, sessions, and entry/exit timestamps are stored in SQLite (`data/entry.db`).

## Run locally

Requires Node.js 24+ and npm.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The preview opens an administrator demo session. Use the profile menu at the bottom of the sidebar to try the guard or visitor experience. The workspace includes eight fictional visitors.

## Roles and workflows

- **Administrator:** register visitors, download personal QR passes, search/filter the directory, scan passes, and export visitors or access logs as CSV.
- **Security guard:** scan a pass with the camera or enter its ID. The first scan checks in and the next scan checks out. Repeat visits create separate log records.
- **Visitor:** create an account from the sign-in dialog, view/download their own pass, and see their visits. The API restricts visitors to records linked to their account.

Admins can download and share a visitor QR image manually. Email delivery is not configured. Camera scanning requires HTTPS or localhost and browser camera permission. A manual pass ID fallback is always available. Dates are stored in UTC and displayed in the browser's local timezone.

## Demo accounts

| Role    | Email               | Password    |
| ------- | ------------------- | ----------- |
| Admin   | admin@entry.local   | Welcome123! |
| Guard   | guard@entry.local   | Welcome123! |
| Visitor | visitor@entry.local | Welcome123! |

These accounts and open demo role switching are for local evaluation. Do not expose this demonstration to real visitor data. Before an external deployment, disable demo access (`DISABLE_DEMO=true`), replace the seeded credentials, provide HTTPS and persistent database storage, and add deployment-specific account administration and recovery. Disable demo access also prevents the automatic demo login. The source contains only fictional sample data.

## Checks and build

```sh
npm test
npm run build
NODE_ENV=production node server/index.js
```

The tests use an isolated in-memory SQLite database to verify authentication, role restrictions, private visitor registration, and entry/exit logging. Production assets are served from `dist/`; the server listens on port 3000.
