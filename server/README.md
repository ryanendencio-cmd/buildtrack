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

## Local MySQL and Firestore mirror

The backend uses Laragon/MySQL as its primary store and mirrors committed
changes to Firestore through a MySQL outbox. The current Firestore-style
collections are stored as JSON documents in the `buildtrack_documents` table;
`buildtrack_firestore_outbox` records pending mirror operations.

1. Start MySQL in Laragon and confirm that `buildtrack_db` exists.
2. Set `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_USER`, `DB_PASSWORD`, and
   `DB_NAME=buildtrack_db` in `server/.env`. The adapter creates its two
   application tables automatically. Do not commit `server/.env`.
3. Keep the Firebase project ID and service-account credentials configured in
   `server/.env` if Firestore should remain a mirror.
4. Before starting the updated backend, back up Firestore and run
   `npm run migrate:firestore` from the `server` directory to preview the
   top-level collection/document counts. Review the counts, then run
   `npm run migrate:firestore -- --apply` to import documents. Existing MySQL
   documents are preserved and skipped, so the import can be safely resumed.
5. Start the backend with `npm start`. MySQL commits are authoritative;
   Firestore mirror failures are logged and retried from the outbox.

The MySQL adapter preserves the current document-style data model for this
initial migration; it does not create normalized relational tables. This setup
is for local development: a remotely deployed backend cannot connect to
`127.0.0.1` on your PC.
