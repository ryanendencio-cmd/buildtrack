# Backend email OTP

Email OTP is used to verify registration email addresses, verify new email
addresses when worker/admin profiles are changed, and reset passwords.
Configure SMTP before starting the server:

1. Copy `.env.example` to `.env`.
2. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and
   `SMTP_FROM` for your mail provider.
3. Restart the backend.

For Gmail, use `smtp.gmail.com`, port `587`, and `SMTP_SECURE=false`. Create a
Google App Password for `SMTP_PASS`; do not use or commit your regular account
password. Keep `.env` private and never commit SMTP credentials.

Codes expire after five minutes, are limited to five verification attempts, and
can be resent after one minute. Password reset is enabled only for workers with
a verified email and for admin accounts with an email address. Email changes
take effect only after the new address is verified.
