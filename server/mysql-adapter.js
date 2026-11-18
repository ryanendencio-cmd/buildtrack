const admin = require('firebase-admin');
const {
  getFirestore: getAdminFirestore,
  FieldValue: FirebaseFieldValue,
  Timestamp
} = require('firebase-admin/firestore');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const mysql = require('mysql2/promise');

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
          process.env[key] = val.replace(/^['"]|['"]$/g, '');
        }
      }
    }
  } catch (error) {
    console.warn('Could not read server/.env:', error.message);
  }
}

const SERVER_TIMESTAMP_SENTINEL = Symbol('SERVER_TIMESTAMP');
const DELETE_SENTINEL = Symbol('DELETE_FIELD');
const TIMESTAMP_MARKER = '__buildtrack_timestamp_iso__';
const DOCUMENTS_TABLE = 'buildtrack_documents';
const OUTBOX_TABLE = 'buildtrack_firestore_outbox';

function getDatabaseType(type = process.env.DB_TYPE, nodeEnv = process.env.NODE_ENV) {
  const selectedType = String(type || (nodeEnv === 'production' ? 'firebase' : 'mysql'))
    .trim()
    .toLowerCase();
  if (selectedType !== 'mysql' && selectedType !== 'firebase') {
    throw new Error(`Unsupported DB_TYPE "${selectedType}". Use "mysql" or "firebase".`);
  }
  return selectedType;
}

function getFirestore(required = false) {
  try {
    if (!admin.getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

      if (!projectId) {
        if (required) throw new Error('Set FIREBASE_PROJECT_ID or GCLOUD_PROJECT.');
        return null;
      }

      if (projectId && serviceAccountJson) {
        admin.initializeApp({
          credential: admin.cert(JSON.parse(serviceAccountJson)),
          projectId
        });
      } else if (projectId && credentialsPath) {
        const resolvedPath = path.isAbsolute(credentialsPath)
          ? credentialsPath
          : path.resolve(__dirname, credentialsPath);

        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`Credential file not found: ${resolvedPath}`);
        }
        process.env.GOOGLE_APPLICATION_CREDENTIALS = resolvedPath;
        admin.initializeApp({ credential: admin.applicationDefault(), projectId });
      } else if (projectId) {
        admin.initializeApp({ projectId });
      }
    }

    return getAdminFirestore(admin.getApp());
  } catch (error) {
    if (required) {
      throw new Error(`Firebase initialization failed: ${error.message}`);
    }
    console.warn('Firestore initialization failed:', error.message);
    return null;
  }
}

function packValue(value) {
  if (value instanceof Date) {
    return { [TIMESTAMP_MARKER]: value.toISOString() };
  }
  if (value && typeof value.toDate === 'function') {
    return packValue(value.toDate());
  }
  if (Array.isArray(value)) {
    return value.map(packValue);
  }
  if (value && typeof value === 'object') {
    const packed = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      packed[key] = packValue(nestedValue);
    }
    return packed;
  }
  return value;
}

function unpackValue(value) {
  if (Array.isArray(value)) {
    return value.map(unpackValue);
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1 && typeof value[TIMESTAMP_MARKER] === 'string') {
      const date = new Date(value[TIMESTAMP_MARKER]);
      const milliseconds = date.getTime();
      if (!Number.isNaN(milliseconds)) {
        const seconds = Math.floor(milliseconds / 1000);
        return { _seconds: seconds, _nanoseconds: (milliseconds - seconds * 1000) * 1000000 };
      }
    }
    const unpacked = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      unpacked[key] = unpackValue(nestedValue);
    }
    return unpacked;
  }
  return value;
}

function toFirestoreValue(value) {
  if (Array.isArray(value)) {
    return value.map(toFirestoreValue);
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 1 && typeof value[TIMESTAMP_MARKER] === 'string') {
      return Timestamp.fromDate(new Date(value[TIMESTAMP_MARKER]));
    }
    const converted = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      converted[key] = toFirestoreValue(nestedValue);
    }
    return converted;
  }
  return value;
}

