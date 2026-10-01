import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Tesseract from 'tesseract.js'
import { api } from '../api'

export default function Dashboard() {
  const [todayISO, setTodayISO] = useState('');
  const [modalState, setModalState] = useState('NONE');
  const [projects, setProjects] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [kpi, setKpi] = useState({ activeProjects: 0, totalExpenses: 0, totalManpower: 0 });
  const [workforce, setWorkforce] = useState({ present: 0, absent: 0, roles: [], todayPayroll: 0 });
  const [equipment, setEquipment] = useState({ available: 0, inUse: 0, maintenance: 0 });
  const [budget, setBudget] = useState({ totalBudget: 0, totalSpent: 0, remaining: 0, percent: 0, categories: [] });
  const [monthlyData, setMonthlyData] = useState(Array(12).fill(0));

  // Form & Image State
  const [formData, setFormData] = useState({
    project: '',
    receiptNo: '',
    date: '',
    time: '',
    category: 'Materials',
    items: [{ qty: '', description: '' }],
    amount: '',
    cashTendered: '',
    change: ''
  });
  const [photoData, setPhotoData] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [scanProgress, setScanProgress] = useState('Extracting details...');

  // References for Camera
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);

  const MAX_AMOUNT = 999999999999;
  const [amountError, setAmountError] = useState('');

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const cleanName = (raw) => {
    if (!raw) return 'Administrator';
    const trimmed = String(raw).trim();
    return trimmed.startsWith('Engr.') ? trimmed : `Engr. ${trimmed}`;
  };

  const [adminName, setAdminName] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('adminProfile') || '{}');
      const session = JSON.parse(localStorage.getItem('adminSession') || '{}');
      const name = saved.fullName || saved.name || session.fullName || (saved.firstName ? `${saved.firstName} ${saved.lastName || ''}`.trim() : null) || session.username;
      return name ? cleanName(name) : 'Administrator';
    } catch {
      return 'Administrator';
    }
  });

  useEffect(() => {
    const updateAdminName = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('adminProfile') || '{}');
        const session = JSON.parse(localStorage.getItem('adminSession') || '{}');
        const name = saved.fullName || saved.name || session.fullName || (saved.firstName ? `${saved.firstName} ${saved.lastName || ''}`.trim() : null) || session.username;
        if (name) setAdminName(cleanName(name));
      } catch {}
    };

    // 1. Fetch fresh admin profile directly from database on dashboard mount
    const adminId = localStorage.getItem('adminId') || 1;
    api.get(`/admin/profile/${adminId}`)
      .then(data => {
        if (data && !data.error) {
          const fetchedName = data.fullName || [data.firstName, data.lastName].filter(Boolean).join(' ') || data.username || 'Administrator';
          setAdminName(cleanName(fetchedName));
          localStorage.setItem('adminProfile', JSON.stringify({ ...data, fullName: fetchedName }));
        }
      })
      .catch(console.warn);

    window.addEventListener('admin-profile-updated', updateAdminName);
    return () => window.removeEventListener('admin-profile-updated', updateAdminName);
  }, []);

  useEffect(() => {
    const date = new Date('2026-09-05');
    const iso = date.toISOString().split('T')[0];
    queueMicrotask(() => {
      setTodayISO(iso);
      setFormData(prev => ({
        ...prev,
        date: iso,
        time: date.toTimeString().split(' ')[0].substring(0, 5)
      }));
    });
    api.get('/projects').then(data => {
      setProjects(data);
      if (data.length > 0) setFormData(prev => ({ ...prev, project: data[0].name || data[0].title }));
      setKpi(prev => ({ ...prev, activeProjects: data.length }));
    }).catch(() => {});
    api.get('/expenses/summary').then(data => {
      setKpi(prev => ({ ...prev, totalExpenses: data.total || 0 }));
      setRecentExpenses(data.recent || []);
    }).catch(() => {});
    api.get('/workers/summary').then(data => {
      setKpi(prev => ({ ...prev, totalManpower: data.totalManpower || 0 }));
      setWorkforce({ present: data.presentToday, absent: data.absent, roles: data.roles || [], todayPayroll: data.todayPayroll || 0 });
    }).catch(() => {});
    api.get('/assets/summary').then(data => {
      setEquipment({ available: data.available, inUse: data.inUse, maintenance: data.maintenance });
    }).catch(() => {});
    api.get('/expenses/budget-summary').then(data => {
      setBudget(data);
    }).catch(() => {});
    api.get('/expenses/monthly').then(data => {
      setMonthlyData(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      stream?.getTracks().forEach(track => track.stop());
      if (video) video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    if (isCameraOn && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current.play().catch(e => console.error("Error playing video:", e));
      };
    }
  }, [isCameraOn, stream]);

  // General Input Handler
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'amount' || name === 'cashTendered') {
      const num = parseFloat(value);
      if (num > MAX_AMOUNT) {
        setAmountError('Amount cannot exceed ₱999,999,999,999.');
      } else if (num < 0) {
        setAmountError('Amount cannot be negative.');
      } else {
        setAmountError('');
      }
    }
    setFormData({ ...formData, [name]: value });
  };

  // Dynamic Item Handlers
  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const addNewItem = () => {
    setFormData({ ...formData, items: [...formData.items, { qty: '', description: '' }] });
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  // Manual Add Functions
  const handleInitialSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount || 0);
    if (amt > MAX_AMOUNT) {
      setAmountError('Expense amount cannot exceed ₱999,999,999,999.');
      return;
    }
    if (amt <= 0) {
      setAmountError('Please enter a valid expense amount.');
      return;
    }
    setAmountError('');
    setModalState('CONFIRM');
  };
  const handleConfirmAdd = () => setModalState('SUCCESS');

  // Scan Receipt Functions
  const handleScanDetailsSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(formData.amount || 0);
    const cash = parseFloat(formData.cashTendered || 0);
    if (amt > MAX_AMOUNT || cash > MAX_AMOUNT) {
      setAmountError('Amount cannot exceed ₱999,999,999,999.');
      return;
    }
    if (amt <= 0) {
      setAmountError('Please enter a valid expense amount.');
      return;
    }
    setAmountError('');
    setModalState('SCAN_CONFIRM');
  };
  const handleScanConfirmAdd = () => setModalState('SCAN_SUCCESS');

  // TESSERACT.JS OCR LOGIC WITH MULTIPLE ITEMS EXTRACTION
  const handleStartScanning = async () => {
    setModalState('SCANNING');

    try {
      const result = await Tesseract.recognize(
        photoData,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setScanProgress(`Reading text... ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      const text = result.data.text;
      console.log("OCR Extracted Text:\n", text);

      const safeText = text.replace(/Cashier.*$/mi, '');

      const extractMoney = (keywords) => {
        const regex = new RegExp(`\\b(?:${keywords})\\b[^\\d]*([\\d,]+\\.\\d{2})`, 'i');
        const match = safeText.match(regex);
        return match ? match[1].replace(/,/g, '') : '';
      };

      // 1. Financials
      let parsedAmount = extractMoney('TOTAL AMOUNT|TOTAL');
      let parsedCash = extractMoney('CASH PAID|CASH|PAID|TENDERED');
      let parsedChange = extractMoney('CHANGE');

      // 2. Date Extraction
      let parsedDate = todayISO;
      const dateMatch = safeText.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i);
      if (dateMatch) {
        const d = new Date(dateMatch[0]);
        if (!isNaN(d)) parsedDate = d.toISOString().split('T')[0];
      }

      // 3. Receipt Number
      const receiptMatch = safeText.match(/(?:Receipt No|OR#?)[^\d]*(\d+)/i);
      const parsedReceiptNo = receiptMatch ? receiptMatch[1] : '';

      // 4. Time
      let parsedTime = '';
      const timeMatch = safeText.match(/Time[^\d]*(\d{1,2})[:.;](\d{2})\s*([AP]M)/i);
      if (timeMatch) {
        let hrs = parseInt(timeMatch[1]);
        const mins = timeMatch[2];
        const modifier = timeMatch[3].toUpperCase();
        if (modifier === 'PM' && hrs < 12) hrs += 12;
        if (modifier === 'AM' && hrs === 12) hrs = 0;
        parsedTime = `${hrs.toString().padStart(2, '0')}:${mins}`;
      }

      // 5. Multiple Items Extraction
      let parsedItems = [];
      const itemRegex = /\b(\d+)\s+([A-Za-z\s]+?)\s+@/g;
      let match;
      while ((match = itemRegex.exec(safeText)) !== null) {
        parsedItems.push({ qty: match[1], description: match[2].trim() });
      }

      if (parsedItems.length === 0) {
        parsedItems = [{ qty: '', description: 'Scanned Item' }];
      }

      // Auto-fill state
      setFormData(prev => ({
        ...prev,
        receiptNo: parsedReceiptNo,
        amount: parsedAmount,
        date: parsedDate,
        time: parsedTime,
        items: parsedItems,
        cashTendered: parsedCash,
        change: parsedChange,
        category: 'Materials'
      }));

      setModalState('SCAN_DETAILS');

    } catch (error) {
      console.error("OCR Error:", error);
      setScanProgress('Failed to read image clearly. Please enter manually.');
      setTimeout(() => setModalState('SCAN_DETAILS'), 2000);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      setIsCameraOn(true);
    } catch (err) {
      console.error("Error accessing camera", err);
      alert("Camera access denied or unavailable. Please check your browser permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoData(reader.result);
        setModalState('SCAN_REVIEW');
      };
      reader.readAsDataURL(file);
    }
  };

  const retakePhoto = () => {
    setPhotoData(null);
    setModalState('SCAN_START');
    setTimeout(() => startCamera(), 100);
  };

  const resetAndClose = () => {
    stopCamera();
    setPhotoData(null);
    setAmountError('');
    setModalState('NONE');
    setFormData({
      project: projects[0]?.name || projects[0]?.title || '',
      receiptNo: '',
      date: todayISO,
      time: '',
      category: 'Materials',
      items: [{ qty: '', description: '' }],
      amount: '',
      cashTendered: '',
      change: ''
    });
  };

  const selectStyles = {
    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
    backgroundPosition: 'right 0.75rem center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '1rem 1rem'
  };

  return (
    <AdminLayout>

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-2">
        <div>
          <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">DASHBOARD</span>
          <h1 className="text-lg md:text-xl font-extrabold text-gray-900 mt-0.5">{getGreeting()}, {adminName}.</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">Here's an overview of your projects and expenses.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalState('ADD')}
            className="bg-[#E8C547] text-gray-900 px-3 py-1.5 rounded-lg font-bold text-[11px] shadow-sm hover:bg-[#d4b33d] transition-colors"
          >
            + Add Expense
          </button>
          <button
            onClick={() => { setModalState('SCAN_START'); setPhotoData(null); }}
            className="bg-white border border-[#A63228] text-[#A63228] px-3 py-1.5 rounded-lg font-bold text-[11px] shadow-sm hover:bg-red-50 transition-colors"
          >
            Scan Receipt
          </button>
        </div>
      </div>

      {/* ── 4 TOP KPI CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-[9px] font-bold text-gray-400 tracking-wider mb-1 uppercase">ACTIVE PROJECTS</p>
          <h2 className="text-xl font-extrabold text-gray-900">{kpi.activeProjects}</h2>
        </div>
        <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-[9px] font-bold text-gray-400 tracking-wider mb-1 uppercase">TOTAL EXPENSES</p>
          <h2 className="text-xl font-extrabold text-gray-900">₱{Number(kpi.totalExpenses).toLocaleString()}</h2>
        </div>
        <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-[9px] font-bold text-gray-400 tracking-wider mb-1 uppercase">TOTAL MANPOWER</p>
          <h2 className="text-xl font-extrabold text-gray-900">₱{Number(kpi.totalManpower).toLocaleString()}</h2>
        </div>
        <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-[9px] font-bold text-gray-400 tracking-wider mb-0.5 uppercase">EQUIPMENT</p>
          <div className="flex justify-between items-center mt-1">
            <div className="flex flex-col text-center">
              <h3 className="text-base font-extrabold text-gray-900">{equipment.available}</h3>
              <span className="text-[8px] text-gray-500 font-medium">Available</span>
            </div>
            <div className="flex flex-col text-center">
              <h3 className="text-base font-extrabold text-gray-900">{equipment.inUse}</h3>
              <span className="text-[8px] text-gray-500 font-medium">In Use</span>
            </div>
            <div className="flex flex-col text-center">
              <h3 className="text-base font-extrabold text-gray-900">{equipment.maintenance}</h3>
              <span className="text-[8px] text-gray-500 font-medium">Maintenance</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── HERO BUDGET CARD (Dark Red Gradient) ── */}
      <div className="flex flex-col lg:flex-row bg-gradient-to-r from-[#5a0f0a] via-[#7B1F16] to-[#4a0c08] rounded-xl shadow-sm overflow-hidden mb-4 text-white">
        <div className="p-4 lg:w-2/3 border-b lg:border-b-0 lg:border-r border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-extrabold">Expense vs Budget</h3>
            <span className="text-[10px] text-white/70">All Projects · Overall</span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-white/70 mb-0.5">Budget</span>
              <strong className="text-base font-extrabold">₱{Number(budget.totalBudget).toLocaleString()}</strong>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-white/70 mb-0.5">Actual Spending</span>
              <strong className="text-base font-extrabold">₱{Number(budget.totalSpent).toLocaleString()}</strong>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-white/70 mb-0.5">Remaining</span>
              <strong className="text-base font-extrabold">₱{Number(budget.remaining).toLocaleString()}</strong>
            </div>
          </div>

          <div className="mt-1">
            <div className="w-full bg-white/20 rounded-full h-1.5 mb-1.5 overflow-hidden">
              <div className="bg-[#E8C547] h-full rounded-full" style={{ width: `${Math.min(budget.percent, 100)}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-white/90"><strong>{budget.percent}%</strong> of budget used</span>
              <Link to="/expenses" className="text-white font-medium hover:underline">View Details</Link>
            </div>
          </div>
        </div>

        <div className="p-4 lg:w-1/3 flex flex-col justify-center">
          <h3 className="text-[9px] font-bold text-white/70 tracking-wider mb-3 uppercase">ACTUAL EXPENSES</h3>
          <div className="flex flex-col gap-2.5">
            {budget.categories.length === 0 ? (
              <p className="text-[10px] text-white/50 text-center">No expenses yet.</p>
            ) : budget.categories.map((cat, i) => {
              const pct = budget.totalSpent > 0 ? Math.round((Number(cat.total) / budget.totalSpent) * 100) : 0;
              return (
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px] mb-0.5">
                    <span className="font-medium text-white/90">{cat.category}</span>
                    <span className="font-bold">₱{Number(cat.total).toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-1"><div className="bg-[#E8C547] h-full rounded-full" style={{ width: `${pct}%` }}></div></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── EXPENSE TRENDS (12-MONTH LINE & BAR GRAPHS) ── */}
      {(() => {
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const currentMonth = new Date().getMonth(); // 0-indexed
        const maxVal = Math.max(...monthlyData, 1);
        // Only plot months with data up to current month
        const activePoints = monthlyData.map((v, i) => ({ v, i, hasData: v > 0 }));
        // SVG line points: x spacing = 100, y = 110 - (v/max)*100
        const pointsWithData = activePoints.filter(p => p.hasData);
        const polylinePoints = pointsWithData.map(p => `${p.i * 100},${110 - Math.round((p.v / maxVal) * 100)}`).join(' ');
        const fmt = (v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v/1000)}k` : v;
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            {/* LINE GRAPH */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xs font-extrabold text-gray-900">Expense Trajectory</h3>
                  <p className="text-[9px] text-gray-500 font-medium">Full year moving trend (Jan - Dec).</p>
                </div>
                <Link to="/expenses" className="text-[9px] text-[#A63228] font-bold hover:underline">Full Analytics →</Link>
              </div>
              <div className="relative h-28 w-full mb-1">
                <div className="px-3 h-full w-full">
                  <svg viewBox="0 -30 1100 160" className="w-full h-full overflow-visible">
                    <line x1="0" y1="20" x2="1100" y2="20" stroke="#f3f4f6" strokeWidth="3" />
                    <line x1="0" y1="65" x2="1100" y2="65" stroke="#f3f4f6" strokeWidth="3" />
                    <line x1="0" y1="110" x2="1100" y2="110" stroke="#f3f4f6" strokeWidth="3" />
                    {pointsWithData.length > 1 && <polyline points={polylinePoints} fill="none" stroke="#A63228" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />}
                    {pointsWithData.map((p, idx) => {
                      const cx = p.i * 100;
                      const cy = 110 - Math.round((p.v / maxVal) * 100);
                      const isLast = idx === pointsWithData.length - 1;
                      return (
                        <g key={p.i}>
                          <circle cx={cx} cy={cy} r={isLast ? 14 : 10} fill="#A63228" />
                          <text x={cx} y={cy - 20} fontSize={isLast ? 26 : 22} fontWeight={isLast ? 'bold' : 'normal'} fill={isLast ? '#1a1a1a' : '#9ca3af'} textAnchor="middle">₱{fmt(p.v)}</text>
                        </g>
                      );
                    })}
                    {pointsWithData.length === 0 && <text x="550" y="65" fontSize="28" fill="#d1d5db" textAnchor="middle">No expense data yet</text>}
                  </svg>
                </div>
                <div className="flex justify-between px-3 text-[7px] font-bold text-gray-400 uppercase mt-2">
                  {MONTHS.map((m, i) => <span key={m} className={i === currentMonth ? 'text-gray-900' : ''}>{m}</span>)}
                </div>
              </div>
            </div>

            {/* BAR GRAPH */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h3 className="text-xs font-extrabold text-gray-900">Monthly Volume</h3>
                  <p className="text-[9px] text-gray-500 font-medium">Total expenses tracked annually.</p>
                </div>
              </div>
              <div className="relative h-28 w-full flex flex-col justify-end">
                <div className="flex items-end justify-between h-24 px-3 border-b border-gray-100 pb-1">
                  {monthlyData.map((val, i) => {
                    const heightPct = maxVal > 0 ? Math.round((val / maxVal) * 98) : 0;
                    const isCurrent = i === currentMonth;
                    return (
                      <div key={i} className="w-[5%] flex flex-col items-center h-full justify-end relative group">
                        {val > 0 && (
                          <span className={`absolute -top-4 font-bold z-10 ${
                            isCurrent ? 'text-[7px] text-[#1a1a1a] font-extrabold' : 'text-[6px] text-gray-400 hidden group-hover:block'
                          }`}>₱{fmt(val)}</span>
                        )}
                        <div
                          className={`w-full rounded-t-sm transition-all cursor-pointer ${
                            isCurrent ? 'bg-[#A63228] shadow-sm' : val > 0 ? 'bg-[#fce8e6] hover:bg-[#A63228]' : 'bg-transparent'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between px-3 text-[7px] font-bold text-gray-400 uppercase mt-2">
                  {MONTHS.map((m, i) => <span key={m} className={i === currentMonth ? 'text-gray-900' : ''}>{m}</span>)}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MIDDLE ROW: Projects & Expenses ── */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        {/* Active Projects Table */}
        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-extrabold text-gray-900">Active Projects</h3>
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
              ) : projects.map(p => (
                <tr key={p.id}>
                  <td className="py-2 text-[10px] font-bold text-gray-800 border-b border-gray-50">{p.name || p.title}</td>
                  <td className="py-2 text-[10px] text-gray-900 font-extrabold border-b border-gray-50 text-right pr-4">₱{Number(p.budget || p.contract || 0).toLocaleString()}</td>
                  <td className="py-2 border-b border-gray-50 pl-4">
                    <div className="flex items-center gap-2">
                      <div className="w-14 bg-gray-200 rounded-full h-1 overflow-hidden"><div className="bg-[#A63228] h-full rounded-full" style={{ width: `${p.progress || 0}%` }}></div></div>
                      <span className="text-[9px] font-bold text-gray-700 w-6">{p.progress || 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Expenses List */}
        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-extrabold text-gray-900">Recent Expenses</h3>
            <Link to="/expenses" className="text-[10px] text-[#A63228] font-bold hover:underline">See All</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {recentExpenses.length === 0 ? (
              <p className="text-[10px] text-gray-400 text-center py-4">No recent expenses.</p>
            ) : recentExpenses.map((exp, i) => (
              <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0">
                <div>
                  <h4 className="text-[10px] font-bold text-gray-900">{exp.category}</h4>
                  <p className="text-[9px] text-gray-500 mt-0.5">{exp.date}</p>
                </div>
                <strong className="text-[11px] font-extrabold text-gray-900">₱{Number(exp.amount).toLocaleString()}</strong>
              </div>
            ))}
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

      {/* ═════════ MODALS ═════════ */}

      {/* ADD EXPENSE (MANUAL) - PINALAKI NA ANG MODAL, INALIS ANG CASH PAID/CHANGE */}
      {modalState === 'ADD' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl w-full max-w-[500px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-[#1a1a1a]">Add Expense</h3>
                <p className="text-[10px] text-gray-500 font-medium mt-0.5">Keep track of project expenses.</p>
              </div>
              <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <form onSubmit={handleInitialSubmit} className="flex flex-col gap-4">

                {/* PROJECT & CATEGORY */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">PROJECT</label>
                    <select name="project" value={formData.project} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-3 pr-8 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}>
                      {projects.map(p => <option key={p.id} value={p.name || p.title}>{p.name || p.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">EXPENSE CATEGORY</label>
                    <select name="category" value={formData.category} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-3 pr-8 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}>
                      <option value="Materials">Materials</option>
                      <option value="Manpower">Manpower</option>
                      <option value="Equipment">Equipment / Fuel</option>
                    </select>
                  </div>
                </div>

                {/* DATE & TIME */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">DATE</label>
                    <input type="date" name="date" value={formData.date} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none text-gray-700" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">TIME</label>
                    <input type="time" name="time" value={formData.time} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none text-gray-700" />
                  </div>
                </div>

                {/* DYNAMIC ITEMS LIST */}
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 mt-1">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-[10px] font-extrabold text-gray-800 uppercase">ITEMS / LABOR LIST</label>
                    <button type="button" onClick={addNewItem} className="bg-white border border-[#A63228] text-[#A63228] text-[10px] px-2 py-1 rounded-md font-bold hover:bg-red-50 flex items-center gap-1 shadow-sm transition-colors">
                      <span>+</span> Add Item
                    </button>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2.5 items-center relative">
                        <div className="w-1/4 sm:w-1/5">
                          <input type="number" value={item.qty} onChange={(e) => handleItemChange(idx, 'qty', e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="Qty" />
                        </div>
                        <div className="flex-1 flex gap-2">
                          <input type="text" value={item.description} onChange={(e) => handleItemChange(idx, 'description', e.target.value)} required className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder={formData.category === 'Manpower' ? "e.g. Juan Dela Cruz - Mason" : "Item Description"} />

                          {formData.items.length > 1 && (
                            <button type="button" onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-600 px-2 shrink-0 bg-white border border-gray-200 rounded-lg hover:border-red-200 hover:bg-red-50 transition-colors">
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {formData.category === 'Manpower' && (
                    <p className="text-[9px] text-gray-500 mt-2 italic">* Note for Manpower: Use Quantity for number of workers/days, and Description for names/roles.</p>
                  )}
                </div>

                {/* FINANCIALS (TOTAL AMOUNT ONLY) */}
                <div className="mt-1">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[9px] font-extrabold text-[#2e7d32] uppercase">TOTAL AMOUNT (PHP)</label>
                    <span className="text-[8px] text-gray-400 font-semibold">Max: ₱999,999,999,999</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="999999999999"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                    className={`w-full bg-[#e6f4ea] border rounded-lg px-3 py-2.5 text-sm font-extrabold text-[#2e7d32] outline-none placeholder-[#2e7d32]/50 transition-colors ${amountError ? 'border-red-500 !text-red-600' : 'border-[#2e7d32]'}`}
                    placeholder="₱ 0.00"
                  />
                  {amountError && (
                    <p className="text-[9px] text-red-600 font-bold mt-1.5 flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                      {amountError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={Boolean(amountError) || parseFloat(formData.amount || 0) > MAX_AMOUNT}
                  className="w-full mt-3 py-3 bg-[#E8C547] text-gray-900 rounded-xl text-xs font-bold hover:bg-[#d4b33d] shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review & Save Expense
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* SCAN_START */}
      {modalState === 'SCAN_START' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-xl w-full max-w-[300px] shadow-2xl relative overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-[13px] font-extrabold text-[#1a1a1a]">Scan Receipt</h3>
                <p className="text-[9px] text-gray-500 font-medium mt-0.5">Take a photo or upload file.</p>
              </div>
              <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-700">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-4 flex flex-col shrink-0">
              <div className="bg-gray-50 h-40 rounded-lg flex items-center justify-center border border-[#e5dfd8] mb-4 overflow-hidden relative w-full">
                <div className="flex flex-col items-center justify-center text-gray-400">
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                  <span className="text-[10px] font-medium">Ready to scan</span>
                </div>
              </div>

              <label className="w-full py-2 bg-[#E8C547] text-gray-900 rounded-lg text-[10px] font-bold hover:bg-[#d4b33d] transition-colors mb-2 cursor-pointer text-center block">
                Take a Photo
                <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" />
              </label>

              <div className="text-center mb-2">
                <span className="text-[9px] text-gray-400">or</span>
              </div>

              <label className="w-full py-2 bg-[#fce8e6] text-[#A63228] rounded-lg text-[10px] font-bold hover:bg-red-100 transition-colors cursor-pointer text-center block">
                Upload Receipt
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SCAN_REVIEW */}
      {modalState === 'SCAN_REVIEW' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-xl w-full max-w-[300px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-[13px] font-extrabold text-[#1a1a1a]">Review Receipt</h3>
                <p className="text-[9px] text-gray-500 font-medium mt-0.5">Make sure the receipt is clear.</p>
              </div>
              <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-700">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="p-4 flex flex-col shrink-0">
              <div className="bg-gray-100 h-48 rounded-lg flex items-center justify-center border border-[#e5dfd8] mb-3 overflow-hidden">
                {photoData ? (
                  <img src={photoData} alt="Captured receipt" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[9px] text-gray-400">No image captured</span>
                )}
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-4">
                <svg className="w-3.5 h-3.5 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span className="text-[9px] text-[#2e7d32] font-bold">Image loaded successfully.</span>
              </div>
              <div className="flex gap-2">
                <button onClick={retakePhoto} className="flex-1 py-2 bg-white border border-[#A63228] text-[#A63228] rounded-lg text-[10px] font-bold hover:bg-red-50 transition-colors">
                  Retake
                </button>
                <button onClick={handleStartScanning} className="flex-1 py-2 bg-[#E8C547] text-gray-900 rounded-lg text-[10px] font-bold hover:bg-[#d4b33d] transition-colors">
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCANNING LOADER */}
      {modalState === 'SCANNING' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-xl p-6 w-full max-w-[280px] shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 border-4 border-gray-100 border-t-[#A63228] rounded-full animate-spin mb-4"></div>
            <h3 className="text-[13px] font-extrabold text-gray-900 mb-1">Scanning Receipt...</h3>
            <p className="text-[9px] text-[#A63228] font-bold">{scanProgress}</p>
          </div>
        </div>
      )}

      {/* SCAN_DETAILS (FLEXIBLE LIST) */}
      {modalState === 'SCAN_DETAILS' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl w-full max-w-[500px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-[#1a1a1a]">Receipt Details</h3>
                <p className="text-[10px] text-[#2e7d32] font-bold mt-0.5">Details extracted successfully!</p>
              </div>
              <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <form onSubmit={handleScanDetailsSubmit} className="flex flex-col gap-4">

                {/* PROJECT & CATEGORY */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">PROJECT</label>
                    <select name="project" value={formData.project} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-3 pr-8 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}>
                      {projects.map(p => <option key={p.id} value={p.name || p.title}>{p.name || p.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">EXPENSE CATEGORY</label>
                    <select name="category" value={formData.category} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-3 pr-8 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}>
                      <option value="Materials">Materials</option>
                      <option value="Manpower">Manpower</option>
                      <option value="Equipment">Equipment / Fuel</option>
                    </select>
                  </div>
                </div>

                {/* RECEIPT NO, DATE & TIME */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">RECEIPT NO.</label>
                    <input type="text" name="receiptNo" value={formData.receiptNo} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="e.g. 0042" />
                  </div>
                  <div className="col-span-6 sm:col-span-4">
                    <label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">DATE</label>
                    <input type="date" name="date" value={formData.date} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-[#2e7d32] rounded-lg px-3 py-2.5 text-xs font-medium outline-none text-[#2e7d32]" />
                  </div>
                  <div className="col-span-6 sm:col-span-4">
                    <label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">TIME</label>
                    <input type="time" name="time" value={formData.time} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" />
                  </div>
                </div>

                {/* DYNAMIC ITEMS LIST (FLEXIBLE) */}
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 mt-1">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-[10px] font-extrabold text-gray-800 uppercase">ITEMS SCANNED</label>
                    <button type="button" onClick={addNewItem} className="bg-white border border-[#A63228] text-[#A63228] text-[10px] px-2 py-1 rounded-md font-bold hover:bg-red-50 flex items-center gap-1 shadow-sm transition-colors">
                      <span>+</span> Add Item
                    </button>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2.5 items-center relative">
                        <div className="w-1/4 sm:w-1/5">
                          <input type="number" value={item.qty} onChange={(e) => handleItemChange(idx, 'qty', e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="Qty" />
                        </div>
                        <div className="flex-1 flex gap-2">
                          <input type="text" value={item.description} onChange={(e) => handleItemChange(idx, 'description', e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="Item Description" />

                          {formData.items.length > 1 && (
                            <button type="button" onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-600 px-2 shrink-0 bg-white border border-gray-200 rounded-lg hover:border-red-200 hover:bg-red-50 transition-colors">
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FINANCIALS (TOTAL, PAID, CHANGE) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[9px] font-extrabold text-[#2e7d32] uppercase">TOTAL AMOUNT</label>
                      <span className="text-[7px] text-gray-400 font-semibold">Max: ₱999B</span>
                    </div>
                    <input type="number" step="0.01" min="0.01" max="999999999999" name="amount" value={formData.amount} onChange={handleInputChange} required className={`w-full bg-[#e6f4ea] border rounded-lg px-3 py-2.5 text-sm font-extrabold text-[#2e7d32] outline-none transition-colors ${amountError ? 'border-red-500 !text-red-600' : 'border-[#2e7d32]'}`} placeholder="₱ 0.00" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-[9px] font-bold text-gray-700 uppercase">CASH PAID</label>
                      <span className="text-[7px] text-gray-400 font-semibold">Max: ₱999B</span>
                    </div>
                    <input type="number" step="0.01" min="0" max="999999999999" name="cashTendered" value={formData.cashTendered} onChange={handleInputChange} className={`w-full bg-[#f4f1ee] border rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none transition-colors ${amountError ? 'border-red-400' : 'border-transparent'}`} placeholder="₱ 0.00" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">CHANGE</label>
                    <input type="number" step="0.01" min="0" max="999999999999" name="change" value={formData.change} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="₱ 0.00" />
                  </div>
                </div>
                {amountError && (
                  <p className="text-[9px] text-red-600 font-bold flex items-center gap-1 -mt-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    {amountError}
                  </p>
                )}

                {/* RECEIPT STATUS */}
                <div className="mt-1">
                  <div className="bg-[#e6f4ea] border border-[#c8e6c9] rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span className="text-xs font-bold text-[#2e7d32]">Receipt attached & read</span>
                  </div>
                </div>

                <button type="submit" disabled={Boolean(amountError) || parseFloat(formData.amount || 0) > MAX_AMOUNT} className="w-full mt-3 py-3 bg-[#E8C547] text-gray-900 rounded-xl text-xs font-bold hover:bg-[#d4b33d] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  Confirm Details
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL (MANUAL ADD) */}
      {modalState === 'CONFIRM' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-2xl relative text-center">
            <h3 className="text-base font-extrabold text-[#1a1a1a] mb-2">Final Confirmation</h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed px-2">
              Are you sure you want to add this expense?
            </p>

            <div className="bg-[#fce8e6]/50 rounded-xl p-4 flex justify-between items-center mb-6 border border-[#fce8e6]">
              <span className="text-xs font-bold text-gray-800 uppercase">{formData.category}</span>
              <span className="text-lg font-extrabold text-[#A63228]">₱{parseFloat(formData.amount || 0).toLocaleString()}</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalState('ADD')} className="flex-1 py-2.5 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-xs font-bold hover:bg-red-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmAdd} className="flex-1 py-2.5 bg-[#8B1A10] border border-[#8B1A10] text-white rounded-xl text-xs font-bold hover:bg-[#72150d] transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCAN_CONFIRM (Big Confirm Modal) */}
      {modalState === 'SCAN_CONFIRM' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-2xl relative text-center">
            <h3 className="text-base font-extrabold text-[#1a1a1a] mb-2">Final Confirmation</h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed px-2">
              Are you sure you want to save this scanned receipt?
            </p>

            <div className="bg-[#fce8e6]/50 rounded-xl p-4 flex justify-between items-center mb-6 border border-[#fce8e6]">
              <span className="text-xs font-bold text-gray-800 uppercase">{formData.category}</span>
              <span className="text-lg font-extrabold text-[#A63228]">₱{parseFloat(formData.amount || 0).toLocaleString()}</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalState('SCAN_DETAILS')} className="flex-1 py-2.5 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-xs font-bold hover:bg-red-50 transition-colors">
                Back to Edit
              </button>
              <button onClick={handleScanConfirmAdd} className="flex-1 py-2.5 bg-[#8B1A10] border border-[#8B1A10] text-white rounded-xl text-xs font-bold hover:bg-[#72150d] transition-colors">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODALS (SHARED DESIGN) */}
      {(modalState === 'SUCCESS' || modalState === 'SCAN_SUCCESS') && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-2xl text-center relative">
            <button onClick={resetAndClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-50 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>

            <div className="w-16 h-16 bg-[#e6f4ea] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-extrabold text-[#1a1a1a] mb-2">Saved Successfully!</h3>
            <p className="text-xs text-gray-500 font-medium mb-1">Expense recorded for {formData.project}.</p>
            <p className="text-2xl font-extrabold text-[#A63228] mb-3 mt-3">₱{parseFloat(formData.amount || 0).toLocaleString()}</p>
            <span className="inline-block text-gray-700 bg-gray-100 text-[10px] font-extrabold uppercase tracking-wider mb-8 rounded px-3 py-1">
              {formData.category}
            </span>

            <button onClick={resetAndClose} className="w-full py-3 bg-[#8B1A10] text-white rounded-xl text-sm font-bold hover:bg-[#72150d] shadow-sm transition-colors">
              Done
            </button>
          </div>
        </div>
      )}

    </AdminLayout>
  )
}
