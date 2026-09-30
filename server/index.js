const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')
const bcrypt = require('bcrypt')

const app = express()
app.use(cors())
app.use(express.json())

// Step 1: Connect WITHOUT database first para makapag-create
const dbInit = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 3306,
  dateStrings: true,
  // Ginagamit natin yung Aiven/TiDB database kung merong nakaset na process.env.DB_NAME, kung wala fallback sa s_cons_db
  database: process.env.DB_NAME || null 
})

const DB_NAME = 's_cons_db'

const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    budget DECIMAL(15,2) DEFAULT 0,
    progress INT DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS budget_additions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    note VARCHAR(255),
    date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    project VARCHAR(255),
    category VARCHAR(100),
    amount DECIMAL(15,2),
    receipt_no VARCHAR(100),
    date DATE,
    time TIME,
    items JSON,
    cash_tendered DECIMAL(15,2),
    \`change\` DECIMAL(15,2),
    image LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS workers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(255),
    birthday DATE,
    age INT,
    phone VARCHAR(20),
    address TEXT,
    role VARCHAR(100),
    position VARCHAR(100),
    daily_rate DECIMAL(10,2) DEFAULT 0,
    password VARCHAR(255),
    approval_status VARCHAR(50) DEFAULT 'Pending',
    status VARCHAR(50) DEFAULT 'Active',
    project_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    worker_id INT,
    worker_name VARCHAR(255),
    date DATE,
    status VARCHAR(50) DEFAULT 'Present',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Available',
    assigned_to VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    date DATE,
    name VARCHAR(255) NOT NULL,
    qty DECIMAL(10,2) DEFAULT 0,
    unit VARCHAR(50),
    cost DECIMAL(10,2) DEFAULT 0,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cash_advances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    workerName VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2),
    date DATE,
    reason VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS borrow_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    tool_name VARCHAR(255),
    borrower_name VARCHAR(255),
    quantity INT DEFAULT 1,
    action VARCHAR(50),
    condition_status VARCHAR(100),
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT,
    expense_id INT,
    link_type VARCHAR(50) DEFAULT 'General',
    title VARCHAR(255) NOT NULL,
    schedule_date DATE NOT NULL,
    assigned_to VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    home_address TEXT,
    address_obj LONGTEXT,
    role VARCHAR(100) DEFAULT 'Administrator',
    emp_id VARCHAR(50) DEFAULT 'SCON-ADMIN-001',
    dept VARCHAR(100) DEFAULT 'Management',
    assigned_project_site VARCHAR(255),
    terminal_id VARCHAR(50),
    push_notifications_enabled BOOLEAN DEFAULT true,
    biometric_login_enabled BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  );
`

dbInit.connect(err => {
  if (err) {
    console.error('Cannot connect to MySQL. Make sure XAMPP is running.', err.message)
    process.exit(1)
  }

  const initTables = () => {
    // Create all tables one by one
    const statements = CREATE_TABLES.split(';').map(s => s.trim()).filter(s => s.length > 0)
    let done = 0
    statements.forEach(sql => {
      dbInit.query(sql, (err) => {
        if (err) console.error('Table error:', err.message)
        done++
        if (done === statements.length) {
          // Ensure assets.borrow_at column exists (legacy migration)
          dbInit.query("SHOW COLUMNS FROM assets LIKE 'borrow_at'", (err, cols) => {
            if (!err && cols.length === 0) {
              dbInit.query("ALTER TABLE assets ADD COLUMN borrow_at DATETIME", () => { })
            }
          })
          dbInit.query("SHOW COLUMNS FROM expenses LIKE 'image'", (err, cols) => {
            if (!err && cols.length === 0) {
              dbInit.query('ALTER TABLE expenses ADD COLUMN image LONGTEXT', () => { })
            }
          })
          // Migrate new admin columns for existing databases
          const adminNewCols = [
            { col: 'phone', def: 'VARCHAR(20)' },
            { col: 'assigned_project_site', def: 'VARCHAR(255)' },
            { col: 'terminal_id', def: 'VARCHAR(50)' },
            { col: 'push_notifications_enabled', def: 'BOOLEAN DEFAULT true' },
            { col: 'biometric_login_enabled', def: 'BOOLEAN DEFAULT false' },
            { col: 'status', def: "VARCHAR(50) DEFAULT 'Active'" },
            { col: 'updated_at', def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
            { col: 'first_name', def: 'VARCHAR(100)' },
            { col: 'middle_name', def: 'VARCHAR(100)' },
            { col: 'last_name', def: 'VARCHAR(100)' },
            { col: 'home_address', def: 'TEXT' },
            { col: 'address_obj', def: 'LONGTEXT' },
            { col: 'role', def: "VARCHAR(100) DEFAULT 'Administrator'" },
            { col: 'emp_id', def: "VARCHAR(50) DEFAULT 'SCON-ADMIN-001'" },
            { col: 'dept', def: "VARCHAR(100) DEFAULT 'Management'" }
          ]
          adminNewCols.forEach(({ col, def }) => {
            dbInit.query(`SHOW COLUMNS FROM admins LIKE '${col}'`, (err, c) => {
              if (!err && c.length === 0) {
                dbInit.query(`ALTER TABLE admins ADD COLUMN ${col} ${def}`, () => { })
              }
            })
          })
          ;['start_time', 'end_time'].forEach(col => {
            dbInit.query(`SHOW COLUMNS FROM schedules LIKE '${col}'`, (err, c) => {
              if (!err && c.length > 0) {
                dbInit.query(`ALTER TABLE schedules DROP COLUMN ${col}`, () => { })
              }
            })
          })

          console.log('All tables ready.')

          // Seed default admin if none exists
          dbInit.query('SELECT COUNT(*) AS cnt FROM admins', async (err, rows) => {
            if (!err && rows[0].cnt === 0) {
              const defaultHash = await bcrypt.hash('admin123', 10)
              dbInit.query(
                "INSERT INTO admins (username, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?)",
                ['admin', 'admin@scons.com', defaultHash, 'System', 'Administrator', 'Administrator'],
                (err) => {
                  if (err) console.error('Failed to seed default admin:', err.message)
                  else console.log('Default admin created: username=admin, password=admin123')
                }
              )
            }
            ensureScheduleLinkColumns(dbInit, () => startServer(dbInit))
          })
        }
      })
    })
  }

  // Kung may DB_NAME galing Render/Aiven, direct na sa tables
  if (process.env.DB_NAME) {
    console.log(`Using Cloud Database: ${process.env.DB_NAME}`)
    initTables()
  } else {
    // Local fallback: Create database kung wala pa
    dbInit.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``, (err) => {
      if (err) { console.error('Failed to create database:', err.message); process.exit(1) }
      dbInit.query(`USE \`${DB_NAME}\``, (err) => {
        if (err) { console.error(err.message); process.exit(1) }
        console.log(`Database "${DB_NAME}" ready.`)
        initTables()
      })
    })
  }
})

