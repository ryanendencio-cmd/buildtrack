const test = require('node:test');
const assert = require('node:assert/strict');
const { MySQLFirestoreAdapter, FieldValue } = require('./mysql-adapter');

class FakePool {
  constructor() {
    this.documents = new Map();
    this.outbox = [];
    this.nextOutboxId = 1;
  }

  key(collection, id) {
    return `${collection}\0${id}`;
  }

  async query(sql) {
    if (/^\s*CREATE TABLE/i.test(sql)) return [[], []];
    if (/SELECT COUNT\(\*\)/i.test(sql)) return [[{ count: this.documents.size }], []];
    if (/SELECT id, collection_name, document_id, operation, payload/i.test(sql)) {
      return [
        this.outbox.filter(item => item.synced_at === null).slice(0, 100).map(item => ({ ...item })),
        []
      ];
    }
    throw new Error(`Unexpected pool query: ${sql}`);
  }

  async execute(sql, parameters = []) {
    const statement = sql.trim();
    if (/^SELECT document_data FROM/i.test(statement)) {
      const row = this.documents.get(this.key(parameters[0], parameters[1]));
      return [row ? [{ document_data: row.document_data }] : [], []];
    }
    if (/^SELECT document_id, document_data FROM/i.test(statement)) {
      const collection = parameters[0];
      const rows = [...this.documents.entries()]
        .filter(([key]) => key.startsWith(`${collection}\0`))
        .map(([key, row]) => ({
          document_id: key.slice(collection.length + 1),
          document_data: row.document_data
        }));
      return [rows, []];
    }
    if (/^INSERT INTO buildtrack_documents/i.test(statement)) {
      const [collection, id, documentData] = parameters;
      this.documents.set(this.key(collection, id), { document_data: documentData });
      return [{ affectedRows: 1 }, []];
    }
    if (/^DELETE FROM buildtrack_documents/i.test(statement)) {
      const deleted = this.documents.delete(this.key(parameters[0], parameters[1]));
      return [{ affectedRows: deleted ? 1 : 0 }, []];
    }
    if (/^INSERT INTO buildtrack_firestore_outbox/i.test(statement)) {
      this.outbox.push({
        id: this.nextOutboxId++,
        collection_name: parameters[0],
        document_id: parameters[1],
        operation: parameters[2],
        payload: parameters[3],
        synced_at: null
      });
      return [{ affectedRows: 1 }, []];
    }
    if (/^UPDATE buildtrack_firestore_outbox SET synced_at/i.test(statement)) {
      const row = this.outbox.find(item => item.id === parameters[0]);
      row.synced_at = new Date();
      row.attempts += 1;
      row.last_error = null;
      return [{ affectedRows: row ? 1 : 0 }, []];
    }
    if (/^UPDATE buildtrack_firestore_outbox SET attempts/i.test(statement)) {
      const row = this.outbox.find(item => item.id === parameters[1]);
      row.attempts += 1;
      row.last_error = parameters[0];
      return [{ affectedRows: row ? 1 : 0 }, []];
    }
    throw new Error(`Unexpected pool execute: ${sql}`);
  }

  async getConnection() {
    return new FakeConnection(this);
  }

  async end() {}
}

class FakeConnection {
  constructor(pool) {
    this.pool = pool;
    this.snapshot = null;
  }

  async query(sql) {
    if (/GET_LOCK/i.test(sql)) return [[{ acquired: 1 }], []];
    if (/RELEASE_LOCK/i.test(sql)) return [[{ released: 1 }], []];
    throw new Error(`Unexpected connection query: ${sql}`);
  }

  execute(sql, parameters) {
    return this.pool.execute(sql, parameters);
  }

  async beginTransaction() {
    this.snapshot = {
      documents: new Map(this.pool.documents),
      outbox: this.pool.outbox.map(item => ({ ...item })),
      nextOutboxId: this.pool.nextOutboxId
    };
  }

  async commit() {
    this.snapshot = null;
  }

  async rollback() {
    if (!this.snapshot) return;
    this.pool.documents = this.snapshot.documents;
    this.pool.outbox = this.snapshot.outbox;
    this.pool.nextOutboxId = this.snapshot.nextOutboxId;
    this.snapshot = null;
  }

  release() {}
}

test('MySQL document operations preserve query, merge, transform, batch, and transaction behavior', async t => {
  const pool = new FakePool();
  const db = new MySQLFirestoreAdapter({ pool, firestore: null });
  t.after(() => db.close());
  await db.ready;

  const records = db.collection('records');
  const reference = records.doc('one');
  await reference.set({
    count: 1,
    created_at: FieldValue.serverTimestamp(),
    profile: { name: 'Ari', active: true }
  });
  await reference.set({ profile: { active: false } }, { merge: true });

  let document = (await reference.get()).data();
  assert.equal(document.count, 1);
  assert.equal(document.profile.name, 'Ari');
  assert.equal(document.profile.active, false);

  await reference.update({
    count: FieldValue.increment(2),
    profile: { name: FieldValue.delete() }
  });
  document = (await reference.get()).data();
  assert.equal(document.count, 3);
  assert.equal('name' in document.profile, false);
  assert.equal(typeof document.created_at._seconds, 'number');

  const query = await records.where('count', '>=', 3).limit(1).get();
  assert.equal(query.size, 1);
  assert.equal(query.docs[0].id, 'one');

  const batch = db.batch();
  batch.set(records.doc('two'), { count: 5 });
  batch.delete(reference);
  await batch.commit();
  assert.equal((await reference.get()).exists, false);
  assert.equal((await records.get()).size, 1);

  await assert.rejects(db.runTransaction(async transaction => {
    await transaction.update(records.doc('missing'), { count: 9 });
  }), /Cannot update missing document/);
  assert.equal(pool.outbox.length, 5);
});

test('Firestore mirror applies outbox events after MySQL commits', async t => {
  const pool = new FakePool();
  const mirrored = new Map();
  const firestore = {
    collection: collectionName => ({
      doc: documentId => ({
        set: async data => mirrored.set(`${collectionName}/${documentId}`, data),
        delete: async () => mirrored.delete(`${collectionName}/${documentId}`)
      })
    })
  };
  const db = new MySQLFirestoreAdapter({ pool, firestore });
  t.after(() => db.close());
  await db.ready;

  await db.collection('records').doc('mirror-me').set({ value: 'primary first' });
  await db.flushOutbox();

  assert.equal(mirrored.get('records/mirror-me').value, 'primary first');
  assert.ok(pool.outbox[0].synced_at);
});
