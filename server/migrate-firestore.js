const { MySQLFirestoreAdapter } = require('./mysql-adapter');

const db = new MySQLFirestoreAdapter({
  type: 'mysql',
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'buildtrack_db',
  port: Number(process.env.DB_PORT) || 3306
});

async function main() {
  await db.ready;
  if (!db.firestore) {
    throw new Error('Firestore is not configured. Set FIREBASE_PROJECT_ID and Firebase credentials before migration.');
  }

  const apply = process.argv.includes('--apply');
  const collections = await db.firestore.listCollections();
  const migration = [];
  let totalDocuments = 0;

  for (const collection of collections) {
    const snapshot = await collection.get();
    migration.push({ name: collection.id, documents: snapshot.docs });
    totalDocuments += snapshot.size;
  }

  console.log(`Found ${migration.length} top-level Firestore collections and ${totalDocuments} documents.`);
  for (const collection of migration) {
    console.log(`  ${collection.name}: ${collection.documents.length}`);
  }

  if (!apply) {
    console.log('Dry run only; no data was written. Review the counts, then run with --apply to import.');
    return;
  }

  let imported = 0;
  let skipped = 0;
  for (const collection of migration) {
    const result = await db.importDocuments(collection.name, collection.documents.map(document => ({
      id: document.id,
      data: document.data()
    })));
    imported += result.imported;
    skipped += result.skipped;
  }

  console.log(`Migration complete. Imported ${imported} documents; skipped ${skipped} existing MySQL documents.`);
}

main()
  .catch(error => {
    console.error('Firestore migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.close();
  });
