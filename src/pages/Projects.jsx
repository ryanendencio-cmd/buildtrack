import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'
import PhilippineAddressSelector from '../components/PhilippineAddressSelector'
import { parseLocationToAddress } from '../services/psgc'
import AddBudgetModal from '../components/AddBudgetModal'

const isOngoingStatus = (statusStr) => {
    const s = (statusStr || '').toUpperCase();
    return s === 'ONGOING' || s === 'ACTIVE' || s === '';
};

export default function Projects() {
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        api.get('/projects').then(data => setProjects(Array.isArray(data) ? data : [])).catch(err => {
            console.error(err);
            setProjects([]);
        });
    }, []);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [modalState, setModalState] = useState('NONE'); // NONE, ADD, EDIT, CONFIRM, SUCCESS, SUCCESS

    const [addressState, setAddressState] = useState({
        regionCode: '',
        regionName: '',
        provinceCode: '',
        provinceName: '',
        cityCode: '',
        cityName: '',
        barangayName: '',
        street: ''
    });

    const [formData, setFormData] = useState({
        id: null,
        title: '',
        contract: '',
        startDate: '',
        targetDate: '',
        status: 'ONGOING'
    });

    const [saving, setSaving] = useState(false);
    const [dateError, setDateError] = useState('');
    const [contractError, setContractError] = useState('');
    const [budgetProject, setBudgetProject] = useState(null);

    const MAX_AMOUNT = 999999999999;

    const getTodayISO = () => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    const todayISO = getTodayISO();

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'startDate') {
            if (value && formData.targetDate && value > formData.targetDate) {
                setDateError('Start date cannot be after target date.');
            } else {
                setDateError('');
            }
        } else if (name === 'targetDate') {
            if (value && formData.startDate && value < formData.startDate) {
                setDateError('Target date cannot be before start date.');
            } else {
                setDateError('');
            }
        } else if (name === 'contract') {
            const num = parseFloat(value);
            if (num > MAX_AMOUNT) {
                setContractError('Budget allocated cannot exceed ₱999,999,999,999.');
            } else if (num < 0) {
                setContractError('Budget cannot be negative.');
            } else {
                setContractError('');
            }
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const activeOngoingProject = projects.find(p => isOngoingStatus(p.status));

    const openAddModal = () => {
        if (activeOngoingProject) {
            alert(`Cannot add a new project yet.\n\nThere is currently an active project: "${activeOngoingProject.name}".\n\nOnly one project is allowed to be active at a time. You must finish and mark the current project as "COMPLETED" before starting a new one.`);
            return;
        }

        setFormData({
            id: null,
            title: '',
            contract: '',
            startDate: '',
            targetDate: '',
            status: 'ONGOING'
        });
        setAddressState({
            regionCode: '',
            regionName: '',
            provinceCode: '',
            provinceName: '',
            cityCode: '',
            cityName: '',
            barangayName: '',
            street: ''
        });
        setDateError('');
        setContractError('');
        setModalState('ADD');
    };

    const openEditModal = async (proj) => {
        const locStr = proj.location || '';
        const parts = locStr.split(',').map(s => s.trim());

        const zipPart = parts.find(p => p.toLowerCase().startsWith('zip')) || '';
        const zipVal = zipPart.replace(/zip/i, '').trim();

        const bgyPart = parts.find(p => p.toLowerCase().startsWith('brgy.')) || '';
        const bgyVal = bgyPart.replace(/brgy\./i, '').trim();

        const streetVal = parts[0] && !parts[0].toLowerCase().startsWith('brgy.') && !parts[0].toLowerCase().startsWith('zip') ? parts[0] : '';

        setFormData({
            id: proj.id,
            title: proj.name || '',
            contract: String(proj.budget || ''),
            startDate: proj.start_date ? String(proj.start_date).slice(0, 10) : '',
            targetDate: proj.end_date ? String(proj.end_date).slice(0, 10) : '',
            status: (proj.status || 'ONGOING').toUpperCase() === 'COMPLETED' ? 'COMPLETED' : 'ONGOING'
        });

        setDateError('');
        setContractError('');

        // 1. If project already has stored address_obj, load it directly
        if (proj.address_obj && typeof proj.address_obj === 'object' && proj.address_obj.regionCode) {
            setAddressState({
                regionCode: proj.address_obj.regionCode || '',
                regionName: proj.address_obj.regionName || '',
                provinceCode: proj.address_obj.provinceCode || '',
                provinceName: proj.address_obj.provinceName || '',
                cityCode: proj.address_obj.cityCode || '',
                cityName: proj.address_obj.cityName || '',
                barangayName: proj.address_obj.barangayName || bgyVal,
                zipCode: proj.address_obj.zipCode || zipVal,
                street: proj.address_obj.street || streetVal
            });
            setModalState('EDIT');
            return;
        }

        // 2. Parse location string accurately using PSGC service
        try {
            const parsed = await parseLocationToAddress(locStr);
            if (parsed) {
                setAddressState(parsed);
            }
        } catch (e) {
            console.warn('Error resolving address details for edit modal:', e);
        }

        setModalState('EDIT');
    };

    const handleInitialSubmit = (e) => {
        e.preventDefault();
        if (formData.targetDate && formData.startDate && formData.targetDate < formData.startDate) {
            setDateError('Target date cannot be before start date.');
            return;
        }
        const contractNum = parseFloat(formData.contract || 0);
        if (contractNum > MAX_AMOUNT) {
            setContractError('Budget allocated cannot exceed ₱999,999,999,999.');
            return;
        }
        if (contractNum <= 0) {
            setContractError('Please enter a valid budget amount.');
            return;
        }
        setDateError('');
        setContractError('');
        setModalState('CONFIRM');
    };

    const handleConfirmSave = () => {
        setSaving(true);

        const locParts = [
            addressState.street ? addressState.street.trim() : '',
            addressState.barangayName ? `Brgy. ${addressState.barangayName}` : '',
            addressState.cityName,
            addressState.provinceName && addressState.provinceName !== 'NCR' && addressState.provinceName !== addressState.cityName ? addressState.provinceName : '',
            addressState.regionName
        ].filter(Boolean);

        const locationString = locParts.join(', ');

        const payload = {
            name: formData.title.toUpperCase(),
            location: locationString,
            address_obj: addressState,
            budget: parseFloat(formData.contract || 0),
            start_date: formData.startDate || null,
            end_date: formData.targetDate || null,
            status: formData.status || 'ONGOING'
        };

        if (formData.id) {
            api.put(`/projects/${formData.id}`, payload).then(() => {
                setProjects(prev => prev.map(p => p.id === formData.id ? { ...p, ...payload, id: formData.id } : p));
                setModalState('SUCCESS');
            }).catch(err => {
                console.error(err);
                alert(`Failed to update project: ${err.message}`);
            }).finally(() => setSaving(false));
        } else {
            api.post('/projects', payload).then(newProject => {
                setProjects(prev => [newProject, ...prev]);
                setModalState('SUCCESS');
            }).catch(err => {
                console.error(err);
                alert(`Failed to save project: ${err.message}`);
            }).finally(() => setSaving(false));
        }
    };

    const handleDeleteProject = (id) => {
        if (!window.confirm('Delete this project?')) return;
        api.delete(`/projects/${id}`).then(() => {
            setProjects(prev => prev.filter(p => p.id !== id));
        }).catch(console.error);
    };

    const filteredProjects = projects.filter(p => {
        const matchSearch = (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.location || '').toLowerCase().includes(searchTerm.toLowerCase());

        let matchStatus = true;
        if (statusFilter === 'Ongoing') {
            matchStatus = isOngoingStatus(p.status);
        } else if (statusFilter === 'Completed') {
            matchStatus = (p.status || '').toUpperCase() === 'COMPLETED';
        }

        return matchSearch && matchStatus;
    });

    const ongoingCount = projects.filter(p => isOngoingStatus(p.status)).length;
    const completedCount = projects.filter(p => (p.status || '').toUpperCase() === 'COMPLETED').length;
    const totalBudget = projects.reduce((acc, p) => acc + Number(p.budget || 0), 0);

    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '0.8rem 0.8rem'
    };

    const assembledLocationPreview = [
        addressState.street ? addressState.street.trim() : '',
        addressState.barangayName ? `Brgy. ${addressState.barangayName}` : '',
        addressState.cityName,
        addressState.provinceName && addressState.provinceName !== 'NCR' && addressState.provinceName !== addressState.cityName ? addressState.provinceName : '',
        addressState.regionName
    ].filter(Boolean).join(', ');

    return (
        <AdminLayout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-3 gap-2">
                <div>
                    <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">PROJECTS MANAGEMENT</span>
                    <h1 className="text-lg font-extrabold text-gray-900 mt-0.5 tracking-tight">Projects Management</h1>
                    <p className="text-[10px] text-gray-500 mt-0.5">Manage and monitor all your construction projects.</p>
                </div>
                <button onClick={openAddModal} className="bg-[#E8C547] text-gray-900 px-4 py-1.5 rounded-lg font-bold text-xs shadow-sm hover:bg-[#d4b33d] transition-colors flex items-center justify-center gap-1.5 w-full md:w-auto">
                    <span>+</span> Add Project
                </button>
            </div>

            {/* ── ACTIVE PROJECT POLICY BANNER ── */}
            {activeOngoingProject ? (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-700 shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                        <div>
                            <p className="text-[11px] font-extrabold text-amber-900">
                                🔒 Currently Active Project: <span className="underline">{activeOngoingProject.name}</span>
                            </p>
                            <p className="text-[9px] text-amber-700 font-medium mt-0.5">
                                Policy: Only 1 active project at a time. Finish first (mark as Completed) before starting a new project.
                            </p>
                        </div>
                    </div>
                    <span className="text-[9px] font-extrabold px-2.5 py-1 bg-amber-200/60 text-amber-900 rounded-lg shrink-0">
                        1/1 Active Limit Reached
                    </span>
                </div>
            ) : (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2.5 shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-700 shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div>
                        <p className="text-[11px] font-extrabold text-green-900">
                            ✅ Ready for a New Project
                        </p>
                        <p className="text-[9px] text-green-700 font-medium mt-0.5">
                            There are no ongoing projects currently. You can now add a new project.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-center">
                    <p className="text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-0.5">TOTAL PROJECTS</p>
                    <h2 className="text-lg font-extrabold text-gray-900">{projects.length}</h2>
                </div>
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-center">
                    <p className="text-[8px] font-bold text-[#2e7d32] tracking-wider uppercase mb-0.5">ONGOING</p>
                    <h2 className="text-lg font-extrabold text-[#2e7d32]">{ongoingCount}</h2>
                </div>
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-center">
                    <p className="text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-0.5">COMPLETED</p>
                    <h2 className="text-lg font-extrabold text-gray-900">{completedCount}</h2>
                </div>
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-center">
                    <p className="text-[8px] font-bold text-[#A63228] tracking-wider uppercase mb-0.5">TOTAL CONTRACT VALUE</p>
                    <h2 className="text-lg font-extrabold text-[#A63228]">₱{totalBudget.toLocaleString()}</h2>
                </div>
            </div>

            <div className="bg-white rounded-t-xl shadow-sm border border-gray-100 border-b-0 p-3 flex flex-col sm:flex-row justify-between gap-2">
                <div className="relative w-full sm:max-w-xs">
                    <svg className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" placeholder="Search projects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-7 pr-3 py-1.5 bg-[#f4f1ee] border border-transparent rounded-lg text-[10px] font-medium outline-none focus:border-[#A63228]" />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#f4f1ee] border border-transparent text-gray-700 pl-2.5 pr-6 py-1.5 rounded-lg text-[10px] font-bold outline-none appearance-none w-full sm:w-auto" style={selectStyles}>
                    <option value="All">All Statuses</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                </select>
            </div>

            <div className="bg-gray-50 rounded-b-xl shadow-sm border border-gray-100 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredProjects.length > 0 ? filteredProjects.map(proj => (
                        <div key={proj.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-col hover:border-[#A63228] transition-colors">
                            <h3 className="text-[10px] font-extrabold text-gray-900 mb-1 leading-snug">{proj.name}</h3>
                            <p className="text-[8px] text-gray-500 mb-2 flex items-start gap-1 leading-normal">
                                <svg className="shrink-0 mt-0.5" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                <span>{proj.location}</span>
                            </p>
                            <div className="flex items-center justify-between mb-2 bg-[#f9fafb] border border-gray-100 rounded-lg px-2 py-1.5">
                                <div>
                                    <p className="text-[7px] font-bold text-gray-400 uppercase tracking-wider">Current Budget</p>
                                    <p className="text-[11px] font-extrabold text-[#A63228]">₱{Number(proj.budget || 0).toLocaleString()}</p>
                                </div>
                                <button type="button" onClick={() => setBudgetProject(proj)} className="text-[8px] font-bold bg-[#E8C547] text-gray-900 px-2 py-1 rounded-md hover:bg-[#d4b33d] transition-colors">
                                    + Add Budget
                                </button>
                            </div>
                            <div className="mt-auto border-t border-gray-50 pt-2 flex justify-between items-center">
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[7px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${isOngoingStatus(proj.status) ? 'bg-[#fce8e6] text-[#A63228]' : 'bg-[#e6f4ea] text-[#2e7d32]'}`}>
                                        {isOngoingStatus(proj.status) ? 'ONGOING' : 'COMPLETED'}
                                    </span>
                                    <button onClick={() => openEditModal(proj)} className="text-[7px] font-bold text-gray-600 hover:text-[#A63228] bg-gray-100 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors">
                                        Edit
                                    </button>
                                    <button onClick={() => handleDeleteProject(proj.id)} className="text-[7px] font-bold text-gray-400 hover:text-red-600 transition-colors">
                                        Delete
                                    </button>
                                </div>
                                <Link to={`/project-details/${proj.id}`} className="text-[#A63228] text-[9px] font-bold hover:underline">
                                    View Dashboard →
                                </Link>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full py-10 text-center text-xs text-gray-400 italic">No projects found matching your filter.</div>
                    )}
                </div>
            </div>

            {(modalState === 'ADD' || modalState === 'EDIT') && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[440px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-xs font-extrabold text-[#1a1a1a]">{modalState === 'ADD' ? 'Add New Project' : 'Edit Project Details'}</h3>
                                <p className="text-[8px] text-gray-500 font-medium mt-0.5">Fill in the project details below.</p>
                            </div>
                            <button onClick={() => setModalState('NONE')} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-1 rounded-full hover:bg-gray-100 transition-colors">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            <form onSubmit={handleInitialSubmit} className="flex flex-col gap-3">
                                <div>
                                    <label className="block text-[8px] font-bold text-gray-700 mb-1 uppercase">Project Title <span className="text-[#A63228]">*</span></label>
                                    <input type="text" name="title" value={formData.title} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] rounded-md px-2.5 py-1.5 text-[10px] font-medium focus:border-[#A63228] outline-none" placeholder="e.g. House Construction" />
                                </div>

                                <div className="bg-[#f9fafb] p-3 rounded-lg border border-gray-200">
                                    <label className="block text-[8px] font-extrabold text-gray-700 uppercase mb-2">Location Details (Philippines)</label>
                                    
                                    <PhilippineAddressSelector
                                        value={addressState}
                                        onChange={(newAddr) => setAddressState(newAddr)}
                                    />

                                    <div className="mt-2">
                                        <label className="block text-[7px] font-bold text-gray-500 uppercase mb-0.5">Purok / Street / Bldg No. <span className="text-gray-400 font-normal">(Optional)</span></label>
                                        <input
                                            type="text"
                                            name="street"
                                            value={addressState.street || ''}
                                            onChange={(e) => setAddressState(prev => ({ ...prev, street: e.target.value }))}
                                            className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-[9px] font-medium text-gray-800 outline-none"
                                            placeholder="e.g. Unit 4, Purok 3, Main Street"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-[8px] font-bold text-gray-700 uppercase">Start Date</label>
                                            <span className="text-[7px] text-gray-400 font-semibold">Optional</span>
                                        </div>
                                        <input
                                            type="date"
                                            name="startDate"
                                            value={formData.startDate}
                                            onChange={handleInputChange}
                                            className={`w-full bg-[#f4f1ee] rounded-md px-2.5 py-1.5 text-[10px] font-medium outline-none text-gray-700 border transition-colors ${formData.targetDate && formData.startDate && formData.startDate > formData.targetDate ? 'border-red-500 text-red-600' : 'border-transparent focus:border-[#A63228]'}`}
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-[8px] font-bold text-gray-700 uppercase">Target Date</label>
                                            <span className="text-[7px] text-gray-400 font-semibold">Optional</span>
                                        </div>
                                        <input
                                            type="date"
                                            name="targetDate"
                                            min={formData.startDate || todayISO}
                                            value={formData.targetDate}
                                            onChange={handleInputChange}
                                            className={`w-full bg-[#f4f1ee] rounded-md px-2.5 py-1.5 text-[10px] font-medium outline-none text-gray-700 border transition-colors ${formData.targetDate && formData.startDate && formData.targetDate < formData.startDate ? 'border-red-500 text-red-600' : 'border-transparent focus:border-[#A63228]'}`}
                                        />
                                    </div>
                                </div>
                                {dateError && (
                                    <p className="text-[8px] text-red-600 font-bold -mt-1 flex items-center gap-1">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                        {dateError}
                                    </p>
                                )}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-[8px] font-bold text-gray-700 uppercase">Contract Amount / Budget (₱) <span className="text-[#A63228]">*</span></label>
                                    </div>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max="999999999999"
                                        name="contract"
                                        value={formData.contract}
                                        onChange={handleInputChange}
                                        required
                                        className={`w-full bg-[#f4f1ee] rounded-md px-2.5 py-1.5 text-[10px] font-extrabold focus:border-[#A63228] outline-none border transition-colors ${contractError ? 'border-red-500 text-red-600' : 'border-transparent'}`}
                                        placeholder="0.00"
                                    />
                                    {contractError && (
                                        <p className="text-[8px] text-red-600 font-bold mt-1 flex items-center gap-1">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                            {contractError}
                                        </p>
                                    )}
                                </div>

                                {modalState === 'EDIT' && (
                                    <div>
                                        <label className="block text-[8px] font-bold text-gray-700 mb-1 uppercase">Project Status</label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleInputChange}
                                            className="w-full bg-[#f4f1ee] rounded-md pl-2 pr-6 py-1.5 text-[10px] font-extrabold focus:border-[#A63228] outline-none appearance-none"
                                            style={selectStyles}
                                        >
                                            <option value="ONGOING">ONGOING</option>
                                            <option value="COMPLETED">COMPLETED</option>
                                        </select>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={Boolean(dateError) || Boolean(contractError) || parseFloat(formData.contract || 0) > MAX_AMOUNT}
                                    className="w-full mt-2 py-2 bg-[#E8C547] text-gray-900 rounded-lg text-[10px] font-bold hover:bg-[#d4b33d] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Review & Save
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {modalState === 'CONFIRM' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-xl p-5 w-full max-w-[300px] shadow-2xl relative text-center">
                        <h3 className="text-sm font-extrabold text-[#1a1a1a] mb-1">Confirm Details</h3>
                        <p className="text-[9px] text-gray-500 mb-4 font-medium">Please review the project information.</p>
                        <div className="bg-[#f4f1ee] rounded-lg p-3 text-left mb-5 border border-[#e5dfd8]">
                            <p className="text-[10px] font-extrabold text-gray-900 mb-1 leading-snug">{formData.title}</p>
                            <p className="text-[8px] text-gray-600 mb-1 leading-normal"><strong className="text-gray-700">Location:</strong> {assembledLocationPreview}</p>
                            <p className="text-[8px] text-gray-600 mb-1">Start: <span className="font-bold text-gray-900">{formData.startDate}</span>{formData.targetDate ? ` · Target: ${formData.targetDate}` : ''}</p>
                            <p className="text-[8px] text-gray-600 mb-2">Status: <span className="font-bold text-[#A63228]">{formData.status}</span></p>
                            <p className="text-[11px] font-extrabold text-[#A63228]">₱{parseFloat(formData.contract || 0).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setModalState(formData.id ? 'EDIT' : 'ADD'); setDateError(''); }} disabled={saving} className="flex-1 py-1.5 bg-white border border-[#A63228] text-[#A63228] rounded-lg text-[9px] font-bold hover:bg-red-50 transition-colors">Back</button>
                            <button onClick={handleConfirmSave} disabled={saving} className="flex-1 py-1.5 bg-[#8B1A10] text-white rounded-lg text-[9px] font-bold hover:bg-[#72150d] transition-colors disabled:opacity-60">
                                {saving ? 'Saving...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {budgetProject && (
                <AddBudgetModal
                    project={budgetProject}
                    onClose={() => setBudgetProject(null)}
                    onSaved={(data) => {
                        const newBudget = data.budget !== undefined ? data.budget : (Number(budgetProject?.budget || 0) + Number(data.amount || 0));
                        setProjects(prev => prev.map(p => String(p.id) === String(data.project_id) ? { ...p, budget: newBudget } : p));
                        setBudgetProject(prev => prev ? { ...prev, budget: newBudget } : prev);
                    }}
                />
            )}

            {modalState === 'SUCCESS' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl p-5 w-full max-w-[240px] shadow-2xl text-center relative">
                        <div className="w-10 h-10 bg-[#e6f4ea] rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-5 h-5 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-[11px] font-extrabold text-gray-900 mb-1">{formData.id ? 'Project Updated!' : 'Project Created!'}</h3>
                        <button onClick={() => setModalState('NONE')} className="mt-4 w-full py-2 bg-[#8B1A10] text-white rounded-lg text-[10px] font-bold hover:bg-[#72150d] transition-colors">Done</button>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