function timestampMilliseconds(value) {
  if (value && typeof value === 'object' && typeof value._seconds === 'number') {
    return value._seconds * 1000 + (Number(value._nanoseconds) || 0) / 1000000;
  }
  if (value instanceof Date) return value.getTime();
  return null;
}

function dateMilliseconds(value) {
  const timestamp = timestampMilliseconds(value);
  if (timestamp !== null) return timestamp;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
    const milliseconds = new Date(value).getTime();
    return Number.isNaN(milliseconds) ? null : milliseconds;
  }
  return null;
}

function getFieldValue(document, field) {
  return String(field).split('.').reduce((value, part) => (
    value && typeof value === 'object' ? value[part] : undefined
  ), document);
}

function compareValues(left, right) {
  const leftTime = dateMilliseconds(left);
  const rightTime = dateMilliseconds(right);
  if (leftTime !== null && rightTime !== null) return leftTime - rightTime;
  if (left == null || right == null) return left == null ? (right == null ? 0 : -1) : 1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

function matchesWhere(document, condition) {
  const actual = getFieldValue(document, condition.field);
  const expected = condition.value;
  if (condition.operation === '==' || condition.operation === '=') {
    return isDeepStrictEqual(actual, expected);
  }
  if (condition.operation === '!=') {
    return actual !== undefined && !isDeepStrictEqual(actual, expected);
  }
  if (condition.operation === '>=') return actual !== undefined && compareValues(actual, expected) >= 0;
  if (condition.operation === '<=') return actual !== undefined && compareValues(actual, expected) <= 0;
  if (condition.operation === 'in') {
    return Array.isArray(expected) && expected.some(item => isDeepStrictEqual(actual, item));
  }
  throw new Error(`Unsupported query operator: ${condition.operation}`);
}

function resolveWriteValue(value, existingValue) {
  if (value === SERVER_TIMESTAMP_SENTINEL) return new Date();
  if (value === DELETE_SENTINEL) return DELETE_SENTINEL;
  if (Array.isArray(value)) return value.map(item => resolveWriteValue(item));
  if (value && typeof value === 'object') {
    if (value.__op === 'increment') {
      return (typeof existingValue === 'number' ? existingValue : 0) + Number(value.value);
    }
    if (value.__op === 'arrayUnion') {
      const result = Array.isArray(existingValue) ? [...existingValue] : [];
      for (const element of value.elements || []) {
        const resolved = resolveWriteValue(element);
        if (!result.some(item => isDeepStrictEqual(item, resolved))) result.push(resolved);
      }
      return result;
    }
    if (value.__op === 'arrayRemove') {
      const removed = value.elements || [];
      return (Array.isArray(existingValue) ? existingValue : [])
        .filter(item => !removed.some(element => isDeepStrictEqual(item, element)));
    }
    const resolved = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      const result = resolveWriteValue(nestedValue, existingValue && existingValue[key]);
      resolved[key] = result;
    }
    return resolved;
  }
  return value;
}

