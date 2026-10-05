import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'

export default function Assets() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [modalState, setModalState] = useState('NONE');
    const [selectedEquipment, setSelectedEquipment] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');

    const [dropdownProjects, setDropdownProjects] = useState([]);

    useEffect(() => {
        api.get('/projects').then(setDropdownProjects).catch(console.error);
    }, []);

    const [workers, setWorkers] = useState([]);
    useEffect(() => {
        api.get('/workers').then(data => setWorkers(data.filter(w => w.status === 'Active' && (w.approval_status || 'Approved') !== 'Pending'))).catch(console.error);
    }, []);

    const currentProjectId = id || (dropdownProjects[0]?.id ?? '1');
    const [equipment, setEquipment] = useState([]);
    const [borrowQuantities, setBorrowQuantities] = useState({});

    const handleToggleGroupSelect = (groupKey, isChecked) => {
        setBorrowQuantities(prev => {
            const next = { ...prev };
            if (isChecked) {
                next[groupKey] = 1;
            } else {
                delete next[groupKey];
            }
            return next;
        });
    };

    const handleGroupQtyChange = (groupKey, value, maxQty) => {
        const parsed = parseInt(value, 10);
        const val = isNaN(parsed) ? 1 : Math.max(1, Math.min(parsed, maxQty));
        setBorrowQuantities(prev => ({
            ...prev,
            [groupKey]: val
        }));
    };

    const handleSelectAllGrouped = (availableGrouped, e) => {
        if (e.target.checked) {
            const newQuantities = {};
            availableGrouped.forEach(g => {
                newQuantities[g.key] = 1;
            });
            setBorrowQuantities(newQuantities);
        } else {
            setBorrowQuantities({});
        }
    };


    const [borrowHistory, setBorrowHistory] = useState([]);

    useEffect(() => {
        if (!currentProjectId) return;
        api.get(`/assets/${currentProjectId}`)
            .then(data => setEquipment(Array.isArray(data) ? data.map(e => ({ ...e, condition: e.condition || e.type || 'Good' })) : []))
            .catch(console.error);
        api.get(`/borrow-history/${currentProjectId}`).then(data => setBorrowHistory(Array.isArray(data) ? data : [])).catch(console.error);
    }, [currentProjectId]);

    const recordHistory = async (record) => {
        const payload = {
            project_id: currentProjectId,
            tool_name: record.tool_name,
            borrower_name: record.borrower_name || 'Site Worker',
            quantity: record.quantity || 1,
            action: record.action,
            condition_status: record.condition_status || 'Good',
            date_time: record.date_time || new Date().toISOString()
        };
        try {
            const res = await api.post('/borrow-history', payload);
            setBorrowHistory(prev => [res.id ? res : payload, ...prev]);
        } catch {
            setBorrowHistory(prev => [payload, ...prev]);
        }
    };


    const [formData, setFormData] = useState({
        name: '', status: 'Available', condition: 'Good', user: '', quantity: 1, borrowQty: 1
    });

    const handleInputChange = (e) => {
        let val = e.target.value;
        if (e.target.name === 'name' && val.length > 0) {
            val = val.charAt(0).toUpperCase() + val.slice(1);
        }
        setFormData({ ...formData, [e.target.name]: val });
    };
    const handleProjectChange = (e) => navigate(`/assets/${e.target.value}`);

    const handleActionClick = (item) => {
        setSelectedEquipment(item);
        setFormData({ name: '', status: item.status, condition: item.condition, user: '', quantity: 1, borrowQty: 1 });

        if (item.status === 'Available') setModalState('CHECK_OUT');
        else if (item.status === 'In Use') setModalState('CHECK_IN');
        else if (item.status === 'Maintenance') setModalState('REPAIR');
    };

    const handleEditClick = (item) => {
        setSelectedEquipment(item);
        setFormData({ name: item.name, status: item.status, condition: item.condition, user: item.user || '', quantity: 1, borrowQty: 1 });
        setModalState('EDIT');
    };

    const submitEdit = async (e) => {
        e.preventDefault();
        try {
            // Apply edit to ALL ids in the group
            const idsToUpdate = selectedEquipment.ids || [selectedEquipment.id];
            await Promise.all(idsToUpdate.map(id => {
                const original = equipment.find(eq => eq.id === id);
                return api.put(`/assets/${id}`, {
                    ...original,
                    name: formData.name,
                    condition: formData.condition,
                    status: formData.status,
                });
            }));
            setEquipment(prev => prev.map(eq =>
                idsToUpdate.includes(eq.id)
                    ? { ...eq, name: formData.name, condition: formData.condition, status: formData.status }
                    : eq
            ));
            setSuccessMsg('Tool details updated successfully.');
            setModalState('SUCCESS');
        } catch (error) {
            console.error(error);
        }
    };

    const submitCheckOutMultiple = async (e) => {
        e.preventDefault();
        const selectedEntries = Object.entries(borrowQuantities).filter(([, qty]) => qty > 0);
        if (selectedEntries.length === 0) return;

        const borrowAt = new Date().toISOString();
        const workerName = formData.user || 'Site Worker';
        let allIdsToCheckout = [];

        try {
            for (const [groupKey, qty] of selectedEntries) {
                const group = availableGrouped.find(g => g.key === groupKey);
                if (!group) continue;

                const idsToCheckout = group.ids.slice(0, qty);
                allIdsToCheckout.push(...idsToCheckout);

                const promises = idsToCheckout.map(id => {
                    const item = equipment.find(eq => eq.id === id);
                    return api.put(`/assets/${id}`, {
                        ...item,
                        status: 'In Use',
                        assigned_to: workerName,
                        borrow_at: borrowAt
                    });
                });
                await Promise.all(promises);

                recordHistory({
                    tool_name: group.name,
                    borrower_name: workerName,
                    quantity: qty,
                    action: 'Check-Out',
                    condition_status: group.condition || 'Good',
                    date_time: borrowAt
                });
            }

            setEquipment(prev => prev.map(eq =>
                allIdsToCheckout.includes(eq.id)
                    ? { ...eq, status: 'In Use', assigned_to: workerName, user: workerName, borrow_at: borrowAt }
                    : eq
            ));

            setSuccessMsg(`${allIdsToCheckout.length} tool(s) checked out to ${workerName}.`);
            setModalState('SUCCESS');
            setBorrowQuantities({});
            setFormData(prev => ({ ...prev, user: '', borrowQty: 1 }));
        } catch (error) {
            console.error(error);
        }
    };

    const submitCheckOut = async (e) => {
        e.preventDefault();
        const borrowAt = new Date().toISOString();
        const qty = Math.min(parseInt(formData.borrowQty, 10) || 1, (selectedEquipment.ids || [selectedEquipment.id]).length);
        const idsToProcess = (selectedEquipment.ids || [selectedEquipment.id]).slice(0, qty);
        try {
            await Promise.all(idsToProcess.map(id => {
                const item = equipment.find(eq => eq.id === id);
                return api.put(`/assets/${id}`, {
                    ...item,
                    status: 'In Use',
                    assigned_to: formData.user || 'Site Worker',
                    borrow_at: borrowAt
                });
            }));

            recordHistory({
                tool_name: selectedEquipment.name,
                borrower_name: formData.user || 'Site Worker',
                quantity: qty,
                action: 'Check-Out',
                condition_status: selectedEquipment.condition || 'Good',
                date_time: borrowAt
            });

            setEquipment(prev => prev.map(eq => idsToProcess.includes(eq.id)
                ? { ...eq, status: 'In Use', assigned_to: formData.user || 'Site Worker', user: formData.user || 'Site Worker', borrow_at: borrowAt }
                : eq
            ));
            setSuccessMsg(`${qty} ${selectedEquipment.name}(s) checked out to ${formData.user || 'Site Worker'}.`);
            setModalState('SUCCESS');
        } catch (error) {
            console.error(error);
        }
    };

    const submitCheckIn = async (e) => {
        e.preventDefault();
        const newStatus = formData.condition === 'Broken' || formData.condition === 'Needs Repair' ? 'Maintenance' : 'Available';
        const qty = Math.min(parseInt(formData.borrowQty, 10) || 1, (selectedEquipment.ids || [selectedEquipment.id]).length);
        const idsToProcess = (selectedEquipment.ids || [selectedEquipment.id]).slice(0, qty);
        try {
            await Promise.all(idsToProcess.map(id => {
                const item = equipment.find(eq => eq.id === id);
                return api.put(`/assets/${id}`, { ...item, status: newStatus, assigned_to: null, type: formData.condition });
            }));

            recordHistory({
                tool_name: selectedEquipment.name,
                borrower_name: selectedEquipment.assigned_to || selectedEquipment.user || 'Site Worker',
                quantity: qty,
                action: 'Check-In',
                condition_status: formData.condition || 'Good',
                date_time: new Date().toISOString()
            });

            setEquipment(prev => prev.map(eq => idsToProcess.includes(eq.id)
                ? { ...eq, status: newStatus, assigned_to: '—', condition: formData.condition }
                : eq
            ));
            setSuccessMsg(`${qty} ${selectedEquipment.name}(s) checked in and recorded.`);
            setModalState('SUCCESS');
        } catch (error) {
            console.error(error);
        }
    };

    const submitRepair = (e) => {
        e.preventDefault();
        api.put(`/assets/${selectedEquipment.id}`, { ...selectedEquipment, status: 'Available', type: 'Good' })
            .then(() => {
                setEquipment(prev => prev.map(eq => eq.id === selectedEquipment.id ? { ...eq, status: 'Available', condition: 'Good' } : eq));
                setSuccessMsg(`${selectedEquipment.name} marked as repaired and available.`);
                setModalState('SUCCESS');
            }).catch(console.error);
    };

    const handleDeleteAsset = (id) => {
        if (!window.confirm('Delete this equipment?')) return;
        api.delete(`/assets/${id}`).then(() => {
            setEquipment(prev => prev.filter(eq => eq.id !== id));
        }).catch(console.error);
    };

    const handleRFIDScan = () => {
        setModalState('SCANNING');
        setTimeout(() => {
            const targetItem = equipment.find(e => e.status === 'Available' || e.status === 'In Use');
            if (targetItem) {
                const isCheckingOut = targetItem.status === 'Available';
                const updated = equipment.map(eq => eq.id === targetItem.id ? {
                    ...eq,
                    status: isCheckingOut ? 'In Use' : 'Available',
                    user: isCheckingOut ? 'RFID User (Tag 0x4B)' : '—'
                } : eq);

                recordHistory({
                    tool_name: targetItem.name,
                    borrower_name: isCheckingOut ? 'RFID User (Tag 0x4B)' : (targetItem.assigned_to || targetItem.user || 'RFID User'),
                    quantity: 1,
                    action: isCheckingOut ? 'Check-Out' : 'Check-In',
                    condition_status: targetItem.condition || 'Good',
                    date_time: new Date().toISOString()
                });

                setEquipment(updated);
                setSuccessMsg(`RFID read. ${targetItem.name} checked ${isCheckingOut ? 'out' : 'in'}.`);
                setModalState('SUCCESS');
            } else {
                setModalState('NONE');
            }
        }, 2500);
    };

    const handleConfirmAdd = async (e) => {
        e.preventDefault();
        const qty = parseInt(formData.quantity, 10) || 1;
        const payload = {
            project_id: currentProjectId,
            name: formData.name,
            status: 'Available',
            user: '—',
            condition: formData.condition
        };
        try {
            const promises = Array.from({ length: qty }).map(() => api.post('/assets', payload));
            const newEquipments = await Promise.all(promises);
            setEquipment(prev => [...prev, ...newEquipments]);
            setSuccessMsg(`${qty} tool(s) added to inventory.`);
            setModalState('SUCCESS');
        } catch (error) {
            console.error(error);
        }
    };

    const resetAndClose = () => {
        setModalState('NONE');
        setFormData({ name: '', status: 'Available', condition: 'Good', user: '', quantity: 1, borrowQty: 1 });
        setSelectedEquipment(null);
        setSelectedForCheckout([]);
        setBorrowQuantities({});
    };

    const availableCount = equipment.filter(e => e.status === 'Available').length;
    const returnedCount = equipment.filter(e => e.status === 'Returned').length;
    const inUseCount = equipment.filter(e => e.status === 'In Use').length;
    const maintenanceCount = equipment.filter(e => e.status === 'Maintenance').length;
    const unreturnedTools = equipment.filter(e => e.status === 'In Use');

    const card1Count = returnedCount > 0 && availableCount === 0 ? returnedCount : availableCount;
    const card1Label = returnedCount > 0 && availableCount === 0 ? 'RETURNED' : 'AVAILABLE';

    // Group equipment rows: same name + status + condition = one row with a qty count
    const groupedEquipment = Object.values(
        equipment.reduce((acc, item) => {
            const cond = item.condition || item.type || 'Good';
            const key = `${item.name}||${item.status}||${cond}`;
            if (!acc[key]) {
                acc[key] = { ...item, condition: cond, qty: 1, ids: [item.id] };
            } else {
                acc[key].qty += 1;
                acc[key].ids.push(item.id);
            }
            return acc;
        }, {})
    );

    // Group available tools by condition and then by tool name for Borrow Tools modal
    const availableByCondition = equipment
        .filter(eq => eq.status === 'Available')
        .reduce((acc, item) => {
            const cond = item.condition || item.type || 'Good';
            if (!acc[cond]) acc[cond] = {};
            const key = `${item.name}||${cond}`;
            if (!acc[cond][key]) {
                acc[cond][key] = {
                    key,
                    name: item.name,
                    condition: cond,
                    maxQty: 1,
                    ids: [item.id]
                };
            } else {
                acc[cond][key].maxQty += 1;
                acc[cond][key].ids.push(item.id);
            }
            return acc;
        }, {});

    const availableGrouped = Object.values(availableByCondition).flatMap(obj => Object.values(obj));

    const totalBorrowCount = Object.values(borrowQuantities).reduce((acc, qty) => acc + (qty || 0), 0);

    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '0.8rem 0.8rem'
    };

    return (
        <AdminLayout>
            <datalist id="workers-list">
                {workers
                    .filter(w => !formData.user || w.name.toLowerCase().startsWith(formData.user.toLowerCase()))
                    .map(w => (
                        <option key={w.id} value={w.name} />
                    ))}
            </datalist>

            {/* ── HEADER ── */}
            <div className="mb-4">
                <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">TOOLS MANAGEMENT</span>
                <h1 className="text-xl font-extrabold text-gray-900 mt-0.5 tracking-tight">Tools Management</h1>
                <p className="text-[10px] text-gray-500 mt-0.5">Track and monitor construction tools and equipment.</p>
            </div>

            {/* ── ALIGNED PROJECT SELECTOR & BUTTONS ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-3">
                <div className="w-full md:w-auto">
                    <label className="block text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-1">PROJECT</label>
                    <select value={currentProjectId} onChange={handleProjectChange} className="bg-white border border-gray-100 shadow-sm rounded-lg pl-2.5 pr-6 py-1.5 text-[10px] font-extrabold text-gray-800 outline-none appearance-none w-full md:w-auto min-w-[260px]" style={selectStyles}>
                        {dropdownProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button onClick={() => setModalState('BORROW_TOOLS')} className="bg-[#A63228] text-white w-[115px] h-8 rounded-lg font-bold text-[10px] shadow-sm hover:bg-[#8B1A10] transition-colors flex items-center justify-center">
                        Borrow Tools
                    </button>
                    <button onClick={handleRFIDScan} className="bg-white border border-[#A63228] text-[#A63228] w-[130px] h-8 rounded-lg font-bold text-[10px] shadow-sm hover:bg-red-50 transition-colors flex items-center justify-center">
                        RFID Scan
                    </button>
                    <button onClick={() => setModalState('ADD')} className="bg-[#E8C547] border border-transparent text-gray-900 w-[115px] h-8 rounded-lg font-bold text-[10px] shadow-sm hover:bg-[#d4b33d] transition-colors flex items-center justify-center">
                        Add Tools
                    </button>
                </div>
            </div>

            <div className="flex gap-2 mb-3">
                <div className="flex-1 bg-white rounded-lg p-2.5 text-center border border-gray-100 shadow-sm">
                    <h2 className="text-xl font-extrabold text-gray-900">{card1Count}</h2>
                    <p className="text-[8px] font-bold text-gray-500 tracking-wider mt-0.5 uppercase">{card1Label}</p>
                </div>
                <div className="flex-1 bg-white rounded-lg p-2.5 text-center border border-gray-100 shadow-sm">
                    <h2 className="text-xl font-extrabold text-gray-900">{inUseCount}</h2>
                    <p className="text-[8px] font-bold text-gray-500 tracking-wider mt-0.5 uppercase">IN USE</p>
                </div>
                <div className="flex-1 bg-white rounded-lg p-2.5 text-center border border-gray-100 shadow-sm">
                    <h2 className="text-xl font-extrabold text-[#A63228]">{maintenanceCount}</h2>
                    <p className="text-[8px] font-bold text-gray-500 tracking-wider mt-0.5 uppercase">MAINTENANCE</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-3 overflow-x-auto">
                <h3 className="text-[9px] font-extrabold text-gray-900 tracking-wider uppercase mb-2 pl-2">EQUIPMENT INVENTORY</h3>
                <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                        <tr>
                            <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[25%] uppercase tracking-wider pl-2">EQUIPMENT</th>
                            <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[10%] uppercase tracking-wider text-center">QTY</th>
                            <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[20%] uppercase tracking-wider">STATUS</th>
                            <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[20%] uppercase tracking-wider">CONDITION</th>
                            <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[25%] uppercase tracking-wider text-center pr-2">ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupedEquipment.length > 0 ? groupedEquipment.map((item) => (
                            <tr key={`${item.name}-${item.status}-${item.condition}`}>
                                <td className="py-2.5 text-[10px] font-extrabold text-gray-900 border-b border-gray-50 pl-2">{item.name}</td>
                                <td className="py-2.5 border-b border-gray-50 text-center">
                                    <span className="text-[10px] font-extrabold text-gray-900 bg-gray-100 rounded-full px-2 py-0.5">{item.qty}</span>
                                </td>
                                <td className="py-2.5 border-b border-gray-50">
                                    <span className="text-[10px] font-bold text-gray-900 tracking-wide">{item.status}</span>
                                </td>
                                <td className="py-2.5 border-b border-gray-50">
                                    <span className={`text-[8px] font-bold rounded-full px-2 py-0.5 ${
                                        item.condition === 'Good' ? 'bg-green-50 text-green-700' :
                                        item.condition === 'Needs Repair' ? 'bg-yellow-50 text-yellow-700' :
                                        'bg-red-50 text-red-700'
                                    }`}>{item.condition || 'Good'}</span>
                                </td>
                                <td className="py-2.5 border-b border-gray-50 text-center pr-2">
                                    <div className="flex items-center justify-center gap-1">
                                        <button
                                            onClick={() => handleActionClick(item)}
                                            className={`text-[8px] font-extrabold w-[75px] py-1.5 rounded border border-gray-800 text-gray-900 text-center uppercase tracking-wider inline-block transition-colors 
                                        ${item.status === 'Available' ? 'hover:bg-[#2e7d32] hover:border-[#2e7d32] hover:text-white' :
                                                    item.status === 'In Use' ? 'hover:bg-[#A63228] hover:border-[#A63228] hover:text-white' :
                                                        item.status === 'Returned' ? 'hover:bg-gray-600 hover:border-gray-600 hover:text-white' :
                                                            'hover:bg-[#ca8a04] hover:border-[#ca8a04] hover:text-white'
                                                }`}
                                        >
                                            {item.status === 'Available' ? 'Check-Out' : item.status === 'In Use' ? 'Check-In' : item.status === 'Returned' ? 'View Log' : 'Repair Log'}
                                        </button>
                                        <button onClick={() => handleEditClick(item)} title="Edit" className="text-[8px] font-bold text-blue-400 hover:text-blue-600 transition-colors px-1">✎</button>
                                        <button onClick={() => item.ids.forEach(id => handleDeleteAsset(id))} className="text-[8px] font-bold text-gray-400 hover:text-red-600 transition-colors px-1">✕</button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="5" className="py-8 text-center text-xs text-gray-400 italic">No equipment logged for this project.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 mb-4 overflow-x-auto">
                <h3 className="text-[9px] font-extrabold text-[#A63228] tracking-wider uppercase mb-0.5">UNRETURNED TOOLS</h3>
                <p className="text-[8px] text-gray-500 mb-2.5">Tools currently in use and not returned.</p>
                {unreturnedTools.length === 0 ? (
                    <p className="text-[9px] text-gray-400 italic">All tools returned.</p>
                ) : (
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[22%] uppercase tracking-wider">TOOL NAME</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[22%] uppercase tracking-wider">BORROWER</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[8%] uppercase tracking-wider text-center">QTY</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[15%] uppercase tracking-wider">CONDITION</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[18%] uppercase tracking-wider">DATE BORROWED</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[15%] uppercase tracking-wider">TIME</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.values(
                                unreturnedTools.reduce((acc, tool) => {
                                    const borrower = tool.user || tool.assigned_to || 'Site Worker';
                                    const condition = tool.condition || tool.type || 'Good';
                                    const key = `${tool.name}||${borrower}||${condition}`;
                                    if (!acc[key]) {
                                        acc[key] = { ...tool, borrower, condition, qty: 1 };
                                    } else {
                                        acc[key].qty += 1;
                                    }
                                    return acc;
                                }, {})
                            ).map((tool, idx) => {
                                const borrower = tool.borrower;
                                const rawDate = tool.borrow_at || tool.updated_at || tool.created_at;
                                const borrowDate = rawDate ? new Date(rawDate) : null;
                                const dateStr = (borrowDate && !isNaN(borrowDate.getTime())) ? borrowDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
                                const timeStr = (borrowDate && !isNaN(borrowDate.getTime())) ? borrowDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
                                const cond = tool.condition || 'Good';
                                return (
                                    <tr key={idx}>
                                        <td className="py-2.5 text-[10px] font-extrabold text-gray-900 border-b border-gray-50">{tool.name}</td>
                                        <td className="py-2.5 text-[9px] font-medium text-gray-800 border-b border-gray-50">{borrower}</td>
                                        <td className="py-2.5 border-b border-gray-50 text-center">
                                            <span className="text-[10px] font-extrabold text-gray-900 bg-gray-100 rounded-full px-2 py-0.5">{tool.qty}</span>
                                        </td>
                                        <td className="py-2.5 border-b border-gray-50">
                                            <span className={`text-[8px] font-bold rounded-full px-2 py-0.5 ${
                                                cond === 'Good' ? 'bg-green-50 text-green-700' :
                                                cond === 'Needs Repair' ? 'bg-yellow-50 text-yellow-700' :
                                                'bg-red-50 text-red-700'
                                            }`}>{cond}</span>
                                        </td>
                                        <td className="py-2.5 text-[9px] text-gray-600 border-b border-gray-50">{dateStr}</td>
                                        <td className="py-2.5 text-[9px] text-gray-600 border-b border-gray-50">{timeStr}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── BORROWING HISTORY ── */}
            <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 mb-6 overflow-x-auto">
                <div className="flex justify-between items-center mb-2.5">
                    <div>
                        <h3 className="text-[9px] font-extrabold text-gray-900 tracking-wider uppercase mb-0.5">BORROWING HISTORY</h3>
                        <p className="text-[8px] text-gray-500">History log of all tool check-outs and check-ins for this project.</p>
                    </div>
                    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">
                        {borrowHistory.length} Record(s)
                    </span>
                </div>
                {borrowHistory.length === 0 ? (
                    <p className="text-[9px] text-gray-400 italic py-3">No borrowing history recorded yet.</p>
                ) : (
                    <table className="w-full text-left border-collapse min-w-[650px]">
                        <thead>
                            <tr>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[20%] uppercase tracking-wider">TOOL NAME</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[20%] uppercase tracking-wider">BORROWER</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[8%] uppercase tracking-wider text-center">QTY</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[14%] uppercase tracking-wider text-center">ACTION</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[14%] uppercase tracking-wider">CONDITION</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[14%] uppercase tracking-wider">DATE</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[10%] uppercase tracking-wider">TIME</th>
                            </tr>
                        </thead>
                        <tbody>
                            {borrowHistory.map((item, idx) => {
                                const dt = item.date_time ? new Date(item.date_time) : (item.created_at ? new Date(item.created_at) : null);
                                const dateStr = dt && !isNaN(dt) ? dt.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
                                const timeStr = dt && !isNaN(dt) ? dt.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
                                const isCheckOut = item.action === 'Check-Out';
                                return (
                                    <tr key={item.id || idx}>
                                        <td className="py-2.5 text-[10px] font-extrabold text-gray-900 border-b border-gray-50">{item.tool_name}</td>
                                        <td className="py-2.5 text-[9px] font-medium text-gray-800 border-b border-gray-50">{item.borrower_name || item.assigned_to || '—'}</td>
                                        <td className="py-2.5 border-b border-gray-50 text-center">
                                            <span className="text-[10px] font-extrabold text-gray-900 bg-gray-100 rounded-full px-2 py-0.5">{item.quantity || 1}</span>
                                        </td>
                                        <td className="py-2.5 border-b border-gray-50 text-center">
                                            <span className={`text-[8px] font-bold rounded-full px-2 py-0.5 ${
                                                isCheckOut ? 'bg-red-50 text-[#A63228] border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                                            }`}>
                                                {item.action}
                                            </span>
                                        </td>
                                        <td className="py-2.5 border-b border-gray-50">
                                            <span className={`text-[8px] font-bold rounded-full px-2 py-0.5 ${
                                                item.condition_status === 'Good' ? 'bg-green-50 text-green-700' :
                                                item.condition_status === 'Needs Repair' ? 'bg-yellow-50 text-yellow-700' :
                                                'bg-red-50 text-red-700'
                                            }`}>{item.condition_status || 'Good'}</span>
                                        </td>
                                        <td className="py-2.5 text-[9px] text-gray-600 border-b border-gray-50">{dateStr}</td>
                                        <td className="py-2.5 text-[9px] text-gray-600 border-b border-gray-50">{timeStr}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ═════════ MODALS (ENLARGED, NO ICONS) ═════════ */}

            {modalState === 'BORROW_TOOLS' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[500px] shadow-2xl relative max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-extrabold text-[#1a1a1a]">Borrow Tools</h3>
                                <p className="text-sm text-gray-500 font-medium mt-1">Select tools and quantities to assign to a worker</p>
                            </div>
                            <button onClick={resetAndClose} className="text-2xl font-bold text-gray-400 hover:text-gray-700">&times;</button>
                        </div>
                        
                        <form onSubmit={submitCheckOutMultiple} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Assign To Worker/Staff</label>
                                <input type="text" name="user" value={formData.user} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none transition-colors" placeholder="Type name or ID here..." list="workers-list" autoComplete="off" />
                            </div>

                            <div className="p-6 overflow-y-auto flex-1" style={{ maxHeight: '45vh' }}>
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Available Tools (Separated by Condition)</h4>
                                    {availableGrouped.length > 0 && (
                                        <label className="text-[9px] font-bold flex items-center gap-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => handleSelectAllGrouped(availableGrouped, e)}
                                                checked={availableGrouped.length > 0 && Object.keys(borrowQuantities).length === availableGrouped.length}
                                                className="accent-[#A63228]"
                                            />
                                            Select All
                                        </label>
                                    )}
                                </div>
                                {availableGrouped.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic py-4 text-center">No tools available for checkout.</p>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {['Good', 'Needs Repair', 'Broken'].filter(cond => availableByCondition[cond]).map((condition) => {
                                            const groupList = Object.values(availableByCondition[condition]);
                                            return (
                                                <div key={condition} className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2 pt-1 pb-1 border-b border-gray-100">
                                                        <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                                            condition === 'Good' ? 'bg-green-100 text-green-800 border border-green-200' :
                                                            condition === 'Needs Repair' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                                                            'bg-red-100 text-red-800 border border-red-200'
                                                        }`}>
                                                            {condition} Condition
                                                        </span>
                                                        <span className="text-[9px] text-gray-400 font-bold">({groupList.length} tool type(s))</span>
                                                    </div>

                                                    <div className="flex flex-col gap-2">
                                                        {groupList.map((group) => {
                                                            const isSelected = Boolean(borrowQuantities[group.key]);
                                                            const selectedQty = borrowQuantities[group.key] || 1;
                                                            return (
                                                                <div
                                                                    key={group.key}
                                                                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                                                        isSelected ? 'bg-red-50/50 border-[#A63228]/30 shadow-sm' : 'bg-gray-50/60 border-gray-100 hover:border-gray-200'
                                                                    }`}
                                                                >
                                                                    <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 pr-2">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="accent-[#A63228] w-4 h-4 rounded"
                                                                            checked={isSelected}
                                                                            onChange={(e) => handleToggleGroupSelect(group.key, e.target.checked)}
                                                                        />
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-sm font-extrabold text-gray-900 truncate">{group.name}</span>
                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                <span className="text-[10px] font-bold text-gray-500 bg-gray-200/70 rounded-full px-2 py-0.2">
                                                                                    {group.maxQty} available
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </label>

                                                                    <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
                                                                        <span className="text-[9px] font-bold text-gray-400 uppercase">QTY:</span>
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            max={group.maxQty}
                                                                            value={isSelected ? selectedQty : 1}
                                                                            disabled={!isSelected}
                                                                            onChange={(e) => handleGroupQtyChange(group.key, e.target.value, group.maxQty)}
                                                                            className={`w-14 text-center py-1 rounded-lg border text-xs font-extrabold outline-none transition-colors ${
                                                                                isSelected ? 'bg-white border-[#A63228] text-gray-900 shadow-sm' : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                                                            }`}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex gap-3">
                                <button type="button" onClick={resetAndClose} className="flex-1 py-3 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-sm font-extrabold hover:bg-red-50 transition-colors uppercase tracking-wider">Cancel</button>
                                <button type="submit" disabled={totalBorrowCount === 0} className="flex-1 py-3 bg-[#E8C547] text-gray-900 rounded-xl text-sm font-extrabold hover:bg-[#d4b33d] transition-colors shadow-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed">Borrow {totalBorrowCount} Tool(s)</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalState === 'EDIT' && selectedEquipment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[480px] shadow-2xl relative">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-extrabold text-[#1a1a1a]">Edit Tool</h3>
                                <p className="text-sm text-gray-500 font-medium mt-1">Editing <strong className="text-gray-900">{selectedEquipment.name}</strong>{selectedEquipment.qty > 1 ? ` (${selectedEquipment.qty} items)` : ''}</p>
                            </div>
                            <button onClick={resetAndClose} className="text-2xl font-bold text-gray-400 hover:text-gray-700">&times;</button>
                        </div>
                        <form onSubmit={submitEdit} className="p-6 flex flex-col gap-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Tool Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none" placeholder="e.g. Circular Saw" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Status</label>
                                    <select name="status" value={formData.status} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-xl pl-4 pr-8 py-3 text-sm font-medium outline-none appearance-none" style={selectStyles}>
                                        <option value="Available">Available</option>
                                        <option value="In Use">In Use</option>
                                        <option value="Maintenance">Maintenance</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Condition</label>
                                    <select name="condition" value={formData.condition} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-xl pl-4 pr-8 py-3 text-sm font-medium outline-none appearance-none" style={selectStyles}>
                                        <option value="Good">Good</option>
                                        <option value="Needs Repair">Needs Repair</option>
                                        <option value="Broken">Broken</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button type="button" onClick={resetAndClose} className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-extrabold hover:bg-gray-50 transition-colors uppercase tracking-wider">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-[#E8C547] text-gray-900 rounded-xl text-sm font-extrabold hover:bg-[#d4b33d] transition-colors shadow-sm uppercase tracking-wider">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalState === 'CHECK_OUT' && selectedEquipment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[480px] shadow-2xl relative">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-extrabold text-[#1a1a1a]">Check-Out Tool</h3>
                                <p className="text-sm text-gray-500 font-medium mt-1">Assigning <strong className="text-gray-900">{selectedEquipment.name}</strong> <span className="text-[#A63228]">({selectedEquipment.qty || 1} available)</span></p>
                            </div>
                            <button onClick={resetAndClose} className="text-2xl font-bold text-gray-400 hover:text-gray-700">&times;</button>
                        </div>
                        <form onSubmit={submitCheckOut} className="p-6 flex flex-col gap-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Assign To Worker/Staff</label>
                                <input type="text" name="user" value={formData.user} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none transition-colors" placeholder="Type name or ID here..." list="workers-list" autoComplete="off" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Quantity to Borrow <span className="font-normal text-gray-400">(max {selectedEquipment.qty || 1})</span></label>
                                <input type="number" name="borrowQty" min="1" max={selectedEquipment.qty || 1} value={formData.borrowQty} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none" />
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button type="button" onClick={resetAndClose} className="flex-1 py-3 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-sm font-extrabold hover:bg-red-50 transition-colors uppercase tracking-wider">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-[#E8C547] text-gray-900 rounded-xl text-sm font-extrabold hover:bg-[#d4b33d] transition-colors shadow-sm uppercase tracking-wider">Confirm Check-Out</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalState === 'CHECK_IN' && selectedEquipment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[480px] shadow-2xl relative">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-extrabold text-[#1a1a1a]">Check-In Tool</h3>
                                <p className="text-sm text-gray-500 font-medium mt-1">Returning <strong className="text-gray-900">{selectedEquipment.name}</strong> <span className="text-[#A63228]">({selectedEquipment.qty || 1} in use)</span></p>
                            </div>
                            <button onClick={resetAndClose} className="text-2xl font-bold text-gray-400 hover:text-gray-700">&times;</button>
                        </div>
                        <form onSubmit={submitCheckIn} className="p-6 flex flex-col gap-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Quantity to Return <span className="font-normal text-gray-400">(max {selectedEquipment.qty || 1})</span></label>
                                <input type="number" name="borrowQty" min="1" max={selectedEquipment.qty || 1} value={formData.borrowQty} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Assess Tool Condition</label>
                                <select name="condition" value={formData.condition} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-xl pl-4 pr-8 py-3 text-sm font-medium outline-none appearance-none" style={selectStyles}>
                                    <option value="Good">Good Working Condition</option>
                                    <option value="Needs Repair">Needs Repair (Maintenance)</option>
                                    <option value="Broken">Broken / Damaged</option>
                                </select>
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button type="button" onClick={resetAndClose} className="flex-1 py-3 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-sm font-extrabold hover:bg-red-50 transition-colors uppercase tracking-wider">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-[#8B1A10] text-white rounded-xl text-sm font-extrabold hover:bg-[#72150d] transition-colors shadow-sm uppercase tracking-wider">Confirm Check-In</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalState === 'REPAIR' && selectedEquipment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[480px] shadow-2xl relative text-center">
                        <div className="p-8 flex flex-col items-center">
                            <h3 className="text-2xl font-extrabold text-[#1a1a1a] mb-3">Mark as Repaired</h3>
                            <p className="text-sm text-gray-500 mb-8 leading-relaxed">
                                Confirm that the <strong className="text-gray-900">{selectedEquipment.name}</strong> is fully repaired and ready to be checked out again.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button onClick={resetAndClose} className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-extrabold hover:bg-gray-50 transition-colors uppercase tracking-wider">Cancel</button>
                                <button onClick={submitRepair} className="flex-1 py-3 bg-[#2e7d32] text-white rounded-xl text-sm font-extrabold hover:bg-[#1b5e20] transition-colors shadow-sm uppercase tracking-wider">Set to Available</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {modalState === 'SCANNING' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-[400px] shadow-2xl text-center relative flex flex-col items-center">
                        <h3 className="text-xl font-extrabold text-[#A63228] mb-3 uppercase tracking-widest animate-pulse">Scanning...</h3>
                        <p className="text-sm text-gray-600 font-medium mb-8">Please tap the tool's RFID tag on the physical scanner.</p>
                        <button onClick={resetAndClose} className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-extrabold hover:bg-gray-50 transition-colors uppercase tracking-wider">Cancel Scan</button>
                    </div>
                </div>
            )}

            {modalState === 'ADD' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[480px] shadow-2xl relative overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-extrabold text-[#1a1a1a]">Add Tools</h3>
                                <p className="text-sm text-gray-500 font-medium mt-1">Register new tools to inventory.</p>
                            </div>
                            <button onClick={resetAndClose} className="text-2xl font-bold text-gray-400 hover:text-gray-700">&times;</button>
                        </div>
                        <form onSubmit={handleConfirmAdd} className="p-6 flex flex-col gap-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Tool Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none" placeholder="e.g. Circular Saw" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Quantity</label>
                                    <input type="number" name="quantity" min="1" value={formData.quantity} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none" placeholder="1" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Condition</label>
                                    <select name="condition" value={formData.condition} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-xl pl-4 pr-8 py-3 text-sm font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}>
                                        <option value="Good">Good</option>
                                        <option value="Needs Repair">Needs Repair</option>
                                        <option value="Broken">Broken</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button type="button" onClick={resetAndClose} className="flex-1 py-3 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-sm font-extrabold hover:bg-red-50 transition-colors uppercase tracking-wider">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-[#E8C547] text-gray-900 rounded-xl text-sm font-extrabold hover:bg-[#d4b33d] transition-colors shadow-sm uppercase tracking-wider">Add to Inventory</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalState === 'SUCCESS' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-[360px] shadow-2xl text-center relative">
                        <h3 className="text-2xl font-extrabold text-[#2e7d32] mb-3 uppercase tracking-widest">Success</h3>
                        <p className="text-sm text-gray-600 font-medium mb-8 leading-snug">{successMsg}</p>
                        <button onClick={resetAndClose} className="w-full py-3 bg-[#8B1A10] text-white rounded-xl text-sm font-extrabold hover:bg-[#72150d] uppercase tracking-wider">Done</button>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
