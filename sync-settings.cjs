const mysql = require('mysql2/promise');

async function checkSettings() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'root',
    database: 'buildtrack_db',
    port: 3306
  });

  const [rows] = await pool.query("SELECT * FROM settings WHERE id = 'attendance'");
  console.log('Current attendance settings in DB:', rows[0]);

  // Ensure standard fields exist in JSON data
  const data = rows.length > 0 && rows[0].data 
    ? (typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data)
    : {};

  const updatedData = {
    auto_schedule: true,
    open_time: data.open_time || data.terminal_open || '07:00',
    close_time: data.close_time || data.terminal_close || '17:30',
    auto_sundays_off: data.auto_sundays_off !== false,
    manual_override: data.manual_override || null
  };

  await pool.query(
    "INSERT INTO settings (id, data, updated_at) VALUES ('attendance', ?, NOW()) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()",
    [JSON.stringify(updatedData)]
  );
  console.log('Verified & synced attendance settings:', updatedData);

  await pool.end();
}

checkSettings().catch(console.error);

