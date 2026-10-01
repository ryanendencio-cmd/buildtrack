const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')
const jwt = require('jsonwebtoken')

const app = express()
app.use(cors())
app.use(express.json())

// Step 1: Connect WITHOUT database first para makapag-create
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT) || 3306,
  dateStrings: true,
  database: process.env.DB_NAME || null
}

if (process.env.DB_HOST) {
  dbConfig.ssl = { rejectUnauthorized: false }
}

const dbInit = mysql.createConnection(dbConfig)

const DB_NAME = 's_cons_db'

const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    location VARCHAR(100),
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
    role VARCHAR(100),
    morning_in VARCHAR(50),
    morning_out VARCHAR(50),
    afternoon_in VARCHAR(50),
    afternoon_out VARCHAR(50),
    morning_status VARCHAR(50),
    afternoon_status VARCHAR(50),
    time_in VARCHAR(50),
    time_out VARCHAR(50),
    rate DECIMAL(10,2) DEFAULT 0,
    earned_amount DECIMAL(10,2) DEFAULT 0,
    advance DECIMAL(10,2) DEFAULT 0,
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
    worker_id INT,
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
    full_name VARCHAR(255),
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
          // Migrate attendance columns
          const attendanceNewCols = [
            { col: 'role', def: 'VARCHAR(100)' },
            { col: 'morning_in', def: 'VARCHAR(50)' },
            { col: 'morning_out', def: 'VARCHAR(50)' },
            { col: 'afternoon_in', def: 'VARCHAR(50)' },
            { col: 'afternoon_out', def: 'VARCHAR(50)' },
            { col: 'morning_status', def: 'VARCHAR(50)' },
            { col: 'afternoon_status', def: 'VARCHAR(50)' },
            { col: 'time_in', def: 'VARCHAR(50)' },
            { col: 'time_out', def: 'VARCHAR(50)' },
            { col: 'rate', def: 'DECIMAL(10,2) DEFAULT 0' },
            { col: 'earned_amount', def: 'DECIMAL(10,2) DEFAULT 0' },
            { col: 'advance', def: 'DECIMAL(10,2) DEFAULT 0' }
          ]
          attendanceNewCols.forEach(({ col, def }) => {
            dbInit.query(`SHOW COLUMNS FROM attendance LIKE '${col}'`, (err, c) => {
              if (!err && c.length === 0) {
                dbInit.query(`ALTER TABLE attendance ADD COLUMN ${col} ${def}`, () => { })
              }
            })
          })
          // Migrate new admin columns for existing databases
          const adminNewCols = [
            { col: 'full_name', def: 'VARCHAR(255)' },
            { col: 'phone', def: 'VARCHAR(20)' },
            { col: 'assigned_project_site', def: 'VARCHAR(255)' },
            { col: 'terminal_id', def: 'VARCHAR(50)' },
            { col: 'push_notifications_enabled', def: 'BOOLEAN DEFAULT true' },
            { col: 'biometric_login_enabled', def: 'BOOLEAN DEFAULT false' },
            { col: 'status', def: "VARCHAR(50) DEFAULT 'Active'" },
            { col: 'updated_at', def: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' },
            { col: 'full_name', def: 'VARCHAR(255)' },
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

  // Rule: Only 1 active project at a time. A new project cannot be created unless existing ones are COMPLETED.
  app.post('/api/projects', (req, res) => {
    const { name, location, budget, progress, start_date, end_date, status } = req.body
    const targetStatus = status || 'Active'
    const MAX_AMOUNT = 999999999999

    if (budget !== undefined && Number(budget) > MAX_AMOUNT) {
      return res.status(400).json({ error: 'Budget allocated cannot exceed ₱999,999,999,999.' })
    }

    if (String(targetStatus).toUpperCase() !== 'COMPLETED') {
      db.query("SELECT id, name, status FROM projects WHERE UPPER(status) NOT IN ('COMPLETED')", (err, activeProjects) => {
        if (err) return res.status(500).json({ error: err.message })
        if (activeProjects && activeProjects.length > 0) {
          const activeProj = activeProjects[0]
          return res.status(400).json({
            error: `Hindi pa maaaring mag-umpisa ng bagong proyekto dahil may kasalukuyang active project pa ("${activeProj.name}"). Kailangan munang ma-mark bilang COMPLETED ang kasalukuyang proyekto.`
          })
        }

        insertProject()
      })
    } else {
      insertProject()
    }

    function insertProject() {
      db.query(
        'INSERT INTO projects (name, location, budget, progress, start_date, end_date, status) VALUES (?,?,?,?,?,?,?)',
        [name, location, budget, progress || 0, start_date, end_date, targetStatus],
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message })
          res.json({ id: result.insertId, ...req.body, status: targetStatus })
        }
      )
    }
  })

  app.put('/api/projects/:id', (req, res) => {
    const { name, location, budget, progress, start_date, end_date, status } = req.body
    const MAX_AMOUNT = 999999999999

    if (budget !== undefined && Number(budget) > MAX_AMOUNT) {
      return res.status(400).json({ error: 'Budget allocated cannot exceed ₱999,999,999,999.' })
    }

    if (status && String(status).toUpperCase() !== 'COMPLETED') {
      db.query("SELECT id, name FROM projects WHERE id != ? AND UPPER(status) NOT IN ('COMPLETED')", [req.params.id], (err, otherActive) => {
        if (err) return res.status(500).json({ error: err.message })
        if (otherActive && otherActive.length > 0) {
          return res.status(400).json({
            error: `Hindi maaaring maging active ang proyektong ito dahil may isa pang ongoing project ("${otherActive[0].name}"). Isa lamang ang pinapayagang active project sa bawat oras.`
          })
        }

        updateProject()
      })
    } else {
      updateProject()
    }

    function updateProject() {
      db.query(
        'UPDATE projects SET name=?, location=?, budget=?, progress=?, start_date=?, end_date=?, status=? WHERE id=?',
        [name, location, budget, progress, start_date, end_date, status, req.params.id],
        (err) => {
          if (err) return res.status(500).json({ error: err.message })
          res.json({ success: true })
        }
      )
    }
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
      const late = rows.filter(r => r.status === 'Late' || r.status === 'Double Late').length
      const halfday = rows.filter(r => String(r.status).includes('Halfday')).length
      const absent = rows.filter(r => r.status === 'Absent').length
      const totalWage = rows.reduce((s, r) => {
        if (r.earned_amount !== null && r.earned_amount !== undefined) return s + Number(r.earned_amount)
        const base = Number(r.daily_rate || r.rate || 0)
        if (r.status === 'Present') return s + base
        if (r.status === 'Late') return s + Math.max(0, base - 100)
        if (r.status === 'Double Late') return s + Math.max(0, base - 200)
        if (String(r.status).includes('Halfday')) return s + Math.round((base / 2) * 100) / 100
        return s
      }, 0)
      res.json({ present, late, halfday, absent, totalWage, rows })
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
    db.query('SELECT COUNT(*) as totalCount, SUM(daily_rate) as total FROM workers WHERE status="Approved"', (err, totals) => {
      if (err) return res.status(500).json({ error: err.message })
      db.query('SELECT status, COUNT(*) as count FROM attendance WHERE date=? GROUP BY status', [today], (err, att) => {
        if (err) return res.status(500).json({ error: err.message })
        const present = att.find(r => r.status === 'Present')?.count || 0
        const absent = att.find(r => r.status === 'Absent')?.count || 0
        db.query('SELECT role, COUNT(*) as count FROM workers WHERE status="Approved" GROUP BY role', (err, roles) => {
          if (err) return res.status(500).json({ error: err.message })
          db.query(
            'SELECT SUM(w.daily_rate) as payroll FROM workers w INNER JOIN attendance a ON w.id=a.worker_id WHERE a.date=? AND a.status="Present"',
            [today],
            (err, pay) => {
              if (err) return res.status(500).json({ error: err.message })
              res.json({
                totalManpower: totals[0].totalCount || 0,
                presentToday: present,
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
    db.query('SELECT * FROM workers ORDER BY created_at DESC', (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results)
    })
  })

  app.post('/api/workers', async (req, res) => {
    const { first_name, middle_name, last_name, full_name, birthday, age, phone, address, role, position, daily_rate, password, approval_status, status, project_id } = req.body
    const computedFullName = full_name || [first_name, middle_name, last_name].filter(Boolean).join(' ')
    const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('worker123', 10)
    db.query(
      'INSERT INTO workers (first_name, middle_name, last_name, full_name, birthday, age, phone, address, role, position, daily_rate, password, approval_status, status, project_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [first_name, middle_name || null, last_name, computedFullName, birthday || null, age || null, phone || null, address || null, role || 'Worker', position || null, daily_rate || 600, hashedPassword, approval_status || 'Approved', status || 'Active', project_id || null],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ id: result.insertId, ...req.body, full_name: computedFullName, approval_status: approval_status || 'Approved' })
      }
    )
  })

  app.put('/api/workers/:id', async (req, res) => {
    const { first_name, middle_name, last_name, full_name, birthday, age, phone, address, role, position, daily_rate, password, approval_status, status, project_id } = req.body
    const computedFullName = full_name || [first_name, middle_name, last_name].filter(Boolean).join(' ')
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null
    db.query(
      'UPDATE workers SET first_name=?, middle_name=?, last_name=?, full_name=?, birthday=?, age=?, phone=?, address=?, role=?, position=?, daily_rate=?, password=COALESCE(NULLIF(?,\'\'), password), approval_status=?, status=?, project_id=? WHERE id=?',
      [first_name, middle_name || null, last_name, computedFullName, birthday || null, age || null, phone || null, address || null, role, position || null, daily_rate || 600, hashedPassword, approval_status || 'Approved', status || 'Active', project_id || null, req.params.id],
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

  // ── 2-SESSION ATTENDANCE LOGIC & POLICY RULES ──
  // Morning: Time in <= 8:10 AM (Present), 8:11 - 10:00 AM (Late, -100), Timeout 12:00 PM
  // Afternoon: Time in <= 1:10 PM (Present), 1:11 - 3:00 PM (Late, -100), Timeout 5:00 PM
  // Both On-Time: Present (100% full wage)
  // One Late + One On-time: Late (Base - 100)
  // Both Late: Double Late (Base - 200)
  // Halfday: Only Morning (50% wage, or 50% - 100 if late) or Only Afternoon (50% wage, or 50% - 100 if late)
  // Absent: No valid logs in both morning & afternoon (0 wage)

  function parseTimeToMinutes(timeStr) {
    if (!timeStr || timeStr === '—' || timeStr === '--:--') return null
    const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i)
    if (!match) return null

    let hours = parseInt(match[1], 10)
    const minutes = parseInt(match[2], 10)
    const meridian = match[3]?.toUpperCase()

    if (meridian === 'PM' && hours < 12) hours += 12
    if (meridian === 'AM' && hours === 12) hours = 0

    return hours * 60 + minutes
  }

  function evaluateTwoSessions(morningIn, afternoonIn, baseRate) {
    const rate = Number(baseRate) || 0
    const mMinutes = parseTimeToMinutes(morningIn)
    const aMinutes = parseTimeToMinutes(afternoonIn)

    // Evaluate Morning Session
    let mStatus = 'Absent' // 'Present' | 'Late' | 'Absent'
    if (mMinutes !== null) {
      if (mMinutes <= 8 * 60 + 10) {
        mStatus = 'Present'
      } else if (mMinutes <= 10 * 60) {
        mStatus = 'Late'
      } else {
        mStatus = 'Absent'
      }
    }

    // Evaluate Afternoon Session
    let aStatus = 'Absent' // 'Present' | 'Late' | 'Absent'
    if (aMinutes !== null) {
      if (aMinutes <= 13 * 60 + 10) {
        aStatus = 'Present'
      } else if (aMinutes <= 15 * 60) {
        aStatus = 'Late'
      } else {
        aStatus = 'Absent'
      }
    }

    // Combine Sessions
    const hasMorning = (mStatus !== 'Absent')
    const hasAfternoon = (aStatus !== 'Absent')

    if (hasMorning && hasAfternoon) {
      if (mStatus === 'Present' && aStatus === 'Present') {
        return {
          status: 'Present',
          morningStatus: 'Present',
          afternoonStatus: 'Present',
          earnedAmount: rate
        }
      } else if (mStatus === 'Late' && aStatus === 'Late') {
        return {
          status: 'Double Late',
          morningStatus: 'Late',
          afternoonStatus: 'Late',
          earnedAmount: Math.max(0, rate - 200)
        }
      } else {
        return {
          status: 'Late',
          morningStatus: mStatus,
          afternoonStatus: aStatus,
          earnedAmount: Math.max(0, rate - 100)
        }
      }
    } else if (hasMorning) {
      const halfRate = Math.round((rate / 2) * 100) / 100
      const earned = mStatus === 'Late' ? Math.max(0, halfRate - 100) : halfRate
      return {
        status: mStatus === 'Late' ? 'Halfday (Late)' : 'Halfday',
        morningStatus: mStatus,
        afternoonStatus: 'Absent',
        earnedAmount: earned
      }
    } else if (hasAfternoon) {
      const halfRate = Math.round((rate / 2) * 100) / 100
      const earned = aStatus === 'Late' ? Math.max(0, halfRate - 100) : halfRate
      return {
        status: aStatus === 'Late' ? 'Halfday (Late)' : 'Halfday',
        morningStatus: 'Absent',
        afternoonStatus: aStatus,
        earnedAmount: earned
      }
    }

    return {
      status: 'Absent',
      morningStatus: 'Absent',
      afternoonStatus: 'Absent',
      earnedAmount: 0
    }
  }

  // ── ATTENDANCE ──
  app.get('/api/attendance/:project_id', (req, res) => {
    const { project_id } = req.params
    const sql = (!project_id || project_id === 'ALL')
      ? 'SELECT * FROM attendance ORDER BY date DESC, created_at DESC'
      : 'SELECT * FROM attendance WHERE project_id=? ORDER BY date DESC, created_at DESC'
    const params = (!project_id || project_id === 'ALL') ? [] : [project_id]

    db.query(sql, params, (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json(results.map(r => ({
        id: r.id,
        project_id: r.project_id,
        worker_id: r.worker_id,
        worker_name: r.worker_name,
        name: r.worker_name,
        date: r.date,
        role: r.role,
        morningIn: r.morning_in || r.time_in || '—',
        morningOut: r.morning_out || '—',
        afternoonIn: r.afternoon_in || '—',
        afternoonOut: r.afternoon_out || r.time_out || '—',
        morningStatus: r.morning_status,
        afternoonStatus: r.afternoon_status,
        timeIn: r.morning_in || r.afternoon_in || r.time_in || '—',
        timeOut: r.afternoon_out || r.morning_out || r.time_out || '—',
        rate: Number(r.rate) || 0,
        earned_amount: Number(r.earned_amount) || 0,
        advance: Number(r.advance) || 0,
        status: r.status
      })))
    })
  })

  app.post('/api/attendance', (req, res) => {
    const {
      project_id, worker_id, worker_name, name, date, role,
      morningIn, morningOut, afternoonIn, afternoonOut,
      timeIn, timeOut, rate, advance
    } = req.body

    const finalName = worker_name || name || 'Worker'
    const finalDate = date || new Date().toISOString().slice(0, 10)
    const baseRate = Number(rate) || 0

    // Auto-classify single timeIn into morning or afternoon if not explicitly separated
    let mIn = morningIn || null
    let mOut = morningOut || null
    let aIn = afternoonIn || null
    let aOut = afternoonOut || null

    if (!mIn && !aIn && timeIn) {
      const minutes = parseTimeToMinutes(timeIn)
      if (minutes !== null && minutes <= 11 * 60) {
        mIn = timeIn
      } else if (minutes !== null) {
        aIn = timeIn
      }
    }

    const evaluated = evaluateTwoSessions(mIn, aIn, baseRate)
    const status = req.body.status && req.body.status !== 'Present' ? req.body.status : evaluated.status
    const earnedAmount = (status === 'Absent') ? 0 : evaluated.earnedAmount

    db.query(
      `INSERT INTO attendance (
        project_id, worker_id, worker_name, date, role,
        morning_in, morning_out, afternoon_in, afternoon_out,
        morning_status, afternoon_status,
        time_in, time_out, rate, earned_amount, advance, status
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        project_id || null, worker_id || null, finalName, finalDate, role || 'Laborer',
        mIn || '—', mOut || '—', aIn || '—', aOut || '—',
        evaluated.morningStatus, evaluated.afternoonStatus,
        mIn || aIn || '—', aOut || mOut || '—',
        baseRate, earnedAmount, advance || 0, status
      ],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({
          id: result.insertId,
          project_id,
          worker_id,
          worker_name: finalName,
          name: finalName,
          date: finalDate,
          role: role || 'Laborer',
          morningIn: mIn || '—',
          morningOut: mOut || '—',
          afternoonIn: aIn || '—',
          afternoonOut: aOut || '—',
          timeIn: mIn || aIn || '—',
          timeOut: aOut || mOut || '—',
          rate: baseRate,
          earned_amount: earnedAmount,
          advance: advance || 0,
          status
        })
      }
    )
  })

  // Update attendance (for Morning Out, Afternoon In, Afternoon Out)
  app.put('/api/attendance/:id', (req, res) => {
    const {
      morningIn, morningOut, afternoonIn, afternoonOut,
      timeIn, timeOut, status, rate
    } = req.body

    // First fetch existing record to recalculate combined status and wage
    db.query('SELECT * FROM attendance WHERE id = ?', [req.params.id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message })
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Record not found' })

      const existing = rows[0]
      const mIn = morningIn !== undefined ? morningIn : existing.morning_in
      const mOut = morningOut !== undefined ? morningOut : existing.morning_out
      const aIn = afternoonIn !== undefined ? afternoonIn : existing.afternoon_in
      const aOut = afternoonOut !== undefined ? afternoonOut : existing.afternoon_out
      const baseRate = rate !== undefined ? Number(rate) : Number(existing.rate || 0)

      const evaluated = evaluateTwoSessions(mIn, aIn, baseRate)
      const finalStatus = status || evaluated.status
      const finalEarned = (finalStatus === 'Absent') ? 0 : evaluated.earnedAmount

      db.query(
        `UPDATE attendance SET 
          morning_in = ?, morning_out = ?, afternoon_in = ?, afternoon_out = ?,
          morning_status = ?, afternoon_status = ?,
          time_in = ?, time_out = ?,
          earned_amount = ?, status = ?
         WHERE id = ?`,
        [
          mIn || '—', mOut || '—', aIn || '—', aOut || '—',
          evaluated.morningStatus, evaluated.afternoonStatus,
          mIn || aIn || '—', aOut || mOut || '—',
          finalEarned, finalStatus, req.params.id
        ],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message })
          res.json({
            success: true,
            status: finalStatus,
            earned_amount: finalEarned
          })
        }
      )
    })
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

  // Update attendance status only (e.g. RFID status updates)
  app.put('/api/attendance/:id/status', (req, res) => {
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
  // Must be before /:project_id to avoid route conflict
  app.get('/api/cash-advances/pending', (req, res) => {
    db.query(
      `SELECT ca.*, w.full_name as workerFullName, w.role as workerRole, w.position as workerPosition
       FROM cash_advances ca
       LEFT JOIN workers w ON ca.worker_id = w.id
       WHERE ca.status = 'Pending'
       ORDER BY ca.created_at DESC`,
      (err, results) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(results.map(r => ({
          id: r.id,
          name: r.workerFullName || r.workerName,
          amount: `₱${Number(r.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
          rawAmount: r.amount,
          role: r.workerRole || 'Worker',
          reason: r.reason,
          date: r.date,
          status: r.status,
          worker_id: r.worker_id,
          project_id: r.project_id
        })))
      }
    )
  })

  app.put('/api/cash-advances/:id/approve', (req, res) => {
    const { status } = req.body // 'Approved' or 'Rejected'
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' })
    }
    db.query('UPDATE cash_advances SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ success: true, status })
    })
  })

  app.get('/api/cash-advances/:project_id', (req, res) => {
    const { project_id } = req.params
    if (!project_id || project_id === 'ALL' || project_id === 'undefined') {
      db.query('SELECT * FROM cash_advances ORDER BY date DESC, created_at DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(results)
      })
    } else {
      db.query('SELECT * FROM cash_advances WHERE project_id=? OR project_id IS NULL ORDER BY date DESC, created_at DESC', [project_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(results)
      })
    }
  })

  app.post('/api/cash-advances', (req, res) => {
    const { project_id, workerName, workerId, amount, date, reason, status } = req.body
    const cleanDate = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10)
    
    // Resolve workerName from workerId if sent from mobile app
    const resolveAndInsert = (name) => {
      db.query(
        'INSERT INTO cash_advances (project_id, worker_id, workerName, amount, date, reason, status) VALUES (?,?,?,?,?,?,?)',
        [project_id || null, workerId || null, name, amount, cleanDate, reason, status || 'Pending'],
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message })
          res.json({ id: result.insertId, ...req.body, workerName: name, date: cleanDate })
        }
      )
    }

    if (workerId && !workerName) {
      db.query('SELECT full_name FROM workers WHERE id = ?', [workerId], (err, rows) => {
        resolveAndInsert(rows?.[0]?.full_name || 'Unknown')
      })
    } else {
      resolveAndInsert(workerName || 'Unknown')
    }
  })

  app.get('/api/workers/:id/cash-advances', (req, res) => {
    db.query(
      'SELECT * FROM cash_advances WHERE worker_id = ? ORDER BY created_at DESC',
      [req.params.id],
      (err, results) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json(results)
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

      const token = jwt.sign({ id: admin.id, type: 'admin' }, process.env.JWT_SECRET || 'scon_super_secret_key_2026', { expiresIn: '8h' })

      res.json({
        success: true,
        token,
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

  // ── ADMIN FORGOT PASSWORD ──
  app.post('/api/admin/forgot-password', async (req, res) => {
    const { username } = req.body
    db.query('SELECT * FROM admins WHERE email = ? OR username = ?', [username, username], async (err, results) => {
      if (err) return res.status(500).json({ error: err.message })
      if (results.length === 0) {
        return res.json({ success: true, message: 'Password reset link sent.' })
      }

      const admin = results[0]
      if (!admin.email) {
        return res.status(400).json({ error: 'No email associated with this account.' })
      }

      const token = jwt.sign({ id: admin.id, type: 'admin' }, process.env.JWT_SECRET || 'scon_super_secret_key_2026', { expiresIn: '15m' })
      const frontendURL = process.env.FRONTEND_URL || 'https://buildtrack-sotalbo-system.vercel.app'
      const resetLink = `${frontendURL}/reset-password/${token}`

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      })

      const mailOptions = {
        from: `"BuildTrack System" <${process.env.EMAIL_USER}>`,
        to: admin.email,
        subject: 'Sotalbo Construction: Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #8B1A10; margin-bottom: 20px;">Password Reset</h2>
            <p>You requested a password reset for your BuildTrack Administrator account.</p>
            <p>Click the button below to set a new password. This link is valid for <strong>15 minutes</strong>.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="padding: 12px 24px; background-color: #8B1A10; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
            </div>
            <p style="font-size: 12px; color: #777;">If you did not request this, you can safely ignore this email. Your password will remain unchanged.</p>
          </div>
        `
      }

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error)
          return res.status(500).json({ error: 'Failed to send email. Please check server email credentials.' })
        }
        res.json({ success: true, message: 'Password reset link sent.' })
      })
    })
  })

  // ── ADMIN RESET PASSWORD (NEW ROUTE) ──
  app.post('/api/admin/reset-password', async (req, res) => {
    const { token, newPassword } = req.body
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'scon_super_secret_key_2026')
      if (decoded.type !== 'admin') return res.status(400).json({ error: 'Invalid token type' })

      const hashed = await bcrypt.hash(newPassword, 10)
      db.query('UPDATE admins SET password = ? WHERE id = ?', [hashed, decoded.id], (err) => {
        if (err) return res.status(500).json({ error: err.message })
        res.json({ success: true, message: 'Password has been reset successfully.' })
      })
    } catch (e) {
      res.status(400).json({ error: 'Token expired or invalid.' })
    }
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

    try {
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim()
      const addressObjStr = typeof addressObj === 'object' ? JSON.stringify(addressObj) : (addressObj || null)

      // Find real admin id first
      db.query('SELECT id FROM admins WHERE id = ?', [adminId || 1], (idErr, idRows) => {
        if (idErr) return res.status(500).json({ error: idErr.message })

        let finalAdminId = idRows && idRows.length > 0 ? idRows[0].id : null

        const performUpdate = (targetId) => {
          db.query(
            `UPDATE admins SET 
              full_name = ?,
              first_name = ?,
              middle_name = ?,
              last_name = ?,
              email = COALESCE(?, email), 
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
              targetId
            ],
            (updateErr) => {
              if (updateErr) return res.status(500).json({ error: updateErr.message })
              res.json({
                success: true,
                message: 'Admin profile saved successfully',
                data: {
                  id: targetId,
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
        }

        if (finalAdminId) {
          performUpdate(finalAdminId)
        } else {
          // Fallback to first available admin row
          db.query('SELECT id FROM admins ORDER BY id ASC LIMIT 1', (firstErr, firstRows) => {
            if (firstErr || !firstRows || firstRows.length === 0) {
              return res.status(404).json({ error: 'No admin account found in database to update.' })
            }
            performUpdate(firstRows[0].id)
          })
        }
      })
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

  const PORT = process.env.PORT || 5000
  app.listen(PORT, () => console.log('Server running on port ' + PORT))
}
