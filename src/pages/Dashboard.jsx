import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'

const isUpcomingStatus = (statusStr) => {
  const s = (statusStr || '').toUpperCase();
  return s === 'UPCOMING' || s === 'STANDBY' || s.includes('UPCOMING') || s.includes('STANDBY');
};

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');
  const [activityFilter, setActivityFilter] = useState('ALL'); // 'ALL' | 'RECEIPT' | 'MATERIAL'

  const [rawExpenses, setRawExpenses] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [rawWorkers, setRawWorkers] = useState([]);
  const [equipment, setEquipment] = useState({ available: 0, inUse: 0, maintenance: 0 });

  // Currently focused target project (null if 'ALL')
  const targetProject = useMemo(() => {
    if (selectedProjectId === 'ALL') return null;
    return projects.find(p => String(p.id) === String(selectedProjectId)) || null;
  }, [selectedProjectId, projects]);

  const isProjectMatch = (item, proj) => {
    if (!proj) return true;
    const targetId = String(proj.id || '');
    const targetName = String(proj.name || proj.title || '').trim().toLowerCase();
    const itemPid = String(item.project_id || item.projectId || '');
    const itemPName = String(item.project || item.projectName || '').trim().toLowerCase();
    if (itemPid && targetId && itemPid === targetId) return true;
    if (itemPName && targetName && (itemPName === targetName || targetName.includes(itemPName) || itemPName.includes(targetName))) return true;
    return false;
  };

  const scopedExpenses = useMemo(() => {
    if (selectedProjectId === 'ALL') return rawExpenses;
    return rawExpenses.filter(e => isProjectMatch(e, targetProject));
  }, [rawExpenses, selectedProjectId, targetProject]);

  const scopedMaterials = useMemo(() => {
    if (selectedProjectId === 'ALL') return rawMaterials;
    return rawMaterials.filter(m => isProjectMatch(m, targetProject));
  }, [rawMaterials, selectedProjectId, targetProject]);

  const scopedWorkers = useMemo(() => {
    if (selectedProjectId === 'ALL') return rawWorkers;
    return rawWorkers.filter(w => isProjectMatch(w, targetProject));
  }, [rawWorkers, selectedProjectId, targetProject]);

  const scopedFinancials = useMemo(() => {
    const receiptsSpent = scopedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const materialsSpent = scopedMaterials.reduce((sum, m) => sum + (Number(m.qty || m.quantity || 0) * Number(m.cost || m.unit_cost || 0)), 0);
    const totalSpent = receiptsSpent + materialsSpent;

    let totalBudget = 0;
    if (selectedProjectId === 'ALL') {
      totalBudget = projects.reduce((sum, p) => sum + Number(p.budget || p.contract || 0), 0);
    } else {
      totalBudget = Number(targetProject?.budget || targetProject?.contract || 0);
    }
    const remaining = Math.max(0, totalBudget - totalSpent);
    const percent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    // Categories breakdown
    const catMap = {};
    scopedExpenses.forEach(e => {
      const c = e.category || 'Uncategorized';
      catMap[c] = (catMap[c] || 0) + Number(e.amount || 0);
    });
    if (materialsSpent > 0) {
      catMap['Materials'] = (catMap['Materials'] || 0) + materialsSpent;
    }
    const categories = Object.keys(catMap).map(category => ({ category, total: catMap[category] }));

    return {
      receiptsSpent,
      materialsSpent,
      totalSpent,
      totalBudget,
      remaining,
      percent,
      categories
    };
  }, [scopedExpenses, scopedMaterials, selectedProjectId, targetProject, projects]);

  const scopedMonthlyData = useMemo(() => {
    const months = Array(12).fill(0);
    const currentYear = new Date().getFullYear();
    scopedExpenses.forEach(e => {
      if (e.date) {
        const d = new Date(e.date);
        if (d.getFullYear() === currentYear) {
          months[d.getMonth()] += Number(e.amount || 0);
        }
      }
    });
    scopedMaterials.forEach(m => {
      if (m.date) {
        const d = new Date(m.date);
        if (d.getFullYear() === currentYear) {
          months[d.getMonth()] += (Number(m.qty || m.quantity || 0) * Number(m.cost || m.unit_cost || 0));
        }
      }
    });
    return months;
  }, [scopedExpenses, scopedMaterials]);

  const scopedRecentActivities = useMemo(() => {
    const formattedExpenses = scopedExpenses.map(e => ({
      id: e.id,
      type: 'expense',
      category: e.category || 'Expense',
      description: e.category || 'Expense Receipt',
      amount: Number(e.amount || 0),
      date: e.date,
      project_id: e.project_id
    }));

    const formattedMaterials = scopedMaterials.map(m => {
      const qty = Number(m.qty || m.quantity || 0);
      const cost = Number(m.cost || m.unit_cost || 0);
      const unitStr = m.unit ? ` ${m.unit}` : '';
      return {
        id: m.id,
        type: 'material',
        category: 'Materials',
        name: m.name || 'Material Item',
        description: m.name ? `${m.name} (${qty}${unitStr})` : 'Material Usage Log',
        amount: qty * cost,
        date: m.date,
        project_id: m.project_id
      };
    });

    return [...formattedExpenses, ...formattedMaterials]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 20);
  }, [scopedExpenses, scopedMaterials]);

  const filteredActivities = useMemo(() => {
    if (activityFilter === 'RECEIPT') return scopedRecentActivities.filter(e => e.type !== 'material');
    if (activityFilter === 'MATERIAL') return scopedRecentActivities.filter(e => e.type === 'material');
    return scopedRecentActivities;
  }, [scopedRecentActivities, activityFilter]);

  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');

  const workforce = useMemo(() => {
    const roleMap = {};
    let presentCount = 0;
    let absentCount = 0;
    let todayPayroll = 0;

    scopedWorkers.forEach(w => {
      const role = w.role || w.position || 'Worker';
      roleMap[role] = (roleMap[role] || 0) + 1;
      const status = (w.status || w.attendanceStatus || '').toUpperCase();
      if (status === 'ABSENT') {
        absentCount++;
      } else {
        presentCount++;
        todayPayroll += Number(w.daily_rate || w.rate || 0);
      }
    });

    const roles = Object.entries(roleMap).map(([role, count]) => ({ role, count }));

    return {
      present: presentCount,
      absent: absentCount,
      roles: roles.slice(0, 5),
      todayPayroll
    };
  }, [scopedWorkers]);

  const projectSummaries = useMemo(() => {
    return projects.map(p => {
      const pExpenses = rawExpenses.filter(e => isProjectMatch(e, p));
      const pMaterials = rawMaterials.filter(m => isProjectMatch(m, p));
      const spent = pExpenses.reduce((s, e) => s + Number(e.amount || 0), 0) +
                    pMaterials.reduce((s, m) => s + (Number(m.qty || m.quantity || 0) * Number(m.cost || m.unit_cost || 0)), 0);
      const budget = Number(p.budget || p.contract || 0);
      const workersCount = rawWorkers.filter(w => isProjectMatch(w, p)).length;
      const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
      return {
        ...p,
        spent,
        budget,
        workersCount,
        pct
      };
    });
  }, [projects, rawExpenses, rawMaterials, rawWorkers]);

  // General Input & Profile Fetch
  const [adminName, setAdminName] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('adminProfile') || '{}');
      const session = JSON.parse(localStorage.getItem('adminSession') || '{}');
      const name = saved.fullName || saved.name || session.fullName || (saved.firstName ? `${saved.firstName} ${saved.lastName || ''}`.trim() : null) || session.username;
      return name ? String(name).trim() : 'Administrator';
    } catch {
      return 'Administrator';
    }
  });

  const fetchDashboardData = () => {
    Promise.all([
      api.get('/expenses').catch(() => []),
      api.get('/materials/ALL').catch(() => []),
      api.get('/workers').catch(() => []),
      api.get('/projects').catch(() => []),
      api.get('/assets/summary').catch(() => ({ available: 0, inUse: 0, maintenance: 0 }))
    ]).then(([exps, mats, wrks, projs, assetData]) => {
      setRawExpenses(Array.isArray(exps) ? exps : []);
      setRawMaterials(Array.isArray(mats) ? mats : []);
      setRawWorkers(Array.isArray(wrks) ? wrks : []);
      if (Array.isArray(projs)) {
        setProjects(projs);
      }
      if (assetData) {
        setEquipment({
          available: assetData.available || 0,
          inUse: assetData.inUse || 0,
          maintenance: assetData.maintenance || 0
        });
      }
    }).catch(console.error);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <AdminLayout>

      {/* ── CLEAN DASHBOARD HEADER ── */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">DASHBOARD</span>
          {selectedProjectId !== 'ALL' && (
            <span className="text-[8px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Filtered: {targetProject?.name || targetProject?.title}</span>
              <button
                type="button"
                onClick={() => setSelectedProjectId('ALL')}
                className="text-gray-400 hover:text-[#A63228] font-black cursor-pointer leading-none ml-0.5"
                title="Reset to All Projects"
              >
                ✕
              </button>
            </span>
          )}
        </div>
        <h1 className="text-lg md:text-xl font-extrabold text-gray-900 mt-0.5">{getGreeting()}, {adminName}.</h1>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {selectedProjectId === 'ALL'
            ? "Here's an overview of all your projects and expenses."
            : `Showing focused site analytics and financials for "${targetProject?.name || targetProject?.title}".`}
        </p>
      </div>

      {/* ── 4 TOP KPI CARDS (With Clean Vector SVG Icons) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {/* Card 1: Active Projects / Selected Project (Click to Open Project Picker) */}
        {selectedProjectId === 'ALL' ? (
          <div 
            onClick={() => setIsProjectPickerOpen(true)}
            className="bg-white p-3.5 rounded-xl shadow-xs border border-gray-100 hover:border-[#A63228]/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex justify-between items-start mb-1.5">
                <div>
                  <p className="text-[9px] font-bold text-gray-400 group-hover:text-[#A63228] transition-colors tracking-wider uppercase">ACTIVE PROJECTS</p>
                  <h2 className="text-xl font-extrabold text-gray-900 group-hover:text-[#A63228] transition-colors mt-0.5">
                    {projects.filter(p => !isUpcomingStatus(p.status)).length}
                  </h2>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#FDF2F0] text-[#8B1A10] border border-[#8B1A10]/15 flex items-center justify-center shrink-0 group-hover:bg-[#8B1A10] group-hover:text-white transition-all shadow-2xs">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 20h20"></path>
                    <path d="M5 20V8l7-5 7 5v12"></path>
                    <path d="M9 20v-5h6v5"></path>
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-[8px]">
              <span className="text-gray-400 group-hover:text-gray-600 transition-colors font-medium flex items-center gap-1">
                <span>Select Project</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
              <Link
                to="/projects"
                onClick={(e) => e.stopPropagation()}
                className="font-bold text-[#A63228] hover:underline"
              >
                All Projects →
              </Link>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => setIsProjectPickerOpen(true)}
            className="bg-white p-3.5 rounded-xl shadow-xs border-2 border-[#8B1A10]/40 hover:border-[#8B1A10] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex justify-between items-start mb-1.5">
                <div className="min-w-0 pr-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[9px] font-bold text-[#8B1A10] tracking-wider uppercase">FOCUSED PROJECT</p>
                    <span className="text-[7.5px] font-bold text-[#8B1A10] bg-[#FDF2F0] border border-[#8B1A10]/20 px-1.5 py-0.2 rounded">
                      {targetProject?.status || 'ONGOING'}
                    </span>
                  </div>
                  <h2 className="text-base font-extrabold text-gray-900 group-hover:text-[#8B1A10] transition-colors truncate mt-0.5" title={targetProject?.name || targetProject?.title}>
                    {targetProject?.name || targetProject?.title}
                  </h2>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#FDF2F0] text-[#8B1A10] border border-[#8B1A10]/20 flex items-center justify-center shrink-0 group-hover:bg-[#8B1A10] group-hover:text-white transition-all shadow-2xs">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#8B1A10]/10 text-[8px]">
              <span className="text-[#8B1A10] font-bold">
                ₱{Number(targetProject?.budget || targetProject?.contract || 0).toLocaleString()} Budget
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProjectId('ALL');
                  }}
                  className="font-bold text-gray-400 hover:text-[#A63228] transition-colors"
                  title="Reset filter"
                >
                  ✕ Reset
                </button>
                <span className="text-gray-300">|</span>
                <span className="font-extrabold text-[#A63228] hover:underline flex items-center gap-0.5">
                  <span>Switch</span>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Card 2: Total Expenses */}
        <Link 
          to={selectedProjectId === 'ALL' ? '/expenses' : `/expenses/${targetProject?.id}`}
          className="bg-white p-3.5 rounded-xl shadow-xs border border-gray-100 hover:border-[#A63228]/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex justify-between items-start mb-1.5">
              <div>
                <p className="text-[9px] font-bold text-gray-400 group-hover:text-[#A63228] transition-colors tracking-wider uppercase">
                  {selectedProjectId === 'ALL' ? 'TOTAL EXPENSES' : 'PROJECT EXPENSES'}
                </p>
                <h2 className="text-xl font-extrabold text-gray-900 group-hover:text-[#A63228] transition-colors mt-0.5">
                  ₱{Number(scopedFinancials.totalSpent).toLocaleString()}
                </h2>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#FDF2F0] text-[#8B1A10] border border-[#8B1A10]/15 flex items-center justify-center shrink-0 group-hover:bg-[#8B1A10] group-hover:text-white transition-all shadow-2xs">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                  <line x1="2" y1="10" x2="22" y2="10"></line>
                  <text x="6.5" y="18" fontSize="8.5" fontWeight="bold" stroke="none" fill="currentColor">₱</text>
                </svg>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-[8px]">
            <p className="text-gray-400 font-medium truncate pr-1">
              Receipts: ₱{scopedFinancials.receiptsSpent.toLocaleString()} · Mat: ₱{scopedFinancials.materialsSpent.toLocaleString()}
            </p>
            <span className="font-bold text-[#A63228] group-hover:underline shrink-0">
              View All →
            </span>
          </div>
        </Link>

        {/* Card 3: Total Manpower */}
        <Link 
          to="/workers" 
          className="bg-white p-3.5 rounded-xl shadow-xs border border-gray-100 hover:border-[#A63228]/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex justify-between items-start mb-1.5">
              <div>
                <p className="text-[9px] font-bold text-gray-400 group-hover:text-[#A63228] transition-colors tracking-wider uppercase">
                  {selectedProjectId === 'ALL' ? 'TOTAL MANPOWER' : 'PROJECT WORKFORCE'}
                </p>
                <h2 className="text-xl font-extrabold text-gray-900 group-hover:text-[#A63228] transition-colors mt-0.5">
                  {scopedWorkers.length}
                </h2>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#FDF2F0] text-[#8B1A10] border border-[#8B1A10]/15 flex items-center justify-center shrink-0 group-hover:bg-[#8B1A10] group-hover:text-white transition-all shadow-2xs">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-[8px]">
            <span className="text-gray-400 group-hover:text-gray-600 transition-colors font-medium">
              {selectedProjectId === 'ALL' ? 'Active team members' : 'Assigned to site'}
            </span>
            <span className="font-bold text-[#A63228] group-hover:underline">
              Workers →
            </span>
          </div>
        </Link>

        {/* Card 4: Equipment */}
        <Link 
          to="/assets" 
          className="bg-white p-3.5 rounded-xl shadow-xs border border-gray-100 hover:border-[#A63228]/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex justify-between items-start mb-1">
              <div>
                <p className="text-[9px] font-bold text-gray-400 group-hover:text-[#A63228] transition-colors tracking-wider uppercase">EQUIPMENT</p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex flex-col">
                    <span className="text-base font-extrabold text-gray-900 group-hover:text-[#A63228] transition-colors leading-none">{equipment.available}</span>
                    <span className="text-[7.5px] text-gray-400 font-medium mt-0.5">Available</span>
                  </div>
                  <div className="h-6 w-px bg-gray-100"></div>
                  <div className="flex flex-col">
                    <span className="text-base font-extrabold text-gray-900 leading-none">{equipment.inUse}</span>
                    <span className="text-[7.5px] text-gray-400 font-medium mt-0.5">In Use</span>
                  </div>
                  <div className="h-6 w-px bg-gray-100"></div>
                  <div className="flex flex-col">
                    <span className="text-base font-extrabold text-gray-900 leading-none">{equipment.maintenance}</span>
                    <span className="text-[7.5px] text-gray-400 font-medium mt-0.5">Repair</span>
                  </div>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#FDF2F0] text-[#8B1A10] border border-[#8B1A10]/15 flex items-center justify-center shrink-0 group-hover:bg-[#8B1A10] group-hover:text-white transition-all shadow-2xs">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-[8px]">
            <span className="text-gray-400 group-hover:text-gray-600 transition-colors font-medium">
              Tools & Inventory
            </span>
            <span className="font-bold text-[#A63228] group-hover:underline">
              Assets →
            </span>
          </div>
        </Link>
      </div>

      {/* ── HERO BUDGET CARD (Dark Red Gradient) ── */}
      <div className="flex flex-col lg:flex-row bg-gradient-to-r from-[#5a0f0a] via-[#7B1F16] to-[#4a0c08] rounded-xl shadow-sm overflow-hidden mb-4 text-white">
        <div className="p-4 lg:w-2/3 border-b lg:border-b-0 lg:border-r border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-extrabold">Expense vs Budget</h3>
            <span className="text-[10px] text-white/70">
              {selectedProjectId === 'ALL'
                ? 'All Projects · Expenses & Materials'
                : `${targetProject?.name || targetProject?.title} · Site Spending & Materials`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-white/70 mb-0.5">Budget</span>
              <strong className="text-base font-extrabold">₱{Number(scopedFinancials.totalBudget).toLocaleString()}</strong>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-white/70 mb-0.5">Actual Spending</span>
              <strong className="text-base font-extrabold">₱{Number(scopedFinancials.totalSpent).toLocaleString()}</strong>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-white/70 mb-0.5">Remaining</span>
              <strong className={`text-base font-extrabold ${scopedFinancials.remaining < 0 ? 'text-red-300' : ''}`}>
                ₱{Number(scopedFinancials.remaining).toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="mt-1">
            <div className="w-full bg-white/20 rounded-full h-1.5 mb-1.5 overflow-hidden">
              <div className="bg-[#E8C547] h-full rounded-full" style={{ width: `${Math.min(scopedFinancials.percent, 100)}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-white/90"><strong>{scopedFinancials.percent}%</strong> of budget used</span>
              <Link 
                to={selectedProjectId === 'ALL' ? '/expenses' : `/expenses/${targetProject?.id}`} 
                className="text-white font-medium hover:underline"
              >
                View Details →
              </Link>
            </div>
          </div>
        </div>

        <div className="p-4 lg:w-1/3 flex flex-col justify-center">
          <div className="flex justify-between items-center mb-2.5">
            <h3 className="text-[9px] font-bold text-white/70 tracking-wider uppercase">EXPENSE BREAKDOWN</h3>
            <span className="text-[8px] font-bold text-[#E8C547] bg-white/10 px-2 py-0.5 rounded-full">Share per Category</span>
          </div>

          {scopedFinancials.categories.length === 0 ? (
            <p className="text-[10px] text-white/50 text-center py-4">No expenses recorded yet.</p>
          ) : (
            <div className="flex items-center gap-3">
              {/* SVG Donut Chart */}
              <div className="relative w-18 h-18 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="15" />
                  {(() => {
                    const total = scopedFinancials.totalSpent || 1;
                    const circ = 2 * Math.PI * 38; // ~238.76
                    let accumulated = 0;
                    const colors = ['#E8C547', '#FFFFFF', '#FCA5A5', '#93C5FD', '#A7F3D0'];
                    return scopedFinancials.categories.map((cat, idx) => {
                      const val = Number(cat.total || 0);
                      const dash = (val / total) * circ;
                      const offset = -accumulated;
                      accumulated += dash;
                      return (
                        <circle
                          key={idx}
                          cx="50"
                          cy="50"
                          r="38"
                          fill="none"
                          stroke={colors[idx % colors.length]}
                          strokeWidth="15"
                          strokeDasharray={`${Math.max(dash - 1.5, 0)} ${circ}`}
                          strokeDashoffset={offset}
                          className="transition-all duration-300"
                        />
                      );
                    });
                  })()}
                </svg>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-extrabold text-[#E8C547] leading-none">
                    {scopedFinancials.percent}%
                  </span>
                  <span className="text-[6.5px] text-white/60 font-semibold leading-none mt-0.5">Used</span>
                </div>
              </div>

              {/* Category Legend & Mini Progress Bars */}
              <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                {scopedFinancials.categories.slice(0, 3).map((cat, i) => {
                  const colors = ['#E8C547', '#FFFFFF', '#FCA5A5', '#93C5FD', '#A7F3D0'];
                  const color = colors[i % colors.length];
                  const pct = scopedFinancials.totalSpent > 0 ? Math.round((Number(cat.total) / scopedFinancials.totalSpent) * 100) : 0;
                  return (
                    <div key={i} className="flex flex-col gap-0.5">
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="font-medium text-white/90 truncate flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }}></span>
                          <span className="truncate">{cat.category}</span>
                        </span>
                        <span className="font-extrabold ml-1 shrink-0">{pct}%</span>
                      </div>
                      <div className="w-full bg-white/15 rounded-full h-1 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── EXPENSE TRENDS & CLUSTERED COMPARISON ── */}
      {(() => {
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const currentMonth = new Date().getMonth(); // 0-indexed
        const maxVal = Math.max(...scopedMonthlyData, 1);
        const fmt = (v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v/1000)}k` : v;

        // Linear Regression Calculation for Time-Based Trendline
        const activePoints = scopedMonthlyData
          .map((v, i) => ({ x: i + 1, y: v, i, hasData: v > 0 }));
        const pointsWithData = activePoints.filter(p => p.hasData);
        const polylinePoints = pointsWithData.map(p => `${p.i * 100},${110 - Math.round((p.y / maxVal) * 100)}`).join(' ');

        let mSlope = 0, bIntercept = 0, hasRegression = false;
        if (pointsWithData.length >= 2) {
          const n = pointsWithData.length;
          const sumX = pointsWithData.reduce((s, p) => s + p.x, 0);
          const sumY = pointsWithData.reduce((s, p) => s + p.y, 0);
          const sumXY = pointsWithData.reduce((s, p) => s + (p.x * p.y), 0);
          const sumXX = pointsWithData.reduce((s, p) => s + (p.x * p.x), 0);
          const denom = (n * sumXX) - (sumX * sumX);
          if (denom !== 0) {
            mSlope = ((n * sumXY) - (sumX * sumY)) / denom;
            bIntercept = (sumY - (mSlope * sumX)) / n;
            hasRegression = true;
          }
        }

        const trendX1 = 0;
        const trendY1Val = Math.max(0, bIntercept + (mSlope * 1));
        const trendY1 = Math.max(-20, Math.min(130, 110 - Math.round((trendY1Val / maxVal) * 100)));
        const lastIdx = Math.max(currentMonth, pointsWithData[pointsWithData.length - 1]?.i || 5);
        const trendX2 = lastIdx * 100;
        const trendY2Val = Math.max(0, bIntercept + (mSlope * (lastIdx + 1)));
        const trendY2 = Math.max(-20, Math.min(130, 110 - Math.round((trendY2Val / maxVal) * 100)));

        // Clustered Comparison Data: Project Budget vs Actual Spent
        const activeProjectsList = projectSummaries
          .filter(p => !isUpcomingStatus(p.status))
          .slice(0, 4);
        const displayProjects = activeProjectsList.length > 0 ? activeProjectsList : projectSummaries.slice(0, 4);
        const maxClusterVal = Math.max(
          ...displayProjects.map(p => Math.max(Number(p.budget || 0), Number(p.spent || 0))),
          1000
        );

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            {/* CHART 1: EXPENSE TRAJECTORY WITH TIME-BASED FORECAST TRENDLINE */}
            <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-extrabold text-gray-900">Expense Trajectory & Forecast</h3>
                    {hasRegression && (
                      <span className="text-[7.5px] font-bold text-amber-800 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded" title="Linear trendline equation">
                        y = {mSlope >= 0 ? '+' : ''}{Math.round(mSlope)}x {bIntercept >= 0 ? '+' : '-'} {Math.abs(Math.round(bIntercept))}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-gray-400 font-medium mt-0.5">
                    {selectedProjectId === 'ALL' ? 'Historical moving trend with linear forecast line.' : `${targetProject?.name || 'Site'} trend and linear forecast.`}
                  </p>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-2.5 text-[8px] font-bold">
                  <span className="flex items-center gap-1 text-[#8B1A10]">
                    <span className="w-2.5 h-0.5 bg-[#8B1A10] rounded-full inline-block"></span>
                    Actual
                  </span>
                  <span className="flex items-center gap-1 text-amber-600">
                    <span className="w-2.5 h-0.5 border-t-2 border-dashed border-amber-500 inline-block"></span>
                    Forecast
                  </span>
                </div>
              </div>

              <div className="relative h-28 w-full mb-1">
                <div className="px-3 h-full w-full">
                  <svg viewBox="0 -30 1100 160" className="w-full h-full overflow-visible">
                    <line x1="0" y1="20" x2="1100" y2="20" stroke="#f3f4f6" strokeWidth="2.5" />
                    <line x1="0" y1="65" x2="1100" y2="65" stroke="#f3f4f6" strokeWidth="2.5" />
                    <line x1="0" y1="110" x2="1100" y2="110" stroke="#f3f4f6" strokeWidth="2.5" />

                    {/* Golden Linear Trendline */}
                    {hasRegression && (
                      <line
                        x1={trendX1}
                        y1={trendY1}
                        x2={trendX2}
                        y2={trendY2}
                        stroke="#eab308"
                        strokeWidth="3.5"
                        strokeDasharray="6,6"
                        strokeLinecap="round"
                        opacity="0.85"
                      />
                    )}

                    {/* Actual Polyline */}
                    {pointsWithData.length > 1 && (
                      <polyline
                        points={polylinePoints}
                        fill="none"
                        stroke="#8B1A10"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Points */}
                    {pointsWithData.map((p, idx) => {
                      const cx = p.i * 100;
                      const cy = 110 - Math.round((p.y / maxVal) * 100);
                      const isLast = idx === pointsWithData.length - 1;
                      return (
                        <g key={p.i}>
                          <circle cx={cx} cy={cy} r={isLast ? 12 : 8} fill="#8B1A10" stroke="#fff" strokeWidth="2" />
                          <text
                            x={cx}
                            y={cy - 16}
                            fontSize={isLast ? 24 : 20}
                            fontWeight={isLast ? 'bold' : '600'}
                            fill={isLast ? '#8B1A10' : '#6b7280'}
                            textAnchor="middle"
                          >
                            ₱{fmt(p.y)}
                          </text>
                        </g>
                      );
                    })}

                    {pointsWithData.length === 0 && (
                      <text x="550" y="65" fontSize="24" fill="#d1d5db" textAnchor="middle">
                        No expense logs recorded yet
                      </text>
                    )}
                  </svg>
                </div>
                <div className="flex justify-between px-3 text-[7.5px] font-bold text-gray-400 uppercase mt-2">
                  {MONTHS.map((m, i) => (
                    <span key={m} className={i === currentMonth ? 'text-[#8B1A10] font-extrabold' : ''}>{m}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* CHART 2: CLUSTERED COLUMN CHART (PROJECT BUDGET VS ACTUAL SPENT) */}
            <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-xs font-extrabold text-gray-900">Project Budget vs. Actual Cost</h3>
                  <p className="text-[9px] text-gray-400 font-medium mt-0.5">
                    Clustered comparison across active projects.
                  </p>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-2.5 text-[8px] font-bold">
                  <span className="flex items-center gap-1 text-slate-500">
                    <span className="w-2 h-2 bg-slate-300 rounded-2xs inline-block"></span>
                    Budget
                  </span>
                  <span className="flex items-center gap-1 text-[#8B1A10]">
                    <span className="w-2 h-2 bg-[#8B1A10] rounded-2xs inline-block"></span>
                    Spent
                  </span>
                </div>
              </div>

              {displayProjects.length === 0 ? (
                <div className="h-28 flex items-center justify-center text-[10px] text-gray-400">
                  No projects available for comparison
                </div>
              ) : (
                <div className="relative h-28 w-full flex flex-col justify-end">
                  <div className="flex items-end justify-around h-24 px-2 border-b border-gray-100 pb-1">
                    {displayProjects.map((p, idx) => {
                      const budgetH = maxClusterVal > 0 ? Math.min(100, Math.round((Number(p.budget || 0) / maxClusterVal) * 95)) : 0;
                      const spentH = maxClusterVal > 0 ? Math.min(100, Math.round((Number(p.spent || 0) / maxClusterVal) * 95)) : 0;
                      const isOverBudget = Number(p.spent || 0) > Number(p.budget || 0) && Number(p.budget || 0) > 0;

                      return (
                        <div key={p.id || idx} className="w-[22%] flex flex-col items-center h-full justify-end group relative">
                          {/* Tooltip on hover */}
                          <div className="absolute -top-7 hidden group-hover:flex flex-col items-center bg-gray-900 text-white text-[7px] py-1 px-1.5 rounded shadow-lg z-20 pointer-events-none whitespace-nowrap">
                            <span className="font-bold">{p.name || p.title}</span>
                            <span>Budget: ₱{fmt(p.budget)} · Spent: ₱{fmt(p.spent)} ({p.pct}%)</span>
                          </div>

                          <div className="w-full flex items-end justify-center gap-1.5 h-full">
                            {/* Budget Bar */}
                            <div
                              className="w-[42%] bg-slate-200 hover:bg-slate-300 rounded-t-sm transition-all"
                              style={{ height: `${Math.max(budgetH, 4)}%` }}
                              title={`Budget: ₱${Number(p.budget || 0).toLocaleString()}`}
                            />
                            {/* Spent Bar */}
                            <div
                              className={`w-[42%] rounded-t-sm transition-all ${
                                isOverBudget ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#8B1A10] hover:bg-[#A63228]'
                              }`}
                              style={{ height: `${Math.max(spentH, 4)}%` }}
                              title={`Spent: ₱${Number(p.spent || 0).toLocaleString()} (${p.pct}%)`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Project Labels on X-axis */}
                  <div className="flex justify-around px-2 text-[7px] font-bold text-gray-500 uppercase mt-2">
                    {displayProjects.map((p, idx) => {
                      const words = (p.name || p.title || `P${idx+1}`).split(' ');
                      const displayLabel = words.slice(0, 2).join(' ');
                      return (
                        <span key={p.id || idx} className="w-[22%] text-center truncate" title={p.name || p.title}>
                          {displayLabel}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── MIDDLE ROW: Projects & Expenses ── */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        {/* Active Projects Table */}
        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 overflow-x-auto min-h-[220px]">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-gray-900">Active Projects</h3>
              {selectedProjectId !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedProjectId('ALL')}
                  className="text-[8.5px] font-bold text-[#A63228] hover:underline"
                >
                  (Reset Filter)
                </button>
              )}
            </div>
            <Link to="/projects" className="text-[10px] text-[#A63228] font-bold hover:underline">View All →</Link>
          </div>
          <table className="w-full text-left border-collapse min-w-[400px]">
            <thead>
              <tr>
                <th className="text-[9px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[50%] uppercase tracking-wider">PROJECT</th>
                <th className="text-[9px] font-bold text-gray-400 border-b border-gray-100 pb-2 text-right pr-4 w-[25%] uppercase tracking-wider">BUDGET</th>
                <th className="text-[9px] font-bold text-gray-400 border-b border-gray-100 pb-2 pl-4 w-[25%] uppercase tracking-wider">PROGRESS</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr><td colSpan={3} className="py-4 text-center text-[10px] text-gray-400">No active projects.</td></tr>
              ) : projects.map(p => {
                const isSelected = String(p.id) === String(selectedProjectId);
                return (
                  <tr 
                    key={p.id}
                    onClick={() => setSelectedProjectId(isSelected ? 'ALL' : String(p.id))}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-red-50/70 font-bold' : 'hover:bg-gray-50/80'}`}
                    title={isSelected ? 'Click to show all projects' : `Click to focus dashboard on ${p.name || p.title}`}
                  >
                    <td className="py-2 text-[10px] font-bold text-gray-800 border-b border-gray-50 flex items-center gap-1.5">
                      <span>{p.name || p.title}</span>
                      {isSelected && (
                        <span className="text-[7px] font-extrabold text-[#A63228] bg-red-100/80 px-1.5 py-0.2 rounded uppercase">
                          Focused
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-[10px] text-gray-900 font-extrabold border-b border-gray-50 text-right pr-4">₱{Number(p.budget || p.contract || 0).toLocaleString()}</td>
                    <td className="py-2 border-b border-gray-50 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="w-14 bg-gray-200 rounded-full h-1 overflow-hidden"><div className="bg-[#A63228] h-full rounded-full" style={{ width: `${p.progress || 0}%` }}></div></div>
                        <span className="text-[9px] font-bold text-gray-700 w-6">{p.progress || 0}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Recent Activity List: Expenses & Material Logs */}
        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900 leading-tight">Recent Activity</h3>
                <p className="text-[8.5px] text-gray-400 font-medium">Expenses & Material Usage</p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-gray-100/80 p-0.5 rounded-lg border border-gray-200/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setActivityFilter('ALL')}
                  className={`text-[8px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    activityFilter === 'ALL'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  All ({scopedRecentActivities.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActivityFilter('RECEIPT')}
                  className={`text-[8px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    activityFilter === 'RECEIPT'
                      ? 'bg-white text-[#A63228] shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Receipts ({scopedRecentActivities.filter(e => e.type !== 'material').length})
                </button>
                <button
                  type="button"
                  onClick={() => setActivityFilter('MATERIAL')}
                  className={`text-[8px] font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    activityFilter === 'MATERIAL'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Materials ({scopedRecentActivities.filter(e => e.type === 'material').length})
                </button>
              </div>
            </div>

            {/* Scrollable Container with max height (prevents card from stretching the dashboard) */}
            <div className="flex flex-col max-h-[170px] overflow-y-auto pr-1.5 scrollbar-custom divide-y divide-gray-50">
              {filteredActivities.length === 0 ? (
                <p className="text-[10px] text-gray-400 text-center py-6">
                  {activityFilter === 'MATERIAL' 
                    ? 'No material usage logs.' 
                    : activityFilter === 'RECEIPT' 
                      ? 'No expense receipts.' 
                      : 'No recent activity.'}
                </p>
              ) : filteredActivities.map((item, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 hover:bg-gray-50/50 px-1 rounded transition-colors">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className={`text-[7px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                      item.type === 'material' 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/60' 
                        : 'bg-red-50 text-[#A63228] border border-red-100'
                    }`}>
                      {item.type === 'material' ? 'Material' : 'Receipt'}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-[10px] font-bold text-gray-900 leading-tight truncate">
                        {item.description || item.category}
                      </h4>
                      <p className="text-[8.5px] text-gray-400 mt-0.5">{item.date}</p>
                    </div>
                  </div>
                  <strong className="text-[11px] font-extrabold text-gray-900 shrink-0">
                    ₱{Number(item.amount || 0).toLocaleString()}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Footer Links */}
          <div className="pt-2 border-t border-gray-100 flex justify-between items-center mt-1 text-[8.5px]">
            <span className="text-gray-400 font-medium">Scroll to view more records</span>
            <div className="flex items-center gap-2 font-bold">
              <Link to="/expenses" className="text-[#A63228] hover:underline">Expenses →</Link>
              <span className="text-gray-300">|</span>
              <Link to="/materials" className="text-emerald-700 hover:underline">Materials →</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: Equipment & Workforce ── */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Equipment Status */}
        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-extrabold text-gray-900">Equipment Status</h3>
            <Link to="/assets" className="text-[10px] text-[#A63228] font-bold hover:underline">View Assets →</Link>
          </div>
          <div className="flex justify-between gap-2.5 mb-3">
            <div className="flex-1 bg-[#EAD9D8] text-center p-2 rounded-lg">
              <h2 className="text-lg font-extrabold text-gray-900">{equipment.available}</h2>
              <p className="text-[8px] font-bold text-gray-600 tracking-wider mt-0.5 uppercase">AVAILABLE</p>
            </div>
            <div className="flex-1 bg-[#EAD9D8] text-center p-2 rounded-lg">
              <h2 className="text-lg font-extrabold text-gray-900">{equipment.inUse}</h2>
              <p className="text-[8px] font-bold text-gray-600 tracking-wider mt-0.5 uppercase">IN USE</p>
            </div>
            <div className="flex-1 bg-[#EAD9D8] text-center p-2 rounded-lg">
              <h2 className="text-lg font-extrabold text-gray-900">{equipment.maintenance}</h2>
              <p className="text-[8px] font-bold text-gray-600 tracking-wider mt-0.5 uppercase">MAINTENANCE</p>
            </div>
          </div>
          {equipment.inUse > 0 && (
            <div className="bg-[#fce8e6] text-[#A63228] text-[10px] p-1.5 rounded-lg text-center font-bold">
              {equipment.inUse} tool{equipment.inUse > 1 ? 's' : ''} currently in use
            </div>
          )}
        </div>

        {/* Today's Workforce */}
        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-extrabold text-gray-900">Today's Workforce</h3>
            <Link to="/attendance" className="text-[10px] text-[#A63228] font-bold hover:underline">View Attendance →</Link>
          </div>
          <div className="flex gap-2.5 mb-3">
            <div className="flex-1 p-2.5 rounded-lg text-center bg-[#E1F0E5] text-[#2c6e3c]">
              <h2 className="text-xl font-extrabold">{workforce.present}</h2>
              <p className="text-[8px] font-bold tracking-wider mt-0.5 uppercase text-[#478f58]">PRESENT</p>
            </div>
            <div className="flex-1 p-2.5 rounded-lg text-center bg-[#fce8e6] text-[#A63228]">
              <h2 className="text-xl font-extrabold">{workforce.absent}</h2>
              <p className="text-[8px] font-bold tracking-wider mt-0.5 uppercase text-[#b34940]">ABSENT</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {workforce.roles.map((r, i) => (
              <div key={i} className={`flex justify-between text-[10px] ${i < workforce.roles.length - 1 ? 'pb-1.5 border-b border-gray-100' : ''}`}>
                <span className="text-gray-600 font-medium">{r.role}</span>
                <strong className="text-gray-900">{r.count}</strong>
              </div>
            ))}
            {workforce.roles.length === 0 && <p className="text-[10px] text-gray-400 text-center">No attendance today.</p>}
            <div className="flex justify-between text-[11px] mt-0.5 bg-[#EAD9D8] p-1.5 rounded-lg">
              <span className="font-bold text-gray-800">Today's Payroll</span>
              <strong className="text-gray-900 font-extrabold">₱{Number(workforce.todayPayroll).toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </div>



      {/* ═════════ PROJECT PICKER MODAL (Interactive Drill-Down by Project) ═════════ */}
      {isProjectPickerOpen && (
        <div 
          onClick={() => { setIsProjectPickerOpen(false); setProjectSearchQuery(''); }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 transition-all"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-[620px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 shrink-0 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-[#A63228] flex items-center justify-center shrink-0 shadow-2xs">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 20h20"></path>
                    <path d="M5 20V8l7-5 7 5v12"></path>
                    <path d="M9 20v-5h6v5"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#1a1a1a]">Select Project Scope</h3>
                  <p className="text-[10px] sm:text-xs text-gray-500 font-medium mt-0.5">
                    Filter dashboard analytics, expenses, budget, and workforce by project.
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => { setIsProjectPickerOpen(false); setProjectSearchQuery(''); }} 
                className="text-gray-400 hover:text-gray-700 bg-white border border-gray-200/80 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-3 sm:p-3.5 border-b border-gray-100 bg-white shrink-0">
              <div className="relative">
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Search project name..."
                  value={projectSearchQuery}
                  onChange={(e) => setProjectSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-gray-800 placeholder-gray-400 outline-none focus:border-[#A63228] focus:bg-white transition-all"
                  autoFocus
                />
                {projectSearchQuery && (
                  <button 
                    type="button"
                    onClick={() => setProjectSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 scrollbar-custom">
              {/* Option 1: ALL PROJECTS (Overview) */}
              {(!projectSearchQuery || 'all projects overview consolidated'.includes(projectSearchQuery.toLowerCase())) && (
                <div
                  onClick={() => {
                    setSelectedProjectId('ALL');
                    setIsProjectPickerOpen(false);
                    setProjectSearchQuery('');
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                    selectedProjectId === 'ALL'
                      ? 'bg-red-50/80 border-[#A63228] shadow-xs'
                      : 'bg-white border-gray-200/80 hover:border-gray-300 hover:bg-gray-50/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      selectedProjectId === 'ALL' ? 'bg-[#A63228] text-white shadow-xs' : 'bg-gray-100 text-gray-500 group-hover:bg-red-50 group-hover:text-[#A63228]'
                    }`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-extrabold text-gray-900">All Projects (Overview)</h4>
                        {selectedProjectId === 'ALL' && (
                          <span className="text-[8px] font-bold text-[#A63228] bg-white border border-red-200 px-1.5 py-0.2 rounded-full">
                            Active Scope
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-gray-500 mt-0.5">
                        Consolidated totals across all {projects.length} sites & budgets
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold block">Total Budget</span>
                    <strong className="text-xs font-extrabold text-gray-900">
                      ₱{projects.reduce((s, p) => s + Number(p.budget || p.contract || 0), 0).toLocaleString()}
                    </strong>
                  </div>
                </div>
              )}

              {/* Section Header */}
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-[8.5px] font-extrabold text-gray-400 uppercase tracking-wider">INDIVIDUAL PROJECTS</span>
                <span className="text-[8.5px] font-bold text-gray-400">
                  {projectSummaries.filter(p => !projectSearchQuery || (p.name || p.title || '').toLowerCase().includes(projectSearchQuery.toLowerCase())).length} found
                </span>
              </div>

              {/* Project Cards */}
              {projectSummaries
                .filter(p => !projectSearchQuery || (p.name || p.title || '').toLowerCase().includes(projectSearchQuery.toLowerCase()))
                .map(p => {
                  const isSelected = String(p.id) === String(selectedProjectId);
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedProjectId(String(p.id));
                        setIsProjectPickerOpen(false);
                        setProjectSearchQuery('');
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 group ${
                        isSelected
                          ? 'bg-emerald-50/70 border-emerald-500 shadow-xs'
                          : 'bg-white border-gray-200/80 hover:border-gray-300 hover:bg-gray-50/80'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors mt-0.5 ${
                            isSelected ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500 group-hover:bg-red-50 group-hover:text-[#A63228]'
                          }`}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-extrabold text-gray-900 group-hover:text-[#A63228] transition-colors truncate">
                                {p.name || p.title}
                              </h4>
                              <span className={`text-[7.5px] font-bold px-1.5 py-0.2 rounded shrink-0 uppercase ${
                                isUpcomingStatus(p.status)
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : (p.status || '').toUpperCase() === 'COMPLETED'
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              }`}>
                                {p.status || 'ONGOING'}
                              </span>
                              {isSelected && (
                                <span className="text-[7.5px] font-extrabold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.2 rounded-full inline-flex items-center gap-1">
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                  <span>Active Filter</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[9px] text-gray-500 mt-0.5">
                              {p.workersCount} assigned worker{p.workersCount === 1 ? '' : 's'} · Progress: {p.progress || 0}%
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[8px] uppercase tracking-wider text-gray-400 font-bold block">Budget</span>
                          <strong className="text-xs font-extrabold text-gray-900">
                            ₱{Number(p.budget || 0).toLocaleString()}
                          </strong>
                        </div>
                      </div>

                      {/* Mini Metrics & Progress */}
                      <div className="flex items-center justify-between text-[9px] text-gray-500 pt-1 border-t border-gray-100/80">
                        <div className="flex items-center gap-2">
                          <span>Spent: <strong className="text-gray-800">₱{Number(p.spent || 0).toLocaleString()}</strong></span>
                          <span>({p.pct}% of budget)</span>
                        </div>
                        <span className="text-[8px] font-bold text-[#A63228] group-hover:underline">
                          {isSelected ? 'Currently Viewing' : 'Select Project →'}
                        </span>
                      </div>
                    </div>
                  );
                })}

              {projectSummaries.filter(p => !projectSearchQuery || (p.name || p.title || '').toLowerCase().includes(projectSearchQuery.toLowerCase())).length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs text-gray-400 font-medium">No projects found matching "{projectSearchQuery}".</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/70 flex justify-between items-center text-[9px] text-gray-500 shrink-0">
              <div className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
                <span>Tip: You can also click any row in the Active Projects table below to filter.</span>
              </div>
              <button
                type="button"
                onClick={() => { setIsProjectPickerOpen(false); setProjectSearchQuery(''); }}
                className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-gray-700 font-bold hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  )
}