function ensureScheduleLinkColumns(db, done) {
  const cols = [
    { col: 'expense_id', def: 'INT NULL' },
    { col: 'link_type', def: "VARCHAR(50) DEFAULT 'General'" }
  ]
  const step = (i) => {
    if (i >= cols.length) return done()
    const { col, def } = cols[i]
    db.query(`SHOW COLUMNS FROM schedules LIKE '${col}'`, (err, rows) => {
      if (err || rows.length > 0) return step(i + 1)
      db.query(`ALTER TABLE schedules ADD COLUMN ${col} ${def}`, (alterErr) => {
        if (alterErr) console.error('Schedule column error:', alterErr.message)
        step(i + 1)
      })
    })
  }
  step(0)
}

function scheduleLink(body) {
  const type = body.link_type === 'Project' || body.link_type === 'Transaction' ? body.link_type : 'General'
  return {
    type,
    projectId: type === 'Project' ? (body.project_id || null) : null,
    expenseId: type === 'Transaction' ? (body.expense_id || null) : null
  }
}

function startServer(db) {

  app.get('/api/schedules', (req, res) => {
    db.query(`SELECT s.*, p.name AS project_name, e.receipt_no AS expense_receipt, e.category AS expense_category
      FROM schedules s
      LEFT JOIN projects p ON p.id = s.project_id
      LEFT JOIN expenses e ON e.id = s.expense_id
      ORDER BY s.schedule_date, s.title`, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(rows)
    })
  })
  app.post('/api/schedules', (req, res) => {
    const { title, schedule_date, assigned_to, status, notes } = req.body
    const link = scheduleLink(req.body)
    db.query('INSERT INTO schedules (project_id, expense_id, link_type, title, schedule_date, assigned_to, status, notes) VALUES (?,?,?,?,?,?,?,?)', [link.projectId, link.expenseId, link.type, title, schedule_date, assigned_to || null, status || 'Scheduled', notes || null], (err, result) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ id: result.insertId, ...req.body, link_type: link.type, project_id: link.projectId, expense_id: link.expenseId })
    })
  })
  app.put('/api/schedules/:id', (req, res) => {
    const { title, schedule_date, assigned_to, status, notes } = req.body
    const link = scheduleLink(req.body)
    db.query('UPDATE schedules SET project_id=?, expense_id=?, link_type=?, title=?, schedule_date=?, assigned_to=?, status=?, notes=? WHERE id=?', [link.projectId, link.expenseId, link.type, title, schedule_date, assigned_to || null, status, notes || null, req.params.id], err => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ success: true })
    })
  })
  app.delete('/api/schedules/:id', (req, res) => {
    db.query('DELETE FROM schedules WHERE id=?', [req.params.id], err => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ success: true })
    })
  })

  // ── PROJECTS ──
  app.get('/api/projects', (req, res) => {
    db.query('SELECT * FROM projects', (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  })

  app.post('/api/projects', (req, res) => {
    const { name, location, budget, progress, start_date, end_date, status } = req.body
    const MAX_AMOUNT = 999999999999
    if (budget !== undefined && Number(budget) > MAX_AMOUNT) {
      return res.status(400).json({ error: 'Budget allocated cannot exceed ₱999,999,999,999.' })
    }
    db.query(
      'INSERT INTO projects (name, location, budget, progress, start_date, end_date, status) VALUES (?,?,?,?,?,?,?)',
      [name, location, budget, progress || 0, start_date, end_date, status || 'Active'],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ id: result.insertId, ...req.body })
      }
    )
  })

  app.put('/api/projects/:id', (req, res) => {
    const { name, location, budget, progress, start_date, end_date, status } = req.body
    const MAX_AMOUNT = 999999999999
    if (budget !== undefined && Number(budget) > MAX_AMOUNT) {
      return res.status(400).json({ error: 'Budget allocated cannot exceed ₱999,999,999,999.' })
    }
    db.query(
      'UPDATE projects SET name=?, location=?, budget=?, progress=?, start_date=?, end_date=?, status=? WHERE id=?',
      [name, location, budget, progress, start_date, end_date, status, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true })
      }
    )
  })

  app.delete('/api/projects/:id', (req, res) => {
    db.query('DELETE FROM projects WHERE id=?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ success: true })
    })
  })

  app.get('/api/projects/:id/budget-additions', (req, res) => {
    db.query(
      'SELECT * FROM budget_additions WHERE project_id=? ORDER BY date DESC, id DESC',
      [req.params.id],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(rows)
      }
    )
  })

  app.post('/api/projects/:id/budget-additions', (req, res) => {
    const MAX_AMOUNT = 999999999999
    const amount = Number(req.body.amount)
    const note = String(req.body.note || '').trim().slice(0, 255)
    const date = req.body.date || new Date().toISOString().slice(0, 10)

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid budget amount.' })
    }

    db.query('SELECT id, name, budget FROM projects WHERE id=?', [req.params.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!rows.length) return res.status(404).json({ error: 'Project not found.' })

      const current = Number(rows[0].budget) || 0
      const next = Math.round((current + amount) * 100) / 100
      if (next > MAX_AMOUNT) {
        return res.status(400).json({ error: 'Budget allocated cannot exceed ₱999,999,999,999.' })
      }

      db.query(
        'INSERT INTO budget_additions (project_id, amount, note, date) VALUES (?,?,?,?)',
        [req.params.id, amount, note || null, date],
        (err2, result) => {
          if (err2) return res.status(500).json({ error: err2.message })
          db.query('UPDATE projects SET budget=? WHERE id=?', [next, req.params.id], (err3) => {
            if (err3) return res.status(500).json({ error: err3.message })
            res.json({
              id: result.insertId,
              project_id: Number(req.params.id),
              project_name: rows[0].name,
              amount,
              note: note || null,
              date,
              previous_budget: current,
              budget: next
            })
          })
        }
      )
    })
  })

  // ── EXPENSES ──
  app.get('/api/expenses', (req, res) => {
    db.query('SELECT * FROM expenses ORDER BY created_at DESC', (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  })

  // Monthly totals for graphs — MUST be before /:project_id
  app.get('/api/expenses/monthly', (req, res) => {
    const year = new Date().getFullYear()
    db.query(
      'SELECT MONTH(date) as month, SUM(amount) as total FROM expenses WHERE YEAR(date)=? GROUP BY MONTH(date)',
      [year],
      (err, results) => {
        if (err) return res.status(500).json({ error: err.message })
        const months = Array(12).fill(0)
        results.forEach(r => { months[r.month - 1] = Number(r.total) })
        res.json(months)
      }
    )
  })

  // Budget summary for Hero Card
  app.get('/api/expenses/budget-summary', (req, res) => {
    db.query('SELECT SUM(budget) as totalBudget FROM projects', (err, budgetRes) => {
      if (err) return res.status(500).json({ error: err.message })
      db.query('SELECT SUM(amount) as totalSpent FROM expenses', (err, spentRes) => {
        if (err) return res.status(500).json({ error: err.message })
        db.query('SELECT category, SUM(amount) as total FROM expenses GROUP BY category', (err, catRes) => {
          if (err) return res.status(500).json({ error: err.message })
          const totalBudget = Number(budgetRes[0].totalBudget) || 0
          const totalSpent = Number(spentRes[0].totalSpent) || 0
          res.json({
            totalBudget,
            totalSpent,
            remaining: totalBudget - totalSpent,
            percent: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
            categories: catRes
          })
        })
      })
    })
  })

  // Summary for Dashboard — MUST be before /api/expenses/:project_id
  app.get('/api/expenses/summary', (req, res) => {
    db.query('SELECT SUM(amount) as total FROM expenses', (err, totals) => {
      if (err) return res.status(500).json({ error: err.message })
      db.query('SELECT category, amount, date FROM expenses ORDER BY created_at DESC LIMIT 5', (err, recent) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ total: totals[0].total || 0, recent })
      })
    })
  })

  // Parameterized route — MUST be after all specific /expenses/* routes
  app.get('/api/expenses/:project_id', (req, res) => {
    db.query('SELECT * FROM expenses WHERE project_id=? ORDER BY date DESC', [req.params.project_id], (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  })

  app.post('/api/expenses', (req, res) => {
    const { project_id, project, category, amount, receipt_no, date, time, items, cash_tendered, change, image } = req.body
    db.query(
      'INSERT INTO expenses (project_id, project, category, amount, receipt_no, date, time, items, cash_tendered, `change`, image) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [project_id, project, category, amount, receipt_no, date, time, JSON.stringify(items), cash_tendered, change, image || null],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ id: result.insertId, ...req.body })
      }
    )
  })

  app.put('/api/expenses/:id', (req, res) => {
    const { category, amount, receipt_no, date, time, items, cash_tendered, change, image } = req.body
    db.query(
      'UPDATE expenses SET category=?, amount=?, receipt_no=?, date=?, time=?, items=?, cash_tendered=?, `change`=?, image=COALESCE(?, image) WHERE id=?',
      [category, amount, receipt_no, date, time, typeof items === 'string' ? items : JSON.stringify(items || []), cash_tendered, change, image || null, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true })
      }
    )
  })

  app.delete('/api/expenses/:id', (req, res) => {
    db.query('DELETE FROM expenses WHERE id=?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ success: true })
    })
  })

  // ── REPORTS ──
  app.get('/api/reports/expenses', (req, res) => {
    const { project_id, month } = req.query
    const [year, mon] = month ? month.split('-') : [null, null]
    let sql = 'SELECT e.*, p.budget FROM expenses e LEFT JOIN projects p ON e.project_id = p.id WHERE 1=1'
    const params = []
    if (project_id && project_id !== 'ALL') { sql += ' AND e.project_id=?'; params.push(project_id) }
    if (year && mon) { sql += ' AND YEAR(e.date)=? AND MONTH(e.date)=?'; params.push(year, parseInt(mon)) }
    sql += ' ORDER BY e.date DESC'
    db.query(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      const totalSpent = rows.reduce((s, r) => s + Number(r.amount), 0)
      // Get budget for selected project(s)
      const budgetSql = project_id && project_id !== 'ALL'
        ? 'SELECT budget FROM projects WHERE id=?'
        : 'SELECT SUM(budget) as budget FROM projects'
      db.query(budgetSql, project_id && project_id !== 'ALL' ? [project_id] : [], (err2, bRes) => {
        const budget = Number(bRes?.[0]?.budget || 0)
        res.json({ totalSpent, budget, remaining: budget - totalSpent, rows })
      })
    })
  })

  app.get('/api/reports/manpower', (req, res) => {
    const { project_id, month } = req.query
    const [year, mon] = month ? month.split('-') : [null, null]
    let sql = 'SELECT a.*, w.role, w.daily_rate FROM attendance a LEFT JOIN workers w ON a.worker_id = w.id WHERE 1=1'
    const params = []
    if (project_id && project_id !== 'ALL') { sql += ' AND a.project_id=?'; params.push(project_id) }
    if (year && mon) { sql += ' AND YEAR(a.date)=? AND MONTH(a.date)=?'; params.push(year, parseInt(mon)) }
    sql += ' ORDER BY a.date DESC'
    db.query(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      const present = rows.filter(r => r.status === 'Present').length
      const absent = rows.filter(r => r.status === 'Absent').length
      const totalWage = rows.filter(r => r.status === 'Present').reduce((s, r) => s + Number(r.daily_rate || 0), 0)
      res.json({ present, absent, totalWage, rows })
    })
  })

  app.get('/api/reports/materials', (req, res) => {
    const { project_id } = req.query
    let sql = 'SELECT m.*, p.name as project_name FROM materials m LEFT JOIN projects p ON m.project_id = p.id WHERE 1=1'
    const params = []
    if (project_id && project_id !== 'ALL') { sql += ' AND m.project_id=?'; params.push(project_id) }
    db.query(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      const totalCost = rows.reduce((s, r) => s + (Number(r.quantity) * Number(r.unit_cost)), 0)
      res.json({ totalCost, itemCount: rows.length, rows })
    })
  })

  app.get('/api/reports/assets', (req, res) => {
    const { project_id } = req.query
    let sql = 'SELECT a.*, p.name as project_name FROM assets a LEFT JOIN projects p ON a.project_id = p.id WHERE 1=1'
    const params = []
    if (project_id && project_id !== 'ALL') { sql += ' AND a.project_id=?'; params.push(project_id) }
    db.query(sql, params, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      const inUse = rows.filter(r => r.status === 'In Use').length
      const available = rows.filter(r => r.status === 'Available').length
      const maintenance = rows.filter(r => r.status === 'Maintenance').length
      res.json({ inUse, available, maintenance, rows })
    })
  })

  // ── NOTIFICATIONS ──
  app.get('/api/notifications', (req, res) => {
    const alerts = []
    let pending = 3
    const done = () => { if (--pending === 0) res.json(alerts) }

    // 1. Budget warnings: projects where total expenses >= 80% of budget
    db.query(
      `SELECT p.id, p.name, p.budget,
        COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.project_id = p.id), 0) as spent
       FROM projects p WHERE p.budget > 0`,
      (err, projects) => {
        if (!err) {
          projects.forEach(p => {
            const pct = Math.round((p.spent / p.budget) * 100)
            if (pct >= 80) {
              alerts.push({
                id: `budget-${p.id}`,
                type: 'Budget',
                title: 'Budget Warning Threshold Reached',
                message: `Project "${p.name}" has utilized ${pct}% of its allocated budget.`,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                read: false,
                severity: pct >= 95 ? 'High' : 'Medium'
              })
            }
          })
        }
        done()
      }
    )

    // 2. Equipment in use alerts
    db.query('SELECT * FROM assets WHERE status="In Use"', (err, assets) => {
      if (!err) {
        assets.forEach(a => {
          alerts.push({
            id: `asset-${a.id}`,
            type: 'Tools',
            title: 'Equipment Currently In Use',
            message: `"${a.name}" is currently checked out${a.assigned_to ? ` by ${a.assigned_to}` : ''}.`,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            read: false,
            severity: 'Medium'
          })
        })
      }
      done()
    })

    // 3. Large expenses (top 3 recent expenses > avg)
    db.query(
      `SELECT * FROM expenses WHERE amount > (SELECT AVG(amount) * 2 FROM expenses) ORDER BY created_at DESC LIMIT 3`,
      (err, exps) => {
        if (!err) {
          exps.forEach(e => {
            alerts.push({
              id: `expense-${e.id}`,
              type: 'Expenses',
              title: 'Large Expense Logged',
              message: `A ${e.category} expense of \u20b1${Number(e.amount).toLocaleString()} was logged for project "${e.project}".`,
              date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              read: false,
              severity: 'Medium'
            })
          })
        }
        done()
      }
    )
  })

  app.put('/api/notifications/:id/read', (req, res) => {
    // Notifications are generated dynamically, client handles read state
    res.json({ success: true })
  })

  // ── WORKERS SUMMARY (for Dashboard) — MUST be before /api/workers plain GET ──
  app.get('/api/workers/summary', (req, res) => {
    const today = new Date().toISOString().split('T')[0]
    db.query('SELECT SUM(daily_rate) as total FROM workers WHERE status="Active"', (err, totals) => {
      if (err) return res.status(500).json({ error: err.message })
      db.query('SELECT status, COUNT(*) as count FROM attendance WHERE date=? GROUP BY status', [today], (err, att) => {
        if (err) return res.status(500).json({ error: err.message })
        const present = att.find(r => r.status === 'Present')?.count || 0
        const absent = att.find(r => r.status === 'Absent')?.count || 0
        db.query('SELECT role, COUNT(*) as count FROM workers WHERE status="Active" GROUP BY role', (err, roles) => {
          if (err) return res.status(500).json({ error: err.message })
          db.query(
            'SELECT SUM(w.daily_rate) as payroll FROM workers w INNER JOIN attendance a ON w.id=a.worker_id WHERE a.date=? AND a.status="Present"',
            [today],
            (err, pay) => {
              if (err) return res.status(500).json({ error: err.message })
              res.json({
                totalManpower: totals[0].total || 0,
                present,
                absent,
                roles,
                todayPayroll: pay[0].payroll || 0
              })
            }
          )
        })
      })
    })
  })

  // ── WORKERS ──
  app.get('/api/workers', (req, res) => {
    db.query('SELECT * FROM workers', (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  })

  app.post('/api/workers', (req, res) => {
    const { first_name, middle_name, last_name, full_name, birthday, age, phone, address, role, position, daily_rate, password, approval_status, status, project_id } = req.body
    const computedFullName = full_name || [first_name, middle_name, last_name].filter(Boolean).join(' ')
    db.query(
      'INSERT INTO workers (first_name, middle_name, last_name, full_name, birthday, age, phone, address, role, position, daily_rate, password, approval_status, status, project_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [first_name, middle_name || null, last_name, computedFullName, birthday || null, age || null, phone || null, address || null, role, position || null, daily_rate || 0, password || null, approval_status || 'Pending', status || 'Active', project_id || null],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ id: result.insertId, ...req.body, full_name: computedFullName })
      }
    )
  })

  app.put('/api/workers/:id', (req, res) => {
    const { first_name, middle_name, last_name, full_name, birthday, age, phone, address, role, position, daily_rate, password, approval_status, status, project_id } = req.body
    const computedFullName = full_name || [first_name, middle_name, last_name].filter(Boolean).join(' ')
    db.query(
      'UPDATE workers SET first_name=?, middle_name=?, last_name=?, full_name=?, birthday=?, age=?, phone=?, address=?, role=?, position=?, daily_rate=?, password=COALESCE(NULLIF(?,\'\'), password), approval_status=?, status=?, project_id=? WHERE id=?',
      [first_name, middle_name || null, last_name, computedFullName, birthday || null, age || null, phone || null, address || null, role, position || null, daily_rate || 0, password || null, approval_status || 'Pending', status || 'Active', project_id || null, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true })
      }
    )
  })

  app.delete('/api/workers/:id', (req, res) => {
    db.query('DELETE FROM workers WHERE id=?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ success: true })
    })
  })

  // ── ATTENDANCE ──
  app.get('/api/attendance/:project_id', (req, res) => {
    db.query('SELECT * FROM attendance WHERE project_id=? ORDER BY date DESC', [req.params.project_id], (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  })

  app.post('/api/attendance', (req, res) => {
    const { project_id, worker_id, worker_name, date, status } = req.body
    db.query(
      'INSERT INTO attendance (project_id, worker_id, worker_name, date, status) VALUES (?,?,?,?,?)',
      [project_id, worker_id, worker_name, date, status || 'Present'],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ id: result.insertId, ...req.body })
      }
    )
  })

  // Assets summary for Dashboard — MUST be before /:project_id
  app.get('/api/assets/summary', (req, res) => {
    db.query('SELECT status, COUNT(*) as count FROM assets GROUP BY status', (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      const available = results.find(r => r.status === 'Available')?.count || 0
      const inUse = results.find(r => r.status === 'In Use')?.count || 0
      const maintenance = results.find(r => r.status === 'Maintenance')?.count || 0
      res.json({ available, inUse, maintenance })
    })
  })

  // ── ASSETS ──
  app.get('/api/assets/:project_id', (req, res) => {
    db.query('SELECT * FROM assets WHERE project_id=?', [req.params.project_id], (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  })

  app.post('/api/assets', (req, res) => {
    const { project_id, name, type, status, assigned_to, condition } = req.body
    const cond = condition || type || 'Good'
    db.query(
      'INSERT INTO assets (project_id, name, type, status, assigned_to) VALUES (?,?,?,?,?)',
      [project_id, name, cond, status || 'Available', assigned_to],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ id: result.insertId, ...req.body, condition: cond, type: cond })
      }
    )
  })

  app.put('/api/assets/:id', (req, res) => {
    const { name, type, status, assigned_to, borrow_at, condition } = req.body
    const cond = condition || type || 'Good'
    db.query(
      'UPDATE assets SET name=?, type=?, status=?, assigned_to=?, borrow_at=? WHERE id=?',
      [name, cond, status, assigned_to, borrow_at || null, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true })
      }
    )
  })

  app.delete('/api/assets/:id', (req, res) => {
    db.query('DELETE FROM assets WHERE id=?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ success: true })
    })
  })

  // ── BORROW HISTORY ──
  app.get('/api/borrow-history/:project_id', (req, res) => {
    db.query('SELECT * FROM borrow_history WHERE project_id=? ORDER BY created_at DESC', [req.params.project_id], (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  })

  app.post('/api/borrow-history', (req, res) => {
    const { project_id, tool_name, borrower_name, quantity, action, condition_status, date_time } = req.body
    db.query(
      'INSERT INTO borrow_history (project_id, tool_name, borrower_name, quantity, action, condition_status, date_time) VALUES (?,?,?,?,?,?,?)',
      [project_id, tool_name, borrower_name, quantity || 1, action, condition_status || 'Good', date_time || new Date()],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ id: result.insertId, ...req.body })
      }
    )
  })

  // ── MATERIALS ──
  app.get('/api/materials/:project_id', (req, res) => {
    db.query('SELECT * FROM materials WHERE project_id=? ORDER BY date DESC, created_at DESC', [req.params.project_id], (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  })

  app.post('/api/materials', (req, res) => {
    const { project_id, date, name, qty, unit, cost, remarks } = req.body
    db.query(
      'INSERT INTO materials (project_id, date, name, qty, unit, cost, remarks) VALUES (?,?,?,?,?,?,?)',
      [project_id, date, name, qty, unit, cost, remarks],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ id: result.insertId, ...req.body })
      }
    )
  })

  app.put('/api/materials/:id', (req, res) => {
    const { date, name, qty, unit, cost, remarks } = req.body
    db.query(
      'UPDATE materials SET date=?, name=?, qty=?, unit=?, cost=?, remarks=? WHERE id=?',
      [date, name, qty, unit, cost, remarks, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true })
      }
    )
  })

  app.delete('/api/materials/:id', (req, res) => {
    db.query('DELETE FROM materials WHERE id=?', [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ success: true })
    })
  })

  // Update attendance (for RFID time-out update)
  app.put('/api/attendance/:id', (req, res) => {
    const { status } = req.body
    db.query(
      'UPDATE attendance SET status=? WHERE id=?',
      [status, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true })
      }
    )
  })

  // ── CASH ADVANCES ──
  app.get('/api/cash-advances/:project_id', (req, res) => {
    db.query('SELECT * FROM cash_advances WHERE project_id=? ORDER BY date DESC', [req.params.project_id], (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  })

  app.post('/api/cash-advances', (req, res) => {
    const { project_id, workerName, amount, date, reason, status } = req.body
    db.query(
      'INSERT INTO cash_advances (project_id, workerName, amount, date, reason, status) VALUES (?,?,?,?,?,?)',
      [project_id, workerName, amount, date, reason, status || 'Pending'],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ id: result.insertId, ...req.body })
      }
    )
  })

  // ── REGISTRATION ──
  app.post('/api/register', async (req, res) => {
    const { firstName, middleName, lastName, birthday, age, phone, address, role, position, password } = req.body

    try {
      const fullName = `${firstName}${middleName ? ' ' + middleName : ''} ${lastName}`.trim()
      const hashedPassword = await bcrypt.hash(password, 10)

      db.query(
        `INSERT INTO workers (first_name, middle_name, last_name, full_name, birthday, age, phone, address, role, position, password, approval_status, status) 
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [firstName, middleName || null, lastName, fullName, birthday, age, phone, address, role, position || null, hashedPassword, 'Pending', 'Active'],
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message })
          res.json({ success: true, message: 'Registration submitted for approval', id: result.insertId })
        }
      )
    } catch (err) {
      res.status(500).json({ error: 'Failed to process registration' })
    }
  })

  // ── LOGIN ──
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body

    // Try to find by phone (username) or name
    const sql = `SELECT * FROM workers WHERE phone = ? OR full_name = ? LIMIT 1`
    db.query(sql, [username, username], async (err, results) => {
      if (err) return res.status(500).json({ error: err.message })

      if (results.length === 0) {
        return res.status(401).json({ error: 'Account not found' })
      }

      const user = results[0]

      // Check approval status
      if (user.approval_status === 'Pending') {
        return res.status(403).json({ error: 'pending_approval', message: 'Account pending approval' })
      }

      if (user.approval_status === 'Rejected') {
        return res.status(403).json({ error: 'rejected', message: 'Account was rejected' })
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password)
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid password' })
      }

      // Return user info (without password)
      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.full_name,
          firstName: user.first_name,
          middleName: user.middle_name,
          lastName: user.last_name,
          role: user.role,
          position: user.position,
          phone: user.phone,
          address: user.address,
          approval_status: user.approval_status
        }
      })
    })
  })

  // ── GET ALL PENDING REGISTRATIONS (for Admin) ──
  app.get('/api/pending-registrations', (req, res) => {
    db.query(
      `SELECT id, first_name, middle_name, last_name, full_name, phone, address, role, position, birthday, age, approval_status, created_at 
       FROM workers WHERE approval_status = 'Pending' ORDER BY created_at DESC`,
      (err, results) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(results)
      }
    )
  })

  // ── APPROVE/REJECT REGISTRATION (for Admin) ──
  app.put('/api/workers/:id/approve', (req, res) => {
    const { status } = req.body // 'Approved' or 'Rejected'
    db.query(
      'UPDATE workers SET approval_status = ? WHERE id = ?',
      [status, req.params.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true, message: `User ${status.toLowerCase()}` })
      }
    )
  })

  // ── ADMIN LOGIN ──
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' })

    db.query('SELECT * FROM admins WHERE username = ?', [username], async (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      if (results.length === 0) return res.status(401).json({ error: 'Invalid username or password.' })

      const admin = results[0]
      const match = await bcrypt.compare(password, admin.password)
      if (!match) return res.status(401).json({ error: 'Invalid username or password.' })

      res.json({
        success: true,
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          fullName: admin.full_name,
          firstName: admin.first_name,
          middleName: admin.middle_name,
          lastName: admin.last_name,
          phone: admin.phone,
          homeAddress: admin.home_address,
          role: admin.role || 'Administrator',
          empId: admin.emp_id || 'SCON-ADMIN-001',
          dept: admin.dept || 'Management'
        }
      })
    })
  })

  // ── ADMIN REGISTER (create new admin account) ──
  app.post('/api/admin/register', async (req, res) => {
    const { username, email, password, full_name } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' })

    try {
      const hashed = await bcrypt.hash(password, 10)
      db.query(
        'INSERT INTO admins (username, email, password, full_name) VALUES (?, ?, ?, ?)',
        [username, email || null, hashed, full_name || null],
        (err, result) => {
          if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username or email already exists.' })
            return res.status(500).json({ error: err.message })
          }
          res.json({ success: true, id: result.insertId, username })
        }
      )
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── GET ALL ADMINS ──
  app.get('/api/admins', (req, res) => {
    db.query('SELECT id, username, email, full_name, created_at FROM admins ORDER BY created_at DESC', (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  })

  // ── UPDATE ADMIN PASSWORD ──
  app.put('/api/admin/:id/password', async (req, res) => {
    const { currentPassword, newPassword, password } = req.body
    const targetPass = newPassword || password
    if (!targetPass) return res.status(400).json({ error: 'New password is required.' })
    try {
      if (currentPassword) {
        db.query('SELECT password FROM admins WHERE id = ?', [req.params.id], async (err, rows) => {
          if (err) return res.status(500).json({ error: err.message })
          if (!rows || rows.length === 0) return res.status(404).json({ error: 'Admin not found.' })
          const match = await bcrypt.compare(currentPassword, rows[0].password)
          if (!match) return res.status(400).json({ error: 'Incorrect current password.' })

          const hashed = await bcrypt.hash(targetPass, 10)
          db.query('UPDATE admins SET password = ? WHERE id = ?', [hashed, req.params.id], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message })
            res.json({ success: true, message: 'Password updated successfully.' })
          })
        })
      } else {
        const hashed = await bcrypt.hash(targetPass, 10)
        db.query('UPDATE admins SET password = ? WHERE id = ?', [hashed, req.params.id], (err) => {
          if (err) return res.status(500).json({ error: err.message })
          res.json({ success: true, message: 'Password updated successfully.' })
        })
      }
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── SAVE ADMIN PROFILE ──
  app.post('/api/admin/profile/save', async (req, res) => {
    const {
      adminId,
      firstName,
      middleName,
      lastName,
      email,
      phone,
      homeAddress,
      addressObj,
      role,
      empId,
      dept,
      assignedProjectSite,
      terminalId,
      pushNotificationsEnabled,
      biometricLoginEnabled,
      status
    } = req.body

    const targetAdminId = adminId || 1

    try {
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim()
      const addressObjStr = typeof addressObj === 'object' ? JSON.stringify(addressObj) : (addressObj || null)

      db.query(
        `UPDATE admins SET 
          full_name = ?,
          first_name = ?,
          middle_name = ?,
          last_name = ?,
          email = ?, 
          phone = ?, 
          home_address = ?,
          address_obj = ?,
          role = COALESCE(?, role),
          emp_id = COALESCE(?, emp_id),
          dept = COALESCE(?, dept),
          assigned_project_site = COALESCE(?, assigned_project_site), 
          terminal_id = COALESCE(?, terminal_id), 
          push_notifications_enabled = COALESCE(?, push_notifications_enabled), 
          biometric_login_enabled = COALESCE(?, biometric_login_enabled), 
          status = COALESCE(?, status),
          updated_at = NOW()
         WHERE id = ?`,
        [
          fullName,
          firstName || null,
          middleName || null,
          lastName || null,
          email || null,
          phone || null,
          homeAddress || null,
          addressObjStr,
          role || null,
          empId || null,
          dept || null,
          assignedProjectSite || null,
          terminalId || null,
          pushNotificationsEnabled !== undefined ? (pushNotificationsEnabled ? 1 : 0) : null,
          biometricLoginEnabled !== undefined ? (biometricLoginEnabled ? 1 : 0) : null,
          status || null,
          targetAdminId
        ],
        (err) => {
          if (err) return res.status(500).json({ error: err.message })
          res.json({
            success: true,
            message: 'Admin profile saved successfully',
            data: {
              id: targetAdminId,
              fullName,
              firstName,
              middleName,
              lastName,
              email,
              phone,
              homeAddress,
              addressObj: addressObj || {},
              role: role || 'Administrator',
              empId: empId || 'SCON-ADMIN-001',
              dept: dept || 'Management',
              assignedProjectSite,
              terminalId,
              pushNotificationsEnabled,
              biometricLoginEnabled,
              status
            }
          })
        }
      )
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── GET ADMIN PROFILE ──
  app.get('/api/admin/profile/:id', (req, res) => {
    const rawId = req.params.id
    const targetAdminId = (rawId && rawId !== 'undefined' && rawId !== 'null') ? rawId : 1

    db.query(
      `SELECT id, username, email, full_name, first_name, middle_name, last_name,
              phone, home_address, address_obj, role, emp_id, dept,
              assigned_project_site, terminal_id, 
              push_notifications_enabled, biometric_login_enabled, status, created_at, updated_at 
       FROM admins WHERE id = ? LIMIT 1`,
      [targetAdminId],
      (err, results) => {
        if (err) return res.status(500).json({ error: err.message })
        if (!results || results.length === 0) {
          // If not found by ID, attempt to get first admin
          db.query('SELECT * FROM admins ORDER BY id ASC LIMIT 1', (err2, fallback) => {
            if (err2 || !fallback || fallback.length === 0) {
              return res.status(404).json({ error: 'Admin not found' })
            }
            return sendAdminResponse(fallback[0], res)
          })
          return
        }

        sendAdminResponse(results[0], res)
      }
    )

    function sendAdminResponse(admin, resObj) {
      let parsedAddressObj = {}
      try {
        if (admin.address_obj) {
          parsedAddressObj = typeof admin.address_obj === 'string' ? JSON.parse(admin.address_obj) : admin.address_obj
        }
      } catch {
        parsedAddressObj = {}
      }

      resObj.json({
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.full_name,
        firstName: admin.first_name,
        middleName: admin.middle_name,
        lastName: admin.last_name,
        phone: admin.phone,
        homeAddress: admin.home_address,
        addressObj: parsedAddressObj,
        role: admin.role || 'Administrator',
        empId: admin.emp_id || 'SCON-ADMIN-001',
        dept: admin.dept || 'Management',
        assignedProjectSite: admin.assigned_project_site,
        terminalId: admin.terminal_id,
        pushNotificationsEnabled: Boolean(admin.push_notifications_enabled),
        biometricLoginEnabled: Boolean(admin.biometric_login_enabled),
        status: admin.status,
        createdAt: admin.created_at,
        updatedAt: admin.updated_at
      })
    }
  })

  // ── UPDATE ADMIN SETTINGS ──
  app.put('/api/admin/:id/settings', (req, res) => {
    const { pushNotificationsEnabled, biometricLoginEnabled, assignedProjectSite } = req.body

    db.query(
      `UPDATE admins SET 
        push_notifications_enabled = ?, 
        biometric_login_enabled = ?, 
        assigned_project_site = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        pushNotificationsEnabled ? 1 : 0,
        biometricLoginEnabled ? 1 : 0,
        assignedProjectSite || null,
        req.params.id
      ],
      (err) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true, message: 'Settings updated successfully' })
      }
    )
  })

  app.listen(5000, () => console.log('Server running on http://localhost:5000'))
}
