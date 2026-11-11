const admin = require('firebase-admin');
const { getFirestore: getAdminFirestore, FieldValue: FirestoreFieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (process.env[key] === undefined) {
          process.env[key] = val.replace(/^['\"]|['\"]$/g, '');
        }
      }
    }
  } catch (e) {}
}

const SERVER_TIMESTAMP_SENTINEL = Symbol('SERVER_TIMESTAMP');
const DELETE_SENTINEL = Symbol('DELETE_FIELD');

function getFirestore() {
  try {
    if (!admin.getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

      if (projectId && serviceAccountJson) {
        // Railway / cloud: load credentials from env var JSON string
        try {
          const serviceAccount = JSON.parse(serviceAccountJson);
          admin.initializeApp({
            credential: admin.cert(serviceAccount),
            projectId
          });
          console.log('Firebase initialized from FIREBASE_SERVICE_ACCOUNT_JSON env var.');
        } catch (parseErr) {
          console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', parseErr.message);
          admin.initializeApp({ projectId });
        }
      } else if (projectId && credentialsPath) {
        // Local dev: load credentials from file path
        const resolvedPath = path.isAbsolute(credentialsPath)
          ? credentialsPath
          : path.resolve(__dirname, credentialsPath);

        try {
          const serviceAccount = require(resolvedPath);
          admin.initializeApp({
            credential: admin.cert(serviceAccount),
            projectId
          });
        } catch (credErr) {
          console.warn('Failed to load Firestore service account credentials:', credErr.message);
          admin.initializeApp({ projectId });
        }
      } else if (projectId) {
        admin.initializeApp({ projectId });
      }
    }

    const activeApp = admin.getApps().length ? admin.getApp() : null;
    return activeApp ? getAdminFirestore(activeApp) : null;
  } catch (err) {
    console.warn('Firestore initialization failed:', err.message);
    return null;
  }
}

function normalizeFirestoreValue(value) {
  if (value === SERVER_TIMESTAMP_SENTINEL) {
    return FirestoreFieldValue.serverTimestamp();
  }
  if (value === DELETE_SENTINEL) {
    return FirestoreFieldValue.delete();
  }
  if (value && typeof value === 'object' && value.__op === 'increment') {
    return FirestoreFieldValue.increment(value.value);
  }
  if (value && typeof value === 'object' && value.__op === 'arrayUnion') {
    return FirestoreFieldValue.arrayUnion(...(value.elements || []));
  }
  if (value && typeof value === 'object' && value.__op === 'arrayRemove') {
    return FirestoreFieldValue.arrayRemove(...(value.elements || []));
  }
  if (Array.isArray(value)) {
    return value.map(normalizeFirestoreValue);
  }
  if (value && typeof value === 'object') {
    const normalized = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      normalized[key] = normalizeFirestoreValue(nestedValue);
    }
    return normalized;
  }
  return value;
}

const FieldValue = {
  serverTimestamp: () => SERVER_TIMESTAMP_SENTINEL,
  delete: () => DELETE_SENTINEL,
  increment: (n) => ({ __op: 'increment', value: n }),
  arrayUnion: (...elements) => ({ __op: 'arrayUnion', elements }),
  arrayRemove: (...elements) => ({ __op: 'arrayRemove', elements })
};

function generateId() {
  return crypto.randomBytes(10).toString('hex');
}

class DocumentSnapshot {
  constructor(id, data, exists = true, ref = null) {
    this.id = String(id);
    this._data = data;
    this.exists = Boolean(exists);
    this.ref = ref;
  }

  data() {
    return this._data ? JSON.parse(JSON.stringify(this._data)) : undefined;
  }
}

class QuerySnapshot {
  constructor(docs = []) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }

  forEach(callback) {
    this.docs.forEach(callback);
  }
}

class DocumentReference {
  constructor(collection, id) {
    this.collection = collection;
    this.id = String(id);
  }

  async get() {
    const firestore = this.collection.adapter.firestore;
    if (!firestore) {
      throw new Error('Firestore is not configured. Set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.');
    }

    const docSnap = await firestore.collection(this.collection.name).doc(this.id).get();
    if (!docSnap.exists) {
      return new DocumentSnapshot(this.id, null, false, this);
    }
    return new DocumentSnapshot(this.id, docSnap.data(), true, this);
  }

  async set(data, options = {}) {
    const firestore = this.collection.adapter.firestore;
    if (!firestore) {
      throw new Error('Firestore is not configured. Set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.');
    }

    const finalData = normalizeFirestoreValue(data);
    const docRef = firestore.collection(this.collection.name).doc(this.id);
    if (options.merge) {
      await docRef.set(finalData, { merge: true });
    } else {
      await docRef.set(finalData);
    }
    return { id: this.id };
  }

