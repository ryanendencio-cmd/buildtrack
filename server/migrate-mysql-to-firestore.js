const mysql = require('mysql2/promise');
const { getFirestore, toFirestoreValue } = require('./mysql-adapter');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'buildtrack_db',
  port: Number(process.env.DB_PORT) || 3306
});

async function main() {
  const apply = process.argv.includes('--apply');
  const [collections] = await pool.query(
    `SELECT collection_name, COUNT(*) AS documents
     FROM buildtrack_documents
     GROUP BY collection_name
     ORDER BY collection_name`
  );
  const totalDocuments = collections.reduce((total, collection) => total + Number(collection.documents), 0);

  console.log(`Found ${collections.length} MySQL collections and ${totalDocuments} documents.`);
  for (const collection of collections) {
    console.log(`  ${collection.collection_name}: ${collection.documents}`);
  }

  if (!apply) {
    console.log('Dry run only; no data was written. Review the counts, then run with --apply to import.');
    return;
  }

  const firestore = getFirestore(true);
  let imported = 0;
  let skipped = 0;
  for (const collection of collections) {
    const [documents] = await pool.execute(
      `SELECT document_id, document_data
       FROM buildtrack_documents
       WHERE collection_name = ?
       ORDER BY document_id`,
      [collection.collection_name]
    );

    for (const document of documents) {
      try {
        await firestore.collection(collection.collection_name)
          .doc(document.document_id)
          .create(toFirestoreValue(JSON.parse(document.document_data)));
        imported += 1;
      } catch (error) {
        if (error.code === 6 || error.code === '6' || error.code === 'already-exists') {
          skipped += 1;
          continue;
        }
        throw error;
      }
    }
  }

  console.log(`Migration complete. Imported ${imported} documents; skipped ${skipped} existing Firestore documents.`);
}

main()
  .catch(error => {
    console.error('MySQL-to-Firestore migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
