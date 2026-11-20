/**
 * firestore-adapter.js
 * Drop-in replacement for mysql-adapter.js that uses Firestore directly.
 * No MySQL needed — all reads and writes go straight to Firebase Firestore.
 */

const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// ── Load .env (same logic as mysql-adapter.js) ────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (process.env[key] === undefined) process.env[key] = val;
      }
    }
  } catch {}
}

// ── Initialize Firebase Admin ─────────────────────────────────────────────────
function initFirebase() {
  if (admin.getApps().length) return;

  const projectId     = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  const saJson        = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credPath      = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID is not set in .env');
  }

  if (saJson) {
    // Railway / cloud: credentials from env var
    admin.initializeApp({ credential: admin.cert(JSON.parse(saJson)), projectId });
  } else if (credPath) {
    // Local: credentials from file
    const resolved = path.isAbsolute(credPath)
      ? credPath
      : path.resolve(__dirname, credPath);
    const serviceAccount = require(resolved);
    admin.initializeApp({ credential: admin.cert(serviceAccount), projectId });
  } else {
    admin.initializeApp({ projectId });
  }
}

initFirebase();
const _db = getFirestore();

// ── Adapter class — constructor returns the native Firestore instance ──────────
// index.js does: const db = new MySQLFirestoreAdapter({ host, user, ... })
// We simply ignore the MySQL config and return Firestore directly.
class MySQLFirestoreAdapter {
  constructor(_mysqlConfig = {}) {
    console.log('[firestore-adapter] Running in Firestore-only mode ✓');
    return _db; // native Firestore is returned as the db object
  }
}

module.exports = { MySQLFirestoreAdapter, FieldValue };

