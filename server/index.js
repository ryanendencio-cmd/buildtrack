const express = require('express')
const cors = require('cors')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')
const jwt = require('jsonwebtoken')
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

const serviceAccount = require('./firebase-service-account.json')

initializeApp({
  credential: cert(serviceAccount)
})

const db = getFirestore()
db.settings({ ignoreUndefinedProperties: true })

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

function scheduleLink(body) {
  const type = body.link_type === 'Project' || body.link_type === 'Transaction' ? body.link_type : 'General'
  return {
    type,
    projectId: type === 'Project' ? (body.project_id || null) : null,
    expenseId: type === 'Transaction' ? (body.expense_id || null) : null
  }
}

async function resolveProjectId(pid) {
  if (!pid || pid === 'ALL' || pid === 'undefined' || pid === 'null') return null
  const clean = String(pid).trim()
  if (!clean || clean === 'ALL' || clean === 'undefined' || clean === 'null') return null
  if (clean === '1') {
    const directDoc = await db.collection('projects').doc('1').get()
    if (directDoc.exists) return '1'
    const activeSnap = await db.collection('projects').where('status', '!=', 'COMPLETED').limit(1).get()
    if (!activeSnap.empty) return activeSnap.docs[0].id
    const snap = await db.collection('projects').limit(1).get()
    if (!snap.empty) return snap.docs[0].id
  }
  return clean
}

