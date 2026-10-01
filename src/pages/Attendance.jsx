import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'

export default function Attendance() {
    const { id } = useParams();
    const navigate = useNavigate();

    // ── DATE FILTER STATE ──
    const todayISO = '2026-09-05';
    const [selectedDate, setSelectedDate] = useState(todayISO);

    const [mockProjects, setMockProjects] = useState([]);

    useEffect(() => {
        api.get('/projects').then(data => {
            setMockProjects(data.map(p => ({ id: String(p.id), name: p.name })));
        }).catch(console.error);
    }, []);

    const currentProjectId = id || (mockProjects[0]?.id ?? '1');
    const [allWorkers, setAllWorkers] = useState([]);

    useEffect(() => {
        if (!currentProjectId) return;
        api.get(`/attendance/${currentProjectId}`).then(setAllWorkers).catch(console.error);
    }, [currentProjectId]);

    const displayedWorkers = allWorkers.filter(w => w.date === selectedDate);
    const isPastDate = selectedDate < todayISO;

    const [modalState, setModalState] = useState('NONE');
    const [formData, setFormData] = useState({
        date: selectedDate, name: '', role: 'Laborer / Helper', status: 'Present', timeIn: '07:00 AM', timeOut: '05:00 PM', advance: ''
    });

    const [rfidState, setRfidState] = useState('NONE');
    const [scannedData, setScannedData] = useState(null);

    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleProjectChange = (e) => {
        navigate(`/attendance/${e.target.value}`);
    };

    // ── 2-SESSION ATTENDANCE POLICY RULES ──
    const parseTimeToMinutes = (timeStr) => {
        if (!timeStr || timeStr === '—' || timeStr === '--:--') return null;
        const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
        if (!match) return null;

        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const meridian = match[3]?.toUpperCase();

        if (meridian === 'PM' && hours < 12) hours += 12;
        if (meridian === 'AM' && hours === 12) hours = 0;

        return hours * 60 + minutes;
    };

    const evaluateTwoSessions = (morningIn, afternoonIn, baseRate) => {
        const rate = Number(baseRate) || 0;
        const mMinutes = parseTimeToMinutes(morningIn);
        const aMinutes = parseTimeToMinutes(afternoonIn);

        // Morning Session Check
        let mStatus = 'Absent';
        if (mMinutes !== null) {
            if (mMinutes <= 8 * 60 + 10) mStatus = 'Present';
            else if (mMinutes <= 10 * 60) mStatus = 'Late';
            else mStatus = 'Absent';
        }

        // Afternoon Session Check
        let aStatus = 'Absent';
        if (aMinutes !== null) {
            if (aMinutes <= 13 * 60 + 10) aStatus = 'Present';
            else if (aMinutes <= 15 * 60) aStatus = 'Late';
            else aStatus = 'Absent';
        }

        const hasMorning = mStatus !== 'Absent';
        const hasAfternoon = aStatus !== 'Absent';

        if (hasMorning && hasAfternoon) {
            if (mStatus === 'Present' && aStatus === 'Present') {
                return { status: 'Present', morningStatus: 'Present', afternoonStatus: 'Present', earnedAmount: rate };
            } else if (mStatus === 'Late' && aStatus === 'Late') {
                return { status: 'Double Late', morningStatus: 'Late', afternoonStatus: 'Late', earnedAmount: Math.max(0, rate - 200) };
            } else {
                return { status: 'Late', morningStatus: mStatus, afternoonStatus: aStatus, earnedAmount: Math.max(0, rate - 100) };
            }
        } else if (hasMorning) {
            const halfRate = Math.round((rate / 2) * 100) / 100;
            const earned = mStatus === 'Late' ? Math.max(0, halfRate - 100) : halfRate;
            return { status: mStatus === 'Late' ? 'Halfday (Late)' : 'Halfday', morningStatus: mStatus, afternoonStatus: 'Absent', earnedAmount: earned };
        } else if (hasAfternoon) {
            const halfRate = Math.round((rate / 2) * 100) / 100;
            const earned = aStatus === 'Late' ? Math.max(0, halfRate - 100) : halfRate;
            return { status: aStatus === 'Late' ? 'Halfday (Late)' : 'Halfday', morningStatus: 'Absent', afternoonStatus: aStatus, earnedAmount: earned };
        }

        return { status: 'Absent', morningStatus: 'Absent', afternoonStatus: 'Absent', earnedAmount: 0 };
    };

    const handleAddWorker = (e) => {
        e.preventDefault();
        let assignedRate = 600;
        if (formData.role.includes('Foreman')) assignedRate = 1000;
        else if (formData.role.includes('Skilled') || formData.role.includes('Operator')) assignedRate = 800;

        const evaluated = evaluateTwoSessions(formData.morningIn, formData.afternoonIn, assignedRate);
        const status = formData.status === 'Absent' ? 'Absent' : evaluated.status;
        const earned = status === 'Absent' ? 0 : evaluated.earnedAmount;

        const payload = {
            project_id: currentProjectId,
            worker_name: formData.name,
            date: formData.date,
            role: formData.role,
            status,
            morningIn: status === 'Absent' ? '—' : (formData.morningIn || '—'),
            morningOut: status === 'Absent' ? '—' : (formData.morningOut || '—'),
            afternoonIn: status === 'Absent' ? '—' : (formData.afternoonIn || '—'),
            afternoonOut: status === 'Absent' ? '—' : (formData.afternoonOut || '—'),
            rate: assignedRate,
            earned_amount: earned,
            advance: parseFloat(formData.advance || 0)
        };

        api.post('/attendance', payload).then(newWorker => {
            setAllWorkers(prev => [newWorker, ...prev]);
            setModalState('SUCCESS');
        }).catch(console.error);
    };

    const resetAndClose = () => {
        setModalState('NONE');
        setFormData({
            date: selectedDate,
            name: '',
            role: 'Laborer / Helper',
            status: 'Present',
            morningIn: '07:30 AM',
            morningOut: '12:00 PM',
            afternoonIn: '01:00 PM',
            afternoonOut: '05:00 PM',
            advance: ''
        });
    };

    // ── RFID LOGIC (WITH 2-SESSION DETECTION) ──
    const openRfidKiosk = () => setRfidState('WAITING');
    const closeRfidKiosk = () => setRfidState('NONE');

    const simulateTapCard = (workerName, role, rate, simulatedTimeStr) => {
        setRfidState('READING');

        setTimeout(() => {
            const now = new Date();
            const timeString = simulatedTimeStr || now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            const minutes = parseTimeToMinutes(timeString);

            const existingIndex = allWorkers.findIndex(w => (w.worker_name === workerName || w.name === workerName) && w.date === selectedDate);

            if (existingIndex >= 0) {
                const existingWorker = allWorkers[existingIndex];
                let mIn = existingWorker.morningIn;
                let mOut = existingWorker.morningOut;
                let aIn = existingWorker.afternoonIn;
                let aOut = existingWorker.afternoonOut;
                let action = '';

                // Determine session from time
                if (minutes !== null && minutes < 12 * 60 + 30) {
                    // Morning session
                    if (mIn === '—' || !mIn) {
                        mIn = timeString;
                        action = 'MORNING TIME IN';
                    } else if (mOut === '—' || !mOut) {
                        mOut = timeString;
                        action = 'MORNING TIME OUT (12 PM)';
                    } else {
                        setScannedData({ name: workerName, message: 'Morning shift already completed.' });
                        setRfidState('ERROR');
                        return;
                    }
                } else {
                    // Afternoon session
                    if (aIn === '—' || !aIn) {
                        aIn = timeString;
                        action = 'AFTERNOON TIME IN (1 PM)';
                    } else if (aOut === '—' || !aOut) {
                        aOut = timeString;
                        action = 'AFTERNOON TIME OUT (5 PM)';
                    } else {
                        setScannedData({ name: workerName, message: 'Afternoon shift already completed for today.' });
                        setRfidState('ERROR');
                        return;
                    }
                }

                const evalRes = evaluateTwoSessions(mIn, aIn, rate);
                const updatePayload = {
                    morningIn: mIn,
                    morningOut: mOut,
                    afternoonIn: aIn,
                    afternoonOut: aOut,
                    status: evalRes.status,
                    rate
                };

                api.put(`/attendance/${existingWorker.id}`, updatePayload).catch(console.error);

                const updatedWorkers = [...allWorkers];
                updatedWorkers[existingIndex] = {
                    ...existingWorker,
                    morningIn: mIn,
                    morningOut: mOut,
                    afternoonIn: aIn,
                    afternoonOut: aOut,
                    status: evalRes.status,
                    earned_amount: evalRes.earnedAmount
                };
                setAllWorkers(updatedWorkers);
                setScannedData({ name: workerName, displayRole: existingWorker.role, time: timeString, action, status: evalRes.status });
                setRfidState('SUCCESS_IN');
            } else {
                // First tap of the day
                let mIn = '—';
                let aIn = '—';
                let action = '';

                if (minutes !== null && minutes < 12 * 60 + 30) {
                    mIn = timeString;
                    action = 'MORNING TIME IN';
                } else {
                    aIn = timeString;
                    action = 'AFTERNOON TIME IN (1 PM)';
                }

                const evaluated = evaluateTwoSessions(mIn, aIn, rate);
                const payload = {
                    project_id: currentProjectId,
                    worker_name: workerName,
                    date: selectedDate,
                    role,
                    status: evaluated.status,
                    morningIn: mIn,
                    morningOut: '—',
                    afternoonIn: aIn,
                    afternoonOut: '—',
                    rate,
                    earned_amount: evaluated.earnedAmount,
                    advance: 0
                };
                api.post('/attendance', payload).then(newWorker => {
                    setAllWorkers(prev => [newWorker, ...prev]);
                }).catch(console.error);
                setScannedData({ name: workerName, displayRole: role, time: timeString, status: evaluated.status, action });
                setRfidState('SUCCESS_IN');
            }
        }, 1200);
    };

    const formatDisplayDate = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const presentCount = displayedWorkers.filter(w => w.status === 'Present').length;
    const lateCount = displayedWorkers.filter(w => w.status === 'Late' || w.status === 'Double Late').length;
    const halfdayCount = displayedWorkers.filter(w => String(w.status).includes('Halfday')).length;
    const absentCount = displayedWorkers.filter(w => w.status === 'Absent').length;

    const skilledWorkers = displayedWorkers.filter(w => w.status !== 'Absent' && w.role !== 'Laborer / Helper');
    const laborWorkers = displayedWorkers.filter(w => w.status !== 'Absent' && w.role === 'Laborer / Helper');

    const skilledPresent = skilledWorkers.length;
    const laborPresent = laborWorkers.length;

    const getWorkerWage = (w) => {
        if (w.earned_amount !== undefined && w.earned_amount !== null && !isNaN(Number(w.earned_amount))) {
            return Number(w.earned_amount);
        }
        const rate = Number(w.rate || 0);
        if (w.status === 'Present') return rate;
        if (w.status === 'Late') return Math.max(0, rate - 100);
        if (w.status === 'Double Late') return Math.max(0, rate - 200);
        if (w.status === 'Halfday (Late)') return Math.max(0, (rate / 2) - 100);
        if (String(w.status).includes('Halfday')) return Math.round((rate / 2) * 100) / 100;
        return 0;
    };

    const skilledTotal = skilledWorkers.reduce((sum, w) => sum + getWorkerWage(w), 0);
    const laborTotal = laborWorkers.reduce((sum, w) => sum + getWorkerWage(w), 0);

    const totalAdvances = displayedWorkers.reduce((sum, w) => sum + (w.advance || 0), 0);
    const totalManpowerExpense = (skilledTotal + laborTotal) - totalAdvances;

    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '0.8rem 0.8rem'
    };

    return (
        <AdminLayout>
            {/* ── HEADER TITLE ── */}
            <div className="mb-4">
                <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">ATTENDANCE MANAGEMENT</span>
                <h1 className="text-xl font-extrabold text-gray-900 mt-0.5 tracking-tight">Attendance Management</h1>
                <p className="text-[10px] text-gray-500 mt-0.5">Track daily worker attendance and manpower expenses.</p>
            </div>

            {/* ── CONTROLS ROW: PROJECT SELECTOR & BUTTONS ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-3">

                <div className="w-full md:w-auto">
                    <label className="block text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-1">PROJECT</label>
                    <select
                        value={currentProjectId}
                        onChange={handleProjectChange}
                        className="bg-white border border-gray-100 shadow-sm rounded-lg pl-2.5 pr-6 py-1.5 text-[10px] font-extrabold text-gray-800 outline-none appearance-none w-full md:w-auto min-w-[300px]"
                        style={selectStyles}
                    >
                        {mockProjects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                    <button
                        onClick={openRfidKiosk}
                        disabled={isPastDate}
                        title={isPastDate ? "Cannot use Kiosk for past dates" : ""}
                        className={`flex-1 md:flex-none border px-5 py-1.5 rounded-lg font-bold text-[11px] shadow-sm flex items-center justify-center transition-colors ${isPastDate
                                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-white border-[#A63228] text-[#A63228] hover:bg-red-50'
                            }`}
                    >
                        RFID Kiosk
                    </button>
                    <button
                        onClick={() => { setFormData({ ...formData, date: selectedDate }); setModalState('ADD'); }}
                        disabled={isPastDate}
                        title={isPastDate ? "Cannot manually add workers to past dates" : ""}
                        className={`flex-1 md:flex-none border border-transparent px-5 py-1.5 rounded-lg font-bold text-[11px] shadow-sm flex items-center justify-center gap-1.5 transition-colors ${isPastDate
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-[#E8C547] text-gray-900 hover:bg-[#d4b33d]'
                            }`}
                    >
                        <span>+</span> Add Worker
                    </button>
                </div>

            </div>

            {/* ── DAILY SUMMARY CARDS ── */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 mb-3 mt-2">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-[11px] font-extrabold text-gray-900">Daily Attendance Breakdown</h3>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-[#f4f1ee] px-2 py-1 rounded text-[9px] font-bold text-[#A63228] outline-none border border-transparent focus:border-[#A63228]"
                    />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-[#e6f4ea]/40 rounded-lg p-2 text-center border border-[#c3e6cb]">
                        <h2 className="text-lg font-extrabold text-[#2e7d32]">{presentCount}</h2>
                        <p className="text-[8px] font-bold text-[#2e7d32] tracking-wider mt-0.5 uppercase">PRESENT (FULL)</p>
                    </div>
                    <div className="bg-[#fff8e1] rounded-lg p-2 text-center border border-[#ffe082]">
                        <h2 className="text-lg font-extrabold text-[#f57f17]">{lateCount}</h2>
                        <p className="text-[8px] font-bold text-[#f57f17] tracking-wider mt-0.5 uppercase">LATE (-₱100)</p>
                    </div>
                    <div className="bg-[#fff3e0] rounded-lg p-2 text-center border border-[#ffcc80]">
                        <h2 className="text-lg font-extrabold text-[#e65100]">{halfdayCount}</h2>
                        <p className="text-[8px] font-bold text-[#e65100] tracking-wider mt-0.5 uppercase">HALFDAY (50%)</p>
                    </div>
                    <div className="bg-[#fdecea] rounded-lg p-2 text-center border border-[#f5c6cb]">
                        <h2 className="text-lg font-extrabold text-[#A63228]">{absentCount}</h2>
                        <p className="text-[8px] font-bold text-[#A63228] tracking-wider mt-0.5 uppercase">ABSENT (0%)</p>
                    </div>
                </div>
            </div>

            {/* ── WORKER ATTENDANCE TABLE ── */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3 overflow-x-auto">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-[9px] font-extrabold text-gray-900 tracking-wider uppercase">2-SESSION WORKER ATTENDANCE (MORNING & AFTERNOON)</h3>
                    <span className="text-[8px] text-gray-500 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-200">Morning: 8:00 AM - 12:00 PM | Afternoon: 1:00 PM - 5:00 PM</span>
                </div>
                <table className="w-full text-left border-collapse min-w-[750px]">
                    <thead>
                        <tr>
                            <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[20%] uppercase tracking-wider">WORKER NAME</th>
                            <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[14%] uppercase tracking-wider text-center">ROLE</th>
                            <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[16%] uppercase tracking-wider text-center">STATUS</th>
                            <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[14%] uppercase tracking-wider text-center">MORNING (IN-OUT)</th>
                            <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[14%] uppercase tracking-wider text-center">AFTERNOON (IN-OUT)</th>
                            <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[11%] uppercase tracking-wider text-right pr-3">EARNED WAGE</th>
                            <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[11%] uppercase tracking-wider text-right pr-4">ADVANCE</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayedWorkers.length > 0 ? displayedWorkers.map((worker) => {
                            const earned = getWorkerWage(worker);
                            const mIn = worker.morningIn || worker.morning_in || '—';
                            const mOut = worker.morningOut || worker.morning_out || '—';
                            const aIn = worker.afternoonIn || worker.afternoon_in || '—';
                            const aOut = worker.afternoonOut || worker.afternoon_out || '—';

                            return (
                                <tr key={worker.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="py-2.5 text-[10px] font-extrabold text-gray-900 border-b border-gray-50">{worker.worker_name || worker.name}</td>
                                    <td className="py-2.5 border-b border-gray-50 text-center">
                                        <span className="text-[9px] font-bold text-gray-900 uppercase tracking-wider">{worker.role}</span>
                                    </td>
                                    <td className="py-2.5 border-b border-gray-50 text-center">
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                            worker.status === 'Present'
                                                ? 'bg-[#e6f4ea] text-[#2e7d32]'
                                                : worker.status === 'Late'
                                                ? 'bg-[#fff8e1] text-[#f57f17]'
                                                : worker.status === 'Double Late'
                                                ? 'bg-[#fff3e0] text-[#d84315]'
                                                : String(worker.status).includes('Halfday')
                                                ? 'bg-[#ede7f6] text-[#5e35b1]'
                                                : 'bg-[#fdecea] text-[#A63228]'
                                        }`}>
                                            {worker.status === 'Late'
                                                ? 'Late (-₱100)'
                                                : worker.status === 'Double Late'
                                                ? 'Double Late (-₱200)'
                                                : worker.status === 'Halfday'
                                                ? 'Halfday (50%)'
                                                : worker.status === 'Halfday (Late)'
                                                ? 'Halfday (Late -₱100)'
                                                : worker.status}
                                        </span>
                                    </td>
                                    <td className="py-2.5 text-[9px] font-bold text-gray-800 border-b border-gray-50 text-center">
                                        <span className={mIn !== '—' ? 'text-gray-900' : 'text-gray-400'}>{mIn}</span>
                                        <span className="text-gray-400 mx-1">→</span>
                                        <span className={mOut !== '—' ? 'text-blue-600' : 'text-gray-400'}>{mOut}</span>
                                    </td>
                                    <td className="py-2.5 text-[9px] font-bold text-gray-800 border-b border-gray-50 text-center">
                                        <span className={aIn !== '—' ? 'text-gray-900' : 'text-gray-400'}>{aIn}</span>
                                        <span className="text-gray-400 mx-1">→</span>
                                        <span className={aOut !== '—' ? 'text-blue-600' : 'text-gray-400'}>{aOut}</span>
                                    </td>
                                    <td className="py-2.5 text-[9px] font-extrabold border-b border-gray-50 text-right pr-3">
                                        {worker.status !== 'Absent' ? (
                                            <span className={worker.status === 'Present' ? 'text-[#2e7d32]' : 'text-[#f57f17]'}>
                                                ₱{earned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">₱0.00</span>
                                        )}
                                    </td>
                                    <td className="py-2.5 text-[10px] font-extrabold text-gray-900 border-b border-gray-50 text-right pr-4">
                                        {worker.advance > 0 ? `₱${worker.advance}` : '—'}
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan="7" className="py-8 text-center text-xs text-gray-400 italic">No workers found for {formatDisplayDate(selectedDate)}.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── DAILY MANPOWER EXPENSE SUMMARY ── */}
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 mb-4">
                <h3 className="text-[9px] font-extrabold text-[#A63228] tracking-wider uppercase mb-2">DAILY MANPOWER EXPENSE</h3>
                <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[10px] border-b border-gray-50 pb-1.5">
                        <span className="text-gray-600 font-medium">Skilled Workers/Operators ({skilledPresent} present)</span>
                        <strong className="text-gray-900 font-bold">₱{skilledTotal.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[10px] border-b border-gray-50 pb-1.5">
                        <span className="text-gray-600 font-medium">Laborers/Helpers ({laborPresent} present)</span>
                        <strong className="text-gray-900 font-bold">₱{laborTotal.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[10px] border-b border-gray-50 pb-1.5">
                        <span className="text-gray-600 font-medium">Cash Advances Deducted</span>
                        <strong className="text-gray-900 font-bold">₱{totalAdvances.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[11px] mt-0.5 pt-0.5">
                        <span className="text-gray-900 font-extrabold uppercase">Net Payable Today</span>
                        <strong className="text-[#A63228] font-extrabold text-xs">₱{totalManpowerExpense.toLocaleString()}</strong>
                    </div>
                </div>
            </div>

            {/* ═════════ RFID KIOSK MODALS ═════════ */}

            {/* 1. WAITING FOR CARD */}
            {rfidState === 'WAITING' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-xl w-full max-w-[340px] shadow-2xl relative flex flex-col overflow-hidden">
                        <div className="flex justify-between items-start p-4 border-b border-gray-100">
                            <div>
                                <h2 className="text-sm font-extrabold text-gray-900">RFID Attendance Kiosk</h2>
                                <p className="text-[9px] text-gray-500 mt-1 leading-relaxed">Please tap the ID card on the ESP32 scanner to log attendance.</p>
                            </div>
                            <button onClick={closeRfidKiosk} className="text-gray-400 bg-gray-100 rounded-full p-1 hover:text-gray-800 transition-colors">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="flex flex-col items-center justify-center p-6 pb-4 text-center">
                            <div className="w-20 h-20 bg-[#fce8e6] rounded-full flex items-center justify-center text-[#A63228] font-extrabold text-sm mb-4">RFID</div>
                            <h3 className="text-[13px] font-extrabold text-gray-900 mb-1.5">Waiting for Card...</h3>
                            <p className="text-[9px] text-gray-500 max-w-[200px] mb-4">Tap the worker's registered RFID/NFC ID card on the ESP32 scanner.</p>

                            {/* Developer Tools for Simulation */}
                            <div className="w-full mt-2 p-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-2">Simulation Tools (2-Session Rules)</p>
                                <div className="flex flex-col gap-1.5">
                                    <button onClick={() => simulateTapCard('Juan Dela Cruz', 'Skilled - Mason', 800, '07:45 AM')} className="w-full py-1.5 bg-white border border-gray-200 text-gray-700 rounded text-[9px] font-bold hover:bg-gray-100 shadow-sm transition-colors text-left px-3">
                                        🌅 Morning On-Time (7:45 AM): <span className="text-[#2e7d32]">Juan (On-time)</span>
                                    </button>
                                    <button onClick={() => simulateTapCard('Pedro Santos', 'Laborer / Helper', 600, '08:30 AM')} className="w-full py-1.5 bg-white border border-gray-200 text-gray-700 rounded text-[9px] font-bold hover:bg-gray-100 shadow-sm transition-colors text-left px-3">
                                        🌅 Morning Late (8:30 AM): <span className="text-[#f57f17]">Pedro (Late -₱100)</span>
                                    </button>
                                    <button onClick={() => simulateTapCard('Juan Dela Cruz', 'Skilled - Mason', 800, '12:00 PM')} className="w-full py-1.5 bg-white border border-gray-200 text-gray-700 rounded text-[9px] font-bold hover:bg-gray-100 shadow-sm transition-colors text-left px-3">
                                        🕛 Morning Out (12:00 PM): <span className="text-blue-600">Juan Time Out</span>
                                    </button>
                                    <button onClick={() => simulateTapCard('Juan Dela Cruz', 'Skilled - Mason', 800, '01:00 PM')} className="w-full py-1.5 bg-white border border-gray-200 text-gray-700 rounded text-[9px] font-bold hover:bg-gray-100 shadow-sm transition-colors text-left px-3">
                                        🌇 Afternoon In (1:00 PM): <span className="text-[#2e7d32]">Juan Afternoon On-time</span>
                                    </button>
                                    <button onClick={() => simulateTapCard('Pedro Santos', 'Laborer / Helper', 600, '01:25 PM')} className="w-full py-1.5 bg-white border border-gray-200 text-gray-700 rounded text-[9px] font-bold hover:bg-gray-100 shadow-sm transition-colors text-left px-3">
                                        🌇 Afternoon Late (1:25 PM): <span className="text-[#d84315]">Pedro (Double Late -₱200)</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. READING CARD */}
            {rfidState === 'READING' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-xl w-full max-w-[340px] shadow-2xl relative flex flex-col overflow-hidden">
                        <div className="flex justify-between items-start p-4 border-b border-gray-100">
                            <div>
                                <h2 className="text-sm font-extrabold text-gray-900">RFID Attendance Kiosk</h2>
                                <p className="text-[9px] text-gray-500 mt-1 leading-relaxed">Please tap the ID card on the ESP32 scanner to log attendance.</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center p-10 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 font-extrabold text-sm mb-4 animate-pulse">RFID</div>
                            <h3 className="text-[13px] font-extrabold text-gray-700 mb-1.5">Reading Card...</h3>
                            <p className="text-[9px] text-gray-500 max-w-[200px]">Please keep the card near the ESP32 scanner</p>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. SUCCESS LOG (TIME IN) */}
            {rfidState === 'SUCCESS_IN' && scannedData && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-xl p-5 w-full max-w-[280px] shadow-2xl relative">
                        <div className="absolute top-4 right-4 w-6 h-6 bg-[#e6f4ea] rounded-full flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-sm font-extrabold text-[#2e7d32] mb-1">Time In Successful</h3>
                        <p className="text-[8px] text-gray-500 mb-4 leading-relaxed">Worker attendance logged for today.</p>
                        <div className="flex flex-col gap-2.5 mb-5 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div><span className="block text-[8px] font-bold text-gray-400 uppercase">WORKER NAME</span><span className="text-[11px] font-extrabold text-gray-900">{scannedData.name}</span></div>
                            <div><span className="block text-[8px] font-bold text-gray-400 uppercase">ROLE</span><span className="text-[10px] font-bold text-gray-700 uppercase">{scannedData.displayRole}</span></div>
                            <div><span className="block text-[8px] font-bold text-gray-400 uppercase">TIME IN</span><span className="text-lg font-extrabold text-[#2e7d32]">{scannedData.time}</span></div>
                        </div>
                        <button onClick={() => setRfidState('WAITING')} className="w-full py-2 bg-[#8B1A10] text-white rounded-lg text-xs font-bold hover:bg-[#72150d] transition-colors">DONE</button>
                    </div>
                </div>
            )}

            {/* 4. SUCCESS LOG (TIME OUT) */}
            {rfidState === 'SUCCESS_OUT' && scannedData && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-xl p-5 w-full max-w-[280px] shadow-2xl relative">
                        <div className="absolute top-4 right-4 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-sm font-extrabold text-blue-600 mb-1">Time Out Successful</h3>
                        <p className="text-[8px] text-gray-500 mb-4 leading-relaxed">Shift completed for today.</p>
                        <div className="flex flex-col gap-2.5 mb-5 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div><span className="block text-[8px] font-bold text-gray-400 uppercase">WORKER NAME</span><span className="text-[11px] font-extrabold text-gray-900">{scannedData.name}</span></div>
                            <div><span className="block text-[8px] font-bold text-gray-400 uppercase">ROLE</span><span className="text-[10px] font-bold text-gray-700 uppercase">{scannedData.displayRole}</span></div>
                            <div><span className="block text-[8px] font-bold text-gray-400 uppercase">TIME OUT</span><span className="text-lg font-extrabold text-blue-600">{scannedData.time}</span></div>
                        </div>
                        <button onClick={() => setRfidState('WAITING')} className="w-full py-2 bg-[#8B1A10] text-white rounded-lg text-xs font-bold hover:bg-[#72150d] transition-colors">DONE</button>
                    </div>
                </div>
            )}

            {/* 5. ERROR LOG (DOUBLE TAP) */}
            {rfidState === 'ERROR' && scannedData && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-xl p-5 w-full max-w-[280px] shadow-2xl relative text-center">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-[#A63228]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line><circle cx="12" cy="12" r="10"></circle></svg>
                        </div>
                        <h3 className="text-sm font-extrabold text-[#A63228] mb-1">Action Denied</h3>
                        <p className="text-[10px] text-gray-900 font-bold mb-1">{scannedData.name}</p>
                        <p className="text-[9px] text-gray-500 mb-5 leading-relaxed">{scannedData.message}</p>
                        <button onClick={() => setRfidState('WAITING')} className="w-full py-2 bg-gray-200 text-gray-800 rounded-lg text-xs font-bold hover:bg-gray-300 transition-colors">Try Again</button>
                    </div>
                </div>
            )}

            {/* ═════════ MANUAL ADD WORKER MODALS ═════════ */}

            {/* 1. ADD WORKER MODAL */}
            {modalState === 'ADD' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[450px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-sm font-extrabold text-[#1a1a1a]">Add Worker Record</h3>
                                <p className="text-[10px] text-gray-500 font-medium mt-0.5">Manual entry for attendance.</p>
                            </div>
                            <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-2 rounded-full hover:bg-gray-100 transition-colors">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="overflow-y-auto p-5">
                            <form onSubmit={handleAddWorker} className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-700 mb-1.5 uppercase">DATE</label>
                                        <input type="date" name="date" value={formData.date} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none text-gray-700" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-700 mb-1.5 uppercase">WORKER NAME</label>
                                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="e.g. Juan Dela Cruz" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-700 mb-1.5 uppercase">ROLE</label>
                                        <select name="role" value={formData.role} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-3 pr-8 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}>
                                            <option value="Laborer / Helper">Laborer / Helper</option>
                                            <option value="Skilled - Mason">Skilled - Mason</option>
                                            <option value="Skilled - Carpenter">Skilled - Carpenter</option>
                                            <option value="Skilled - Steelman">Skilled - Steelman</option>
                                            <option value="Skilled - Painter">Skilled - Painter</option>
                                            <option value="Skilled - Welder">Skilled - Welder</option>
                                            <option value="Heavy Eqpt. Operator">Heavy Eqpt. Operator</option>
                                            <option value="Foreman">Foreman</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-700 mb-1.5 uppercase">STATUS</label>
                                        <select name="status" value={formData.status} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-3 pr-8 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}>
                                            <option value="Present">Present</option>
                                            <option value="Absent">Absent</option>
                                        </select>
                                    </div>
                                </div>

                                {formData.status !== 'Absent' && (
                                    <div className="space-y-2.5">
                                        <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                            <span className="block text-[8px] font-extrabold text-[#A63228] uppercase tracking-wider mb-1.5">Morning Session (8:00 AM - 12:00 PM)</span>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[8px] font-bold text-gray-600 mb-0.5 uppercase">Morning Time In</label>
                                                    <input type="text" name="morningIn" value={formData.morningIn || ''} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="07:45 AM" />
                                                </div>
                                                <div>
                                                    <label className="block text-[8px] font-bold text-gray-600 mb-0.5 uppercase">Morning Time Out</label>
                                                    <input type="text" name="morningOut" value={formData.morningOut || ''} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="12:00 PM" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                            <span className="block text-[8px] font-extrabold text-[#A63228] uppercase tracking-wider mb-1.5">Afternoon Session (1:00 PM - 5:00 PM)</span>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[8px] font-bold text-gray-600 mb-0.5 uppercase">Afternoon Time In</label>
                                                    <input type="text" name="afternoonIn" value={formData.afternoonIn || ''} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="01:00 PM" />
                                                </div>
                                                <div>
                                                    <label className="block text-[8px] font-bold text-gray-600 mb-0.5 uppercase">Afternoon Time Out</label>
                                                    <input type="text" name="afternoonOut" value={formData.afternoonOut || ''} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="05:00 PM" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-700 mb-1.5 uppercase">CASH ADVANCE (OPTIONAL)</label>
                                    <input type="number" name="advance" value={formData.advance} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="₱ 0.00" />
                                </div>

                                <button type="submit" className="w-full mt-2 py-3 bg-[#E8C547] text-gray-900 rounded-xl text-xs font-bold hover:bg-[#d4b33d] transition-colors shadow-sm">
                                    Add Record
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {modalState === 'SUCCESS' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-2xl text-center relative">
                        <button onClick={resetAndClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-50 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <div className="w-12 h-12 bg-[#e6f4ea] rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-base font-extrabold text-gray-900 mb-1">Worker Added!</h3>
                        <p className="text-xs text-gray-500 mb-6">Attendance list updated.</p>
                        <button onClick={resetAndClose} className="w-full py-2.5 bg-[#8B1A10] text-white rounded-xl text-xs font-bold hover:bg-[#72150d] transition-colors">
                            Done
                        </button>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