  async update(data) {
    const firestore = this.collection.adapter.firestore;
    if (!firestore) {
      throw new Error('Firestore is not configured. Set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.');
    }

    const finalData = {};
    for (const [key, value] of Object.entries(data || {})) {
      finalData[key] = normalizeFirestoreValue(value);
    }
    await firestore.collection(this.collection.name).doc(this.id).update(finalData);
    return { id: this.id };
  }

  async delete() {
    const firestore = this.collection.adapter.firestore;
    if (!firestore) {
      throw new Error('Firestore is not configured. Set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.');
    }

    await firestore.collection(this.collection.name).doc(this.id).delete();
    return { id: this.id };
  }
}

class CollectionReference {
  constructor(adapter, name) {
    this.adapter = adapter;
    this.name = name;
    this._wheres = [];
    this._orderBy = null;
    this._limit = null;
  }

  _clone() {
    const clone = new CollectionReference(this.adapter, this.name);
    clone._wheres = [...this._wheres];
    clone._orderBy = this._orderBy ? { ...this._orderBy } : null;
    clone._limit = this._limit;
    return clone;
  }

  doc(id) {
    const docId = id !== undefined && id !== null && String(id).trim() !== '' ? String(id) : generateId();
    return new DocumentReference(this, docId);
  }

  where(field, op, val) {
    const clone = this._clone();
    clone._wheres.push({ field, op, val });
    return clone;
  }

  orderBy(field, dir = 'asc') {
    const clone = this._clone();
    clone._orderBy = { field, dir: String(dir).toLowerCase() === 'desc' ? 'desc' : 'asc' };
    return clone;
  }

  limit(n) {
    const clone = this._clone();
    clone._limit = Number(n);
    return clone;
  }

  async add(data) {
    const firestore = this.adapter.firestore;
    if (!firestore) {
      throw new Error('Firestore is not configured. Set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.');
    }

    const finalData = normalizeFirestoreValue(data || {});
    const ref = firestore.collection(this.name).doc();
    if (!finalData.created_at) {
      finalData.created_at = FirestoreFieldValue.serverTimestamp();
    }
    await ref.set(finalData);
    return ref;
  }

  async get() {
    const firestore = this.adapter.firestore;
    if (!firestore) {
      throw new Error('Firestore is not configured. Set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.');
    }

    let query = firestore.collection(this.name);

    for (const w of this._wheres) {
      if (w.op === '==' || w.op === '=') {
        query = query.where(w.field, '==', w.val);
      } else if (w.op === '!=') {
        query = query.where(w.field, '!=', w.val);
      } else if (w.op === '>=') {
        query = query.where(w.field, '>=', w.val);
      } else if (w.op === '<=') {
        query = query.where(w.field, '<=', w.val);
      } else if (w.op === 'in') {
        query = query.where(w.field, 'in', Array.isArray(w.val) ? w.val : [w.val]);
      }
    }

    if (this._orderBy) {
      query = query.orderBy(this._orderBy.field, this._orderBy.dir);
    }
    if (this._limit !== null && !Number.isNaN(this._limit)) {
      query = query.limit(this._limit);
    }

    const snap = await query.get();
    const docs = snap.docs.map(doc => new DocumentSnapshot(doc.id, doc.data(), true, new DocumentReference(this, doc.id)));
    return new QuerySnapshot(docs);
  }
}

class WriteBatch {
  constructor(adapter) {
    this.adapter = adapter;
    this.ops = [];
  }

  set(docRef, data, options = {}) {
    this.ops.push({ type: 'set', docRef, data, options });
    return this;
  }

  update(docRef, data) {
    this.ops.push({ type: 'update', docRef, data });
    return this;
  }

  delete(docRef) {
    this.ops.push({ type: 'delete', docRef });
    return this;
  }

  async commit() {
    if (!this.adapter.firestore) {
      throw new Error('Firestore is not configured. Set FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.');
    }

    for (const op of this.ops) {
      if (op.type === 'set') {
        await op.docRef.set(normalizeFirestoreValue(op.data), op.options);
      } else if (op.type === 'update') {
        await op.docRef.update(normalizeFirestoreValue(op.data));
      } else if (op.type === 'delete') {
        await op.docRef.delete();
      }
    }
  }
}

class MySQLFirestoreAdapter {
  constructor(config = {}) {
    this._collections = new Map();
    this.config = config;
    this.firestore = getFirestore();
  }

  settings() {
    // no-op
  }

  collection(name) {
    if (!this._collections.has(name)) {
      this._collections.set(name, new CollectionReference(this, name));
    }
    return this._collections.get(name);
  }

  batch() {
    return new WriteBatch(this);
  }

  async close() {
    // Firestore is managed by the SDK globally.
  }
}

module.exports = {
  MySQLFirestoreAdapter,
  FieldValue
};
