import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import PhilippineAddressSelector from '../components/PhilippineAddressSelector'
import { parseLocationToAddress } from '../services/psgc'
import { api } from '../api'

const POSITION_OPTIONS = [
    'Worker',
    'Attendance Monitoring',
    'Tools Monitoring'
];

const parsePositions = (pos) => {
    if (!pos) return ['Worker'];
    if (Array.isArray(pos)) return pos.length > 0 ? pos : ['Worker'];
    const parts = String(pos).split(',').map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : ['Worker'];
};

export default function Workers() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [workers, setWorkers] = useState([]);

    useEffect(() => {
        api.get('/workers').then(setWorkers).catch(console.error);
    }, []);

    const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'APPROVAL'
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const [modalState, setModalState] = useState('NONE');
    const [formData, setFormData] = useState({
        id: null,
        firstName: '',
        middleName: '',
        lastName: '',
        birthday: '',
        age: '',
        phone: '',
        street: '',
        addressObj: {},
        address: '',
        role: 'Worker',
        positions: ['Worker'],
        position: 'Worker',
        daily_rate: 600,
        rfid_uid: '',
        password: '',
        status: 'Active'
    });
    const [successMsg, setSuccessMsg] = useState('');
    const [modalOpenedAt, setModalOpenedAt] = useState(0);
    const [tapAlert, setTapAlert] = useState(null);
    const [viewWorker, setViewWorker] = useState(null);

    // Auto-detect RFID card taps from hardware scanner while Add/Edit modal is open
    useEffect(() => {
        if (modalState !== 'ADD' && modalState !== 'EDIT') return;

        const interval = setInterval(() => {
            api.get('/rfid/latest-scan').then(data => {
                if (data && data.uid && data.timestamp > modalOpenedAt) {
                    setFormData(prev => {
                        if (prev.rfid_uid === data.uid) return prev;
                        setTapAlert(`Card scanned! UID: ${data.uid} auto-filled.`);
                        return { ...prev, rfid_uid: data.uid };
                    });
                }
            }).catch(() => {});
        }, 1200);

        return () => clearInterval(interval);
    }, [modalState, modalOpenedAt]);

    const handleCloseProfileModal = () => {
        setViewWorker(null);
        if (searchParams.get('id') || searchParams.get('name')) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('id');
            nextParams.delete('name');
            setSearchParams(nextParams, { replace: true });
        }
    };

    // Auto-open worker profile modal from notification navigation link (e.g. ?id=xyz or ?name=Juan)
    useEffect(() => {
        const targetId = searchParams.get('id');
        const targetName = searchParams.get('name');
        const targetTab = searchParams.get('tab');

        if (targetTab === 'approval') {
            setActiveTab('APPROVAL');
        }

        if (!targetId && !targetName) return;

        // 1. Try to find in already loaded workers
        if (workers.length > 0) {
            const found = workers.find(w => {
                if (targetId && String(w.id).trim().toLowerCase() === String(targetId).trim().toLowerCase()) return true;
                if (targetName) {
                    const normTarget = String(targetName).trim().toLowerCase().replace(/[(),]/g, '');
                    const fullName = String(w.full_name || `${w.first_name || ''} ${w.last_name || ''}`).trim().toLowerCase();
                    const firstName = String(w.first_name || '').trim().toLowerCase();
                    const lastName = String(w.last_name || '').trim().toLowerCase();
                    if (
                        fullName === normTarget ||
                        fullName.includes(normTarget) ||
                        normTarget.includes(fullName) ||
                        (firstName && lastName && normTarget.includes(firstName) && normTarget.includes(lastName))
                    ) {
                        return true;
                    }
                }
                return false;
            });

            if (found) {
                setViewWorker(found);
                return;
            }
        }

        // 2. Direct fetch if not yet found in current list
        if (targetId) {
            api.get(`/workers/${targetId}`).then(data => {
                if (data && !data.error && data.id) {
                    setViewWorker(data);
                }
            }).catch(() => {});
        }
    }, [searchParams, workers]);

    const capitalizeWords = (str) => {
        if (!str) return '';
        return str
            .split(' ')
            .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
            .join(' ');
    };

    const togglePosition = (opt) => {
        setFormData(prev => {
            const current = parsePositions(prev.positions || prev.position);
            let updated;
            if (current.includes(opt)) {
                updated = current.filter(p => p !== opt);
                if (updated.length === 0) {
                    updated = ['Worker']; // Keep at least Worker
                }
            } else {
                updated = [...current, opt];
            }
            return {
                ...prev,
                positions: updated,
                position: updated.join(', ')
            };
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleBirthdayChange = (e) => {
        const bday = e.target.value;
        if (!bday) {
            setFormData(prev => ({ ...prev, birthday: '', age: '' }));
            return;
        }

        const bdate = new Date(bday);
        const today = new Date();
        let age = today.getFullYear() - bdate.getFullYear();
        const m = today.getMonth() - bdate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < bdate.getDate())) {
            age--;
        }

        setFormData(prev => ({ ...prev, birthday: bday, age: Math.max(0, age) }));
    };

    const handleNameChange = (e) => {
        const { name, value } = e.target;
        const capitalized = capitalizeWords(value);
        setFormData(prev => ({ ...prev, [name]: capitalized }));
    };

    const handlePhoneChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');

        if (value.length === 1 && value !== '0') {
            value = '09' + value;
        } else if (value.length === 2 && value[0] === '0' && value[1] !== '9') {
            value = '09' + value[1];
        }

        if (value.length > 11) {
            value = value.slice(0, 11);
        }

        setFormData(prev => ({ ...prev, phone: value }));
    };

    const parseFullName = (fullName = '') => {
        if (!fullName) return { firstName: '', middleName: '', lastName: '' };
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 1) {
            return { firstName: parts[0], middleName: '', lastName: '' };
        } else if (parts.length === 2) {
            return { firstName: parts[0], middleName: '', lastName: parts[1] };
        } else {
            return {
                firstName: parts.slice(0, parts.length - 2).join(' '),
                middleName: parts[parts.length - 2],
                lastName: parts[parts.length - 1]
            };
        }
    };

    const handleSaveWorker = (e) => {
        e.preventDefault();

        const formattedFirstName = capitalizeWords(formData.firstName.trim());
        const formattedMiddleName = capitalizeWords(formData.middleName.trim());
        const formattedLastName = capitalizeWords(formData.lastName.trim());

        const full_name = [formattedFirstName, formattedMiddleName, formattedLastName]
            .filter(Boolean)
            .join(' ');

        const addrObj = formData.addressObj || {};
        const locParts = [
            formData.street ? formData.street.trim() : '',
            addrObj.barangayName ? `Brgy. ${addrObj.barangayName}` : '',
            addrObj.cityName,
            addrObj.provinceName && addrObj.provinceName !== 'NCR' && addrObj.provinceName !== addrObj.cityName ? addrObj.provinceName : '',
            addrObj.regionName
        ].filter(Boolean);

        const computedAddress = locParts.length > 0 ? locParts.join(', ') : (formData.address || '');

        const joinedPosition = Array.isArray(formData.positions) && formData.positions.length > 0
            ? formData.positions.join(', ')
            : (formData.position || 'Worker');

        const cleanRfid = (formData.rfid_uid || '').replace(/[\s:]/g, '').toUpperCase();
        const payload = {
            first_name: formattedFirstName,
            middle_name: formattedMiddleName,
            last_name: formattedLastName,
            full_name,
            birthday: formData.birthday || null,
            age: Number(formData.age) || null,
            phone: formData.phone,
            address: computedAddress,
            address_obj: formData.addressObj || {},
            role: formData.role,
            position: joinedPosition,
            daily_rate: Number(formData.daily_rate) || 600,
            rfid_uid: cleanRfid,
            status: formData.status,
            approval_status: 'Approved'
        };

        if (formData.password && formData.password.trim().length > 0) {
            payload.password = formData.password.trim();
        }

        if (modalState === 'ADD') {
            api.post('/workers', payload).then(newWorker => {
                setWorkers(prev => [{ ...newWorker, ...payload, id: newWorker.id || prev.length + 1 }, ...prev]);
                setSuccessMsg('New worker successfully registered and approved into the system.');
                setModalState('SUCCESS');
            }).catch(err => {
                console.error(err);
                alert(err.message || 'Failed to register worker. Check if RFID card is already assigned to someone else.');
            });
        } else if (modalState === 'EDIT') {
            api.put(`/workers/${formData.id}`, payload).then(() => {
                setWorkers(prev => prev.map(w => w.id === formData.id ? { ...w, ...payload } : w));
                setSuccessMsg('Worker profile updated successfully.');
                setModalState('SUCCESS');
            }).catch(err => {
                console.error(err);
                alert(err.message || 'Failed to update worker. Check if RFID card is already assigned to someone else.');
            });
        }
    };

    const openAddModal = () => {
        setFormData({
            id: null,
            firstName: '',
            middleName: '',
            lastName: '',
            birthday: '',
            age: '',
            phone: '',
            street: '',
            addressObj: {},
            address: '',
            role: 'Worker',
            positions: ['Worker'],
            position: 'Worker',
            daily_rate: 600,
            rfid_uid: '',
            password: '',
            status: 'Active'
        });
        setModalOpenedAt(Date.now());
        setTapAlert(null);
        setModalState('ADD');
    };

    const openEditModal = async (worker) => {
        setModalOpenedAt(Date.now());
        setTapAlert(null);
        const parsed = parseFullName(worker.full_name || '');
        const initialPositions = parsePositions(worker.position);
        const initialData = {
            id: worker.id,
            firstName: worker.first_name || parsed.firstName,
            middleName: worker.middle_name || parsed.middleName,
            lastName: worker.last_name || parsed.lastName,
            birthday: worker.birthday ? String(worker.birthday).slice(0, 10) : '',
            age: worker.age || '',
            phone: worker.phone || '',
            street: (worker.address_obj && worker.address_obj.street) || '',
            addressObj: worker.address_obj || {},
            address: worker.address || '',
            role: worker.role || 'Worker',
            positions: initialPositions,
            position: initialPositions.join(', '),
            daily_rate: worker.daily_rate || 600,
            rfid_uid: worker.rfid_uid || '',
            password: '',
            status: worker.status || 'Active'
        };

        // 1. If worker already has stored address_obj with regionCode, use it directly
        if (worker.address_obj && typeof worker.address_obj === 'object' && worker.address_obj.regionCode) {
            setFormData({
                ...initialData,
                street: worker.address_obj.street || '',
                addressObj: worker.address_obj
            });
            setModalState('EDIT');
            return;
        }

        // 2. Otherwise, dynamically resolve address from worker.address
        if (worker.address) {
            try {
                const parsedAddr = await parseLocationToAddress(worker.address);
                if (parsedAddr) {
                    initialData.addressObj = parsedAddr;
                    initialData.street = parsedAddr.street || '';
                }
            } catch (e) {
                console.warn('Error parsing worker address:', e);
            }
        }

        setFormData(initialData);
        setModalState('EDIT');
    };

    const handleDeleteWorker = (id) => {
        if (!window.confirm('Delete this worker?')) return;
        api.delete(`/workers/${id}`).then(() => {
            setWorkers(prev => prev.filter(w => w.id !== id));
        }).catch(console.error);
    };

    const toggleWorkerStatus = (worker) => {
        const newStatus = worker.status === 'Active' ? 'Inactive' : 'Active';
        api.put(`/workers/${worker.id}`, { ...worker, status: newStatus }).then(() => {
            setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, status: newStatus } : w));
        }).catch(console.error);
    };

    const [approvalRoles, setApprovalRoles] = useState({}) // { [workerId]: { role, position } }

    // ── ACCOUNT APPROVAL ──
    const handleApproval = (worker, decision) => {
        const roleOverride = approvalRoles[worker.id] || {}
        const role = roleOverride.role || worker.role || 'Worker'
        const position = roleOverride.position || worker.position || 'Worker'

        const doApprove = () => api.put(`/workers/${worker.id}/approve`, { status: decision }).then(() => {
            setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, approval_status: decision, role, position } : w))
            setSuccessMsg(`${worker.full_name}'s account has been ${decision.toLowerCase()}.`)
            setModalState('SUCCESS')
        }).catch(console.error)

        if (decision === 'Approved' && (role !== worker.role || position !== (worker.position || ''))) {
            const { password, ...workerWithoutPassword } = worker
            api.put(`/workers/${worker.id}`, { ...workerWithoutPassword, role, position }).then(doApprove).catch(console.error)
        } else {
            doApprove()
        }
    };

    const pendingWorkers = workers.filter(w => (w.approval_status || 'Pending') === 'Pending');
    const pendingCount = pendingWorkers.length;

    const approvalBadgeStyles = (status) => {
        if (status === 'Approved') return 'bg-[#e6f4ea] text-[#2e7d32]';
        if (status === 'Rejected') return 'bg-[#fdecea] text-[#A63228]';
        return 'bg-[#fff8e1] text-[#8a6d1a]';
    };

    // Only approved workers appear in the All Workers list
    const approvedWorkers = workers.filter(w => (w.approval_status || 'Approved') !== 'Pending');

    const filteredWorkers = approvedWorkers.filter(w => {
        const matchesSearch = (w.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || w.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const activeCount = approvedWorkers.filter(w => w.status === 'Active').length;
    const inactiveCount = approvedWorkers.filter(w => w.status === 'Inactive').length;

    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '0.8rem 0.8rem'
    };

    return (
        <AdminLayout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-3 gap-2">
                <div>
                    <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">MASTERLIST</span>
                    <h1 className="text-lg font-extrabold text-gray-900 mt-0.5 tracking-tight">Worker Management</h1>
                    <p className="text-[10px] text-gray-500 mt-0.5">Manage worker profiles, mobile app access, and account approvals.</p>
                </div>
                {activeTab === 'ALL' && (
                    <button
                        onClick={openAddModal}
                        className="bg-[#E8C547] border border-transparent text-gray-900 px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm hover:bg-[#d4b33d] transition-colors flex items-center justify-center gap-1 w-full md:w-auto"
                    >
                        <span>+</span> Register New Worker
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-center">
                    <p className="text-[9px] font-bold text-gray-400 tracking-wider uppercase mb-0.5">TOTAL WORKERS</p>
                    <h2 className="text-lg font-extrabold text-gray-900">{approvedWorkers.length}</h2>
                </div>
                <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-center">
                    <p className="text-[9px] font-bold text-[#2e7d32] tracking-wider uppercase mb-0.5">ACTIVE ACCOUNTS</p>
                    <h2 className="text-lg font-extrabold text-[#2e7d32]">{activeCount}</h2>
                </div>
                <div className="bg-white p-2.5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-center">
                    <p className="text-[9px] font-bold text-[#A63228] tracking-wider uppercase mb-0.5">INACTIVE / RESIGNED</p>
                    <h2 className="text-lg font-extrabold text-[#A63228]">{inactiveCount}</h2>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1.5 mb-3">
                <button
                    onClick={() => setActiveTab('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-bold border transition-colors ${activeTab === 'ALL'
                        ? 'bg-[#8B1A10] text-white border-transparent'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                >
                    All Workers
                </button>
                <button
                    onClick={() => setActiveTab('APPROVAL')}
                    className={`relative px-3 py-1.5 rounded-lg text-[9px] font-bold border transition-colors ${activeTab === 'APPROVAL'
                        ? 'bg-[#8B1A10] text-white border-transparent'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                >
                    Account Approval
                    {pendingCount > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-[#E8C547] text-[8px] font-extrabold text-gray-900">
                            {pendingCount}
                        </span>
                    )}
                </button>
            </div>

            {activeTab === 'ALL' && (
                <>
                    <div className="bg-white rounded-t-xl shadow-sm border border-gray-100 border-b-0 p-3 flex flex-col sm:flex-row justify-between gap-2">
                        <div className="relative w-full sm:max-w-xs">
                            <svg className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input
                                type="text"
                                placeholder="Search worker name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-7 pr-3 py-1 bg-[#f4f1ee] border border-transparent rounded-md text-[9px] font-medium outline-none focus:border-[#A63228]"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-[#f4f1ee] border border-transparent text-gray-700 pl-2.5 pr-6 py-1 rounded-md text-[9px] font-bold outline-none appearance-none w-full sm:w-auto"
                            style={selectStyles}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Active">Active Only</option>
                            <option value="Inactive">Inactive Only</option>
                        </select>
                    </div>

                    <div className="bg-white rounded-b-xl shadow-sm border border-gray-100 overflow-x-auto mb-6">
                        <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-1.5 pl-4 w-[35%] uppercase tracking-wider">WORKER INFO</th>
                                    <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-1.5 w-[15%] uppercase tracking-wider text-center">ROLE</th>
                                    <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-1.5 w-[13%] uppercase tracking-wider text-center">STATUS</th>
                                    <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-1.5 w-[12%] uppercase tracking-wider text-center">ACCOUNT</th>
                                    <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-1.5 w-[25%] uppercase tracking-wider text-center pr-4">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredWorkers.length > 0 ? filteredWorkers.map((worker) => (
                                    <tr 
                                        key={worker.id} 
                                        onClick={() => setViewWorker(worker)}
                                        className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                                        title="Click to view full worker profile"
                                    >
                                        <td className="py-2 pl-4 border-b border-gray-50">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <p className="text-[9px] font-extrabold text-gray-900 group-hover:text-[#A63228] transition-colors flex items-center gap-1">
                                                    <span>{worker.full_name}</span>
                                                    <span className="text-[7.5px] text-gray-400 group-hover:text-[#A63228] opacity-0 group-hover:opacity-100 transition-opacity">👁️</span>
                                                </p>
                                                {worker.rfid_uid && (
                                                    <span className="inline-flex items-center gap-0.5 text-[7px] font-mono font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200/80" title={`RFID UID: ${worker.rfid_uid}`}>
                                                        💳 {worker.rfid_uid}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[8px] text-gray-500 font-medium mt-0.5">
                                                {worker.role}{worker.position ? ` · ${worker.position}` : ''}{worker.phone ? ` · ${worker.phone}` : ''}
                                            </p>
                                        </td>
                                        <td className="py-2 border-b border-gray-50 text-center">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="text-[8px] text-gray-900 font-bold">{worker.role || 'Worker'}</span>
                                                {worker.position && (
                                                    <span className="text-[7px] text-[#A63228] font-semibold bg-red-50 px-1.5 py-0.5 rounded border border-red-100 max-w-[130px] truncate" title={worker.position}>
                                                        {worker.position}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-2 border-b border-gray-50 text-center">
                                            <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider ${worker.status === 'Active' ? 'bg-[#e6f4ea] text-[#2e7d32]' : 'bg-gray-100 text-gray-500'}`}>
                                                {worker.status}
                                            </span>
                                        </td>
                                        <td className="py-2 border-b border-gray-50 text-center">
                                            <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider ${approvalBadgeStyles(worker.approval_status || 'Pending')}`}>
                                                {worker.approval_status || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="py-2 border-b border-gray-50 pr-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-center gap-1">
                                                <button 
                                                    onClick={() => setViewWorker(worker)} 
                                                    className="bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded-sm text-[8px] font-bold hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-0.5"
                                                    title="View Profile"
                                                >
                                                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    View
                                                </button>
                                                <button onClick={() => openEditModal(worker)} className="bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded-sm text-[8px] font-bold hover:bg-gray-50 transition-colors">
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => toggleWorkerStatus(worker)}
                                                    className={`px-2 py-1 rounded-sm text-[8px] font-bold border transition-colors ${worker.status === 'Active'
                                                        ? 'bg-white border-[#A63228] text-[#A63228] hover:bg-red-50'
                                                        : 'bg-[#e6f4ea] border-[#2e7d32] text-[#2e7d32] hover:bg-green-100'
                                                        }`}
                                                >
                                                    {worker.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                                                </button>
                                                <button onClick={() => handleDeleteWorker(worker.id)} className="bg-white border border-gray-200 text-gray-400 px-1.5 py-1 rounded-sm text-[8px] font-bold hover:text-red-600 hover:border-red-300 transition-colors">
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="5" className="py-6 text-center text-[9px] text-gray-400 italic">No workers found matching your filter.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {activeTab === 'APPROVAL' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-6">
                    <div className="p-3 border-b border-gray-100">
                        <h3 className="text-xs font-extrabold text-[#1a1a1a]">Pending Account Approvals</h3>
                        <p className="text-[8px] text-gray-500 font-medium mt-0.5">Review new worker/staff registrations before they can log in to the mobile app.</p>
                    </div>
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-1.5 pl-4 w-[35%] uppercase tracking-wider">WORKER INFO</th>
                                <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-1.5 w-[15%] uppercase tracking-wider text-center">ROLE</th>
                                <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-1.5 w-[20%] uppercase tracking-wider text-center">CONTACT</th>
                                <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-1.5 w-[15%] uppercase tracking-wider text-center">APPLIED</th>
                                <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-1.5 w-[25%] uppercase tracking-wider text-center pr-4">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingWorkers.length > 0 ? pendingWorkers.map((worker) => (
                                <tr 
                                    key={worker.id} 
                                    onClick={() => setViewWorker(worker)} 
                                    className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                                    title="Click to view full worker registration profile"
                                >
                                    <td className="py-1.5 pl-4 border-b border-gray-50">
                                        <p className="text-[9px] font-extrabold text-gray-900 group-hover:text-[#A63228] transition-colors flex items-center gap-1">
                                            <span>{worker.full_name}</span>
                                            <span className="text-[7.5px] text-gray-400 group-hover:text-[#A63228] opacity-0 group-hover:opacity-100 transition-opacity">👁️</span>
                                        </p>
                                        <p className="text-[8px] text-gray-500 font-medium mt-0.5">{worker.address || 'No address on file'}</p>
                                    </td>
                                    <td className="py-1.5 border-b border-gray-50 text-center">
                                        <span className="text-[8px] text-gray-700 font-semibold">{worker.role}{worker.position ? ` · ${worker.position}` : ''}</span>
                                    </td>
                                    <td className="py-1.5 border-b border-gray-50 text-center">
                                        <span className="text-[8px] text-gray-700 font-medium">{worker.phone || '—'}</span>
                                    </td>
                                    <td className="py-1.5 border-b border-gray-50 text-center">
                                        <span className="text-[8px] text-gray-500 font-medium">
                                            {worker.created_at ? new Date(worker.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                        </span>
                                    </td>
                                    <td className="py-1.5 border-b border-gray-50 pr-4" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex flex-col items-center gap-1.5">
                                            <div className="flex items-center gap-1">
                                                <select
                                                    value={approvalRoles[worker.id]?.role || worker.role || 'Worker'}
                                                    onChange={e => setApprovalRoles(prev => ({ ...prev, [worker.id]: { ...(prev[worker.id] || {}), role: e.target.value } }))}
                                                    className="bg-gray-50 border border-gray-200 rounded text-[8px] font-semibold px-1.5 py-1 outline-none focus:border-[#A63228]"
                                                >
                                                    <option value="Worker">Worker</option>
                                                    <option value="Staff">Staff</option>
                                                </select>
                                                <select
                                                    value={approvalRoles[worker.id]?.position || worker.position || 'Worker'}
                                                    onChange={e => setApprovalRoles(prev => ({ ...prev, [worker.id]: { ...(prev[worker.id] || {}), position: e.target.value } }))}
                                                    className="bg-gray-50 border border-gray-200 rounded text-[8px] font-semibold px-1.5 py-1 outline-none focus:border-[#A63228]"
                                                >
                                                    <option value="Worker">Worker</option>
                                                    <option value="Attendance Monitoring">Attendance Monitoring</option>
                                                    <option value="Tools Monitoring">Tools Monitoring</option>
                                                    <option value="Worker, Tools Monitoring">Worker + Tools</option>
                                                    <option value="Worker, Attendance Monitoring">Worker + Attendance</option>
                                                    <option value="Worker, Attendance Monitoring, Tools Monitoring">All Positions</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => handleApproval(worker, 'Approved')}
                                                    className="bg-[#e6f4ea] border border-[#2e7d32] text-[#2e7d32] px-2 py-1 rounded-sm text-[8px] font-bold hover:bg-green-100 transition-colors"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleApproval(worker, 'Rejected')}
                                                    className="bg-white border border-[#A63228] text-[#A63228] px-2 py-1 rounded-sm text-[8px] font-bold hover:bg-red-50 transition-colors"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="5" className="py-6 text-center text-[9px] text-gray-400 italic">No pending account approvals.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {(modalState === 'ADD' || modalState === 'EDIT') && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 transition-all">
                    <div className="bg-white rounded-xl w-full max-w-[420px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-3 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-xs font-extrabold text-[#1a1a1a]">{modalState === 'ADD' ? 'Register New Worker' : 'Edit Worker Profile'}</h3>
                                <p className="text-[8px] text-gray-500 font-medium mt-0.5">Fill in the worker's details for the mobile app.</p>
                            </div>
                            <button onClick={() => setModalState('NONE')} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-1 rounded-full hover:bg-gray-100 transition-colors">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="overflow-y-auto p-3">
                            <form onSubmit={handleSaveWorker} className="flex flex-col gap-2.5">
                                <div>
                                    <h4 className="text-[7px] font-extrabold text-gray-400 uppercase tracking-widest mb-1 border-b border-gray-100 pb-0.5">Personal Information</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mb-1.5">
                                        <div>
                                            <label className="block text-[8px] font-bold text-gray-700 mb-0.5 uppercase">First Name <span className="text-[#A63228]">*</span></label>
                                            <input
                                                type="text"
                                                name="firstName"
                                                value={formData.firstName}
                                                onChange={handleNameChange}
                                                required
                                                className="w-full bg-[#f4f1ee] border border-transparent rounded-md px-2 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none capitalize"
                                                placeholder="e.g. Juan"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-bold text-gray-700 mb-0.5 uppercase">Middle Name</label>
                                            <input
                                                type="text"
                                                name="middleName"
                                                value={formData.middleName}
                                                onChange={handleNameChange}
                                                className="w-full bg-[#f4f1ee] border border-transparent rounded-md px-2 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none capitalize"
                                                placeholder="e.g. Santos"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-bold text-gray-700 mb-0.5 uppercase">Last Name <span className="text-[#A63228]">*</span></label>
                                            <input
                                                type="text"
                                                name="lastName"
                                                value={formData.lastName}
                                                onChange={handleNameChange}
                                                required
                                                className="w-full bg-[#f4f1ee] border border-transparent rounded-md px-2 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none capitalize"
                                                placeholder="e.g. Dela Cruz"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mb-1.5">
                                        <div>
                                            <label className="block text-[8px] font-bold text-gray-700 mb-0.5 uppercase">Birthday <span className="text-[#A63228]">*</span></label>
                                            <input
                                                type="date"
                                                name="birthday"
                                                value={formData.birthday || ''}
                                                onChange={handleBirthdayChange}
                                                required
                                                className="w-full bg-[#f4f1ee] border border-transparent rounded-md px-2 py-1 text-[9px] font-medium focus:border-[#A63228] outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-bold text-gray-700 mb-0.5 uppercase">Age</label>
                                            <input
                                                type="number"
                                                name="age"
                                                value={formData.age || ''}
                                                readOnly
                                                className="w-full bg-gray-100 border border-transparent rounded-md px-2 py-1 text-[9px] font-bold text-gray-600 outline-none"
                                                placeholder="Auto"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-bold text-gray-700 mb-0.5 uppercase">Phone No. <span className="text-[#A63228]">*</span></label>
                                            <input
                                                type="text"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handlePhoneChange}
                                                maxLength="11"
                                                required
                                                className="w-full bg-[#f4f1ee] border border-transparent rounded-md px-2 py-1 text-[9px] font-medium focus:border-[#A63228] outline-none"
                                                placeholder="09XX XXX XXXX"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-1.5 p-2 bg-gray-50 rounded-lg border border-gray-100">
                                        <label className="block text-[8px] font-extrabold text-gray-700 mb-1 uppercase">Home Address Details</label>
                                        <input
                                            type="text"
                                            name="street"
                                            value={formData.street || ''}
                                            onChange={handleInputChange}
                                            placeholder="House No. / Building / Street / Subdivision"
                                            className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-[8.5px] font-medium text-gray-900 focus:border-[#A63228] outline-none mb-1.5"
                                        />
                                        <PhilippineAddressSelector
                                            value={formData.addressObj || {}}
                                            onChange={(newObj) => {
                                                const locParts = [
                                                    formData.street ? formData.street.trim() : '',
                                                    newObj.barangayName ? `Brgy. ${newObj.barangayName}` : '',
                                                    newObj.cityName,
                                                    newObj.provinceName && newObj.provinceName !== 'NCR' && newObj.provinceName !== newObj.cityName ? newObj.provinceName : '',
                                                    newObj.regionName
                                                ].filter(Boolean);
                                                const fullAddress = locParts.join(', ');
                                                setFormData(prev => ({ ...prev, addressObj: newObj, address: fullAddress }));
                                            }}
                                        />
                                        {formData.address && (
                                            <p className="text-[8px] text-gray-500 font-bold mt-1 truncate">
                                                📍 {formData.address}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-[7px] font-extrabold text-gray-400 uppercase tracking-widest mb-1 border-b border-gray-100 pb-0.5 mt-1">App Access & Compensation</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-1.5">
                                        <div>
                                            <label className="block text-[8px] font-bold text-gray-700 mb-0.5 uppercase">Role</label>
                                            <select name="role" value={formData.role} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-md pl-2 pr-6 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}>
                                                <option value="Worker">Worker</option>
                                                <option value="Staff">Staff</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-bold text-gray-700 mb-0.5 uppercase">Daily Salary Rate (₱) <span className="text-[#A63228]">*</span></label>
                                            <input
                                                type="number"
                                                name="daily_rate"
                                                value={formData.daily_rate || ''}
                                                onChange={handleInputChange}
                                                required
                                                min="0"
                                                className="w-full bg-[#f4f1ee] border border-transparent rounded-md px-2 py-1.5 text-[9px] font-bold text-[#A63228] focus:border-[#A63228] outline-none"
                                                placeholder="600"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-bold text-gray-700 mb-0.5 uppercase">Account Status</label>
                                            <select name="status" value={formData.status} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-md pl-2 pr-6 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}>
                                                <option value="Active">Active (Can Login)</option>
                                                <option value="Inactive">Inactive (Resigned/Blocked)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[8px] font-bold text-gray-700 mb-0.5 uppercase flex items-center justify-between">
                                                <span>RFID Card UID</span>
                                                <span className="text-[7.5px] text-amber-700 font-semibold flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                    <span>Tap card on ESP32 to auto-fill</span>
                                                </span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    name="rfid_uid"
                                                    value={formData.rfid_uid || ''}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, rfid_uid: e.target.value.toUpperCase() }))}
                                                    placeholder="Tap card or enter UID"
                                                    className={`w-full bg-[#f4f1ee] border rounded-md px-2 py-1.5 text-[9px] font-mono font-bold text-gray-800 tracking-wider outline-none transition-all ${
                                                        tapAlert ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-400' : 'border-transparent focus:border-[#A63228]'
                                                    }`}
                                                />
                                                {formData.rfid_uid && (
                                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[7.5px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                                                        LINKED
                                                    </span>
                                                )}
                                            </div>
                                            {tapAlert ? (
                                                <p className="text-[7.5px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
                                                    <span>✅</span> {tapAlert}
                                                </p>
                                            ) : (
                                                <p className="text-[7px] text-gray-400 mt-0.5">
                                                    Scan with hardware reader or type UID manually.
                                                </p>
                                            )}
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-[8px] font-bold text-gray-700 mb-1 uppercase flex items-center justify-between">
                                                <span>Position / Roles (Select all that apply) <span className="text-[#A63228]">*</span></span>
                                                <span className="text-[7.5px] font-medium text-gray-500 normal-case bg-gray-100 px-1.5 py-0.5 rounded">
                                                    Saved as: <strong className="text-[#A63228]">{Array.isArray(formData.positions) ? formData.positions.join(', ') : (formData.position || 'Worker')}</strong>
                                                </span>
                                            </label>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-2 bg-[#f4f1ee] rounded-md border border-gray-200/60">
                                                {POSITION_OPTIONS.map(opt => {
                                                    const isChecked = (formData.positions || []).includes(opt);
                                                    return (
                                                        <label
                                                            key={opt}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                togglePosition(opt);
                                                            }}
                                                            className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-all border ${
                                                                isChecked 
                                                                    ? 'bg-white border-[#A63228] shadow-sm text-gray-900 font-bold' 
                                                                    : 'bg-transparent border-transparent text-gray-600 hover:bg-gray-100/70 font-medium'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                readOnly
                                                                className="w-3.5 h-3.5 rounded text-[#A63228] focus:ring-[#A63228] accent-[#A63228] cursor-pointer"
                                                            />
                                                            <span className="text-[8.5px] leading-tight select-none">
                                                                {opt}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[7px] text-gray-400 mt-1">
                                                * Note: Specific mobile features (such as Tools or Attendance monitoring) unlock automatically based on these keywords.
                                            </p>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-[8px] font-bold text-gray-700 mb-0.5 uppercase">
                                                {modalState === 'ADD' ? 'Initial Mobile Login Password' : 'Change Password (Optional)'}
                                            </label>
                                            <input
                                                type="password"
                                                name="password"
                                                value={formData.password || ''}
                                                onChange={handleInputChange}
                                                placeholder={modalState === 'ADD' ? 'Create password for mobile app' : 'Leave blank to keep existing password'}
                                                className="w-full bg-[#f4f1ee] border border-transparent rounded-md px-2 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" className="w-full mt-1 py-2 bg-[#E8C547] text-gray-900 rounded-lg text-[9px] font-bold hover:bg-[#d4b33d] transition-colors shadow-sm">
                                    {modalState === 'ADD' ? 'Save New Worker' : 'Update Profile'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {modalState === 'SUCCESS' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-xl p-4 w-full max-w-[250px] shadow-2xl text-center relative">
                        <button onClick={() => setModalState('NONE')} className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 bg-gray-50 p-1 rounded-full hover:bg-gray-100 transition-colors">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <div className="w-8 h-8 bg-[#e6f4ea] rounded-full flex items-center justify-center mx-auto mb-2">
                            <svg className="w-4 h-4 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-[11px] font-extrabold text-gray-900 mb-1">Success!</h3>
                        <p className="text-[9px] text-gray-500 mb-4 px-2 leading-relaxed">{successMsg}</p>
                        <button onClick={() => setModalState('NONE')} className="w-full py-1.5 bg-[#8B1A10] text-white rounded-lg text-[9px] font-bold hover:bg-[#72150d] transition-colors">
                            Done
                        </button>
                    </div>
                </div>
            )}

            {/* ═════════ FULL WORKER PROFILE MODAL ═════════ */}
            {viewWorker && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 transition-all animate-fadeIn">
                    <div className="bg-white rounded-xl w-full max-w-[440px] shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
                        {/* Header Banner */}
                        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white p-4 relative">
                            <button 
                                onClick={handleCloseProfileModal} 
                                className="absolute top-3 right-3 text-gray-400 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"
                                title="Close"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-[#E8C547] text-gray-900 font-black text-sm flex items-center justify-center shadow-md shrink-0 border-2 border-white/20">
                                    {viewWorker.full_name ? viewWorker.full_name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'W'}
                                </div>
                                <div className="pr-6">
                                    <h3 className="text-sm font-extrabold text-white leading-tight">{viewWorker.full_name}</h3>
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                        <span className="text-[7.5px] bg-white/20 text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                            {viewWorker.role || 'Worker'}
                                        </span>
                                        <span className={`text-[7.5px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider ${
                                            viewWorker.status === 'Active' ? 'bg-[#e6f4ea] text-[#2e7d32]' : 'bg-gray-700 text-gray-300'
                                        }`}>
                                            {viewWorker.status || 'Active'}
                                        </span>
                                        <span className={`text-[7.5px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wider ${approvalBadgeStyles(viewWorker.approval_status || 'Pending')}`}>
                                            {viewWorker.approval_status || 'Pending'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Profile Body */}
                        <div className="overflow-y-auto p-4 flex flex-col gap-3 text-gray-700 text-[9px]">
                            {/* Compensation & RFID Summary */}
                            <div className="grid grid-cols-2 gap-2 bg-[#f8f6f3] p-2.5 rounded-lg border border-gray-200/70">
                                <div>
                                    <span className="text-[7.5px] uppercase font-bold text-gray-400 block mb-0.5">Daily Salary Rate</span>
                                    <span className="text-xs font-black text-[#A63228]">
                                        ₱{Number(viewWorker.daily_rate || 600).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[7px] text-gray-400 block mt-0.5">per regular 8h workday</span>
                                </div>
                                <div>
                                    <span className="text-[7.5px] uppercase font-bold text-gray-400 block mb-0.5">Physical RFID Card</span>
                                    {viewWorker.rfid_uid ? (
                                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                            <span className="font-mono font-extrabold text-[8.5px] text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                                💳 {viewWorker.rfid_uid}
                                            </span>
                                            <span className="text-[7px] text-emerald-700 font-bold bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
                                                LINKED
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-[8px] text-gray-400 italic font-medium block mt-1">
                                            No RFID card linked
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Job Positions / Specializations */}
                            <div>
                                <h4 className="text-[7.5px] font-extrabold text-gray-400 uppercase tracking-widest mb-1 pb-0.5 border-b border-gray-100">
                                    Specializations & Roles
                                </h4>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {viewWorker.position ? (
                                        viewWorker.position.split(',').map((pos, i) => (
                                            <span key={i} className="bg-red-50 text-[#A63228] border border-red-100 px-2 py-0.5 rounded text-[8px] font-bold">
                                                {pos.trim()}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-gray-400 italic">Worker</span>
                                    )}
                                </div>
                            </div>

                            {/* Personal Details */}
                            <div>
                                <h4 className="text-[7.5px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5 pb-0.5 border-b border-gray-100">
                                    Personal Details
                                </h4>
                                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <div>
                                        <span className="text-[7.5px] text-gray-400 font-bold uppercase block">Contact Phone</span>
                                        <span className="text-[9px] font-extrabold text-gray-900 mt-0.5 block">
                                            {viewWorker.phone || '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[7.5px] text-gray-400 font-bold uppercase block">Age</span>
                                        <span className="text-[9px] font-extrabold text-gray-900 mt-0.5 block">
                                            {viewWorker.age ? `${viewWorker.age} years old` : '—'}
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-[7.5px] text-gray-400 font-bold uppercase block">Birth Date</span>
                                        <span className="text-[9px] font-bold text-gray-900 mt-0.5 block">
                                            {viewWorker.birthday ? new Date(viewWorker.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Address Details */}
                            <div>
                                <h4 className="text-[7.5px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5 pb-0.5 border-b border-gray-100">
                                    Residential Address
                                </h4>
                                <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <p className="text-[8.5px] font-semibold text-gray-800 leading-relaxed flex items-start gap-1">
                                        <span className="shrink-0">📍</span>
                                        <span>{viewWorker.address || 'No complete address on file.'}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Metadata Footer */}
                            <div className="flex justify-between items-center text-[7.5px] text-gray-400 pt-1.5 border-t border-gray-100">
                                <span>Worker Reference ID: #{viewWorker.id}</span>
                                <span>
                                    {viewWorker.created_at ? `Registered: ${new Date(viewWorker.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                                </span>
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-1.5 shrink-0">
                            <button
                                onClick={() => {
                                    const target = viewWorker;
                                    setViewWorker(null);
                                    openEditModal(target);
                                }}
                                className="px-3 py-1.5 bg-[#E8C547] text-gray-900 rounded-md text-[8.5px] font-extrabold hover:bg-[#d4b33d] transition-colors shadow-sm flex items-center gap-1"
                            >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Edit Profile
                            </button>
                            <button
                                onClick={() => {
                                    toggleWorkerStatus(viewWorker);
                                    setViewWorker(prev => ({ ...prev, status: prev.status === 'Active' ? 'Inactive' : 'Active' }));
                                }}
                                className={`px-2.5 py-1.5 rounded-md text-[8.5px] font-bold border transition-colors ${
                                    viewWorker.status === 'Active'
                                        ? 'bg-white border-[#A63228] text-[#A63228] hover:bg-red-50'
                                        : 'bg-[#e6f4ea] border-[#2e7d32] text-[#2e7d32] hover:bg-green-100'
                                }`}
                            >
                                {viewWorker.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                            </button>
                            <button
                                onClick={handleCloseProfileModal}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-[8.5px] font-bold hover:bg-gray-300 transition-colors"
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
