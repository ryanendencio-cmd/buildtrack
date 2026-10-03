import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'

export default function Materials() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [selectedDate, setSelectedDate] = useState('2026-09-05');

    // ── FETCH PROJECTS FROM DATABASE ──
    const [dropdownProjects, setDropdownProjects] = useState([]);

    useEffect(() => {
        api.get('/projects').then(data => setDropdownProjects(data)).catch(console.error);
    }, []);

    const currentProjectId = id || (dropdownProjects[0]?.id ?? "1");
    const [materials, setMaterials] = useState([]);

    useEffect(() => {
        if (!currentProjectId) return;
        api.get(`/materials/${currentProjectId}`).then(data => setMaterials(data)).catch(console.error);
    }, [currentProjectId]);

    const displayedMaterials = materials.filter(m => m.date === selectedDate);

    const [modalState, setModalState] = useState('NONE');
    const [logDate, setLogDate] = useState(selectedDate);
    const [materialRows, setMaterialRows] = useState([
        { name: '', qty: '', unit: 'Bags', cost: '', remarks: '' }
    ]);
    const [successMsg, setSuccessMsg] = useState('');

    const handleProjectChange = (e) => navigate(`/materials/${e.target.value}`);

    const handleRowChange = (index, field, value) => {
        let val = value;
        if (field === 'name' && val.length > 0) {
            val = val.charAt(0).toUpperCase() + val.slice(1);
        }
        setMaterialRows(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: val };
            return updated;
        });
    };

    const handleAddRow = () => {
        setMaterialRows(prev => [...prev, { name: '', qty: '', unit: 'Bags', cost: '', remarks: '' }]);
    };

    const handleRemoveRow = (index) => {
        if (materialRows.length === 1) return;
        setMaterialRows(prev => prev.filter((_, i) => i !== index));
    };

    const handleLogMaterial = async (e) => {
        e.preventDefault();
        const validRows = materialRows.filter(r => r.name.trim() !== '');
        if (validRows.length === 0) {
            alert('Please add at least one material.');
            return;
        }

        try {
            const promises = validRows.map(row => {
                const payload = {
                    project_id: currentProjectId,
                    date: logDate,
                    name: row.name,
                    qty: parseFloat(row.qty || 0),
                    unit: row.unit,
                    cost: parseFloat(row.cost || 0),
                    remarks: row.remarks
                };
                return api.post('/materials', payload);
            });

            const newMaterials = await Promise.all(promises);
            setMaterials(prev => [...newMaterials, ...prev]);
            setSelectedDate(logDate);
            setSuccessMsg(`${newMaterials.length} material usage item(s) logged for ${logDate}.`);
            setModalState('SUCCESS');
            setMaterialRows([{ name: '', qty: '', unit: 'Bags', cost: '', remarks: '' }]);
        } catch (err) {
            console.error(err);
            alert('Failed to save material usage. Check server connection.');
        }
    };

    const handleDeleteMaterial = (id) => {
        if (!confirm('Delete this material record?')) return;
        api.delete(`/materials/${id}`).then(() => {
            setMaterials(prev => prev.filter(m => m.id !== id));
        }).catch(() => alert('Failed to delete.'));
    };

    const resetAndClose = () => {
        setModalState('NONE');
        setMaterialRows([{ name: '', qty: '', unit: 'Bags', cost: '', remarks: '' }]);
    };

    const dailyCost = displayedMaterials.reduce((sum, m) => sum + Number(m.cost || 0), 0);
    const totalProjectCost = materials.reduce((sum, m) => sum + Number(m.cost || 0), 0);
    const totalItemsLogged = displayedMaterials.length;

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
                    <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">INVENTORY</span>
                    <h1 className="text-lg font-extrabold text-gray-900 mt-0.5 tracking-tight">Material Management</h1>
                    <p className="text-[10px] text-gray-500 mt-0.5">Track daily usage of construction consumables.</p>
                </div>
                <button onClick={() => { setLogDate(selectedDate); setMaterialRows([{ name: '', qty: '', unit: 'Bags', cost: '', remarks: '' }]); setModalState('ADD'); }} className="bg-[#E8C547] border border-transparent text-gray-900 px-4 py-1.5 rounded-lg font-bold text-[10px] shadow-sm hover:bg-[#d4b33d] transition-colors flex items-center justify-center gap-1.5 w-full md:w-auto">
                    <span>+</span> Log Material Usage
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-3 flex flex-col sm:flex-row justify-between gap-3">
                <div className="w-full sm:w-auto">
                    <label className="block text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-1">PROJECT</label>
                    <select value={currentProjectId} onChange={handleProjectChange} className="bg-[#f4f1ee] border border-transparent rounded-lg pl-2.5 pr-6 py-1.5 text-[10px] font-extrabold text-gray-800 outline-none appearance-none w-full min-w-[260px]" style={selectStyles}>
                        {dropdownProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-1">DATE USED</label>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-[#f4f1ee] px-2 py-1.5 rounded-lg text-[10px] font-bold text-[#A63228] outline-none w-full sm:w-auto" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-center">
                    <p className="text-[9px] font-bold text-gray-400 tracking-wider uppercase mb-0.5">ITEMS LOGGED TODAY</p>
                    <h2 className="text-lg font-extrabold text-gray-900">{totalItemsLogged}</h2>
                </div>
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-center">
                    <p className="text-[9px] font-bold text-[#A63228] tracking-wider uppercase mb-0.5">DAILY MATERIAL COST</p>
                    <h2 className="text-lg font-extrabold text-[#A63228]">₱{dailyCost.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                </div>
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-center">
                    <p className="text-[9px] font-bold text-[#2e7d32] tracking-wider uppercase mb-0.5">PROJECT TOTAL MAT. COST</p>
                    <h2 className="text-lg font-extrabold text-[#2e7d32]">₱{totalProjectCost.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-6">
                <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                        <tr className="bg-gray-50/50">
                            <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-2 pl-4 w-[30%] uppercase tracking-wider">MATERIAL NAME</th>
                            <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-2 w-[15%] uppercase tracking-wider text-center">QTY USED</th>
                            <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-2 w-[15%] uppercase tracking-wider text-center">UNIT</th>
                            <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-2 w-[25%] uppercase tracking-wider">REMARKS</th>
                            <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-2 w-[15%] uppercase tracking-wider text-right pr-4">EST. COST</th>
                            <th className="text-[8px] font-extrabold text-gray-500 border-y border-gray-100 py-2 w-[5%] uppercase tracking-wider"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayedMaterials.length > 0 ? displayedMaterials.map((mat) => (
                            <tr key={mat.id} className="hover:bg-gray-50/30 transition-colors">
                                <td className="py-2.5 pl-4 border-b border-gray-50">
                                    <p className="text-[10px] font-extrabold text-gray-900">{mat.name}</p>
                                </td>
                                <td className="py-2.5 border-b border-gray-50 text-center">
                                    <span className="text-[10px] font-bold text-[#1a1a1a] bg-gray-100 px-2 py-0.5 rounded-sm">{mat.qty}</span>
                                </td>
                                <td className="py-2.5 border-b border-gray-50 text-[9px] font-bold text-gray-600 uppercase text-center">
                                    {mat.unit}
                                </td>
                                <td className="py-2.5 border-b border-gray-50 text-[9px] text-gray-600 italic">
                                    {mat.remarks || '—'}
                                </td>
                                <td className="py-2.5 border-b border-gray-50 text-[10px] font-extrabold text-[#A63228] text-right pr-4">
                                    ₱{Number(mat.cost || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-2.5 border-b border-gray-50 text-center">
                                    <button onClick={() => handleDeleteMaterial(mat.id)} className="text-gray-300 hover:text-red-500 transition-colors text-xs font-bold">×</button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5" className="py-8 text-center text-[10px] text-gray-400 italic">No materials logged for this date.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {modalState === 'ADD' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[620px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        <datalist id="common-materials">
                            <option value="Portland Cement" />
                            <option value="Hollow Blocks (4 inch)" />
                            <option value="Hollow Blocks (6 inch)" />
                            <option value="Rebar (10mm x 6m)" />
                            <option value="Rebar (12mm x 6m)" />
                            <option value="Washed Sand" />
                            <option value="Gravel (G1)" />
                            <option value="Tie Wire (#16)" />
                            <option value="Common Nails (2 inch)" />
                            <option value="Common Nails (3 inch)" />
                            <option value="Marine Plywood (1/2 inch)" />
                            <option value="Latex Paint (White)" />
                            <option value="Quick Drying Enamel" />
                            <option value="PVC Pipe (2 inch)" />
                            <option value="PVC Pipe (4 inch)" />
                        </datalist>

                        <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-base font-extrabold text-[#1a1a1a]">Log Daily Material Usage</h3>
                                <p className="text-xs text-gray-500 font-medium mt-0.5">Add all materials consumed for the entire day.</p>
                            </div>
                            <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <form onSubmit={handleLogMaterial} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center gap-3">
                                <div>
                                    <label className="block text-[9px] font-bold text-gray-700 mb-1 uppercase tracking-wider">DATE USED</label>
                                    <input
                                        type="date"
                                        value={logDate}
                                        onChange={(e) => setLogDate(e.target.value)}
                                        required
                                        className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-bold text-[#A63228] outline-none shadow-sm"
                                    />
                                </div>
                                <span className="text-[10px] font-bold text-gray-400">
                                    {materialRows.length} material(s) in list
                                </span>
                            </div>

                            <div className="overflow-y-auto p-5 flex flex-col gap-3.5 flex-1" style={{ maxHeight: '48vh' }}>
                                {materialRows.map((row, idx) => (
                                    <div key={idx} className="bg-gray-50/70 border border-gray-100 rounded-xl p-3.5 relative flex flex-col gap-2.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-extrabold text-[#A63228] bg-red-50 px-2 py-0.5 rounded-md">
                                                MATERIAL #{idx + 1}
                                            </span>
                                            {materialRows.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRow(idx)}
                                                    className="text-xs font-bold text-gray-400 hover:text-red-600 transition-colors px-1"
                                                    title="Remove item"
                                                >
                                                    ✕ Remove
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-600 mb-1 uppercase">MATERIAL NAME</label>
                                                <input
                                                    type="text"
                                                    list="common-materials"
                                                    value={row.name}
                                                    onChange={(e) => handleRowChange(idx, 'name', e.target.value)}
                                                    required
                                                    placeholder="e.g. Portland Cement"
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:border-[#A63228] outline-none"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-gray-600 mb-1 uppercase">QTY USED</label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        min="0.1"
                                                        value={row.qty}
                                                        onChange={(e) => handleRowChange(idx, 'qty', e.target.value)}
                                                        required
                                                        placeholder="0"
                                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-extrabold focus:border-[#A63228] outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-gray-600 mb-1 uppercase">UNIT</label>
                                                    <select
                                                        value={row.unit}
                                                        onChange={(e) => handleRowChange(idx, 'unit', e.target.value)}
                                                        className="w-full bg-white border border-gray-200 rounded-lg pl-2.5 pr-6 py-2 text-xs font-medium focus:border-[#A63228] outline-none appearance-none"
                                                        style={selectStyles}
                                                    >
                                                        <option value="Bags">Bags</option>
                                                        <option value="Pcs">Pcs</option>
                                                        <option value="Kgs">Kgs</option>
                                                        <option value="Liters">Liters</option>
                                                        <option value="Gals">Gals</option>
                                                        <option value="Pails">Pails</option>
                                                        <option value="Cu.m">Cu.m</option>
                                                        <option value="Truckloads">Truckloads</option>
                                                        <option value="Meters">Meters</option>
                                                        <option value="Sets">Sets</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-600 mb-1 uppercase">EST. TOTAL COST (₱)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={row.cost}
                                                    onChange={(e) => handleRowChange(idx, 'cost', e.target.value)}
                                                    required
                                                    placeholder="0.00"
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-extrabold text-[#A63228] focus:border-[#A63228] outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-gray-600 mb-1 uppercase">REMARKS / PURPOSE</label>
                                                <input
                                                    type="text"
                                                    value={row.remarks}
                                                    onChange={(e) => handleRowChange(idx, 'remarks', e.target.value)}
                                                    placeholder="e.g. Column footing pour"
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:border-[#A63228] outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs font-extrabold text-gray-600 hover:text-[#A63228] hover:border-[#A63228] hover:bg-red-50/30 transition-all flex items-center justify-center gap-1.5"
                                >
                                    <span>+</span> Add Another Material Used Today
                                </button>
                            </div>

                            <div className="p-5 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3">
                                <div className="text-left w-full sm:w-auto">
                                    <span className="block text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">TOTAL DAILY MATERIAL COST</span>
                                    <span className="text-base font-extrabold text-[#A63228]">
                                        ₱{materialRows.reduce((sum, r) => sum + (parseFloat(r.cost) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={resetAndClose}
                                        className="flex-1 sm:flex-initial px-5 py-2.5 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-xs font-extrabold hover:bg-red-50 transition-colors uppercase tracking-wider"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 sm:flex-initial px-5 py-2.5 bg-[#E8C547] text-gray-900 rounded-xl text-xs font-extrabold hover:bg-[#d4b33d] transition-colors shadow-sm uppercase tracking-wider"
                                    >
                                        Save All {materialRows.length} Material(s)
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalState === 'SUCCESS' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl p-5 w-full max-w-[280px] shadow-2xl text-center relative">
                        <div className="w-10 h-10 bg-[#e6f4ea] rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-5 h-5 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-[12px] font-extrabold text-gray-900 mb-1">Success!</h3>
                        <p className="text-[9px] text-gray-500 mb-4 px-2 leading-relaxed">{successMsg}</p>
                        <button onClick={resetAndClose} className="w-full py-2 bg-[#8B1A10] text-white rounded-lg text-[10px] font-bold hover:bg-[#72150d] transition-colors">
                            Done
                        </button>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}