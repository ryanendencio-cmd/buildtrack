const fs = require('fs');

const content = fs.readFileSync('server/index.js', 'utf8');
const lines = content.split(/\r?\n/);

const idx1677 = lines.findIndex((l, i) => i > 1650 && i < 1700 && l.includes("if (typeof password === 'string'"));
console.log('idx1677:', idx1677, lines[idx1677]);

const idxTry = lines.findIndex((l, i) => i > idx1677 && i < idx1677 + 10 && l.trim() === 'try {');
console.log('idxTry:', idxTry, lines[idxTry]);

const replacement = [
  "      if (typeof password === 'string' && password.trim().length > 0) {",
  "        const trimmedPass = password.trim()",
  "        if (!trimmedPass.startsWith('$2a$') && !trimmedPass.startsWith('$2b$')) {",
  "          updateData.password = await bcrypt.hash(trimmedPass, 10)",
  "        }",
  "      }",
  "      await db.collection('workers').doc(req.params.id).update(updateData)",
  "",
  "      // Generate descriptive notification message",
  "      const changesText = changes.length > 0 ? changes.join(' • ') : 'Updated profile details'",
  "      const notificationMessage = `${changesText} for ${computedFullName} (${cleanPosition || role || 'Worker'}).`",
  "",
  "      recordNotification({",
  "        type: 'Staff & Workers',",
  "        title: `Worker Profile Updated: ${computedFullName}`,",
  "        message: notificationMessage,",
  "        severity: 'Low',",
  "        actor_name: computedFullName,",
  "        actor_role: cleanPosition || role || 'Worker',",
  "        action: 'worker_updated',",
  "        worker_id: req.params.id,",
  "        target_id: req.params.id,",
  "        link: `/workers?id=${req.params.id}`",
  "      }).catch(() => {})",
  "",
  "      recordAuditLog({",
  "        action: 'WORKER_UPDATED',",
  "        module: 'Workers',",
  "        description: `Updated worker record for \"${computedFullName}\": ${changes.length > 0 ? changes.join(', ') : 'Profile details updated'}.`,",
  "        target_id: req.params.id,",
  "        target_name: computedFullName,",
  "        details: { role, position: cleanPosition, status, approval_status, daily_rate, changes },",
  "        req",
  "      }).catch(() => {})",
  "",
  "      res.json({ success: true, position: cleanPosition, changes })",
  "    } catch (err) {",
  "      res.status(500).json({ error: err.message })",
  "    }",
  "  })",
  "",
  "  app.delete('/api/workers/:id', async (req, res) => {",
  "    try {"
];

const newLines = [
  ...lines.slice(0, idx1677),
  ...replacement,
  ...lines.slice(idxTry + 1)
];

fs.writeFileSync('server/index.js', newLines.join('\r\n'), 'utf8');
console.log('Fixed server/index.js lines! Total lines now:', newLines.length);

