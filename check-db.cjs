const mysql = require('./server/node_modules/mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'buildtrack_db'
    });
    const [cas] = await conn.query('SELECT collection_name, document_id, document_data FROM buildtrack_documents WHERE collection_name = ? ORDER BY updated_at DESC LIMIT 5', ['cash_advances']);
    console.log('=== CASH ADVANCES ===');
    cas.forEach(r => console.log(r.document_id, r.document_data));

    const [notifs] = await conn.query('SELECT collection_name, document_id, document_data FROM buildtrack_documents WHERE collection_name = ? ORDER BY updated_at DESC LIMIT 5', ['notifications']);
    console.log('=== NOTIFICATIONS ===');
    notifs.forEach(r => console.log(r.document_id, r.document_data));

    const [tokens] = await conn.query('SELECT collection_name, document_id, document_data FROM buildtrack_documents WHERE collection_name = ?', ['worker_device_tokens']);
    console.log('=== DEVICE TOKENS ===');
    tokens.forEach(r => console.log(r.document_id, r.document_data));

    const [workers] = await conn.query('SELECT collection_name, document_id, document_data FROM buildtrack_documents WHERE collection_name = ?', ['workers']);
    console.log('=== MICO WORKER ===');
    workers.forEach(r => {
      const d = JSON.parse(r.document_data);
      if (d.full_name && d.full_name.includes('Mico')) {
        console.log('Mico worker doc:', r.document_id, JSON.stringify(d));
      }
    });

    await conn.end();
  } catch(e) {
    console.error('DB ERROR:', e.message);
  }
})();
