const mysql = require('mysql2/promise');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Auto-load .env if present
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
          process.env[key] = val.replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch (e) {}
}

// Sentinel objects for FieldValue
const SERVER_TIMESTAMP_SENTINEL = Symbol('SERVER_TIMESTAMP');
const DELETE_SENTINEL = Symbol('DELETE_FIELD');

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

function toMySQLDateTime(val) {
  if (!val) return null;
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function toMySQLDate(val) {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function processDataForSave(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(processDataForSave);

  const result = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === SERVER_TIMESTAMP_SENTINEL) {
      result[key] = new Date().toISOString();
    } else if (val === DELETE_SENTINEL) {
      // omit field
    } else if (val && typeof val === 'object' && val.__op === 'increment') {
      result[key] = val.value;
    } else if (val && typeof val === 'object' && val.__op === 'arrayUnion') {
      result[key] = val.elements;
    } else if (val && typeof val === 'object' && val.__op === 'arrayRemove') {
      result[key] = [];
    } else {
      result[key] = val;
    }
  }
  return result;
}

function mergeDocData(existing, incoming) {
  const result = { ...(existing || {}) };
  for (const [key, val] of Object.entries(incoming || {})) {
    if (val === DELETE_SENTINEL) {
      delete result[key];
    } else if (val === SERVER_TIMESTAMP_SENTINEL) {
      result[key] = new Date().toISOString();
    } else if (val && typeof val === 'object' && val.__op === 'increment') {
      result[key] = (Number(result[key]) || 0) + val.value;
    } else if (val && typeof val === 'object' && val.__op === 'arrayUnion') {
      const arr = Array.isArray(result[key]) ? [...result[key]] : [];
      for (const el of val.elements) {
        if (!arr.includes(el)) arr.push(el);
      }
      result[key] = arr;
    } else if (val && typeof val === 'object' && val.__op === 'arrayRemove') {
      const arr = Array.isArray(result[key]) ? [...result[key]] : [];
      result[key] = arr.filter(item => !val.elements.includes(item));
    } else {
      result[key] = val;
    }
  }
  return result;
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
    await this.collection._ensureTable();
    const [rows] = await this.collection.adapter.pool.query(
      `SELECT * FROM \`${this.collection.name}\` WHERE id = ? LIMIT 1`,
      [this.id]
    );

    if (rows.length === 0) {
      return new DocumentSnapshot(this.id, null, false, this);
    }

    const docData = this.collection._rowToDoc(rows[0]);
    return new DocumentSnapshot(this.id, docData, true, this);
  }

  async set(data, options = {}) {
    await this.collection._ensureTable();
    const existingSnap = await this.get();
    
    let finalData;
    if (options.merge && existingSnap.exists) {
      finalData = mergeDocData(existingSnap.data(), data);
    } else {
      finalData = processDataForSave(data);
    }
    finalData.id = this.id;

    await this.collection._upsertRow(this.id, finalData);
    return { id: this.id };
  }

  async update(data) {
    await this.collection._ensureTable();
    const existingSnap = await this.get();
    if (!existingSnap.exists) {
      throw new Error(`Document ${this.id} not found in ${this.collection.name}`);
    }

    const finalData = mergeDocData(existingSnap.data(), data);
    finalData.id = this.id;

    await this.collection._upsertRow(this.id, finalData);
    return { id: this.id };
  }

  async delete() {
    await this.collection._ensureTable();
    await this.collection.adapter.pool.query(
      `DELETE FROM \`${this.collection.name}\` WHERE id = ?`,
      [this.id]
    );
    return { id: this.id };
  }
}

class CollectionReference {
  constructor(adapter, name) {
    this.adapter = adapter;
    this.name = name;
    this._columns = null; // Map<name, type>
    this._wheres = [];
    this._orderBy = null;
    this._limit = null;
  }

