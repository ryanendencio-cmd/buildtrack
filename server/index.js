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
    const { title, schedule_date, assigned_to, status, notes, category, schedule_time, supplier_name, check_no, amount } = req.body
    const link = scheduleLink(req.body)
    try {
      const newSchedule = {
        project_id: link.projectId, expense_id: link.expenseId, link_type: link.type,
        title, schedule_date, assigned_to: assigned_to || null, status: status || 'Scheduled', notes: notes || null,
        category: category || 'General',
        schedule_time: schedule_time || '09:00',
        supplier_name: supplier_name || null,
        check_no: check_no || null,
        amount: amount ? Number(amount) : null,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('schedules').add(newSchedule)
      recordNotification({
        type: 'Schedule',
        title: `New Schedule: ${title}`,
        message: `Schedule "${title}" was set for date ${schedule_date}${assigned_to ? ` [Assigned: ${assigned_to}]` : ''}${category ? ` (${category})` : ''}.`,
        severity: 'Medium',
        action: 'schedule_created'
      }).catch(() => {})
      recordAuditLog({
        action: 'SCHEDULE_CREATED',
        module: 'Schedules',
        description: `New schedule "${title}" was created for date ${schedule_date}${assigned_to ? ` [Assigned: ${assigned_to}]` : ''}.`,
        target_id: docRef.id,
        target_name: title,
        details: { schedule_date, assigned_to, status, notes, category, supplier_name, check_no, amount },
        req
      }).catch(() => {})
      res.json({ id: docRef.id, ...req.body, link_type: link.type, project_id: link.projectId, expense_id: link.expenseId })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
  app.put('/api/schedules/:id', async (req, res) => {
    const { title, schedule_date, assigned_to, status, notes, category, schedule_time, supplier_name, check_no, amount } = req.body
    const link = scheduleLink(req.body)
    try {
      await db.collection('schedules').doc(req.params.id).update({
        project_id: link.projectId, expense_id: link.expenseId, link_type: link.type,
        title, schedule_date, assigned_to: assigned_to || null, status, notes: notes || null,
        category: category || 'General',
        schedule_time: schedule_time || '09:00',
        supplier_name: supplier_name || null,
        check_no: check_no || null,
        amount: amount ? Number(amount) : null
      })
      recordNotification({
        type: 'Schedule',
        title: `Schedule Updated: ${title}`,
        message: `Schedule "${title}" was updated (Status: ${status || 'Updated'}, Date: ${schedule_date}).`,
        severity: 'Low',
        action: 'schedule_updated'
      }).catch(() => {})
      recordAuditLog({
        action: 'SCHEDULE_UPDATED',
        module: 'Schedules',
        description: `Schedule "${title}" was updated (Status: ${status || 'Updated'}, Date: ${schedule_date}).`,
        target_id: req.params.id,
        target_name: title,
        details: { schedule_date, assigned_to, status, notes, category, supplier_name, check_no, amount },
        req
      }).catch(() => {})
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
  app.delete('/api/schedules/:id', async (req, res) => {
    try {
      await db.collection('schedules').doc(req.params.id).delete()
      recordAuditLog({
        action: 'SCHEDULE_DELETED',
        module: 'Schedules',
        description: `Deleted schedule record ID #${req.params.id}.`,
        target_id: req.params.id,
        req
      }).catch(() => {})
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
      recordAuditLog({
        action: 'PROJECT_CREATED',
        module: 'Projects',
        description: `Created new project "${name}" with budget ₱${Number(budget || 0).toLocaleString()} (Status: ${targetStatus}).`,
        target_id: docRef.id,
        target_name: name,
        details: { budget, status: targetStatus, location, start_date, end_date },
        req
      }).catch(() => {})
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

      const projectRef = db.collection('projects').doc(req.params.id)
      const currentDoc = await projectRef.get()
      
      if (currentDoc.exists && budget !== undefined) {
        const currentBudget = Number(currentDoc.data().budget || 0)
        const newBudget = Number(budget || 0)
        if (newBudget > currentBudget) {
          await db.collection('budget_additions').add({
            project_id: req.params.id,
            amount: Math.round((newBudget - currentBudget) * 100) / 100,
            note: 'Budget modified from project settings',
            date: new Date().toISOString().slice(0, 10),
            created_at: FieldValue.serverTimestamp()
          })
        }
      }

      await projectRef.update(updateData)
      recordAuditLog({
        action: 'PROJECT_UPDATED',
        module: 'Projects',
        description: `Updated project "${name || currentDoc.data()?.name || 'Project'}" (Status: ${status || currentDoc.data()?.status || 'Active'}).`,
        target_id: req.params.id,
        target_name: name || currentDoc.data()?.name,
        details: updateData,
        req
      }).catch(() => {})
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const delDoc = await db.collection('projects').doc(req.params.id).get()
      const delName = delDoc.exists ? delDoc.data().name : `Project #${req.params.id}`
      await db.collection('projects').doc(req.params.id).delete()
      recordAuditLog({
        action: 'PROJECT_DELETED',
        module: 'Projects',
        description: `Deleted project "${delName}" [ID: ${req.params.id}].`,
        target_id: req.params.id,
        target_name: delName,
        req
      }).catch(() => {})
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
      recordAuditLog({
        action: 'BUDGET_ADDED',
        module: 'Projects',
        description: `Added ₱${Number(amount).toLocaleString()} budget to project "${projectDoc.data().name}" (New total: ₱${Number(next).toLocaleString()}).`,
        target_id: req.params.id,
        target_name: projectDoc.data().name,
        details: { amount, note, date, previous_budget: current, new_budget: next },
        req
      }).catch(() => {})
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
      const mSnapshot = await db.collection('materials').get()
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

      mSnapshot.docs.forEach(doc => {
        const data = doc.data()
        if (data.date) {
          const d = new Date(data.date)
          if (d.getFullYear() === year) {
            months[d.getMonth()] += (Number(data.qty || data.quantity || 0) * Number(data.cost || data.unit_cost || 0))
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
      const totalExpensesSpent = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)

      const mSnap = await db.collection('materials').get()
      const materials = mSnap.docs.map(d => d.data())
      const totalMaterialsCost = materials.reduce((sum, m) => sum + (Number(m.qty || m.quantity || 0) * Number(m.cost || m.unit_cost || 0)), 0)

      const totalSpent = totalExpensesSpent + totalMaterialsCost
      
      const catMap = {}
      expenses.forEach(e => {
        const cat = e.category || 'Uncategorized'
        catMap[cat] = (catMap[cat] || 0) + Number(e.amount || 0)
      })
      if (totalMaterialsCost > 0) {
        catMap['Materials'] = (catMap['Materials'] || 0) + totalMaterialsCost
      }
      const categories = Object.keys(catMap).map(category => ({ category, total: catMap[category] }))

      res.json({
        totalBudget,
        totalSpent,
        totalExpensesOnly: totalExpensesSpent,
        totalMaterialsOnly: totalMaterialsCost,
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
      const expenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      
      const mSnap = await db.collection('materials').get()
      const materials = mSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      const totalMaterialsCost = materials.reduce((sum, m) => sum + (Number(m.qty || m.quantity || 0) * Number(m.cost || m.unit_cost || 0)), 0)

      const totalExpensesOnly = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
      const total = totalExpensesOnly + totalMaterialsCost

      const getTime = (doc) => {
        if (doc.created_at) {
          if (typeof doc.created_at.toMillis === 'function') return doc.created_at.toMillis()
          if (doc.created_at._seconds) return doc.created_at._seconds * 1000
          if (doc.created_at.seconds) return doc.created_at.seconds * 1000
          const d = new Date(doc.created_at)
          if (!isNaN(d.getTime())) return d.getTime()
        }
        if (doc.date) {
          const d = new Date(doc.date)
          if (!isNaN(d.getTime())) return d.getTime()
        }
        return 0
      }

      const formattedExpenses = expenses.map(e => ({
        id: e.id,
        type: 'expense',
        category: e.category || 'Expense',
        description: e.category || 'Expense Receipt',
        amount: Number(e.amount || 0),
        date: e.date,
        timestamp: getTime(e)
      }))

      const formattedMaterials = materials.map(m => {
        const qty = Number(m.qty || m.quantity || 0)
        const cost = Number(m.cost || m.unit_cost || 0)
        const totalItemCost = qty * cost
        const unitStr = m.unit ? ` ${m.unit}` : ''
        return {
          id: m.id,
          type: 'material',
          category: 'Materials',
          name: m.name || 'Material Item',
          description: m.name ? `${m.name} (${qty}${unitStr})` : 'Material Usage Log',
          qty: m.qty || m.quantity,
          unit: m.unit,
          unit_cost: cost,
          amount: totalItemCost,
          date: m.date,
          timestamp: getTime(m)
        }
      })

      const recent = [...formattedExpenses, ...formattedMaterials]
        .sort((a, b) => {
          const dateComp = (b.date || '').localeCompare(a.date || '')
          if (dateComp !== 0) return dateComp
          return (b.timestamp || 0) - (a.timestamp || 0)
        })
        .slice(0, 20)
      
      res.json({ total, totalExpensesOnly, totalMaterialsCost, recent })
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

      // Prevent adding expenses to projects that are not ONGOING (e.g. Completed, Upcoming, Standby)
      let targetProjectDoc = null
      if (pid) {
        const pDoc = await db.collection('projects').doc(pid).get()
        if (pDoc.exists) targetProjectDoc = pDoc
      }
      if (!targetProjectDoc && project) {
        const pSnap = await db.collection('projects').where('name', '==', project).limit(1).get()
        if (!pSnap.empty) targetProjectDoc = pSnap.docs[0]
      }
      if (targetProjectDoc) {
        const pStatus = (targetProjectDoc.data().status || '').toUpperCase()
        const isOngoing = pStatus === 'ONGOING' || pStatus === 'ACTIVE'
        if (!isOngoing) {
          const displayStatus = targetProjectDoc.data().status || 'Not Ongoing'
          return res.status(400).json({
            error: `Bawal mag-add ng expenses sa proyektong hindi Ongoing ("${targetProjectDoc.data().name}"). Ang kasalukuyang status nito ay "${displayStatus}". Dapat ay ONGOING ang status ng proyekto.`
          })
        }
      }

      const newExpense = {
        project_id: pid || project_id || null, project, category, amount, receipt_no, date, time, 
        items: typeof items === 'string' ? JSON.parse(items) : (items || []), 
        cash_tendered, change, image: image || null,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('expenses').add(newExpense)
      recordNotification({
        type: 'Expenses',
        title: `Expense Logged: ₱${Number(amount || 0).toLocaleString()}`,
        message: `Logged expense under ${category} (₱${Number(amount || 0).toLocaleString()}) for project "${project || 'Site'}"${receipt_no ? ` [Receipt: ${receipt_no}]` : ''}.`,
        severity: Number(amount || 0) >= 10000 ? 'High' : 'Medium',
        action: 'expense_logged'
      }).catch(() => {})
      recordAuditLog({
        action: 'EXPENSE_CREATED',
        module: 'Expenses',
        description: `Logged expense of ₱${Number(amount || 0).toLocaleString()} under ${category} (Receipt #${receipt_no || 'N/A'}, Project: "${project || 'Site'}").`,
        target_id: docRef.id,
        target_name: receipt_no || `Expense #${docRef.id}`,
        details: { amount, category, project, receipt_no, date, items },
        req
      }).catch(() => {})
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
      recordAuditLog({
        action: 'EXPENSE_UPDATED',
        module: 'Expenses',
        description: `Updated expense record [ID: ${req.params.id}] (Receipt #${receipt_no || 'N/A'}, Amount: ₱${Number(amount || 0).toLocaleString()}).`,
        target_id: req.params.id,
        target_name: receipt_no || `Expense #${req.params.id}`,
        details: updateData,
        req
      }).catch(() => {})
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/expenses/:id', async (req, res) => {
    try {
      const expDoc = await db.collection('expenses').doc(req.params.id).get()
      const expData = expDoc.exists ? expDoc.data() : null
      await db.collection('expenses').doc(req.params.id).delete()
      recordAuditLog({
        action: 'EXPENSE_DELETED',
        module: 'Expenses',
        description: `Deleted expense record [ID: ${req.params.id}]${expData?.receipt_no ? ` (Receipt #${expData.receipt_no}, Amount: ₱${Number(expData.amount || 0).toLocaleString()})` : ''}.`,
        target_id: req.params.id,
        target_name: expData?.receipt_no,
        details: expData,
        req
      }).catch(() => {})
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

  // ── RECORD NOTIFICATION HELPER (For Worker & Staff Actions) ──
  async function recordNotification({
    type = 'Staff & Workers',
    title,
    message,
    severity = 'Medium',
    actor_name = null,
    actor_role = null,
    action = null,
    link = null,
    worker_id = null,
    target_id = null
  }) {
    try {
      const now = new Date()
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

      const notifData = {
        type,
        title,
        message,
        severity,
        actor_name: actor_name || null,
        actor_role: actor_role || null,
        action: action || null,
        link: link || null,
        worker_id: worker_id || target_id || null,
        target_id: target_id || worker_id || null,
        date: dateStr,
        time: timeStr,
        read: false,
        timestamp: now.getTime(),
        created_at: FieldValue.serverTimestamp()
      }

      const docRef = await db.collection('notifications').add(notifData)
      return { id: docRef.id, ...notifData }
    } catch (err) {
      console.error('Failed to record notification:', err.message)
      return null
    }
  }

  // ── NOTIFICATIONS ENDPOINT ──
  app.get('/api/notifications', async (req, res) => {
    const alerts = []
    try {
      const today = new Date()
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

      // 1. SCHEDULE DEADLINE WARNINGS (3 days or fewer remaining)
      const schedSnap = await db.collection('schedules').get()
      for (const sDoc of schedSnap.docs) {
        const s = sDoc.data()
        const sStatus = (s.status || '').toLowerCase()
        if (sStatus === 'completed' || sStatus === 'done') continue
        if (!s.schedule_date) continue

        const sDateClean = String(s.schedule_date).slice(0, 10)
        const parts = sDateClean.split('-').map(Number)
        if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) continue
        const targetMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime()
        const diffDays = Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24))

        let pName = s.project_name || null
        if (!pName && s.project_id) {
          try {
            const pDoc = await db.collection('projects').doc(s.project_id).get()
            if (pDoc.exists) pName = pDoc.data().name
          } catch (_) {}
        }

        if (diffDays <= 3 && diffDays >= 0) {
          let dayLabel = ''
          let severity = 'Medium'
          if (diffDays === 0) {
            dayLabel = 'Due Today'
            severity = 'High'
          } else if (diffDays === 1) {
            dayLabel = 'Due Tomorrow (1 day remaining)'
            severity = 'High'
          } else {
            dayLabel = `${diffDays} days remaining`
            severity = 'Medium'
          }

          alerts.push({
            id: `schedule-warning-${sDoc.id}-${sDateClean}`,
            type: 'Schedule',
            title: diffDays === 0 ? `Schedule Alert: Due Today!` : `Schedule Warning: ${diffDays} Days Remaining!`,
            message: `Schedule "${s.title}"${pName ? ` for Project "${pName}"` : ''} is set for ${sDateClean} (${dayLabel})${s.assigned_to ? ` [Assigned to: ${s.assigned_to}]` : ''}.`,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: 'Schedule Alert',
            read: false,
            severity,
            timestamp: targetMidnight
          })
        } else if (diffDays < 0 && diffDays >= -7) {
          alerts.push({
            id: `schedule-overdue-${sDoc.id}-${sDateClean}`,
            type: 'Schedule',
            title: `Overdue Schedule Alert (${Math.abs(diffDays)} days overdue)`,
            message: `Schedule "${s.title}"${pName ? ` (${pName})` : ''} set for ${sDateClean} is overdue and not yet completed.`,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: 'Overdue Alert',
            read: false,
            severity: 'High',
            timestamp: targetMidnight
          })
        }
      }

      // 2. PROJECT TARGET COMPLETION SCHEDULE WARNINGS (3 days or fewer)
      const pSnap = await db.collection('projects').get()
      for (const pDoc of pSnap.docs) {
        const p = pDoc.data()
        const pStatus = (p.status || '').toUpperCase()
        if (pStatus === 'COMPLETED') continue

        if (p.end_date) {
          const pDateClean = String(p.end_date).slice(0, 10)
          const pParts = pDateClean.split('-').map(Number)
          if (pParts.length >= 3 && !isNaN(pParts[0]) && !isNaN(pParts[1]) && !isNaN(pParts[2])) {
            const targetMidnight = new Date(pParts[0], pParts[1] - 1, pParts[2]).getTime()
            const diffDays = Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24))

            if (diffDays <= 3 && diffDays >= 0) {
              alerts.push({
                id: `project-schedule-${pDoc.id}-${pDateClean}`,
                type: 'Schedule',
                title: diffDays === 0 ? `Project Deadline Alert: Due Today!` : `Project Schedule Warning (${diffDays} Days Remaining)`,
                message: `Target completion for project "${p.name}" is on ${pDateClean} (${diffDays === 0 ? 'Due Today' : `${diffDays} days remaining`}).`,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                time: 'Project Deadline',
                read: false,
                severity: 'High',
                timestamp: targetMidnight
              })
            }
          }
        }

        // Budget warnings
        if (p.budget && Number(p.budget) > 0) {
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
              severity: pct >= 95 ? 'High' : 'Medium',
              timestamp: Date.now()
            })
          }
        }
      }

      // 3. Equipment in use alerts
      const aSnap = await db.collection('assets').where('status', '==', 'In Use').get()
      aSnap.docs.forEach(aDoc => {
        const a = aDoc.data()
        alerts.push({
          id: `asset-${aDoc.id}`,
          type: 'Tools',
          title: 'Equipment Currently In Use',
          message: `"${a.name}" is currently borrowed${a.assigned_to ? ` by ${a.assigned_to}` : ''}.`,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          read: false,
          severity: 'Medium',
          timestamp: Date.now()
        })
      })

      // 4. Large expenses
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
            severity: 'Medium',
            timestamp: new Date(e.date).getTime() || Date.now()
          })
        })
      }

      // 5. FETCH RECORDED WORKER & STAFF ACTION NOTIFICATIONS
      const savedSnap = await db.collection('notifications').get()
      const savedList = savedSnap.docs.map(doc => {
        const d = doc.data()
        return {
          id: doc.id,
          type: d.type || 'Staff & Workers',
          title: d.title,
          message: d.message,
          date: d.date || (d.created_at?._seconds ? new Date(d.created_at._seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })),
          time: d.time || (d.created_at?._seconds ? new Date(d.created_at._seconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : null),
          read: Boolean(d.read),
          severity: d.severity || 'Medium',
          actor_name: d.actor_name || null,
          actor_role: d.actor_role || null,
          action: d.action || null,
          link: d.link || null,
          worker_id: d.worker_id || d.target_id || null,
          target_id: d.target_id || d.worker_id || null,
          timestamp: d.timestamp || (d.created_at?._seconds ? d.created_at._seconds * 1000 : 0)
        }
      })

      const combined = [...alerts, ...savedList]
      combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

      res.json(combined)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // POST /api/notifications (Explicitly record action notification)
  app.post('/api/notifications', async (req, res) => {
    const { type, title, message, severity, actor_name, actor_role, action, link } = req.body
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required.' })
    }
    const result = await recordNotification({
      type: type || 'Staff & Workers',
      title,
      message,
      severity: severity || 'Medium',
      actor_name,
      actor_role,
      action,
      link
    })
    if (result) {
      res.json({ success: true, notification: result })
    } else {
      res.status(500).json({ error: 'Failed to record notification.' })
    }
  })

  // PUT /api/notifications/:id/read
  app.put('/api/notifications/:id/read', async (req, res) => {
    try {
      const docRef = db.collection('notifications').doc(req.params.id)
      const doc = await docRef.get()
      if (doc.exists) {
        await docRef.update({ read: true, updated_at: FieldValue.serverTimestamp() })
      }
      res.json({ success: true })
    } catch (err) {
      res.json({ success: true })
    }
  })

  // PUT /api/notifications/mark-all-read
  app.put('/api/notifications/mark-all-read', async (req, res) => {
    try {
      const snap = await db.collection('notifications').where('read', '==', false).get()
      const batch = db.batch()
      snap.docs.forEach(doc => {
        batch.update(doc.ref, { read: true })
      })
      await batch.commit()
      res.json({ success: true })
    } catch (err) {
      res.json({ success: true })
    }
  })

  // ── AUDIT LOG HELPER (Security & Action Governance Trail) ──
  async function recordAuditLog({
    action,
    module,
    description,
    actor_name = null,
    actor_role = null,
    actor_id = null,
    target_id = null,
    target_name = null,
    details = null,
    status = 'SUCCESS',
    req = null
  }) {
    try {
      const now = new Date()
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

      let ip_address = '127.0.0.1'
      let user_agent = 'Web Browser'

      if (req) {
        const rawIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1'
        ip_address = typeof rawIp === 'string' ? rawIp.split(',')[0].trim().replace(/^::ffff:/, '') : '127.0.0.1'
        user_agent = req.headers['user-agent'] || 'Web Browser'
      }

      let finalActorName = actor_name
      let finalActorRole = actor_role
      let finalActorId = actor_id

      if (!finalActorName && req) {
        finalActorName = req.body?.actor_name || req.body?.updated_by || req.body?.set_by || req.headers['x-actor-name'] || 'Administrator'
        finalActorRole = req.body?.actor_role || req.headers['x-actor-role'] || 'Administrator'
      }

      const logData = {
        action: action || 'ACTION_LOGGED',
        module: module || 'System',
        description: description || '',
        actor_name: finalActorName || 'Administrator',
        actor_role: finalActorRole || 'Administrator',
        actor_id: finalActorId || null,
        target_id: target_id ? String(target_id) : null,
        target_name: target_name ? String(target_name) : null,
        details: details || null,
        ip_address: String(ip_address),
        user_agent: String(user_agent),
        status: status || 'SUCCESS',
        date: dateStr,
        time: timeStr,
        timestamp: now.getTime(),
        created_at: FieldValue.serverTimestamp()
      }

      const docRef = await db.collection('audit_logs').add(logData)
      return { id: docRef.id, ...logData }
    } catch (err) {
      console.error('Failed to record audit log:', err.message)
      return null
    }
  }

  // ── AUDIT LOG BACKFILL SEEDER (Populate initial activity trail if empty) ──
  async function backfillAuditLogsIfEmpty() {
    try {
      const snap = await db.collection('audit_logs').limit(1).get()
      if (!snap.empty) return

      console.log('Seeding initial audit logs from existing system activity...')
      const now = Date.now()

      // 1. Initial System Setup / Admin Log
      await db.collection('audit_logs').add({
        action: 'SYSTEM_AUDIT_INITIALIZED',
        module: 'Authentication',
        description: 'Successfully initialized Security Audit Trail for BuildTrack.',
        actor_name: 'Administrator',
        actor_role: 'Administrator',
        ip_address: '127.0.0.1',
        user_agent: 'BuildTrack Core System',
        status: 'SUCCESS',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        timestamp: now - (86400000 * 4),
        created_at: FieldValue.serverTimestamp()
      })

      // 2. Existing Projects
      const projectsSnap = await db.collection('projects').get()
      for (const doc of projectsSnap.docs) {
        const p = doc.data()
        const pTime = p.created_at?._seconds ? p.created_at._seconds * 1000 : (now - 86400000 * 3)
        const dateObj = new Date(pTime)
        await db.collection('audit_logs').add({
          action: 'PROJECT_CREATED',
          module: 'Projects',
          description: `Created construction project "${p.name || 'Project'}" (Location: ${p.location || 'N/A'}, Budget: ₱${Number(p.allocated_budget || 0).toLocaleString()}).`,
          actor_name: 'Administrator',
          actor_role: 'Administrator',
          target_id: doc.id,
          target_name: p.name,
          ip_address: '127.0.0.1',
          user_agent: 'Web App',
          status: 'SUCCESS',
          date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          timestamp: pTime,
          created_at: FieldValue.serverTimestamp()
        })
      }

      // 3. Existing Workers
      const workersSnap = await db.collection('workers').get()
      for (const doc of workersSnap.docs) {
        const w = doc.data()
        const wTime = w.created_at?._seconds ? w.created_at._seconds * 1000 : (now - 86400000 * 2)
        const dateObj = new Date(wTime)
        await db.collection('audit_logs').add({
          action: 'WORKER_REGISTERED',
          module: 'Workers',
          description: `Worker ${w.full_name || 'Worker'} (${w.position || w.role || 'Staff'}) registered into system.`,
          actor_name: w.full_name || 'Worker',
          actor_role: w.position || w.role || 'Worker',
          actor_id: doc.id,
          target_id: doc.id,
          target_name: w.full_name,
          ip_address: '127.0.0.1',
          user_agent: 'Mobile App',
          status: 'SUCCESS',
          date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          timestamp: wTime,
          created_at: FieldValue.serverTimestamp()
        })
      }

      // 4. Existing Expenses
      const expensesSnap = await db.collection('expenses').limit(25).get()
      for (const doc of expensesSnap.docs) {
        const exp = doc.data()
        const expTime = exp.created_at?._seconds ? exp.created_at._seconds * 1000 : (now - 86400000)
        const dateObj = new Date(expTime)
        await db.collection('audit_logs').add({
          action: 'EXPENSE_RECORDED',
          module: 'Expenses',
          description: `Recorded expense of ₱${Number(exp.amount || 0).toLocaleString()} for "${exp.desc || exp.category || 'Expense'}" at ${exp.project || 'Project Site'}.`,
          actor_name: 'Administrator',
          actor_role: 'Administrator',
          target_id: doc.id,
          target_name: exp.desc || exp.category,
          ip_address: '127.0.0.1',
          user_agent: 'Web App',
          status: 'SUCCESS',
          date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          timestamp: expTime,
          created_at: FieldValue.serverTimestamp()
        })
      }

      // 5. Existing Attendance
      const attSnap = await db.collection('attendance').limit(25).get()
      for (const doc of attSnap.docs) {
        const a = doc.data()
        const aTime = a.created_at?._seconds ? a.created_at._seconds * 1000 : now
        const dateObj = new Date(aTime)
        await db.collection('audit_logs').add({
          action: 'ATTENDANCE_RECORDED',
          module: 'Attendance',
          description: `Recorded attendance for ${a.worker_name || 'Worker'} (${a.role || 'Worker'}): ${a.status || 'Present'} on ${a.date || 'N/A'}.`,
          actor_name: a.worker_name || 'Timekeeper',
          actor_role: a.role || 'Worker',
          actor_id: a.worker_id || null,
          target_id: doc.id,
          target_name: a.worker_name,
          ip_address: '127.0.0.1',
          user_agent: 'Mobile App',
          status: 'SUCCESS',
          date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          timestamp: aTime,
          created_at: FieldValue.serverTimestamp()
        })
      }
      console.log('Seeding initial audit logs complete.')
    } catch (err) {
      console.error('Error backfilling audit logs:', err.message)
    }
  }

  // ── AUDIT LOGS ENDPOINTS ──
  app.get('/api/audit-logs', async (req, res) => {
    try {
      const { module, action, status, search, startDate, endDate, limit = 250 } = req.query
      let snap = await db.collection('audit_logs').get()
      if (snap.empty) {
        await backfillAuditLogsIfEmpty()
        snap = await db.collection('audit_logs').get()
      }
      let results = snap.docs.map(doc => {
        const d = doc.data()
        return {
          id: doc.id,
          ...d,
          date: d.date || (d.created_at?._seconds ? new Date(d.created_at._seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''),
          time: d.time || (d.created_at?._seconds ? new Date(d.created_at._seconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''),
          timestamp: d.timestamp || (d.created_at?._seconds ? d.created_at._seconds * 1000 : 0)
        }
      })

      // Exclude Cash Advance logs
      results = results.filter(log => log.module !== 'Cash Advance' && !String(log.action || '').startsWith('CASH_ADVANCE'))

      // Sort descending by timestamp
      results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

      // Filter by module
      if (module && module !== 'All') {
        results = results.filter(log => String(log.module || '').toLowerCase() === String(module).toLowerCase())
      }

      // Filter by action type
      if (action && action !== 'All') {
        results = results.filter(log => String(log.action || '').toLowerCase().includes(String(action).toLowerCase()))
      }

      // Filter by status
      if (status && status !== 'All') {
        results = results.filter(log => String(log.status || '').toUpperCase() === String(status).toUpperCase())
      }

      // Filter by search keyword
      if (search) {
        const q = String(search).toLowerCase().trim()
        results = results.filter(log =>
          (log.description || '').toLowerCase().includes(q) ||
          (log.actor_name || '').toLowerCase().includes(q) ||
          (log.action || '').toLowerCase().includes(q) ||
          (log.target_name || '').toLowerCase().includes(q) ||
          (log.ip_address || '').toLowerCase().includes(q) ||
          (log.module || '').toLowerCase().includes(q)
        )
      }

      // Filter by date range
      if (startDate) {
        const startMs = new Date(startDate).setHours(0, 0, 0, 0)
        results = results.filter(log => (log.timestamp || 0) >= startMs)
      }
      if (endDate) {
        const endMs = new Date(endDate).setHours(23, 59, 59, 999)
        results = results.filter(log => (log.timestamp || 0) <= endMs)
      }

      const maxLimit = parseInt(limit, 10) || 250
      res.json(results.slice(0, maxLimit))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/audit-logs', async (req, res) => {
    try {
      const { action, module, description, actor_name, actor_role, target_id, target_name, details, status } = req.body
      const log = await recordAuditLog({
        action, module, description, actor_name, actor_role, target_id, target_name, details, status, req
      })
      res.json({ success: true, log })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/audit-logs/stats', async (req, res) => {
    try {
      const snap = await db.collection('audit_logs').get()
      const rawLogs = snap.docs.map(doc => doc.data())
      const logs = rawLogs.filter(l => l.module !== 'Cash Advance' && !String(l.action || '').startsWith('CASH_ADVANCE'))
      const todayStart = new Date().setHours(0, 0, 0, 0)

      const total = logs.length
      const todayCount = logs.filter(l => (l.timestamp || 0) >= todayStart).length
      const authCount = logs.filter(l => l.module === 'Authentication').length
      const financialCount = logs.filter(l => ['Expenses', 'Projects'].includes(l.module)).length
      const workforceCount = logs.filter(l => ['Workers', 'Attendance', 'Tools', 'Materials'].includes(l.module)).length

      res.json({ total, todayCount, authCount, financialCount, workforceCount })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Helper: check if a date is designated as a non-working day
  async function isDateNonWorkingDay(dateStr) {
    if (!dateStr) return { isNonWorking: false };

    let autoSundaysOff = true;
    try {
      const settingsDoc = await db.collection('settings').doc('attendance').get();
      if (settingsDoc.exists && settingsDoc.data().auto_sundays_off !== undefined) {
        autoSundaysOff = Boolean(settingsDoc.data().auto_sundays_off);
      }
    } catch (_) {}

    const d = new Date(dateStr + 'T00:00:00');
    if (autoSundaysOff && d.getDay() === 0) {
      return {
        isNonWorking: true,
        reason: 'Sunday Rest Day',
        type: 'Sunday'
      };
    }

    try {
      const snap = await db.collection('non_working_days').where('date', '==', dateStr).limit(1).get();
      if (!snap.empty) {
        const data = snap.docs[0].data();
        return {
          isNonWorking: true,
          reason: data.reason || 'Declared Non-Working Day',
          type: data.type || 'Holiday/Suspension',
          set_by: data.set_by || 'Admin / Attendance Officer'
        };
      }
    } catch (_) {}

    return { isNonWorking: false };
  }

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
      
      const checkNW = await isDateNonWorkingDay(today)
      const isNonWorking = checkNW.isNonWorking

      const presentToday = attendance.filter(a => a.status === 'Present').length
      // On non-working days, workers must NOT be counted as absent!
      const absent = isNonWorking ? 0 : attendance.filter(a => a.status === 'Absent').length
      
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
        todayPayroll,
        is_non_working_day: isNonWorking,
        non_working_reason: checkNW.reason || null
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

  app.get('/api/workers/:id', async (req, res) => {
    try {
      const doc = await db.collection('workers').doc(req.params.id).get()
      if (!doc.exists) return res.status(404).json({ error: 'Worker not found' })
      const data = doc.data()
      delete data.password
      res.json({ id: doc.id, ...data })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/workers', async (req, res) => {
    const { first_name, middle_name, last_name, full_name, birthday, age, phone, address, role, position, daily_rate, password, approval_status, status, project_id, address_obj, rfid_uid } = req.body
    const computedFullName = full_name || [first_name, middle_name, last_name].filter(Boolean).join(' ')
    const cleanPassword = (typeof password === 'string' && password.trim().length > 0) ? password.trim() : 'worker123'
    const hashedPassword = await bcrypt.hash(cleanPassword, 10)
    const cleanPosition = Array.isArray(position)
      ? position.filter(Boolean).join(', ')
      : (typeof position === 'string' && position.trim().length > 0 ? position.trim() : null)
    const cleanRfid = rfid_uid ? String(rfid_uid).trim().replace(/[\s:]/g, '').toUpperCase() : null
    
    try {
      if (cleanRfid) {
        const existRfid = await db.collection('workers').where('rfid_uid', '==', cleanRfid).limit(1).get()
        if (!existRfid.empty) {
          return res.status(400).json({ error: `RFID card UID (${cleanRfid}) is already assigned to another worker.` })
        }
      }

      const newWorker = {
        first_name, middle_name: middle_name || null, last_name, full_name: computedFullName, 
        birthday: birthday || null, age: age || null, phone: phone || null, address: address || null, 
        address_obj: address_obj || null,
        role: role || 'Worker', position: cleanPosition, daily_rate: daily_rate || 600, 
        rfid_uid: cleanRfid || null,
        password: hashedPassword, approval_status: approval_status || 'Approved', 
        status: status || 'Active', project_id: project_id || null,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('workers').add(newWorker)
      recordNotification({
        type: 'Staff & Workers',
        title: `New Worker Profile: ${computedFullName}`,
        message: `Added ${computedFullName} as ${cleanPosition || role || 'Worker'} to the workforce directory.`,
        severity: 'Low',
        actor_name: computedFullName,
        actor_role: cleanPosition || role || 'Worker',
        action: 'worker_created',
        worker_id: docRef.id,
        target_id: docRef.id,
        link: `/workers?id=${docRef.id}`
      }).catch(() => {})
      recordAuditLog({
        action: 'WORKER_CREATED',
        module: 'Workers',
        description: `Created worker profile for "${computedFullName}" (${cleanPosition || role || 'Worker'}, Rate: ₱${daily_rate || 600}/day${cleanRfid ? `, RFID: ${cleanRfid}` : ''}).`,
        target_id: docRef.id,
        target_name: computedFullName,
        details: { role, position: cleanPosition, daily_rate: daily_rate || 600, status: status || 'Active', rfid_uid: cleanRfid },
        req
      }).catch(() => {})
      res.json({ id: docRef.id, ...req.body, position: cleanPosition, full_name: computedFullName, rfid_uid: cleanRfid, approval_status: approval_status || 'Approved' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/workers/:id', async (req, res) => {
    const { first_name, middle_name, last_name, full_name, birthday, age, phone, address, role, position, daily_rate, password, approval_status, status, project_id, address_obj, rfid_uid } = req.body
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
      if (rfid_uid !== undefined) {
        const cleanRfid = rfid_uid ? String(rfid_uid).trim().replace(/[\s:]/g, '').toUpperCase() : null
        if (cleanRfid) {
          const existRfid = await db.collection('workers').where('rfid_uid', '==', cleanRfid).limit(1).get()
          if (!existRfid.empty && existRfid.docs[0].id !== req.params.id) {
            return res.status(400).json({ error: `RFID card UID (${cleanRfid}) is already assigned to another worker.` })
          }
        }
        updateData.rfid_uid = cleanRfid || null
      }
      if (typeof password === 'string' && password.trim().length > 0) {
        const trimmedPass = password.trim()
        // If password is already a bcrypt hash ($2a$ or $2b$), do NOT re-hash it!
        if (!trimmedPass.startsWith('$2a$') && !trimmedPass.startsWith('$2b$')) {
          updateData.password = await bcrypt.hash(trimmedPass, 10)
        }
      }
      await db.collection('workers').doc(req.params.id).update(updateData)
      recordNotification({
        type: 'Staff & Workers',
        title: `Worker Profile Updated: ${computedFullName}`,
        message: `Profile data updated for ${computedFullName} (${cleanPosition || role || 'Worker'}).`,
        severity: 'Low',
        actor_name: computedFullName,
        actor_role: cleanPosition || role || 'Worker',
        action: 'worker_updated',
        worker_id: req.params.id,
        target_id: req.params.id,
        link: `/workers?id=${req.params.id}`
      }).catch(() => {})
      recordAuditLog({
        action: 'WORKER_UPDATED',
        module: 'Workers',
        description: `Updated worker record for "${computedFullName}" (${cleanPosition || role || 'Worker'}, Status: ${status || 'Active'}, Approval: ${approval_status || 'Approved'}).`,
        target_id: req.params.id,
        target_name: computedFullName,
        details: { role, position: cleanPosition, status, approval_status, daily_rate },
        req
      }).catch(() => {})
      res.json({ success: true, position: cleanPosition })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/workers/:id', async (req, res) => {
    try {
      const wDoc = await db.collection('workers').doc(req.params.id).get()
      const wName = wDoc.exists ? (wDoc.data().full_name || `Worker #${req.params.id}`) : `Worker #${req.params.id}`
      await db.collection('workers').doc(req.params.id).delete()
      recordAuditLog({
        action: 'WORKER_DELETED',
        module: 'Workers',
        description: `Deleted worker record for "${wName}" [ID: ${req.params.id}].`,
        target_id: req.params.id,
        target_name: wName,
        req
      }).catch(() => {})
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

  // ── ATTENDANCE SETTINGS & NON-WORKING DAYS ──
  app.get('/api/attendance-settings', async (req, res) => {
    try {
      const doc = await db.collection('settings').doc('attendance').get()
      if (doc.exists) {
        res.json({
          auto_schedule: true,
          open_time: '07:00',
          close_time: '17:30',
          auto_sundays_off: true,
          manual_override: null,
          ...doc.data()
        })
      } else {
        res.json({
          auto_schedule: true,
          open_time: '07:00',
          close_time: '17:30',
          auto_sundays_off: true,
          manual_override: null
        })
      }
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/attendance-settings', async (req, res) => {
    const { auto_schedule, open_time, close_time, auto_sundays_off, manual_override, updated_by } = req.body
    try {
      const updateData = {
        auto_schedule: auto_schedule !== undefined ? Boolean(auto_schedule) : true,
        open_time: open_time || '07:00',
        close_time: close_time || '17:30',
        auto_sundays_off: auto_sundays_off !== undefined ? Boolean(auto_sundays_off) : true,
        manual_override: manual_override !== undefined ? manual_override : null,
        updated_by: updated_by || 'Admin / Attendance Monitoring Officer',
        updated_at: FieldValue.serverTimestamp()
      }
      await db.collection('settings').doc('attendance').set(updateData, { merge: true })
      recordAuditLog({
        action: 'ATTENDANCE_SETTINGS_UPDATED',
        module: 'Settings',
        description: `Updated shift schedule settings: Open ${open_time}, Close ${close_time}, Auto-Sundays: ${updateData.auto_sundays_off ? 'Active' : 'Disabled'}${manual_override ? ` (Override: ${manual_override})` : ''}.`,
        actor_name: updated_by || 'Admin / Attendance Monitoring Officer',
        details: updateData,
        req
      }).catch(() => {})
      res.json({ success: true, ...updateData })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/non-working-days', async (req, res) => {
    try {
      const snap = await db.collection('non_working_days').get()
      const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      results.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/non-working-days', async (req, res) => {
    const { date, reason, type, set_by } = req.body
    if (!date) return res.status(400).json({ error: 'Date is required.' })
    try {
      const docRef = db.collection('non_working_days').doc(date)
      const data = {
        date,
        reason: reason || 'Non-Working Day',
        type: type || 'Holiday',
        set_by: set_by || 'Admin / Attendance Monitoring Officer',
        created_at: FieldValue.serverTimestamp()
      }
      await docRef.set(data, { merge: true })
      recordAuditLog({
        action: 'NON_WORKING_DAY_DECLARED',
        module: 'Attendance',
        description: `Declared ${date} as Non-Working Day (${reason || 'Rest Day'}).`,
        actor_name: set_by || 'Admin / Attendance Monitoring Officer',
        target_id: date,
        details: data,
        req
      }).catch(() => {})
      res.json({ id: date, ...data })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/non-working-days/:date', async (req, res) => {
    try {
      await db.collection('non_working_days').doc(req.params.date).delete()
      recordAuditLog({
        action: 'NON_WORKING_DAY_REVERTED',
        module: 'Attendance',
        description: `Reverted Non-Working Day status for date ${req.params.date} back to regular working day.`,
        target_id: req.params.date,
        req
      }).catch(() => {})
      res.json({ success: true, date: req.params.date })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

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
    let status = req.body.status && req.body.status !== 'Present' ? req.body.status : evaluated.status

    try {
      const checkNW = await isDateNonWorkingDay(finalDate)
      if (checkNW.isNonWorking) {
        if (!status || status === 'Absent') {
          status = 'Rest Day / Non-Working'
        }
      }

      const earnedAmount = (status === 'Absent' || status === 'Rest Day / Non-Working') ? 0 : evaluated.earnedAmount
      const pid = await resolveProjectId(project_id)
      const newAttendance = {
        project_id: pid || project_id || null, worker_id: worker_id || null, worker_name: finalName, date: finalDate, role: role || 'Laborer',
        morning_in: mIn || '—', morning_out: mOut || '—', afternoon_in: aIn || '—', afternoon_out: aOut || '—',
        morning_status: evaluated.morningStatus, afternoon_status: evaluated.afternoonStatus,
        time_in: mIn || aIn || '—', time_out: aOut || mOut || '—', rate: baseRate, earned_amount: earnedAmount, advance: advance || 0, status,
        created_at: FieldValue.serverTimestamp()
      }
      const docRef = await db.collection('attendance').add(newAttendance)
      
      recordNotification({
        type: 'Staff & Workers',
        title: `Attendance Logged: ${finalName}`,
        message: `Recorded attendance for ${finalName} (${role || 'Worker'}): ${status} (${mIn ? `Morning In: ${mIn}` : (aIn ? `Afternoon In: ${aIn}` : `Time: ${timeIn || 'Logged'}`)}).`,
        severity: (status === 'Late' || status === 'Double Late') ? 'Medium' : 'Low',
        actor_name: finalName,
        actor_role: role || 'Worker',
        action: 'attendance_in'
      }).catch(() => {})

      recordAuditLog({
        action: 'ATTENDANCE_RECORDED',
        module: 'Attendance',
        description: `Recorded attendance for ${finalName} (${role || 'Worker'}): ${status} (${mIn ? `Morning In: ${mIn}` : (aIn ? `Afternoon In: ${aIn}` : `Time: ${timeIn || 'Logged'}`)}).`,
        actor_name: finalName,
        actor_role: role || 'Worker',
        actor_id: worker_id,
        target_id: docRef.id,
        target_name: finalName,
        details: { status, date: finalDate, earnedAmount, morningIn: mIn, afternoonIn: aIn },
        req
      }).catch(() => {})

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

  // ── HARDWARE RFID SCAN & LIVE PAIRING (FOR ESP32 / PHYSICAL TERMINALS) ──
  let latestRfidScan = { uid: null, timestamp: 0, terminal_id: null }

  app.get('/api/rfid/latest-scan', (req, res) => {
    res.json(latestRfidScan)
  })

  app.post('/api/attendance/scan', async (req, res) => {
    const { rfid_uid, terminal_id } = req.body
    const cleanUid = rfid_uid ? String(rfid_uid).trim().replace(/[\s:]/g, '').toUpperCase() : null
    const terminalId = terminal_id || 'ESP32-GATE-TERMINAL'

    if (!cleanUid) {
      return res.status(400).json({ success: false, error: 'RFID UID is required.' })
    }

    // Cache the latest scan so admin UI can auto-detect and populate newly tapped cards
    latestRfidScan = {
      uid: cleanUid,
      timestamp: Date.now(),
      terminal_id: terminalId
    }

    try {
      // 1. Look up worker by rfid_uid
      const workerSnap = await db.collection('workers').where('rfid_uid', '==', cleanUid).limit(1).get()
      if (workerSnap.empty) {
        recordAuditLog({
          action: 'RFID_SCAN_UNREGISTERED',
          module: 'Attendance',
          description: `Unregistered RFID card tapped [UID: ${cleanUid}] at terminal "${terminalId}".`,
          actor_name: 'Unknown / RFID Card',
          actor_role: 'Anonymous',
          status: 'FAILED',
          details: { rfid_uid: cleanUid, terminal_id: terminalId },
          req
        }).catch(() => {})

        return res.status(404).json({
          success: false,
          error: `Unregistered RFID card (${cleanUid}). Please assign this card to a worker first.`,
          rfid_uid: cleanUid
        })
      }

      const workerDoc = workerSnap.docs[0]
      const worker = workerDoc.data()
      const workerId = workerDoc.id
      const workerName = worker.full_name || [worker.first_name, worker.last_name].filter(Boolean).join(' ') || 'Worker'
      const workerRole = worker.role || 'Worker'
      const workerRate = Number(worker.daily_rate) || 600
      const projectId = worker.project_id || (await resolveProjectId('1')) || null

      // Check worker status
      if (worker.approval_status && worker.approval_status !== 'Approved') {
        return res.status(403).json({
          success: false,
          error: `Worker "${workerName}" is pending admin approval.`,
          worker_name: workerName
        })
      }

      if (worker.status && worker.status === 'Inactive') {
        return res.status(403).json({
          success: false,
          error: `Worker "${workerName}" is set to Inactive.`,
          worker_name: workerName
        })
      }

      // 2. Check Date & Terminal Schedule Settings
      const now = new Date()
      const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      const todayISO = now.toISOString().slice(0, 10)
      const minutes = parseTimeToMinutes(timeString)

      const nwCheck = await isDateNonWorkingDay(todayISO)
      if (nwCheck.isNonWorking) {
        return res.status(400).json({
          success: false,
          error: `Today is marked as a Non-Working Day (${nwCheck.reason || 'Rest Day'}). Attendance is closed.`,
          worker_name: workerName
        })
      }

      // Check shift terminal settings
      const settingsDoc = await db.collection('settings').doc('attendance').get()
      if (settingsDoc.exists) {
        const sData = settingsDoc.data()
        if (sData.manual_override === 'CLOSED') {
          return res.status(400).json({
            success: false,
            error: 'Attendance kiosk is currently manually closed by Admin.',
            worker_name: workerName
          })
        }
        if (sData.auto_schedule && sData.manual_override !== 'OPEN') {
          const openM = parseTimeToMinutes(sData.open_time || '07:00') || (7 * 60)
          const closeM = parseTimeToMinutes(sData.close_time || '17:30') || (17 * 60 + 30)
          if (minutes < openM) {
            return res.status(400).json({
              success: false,
              error: `Attendance is closed before shift. Opens at ${sData.open_time}.`,
              worker_name: workerName
            })
          }
          if (minutes > closeM) {
            return res.status(400).json({
              success: false,
              error: `Shift cutoff reached (${sData.close_time}). Terminal is closed.`,
              worker_name: workerName
            })
          }
        }
      }

      // 3. Find today's attendance record for this worker
      let attSnap = await db.collection('attendance')
        .where('date', '==', todayISO)
        .where('worker_id', '==', workerId)
        .limit(1)
        .get()

      if (attSnap.empty) {
        const nameQuery = await db.collection('attendance')
          .where('date', '==', todayISO)
          .where('worker_name', '==', workerName)
          .limit(1)
          .get()
        if (!nameQuery.empty) attSnap = nameQuery
      }

      let action = ''
      let finalStatus = 'Present'
      let earnedAmount = workerRate

      if (!attSnap.empty) {
        // Existing record for today -> Update shift
        const existingDoc = attSnap.docs[0]
        const existing = existingDoc.data()
        let mIn = existing.morning_in
        let mOut = existing.morning_out
        let aIn = existing.afternoon_in
        let aOut = existing.afternoon_out

        if (minutes !== null && minutes < 12 * 60 + 30) {
          // Morning session (before 12:30 PM)
          if (mIn === '—' || !mIn) {
            // Check if tapping during Lunch Out window (11:30 AM - 12:30 PM) without having Timed In
            if (minutes >= 11 * 60 + 30) {
              return res.status(400).json({
                success: false,
                error: `Bawal mag-Time Out: Walang naitalang Morning Time In para kay ${workerName}.`,
                worker_name: workerName,
                action: 'NO_TIME_IN'
              })
            }
            mIn = timeString
            action = 'MORNING TIME IN'
          } else if (mOut === '—' || !mOut) {
            // Anti-double-tap: Prevent accidental immediate checkout within 3 minutes of Time In
            const mInMin = parseTimeToMinutes(mIn)
            if (mInMin !== null && Math.abs(minutes - mInMin) < 3) {
              return res.status(400).json({
                success: false,
                error: `Kaka-Time In lang ni ${workerName}. Maghintay sandali bago mag-Time Out.`,
                worker_name: workerName,
                action: 'TOO_SOON'
              })
            }
            mOut = timeString
            action = 'MORNING TIME OUT (12 PM)'
          } else {
            return res.status(400).json({
              success: false,
              error: `Morning shift already completed for ${workerName}.`,
              worker_name: workerName,
              action: 'ALREADY_COMPLETED'
            })
          }
        } else {
          // Afternoon session (12:30 PM onwards)
          if (minutes >= 15 * 60 + 30) {
            // Dismissal / Uwian Period (3:30 PM onwards)
            const hasActiveTimeIn = (aIn && aIn !== '—') || (mIn && mIn !== '—' && (!mOut || mOut === '—'))
            if (!hasActiveTimeIn) {
              return res.status(400).json({
                success: false,
                error: `Bawal mag-Time Out: Walang naitalang Time In para kay ${workerName} ngayong araw.`,
                worker_name: workerName,
                action: 'NO_TIME_IN'
              })
            }
            if (aOut && aOut !== '—') {
              return res.status(400).json({
                success: false,
                error: `Naka-Time Out na si ${workerName} ngayong araw (Time Out: ${aOut}).`,
                worker_name: workerName,
                action: 'ALREADY_COMPLETED'
              })
            }

            // Anti-double-tap check if they just timed in in the afternoon
            const aInMin = parseTimeToMinutes(aIn)
            if (aInMin !== null && Math.abs(minutes - aInMin) < 3) {
              return res.status(400).json({
                success: false,
                error: `Kaka-Time In lang ni ${workerName}. Maghintay sandali bago mag-Time Out.`,
                worker_name: workerName,
                action: 'TOO_SOON'
              })
            }

            aOut = timeString
            action = 'AFTERNOON TIME OUT (5 PM)'
          } else {
            // Afternoon entry window (12:30 PM to 3:30 PM)
            if (aIn === '—' || !aIn) {
              aIn = timeString
              action = 'AFTERNOON TIME IN (1 PM)'
            } else if (aOut === '—' || !aOut) {
              const aInMin = parseTimeToMinutes(aIn)
              if (aInMin !== null && Math.abs(minutes - aInMin) < 3) {
                return res.status(400).json({
                  success: false,
                  error: `Kaka-Time In lang ni ${workerName}. Maghintay sandali bago mag-Time Out.`,
                  worker_name: workerName,
                  action: 'TOO_SOON'
                })
              }
              aOut = timeString
              action = 'AFTERNOON TIME OUT (5 PM)'
            } else {
              return res.status(400).json({
                success: false,
                error: `Afternoon shift already completed for ${workerName}.`,
                worker_name: workerName,
                action: 'ALREADY_COMPLETED'
              })
            }
          }
        }

        const evalRes = evaluateTwoSessions(mIn, aIn, workerRate)
        finalStatus = evalRes.status
        earnedAmount = evalRes.earnedAmount

        const updateData = {
          morning_in: mIn || '—',
          morning_out: mOut || '—',
          afternoon_in: aIn || '—',
          afternoon_out: aOut || '—',
          morning_status: evalRes.morningStatus,
          afternoon_status: evalRes.afternoonStatus,
          status: finalStatus,
          earned_amount: earnedAmount,
          time_in: mIn || aIn || '—',
          time_out: aOut || mOut || '—'
        }

        await existingDoc.ref.update(updateData)

        recordNotification({
          type: 'Staff & Workers',
          title: `RFID Tap: ${workerName}`,
          message: `Recorded ${action} for ${workerName} (${workerRole}) via terminal "${terminalId}". Status: ${finalStatus}.`,
          severity: (finalStatus === 'Late' || finalStatus === 'Double Late') ? 'Medium' : 'Low',
          actor_name: workerName,
          actor_role: workerRole,
          action: 'rfid_tap'
        }).catch(() => {})

        recordAuditLog({
          action: 'RFID_ATTENDANCE_LOGGED',
          module: 'Attendance',
          description: `Worker "${workerName}" (${workerRole}) logged ${action} at terminal "${terminalId}" (Time: ${timeString}, Status: ${finalStatus}).`,
          actor_name: workerName,
          actor_role: workerRole,
          actor_id: workerId,
          target_id: existingDoc.id,
          target_name: workerName,
          details: { action, time: timeString, status: finalStatus, rfid_uid: cleanUid, terminal_id: terminalId },
          req
        }).catch(() => {})

        return res.json({
          success: true,
          action,
          worker_name: workerName,
          role: workerRole,
          time: timeString,
          status: finalStatus,
          earned_amount: earnedAmount,
          rfid_uid: cleanUid,
          terminal_id: terminalId
        })
      } else {
        // First tap of the day -> Create attendance record
        // First tap of the day -> Check if worker is attempting to Time Out without ever Timing In!
        // 1. If tapping during Lunch Out window (11:30 AM - 12:30 PM) without having Timed In
        if (minutes !== null && minutes >= 11 * 60 + 30 && minutes < 12 * 60 + 30) {
          return res.status(400).json({
            success: false,
            error: `Bawal mag-Time Out: Walang naitalang Morning Time In para kay ${workerName}.`,
            worker_name: workerName,
            action: 'NO_TIME_IN'
          })
        }

        // 2. If tapping during Afternoon Dismissal / Uwian window (3:30 PM onwards) without having Timed In
        if (minutes !== null && minutes >= 15 * 60 + 30) {
          recordAuditLog({
            action: 'RFID_TIMEOUT_REJECTED_NO_TIMEIN',
            module: 'Attendance',
            description: `Tinanggihan ang Time Out para kay "${workerName}" sa terminal "${terminalId}": Walang naitalang Time In ngayong araw.`,
            actor_name: workerName,
            actor_role: workerRole,
            actor_id: workerId,
            status: 'FAILED',
            details: { rfid_uid: cleanUid, terminal_id: terminalId, time: timeString },
            req
          }).catch(() => {})

          return res.status(400).json({
            success: false,
            error: `Bawal mag-Time Out: Walang naitalang Time In para kay ${workerName} ngayong araw.`,
            worker_name: workerName,
            action: 'NO_TIME_IN'
          })
        }

        let mIn = '—'
        let aIn = '—'

        if (minutes !== null && minutes < 12 * 60 + 30) {
          mIn = timeString
          action = 'MORNING TIME IN'
        } else {
          aIn = timeString
          action = 'AFTERNOON TIME IN (1 PM)'
        }

        const evalRes = evaluateTwoSessions(mIn, aIn, workerRate)
        finalStatus = evalRes.status
        earnedAmount = evalRes.earnedAmount

        const newAttendance = {
          project_id: projectId || null,
          worker_id: workerId,
          worker_name: workerName,
          date: todayISO,
          role: workerRole,
          status: finalStatus,
          morning_in: mIn,
          morning_out: '—',
          afternoon_in: aIn,
          afternoon_out: '—',
          morning_status: evalRes.morningStatus,
          afternoon_status: evalRes.afternoonStatus,
          rate: workerRate,
          earned_amount: earnedAmount,
          advance: 0,
          time_in: mIn !== '—' ? mIn : aIn,
          time_out: '—',
          created_at: FieldValue.serverTimestamp()
        }

        const newDoc = await db.collection('attendance').add(newAttendance)

        recordNotification({
          type: 'Staff & Workers',
          title: `RFID Tap: ${workerName}`,
          message: `Recorded ${action} for ${workerName} (${workerRole}) via terminal "${terminalId}". Status: ${finalStatus}.`,
          severity: (finalStatus === 'Late' || finalStatus === 'Double Late') ? 'Medium' : 'Low',
          actor_name: workerName,
          actor_role: workerRole,
          action: 'rfid_tap'
        }).catch(() => {})

        recordAuditLog({
          action: 'RFID_ATTENDANCE_LOGGED',
          module: 'Attendance',
          description: `Worker "${workerName}" (${workerRole}) logged ${action} at terminal "${terminalId}" (Time: ${timeString}, Status: ${finalStatus}).`,
          actor_name: workerName,
          actor_role: workerRole,
          actor_id: workerId,
          target_id: newDoc.id,
          target_name: workerName,
          details: { action, time: timeString, status: finalStatus, rfid_uid: cleanUid, terminal_id: terminalId },
          req
        }).catch(() => {})

        return res.json({
          success: true,
          action,
          worker_name: workerName,
          role: workerRole,
          time: timeString,
          status: finalStatus,
          earned_amount: earnedAmount,
          rfid_uid: cleanUid,
          terminal_id: terminalId
        })
      }
    } catch (err) {
      console.error('RFID Scan Error:', err)
      return res.status(500).json({ success: false, error: err.message })
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

      // Validate: Cannot set Time Out without a corresponding Time In
      if (mOut && mOut !== '—' && (!mIn || mIn === '—')) {
        return res.status(400).json({ error: 'Bawal mag-Time Out sa umaga kung walang naitalang Morning Time In.' })
      }
      if (aOut && aOut !== '—' && (!aIn || aIn === '—') && (!mIn || mIn === '—')) {
        return res.status(400).json({ error: 'Bawal mag-Time Out sa hapon kung walang naitalang Time In.' })
      }

      const evaluated = evaluateTwoSessions(mIn, aIn, baseRate)
      const finalStatus = status || evaluated.status
      const finalEarned = (finalStatus === 'Absent') ? 0 : evaluated.earnedAmount

      await docRef.update({
        morning_in: mIn || '—', morning_out: mOut || '—', afternoon_in: aIn || '—', afternoon_out: aOut || '—',
        morning_status: evaluated.morningStatus, afternoon_status: evaluated.afternoonStatus,
        time_in: mIn || aIn || '—', time_out: aOut || mOut || '—',
        earned_amount: finalEarned, status: finalStatus
      })

      const wName = existing.worker_name || 'Worker'
      const wRole = existing.role || 'Worker'
      let actionDetail = ''
      if (mOut && mOut !== '—' && existing.morning_out === '—') actionDetail = `Morning Time Out (${mOut})`
      else if (aIn && aIn !== '—' && existing.afternoon_in === '—') actionDetail = `Afternoon Time In (${aIn})`
      else if (aOut && aOut !== '—' && existing.afternoon_out === '—') actionDetail = `Afternoon Time Out (${aOut})`
      else actionDetail = `Attendance update (${finalStatus})`

      recordNotification({
        type: 'Staff & Workers',
        title: `Attendance Update: ${wName}`,
        message: `Recorded ${actionDetail} for ${wName} (${wRole}).`,
        severity: 'Low',
        actor_name: wName,
        actor_role: wRole,
        action: 'attendance_update'
      }).catch(() => {})

      recordAuditLog({
        action: 'ATTENDANCE_UPDATED',
        module: 'Attendance',
        description: `Recorded ${actionDetail} for ${wName} (${wRole}). Status: ${finalStatus}.`,
        actor_name: wName,
        actor_role: wRole,
        actor_id: existing.worker_id,
        target_id: req.params.id,
        target_name: wName,
        details: { status: finalStatus, actionDetail },
        req
      }).catch(() => {})

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
      recordAuditLog({
        action: 'ASSET_CREATED',
        module: 'Tools',
        description: `Added new tool/asset: "${newAsset.name}" (Status: ${newAsset.status}, Condition: ${cond}).`,
        target_id: docRef.id,
        target_name: newAsset.name,
        details: newAsset,
        req
      }).catch(() => {})
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
      recordAuditLog({
        action: 'ASSET_UPDATED',
        module: 'Tools',
        description: `Updated tool/asset ID #${req.params.id} "${name || 'Tool'}" (Status: ${status || 'Available'}, Assigned: ${assignedUser || 'None'}).`,
        target_id: req.params.id,
        target_name: name,
        details: updateData,
        req
      }).catch(() => {})
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/assets/:id', async (req, res) => {
    try {
      await db.collection('assets').doc(req.params.id).delete()
      recordAuditLog({
        action: 'ASSET_DELETED',
        module: 'Tools',
        description: `Deleted tool/asset ID #${req.params.id}.`,
        target_id: req.params.id,
        req
      }).catch(() => {})
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
      const actionVerb = action === 'Returned' ? 'returned' : 'borrowed'
      recordNotification({
        type: 'Tools',
        project_id: pid || rawPid || null,
        link: pid || rawPid ? `/assets/${pid || rawPid}` : '/assets',
        title: `Tool ${action || 'Transaction'}: ${borrower_name}`,
        message: `${borrower_name} ${actionVerb} ${quantity || 1} "${tool_name}" (Condition: ${condition_status || 'Good'}).`,
        severity: 'Medium',
        actor_name: borrower_name,
        action: 'tool_borrow_return'
      }).catch(() => {})
      recordAuditLog({
        action: action === 'Returned' ? 'TOOL_RETURNED' : 'TOOL_BORROWED',
        module: 'Tools',
        description: `${borrower_name} ${actionVerb} ${quantity || 1} "${tool_name}" (Condition: ${condition_status || 'Good'}).`,
        actor_name: borrower_name,
        actor_role: 'Worker',
        target_id: docRef.id,
        target_name: tool_name,
        details: { quantity, action, condition_status },
        req
      }).catch(() => {})
      res.json({ id: docRef.id, ...req.body, project_id: pid || rawPid || null })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }

  app.post('/api/borrow-history', handleCreateBorrowHistory)
  app.post('/api/borrow-history/:project_id', handleCreateBorrowHistory)

  // ── MATERIALS ──
  app.get('/api/materials', async (req, res) => {
    try {
      const snapshot = await db.collection('materials').get()
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      results.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      res.json(results)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

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
      recordNotification({
        type: 'Staff & Workers',
        title: `Material Usage Logged: ${name}`,
        message: `Recorded material usage of ${qty} ${unit} "${name}"${remarks ? ` [Remarks: ${remarks}]` : ''}.`,
        severity: 'Low',
        action: 'material_logged'
      }).catch(() => {})
      recordAuditLog({
        action: 'MATERIAL_RECORDED',
        module: 'Materials',
        description: `Recorded material usage of ${qty} ${unit} "${name}"${remarks ? ` [Remarks: ${remarks}]` : ''}.`,
        target_id: docRef.id,
        target_name: name,
        details: { qty, unit, cost, remarks },
        req
      }).catch(() => {})
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
      recordAuditLog({
        action: 'MATERIAL_UPDATED',
        module: 'Materials',
        description: `Updated material ID #${req.params.id} "${name}" (${qty} ${unit}).`,
        target_id: req.params.id,
        target_name: name,
        details: { qty, unit, cost, remarks },
        req
      }).catch(() => {})
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/materials/:id', async (req, res) => {
    try {
      await db.collection('materials').doc(req.params.id).delete()
      recordAuditLog({
        action: 'MATERIAL_DELETED',
        module: 'Materials',
        description: `Deleted material ID #${req.params.id}.`,
        target_id: req.params.id,
        req
      }).catch(() => {})
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
      recordAuditLog({
        action: 'ATTENDANCE_STATUS_UPDATED',
        module: 'Attendance',
        description: `Updated attendance status for ID #${req.params.id} to "${status}".`,
        target_id: req.params.id,
        details: { status },
        req
      }).catch(() => {})
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

  // Helper: Sync cash advance deduction with project expenses
  async function syncCashAdvanceExpense(caId, caData, isApproved) {
    try {
      const existingSnap = await db.collection('expenses')
        .where('cash_advance_id', '==', caId)
        .get()

      if (isApproved) {
        const pid = caData.project_id || null
        let projectName = 'Project Site'
        if (pid) {
          const pDoc = await db.collection('projects').doc(pid).get()
          if (pDoc.exists) projectName = pDoc.data().name || projectName
        }
        const workerName = caData.workerName || caData.name || 'Worker'
        const amount = Number(caData.amount || 0)
        const reason = caData.reason || 'Cash Advance'
        const date = caData.date ? String(caData.date).slice(0, 10) : new Date().toISOString().slice(0, 10)

        const expensePayload = {
          project_id: pid,
          project: projectName,
          category: 'Manpower',
          amount: amount,
          receipt_no: `CA-${caId.slice(0, 6).toUpperCase()}`,
          date: date,
          time: new Date().toTimeString().split(' ')[0].substring(0, 5),
          items: [{
            qty: 1,
            unit: 'adv',
            description: `Cash Advance: ${workerName} (${reason})`,
            price: amount,
            category: 'Manpower'
          }],
          cash_tendered: amount,
          change: 0,
          cash_advance_id: caId,
          is_cash_advance: true,
          created_at: FieldValue.serverTimestamp()
        }

        if (existingSnap.empty) {
          const expRef = await db.collection('expenses').add(expensePayload)
          await db.collection('cash_advances').doc(caId).update({
            expense_id: expRef.id,
            deducted_from_budget: true
          })
        } else {
          await existingSnap.docs[0].ref.update(expensePayload)
          await db.collection('cash_advances').doc(caId).update({
            expense_id: existingSnap.docs[0].id,
            deducted_from_budget: true
          })
        }
      } else {
        // If rejected or cancelled, remove linked expense to restore project budget
        for (const doc of existingSnap.docs) {
          await doc.ref.delete()
        }
        await db.collection('cash_advances').doc(caId).update({
          expense_id: null,
          deducted_from_budget: false
        })
      }
    } catch (err) {
      console.error('Error syncing cash advance with project expenses:', err)
    }
  }

  app.put('/api/cash-advances/:id/approve', async (req, res) => {
    const { status } = req.body // 'Approved' or 'Rejected'
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' })
    }
    try {
      const caDoc = await db.collection('cash_advances').doc(req.params.id).get()
      if (!caDoc.exists) return res.status(404).json({ error: 'Cash advance not found.' })
      const caData = caDoc.data()
      await db.collection('cash_advances').doc(req.params.id).update({ status })

      // Deduct from or restore project budget in expenses
      await syncCashAdvanceExpense(req.params.id, { ...caData, status }, status === 'Approved')

      res.json({ success: true, status })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/cash-advances/:id', async (req, res) => {
    try {
      const caDoc = await db.collection('cash_advances').doc(req.params.id).get()
      if (!caDoc.exists) return res.status(404).json({ error: 'Cash advance record not found.' })
      const caData = caDoc.data()

      // Delete linked expense if any so project budget is restored
      const existingSnap = await db.collection('expenses')
        .where('cash_advance_id', '==', req.params.id)
        .get()
      for (const doc of existingSnap.docs) {
        await doc.ref.delete()
      }

      await db.collection('cash_advances').doc(req.params.id).delete()
      res.json({ success: true })
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
    const numAmount = parseFloat(amount || 0)

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid cash advance amount greater than 0.' })
    }
    
    try {
      const pid = await resolveProjectId(project_id)

      // Project Remaining Budget Check
      if (pid) {
        const pDoc = await db.collection('projects').doc(pid).get()
        if (pDoc.exists) {
          const pBudget = Number(pDoc.data().budget || 0)
          if (pBudget > 0) {
            const expSnap = await db.collection('expenses').where('project_id', '==', pid).get()
            const currentSpent = expSnap.docs.reduce((s, d) => s + Number(d.data().amount || 0), 0)
            const remainingBudget = pBudget - currentSpent
            if (numAmount > remainingBudget) {
              return res.status(400).json({
                error: `Requested advance (₱${numAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}) exceeds remaining project budget (₱${remainingBudget.toLocaleString('en-PH', { minimumFractionDigits: 2 })}).`
              })
            }
          }
        }
      }

      // Worker Limit Check
      if (workerId) {
        const wDoc = await db.collection('workers').doc(workerId).get()
        if (wDoc.exists) {
          const wData = wDoc.data()
          const dailyRate = Number(wData.daily_rate || 600)
          const baseCap = Math.min(dailyRate * 6, 5000)

          const caSnap = await db.collection('cash_advances')
            .where('worker_id', '==', workerId)
            .where('status', '==', 'Approved')
            .get()
          const undeducted = caSnap.docs
            .map(d => d.data())
            .filter(ca => !ca.is_deducted)
            .reduce((s, ca) => s + Number(ca.amount || 0), 0)

          const availableLimit = Math.max(0, baseCap - undeducted)
          if (numAmount > availableLimit) {
            return res.status(400).json({
              error: `Amount exceeds worker advance limit. Worker has ₱${availableLimit.toLocaleString('en-PH', { minimumFractionDigits: 2 })} available (Daily rate: ₱${dailyRate}/day, base limit: ₱${baseCap.toLocaleString()}, active advances: ₱${undeducted.toLocaleString()}).`
            })
          }
        }
      }

      const finalStatus = status || 'Approved'

      const resolveAndInsert = async (name) => {
        try {
          const newAdvance = {
            project_id: pid || project_id || null,
            worker_id: workerId || null,
            workerName: name,
            amount: numAmount,
            date: cleanDate,
            reason: reason || 'Cash Advance',
            status: finalStatus,
            created_at: FieldValue.serverTimestamp()
          }
          const docRef = await db.collection('cash_advances').add(newAdvance)

          // If approved (default), deduct immediately from project budget by syncing into expenses
          if (finalStatus === 'Approved') {
            await syncCashAdvanceExpense(docRef.id, newAdvance, true)
          }

          recordNotification({
            type: 'Staff & Workers',
            title: `Cash Advance: ${name}`,
            message: `Recorded Cash Advance of ₱${numAmount.toLocaleString()}${reason ? ` (Reason: "${reason}")` : ''} for ${name}. Deducted from project budget.`,
            severity: 'Medium',
            actor_name: name,
            actor_role: 'Worker',
            action: 'cash_advance_logged'
          }).catch(() => {})

          res.json({ id: docRef.id, ...newAdvance, date: cleanDate })
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

  // ── WORKERS SALARY & PAYROLL ──

  // Auto-Generate Payroll preview based on attendance, daily rates, and cash advances
  app.get('/api/payroll/generate', async (req, res) => {
    try {
      const { project_id } = req.query
      let { startDate, endDate } = req.query

      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)

      // Default cutoff if not provided: current semi-monthly cutoff (1-15 or 16-end)
      if (!startDate || !endDate) {
        const year = today.getFullYear()
        const month = today.getMonth()
        const dateNum = today.getDate()
        if (dateNum <= 15) {
          startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
          endDate = `${year}-${String(month + 1).padStart(2, '0')}-15`
        } else {
          startDate = `${year}-${String(month + 1).padStart(2, '0')}-16`
          const lastDay = new Date(year, month + 1, 0).getDate()
          endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
        }
      }

      // Generate all dates in cutoff range
      const calendarDates = []
      const curr = new Date(startDate + 'T00:00:00')
      const stop = new Date(endDate + 'T00:00:00')
      while (curr <= stop) {
        calendarDates.push(curr.toISOString().slice(0, 10))
        curr.setDate(curr.getDate() + 1)
      }

      // Check non-working days for all dates
      const nonWorkingMap = {}
      for (const d of calendarDates) {
        const nw = await isDateNonWorkingDay(d)
        if (nw.isNonWorking) {
          nonWorkingMap[d] = nw
        }
      }

      // Fetch workers (approved and not inactive)
      const workersSnap = await db.collection('workers').get()
      const allWorkers = workersSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(w => (w.approval_status || 'Approved') !== 'Pending' && w.status !== 'Inactive')

      // Fetch attendance in the date range
      let attQuery = db.collection('attendance')
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)

      const pid = await resolveProjectId(project_id)
      if (pid) {
        attQuery = attQuery.where('project_id', '==', pid)
      }

      const attSnap = await attQuery.get()
      const attDocs = attSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Fetch cash advances (approved and not yet deducted)
      const caSnap = await db.collection('cash_advances')
        .where('status', '==', 'Approved')
        .get()
      const allCashAdvances = caSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(ca => !ca.is_deducted)

      // Fetch project name if project_id is specified
      let projectName = 'All Projects'
      if (pid) {
        const pDoc = await db.collection('projects').doc(pid).get()
        if (pDoc.exists) projectName = pDoc.data().name || 'Project Site'
      }

      let totalGrossPay = 0
      let totalCashAdvances = 0
      let totalLateDeductions = 0
      let totalNetPayout = 0
      let totalHours = 0

      const workersPayroll = []

      for (const worker of allWorkers) {
        const workerName = (worker.full_name || `${worker.first_name || ''} ${worker.last_name || ''}`).trim() || worker.name || 'Worker'
        const baseDailyRate = Number(worker.daily_rate) || (
          worker.role?.includes('Foreman') ? 1000 :
          (worker.role?.includes('Skilled') || worker.role?.includes('Operator')) ? 800 : 600
        )
        const hourlyRate = Math.round((baseDailyRate / 8) * 100) / 100

        // Find attendance logs for this worker
        const workerAtts = attDocs.filter(a => {
          if (a.worker_id && String(a.worker_id) === String(worker.id)) return true
          const aName = (a.worker_name || a.name || '').trim().toLowerCase()
          return aName && (aName === workerName.toLowerCase() || aName === (worker.username || '').toLowerCase())
        })

        // Find cash advances for this worker
        const workerCAs = allCashAdvances.filter(ca => {
          if (ca.worker_id && String(ca.worker_id) === String(worker.id)) return true
          if (ca.workerId && String(ca.workerId) === String(worker.id)) return true
          const caName = (ca.workerName || ca.name || '').trim().toLowerCase()
          return caName && caName === workerName.toLowerCase()
        })

        const workerCATotal = workerCAs.reduce((s, ca) => s + (Number(ca.amount) || 0), 0)

        let presentDays = 0
        let lateDays = 0
        let doubleLateDays = 0
        let halfdayDays = 0
        let halfdayLateDays = 0
        let absentDays = 0
        let restDays = 0
        let workerHours = 0
        let workerGross = 0
        let workerLatePenalty = 0

        const dailyLogs = []

        for (const dateStr of calendarDates) {
          const log = workerAtts.find(a => a.date === dateStr)
          const isNW = Boolean(nonWorkingMap[dateStr])

          if (log) {
            const status = log.status || 'Present'
            let earned = (log.earned_amount !== undefined && log.earned_amount !== null) ? Number(log.earned_amount) : 0
            let hours = 0
            let penalty = 0

            if (status === 'Present') {
              hours = 8.0
              earned = baseDailyRate
              presentDays++
            } else if (status === 'Late') {
              hours = 8.0
              earned = Math.max(0, baseDailyRate - 100)
              penalty = 100
              lateDays++
            } else if (status === 'Double Late') {
              hours = 8.0
              earned = Math.max(0, baseDailyRate - 200)
              penalty = 200
              doubleLateDays++
            } else if (status === 'Halfday') {
              hours = 4.0
              earned = Math.round((baseDailyRate / 2) * 100) / 100
              halfdayDays++
            } else if (status === 'Halfday (Late)') {
              hours = 4.0
              earned = Math.max(0, (baseDailyRate / 2) - 100)
              penalty = 100
              halfdayLateDays++
            } else if (status === 'Absent') {
              hours = 0
              earned = 0
              absentDays++
            } else if (status.includes('Rest Day') || status.includes('Non-Working')) {
              hours = 0
              earned = 0
              restDays++
            } else {
              hours = 8.0
              earned = baseDailyRate
              presentDays++
            }

            workerHours += hours
            workerGross += earned
            workerLatePenalty += penalty

            dailyLogs.push({
              date: dateStr,
              status,
              morning_in: log.morning_in || log.time_in || '—',
              morning_out: log.morning_out || '—',
              afternoon_in: log.afternoon_in || '—',
              afternoon_out: log.afternoon_out || log.time_out || '—',
              hours,
              rate: baseDailyRate,
              earned,
              deduction: penalty,
              note: penalty > 0 ? `Late penalty (-₱${penalty})` : ''
            })
          } else {
            // No attendance recorded on this date
            if (isNW) {
              restDays++
              dailyLogs.push({
                date: dateStr,
                status: 'Rest Day / Non-Working',
                morning_in: '—',
                morning_out: '—',
                afternoon_in: '—',
                afternoon_out: '—',
                hours: 0,
                rate: baseDailyRate,
                earned: 0,
                deduction: 0,
                note: nonWorkingMap[dateStr]?.reason || 'Official Rest Day'
              })
            } else if (dateStr <= todayStr) {
              absentDays++
              dailyLogs.push({
                date: dateStr,
                status: 'Absent',
                morning_in: '—',
                morning_out: '—',
                afternoon_in: '—',
                afternoon_out: '—',
                hours: 0,
                rate: baseDailyRate,
                earned: 0,
                deduction: 0,
                note: 'No attendance record'
              })
            } else {
              dailyLogs.push({
                date: dateStr,
                status: 'Scheduled / Upcoming',
                morning_in: '—',
                morning_out: '—',
                afternoon_in: '—',
                afternoon_out: '—',
                hours: 0,
                rate: baseDailyRate,
                earned: 0,
                deduction: 0,
                note: 'Upcoming work day'
              })
            }
          }
        }

        const workedDays = presentDays + lateDays + doubleLateDays + halfdayDays + halfdayLateDays
        const netPay = Math.max(0, workerGross - workerCATotal)

        totalGrossPay += workerGross
        totalCashAdvances += workerCATotal
        totalLateDeductions += workerLatePenalty
        totalNetPayout += netPay
        totalHours += workerHours

        workersPayroll.push({
          worker_id: worker.id,
          worker_name: workerName,
          role: worker.role || worker.position || 'Laborer',
          daily_rate: baseDailyRate,
          hourly_rate: hourlyRate,
          present_days: presentDays,
          late_days: lateDays + doubleLateDays,
          double_late_days: doubleLateDays,
          halfday_days: halfdayDays + halfdayLateDays,
          absent_days: absentDays,
          rest_days: restDays,
          worked_days: workedDays,
          total_hours: workerHours,
          regular_earnings: workerGross + workerLatePenalty,
          late_deductions: workerLatePenalty,
          gross_pay: workerGross,
          cash_advance_deductions: workerCATotal,
          cash_advances: workerCAs.map(ca => ({
            id: ca.id,
            amount: Number(ca.amount) || 0,
            date: ca.date,
            reason: ca.reason || 'Cash Advance'
          })),
          total_deductions: workerCATotal,
          net_pay: netPay,
          daily_logs: dailyLogs
        })
      }

      workersPayroll.sort((a, b) => a.worker_name.localeCompare(b.worker_name))

      res.json({
        startDate,
        endDate,
        project_id: pid || 'ALL',
        project_name: projectName,
        summary: {
          totalGrossPay,
          totalCashAdvances,
          totalLateDeductions,
          totalNetPayout,
          totalWorkers: workersPayroll.length,
          totalHours
        },
        workers: workersPayroll
      })
    } catch (err) {
      console.error('Error generating payroll:', err)
      res.status(500).json({ error: err.message })
    }
  })

  // Save / Submit Payroll Run
  app.post('/api/payroll', async (req, res) => {
    try {
      const {
        startDate, endDate, project_id, project_name,
        summary, workers, status, notes, created_by
      } = req.body

      const newPayroll = {
        cutoff_start: startDate,
        cutoff_end: endDate,
        project_id: project_id || 'ALL',
        project_name: project_name || 'All Projects',
        summary: summary || {},
        workers: workers || [],
        status: status || 'Draft',
        notes: notes || null,
        created_by: created_by || 'Admin',
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp()
      }

      const docRef = await db.collection('payrolls').add(newPayroll)

      if (status === 'Paid') {
        for (const w of (workers || [])) {
          if (Array.isArray(w.cash_advances)) {
            for (const ca of w.cash_advances) {
              if (ca.id) {
                await db.collection('cash_advances').doc(ca.id).update({
                  is_deducted: true,
                  deducted_in_payroll_id: docRef.id,
                  deducted_date: new Date().toISOString().slice(0, 10)
                }).catch(() => {})
              }
            }
          }
        }
      }

      recordAuditLog({
        action: status === 'Paid' ? 'PAYROLL_RELEASED' : 'PAYROLL_GENERATED',
        module: 'Expenses',
        description: `Admin ${status === 'Paid' ? 'released' : 'generated'} payroll for cutoff ${startDate} to ${endDate} (${workers?.length || 0} workers, Net: ₱${Number(summary?.totalNetPayout || 0).toLocaleString()}).`,
        target_id: docRef.id,
        target_name: `Payroll ${startDate} - ${endDate}`,
        details: { startDate, endDate, summary, status },
        req
      }).catch(() => {})

      recordNotification({
        type: 'Staff & Workers',
        title: `Payroll ${status === 'Paid' ? 'Released' : 'Generated'}`,
        message: `Payroll ${status === 'Paid' ? 'released' : 'generated'} for cutoff ${startDate} to ${endDate} for ${workers?.length || 0} workers (Total Net: ₱${Number(summary?.totalNetPayout || 0).toLocaleString()}).`,
        severity: 'Low',
        action: 'payroll'
      }).catch(() => {})

      res.json({ id: docRef.id, ...newPayroll })
    } catch (err) {
      console.error('Error saving payroll:', err)
      res.status(500).json({ error: err.message })
    }
  })

  // List all payroll runs
  app.get('/api/payroll', async (req, res) => {
    try {
      const snap = await db.collection('payrolls').get()
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      list.sort((a, b) => (b.cutoff_end || '').localeCompare(a.cutoff_end || '') || (b.created_at?._seconds || 0) - (a.created_at?._seconds || 0))
      res.json(list)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Get specific payroll run
  app.get('/api/payroll/:id', async (req, res) => {
    try {
      const doc = await db.collection('payrolls').doc(req.params.id).get()
      if (!doc.exists) return res.status(404).json({ error: 'Payroll not found' })
      res.json({ id: doc.id, ...doc.data() })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Update payroll status (Draft -> Approved -> Paid)
  app.put('/api/payroll/:id/status', async (req, res) => {
    const { status } = req.body
    try {
      const docRef = db.collection('payrolls').doc(req.params.id)
      const docSnap = await docRef.get()
      if (!docSnap.exists) return res.status(404).json({ error: 'Payroll not found' })

      const existingData = docSnap.data()
      await docRef.update({
        status,
        updated_at: FieldValue.serverTimestamp()
      })

      if (status === 'Paid') {
        const workers = existingData.workers || []
        for (const w of workers) {
          if (Array.isArray(w.cash_advances)) {
            for (const ca of w.cash_advances) {
              if (ca.id) {
                await db.collection('cash_advances').doc(ca.id).update({
                  is_deducted: true,
                  deducted_in_payroll_id: req.params.id,
                  deducted_date: new Date().toISOString().slice(0, 10)
                }).catch(() => {})
              }
            }
          }
        }
      }

      recordAuditLog({
        action: status === 'Paid' ? 'PAYROLL_RELEASED' : 'PAYROLL_UPDATED',
        module: 'Expenses',
        description: `Admin updated payroll status to "${status}" for cutoff ${existingData.cutoff_start} to ${existingData.cutoff_end}.`,
        target_id: req.params.id,
        target_name: `Payroll ${existingData.cutoff_start} - ${existingData.cutoff_end}`,
        details: { status, summary: existingData.summary },
        req
      }).catch(() => {})

      res.json({ success: true, status })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Delete draft payroll run
  app.delete('/api/payroll/:id', async (req, res) => {
    try {
      await db.collection('payrolls').doc(req.params.id).delete()
      recordAuditLog({
        action: 'PAYROLL_DELETED',
        module: 'Expenses',
        description: `Deleted draft payroll ID #${req.params.id}.`,
        target_id: req.params.id,
        req
      }).catch(() => {})
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Get payroll payouts for a specific worker (Mobile App & Worker Portal)
  app.get('/api/workers/:id/payroll', async (req, res) => {
    try {
      const workerId = req.params.id
      const snap = await db.collection('payrolls').get()
      const workerPayouts = []

      for (const doc of snap.docs) {
        const p = doc.data()
        if (p.status !== 'Draft') {
          const workerItem = (p.workers || []).find(w => String(w.worker_id) === String(workerId))
          if (workerItem) {
            workerPayouts.push({
              payroll_id: doc.id,
              cutoff_start: p.cutoff_start,
              cutoff_end: p.cutoff_end,
              project_name: p.project_name,
              status: p.status,
              created_at: p.created_at,
              ...workerItem
            })
          }
        }
      }

      workerPayouts.sort((a, b) => (b.cutoff_end || '').localeCompare(a.cutoff_end || ''))
      res.json(workerPayouts)
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
      recordNotification({
        type: 'Staff & Workers',
        title: `New Worker Registration: ${fullName}`,
        message: `${fullName} (${position || role || 'Worker'}, Phone: ${phone || 'N/A'}) submitted registration. Awaiting Admin approval.`,
        severity: 'High',
        actor_name: fullName,
        actor_role: position || role || 'Worker',
        action: 'worker_registration',
        worker_id: docRef.id,
        target_id: docRef.id,
        link: `/workers?id=${docRef.id}&tab=approval`
      }).catch(() => {})

      recordAuditLog({
        action: 'WORKER_REGISTERED',
        module: 'Authentication',
        description: `${fullName} (${position || role || 'Worker'}, Phone: ${phone || 'N/A'}) registered. Status: Pending Approval.`,
        actor_name: fullName,
        actor_role: position || role || 'Worker',
        target_id: docRef.id,
        target_name: fullName,
        details: { role, position, phone },
        req
      }).catch(() => {})

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
        recordAuditLog({
          action: 'LOGIN_FAILED',
          module: 'Authentication',
          description: `Failed login attempt: Account "${rawUser}" not found.`,
          actor_name: rawUser || 'Unknown User',
          actor_role: 'Anonymous / Guest',
          status: 'FAILED',
          req
        }).catch(() => {})
        return res.status(401).json({ error: 'Account not found' })
      }

      const userDoc = snapshot.docs[0]
      const user = userDoc.data()

      // Check approval status
      if (user.approval_status === 'Pending') {
        recordAuditLog({
          action: 'LOGIN_FAILED',
          module: 'Authentication',
          description: `Login blocked: Account "${user.full_name || rawUser}" is still pending administrator approval.`,
          actor_name: user.full_name || rawUser,
          actor_role: user.role || 'Worker',
          actor_id: userDoc.id,
          status: 'FAILED',
          req
        }).catch(() => {})
        return res.status(403).json({ error: 'pending_approval', message: 'Account pending approval' })
      }

      if (user.approval_status === 'Rejected') {
        recordAuditLog({
          action: 'LOGIN_FAILED',
          module: 'Authentication',
          description: `Login blocked: Account "${user.full_name || rawUser}" was rejected by administrator.`,
          actor_name: user.full_name || rawUser,
          actor_role: user.role || 'Worker',
          actor_id: userDoc.id,
          status: 'FAILED',
          req
        }).catch(() => {})
        return res.status(403).json({ error: 'rejected', message: 'Account was rejected' })
      }

      if (!user.password) {
        recordAuditLog({
          action: 'LOGIN_FAILED',
          module: 'Authentication',
          description: `Login blocked for "${user.full_name || rawUser}": No password set.`,
          actor_name: user.full_name || rawUser,
          actor_role: user.role || 'Worker',
          actor_id: userDoc.id,
          status: 'FAILED',
          req
        }).catch(() => {})
        return res.status(401).json({ error: 'No password set for this account. Please contact administrator.' })
      }

      // Verify password (supports exact match or trimmed match for mobile keyboards)
      const rawPassword = String(password)
      let validPassword = await bcrypt.compare(rawPassword, user.password)
      if (!validPassword && rawPassword.trim() !== rawPassword) {
        validPassword = await bcrypt.compare(rawPassword.trim(), user.password)
      }
      if (!validPassword) {
        recordAuditLog({
          action: 'LOGIN_FAILED',
          module: 'Authentication',
          description: `Failed login attempt for "${user.full_name || rawUser}": Incorrect password.`,
          actor_name: user.full_name || rawUser,
          actor_role: user.role || 'Worker',
          actor_id: userDoc.id,
          status: 'FAILED',
          req
        }).catch(() => {})
        return res.status(401).json({ error: 'Invalid password' })
      }

      // Record successful login in Audit Logs
      recordAuditLog({
        action: 'LOGIN_SUCCESS',
        module: 'Authentication',
        description: `User "${user.full_name || user.first_name}" (${user.role || user.position || 'Worker'}) successfully logged in.`,
        actor_name: user.full_name || user.first_name,
        actor_role: user.role || user.position || 'Worker',
        actor_id: userDoc.id,
        status: 'SUCCESS',
        req
      }).catch(() => {})

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
      const wDoc = await db.collection('workers').doc(req.params.id).get()
      const wName = wDoc.exists ? (wDoc.data().full_name || `Worker #${req.params.id}`) : `Worker #${req.params.id}`
      await db.collection('workers').doc(req.params.id).update(updateData)
      recordAuditLog({
        action: cleanStatus === 'Approved' ? 'WORKER_REGISTRATION_APPROVED' : 'WORKER_REGISTRATION_REJECTED',
        module: 'Workers',
        description: `Admin ${cleanStatus.toLowerCase()} the worker registration of "${wName}".`,
        target_id: req.params.id,
        target_name: wName,
        details: { approval_status: cleanStatus, status: updateData.status },
        req
      }).catch(() => {})
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
      if (snapshot.empty) {
        recordAuditLog({
          action: 'LOGIN_FAILED',
          module: 'Authentication',
          description: `Failed admin login attempt: account "${username}" not found.`,
          actor_name: username || 'Unknown',
          actor_role: 'Anonymous / Guest',
          status: 'FAILED',
          req
        }).catch(() => {})
        return res.status(401).json({ error: 'Invalid username or password.' })
      }

      const adminDoc = snapshot.docs[0]
      const adminData = adminDoc.data()
      
      const match = await bcrypt.compare(password, adminData.password)
      if (!match) {
        recordAuditLog({
          action: 'LOGIN_FAILED',
          module: 'Authentication',
          description: `Failed admin login attempt for "${username}": incorrect password.`,
          actor_name: username || 'Unknown',
          actor_role: 'Anonymous / Guest',
          status: 'FAILED',
          req
        }).catch(() => {})
        return res.status(401).json({ error: 'Invalid username or password.' })
      }

      const token = jwt.sign({ id: adminDoc.id, type: 'admin' }, process.env.JWT_SECRET || 'scon_super_secret_key_2026', { expiresIn: '8h' })

      recordAuditLog({
        action: 'LOGIN_SUCCESS',
        module: 'Authentication',
        description: `Administrator "${adminData.full_name || username}" (${adminData.role || 'Administrator'}) successfully logged in.`,
        actor_name: adminData.full_name || username,
        actor_role: adminData.role || 'Administrator',
        actor_id: adminDoc.id,
        status: 'SUCCESS',
        req
      }).catch(() => {})

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

  // ── LOGOUT ENDPOINT (Unified for Admin & Mobile Users) ──
  app.post(['/api/logout', '/api/admin/logout'], async (req, res) => {
    try {
      const { userId, name, username, role, client } = req.body || {}
      const finalName = name || username || 'Administrator'
      const finalRole = role || 'Administrator'
      const clientType = client || (req.headers['user-agent']?.includes('Dart') || req.headers['user-agent']?.includes('Flutter') ? 'Mobile App' : 'Web App')

      recordAuditLog({
        action: 'LOGOUT',
        module: 'Authentication',
        description: `${finalRole} "${finalName}" successfully logged out of the system (${clientType}).`,
        actor_name: finalName,
        actor_role: finalRole,
        actor_id: userId ? String(userId) : null,
        status: 'SUCCESS',
        req
      }).catch(() => {})

      res.json({ success: true, message: 'Logged out successfully' })
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
      recordAuditLog({
        action: 'PROFILE_UPDATED',
        module: 'Authentication',
        description: `Updated profile details for administrator "${fullName}" (${role || 'Administrator'}).`,
        actor_name: fullName,
        actor_role: role || 'Administrator',
        actor_id: targetId,
        details: { email, phone, role, dept, empId },
        req
      }).catch(() => {})

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