function mergeObjects(current, update) {
  const merged = { ...(current || {}) };
  for (const [key, value] of Object.entries(update || {})) {
    if (value === DELETE_SENTINEL) {
      delete merged[key];
    } else if (
      value && typeof value === 'object' && !Array.isArray(value) &&
      !(value instanceof Date) && current && current[key] &&
      typeof current[key] === 'object' && !Array.isArray(current[key])
    ) {
      merged[key] = mergeObjects(current[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

const MySQLFieldValue = {
  serverTimestamp: () => SERVER_TIMESTAMP_SENTINEL,
  delete: () => DELETE_SENTINEL,
  increment: value => ({ __op: 'increment', value }),
  arrayUnion: (...elements) => ({ __op: 'arrayUnion', elements }),
  arrayRemove: (...elements) => ({ __op: 'arrayRemove', elements })
};
const FieldValue = getDatabaseType() === 'firebase' ? FirebaseFieldValue : MySQLFieldValue;

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
    return this._data === undefined ? undefined : JSON.parse(JSON.stringify(this._data));
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
    return this.collection.adapter._getDocument(this.collection.name, this.id, this);
  }

  async set(data, options = {}) {
    await this.collection.adapter._write(this.collection.name, this.id, 'set', data, options);
    return { id: this.id };
  }

  async update(data) {
    await this.collection.adapter._write(this.collection.name, this.id, 'update', data);
    return { id: this.id };
  }

  async delete() {
    await this.collection.adapter._write(this.collection.name, this.id, 'delete');
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

  where(field, operation, value) {
    const supported = new Set(['==', '=', '!=', '>=', '<=', 'in']);
    if (!supported.has(operation)) throw new Error(`Unsupported query operator: ${operation}`);
    const clone = this._clone();
    clone._wheres.push({ field, operation, value });
    return clone;
  }

  orderBy(field, direction = 'asc') {
    const clone = this._clone();
    clone._orderBy = {
      field,
      direction: String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc'
    };
    return clone;
  }

  limit(count) {
    const value = Number(count);
    if (!Number.isInteger(value) || value < 0) throw new Error('Query limit must be a non-negative integer.');
    const clone = this._clone();
    clone._limit = value;
    return clone;
  }

  async add(data) {
    const reference = this.doc();
    await reference.set({
      ...(data || {}),
      ...(!(data && data.created_at) ? { created_at: FieldValue.serverTimestamp() } : {})
    });
    return reference;
  }

  async get() {
    await this.adapter.ready;
    const [rows] = await this.adapter.pool.execute(
      `SELECT document_id, document_data FROM ${DOCUMENTS_TABLE} WHERE collection_name = ?`,
      [this.name]
    );
    let documents = rows.map(row => ({
      id: row.document_id,
      data: unpackValue(JSON.parse(row.document_data))
    }));

    for (const condition of this._wheres) {
      documents = documents.filter(item => matchesWhere(item.data, condition));
    }

    if (this._orderBy) {
      const { field, direction } = this._orderBy;
      documents.sort((left, right) => {
        const result = compareValues(getFieldValue(left.data, field), getFieldValue(right.data, field));
        return direction === 'desc' ? -result : result;
      });
    }
    if (this._limit !== null) documents = documents.slice(0, this._limit);

    return new QuerySnapshot(documents.map(item => new DocumentSnapshot(
      item.id,
      item.data,
      true,
      new DocumentReference(this, item.id)
    )));
  }
}

class WriteBatch {
  constructor(adapter) {
    this.adapter = adapter;
    this.operations = [];
  }

  set(reference, data, options = {}) {
    this.operations.push({ type: 'set', reference, data, options });
    return this;
  }

  update(reference, data) {
    this.operations.push({ type: 'update', reference, data });
    return this;
  }

  delete(reference) {
    this.operations.push({ type: 'delete', reference });
    return this;
  }

  async commit() {
    await this.adapter._withTransaction(async connection => {
      for (const operation of this.operations) {
        await this.adapter._writeOnConnection(
          connection,
          operation.reference.collection.name,
          operation.reference.id,
          operation.type,
          operation.data,
          operation.options
        );
      }
    });
    this.adapter._scheduleMirror();
  }
}

class FirebaseDatabaseAdapter {
  constructor(firestore) {
    this.firestore = firestore;
    this.ready = Promise.resolve();
  }

  settings(options) {
    return this.firestore.settings(options);
  }

  collection(name) {
    return this.firestore.collection(name);
  }

  batch() {
    return this.firestore.batch();
  }

  runTransaction(callback, options) {
    return this.firestore.runTransaction(callback, options);
  }

  close() {
    return this.firestore.terminate();
  }
}

class MySQLFirestoreAdapter {
  constructor(config = {}) {
    const type = getDatabaseType(config.type);
    if (type === 'firebase') {
      return new FirebaseDatabaseAdapter(
        config.firestore || getFirestore(true)
      );
    }

    this.pool = config.pool || mysql.createPool({
      host: config.host || '127.0.0.1',
      user: config.user || 'root',
      password: config.password === undefined ? '' : config.password,
      database: config.database || 'buildtrack_db',
      port: Number(config.port) || 3306,
      waitForConnections: true,
      connectionLimit: Number(config.connectionLimit) || 10,
      queueLimit: 0,
      charset: 'utf8mb4'
    });
    this.firestore = Object.prototype.hasOwnProperty.call(config, 'firestore')
      ? config.firestore
      : getFirestore();
    this._collections = new Map();
    this._mirrorRunning = false;
    this._mirrorInterval = null;
    this.ready = this._initialize().then(() => {
      this._mirrorInterval = setInterval(() => {
        this.flushOutbox().catch(error => console.error('Firestore outbox retry failed:', error.message));
      }, 5000);
      this._mirrorInterval.unref();
    });
  }

  async _initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${DOCUMENTS_TABLE} (
        collection_name VARCHAR(128) NOT NULL,
        document_id VARCHAR(191) NOT NULL,
        document_data LONGTEXT NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (collection_name, document_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ${OUTBOX_TABLE} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        collection_name VARCHAR(128) NOT NULL,
        document_id VARCHAR(191) NOT NULL,
        operation VARCHAR(16) NOT NULL,
        payload LONGTEXT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        synced_at DATETIME(3) NULL,
        attempts INT UNSIGNED NOT NULL DEFAULT 0,
        last_error TEXT NULL,
        PRIMARY KEY (id),
        KEY idx_buildtrack_outbox_pending (synced_at, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    if (!this.firestore) {
      console.warn('Firestore mirroring is disabled: configure FIREBASE_PROJECT_ID and Firebase credentials to enable it.');
    }
  }

  settings() {}

  collection(name) {
    if (!this._collections.has(name)) {
      this._collections.set(name, new CollectionReference(this, name));
    }
    return this._collections.get(name);
  }

  batch() {
    return new WriteBatch(this);
  }

  async _getDocument(collectionName, documentId, reference, connection = null) {
    await this.ready;
    const executor = connection || this.pool;
    const [rows] = await executor.execute(
      `SELECT document_data FROM ${DOCUMENTS_TABLE} WHERE collection_name = ? AND document_id = ?`,
      [collectionName, documentId]
    );
    if (!rows.length) return new DocumentSnapshot(documentId, undefined, false, reference);
    return new DocumentSnapshot(
      documentId,
      unpackValue(JSON.parse(rows[0].document_data)),
      true,
      reference
    );
  }

  async _write(collectionName, documentId, operation, data, options = {}) {
    await this._withTransaction(connection => this._writeOnConnection(
      connection,
      collectionName,
      documentId,
      operation,
      data,
      options
    ));
    this._scheduleMirror();
  }

  async _writeOnConnection(connection, collectionName, documentId, operation, data, options = {}) {
    const [rows] = await connection.execute(
      `SELECT document_data FROM ${DOCUMENTS_TABLE} WHERE collection_name = ? AND document_id = ? FOR UPDATE`,
      [collectionName, documentId]
    );
    const exists = rows.length > 0;
    const current = exists ? unpackValue(JSON.parse(rows[0].document_data)) : {};

    if (operation === 'delete') {
      await connection.execute(
        `DELETE FROM ${DOCUMENTS_TABLE} WHERE collection_name = ? AND document_id = ?`,
        [collectionName, documentId]
      );
      await this._enqueueMirror(connection, collectionName, documentId, 'delete', null);
      return;
    }
    if (operation === 'update' && !exists) {
      throw new Error(`Cannot update missing document ${collectionName}/${documentId}.`);
    }

    const resolved = resolveWriteValue(data || {}, current);
    const next = operation === 'update' || options.merge
      ? mergeObjects(current, resolved)
      : mergeObjects({}, resolved);
    const serialized = JSON.stringify(packValue(next));
    await connection.execute(
      `INSERT INTO ${DOCUMENTS_TABLE} (collection_name, document_id, document_data)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE document_data = VALUES(document_data)`,
      [collectionName, documentId, serialized]
    );
    await this._enqueueMirror(connection, collectionName, documentId, 'set', serialized);
  }

  async _enqueueMirror(connection, collectionName, documentId, operation, payload) {
    await connection.execute(
      `INSERT INTO ${OUTBOX_TABLE} (collection_name, document_id, operation, payload)
       VALUES (?, ?, ?, ?)`,
      [collectionName, documentId, operation, payload]
    );
  }

  async _withTransaction(callback) {
    await this.ready;
    const connection = await this.pool.getConnection();
    let lockAcquired = false;
    try {
      const [lockRows] = await connection.query("SELECT GET_LOCK('buildtrack_document_transaction', 10) AS acquired");
      if (Number(lockRows[0].acquired) !== 1) {
        throw new Error('Could not acquire the database transaction lock.');
      }
      lockAcquired = true;
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      if (lockAcquired) {
        await connection.query("SELECT RELEASE_LOCK('buildtrack_document_transaction')");
      }
      connection.release();
    }
  }

  async runTransaction(callback) {
    let wrote = false;
    const transaction = {
      get: async reference => this._getDocument(
        reference.collection.name,
        reference.id,
        reference,
        transaction.connection
      ),
      set: async (reference, data, options = {}) => {
        await this._writeOnConnection(
          transaction.connection,
          reference.collection.name,
          reference.id,
          'set',
          data,
          options
        );
        wrote = true;
      },
      update: async (reference, data) => {
        await this._writeOnConnection(
          transaction.connection,
          reference.collection.name,
          reference.id,
          'update',
          data
        );
        wrote = true;
      },
      delete: async reference => {
        await this._writeOnConnection(
          transaction.connection,
          reference.collection.name,
          reference.id,
          'delete'
        );
        wrote = true;
      }
    };

    const result = await this._withTransaction(async connection => {
      transaction.connection = connection;
      return callback(transaction);
    });
    if (wrote) this._scheduleMirror();
    return result;
  }

  _scheduleMirror() {
    if (this.firestore) {
      setImmediate(() => {
        this.flushOutbox().catch(error => console.error('Firestore outbox sync failed:', error.message));
      });
    }
  }

  async flushOutbox() {
    await this.ready;
    if (!this.firestore || this._mirrorRunning) return;
    this._mirrorRunning = true;
    try {
      while (true) {
        const [rows] = await this.pool.query(
          `SELECT id, collection_name, document_id, operation, payload
           FROM ${OUTBOX_TABLE}
           WHERE synced_at IS NULL
           ORDER BY id
           LIMIT 100`
        );
        if (!rows.length) return;

        for (const row of rows) {
          try {
            const reference = this.firestore.collection(row.collection_name).doc(row.document_id);
            if (row.operation === 'delete') {
              await reference.delete();
            } else {
              await reference.set(toFirestoreValue(JSON.parse(row.payload)));
            }
            await this.pool.execute(
              `UPDATE ${OUTBOX_TABLE} SET synced_at = CURRENT_TIMESTAMP(3), attempts = attempts + 1, last_error = NULL WHERE id = ?`,
              [row.id]
            );
          } catch (error) {
            await this.pool.execute(
              `UPDATE ${OUTBOX_TABLE} SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
              [String(error.message).slice(0, 4000), row.id]
            );
            console.error(
              `Firestore mirror failed for ${row.collection_name}/${row.document_id}; it will be retried:`,
              error.message
            );
            return;
          }
        }
      }
    } finally {
      this._mirrorRunning = false;
    }
  }

  async importDocuments(collectionName, documents) {
    await this.ready;
    let imported = 0;
    for (let offset = 0; offset < documents.length; offset += 100) {
      const chunk = documents.slice(offset, offset + 100);
      await this._withTransaction(async connection => {
        for (const document of chunk) {
          const serialized = JSON.stringify(packValue(document.data));
          const [result] = await connection.execute(
            `INSERT IGNORE INTO ${DOCUMENTS_TABLE} (collection_name, document_id, document_data)
             VALUES (?, ?, ?)`,
            [collectionName, String(document.id), serialized]
          );
          imported += result.affectedRows;
        }
      });
    }
    return { imported, skipped: documents.length - imported };
  }

  async countDocuments() {
    await this.ready;
    const [rows] = await this.pool.query(`SELECT COUNT(*) AS count FROM ${DOCUMENTS_TABLE}`);
    return Number(rows[0].count);
  }

  async close() {
    clearInterval(this._mirrorInterval);
    await this.pool.end();
  }
}

module.exports = {
  MySQLFirestoreAdapter,
  FieldValue,
  getDatabaseType,
  getFirestore,
  toFirestoreValue
};
