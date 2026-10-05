import React, { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import PhilippineAddressSelector from '../components/PhilippineAddressSelector'
import { parseLocationToAddress } from '../services/psgc'
import { api } from '../api'

export default function Workers() {
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
        position: '',
        daily_rate: 600,
        password: '',
        status: 'Active'
    });
    const [successMsg, setSuccessMsg] = useState('');

    const capitalizeWords = (str) => {
        if (!str) return '';
        return str
            .split(' ')
            .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
            .join(' ');
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
            ...(name === 'role' && value !== 'Staff' ? { position: '' } : {})
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
            position: formData.position,
            daily_rate: Number(formData.daily_rate) || 600,
            password: formData.password || null,
            status: formData.status,
            approval_status: 'Approved'
        };

        if (modalState === 'ADD') {
            api.post('/workers', payload).then(newWorker => {
                setWorkers(prev => [{ ...newWorker, ...payload, id: newWorker.id || prev.length + 1 }, ...prev]);
                setSuccessMsg('New worker successfully registered and approved into the system.');
                setModalState('SUCCESS');
            }).catch(console.error);
        } else if (modalState === 'EDIT') {
            api.put(`/workers/${formData.id}`, payload).then(() => {
                setWorkers(prev => prev.map(w => w.id === formData.id ? { ...w, ...payload } : w));
                setSuccessMsg('Worker profile updated successfully.');
                setModalState('SUCCESS');
            }).catch(console.error);
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
            position: '',
            daily_rate: 600,
            password: '',
            status: 'Active'
        });
        setModalState('ADD');
    };

    const openEditModal = async (worker) => {
        const parsed = parseFullName(worker.full_name || '');
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
            position: worker.position || '',
            daily_rate: worker.daily_rate || 600,
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
        const position = role === 'Staff' ? (roleOverride.position || worker.position || '') : ''

        const doApprove = () => api.put(`/workers/${worker.id}/approve`, { status: decision }).then(() => {
            setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, approval_status: decision, role, position } : w))
            setSuccessMsg(`${worker.full_name}'s account has been ${decision.toLowerCase()}.`)
            setModalState('SUCCESS')
        }).catch(console.error)

        if (decision === 'Approved' && (role !== worker.role || position !== (worker.position || ''))) {
            api.put(`/workers/${worker.id}`, { ...worker, role, position }).then(doApprove).catch(console.error)
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
                                    <tr key={worker.id} className="hover:bg-gray-50/30 transition-colors">
                                        <td className="py-1.5 pl-4 border-b border-gray-50">
                                            <p className="text-[9px] font-extrabold text-gray-900">{worker.full_name}</p>
                                            <p className="text-[8px] text-gray-500 font-medium mt-0.5">
                                                {worker.role}{worker.position ? ` · ${worker.position}` : ''}{worker.phone ? ` · ${worker.phone}` : ''}
                                            </p>
                                        </td>
                                        <td className="py-1.5 border-b border-gray-50 text-center">
                                            <span className="text-[8px] text-gray-700 font-semibold">{worker.role}</span>
                                        </td>
                                        <td className="py-1.5 border-b border-gray-50 text-center">
                                            <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider ${worker.status === 'Active' ? 'bg-[#e6f4ea] text-[#2e7d32]' : 'bg-gray-100 text-gray-500'}`}>
                                                {worker.status}
                                            </span>
                                        </td>
                                        <td className="py-1.5 border-b border-gray-50 text-center">
                                            <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider ${approvalBadgeStyles(worker.approval_status || 'Pending')}`}>
                                                {worker.approval_status || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="py-1.5 border-b border-gray-50 pr-4">
                                            <div className="flex items-center justify-center gap-1.5">
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
                                                <button onClick={() => handleDeleteWorker(worker.id)} className="bg-white border border-gray-200 text-gray-400 px-2 py-1 rounded-sm text-[8px] font-bold hover:text-red-600 hover:border-red-300 transition-colors">
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
                                <tr key={worker.id} className="hover:bg-gray-50/30 transition-colors">
                                    <td className="py-1.5 pl-4 border-b border-gray-50">
                                        <p className="text-[9px] font-extrabold text-gray-900">{worker.full_name}</p>
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
                                    <td className="py-1.5 border-b border-gray-50 pr-4">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <div className="flex items-center gap-1">
                                                <select
                                                    value={approvalRoles[worker.id]?.role || 'Worker'}
                                                    onChange={e => setApprovalRoles(prev => ({ ...prev, [worker.id]: { role: e.target.value, position: '' } }))}
                                                    className="bg-gray-50 border border-gray-200 rounded text-[8px] font-semibold px-1.5 py-1 outline-none focus:border-[#A63228]"
                                                >
                                                    <option value="Worker">Worker</option>
                                                    <option value="Staff">Staff</option>
                                                </select>
                                                {(approvalRoles[worker.id]?.role || 'Worker') === 'Staff' && (
                                                    <select
                                                        value={approvalRoles[worker.id]?.position || ''}
                                                        onChange={e => setApprovalRoles(prev => ({ ...prev, [worker.id]: { ...prev[worker.id], position: e.target.value } }))}
                                                        className="bg-gray-50 border border-gray-200 rounded text-[8px] font-semibold px-1.5 py-1 outline-none focus:border-[#A63228]"
                                                    >
                                                        <option value="" disabled>Position</option>
                                                        <option value="Attendance Monitoring">Attendance</option>
                                                        <option value="Tools Monitoring">Tools</option>
                                                    </select>
                                                )}
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
                                        {formData.role === 'Staff' && (
                                            <div>
                                                <label className="block text-[8px] font-bold text-gray-700 mb-0.5 uppercase">Position</label>
                                                <select name="position" value={formData.position} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-transparent rounded-md pl-2 pr-6 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}>
                                                    <option value="" disabled>Select a position</option>
                                                    <option value="Attendance Monitoring">Attendance Monitoring</option>
                                                    <option value="Tools Monitoring">Tools Monitoring</option>
                                                </select>
                                            </div>
                                        )}
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
        </AdminLayout>
    )
}