function startServer() {

  app.get('/api/schedules', async (req, res) => {
    try {
      const snapshot = await db.collection('schedules').get()
      const results = []
      
      for (const doc of snapshot.docs) {
        const data = doc.data()
        let project_name = null
        let expense_receipt = null
        let expense_category = null

        if (data.project_id) {
          const pDoc = await db.collection('projects').doc(data.project_id).get()
          if (pDoc.exists) project_name = pDoc.data().name
        }
        if (data.expense_id) {
          const eDoc = await db.collection('expenses').doc(data.expense_id).get()
          if (eDoc.exists) {
            expense_receipt = eDoc.data().receipt_no
            expense_category = eDoc.data().category
          }
        }

        results.push({
          id: doc.id,
          ...data,
          project_name,
          expense_receipt,
          expense_category
        })
      }
      results.sort((a, b) => (a.schedule_date || '').localeCompare(b.schedule_date || '') || (a.title || '').localeCompare(b.title || ''))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
  app.post('/api/schedules', async (req, res) => {
    const { title, schedule_date, assigned_to, status, notes } = req.body
    const link = scheduleLink(req.body)
    try {
      const newSchedule = {
        project_id: link.projectId, expense_id: link.expenseId, link_type: link.type,
        title, schedule_date, assigned_to: assigned_to || null, status: status || 'Scheduled', notes: notes || null,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('schedules').add(newSchedule)
      res.json({ id: docRef.id, ...req.body, link_type: link.type, project_id: link.projectId, expense_id: link.expenseId })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
  app.put('/api/schedules/:id', async (req, res) => {
    const { title, schedule_date, assigned_to, status, notes } = req.body
    const link = scheduleLink(req.body)
    try {
      await db.collection('schedules').doc(req.params.id).update({
        project_id: link.projectId, expense_id: link.expenseId, link_type: link.type,
        title, schedule_date, assigned_to: assigned_to || null, status, notes: notes || null
      })
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
  app.delete('/api/schedules/:id', async (req, res) => {
    try {
      await db.collection('schedules').doc(req.params.id).delete()
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── PROJECTS ──
  app.get('/api/projects', async (req, res) => {
    try {
      const snapshot = await db.collection('projects').get()
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Rule: Only 1 active project at a time. A new project cannot be created unless existing ones are COMPLETED.
  app.post('/api/projects', async (req, res) => {
    const { name, location, budget, progress, start_date, end_date, status, address_obj } = req.body
    const targetStatus = status || 'Active'
    const MAX_AMOUNT = 999999999999

    if (budget !== undefined && Number(budget) > MAX_AMOUNT) {
      return res.status(400).json({ error: 'Budget allocated cannot exceed ₱999,999,999,999.' })
    }

    try {
      const ts = String(targetStatus).toUpperCase()
      if (ts === 'ONGOING' || ts === 'ACTIVE') {
        const activeProjects = await db.collection('projects')
          .where('status', '!=', 'COMPLETED')
          .get()
        
        const activeProj = activeProjects.docs.find(d => {
          const s = (d.data().status || '').toUpperCase()
          return s === 'ONGOING' || s === 'ACTIVE'
        })

        if (activeProj) {
          return res.status(400).json({
            error: `Cannot start a new project as ONGOING because there is currently an active project ("${activeProj.data().name}"). You must mark the current project as COMPLETED first.`
          })
        }
      }

      const newProject = {
        name, location, budget, progress: progress || 0, start_date, end_date, status: targetStatus,
        address_obj: address_obj || null,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('projects').add(newProject)
      res.json({ id: docRef.id, ...newProject })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/projects/:id', async (req, res) => {
    const { name, location, budget, progress, start_date, end_date, status, address_obj } = req.body
    const MAX_AMOUNT = 999999999999

    if (budget !== undefined && Number(budget) > MAX_AMOUNT) {
      return res.status(400).json({ error: 'Budget allocated cannot exceed ₱999,999,999,999.' })
    }

    try {
      const ts = status ? String(status).toUpperCase() : null
      if (ts === 'ONGOING' || ts === 'ACTIVE') {
        const otherActive = await db.collection('projects')
          .where('status', '!=', 'COMPLETED')
          .get()
        
        const activeProj = otherActive.docs.find(doc => {
          if (doc.id === req.params.id) return false
          const s = (doc.data().status || '').toUpperCase()
          return s === 'ONGOING' || s === 'ACTIVE'
        })
        
        if (activeProj) {
          return res.status(400).json({
            error: `This project cannot be active because there is another ongoing project ("${activeProj.data().name}"). Only one active project is allowed at a time.`
          })
        }
      }

      const updateData = {
        name, location, budget, progress, start_date, end_date, status
      }
      if (address_obj !== undefined) {
        updateData.address_obj = address_obj
      }

      await db.collection('projects').doc(req.params.id).update(updateData)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      await db.collection('projects').doc(req.params.id).delete()
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/projects/:id/budget-additions', async (req, res) => {
    try {
      const snapshot = await db.collection('budget_additions')
        .where('project_id', '==', req.params.id)
        .get()
      const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      res.json(rows)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/projects/:id/budget-additions', async (req, res) => {
    const MAX_AMOUNT = 999999999999
    const amount = Number(req.body.amount)
    const note = String(req.body.note || '').trim().slice(0, 255)
    const date = req.body.date || new Date().toISOString().slice(0, 10)

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid budget amount.' })
    }

    try {
      const projectRef = db.collection('projects').doc(req.params.id)
      const projectDoc = await projectRef.get()
      
      if (!projectDoc.exists) return res.status(404).json({ error: 'Project not found.' })

      const current = Number(projectDoc.data().budget) || 0
      const next = Math.round((current + amount) * 100) / 100
      if (next > MAX_AMOUNT) {
        return res.status(400).json({ error: 'Budget allocated cannot exceed ₱999,999,999,999.' })
      }

      await projectRef.update({ budget: next })
      const newAddition = {
        project_id: req.params.id,
        amount,
        note,
        date,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('budget_additions').add(newAddition)
      res.json({ id: docRef.id, ...newAddition, budget: next })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── EXPENSES ──
  app.get('/api/expenses', async (req, res) => {
    try {
      const snapshot = await db.collection('expenses').orderBy('created_at', 'desc').get()
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Monthly totals for graphs — MUST be before /:project_id
  app.get('/api/expenses/monthly', async (req, res) => {
    const year = new Date().getFullYear()
    try {
      const snapshot = await db.collection('expenses').get()
      const months = Array(12).fill(0)
      
      snapshot.docs.forEach(doc => {
        const data = doc.data()
        if (data.date) {
          const d = new Date(data.date)
          if (d.getFullYear() === year) {
            months[d.getMonth()] += Number(data.amount || 0)
          }
        }
      })
      res.json(months)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Budget summary for Hero Card
  app.get('/api/expenses/budget-summary', async (req, res) => {
    try {
      const pSnap = await db.collection('projects').get()
      const totalBudget = pSnap.docs.reduce((sum, doc) => sum + Number(doc.data().budget || 0), 0)
      
      const eSnap = await db.collection('expenses').get()
      const expenses = eSnap.docs.map(d => d.data())
      const totalSpent = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
      
      const catMap = {}
      expenses.forEach(e => {
        const cat = e.category || 'Uncategorized'
        catMap[cat] = (catMap[cat] || 0) + Number(e.amount || 0)
      })
      const categories = Object.keys(catMap).map(category => ({ category, total: catMap[category] }))

      res.json({
        totalBudget,
        totalSpent,
        remaining: totalBudget - totalSpent,
        percent: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
        categories
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Summary for Dashboard — MUST be before /api/expenses/:project_id
  app.get('/api/expenses/summary', async (req, res) => {
    try {
      const snapshot = await db.collection('expenses').orderBy('created_at', 'desc').get()
      const expenses = snapshot.docs.map(d => d.data())
      
      const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
      const recent = expenses.slice(0, 5).map(e => ({ category: e.category, amount: e.amount, date: e.date }))
      
      res.json({ total, recent })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Parameterized route — MUST be after all specific /expenses/* routes
  app.get('/api/expenses/:project_id', async (req, res) => {
    try {
      const pid = await resolveProjectId(req.params.project_id)
      let query = db.collection('expenses')
      if (pid) {
        query = query.where('project_id', '==', pid)
      }
      const snapshot = await query.get()
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      results.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/expenses', async (req, res) => {
    const { project_id, project, category, amount, receipt_no, date, time, items, cash_tendered, change, image } = req.body
    try {
      const pid = await resolveProjectId(project_id)
      const newExpense = {
        project_id: pid || project_id || null, project, category, amount, receipt_no, date, time, 
        items: typeof items === 'string' ? JSON.parse(items) : (items || []), 
        cash_tendered, change, image: image || null,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('expenses').add(newExpense)
      res.json({ id: docRef.id, ...req.body, project_id: pid || project_id || null })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/expenses/:id', async (req, res) => {
    const { category, amount, receipt_no, date, time, items, cash_tendered, change, image } = req.body
    try {
      const updateData = {
        category, amount, receipt_no, date, time, 
        items: typeof items === 'string' ? JSON.parse(items) : (items || []), 
        cash_tendered, change
      }
      if (image) updateData.image = image
      
      await db.collection('expenses').doc(req.params.id).update(updateData)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/expenses/:id', async (req, res) => {
    try {
      await db.collection('expenses').doc(req.params.id).delete()
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── REPORTS ──
  app.get('/api/reports/expenses', async (req, res) => {
    const { project_id, month } = req.query
    const [year, mon] = month ? month.split('-') : [null, null]
    
    try {
      const pid = await resolveProjectId(project_id)
      let query = db.collection('expenses')
      if (pid) {
        query = query.where('project_id', '==', pid)
      }
      
      const snapshot = await query.get()
      let rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      
      if (year && mon) {
        rows = rows.filter(r => {
          if (!r.date) return false
          const d = new Date(r.date)
          return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(mon)
        })
      }

      // Fetch project budgets
      let totalBudget = 0
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].project_id) {
          const pDoc = await db.collection('projects').doc(rows[i].project_id).get()
          if (pDoc.exists) rows[i].budget = pDoc.data().budget
        }
      }

      if (pid) {
        const pDoc = await db.collection('projects').doc(pid).get()
        if (pDoc.exists) totalBudget = Number(pDoc.data().budget || 0)
      } else {
        const pSnap = await db.collection('projects').get()
        totalBudget = pSnap.docs.reduce((sum, doc) => sum + Number(doc.data().budget || 0), 0)
      }

      const totalSpent = rows.reduce((s, r) => s + Number(r.amount || 0), 0)
      res.json({ totalSpent, budget: totalBudget, remaining: totalBudget - totalSpent, rows })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/reports/manpower', async (req, res) => {
    const { project_id, month } = req.query
    const [year, mon] = month ? month.split('-') : [null, null]
    
    try {
      const pid = await resolveProjectId(project_id)
      let query = db.collection('attendance')
      if (pid) {
        query = query.where('project_id', '==', pid)
      }
      
      const snapshot = await query.get()
      let rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      
      if (year && mon) {
        rows = rows.filter(r => {
          if (!r.date) return false
          const d = new Date(r.date)
          return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(mon)
        })
      }

      // Fetch worker roles and rates
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].worker_id) {
          const wDoc = await db.collection('workers').doc(rows[i].worker_id).get()
          if (wDoc.exists) {
            rows[i].role = wDoc.data().role
            rows[i].daily_rate = wDoc.data().daily_rate
          }
        }
      }

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
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/reports/materials', async (req, res) => {
    const { project_id } = req.query
    try {
      const pid = await resolveProjectId(project_id)
      let query = db.collection('materials')
      if (pid) {
        query = query.where('project_id', '==', pid)
      }
      
      const snapshot = await query.get()
      const rows = []
      
      for (const doc of snapshot.docs) {
        const data = doc.data()
        let project_name = null
        if (data.project_id) {
          const pDoc = await db.collection('projects').doc(data.project_id).get()
          if (pDoc.exists) project_name = pDoc.data().name
        }
        rows.push({ id: doc.id, ...data, project_name })
      }
      
      const totalCost = rows.reduce((s, r) => s + (Number(r.qty || r.quantity || 0) * Number(r.cost || r.unit_cost || 0)), 0)
      res.json({ totalCost, itemCount: rows.length, rows })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/reports/assets', async (req, res) => {
    const { project_id } = req.query
    try {
      const pid = await resolveProjectId(project_id)
      let query = db.collection('assets')
      if (pid) {
        query = query.where('project_id', '==', pid)
      }
      
      const snapshot = await query.get()
      const rows = []
      
      for (const doc of snapshot.docs) {
        const data = doc.data()
        let project_name = null
        if (data.project_id) {
          const pDoc = await db.collection('projects').doc(data.project_id).get()
          if (pDoc.exists) project_name = pDoc.data().name
        }
        rows.push({ id: doc.id, ...data, project_name })
      }
      
      const inUse = rows.filter(r => r.status === 'In Use').length
      const available = rows.filter(r => r.status === 'Available').length
      const maintenance = rows.filter(r => r.status === 'Maintenance').length
      res.json({ inUse, available, maintenance, rows })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── NOTIFICATIONS ──
  app.get('/api/notifications', async (req, res) => {
    const alerts = []
    try {
      // 1. Budget warnings
      const pSnap = await db.collection('projects').where('budget', '>', 0).get()
      for (const pDoc of pSnap.docs) {
        const p = pDoc.data()
        const eSnap = await db.collection('expenses').where('project_id', '==', pDoc.id).get()
        const spent = eSnap.docs.reduce((sum, eDoc) => sum + Number(eDoc.data().amount || 0), 0)
        
        const pct = Math.round((spent / p.budget) * 100)
        if (pct >= 80) {
          alerts.push({
            id: `budget-${pDoc.id}`,
            type: 'Budget',
            title: 'Budget Warning Threshold Reached',
            message: `Project "${p.name}" has utilized ${pct}% of its allocated budget.`,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            read: false,
            severity: pct >= 95 ? 'High' : 'Medium'
          })
        }
      }

      // 2. Equipment in use alerts
      const aSnap = await db.collection('assets').where('status', '==', 'In Use').get()
      aSnap.docs.forEach(aDoc => {
        const a = aDoc.data()
        alerts.push({
          id: `asset-${aDoc.id}`,
          type: 'Tools',
          title: 'Equipment Currently In Use',
          message: `"${a.name}" is currently checked out${a.assigned_to ? ` by ${a.assigned_to}` : ''}.`,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          read: false,
          severity: 'Medium'
        })
      })

      // 3. Large expenses
      const expSnap = await db.collection('expenses').get()
      const expenses = expSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (expenses.length > 0) {
        const avg = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0) / expenses.length
        const largeExps = expenses
          .filter(e => Number(e.amount || 0) > (avg * 2))
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
          .slice(0, 3)
        
        largeExps.forEach(e => {
          alerts.push({
            id: `expense-${e.id}`,
            type: 'Expenses',
            title: 'Large Expense Logged',
            message: `A ${e.category} expense of ₱${Number(e.amount).toLocaleString()} was logged for project "${e.project}".`,
            date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            read: false,
            severity: 'Medium'
          })
        })
      }

      res.json(alerts)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/notifications/:id/read', (req, res) => {
    // Notifications are generated dynamically, client handles read state
    res.json({ success: true })
  })

  // ── WORKERS SUMMARY (for Dashboard) — MUST be before /api/workers plain GET ──
  app.get('/api/workers/summary', async (req, res) => {
    const today = new Date().toISOString().split('T')[0]
    try {
      const wSnap = await db.collection('workers').get()
      const workers = wSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(w => (w.approval_status || 'Approved') !== 'Pending')
      
      const totalManpower = workers.length
      
      const aSnap = await db.collection('attendance').where('date', '==', today).get()
      const attendance = aSnap.docs.map(d => d.data())
      
      const presentToday = attendance.filter(a => a.status === 'Present').length
      const absent = attendance.filter(a => a.status === 'Absent').length
      
      const rolesMap = {}
      workers.forEach(w => {
        const r = w.role || 'Worker'
        rolesMap[r] = (rolesMap[r] || 0) + 1
      })
      const roles = Object.keys(rolesMap).map(role => ({ role, count: rolesMap[role] }))
      
      let todayPayroll = 0
      attendance.filter(a => a.status === 'Present').forEach(a => {
        const worker = workers.find(w => w.id === a.worker_id)
        if (worker) todayPayroll += Number(worker.daily_rate || 0)
      })

      res.json({
        totalManpower,
        presentToday,
        absent,
        roles,
        todayPayroll
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── WORKERS ──
  app.get('/api/workers', async (req, res) => {
    try {
      const snapshot = await db.collection('workers').orderBy('created_at', 'desc').get()
      const results = snapshot.docs.map(doc => {
        const data = doc.data()
        delete data.password
        return { id: doc.id, ...data }
      })
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/workers', async (req, res) => {
    const { first_name, middle_name, last_name, full_name, birthday, age, phone, address, role, position, daily_rate, password, approval_status, status, project_id, address_obj } = req.body
    const computedFullName = full_name || [first_name, middle_name, last_name].filter(Boolean).join(' ')
    const cleanPassword = (typeof password === 'string' && password.trim().length > 0) ? password.trim() : 'worker123'
    const hashedPassword = await bcrypt.hash(cleanPassword, 10)
    const cleanPosition = Array.isArray(position)
      ? position.filter(Boolean).join(', ')
      : (typeof position === 'string' && position.trim().length > 0 ? position.trim() : null)
    
    try {
      const newWorker = {
        first_name, middle_name: middle_name || null, last_name, full_name: computedFullName, 
        birthday: birthday || null, age: age || null, phone: phone || null, address: address || null, 
        address_obj: address_obj || null,
        role: role || 'Worker', position: cleanPosition, daily_rate: daily_rate || 600, 
        password: hashedPassword, approval_status: approval_status || 'Approved', 
        status: status || 'Active', project_id: project_id || null,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('workers').add(newWorker)
      res.json({ id: docRef.id, ...req.body, position: cleanPosition, full_name: computedFullName, approval_status: approval_status || 'Approved' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/workers/:id', async (req, res) => {
    const { first_name, middle_name, last_name, full_name, birthday, age, phone, address, role, position, daily_rate, password, approval_status, status, project_id, address_obj } = req.body
    const computedFullName = full_name || [first_name, middle_name, last_name].filter(Boolean).join(' ')
    const cleanPosition = Array.isArray(position)
      ? position.filter(Boolean).join(', ')
      : (typeof position === 'string' && position.trim().length > 0 ? position.trim() : (position === null ? null : undefined))
    
    try {
      const updateData = {
        first_name, middle_name: middle_name || null, last_name, full_name: computedFullName, 
        birthday: birthday || null, age: age || null, phone: phone || null, address: address || null, 
        role, daily_rate: daily_rate || 600, 
        approval_status: approval_status || 'Approved', status: status || 'Active', project_id: project_id || null
      }
      if (cleanPosition !== undefined) {
        updateData.position = cleanPosition
      }
      if (address_obj !== undefined) {
        updateData.address_obj = address_obj
      }
      if (typeof password === 'string' && password.trim().length > 0) {
        const trimmedPass = password.trim()
        // If password is already a bcrypt hash ($2a$ or $2b$), do NOT re-hash it!
        if (!trimmedPass.startsWith('$2a$') && !trimmedPass.startsWith('$2b$')) {
          updateData.password = await bcrypt.hash(trimmedPass, 10)
        }
      }
      await db.collection('workers').doc(req.params.id).update(updateData)
      res.json({ success: true, position: cleanPosition })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/workers/:id', async (req, res) => {
    try {
      await db.collection('workers').doc(req.params.id).delete()
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
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
  app.get('/api/attendance/:project_id', async (req, res) => {
    const { project_id } = req.params
    try {
      const pid = await resolveProjectId(project_id)
      let query = db.collection('attendance')
      if (pid) {
        query = query.where('project_id', '==', pid)
      }
      
      const snapshot = await query.get()
      const results = snapshot.docs.map(doc => {
        const r = doc.data()
        return {
          id: doc.id,
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
          status: r.status,
          created_at: r.created_at
        }
      })
      results.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at?._seconds || 0) - (a.created_at?._seconds || 0))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/attendance', async (req, res) => {
    const {
      project_id, worker_id, worker_name, name, date, role,
      morningIn, morningOut, afternoonIn, afternoonOut,
      timeIn, timeOut, rate, advance
    } = req.body

    const finalName = worker_name || name || 'Worker'
    const finalDate = date || new Date().toISOString().slice(0, 10)
    const baseRate = Number(rate) || 0

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

    try {
      const pid = await resolveProjectId(project_id)
      const newAttendance = {
        project_id: pid || project_id || null, worker_id: worker_id || null, worker_name: finalName, date: finalDate, role: role || 'Laborer',
        morning_in: mIn || '—', morning_out: mOut || '—', afternoon_in: aIn || '—', afternoon_out: aOut || '—',
        morning_status: evaluated.morningStatus, afternoon_status: evaluated.afternoonStatus,
        time_in: mIn || aIn || '—', time_out: aOut || mOut || '—', rate: baseRate, earned_amount: earnedAmount, advance: advance || 0, status,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('attendance').add(newAttendance)
      
      res.json({
        id: docRef.id,
        project_id, worker_id, worker_name: finalName, name: finalName, date: finalDate, role: role || 'Laborer',
        morningIn: mIn || '—', morningOut: mOut || '—', afternoonIn: aIn || '—', afternoonOut: aOut || '—',
        timeIn: mIn || aIn || '—', timeOut: aOut || mOut || '—', rate: baseRate, earned_amount: earnedAmount, advance: advance || 0, status
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Update attendance (for Morning Out, Afternoon In, Afternoon Out)
  app.put('/api/attendance/:id', async (req, res) => {
    const {
      morningIn, morningOut, afternoonIn, afternoonOut,
      timeIn, timeOut, status, rate
    } = req.body

    try {
      const docRef = db.collection('attendance').doc(req.params.id)
      const docSnap = await docRef.get()
      
      if (!docSnap.exists) return res.status(404).json({ error: 'Record not found' })

      const existing = docSnap.data()
      const mIn = morningIn !== undefined ? morningIn : existing.morning_in
      const mOut = morningOut !== undefined ? morningOut : existing.morning_out
      const aIn = afternoonIn !== undefined ? afternoonIn : existing.afternoon_in
      const aOut = afternoonOut !== undefined ? afternoonOut : existing.afternoon_out
      const baseRate = rate !== undefined ? Number(rate) : Number(existing.rate || 0)

      const evaluated = evaluateTwoSessions(mIn, aIn, baseRate)
      const finalStatus = status || evaluated.status
      const finalEarned = (finalStatus === 'Absent') ? 0 : evaluated.earnedAmount

      await docRef.update({
        morning_in: mIn || '—', morning_out: mOut || '—', afternoon_in: aIn || '—', afternoon_out: aOut || '—',
        morning_status: evaluated.morningStatus, afternoon_status: evaluated.afternoonStatus,
        time_in: mIn || aIn || '—', time_out: aOut || mOut || '—',
        earned_amount: finalEarned, status: finalStatus
      })

      res.json({
        success: true,
        status: finalStatus,
        earned_amount: finalEarned
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Assets summary for Dashboard — MUST be before /:project_id
  app.get('/api/assets/summary', async (req, res) => {
    try {
      const snapshot = await db.collection('assets').get()
      const assets = snapshot.docs.map(d => d.data())
      
      const available = assets.filter(a => a.status === 'Available').length
      const inUse = assets.filter(a => a.status === 'In Use').length
      const maintenance = assets.filter(a => a.status === 'Maintenance').length
      
      res.json({ available, inUse, maintenance })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── ASSETS ──
  app.get('/api/assets', async (req, res) => {
    try {
      const snapshot = await db.collection('assets').get()
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/assets/:project_id', async (req, res) => {
    try {
      const pid = await resolveProjectId(req.params.project_id)
      let query = db.collection('assets')
      if (pid) {
        query = query.where('project_id', '==', pid)
      }
      const snapshot = await query.get()
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  const handleCreateAsset = async (req, res) => {
    const { name, type, status, assigned_to, user, condition } = req.body
    const rawPid = req.params.project_id || req.body.project_id || null
    const cond = condition || type || 'Good'
    const assignedUser = assigned_to !== undefined ? assigned_to : (user && user !== '—' ? user : null)
    try {
      const pid = await resolveProjectId(rawPid)
      const newAsset = {
        project_id: pid || null,
        name: name ? String(name).trim() : 'Unnamed Tool',
        type: cond,
        condition: cond,
        status: status || 'Available',
        assigned_to: assignedUser || null,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('assets').add(newAsset)
      res.json({ id: docRef.id, ...newAsset, condition: cond, type: cond })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }

  app.post('/api/assets', handleCreateAsset)
  app.post('/api/assets/:project_id', handleCreateAsset)

  app.put('/api/assets/:id', async (req, res) => {
    const { name, type, status, assigned_to, user, borrow_at, condition, project_id } = req.body
    const cond = condition || type || 'Good'
    const assignedUser = assigned_to !== undefined ? assigned_to : (user && user !== '—' ? user : null)
    try {
      const updateData = {
        name: name ? String(name).trim() : '',
        type: cond,
        condition: cond,
        status: status || 'Available',
        assigned_to: assignedUser || null,
        borrow_at: borrow_at || null
      }
      if (project_id !== undefined) {
        const pid = await resolveProjectId(project_id)
        updateData.project_id = pid || null
      }
      await db.collection('assets').doc(req.params.id).update(updateData)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/assets/:id', async (req, res) => {
    try {
      await db.collection('assets').doc(req.params.id).delete()
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── BORROW HISTORY ──
  app.get('/api/borrow-history/:project_id', async (req, res) => {
    try {
      const pid = await resolveProjectId(req.params.project_id)
      let query = db.collection('borrow_history')
      if (pid) {
        query = query.where('project_id', '==', pid)
      }
      const snapshot = await query.get()
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      results.sort((a, b) => (b.created_at?._seconds || 0) - (a.created_at?._seconds || 0))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  const handleCreateBorrowHistory = async (req, res) => {
    const rawPid = req.params.project_id || req.body.project_id
    const { tool_name, borrower_name, quantity, action, condition_status, date_time } = req.body
    try {
      const pid = await resolveProjectId(rawPid)
      const newHistory = {
        project_id: pid || rawPid || null, tool_name, borrower_name, quantity: quantity || 1, action, 
        condition_status: condition_status || 'Good', date_time: date_time || new Date(),
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('borrow_history').add(newHistory)
      res.json({ id: docRef.id, ...req.body, project_id: pid || rawPid || null })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }

  app.post('/api/borrow-history', handleCreateBorrowHistory)
  app.post('/api/borrow-history/:project_id', handleCreateBorrowHistory)

  // ── MATERIALS ──
  app.get('/api/materials/:project_id', async (req, res) => {
    try {
      const pid = await resolveProjectId(req.params.project_id)
      let query = db.collection('materials')
      if (pid) {
        query = query.where('project_id', '==', pid)
      }
      const snapshot = await query.get()
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      results.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  const handleCreateMaterial = async (req, res) => {
    const rawPid = req.params.project_id || req.body.project_id
    const { date, name, qty, unit, cost, remarks } = req.body
    try {
      const pid = await resolveProjectId(rawPid)
      const newMaterial = {
        project_id: pid || rawPid || null, date, name, qty, unit, cost, remarks,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('materials').add(newMaterial)
      res.json({ id: docRef.id, ...req.body, project_id: pid || rawPid || null })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }

  app.post('/api/materials', handleCreateMaterial)
  app.post('/api/materials/:project_id', handleCreateMaterial)

  app.put('/api/materials/:id', async (req, res) => {
    const { date, name, qty, unit, cost, remarks } = req.body
    try {
      await db.collection('materials').doc(req.params.id).update({
        date, name, qty, unit, cost, remarks
      })
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/materials/:id', async (req, res) => {
    try {
      await db.collection('materials').doc(req.params.id).delete()
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Update attendance status only (e.g. RFID status updates)
  app.put('/api/attendance/:id/status', async (req, res) => {
    const { status } = req.body
    try {
      await db.collection('attendance').doc(req.params.id).update({ status })
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── CASH ADVANCES ──
  // Must be before /:project_id to avoid route conflict
  app.get('/api/cash-advances/pending', async (req, res) => {
    try {
      const snapshot = await db.collection('cash_advances')
        .where('status', '==', 'Pending')
        .get()
      
      const results = []
      for (const doc of snapshot.docs) {
        const data = doc.data()
        let workerFullName = data.workerName
        let workerRole = 'Worker'
        let workerPosition = null

        if (data.worker_id) {
          const workerDoc = await db.collection('workers').doc(data.worker_id).get()
          if (workerDoc.exists) {
            const workerData = workerDoc.data()
            workerFullName = workerData.full_name || workerFullName
            workerRole = workerData.role || workerRole
            workerPosition = workerData.position
          }
        }

        results.push({
          id: doc.id,
          name: workerFullName,
          amount: `₱${Number(data.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
          rawAmount: data.amount,
          role: workerRole,
          reason: data.reason,
          date: data.date,
          status: data.status,
          worker_id: data.worker_id,
          project_id: data.project_id,
          created_at: data.created_at
        })
      }
      results.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at?._seconds || 0) - (a.created_at?._seconds || 0))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/cash-advances/:id/approve', async (req, res) => {
    const { status } = req.body // 'Approved' or 'Rejected'
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' })
    }
    try {
      await db.collection('cash_advances').doc(req.params.id).update({ status })
      res.json({ success: true, status })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/cash-advances/:project_id', async (req, res) => {
    const { project_id } = req.params
    try {
      const pid = await resolveProjectId(project_id)
      let query = db.collection('cash_advances')
      
      if (pid) {
        query = query.where('project_id', '==', pid)
      }
      
      const snapshot = await query.get()
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      results.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created_at?._seconds || 0) - (a.created_at?._seconds || 0))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/cash-advances', async (req, res) => {
    const { project_id, workerName, workerId, amount, date, reason, status } = req.body
    const cleanDate = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10)
    
    try {
      const pid = await resolveProjectId(project_id)
      const resolveAndInsert = async (name) => {
        try {
          const newAdvance = {
            project_id: pid || project_id || null,
            worker_id: workerId || null,
            workerName: name,
            amount,
            date: cleanDate,
            reason,
            status: status || 'Pending',
            created_at: FieldValue.serverTimestamp()
          }
          const docRef = await db.collection('cash_advances').add(newAdvance)
          res.json({ id: docRef.id, ...req.body, project_id: pid || project_id || null, workerName: name, date: cleanDate })
        } catch (err) {
          res.status(500).json({ error: err.message })
        }
      }

      if (workerId && !workerName) {
        try {
          const workerDoc = await db.collection('workers').doc(workerId).get()
          resolveAndInsert(workerDoc.exists ? (workerDoc.data().full_name || 'Unknown') : 'Unknown')
        } catch (err) {
          resolveAndInsert('Unknown')
        }
      } else {
        resolveAndInsert(workerName || 'Unknown')
      }
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/workers/:id/cash-advances', async (req, res) => {
    try {
      const snapshot = await db.collection('cash_advances')
        .where('worker_id', '==', req.params.id)
        .get()
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      results.sort((a, b) => (b.created_at?._seconds || 0) - (a.created_at?._seconds || 0))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── REGISTRATION ──
  app.post('/api/register', async (req, res) => {
    const { firstName, middleName, lastName, username, birthday, age, phone, address, address_obj, role, position, password } = req.body

    try {
      const fullName = `${firstName}${middleName ? ' ' + middleName : ''} ${lastName}`.trim()
      const cleanPassword = (typeof password === 'string' && password.trim().length > 0) ? password.trim() : ''
      if (!cleanPassword) {
        return res.status(400).json({ error: 'Password is required' })
      }
      const hashedPassword = await bcrypt.hash(cleanPassword, 10)

      const newWorker = {
        first_name: firstName, middle_name: middleName || null, last_name: lastName, full_name: fullName, username: username ? String(username).trim() : null,
        birthday, age, phone, address, address_obj: address_obj || null, role, position: position || null, password: hashedPassword,
        approval_status: 'Pending', status: 'Active',
        created_at: FieldValue.serverTimestamp()
      }
      
      const docRef = await db.collection('workers').add(newWorker)
      res.json({ success: true, message: 'Registration submitted for approval', id: docRef.id })
    } catch (err) {
      res.status(500).json({ error: 'Failed to process registration' })
    }
  })

  // ── LOGIN ──
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body

    try {
      if (!username || !password) {
        return res.status(400).json({ error: 'Username/Phone and password are required' })
      }

      const rawUser = String(username).trim()
      const cleanDigits = rawUser.replace(/\D/g, '')
      let candidatePhones = [rawUser]
      if (cleanDigits.length >= 10) {
        const last10 = cleanDigits.slice(-10)
        candidatePhones.push(`+63${last10}`, `0${last10}`, `63${last10}`, last10)
      }
      candidatePhones = [...new Set(candidatePhones)]

      // 1. Try to find by phone (supporting 09..., +639..., 639..., 9...)
      let snapshot = await db.collection('workers').where('phone', 'in', candidatePhones).limit(1).get()

      // 2. Try by username (exact or case-insensitive fallback)
      if (snapshot.empty) {
        snapshot = await db.collection('workers').where('username', '==', rawUser).limit(1).get()
      }
      if (snapshot.empty && rawUser.toLowerCase() !== rawUser) {
        snapshot = await db.collection('workers').where('username', '==', rawUser.toLowerCase()).limit(1).get()
      }

      // 3. Try by full_name
      if (snapshot.empty) {
        snapshot = await db.collection('workers').where('full_name', '==', rawUser).limit(1).get()
      }

      if (snapshot.empty) {
        return res.status(401).json({ error: 'Account not found' })
      }

      const userDoc = snapshot.docs[0]
      const user = userDoc.data()

      // Check approval status
      if (user.approval_status === 'Pending') {
        return res.status(403).json({ error: 'pending_approval', message: 'Account pending approval' })
      }

      if (user.approval_status === 'Rejected') {
        return res.status(403).json({ error: 'rejected', message: 'Account was rejected' })
      }

      if (!user.password) {
        return res.status(401).json({ error: 'No password set for this account. Please contact administrator.' })
      }

      // Verify password (supports exact match or trimmed match for mobile keyboards)
      const rawPassword = String(password)
      let validPassword = await bcrypt.compare(rawPassword, user.password)
      if (!validPassword && rawPassword.trim() !== rawPassword) {
        validPassword = await bcrypt.compare(rawPassword.trim(), user.password)
      }
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid password' })
      }

      // Return user info (without password)
      res.json({
        success: true,
        user: {
          id: userDoc.id,
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
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET ALL PENDING REGISTRATIONS (for Admin) ──
  app.get('/api/pending-registrations', async (req, res) => {
    try {
      const snapshot = await db.collection('workers')
        .where('approval_status', '==', 'Pending')
        .get()
      
      const results = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          first_name: data.first_name,
          middle_name: data.middle_name,
          last_name: data.last_name,
          full_name: data.full_name,
          phone: data.phone,
          address: data.address,
          role: data.role,
          position: data.position,
          birthday: data.birthday,
          age: data.age,
          approval_status: data.approval_status,
          created_at: data.created_at
        }
      })

      // Sort newest first in memory without requiring composite index
      results.sort((a, b) => {
        const timeA = a.created_at?._seconds || 0
        const timeB = b.created_at?._seconds || 0
        return timeB - timeA
      })

      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── APPROVE/REJECT REGISTRATION (for Admin) ──
  app.put('/api/workers/:id/approve', async (req, res) => {
    const { status } = req.body // 'Approved' or 'Rejected'
    try {
      const cleanStatus = status === 'Approved' ? 'Approved' : 'Rejected'
      const updateData = {
        approval_status: cleanStatus,
        status: cleanStatus === 'Approved' ? 'Active' : 'Inactive'
      }
      await db.collection('workers').doc(req.params.id).update(updateData)
      res.json({ success: true, message: `User ${cleanStatus.toLowerCase()}` })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── ADMIN LOGIN ──
  app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' })

    try {
      const snapshot = await db.collection('admins').where('username', '==', username).limit(1).get()
      if (snapshot.empty) return res.status(401).json({ error: 'Invalid username or password.' })

      const adminDoc = snapshot.docs[0]
      const adminData = adminDoc.data()
      
      const match = await bcrypt.compare(password, adminData.password)
      if (!match) return res.status(401).json({ error: 'Invalid username or password.' })

      const token = jwt.sign({ id: adminDoc.id, type: 'admin' }, process.env.JWT_SECRET || 'scon_super_secret_key_2026', { expiresIn: '8h' })

      res.json({
        success: true,
        token,
        admin: {
          id: adminDoc.id,
          username: adminData.username,
          email: adminData.email,
          fullName: adminData.full_name,
          firstName: adminData.first_name,
          middleName: adminData.middle_name,
          lastName: adminData.last_name,
          phone: adminData.phone,
          homeAddress: adminData.home_address,
          role: adminData.role || 'Administrator',
          empId: adminData.emp_id || 'SCON-ADMIN-001',
          dept: adminData.dept || 'Management'
        }
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── ADMIN FORGOT PASSWORD ──
  app.post('/api/admin/forgot-password', async (req, res) => {
    const { username } = req.body
    try {
      let snapshot = await db.collection('admins').where('email', '==', username).limit(1).get()
      if (snapshot.empty) {
        snapshot = await db.collection('admins').where('username', '==', username).limit(1).get()
      }

      if (snapshot.empty) {
        return res.json({ success: true, message: 'Password reset link sent.' })
      }

      const adminDoc = snapshot.docs[0]
      const adminData = adminDoc.data()
      
      if (!adminData.email) {
        return res.status(400).json({ error: 'No email associated with this account.' })
      }

      const token = jwt.sign({ id: adminDoc.id, type: 'admin' }, process.env.JWT_SECRET || 'scon_super_secret_key_2026', { expiresIn: '15m' })
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
        to: adminData.email,
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
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── ADMIN RESET PASSWORD (NEW ROUTE) ──
  app.post('/api/admin/reset-password', async (req, res) => {
    const { token, newPassword } = req.body
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'scon_super_secret_key_2026')
      if (decoded.type !== 'admin') return res.status(400).json({ error: 'Invalid token type' })

      const hashed = await bcrypt.hash(newPassword, 10)
      await db.collection('admins').doc(decoded.id).update({ password: hashed })
      res.json({ success: true, message: 'Password has been reset successfully.' })
    } catch (e) {
      res.status(400).json({ error: 'Token expired or invalid.' })
    }
  })

  // ── ADMIN REGISTER (create new admin account) ──
  app.post('/api/admin/register', async (req, res) => {
    const { username, email, password, full_name } = req.body
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' })

    try {
      // Check for duplicates
      const usernameCheck = await db.collection('admins').where('username', '==', username).get()
      if (!usernameCheck.empty) return res.status(409).json({ error: 'Username already exists.' })
      
      if (email) {
        const emailCheck = await db.collection('admins').where('email', '==', email).get()
        if (!emailCheck.empty) return res.status(409).json({ error: 'Email already exists.' })
      }

      const hashed = await bcrypt.hash(password, 10)
      const newAdmin = {
        username, email: email || null, password: hashed, full_name: full_name || null,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('admins').add(newAdmin)
      res.json({ success: true, id: docRef.id, username })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── GET ALL ADMINS ──
  app.get('/api/admins', async (req, res) => {
    try {
      const snapshot = await db.collection('admins').orderBy('created_at', 'desc').get()
      const results = snapshot.docs.map(doc => {
        const data = doc.data()
        return { id: doc.id, username: data.username, email: data.email, full_name: data.full_name, created_at: data.created_at }
      })
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── UPDATE ADMIN PASSWORD ──
  app.put('/api/admin/:id/password', async (req, res) => {
    const { currentPassword, newPassword, password } = req.body
    const targetPass = newPassword || password
    if (!targetPass) return res.status(400).json({ error: 'New password is required.' })
    
    try {
      if (currentPassword) {
        const adminDoc = await db.collection('admins').doc(req.params.id).get()
        if (!adminDoc.exists) return res.status(404).json({ error: 'Admin not found.' })
        
        const match = await bcrypt.compare(currentPassword, adminDoc.data().password)
        if (!match) return res.status(400).json({ error: 'Incorrect current password.' })
      }
      
      const hashed = await bcrypt.hash(targetPass, 10)
      await db.collection('admins').doc(req.params.id).update({ password: hashed })
      res.json({ success: true, message: 'Password updated successfully.' })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── SAVE ADMIN PROFILE ──
  app.post('/api/admin/profile/save', async (req, res) => {
    const {
      adminId, firstName, middleName, lastName, email, phone, homeAddress, addressObj,
      role, empId, dept, assignedProjectSite, terminalId, pushNotificationsEnabled, biometricLoginEnabled, status
    } = req.body

    try {
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim()
      const addressObjStr = typeof addressObj === 'object' ? JSON.stringify(addressObj) : (addressObj || null)

      let targetId = adminId
      if (!targetId || targetId === 1) {
        // Find first admin if no valid ID provided
        const snapshot = await db.collection('admins').limit(1).get()
        if (snapshot.empty) return res.status(404).json({ error: 'No admin account found in database to update.' })
        targetId = snapshot.docs[0].id
      }

      const updateData = {
        full_name: fullName,
        first_name: firstName || null,
        middle_name: middleName || null,
        last_name: lastName || null,
        phone: phone || null,
        home_address: homeAddress || null,
        address_obj: addressObjStr,
        updated_at: FieldValue.serverTimestamp()
      }

      // Only update these if they are provided
      if (email !== undefined) updateData.email = email || null
      if (role !== undefined) updateData.role = role || null
      if (empId !== undefined) updateData.emp_id = empId || null
      if (dept !== undefined) updateData.dept = dept || null
      if (assignedProjectSite !== undefined) updateData.assigned_project_site = assignedProjectSite || null
      if (terminalId !== undefined) updateData.terminal_id = terminalId || null
      if (pushNotificationsEnabled !== undefined) updateData.push_notifications_enabled = pushNotificationsEnabled ? 1 : 0
      if (biometricLoginEnabled !== undefined) updateData.biometric_login_enabled = biometricLoginEnabled ? 1 : 0
      if (status !== undefined) updateData.status = status || null

      await db.collection('admins').doc(targetId).update(updateData)

      res.json({
        success: true,
        message: 'Admin profile saved successfully',
        data: {
          id: targetId, fullName, firstName, middleName, lastName, email, phone, homeAddress,
          addressObj: addressObj || {}, role: role || 'Administrator', empId: empId || 'SCON-ADMIN-001',
          dept: dept || 'Management', assignedProjectSite, terminalId, pushNotificationsEnabled, biometricLoginEnabled, status
        }
      })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })

  // ── GET ADMIN PROFILE ──
  app.get('/api/admin/profile/:id', async (req, res) => {
    const rawId = req.params.id
    let targetAdminId = (rawId && rawId !== 'undefined' && rawId !== 'null') ? rawId : null

    try {
      let adminDoc
      if (targetAdminId && targetAdminId !== '1') {
        adminDoc = await db.collection('admins').doc(targetAdminId).get()
      }
      
      if (!adminDoc || !adminDoc.exists) {
        const snapshot = await db.collection('admins').limit(1).get()
        if (snapshot.empty) return res.status(404).json({ error: 'Admin not found' })
        adminDoc = snapshot.docs[0]
      }

      const adminData = adminDoc.data()
      let parsedAddressObj = {}
      try {
        if (adminData.address_obj) {
          parsedAddressObj = typeof adminData.address_obj === 'string' ? JSON.parse(adminData.address_obj) : adminData.address_obj
        }
      } catch {
        parsedAddressObj = {}
      }

      res.json({
        id: adminDoc.id,
        username: adminData.username,
        email: adminData.email,
        fullName: adminData.full_name,
        firstName: adminData.first_name,
        middleName: adminData.middle_name,
        lastName: adminData.last_name,
        phone: adminData.phone,
        homeAddress: adminData.home_address,
        addressObj: parsedAddressObj,
        role: adminData.role || 'Administrator',
        empId: adminData.emp_id || 'SCON-ADMIN-001',
        dept: adminData.dept || 'Management',
        assignedProjectSite: adminData.assigned_project_site,
        terminalId: adminData.terminal_id,
        pushNotificationsEnabled: Boolean(adminData.push_notifications_enabled),
        biometricLoginEnabled: Boolean(adminData.biometric_login_enabled),
        status: adminData.status,
        createdAt: adminData.created_at,
        updatedAt: adminData.updated_at
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── UPDATE ADMIN SETTINGS ──
  app.put('/api/admin/:id/settings', async (req, res) => {
    const { pushNotificationsEnabled, biometricLoginEnabled, assignedProjectSite } = req.body

    try {
      await db.collection('admins').doc(req.params.id).update({
        push_notifications_enabled: pushNotificationsEnabled ? 1 : 0,
        biometric_login_enabled: biometricLoginEnabled ? 1 : 0,
        assigned_project_site: assignedProjectSite || null,
        updated_at: FieldValue.serverTimestamp()
      })
      res.json({ success: true, message: 'Settings updated successfully' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  const PORT = process.env.PORT || 5000
  app.listen(PORT, () => console.log('Server running on port ' + PORT))
}

startServer()
