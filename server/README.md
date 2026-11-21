# Backend email OTP

Email OTP is used to verify an email during registration and to reset a
password. Configure SMTP before starting the server:

1. Copy `.env.example` to `.env`.
2. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and
   `SMTP_FROM` for your mail provider.
3. Restart the backend.

For Gmail, use `smtp.gmail.com`, port `587`, and `SMTP_SECURE=false`. Create a
Google App Password for `SMTP_PASS`; do not use or commit your regular account
password. Keep `.env` private and never commit SMTP credentials.

Codes expire after five minutes, are limited to five verification attempts, and
can be resent after one minute. Password reset is enabled only for workers with
a verified email and for admin accounts with an email address.

Rejecting worker accounts, cash advances, early-out requests, or attendance
correction requests requires a reason of 1–100 characters. Rejection reasons are
stored with the reviewed record.

## Creating an administrator account

`create-admin.js` no longer contains a preset account or prints passwords. To
create a new account, provide `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`,
`ADMIN_FIRST_NAME`, and `ADMIN_LAST_NAME` as private environment variables,
then run `node create-admin.js` from the `server` directory. The initial
password must be 12–72 UTF-8 bytes. Optional profile variables are
`ADMIN_MIDDLE_NAME`, `ADMIN_PHONE`, `ADMIN_HOME_ADDRESS`, `ADMIN_EMP_ID`, and
`ADMIN_DEPT`. The script refuses to overwrite an existing username.

## Database selection

The backend selects its database using `DB_TYPE`. If `DB_TYPE` is omitted, it
defaults to MySQL unless `NODE_ENV=production`, in which case it defaults to
Firebase. Explicitly set `DB_TYPE` in each environment to avoid ambiguity.

The existing MySQL mode remains the local default and uses the existing
Firestore-style document tables (`buildtrack_documents` and
`buildtrack_firestore_outbox`). Existing tables and records are not deleted or
reset. Firebase mode accesses Cloud Firestore directly through the Firebase
Admin SDK; it does not connect to MySQL or automatically copy records.

### Local development (Laragon/XAMPP)

1. Copy `server/.env.example` to `server/.env` if you do not already have one.
   If `server/.env` already exists, add or update settings without overwriting
   existing mail or Firebase credentials. Start MySQL in Laragon or XAMPP.
2. Set `DB_TYPE=mysql`, `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_USER`,
   `DB_PASSWORD`, and `DB_NAME=buildtrack_db` in `server/.env`.
   `DB_PASSWORD` must match the password configured for that MySQL user. The
   adapter loads this file when the backend starts.
3. Optionally configure Firebase credentials to keep Firestore mirroring
   enabled. Do not commit `.env` or service-account credentials.

### API authentication

Sensitive API routes require a valid Admin JWT and an active Admin record.
Health, login, registration, email verification, and password reset routes
remain public as required for those flows. In development, an ephemeral JWT
secret is generated when `JWT_SECRET` is omitted, so tokens expire when the
backend restarts. Production must set a stable random `JWT_SECRET` of at least
32 bytes.

Worker login also returns a short-lived Worker JWT. Worker tokens can read the
authenticated worker's attendance, schedules, requests, payroll, cash advances,
profile, shared project list, and tool inventory, plus worker announcements.
Attendance and request lists are scoped to that worker, and ID-based profile
and payroll routes require the token's worker ID. Worker cash advances remain
pending for Admin review, and profile updates cannot change roles, rates, or
account status.

Workers whose saved role or position includes `Attendance Monitoring` or
`Timekeeper` can use the attendance-management APIs. Workers whose saved role
or position includes `Tools Monitoring` or `Custodian` can use the tools
management APIs. Those capabilities are derived from the worker record on each
request; the client cannot grant itself access by changing request headers.
Specialist workers still cannot access Admin APIs or the broader Admin
notification feed. The attendance scan endpoint accepts an authorized
attendance worker JWT for mobile scans; dedicated RFID terminals continue to
use the private `RFID_API_KEY`.

The RFID terminal path to the attendance scan endpoint requires `RFID_API_KEY`
in the `x-rfid-api-key` request header. Use a random key of at least 32 bytes
and configure the same private key on the terminal. Authorized attendance-role
mobile users use their Worker JWT instead; they do not need the RFID key.
Without either credential, scans are rejected.

### Production (Firebase Cloud Firestore)

1. Set `NODE_ENV=production` and `DB_TYPE=firebase` in the backend deployment.
2. Set `FIREBASE_PROJECT_ID` and provide backend credentials using
   `FIREBASE_SERVICE_ACCOUNT_JSON`, `GOOGLE_APPLICATION_CREDENTIALS`, or the
   deployment platform's Application Default Credentials. Never put these
   credentials in frontend variables or source control.
3. Existing JWT authentication and API routes remain in the backend. Firestore
   must contain the collections/documents the application uses; selecting
   Firebase does not migrate MySQL records.
4. Some multi-field Firestore queries require composite indexes. Create and
   deploy any indexes requested by Firestore before using the affected
   endpoints.

### Optional data migration

Data transfer is not run automatically. To import MySQL documents into
Firestore, configure credentials and run the new dry run from the `server`
directory:

1. Back up both databases, then run `npm run migrate:mysql-to-firestore`.
2. Review the collection/document counts. Only after confirming the target
   Firebase project and counts, run
   `npm run migrate:mysql-to-firestore -- --apply`.

The importer preserves the MySQL source and skips document IDs that already
exist in Firestore. It can be rerun after an interrupted import. To import in
the other direction, the existing `npm run migrate:firestore` command remains
available; it also defaults to a dry run and skips existing MySQL documents.
