import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'

export default function Attendance() {
    const { id } = useParams();
    const navigate = useNavigate();

    // ── DATE FILTER STATE ──
    const todayISO = new Date().toISOString().split('T')[0];
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

    // Live sync for physical ESP32 RFID scanner taps
    useEffect(() => {
        if (!currentProjectId || selectedDate !== todayISO) return;
        const timer = setInterval(() => {
            api.get(`/attendance/${currentProjectId}`).then(data => {
                if (Array.isArray(data)) setAllWorkers(data);
            }).catch(console.error);
        }, 4000);
        return () => clearInterval(timer);
    }, [currentProjectId, selectedDate, todayISO]);

    // ── ATTENDANCE SETTINGS & NON-WORKING DAYS STATE ──
    const [attendanceSettings, setAttendanceSettings] = useState({
        auto_schedule: true,
        open_time: '07:00',
        close_time: '17:30',
        auto_sundays_off: true,
        manual_override: null
    });
    const [nonWorkingDays, setNonWorkingDays] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Non-Working Day form state
    const [nonWorkingForm, setNonWorkingForm] = useState({
        date: todayISO,
        reason: 'Sunday / Regular Rest Day',
        type: 'Rest Day',
        customReason: ''
    });

    // Settings form state
    const [settingsForm, setSettingsForm] = useState({
        auto_schedule: true,
        open_time: '07:00',
        close_time: '17:30',
        auto_sundays_off: true,
        manual_override: ''
    });

    const fetchSettingsAndNonWorking = () => {
        api.get('/attendance-settings').then(data => {
            if (data && !data.error) {
                setAttendanceSettings(data);
                setSettingsForm({
                    auto_schedule: data.auto_schedule !== false,
                    open_time: data.open_time || '07:00',
                    close_time: data.close_time || '17:30',
                    auto_sundays_off: data.auto_sundays_off !== false,
                    manual_override: data.manual_override || ''
                });
            }
        }).catch(console.error);

        api.get('/non-working-days').then(data => {
            if (Array.isArray(data)) setNonWorkingDays(data);
        }).catch(console.error);
    };

    useEffect(() => {
        fetchSettingsAndNonWorking();
    }, []);

    // Timer to update clock every 10 seconds for real-time open/close evaluation
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 10000);
        return () => clearInterval(timer);
    }, []);

    const adminProfile = (() => {
        try {
            return JSON.parse(sessionStorage.getItem('adminProfile') || localStorage.getItem('adminProfile') || '{}');
        } catch {
            return {};
        }
    })();
    const currentOfficerName = adminProfile?.fullName || adminProfile?.name || 'Attendance Monitoring Officer / Admin';

    const format12Hour = (time24) => {
        if (!time24) return '';
        const [hStr, mStr] = time24.split(':');
        let h = parseInt(hStr, 10);
        const m = mStr || '00';
        const ampm = h >= 12 ? 'PM' : 'AM';
        if (h > 12) h -= 12;
        if (h === 0) h = 12;
        return `${h}:${m} ${ampm}`;
    };

    const isSunday = new Date(selectedDate + 'T00:00:00').getDay() === 0;
    const declaredNonWorking = nonWorkingDays.find(d => d.date === selectedDate);
    const isNonWorkingDay = Boolean(declaredNonWorking || (attendanceSettings.auto_sundays_off && isSunday));
    const nonWorkingReason = declaredNonWorking?.reason || (isSunday ? 'Sunday Rest Day' : 'Non-Working Day');

    // Terminal Evaluation (Automated Open / Close & Non-Working Day)
    let terminalStatus = 'CLOSED';
    let terminalLabel = 'ATTENDANCE CLOSED';
    let terminalMessage = '';
    let isAttendanceOpen = false;

    if (isNonWorkingDay) {
        terminalStatus = 'CLOSED_NON_WORKING';
        terminalLabel = 'ATTENDANCE CLOSED — NON-WORKING DAY';
        terminalMessage = `Set as Non-Working Day (${nonWorkingReason}). Attendance is closed and workers are not marked absent.`;
        isAttendanceOpen = false;
    } else if (selectedDate < todayISO) {
        terminalStatus = 'CLOSED_PAST';
        terminalLabel = 'ATTENDANCE CLOSED (PAST DATE)';
        terminalMessage = 'Past date. Attendance logs are closed.';
        isAttendanceOpen = false;
    } else if (selectedDate > todayISO) {
        terminalStatus = 'SCHEDULED_FUTURE';
        terminalLabel = 'ATTENDANCE SCHEDULED (FUTURE DATE)';
        terminalMessage = `Upcoming date. Automatically opens at ${format12Hour(attendanceSettings.open_time)} on the scheduled date.`;
        isAttendanceOpen = false;
    } else {
        // Today
        if (attendanceSettings.manual_override === 'OPEN') {
            terminalStatus = 'OPEN_OVERRIDE';
            terminalLabel = 'ATTENDANCE OPEN (MANUAL OVERRIDE)';
            terminalMessage = 'Manually opened by Admin / Attendance Monitoring Officer.';
            isAttendanceOpen = true;
        } else if (attendanceSettings.manual_override === 'CLOSED') {
            terminalStatus = 'CLOSED_OVERRIDE';
            terminalLabel = 'ATTENDANCE CLOSED (MANUAL OVERRIDE)';
            terminalMessage = 'Manually closed by Admin / Attendance Monitoring Officer.';
            isAttendanceOpen = false;
        } else {
            // Auto schedule mode
            const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
            const [oH, oM] = (attendanceSettings.open_time || '07:00').split(':').map(Number);
            const openMinutes = (oH || 7) * 60 + (oM || 0);
            const [cH, cM] = (attendanceSettings.close_time || '17:30').split(':').map(Number);
            const closeMinutes = (cH || 17) * 60 + (cM || 30);

            if (nowMinutes < openMinutes) {
                terminalStatus = 'CLOSED_EARLY';
                terminalLabel = `ATTENDANCE CLOSED (OPENS AT ${format12Hour(attendanceSettings.open_time)})`;
                terminalMessage = `Currently closed before shift. Automatically opens at ${format12Hour(attendanceSettings.open_time)}.`;
                isAttendanceOpen = false;
            } else if (nowMinutes >= openMinutes && nowMinutes <= closeMinutes) {
                terminalStatus = 'OPEN_ACTIVE';
                terminalLabel = 'ATTENDANCE OPEN (ACTIVE SHIFT)';
                terminalMessage = `Automatically open from ${format12Hour(attendanceSettings.open_time)} to ${format12Hour(attendanceSettings.close_time)}. Accepting RFID and attendance logs.`;
                isAttendanceOpen = true;
            } else {
                terminalStatus = 'CLOSED_ENDED';
                terminalLabel = `ATTENDANCE CLOSED (SHIFT ENDED AT ${format12Hour(attendanceSettings.close_time)})`;
                terminalMessage = `Shift cutoff reached (${format12Hour(attendanceSettings.close_time)}). Attendance is automatically closed for today.`;
                isAttendanceOpen = false;
            }
        }
    }

    const handleSaveNonWorkingDay = async (e) => {
        e.preventDefault();
        const reasonText = nonWorkingForm.reason === 'Other / Custom Reason'
            ? (nonWorkingForm.customReason.trim() || 'Custom Non-Working Day')
            : nonWorkingForm.reason;

        try {
            await api.post('/non-working-days', {
                date: nonWorkingForm.date,
                reason: reasonText,
                type: nonWorkingForm.type || 'Non-Working Day',
                set_by: currentOfficerName
            });
            fetchSettingsAndNonWorking();
            setModalState('NONE');
            alert(`Successfully set ${nonWorkingForm.date} as Non-Working Day (${reasonText}). Workers will not be marked absent.`);
        } catch (err) {
            console.error(err);
            alert('Failed to save non-working day. Please try again.');
        }
    };

    const handleRevertWorkingDay = async () => {
        if (!confirm(`Remove Non-Working Day status for ${selectedDate} and restore normal working day?`)) return;
        try {
            await api.delete(`/non-working-days/${selectedDate}`);
            fetchSettingsAndNonWorking();
            alert(`Restored ${selectedDate} to regular working day.`);
        } catch (err) {
            console.error(err);
            alert('Failed to revert working day.');
        }
    };

    const handleDeleteNonWorkingDay = async (targetDate) => {
        if (!confirm(`Remove Non-Working Day for date ${targetDate}?`)) return;
        try {
            await api.delete(`/non-working-days/${targetDate}`);
            fetchSettingsAndNonWorking();
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try {
            await api.post('/attendance-settings', {
                ...settingsForm,
                manual_override: settingsForm.manual_override || null,
                updated_by: currentOfficerName
            });
            fetchSettingsAndNonWorking();
            setModalState('NONE');
            alert('Attendance schedule settings updated successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to update attendance settings.');
        }
    };

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
                let mIn = existingWorker.morningIn || existingWorker.morning_in;
                let mOut = existingWorker.morningOut || existingWorker.morning_out;
                let aIn = existingWorker.afternoonIn || existingWorker.afternoon_in;
                let aOut = existingWorker.afternoonOut || existingWorker.afternoon_out;
                let action = '';

                // Determine session from time
                if (minutes !== null && minutes < 12 * 60 + 30) {
                    // Morning session
                    if (mIn === '—' || !mIn) {
                        if (minutes >= 11 * 60 + 30) {
                            setScannedData({ name: workerName, message: 'Bawal mag-Time Out: Walang naitalang Morning Time In.' });
                            setRfidState('ERROR');
                            return;
                        }
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
                    if (minutes >= 15 * 60 + 30) {
                        // Dismissal Period (3:30 PM onwards)
                        const hasActiveTimeIn = (aIn && aIn !== '—') || (mIn && mIn !== '—' && (!mOut || mOut === '—'));
                        if (!hasActiveTimeIn) {
                            setScannedData({ name: workerName, message: 'Bawal mag-Time Out: Walang naitalang Time In ngayong araw.' });
                            setRfidState('ERROR');
                            return;
                        }
                        if (aOut && aOut !== '—') {
                            setScannedData({ name: workerName, message: 'Naka-Time Out na ang worker ngayong hapon.' });
                            setRfidState('ERROR');
                            return;
                        }
                        aOut = timeString;
                        action = 'AFTERNOON TIME OUT (5 PM)';
                    } else {
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
                // First tap of the day -> Check if attempting to Time Out without Timing In
                if (minutes !== null && minutes >= 11 * 60 + 30 && minutes < 12 * 60 + 30) {
                    setScannedData({ name: workerName, message: 'Bawal mag-Time Out: Walang naitalang Morning Time In.' });
                    setRfidState('ERROR');
                    return;
                }
                if (minutes !== null && minutes >= 15 * 60 + 30) {
                    setScannedData({ name: workerName, message: 'Bawal mag-Time Out: Walang naitalang Time In ngayong araw.' });
                    setRfidState('ERROR');
                    return;
                }

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

    const presentCount = isNonWorkingDay ? 0 : displayedWorkers.filter(w => w.status === 'Present').length;
    const lateCount = isNonWorkingDay ? 0 : displayedWorkers.filter(w => w.status === 'Late' || w.status === 'Double Late').length;
    const halfdayCount = isNonWorkingDay ? 0 : displayedWorkers.filter(w => String(w.status).includes('Halfday')).length;
    // On non-working days, workers must NOT be marked as absent!
    const absentCount = isNonWorkingDay ? 0 : displayedWorkers.filter(w => w.status === 'Absent').length;

    const skilledWorkers = displayedWorkers.filter(w => !isNonWorkingDay && w.status !== 'Absent' && w.status !== 'Rest Day / Non-Working' && w.role !== 'Laborer / Helper');
    const laborWorkers = displayedWorkers.filter(w => !isNonWorkingDay && w.status !== 'Absent' && w.status !== 'Rest Day / Non-Working' && w.role === 'Laborer / Helper');

    const skilledPresent = skilledWorkers.length;
    const laborPresent = laborWorkers.length;

    const getWorkerWage = (w) => {
        if (isNonWorkingDay) return 0;
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

    // Export Daily Attendance to CSV
    const handleExportCSV = () => {
        if (!displayedWorkers || displayedWorkers.length === 0) {
            alert('No attendance records available to export for this date.');
            return;
        }

        const headers = [
            'Date',
            'Worker Name',
            'Role',
            'Status',
            'Morning In',
            'Morning Out',
            'Afternoon In',
            'Afternoon Out',
            'Daily Rate (PHP)',
            'Earned Wage (PHP)',
            'Cash Advance (PHP)'
        ];

        const rows = displayedWorkers.map(w => {
            const wage = getWorkerWage(w);
            const mIn = w.morningIn || w.morning_in || '—';
            const mOut = w.morningOut || w.morning_out || '—';
            const aIn = w.afternoonIn || w.afternoon_in || '—';
            const aOut = w.afternoonOut || w.afternoon_out || '—';
            const statusLabel = isNonWorkingDay ? 'Rest Day / Off' : (w.status || 'Present');

            return [
                `"${selectedDate}"`,
                `"${(w.worker_name || w.name || '').replace(/"/g, '""')}"`,
                `"${(w.role || '').replace(/"/g, '""')}"`,
                `"${statusLabel}"`,
                `"${mIn}"`,
                `"${mOut}"`,
                `"${aIn}"`,
                `"${aOut}"`,
                Number(w.rate || 0),
                wage,
                Number(w.advance || 0)
            ];
        });

        const currentProj = mockProjects.find(p => p.id === currentProjectId);
        const projLabel = currentProj?.name ? `_${currentProj.name.replace(/[^\w-]/g, '_')}` : '';
        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Attendance_${selectedDate}${projLabel}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '0.8rem 0.8rem'
    };

    return (
        <AdminLayout>
            {/* ── HEADER TITLE ── */}
            <div className="mb-3">
                <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">ATTENDANCE MANAGEMENT</span>
                <h1 className="text-xl font-extrabold text-gray-900 mt-0.5 tracking-tight">Attendance Management</h1>
                <p className="text-[10px] text-gray-500 mt-0.5">Automated attendance system with schedule tracking and non-working day management.</p>
            </div>

            {/* ── ATTENDANCE TERMINAL AUTO-SCHEDULE STATUS CARD ── */}
            <div className={`p-3.5 rounded-xl border mb-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 transition-all ${
                isNonWorkingDay
                    ? 'bg-blue-50/70 border-blue-200'
                    : isAttendanceOpen
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-amber-50/70 border-amber-200'
            }`}>
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isNonWorkingDay
                            ? 'bg-blue-100 text-blue-700'
                            : isAttendanceOpen
                            ? 'bg-emerald-100 text-emerald-700 animate-pulse'
                            : 'bg-amber-100 text-amber-700'
                    }`}>
                        {isNonWorkingDay ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        ) : isAttendanceOpen ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                        )}
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${
                                isNonWorkingDay
                                    ? 'bg-blue-200 text-blue-900'
                                    : isAttendanceOpen
                                    ? 'bg-emerald-200 text-emerald-900'
                                    : 'bg-amber-200 text-amber-900'
                            }`}>
                                {terminalLabel}
                            </span>
                            <span className="text-[9px] text-gray-500 font-bold">
                                {selectedDate === todayISO ? `Site Clock: ${currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}` : `Date: ${selectedDate}`}
                            </span>
                        </div>
                        <p className="text-[10px] text-gray-700 font-medium mt-1">
                            {terminalMessage}
                        </p>
                    </div>
                </div>

                {/* Officer & Admin Controls */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {isNonWorkingDay ? (
                        <button
                            onClick={handleRevertWorkingDay}
                            className="bg-white border border-blue-300 text-blue-700 px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm hover:bg-blue-50 transition-colors flex items-center gap-1.5"
                            title="Ibalik sa normal working day"
                        >
                            <span>↩</span> Revert to Working Day
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                setNonWorkingForm(prev => ({ ...prev, date: selectedDate }));
                                setModalState('NON_WORKING_DAY');
                            }}
                            className="bg-white border border-red-300 text-[#A63228] px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm hover:bg-red-50 transition-colors flex items-center gap-1.5"
                            title="I-set bilang Non-Working Day (Holiday / Rest Day / Suspension)"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                            Set Non-Working Day
                        </button>
                    )}

                    <button
                        onClick={() => setModalState('ATTENDANCE_SETTINGS')}
                        className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                        title="Automatic Schedule & Site Settings"
                    >
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        Schedule Settings
                    </button>
                </div>
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
                        type="button"
                        onClick={handleExportCSV}
                        title="Download current attendance records as CSV for Excel"
                        className="flex-1 md:flex-none border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-3.5 py-1.5 rounded-lg font-bold text-[11px] shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Export CSV</span>
                    </button>
                    <button
                        onClick={() => {
                            if (isNonWorkingDay) {
                                alert(`Today is set as a Non-Working Day (${nonWorkingReason}). Attendance kiosk is closed.`);
                                return;
                            }
                            if (!isAttendanceOpen) {
                                alert(`Attendance kiosk is currently closed (${terminalLabel}). It only operates during shift hours (${format12Hour(attendanceSettings.open_time)} - ${format12Hour(attendanceSettings.close_time)}).`);
                                return;
                            }
                            openRfidKiosk();
                        }}
                        disabled={isPastDate || isNonWorkingDay || !isAttendanceOpen}
                        title={
                            isNonWorkingDay ? `Non-Working Day (${nonWorkingReason}): Attendance kiosk is closed` :
                            !isAttendanceOpen ? `Attendance closed (${terminalLabel})` :
                            isPastDate ? "Cannot use Kiosk for past dates" : ""
                        }
                        className={`flex-1 md:flex-none border px-5 py-1.5 rounded-lg font-bold text-[11px] shadow-sm flex items-center justify-center transition-colors ${
                            (isPastDate || isNonWorkingDay || !isAttendanceOpen)
                                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-75'
                                : 'bg-white border-[#A63228] text-[#A63228] hover:bg-red-50'
                        }`}
                    >
                        RFID Kiosk
                    </button>
                    <button
                        onClick={() => {
                            if (isNonWorkingDay) {
                                alert(`Today is set as a Non-Working Day (${nonWorkingReason}). No attendance logging or absence needed.`);
                                return;
                            }
                            setFormData({ ...formData, date: selectedDate });
                            setModalState('ADD');
                        }}
                        disabled={isPastDate || isNonWorkingDay}
                        title={
                            isNonWorkingDay ? `Non-Working Day (${nonWorkingReason}): No attendance or absence required` :
                            isPastDate ? "Cannot manually add workers to past dates" : ""
                        }
                        className={`flex-1 md:flex-none border border-transparent px-5 py-1.5 rounded-lg font-bold text-[11px] shadow-sm flex items-center justify-center gap-1.5 transition-colors ${
                            (isPastDate || isNonWorkingDay)
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-75'
                                : 'bg-[#E8C547] text-gray-900 hover:bg-[#d4b33d]'
                        }`}
                    >
                        <span>+</span> Add Worker
                    </button>
                </div>

            </div>

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

                {isNonWorkingDay && (
                    <div className="bg-[#e8f0fe] border border-[#aecbfa] text-[#1a73e8] px-3 py-2 rounded-lg text-xs flex items-center gap-2 mb-2.5">
                        <svg className="w-4 h-4 text-[#1a73e8] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[10px] font-medium text-blue-900">
                            <strong>NON-WORKING DAY ({nonWorkingReason}):</strong> Attendance is closed for today. <strong>No absences or penalties</strong> applied to workers.
                        </span>
                    </div>
                )}

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
                    <div className={isNonWorkingDay ? "bg-[#e8f0fe] rounded-lg p-2 text-center border border-[#aecbfa]" : "bg-[#fdecea] rounded-lg p-2 text-center border border-[#f5c6cb]"}>
                        <h2 className={`text-lg font-extrabold ${isNonWorkingDay ? 'text-[#1967d2]' : 'text-[#A63228]'}`}>
                            {isNonWorkingDay ? '0' : absentCount}
                        </h2>
                        <p className={`text-[8px] font-bold tracking-wider mt-0.5 uppercase ${isNonWorkingDay ? 'text-[#1967d2]' : 'text-[#A63228]'}`}>
                            {isNonWorkingDay ? 'REST DAY (0 ABSENT)' : 'ABSENT (0%)'}
                        </p>
                    </div>
                </div>
            </div>

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
                                            isNonWorkingDay
                                                ? 'bg-blue-100 text-blue-700 font-extrabold'
                                                : worker.status === 'Present'
                                                ? 'bg-[#e6f4ea] text-[#2e7d32]'
                                                : worker.status === 'Late'
                                                ? 'bg-[#fff8e1] text-[#f57f17]'
                                                : worker.status === 'Double Late'
                                                ? 'bg-[#fff3e0] text-[#d84315]'
                                                : String(worker.status).includes('Halfday')
                                                ? 'bg-[#ede7f6] text-[#5e35b1]'
                                                : 'bg-[#fdecea] text-[#A63228]'
                                        }`}>
                                            {isNonWorkingDay
                                                ? 'REST DAY / OFF'
                                                : worker.status === 'Late'
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
                                        {isNonWorkingDay ? (
                                            <span className="text-gray-400 font-medium">₱0.00 (Off)</span>
                                        ) : worker.status !== 'Absent' ? (
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
                            <h3 className="text-[13px] font-extrabold text-gray-900 mb-1">Waiting for Card...</h3>
                            <p className="text-[9px] text-gray-500 max-w-[220px] mb-2">Tap the worker's registered RFID/NFC ID card on the ESP32 scanner.</p>
                            
                            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[8px] font-bold px-2.5 py-1 rounded-full mb-3">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>ESP32 Hardware Endpoint Online</span>
                            </div>

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

            {/* ═════════ SET NON-WORKING DAY MODAL ═════════ */}
            {modalState === 'NON_WORKING_DAY' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[440px] shadow-2xl relative overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-sm font-extrabold text-[#1a1a1a]">Set Non-Working Day</h3>
                                <p className="text-[10px] text-gray-500 font-medium mt-0.5">Declare this date as non-working so workers are not penalized with absences.</p>
                            </div>
                            <button onClick={() => setModalState('NONE')} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-2 rounded-full hover:bg-gray-100 transition-colors">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveNonWorkingDay} className="p-5 flex flex-col gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-700 mb-1.5 uppercase tracking-wider">DATE</label>
                                <input
                                    type="date"
                                    value={nonWorkingForm.date}
                                    onChange={(e) => setNonWorkingForm(prev => ({ ...prev, date: e.target.value }))}
                                    required
                                    className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-semibold focus:border-[#A63228] outline-none text-gray-800"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-700 mb-1.5 uppercase tracking-wider">REASON / CATEGORY</label>
                                <select
                                    value={nonWorkingForm.reason}
                                    onChange={(e) => setNonWorkingForm(prev => ({ ...prev, reason: e.target.value }))}
                                    className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-3 pr-8 py-2.5 text-xs font-semibold focus:border-[#A63228] outline-none appearance-none text-gray-800"
                                    style={selectStyles}
                                >
                                    <option value="Sunday / Regular Rest Day">Sunday / Regular Rest Day</option>
                                    <option value="Official / National Holiday">Official / National Holiday</option>
                                    <option value="Weather / Typhoon Suspension">Weather / Typhoon Suspension</option>
                                    <option value="Site Standby / Material Delay">Site Standby / Material Delay</option>
                                    <option value="Emergency / Local Event">Emergency / Local Government Declaration</option>
                                    <option value="Other / Custom Reason">Other / Custom Reason</option>
                                </select>
                            </div>

                            {nonWorkingForm.reason === 'Other / Custom Reason' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-700 mb-1.5 uppercase tracking-wider">ENTER CUSTOM REASON</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Heavy rain and road flooding"
                                        value={nonWorkingForm.customReason}
                                        onChange={(e) => setNonWorkingForm(prev => ({ ...prev, customReason: e.target.value }))}
                                        required
                                        className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none text-gray-800"
                                    />
                                </div>
                            )}

                            <div className="bg-[#e8f0fe] p-3 rounded-xl border border-[#aecbfa]">
                                <div className="flex items-start gap-2">
                                    <svg className="w-4 h-4 text-[#1a73e8] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="text-[10px] text-blue-900 leading-relaxed font-medium">
                                        <strong>Worker Protection:</strong> When marked as a Non-Working Day, the attendance terminal remains automatically <strong>CLOSED</strong>. No workers are marked as <em>Absent</em> and no payroll or performance deductions apply.
                                    </div>
                                </div>
                            </div>

                            <div className="text-[9px] text-gray-400 font-medium">
                                Authorized Officer: <span className="text-gray-700 font-bold">{currentOfficerName}</span>
                            </div>

                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setModalState('NONE')}
                                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-[#A63228] text-white rounded-xl text-xs font-bold hover:bg-[#8B1A10] transition-colors shadow-sm"
                                >
                                    Set as Non-Working Day
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═════════ ATTENDANCE SCHEDULE & SETTINGS MODAL ═════════ */}
            {modalState === 'ATTENDANCE_SETTINGS' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[500px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-sm font-extrabold text-[#1a1a1a]">Attendance Schedule & Terminal Settings</h3>
                                <p className="text-[10px] text-gray-500 font-medium mt-0.5">Configure automated opening and closing cutoff hours for attendance.</p>
                            </div>
                            <button onClick={() => setModalState('NONE')} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-2 rounded-full hover:bg-gray-100 transition-colors">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="overflow-y-auto p-5 flex flex-col gap-4">
                            <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-900 uppercase">Automatic Schedule Mode</span>
                                            <span className="block text-[9px] text-gray-500">Automatically open and close attendance according to designated shift hours.</span>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={settingsForm.auto_schedule}
                                                onChange={(e) => setSettingsForm(prev => ({ ...prev, auto_schedule: e.target.checked }))}
                                                className="sr-only peer"
                                            />
                                            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2e7d32]"></div>
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200/60">
                                        <div>
                                            <label className="block text-[9px] font-bold text-gray-700 mb-1 uppercase tracking-wider">Opening Time (Open Time)</label>
                                            <input
                                                type="time"
                                                value={settingsForm.open_time}
                                                onChange={(e) => setSettingsForm(prev => ({ ...prev, open_time: e.target.value }))}
                                                required
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-semibold focus:border-[#A63228] outline-none"
                                            />
                                            <span className="text-[8px] text-gray-400 mt-0.5 block">Default: 07:00 AM (before 8:00 AM)</span>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-bold text-gray-700 mb-1 uppercase tracking-wider">Closing Cutoff (Close Cutoff)</label>
                                            <input
                                                type="time"
                                                value={settingsForm.close_time}
                                                onChange={(e) => setSettingsForm(prev => ({ ...prev, close_time: e.target.value }))}
                                                required
                                                className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-semibold focus:border-[#A63228] outline-none"
                                            />
                                            <span className="text-[8px] text-gray-400 mt-0.5 block">Default: 05:30 PM (after 5:00 PM)</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                                    <div>
                                        <span className="block text-[10px] font-bold text-gray-900 uppercase">Auto Sundays Off (Rest Day)</span>
                                        <span className="block text-[9px] text-gray-500">Automatically treat all Sundays as Rest Days (0 Absences).</span>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settingsForm.auto_sundays_off}
                                            onChange={(e) => setSettingsForm(prev => ({ ...prev, auto_sundays_off: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2e7d32]"></div>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Manual Override (Emergency)</label>
                                    <select
                                        value={settingsForm.manual_override || ''}
                                        onChange={(e) => setSettingsForm(prev => ({ ...prev, manual_override: e.target.value }))}
                                        className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-3 pr-8 py-2.5 text-xs font-semibold focus:border-[#A63228] outline-none appearance-none text-gray-800"
                                        style={selectStyles}
                                    >
                                        <option value="">Standard (Follow Automatic Schedule)</option>
                                        <option value="OPEN">Force OPEN (Keep open regardless of time)</option>
                                        <option value="CLOSED">Force CLOSED (Keep closed regardless of time)</option>
                                    </select>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-2.5 bg-[#A63228] text-white rounded-xl text-xs font-bold hover:bg-[#8B1A10] transition-colors shadow-sm"
                                >
                                    Save Schedule Settings
                                </button>
                            </form>

                            {/* Section: List of Declared Non-Working Days */}
                            <div className="mt-2 pt-4 border-t border-gray-100">
                                <h4 className="text-[10px] font-extrabold text-gray-900 uppercase tracking-wider mb-2 flex items-center justify-between">
                                    <span>Declared Non-Working Days</span>
                                    <span className="text-[9px] text-gray-400 font-normal">({nonWorkingDays.length} recorded)</span>
                                </h4>

                                {nonWorkingDays.length === 0 ? (
                                    <p className="text-[10px] text-gray-400 italic bg-gray-50 p-3 rounded-lg text-center">No custom non-working days recorded.</p>
                                ) : (
                                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                                        {nonWorkingDays.map(item => (
                                            <div key={item.date} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100 text-xs">
                                                <div>
                                                    <span className="font-extrabold text-gray-900 text-[11px] block">{item.date}</span>
                                                    <span className="text-[9px] text-gray-600 block">{item.reason} {item.set_by ? `• by ${item.set_by}` : ''}</span>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteNonWorkingDay(item.date)}
                                                    className="text-red-600 hover:text-red-800 p-1.5 rounded hover:bg-red-50 text-[10px] font-bold transition-colors"
                                                    title="Remove Non-Working Day"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