  async _ensureTable() {
    if (this._columns) return;
    const pool = this.adapter.pool;
    
    try {
      const [cols] = await pool.query(`DESCRIBE \`${this.name}\``);
      this._columns = new Map(cols.map(c => [c.Field.toLowerCase(), c.Type.toLowerCase()]));
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS \`${this.name}\` (
            id VARCHAR(64) PRIMARY KEY,
            data JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        const [cols] = await pool.query(`DESCRIBE \`${this.name}\``);
        this._columns = new Map(cols.map(c => [c.Field.toLowerCase(), c.Type.toLowerCase()]));
      } else {
        throw err;
      }
    }
  }

  _rowToDoc(row) {
    let jsonDoc = {};
    if (row.data) {
      if (typeof row.data === 'string') {
        try { jsonDoc = JSON.parse(row.data); } catch (e) { jsonDoc = {}; }
      } else if (typeof row.data === 'object') {
        jsonDoc = { ...row.data };
      }
    }

    const doc = { ...jsonDoc };
    for (const [key, val] of Object.entries(row)) {
      if (key !== 'data' && val !== null && val !== undefined) {
        if (key === 'created_at' && doc.created_at) {
          // keep jsonDoc created_at
        } else {
          doc[key] = val;
        }
      }
    }
    doc.id = String(row.id);
    return doc;
  }

  async _upsertRow(id, docData) {
    await this._ensureTable();
    const columns = this._columns;
    const pool = this.adapter.pool;

    const rowValues = {
      id: String(id),
      data: JSON.stringify(docData)
    };

    for (const [key, val] of Object.entries(docData)) {
      const lower = key.toLowerCase();
      if (columns.has(lower) && lower !== 'id' && lower !== 'data') {
        const type = columns.get(lower);
        if (val === null || val === undefined) {
          rowValues[lower] = null;
        } else if (type.includes('timestamp') || type.includes('datetime')) {
          rowValues[lower] = toMySQLDateTime(val);
        } else if (type.includes('date') && !type.includes('datetime')) {
          rowValues[lower] = toMySQLDate(val);
        } else if (type.includes('int') || type.includes('decimal') || type.includes('float') || type.includes('double')) {
          const num = Number(val);
          rowValues[lower] = isNaN(num) ? null : num;
        } else if (type.includes('json')) {
          rowValues[lower] = typeof val === 'object' ? JSON.stringify(val) : String(val);
        } else {
          rowValues[lower] = typeof val === 'object' ? JSON.stringify(val) : String(val);
        }
      }
    }

    const colNames = Object.keys(rowValues);
    const placeholders = colNames.map(() => '?').join(', ');
    const updateClauses = colNames.filter(c => c !== 'id').map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
    const values = colNames.map(c => rowValues[c]);

    const sql = `
      INSERT INTO \`${this.name}\` (${colNames.map(c => `\`${c}\``).join(', ')})
      VALUES (${placeholders})
      ON DUPLICATE KEY UPDATE ${updateClauses}
    `;

    await pool.query(sql, values);
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
    clone._orderBy = { field, dir: String(dir).toLowerCase() === 'desc' ? 'DESC' : 'ASC' };
    return clone;
  }

  limit(n) {
    const clone = this._clone();
    clone._limit = Number(n);
    return clone;
  }

  _clone() {
    const clone = new CollectionReference(this.adapter, this.name);
    clone._columns = this._columns;
    clone._wheres = [...this._wheres];
    clone._orderBy = this._orderBy ? { ...this._orderBy } : null;
    clone._limit = this._limit;
    return clone;
  }

  async add(data) {
    const id = generateId();
    const finalData = processDataForSave(data);
    finalData.id = id;
    if (!finalData.created_at) {
      finalData.created_at = new Date().toISOString();
    }
    await this._upsertRow(id, finalData);
    return new DocumentReference(this, id);
  }

  async get() {
    await this._ensureTable();
    const pool = this.adapter.pool;
    const whereParts = [];
    const params = [];

    for (const w of this._wheres) {
      const lower = w.field.toLowerCase();
      const isCol = this._columns.has(lower);

      if (w.op === '==' || w.op === '=') {
        if (isCol) {
          whereParts.push(`(\`${lower}\` = ? OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.${w.field}')) = ?)`);
          params.push(String(w.val), String(w.val));
        } else {
          whereParts.push(`JSON_UNQUOTE(JSON_EXTRACT(data, '$.${w.field}')) = ?`);
          params.push(String(w.val));
        }
      } else if (w.op === '!=') {
        if (isCol) {
          whereParts.push(`(\`${lower}\` != ? AND (JSON_UNQUOTE(JSON_EXTRACT(data, '$.${w.field}')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.${w.field}')) != ?))`);
          params.push(String(w.val), String(w.val));
        } else {
          whereParts.push(`(JSON_UNQUOTE(JSON_EXTRACT(data, '$.${w.field}')) IS NULL OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.${w.field}')) != ?)`);
          params.push(String(w.val));
        }
      } else if (w.op === '>=') {
        if (isCol) {
          whereParts.push(`(\`${lower}\` >= ? OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.${w.field}')) >= ?)`);
          params.push(String(w.val), String(w.val));
        } else {
          whereParts.push(`JSON_UNQUOTE(JSON_EXTRACT(data, '$.${w.field}')) >= ?`);
          params.push(String(w.val));
        }
      } else if (w.op === '<=') {
        if (isCol) {
          whereParts.push(`(\`${lower}\` <= ? OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.${w.field}')) <= ?)`);
          params.push(String(w.val), String(w.val));
        } else {
          whereParts.push(`JSON_UNQUOTE(JSON_EXTRACT(data, '$.${w.field}')) <= ?`);
          params.push(String(w.val));
        }
      } else if (w.op === 'in') {
        const arr = Array.isArray(w.val) ? w.val : [w.val];
        if (arr.length === 0) {
          whereParts.push('1 = 0');
        } else {
          const placeholders = arr.map(() => '?').join(', ');
          if (isCol) {
            whereParts.push(`(\`${lower}\` IN (${placeholders}) OR JSON_UNQUOTE(JSON_EXTRACT(data, '$.${w.field}')) IN (${placeholders}))`);
            params.push(...arr.map(String), ...arr.map(String));
          } else {
            whereParts.push(`JSON_UNQUOTE(JSON_EXTRACT(data, '$.${w.field}')) IN (${placeholders})`);
            params.push(...arr.map(String));
          }
        }
      }
    }

    let sql = `SELECT * FROM \`${this.name}\``;
    if (whereParts.length > 0) {
      sql += ` WHERE ${whereParts.join(' AND ')}`;
    }

    if (this._orderBy) {
      const lower = this._orderBy.field.toLowerCase();
      if (this._columns.has(lower)) {
        sql += ` ORDER BY \`${lower}\` ${this._orderBy.dir}`;
      } else {
        sql += ` ORDER BY JSON_UNQUOTE(JSON_EXTRACT(data, '$.${this._orderBy.field}')) ${this._orderBy.dir}`;
      }
    }

    if (this._limit !== null && !isNaN(this._limit)) {
      sql += ` LIMIT ${this._limit}`;
    }

    const [rows] = await pool.query(sql, params);
    const docs = rows.map(r => {
      const docData = this._rowToDoc(r);
      const ref = new DocumentReference(this, r.id);
      return new DocumentSnapshot(r.id, docData, true, ref);
    });

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
    for (const op of this.ops) {
      if (op.type === 'set') {
        await op.docRef.set(op.data, op.options);
      } else if (op.type === 'update') {
        await op.docRef.update(op.data);
      } else if (op.type === 'delete') {
        await op.docRef.delete();
      }
    }
  }
}

class MySQLFirestoreAdapter {
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.DB_HOST || '127.0.0.1',
      user: config.user || process.env.DB_USER || 'root',
      password: config.password !== undefined ? config.password : (process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'root'),
      database: config.database || process.env.DB_NAME || 'buildtrack_db',
      port: Number(config.port || process.env.DB_PORT) || 3306,
      waitForConnections: true,
      connectionLimit: 15,
      dateStrings: true
    };
    this.pool = mysql.createPool(this.config);
    this._collections = new Map();
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
    await this.pool.end();
  }
}

module.exports = {
  MySQLFirestoreAdapter,
  FieldValue
};
