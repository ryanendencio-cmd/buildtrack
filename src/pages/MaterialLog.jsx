import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'

export default function MaterialLog() {
    const { id } = useParams();

    const currentDate = new Date();
    const todayFull = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const todayShort = currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    const [modalState, setModalState] = useState('NONE');

    const mockData = {
        "1": {
            name: "80 SQM. TWO STOREY HOUSE CONSTRUCTION - SUBCON",
            materials: [
                { id: 1, name: "Cement", qty: "20 bags", cost: 5000 },
                { id: 2, name: "Hollow Blocks", qty: "500 pcs", cost: 7500 },
                { id: 3, name: "Rebar (10mm)", qty: "50 pcs", cost: 11300 }
            ]
        },
        "2": {
            name: "ROOF REPLACEMENT & CONSTRUCTION OF SEPTIC TANK - BARBA PIGGERY",
            materials: [
                { id: 1, name: "G.I. Roofing Sheets", qty: "45 pcs", cost: 11250 },
                { id: 2, name: "Cement", qty: "10 bags", cost: 2500 },
                { id: 3, name: "PVC Pipes", qty: "12 pcs", cost: 1450 }
            ]
        },
        "3": {
            name: "HOUSE RENOVATION & EXTENSION - ENGR. AQUINO RESIDENCE",
            materials: [
                { id: 1, name: "Paint (White)", qty: "4 pails", cost: 6000 },
                { id: 2, name: "Thinner", qty: "2 gals", cost: 800 },
                { id: 3, name: "Brushes/Rollers", qty: "10 sets", cost: 2700 }
            ]
        }
    };

    const project = mockData[id] || mockData["1"];
    const [materials, setMaterials] = useState(project.materials);

    const [materialRows, setMaterialRows] = useState([
        { material: '', quantity: '', unit: 'Bags', price: '' }
    ]);

    const handleRowChange = (index, field, value) => {
        let val = value;
        if (field === 'material' && val.length > 0) {
            val = val.charAt(0).toUpperCase() + val.slice(1);
        }
        setMaterialRows(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: val };
            return updated;
        });
    };

    const handleAddRow = () => {
        setMaterialRows(prev => [...prev, { material: '', quantity: '', unit: 'Bags', price: '' }]);
    };

    const handleRemoveRow = (index) => {
        if (materialRows.length === 1) return;
        setMaterialRows(prev => prev.filter((_, i) => i !== index));
    };

    const handleConfirmAddBatch = () => {
        const validRows = materialRows.filter(r => r.material.trim() !== '');
        if (validRows.length === 0) return;

        const newEntries = validRows.map((r, i) => {
            const computedCost = parseFloat(r.quantity || 0) * parseFloat(r.price || 0);
            return {
                id: Date.now() + i,
                name: r.material,
                qty: `${r.quantity} ${r.unit}`,
                cost: computedCost
            };
        });

        setMaterials(prev => [...prev, ...newEntries]);
        setModalState('SUCCESS');
        setMaterialRows([{ material: '', quantity: '', unit: 'Bags', price: '' }]);
    };

    const totalCost = materials.reduce((sum, item) => sum + Number(item.cost || 0), 0);

    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.75rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '1rem 1rem'
    };

    return (
        <AdminLayout>
            <div className="mb-2">
                <Link to={`/project-details/${id || 1}`} className="text-gray-500 hover:text-[#A63228] text-xs font-bold flex items-center gap-1 transition-colors w-fit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Project Details
                </Link>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-3">
                <div>
                    <span className="text-[10px] font-bold text-[#A63228] tracking-widest uppercase">MATERIAL LOG</span>
                    <h1 className="text-lg font-extrabold text-gray-900 mt-0.5 uppercase">MATERIAL CONSUMPTION LOG</h1>
                </div>
                <div>
                    <button
                        onClick={() => setModalState('ADD')}
                        className="bg-[#E8C547] text-[#1a1a1a] px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-[#d4b33d] transition-colors flex items-center gap-1.5"
                    >
                        <span>+</span> Add Material Usage
                    </button>
                </div>
            </div>

            <div className="bg-[#ead9d8]/70 text-[#1a1a1a] px-4 py-2.5 rounded-lg flex justify-between items-center mb-4 border border-[#e5dfd8]">
                <span className="text-xs font-bold uppercase text-gray-800">{project.name}</span>
                <Link to="/projects" className="text-[10px] text-[#A63228] font-bold hover:underline">Change Project ›</Link>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-50">
                    <h3 className="text-[10px] font-extrabold text-gray-900 tracking-widest uppercase">MATERIAL USAGE</h3>
                    <span className="bg-[#fce8e6] text-[#A63228] text-[9px] font-bold px-2.5 py-1 rounded-full uppercase">{todayFull}</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr>
                                <th className="text-[9px] font-bold text-gray-400 border-b border-gray-100 px-4 py-2 w-[50%] uppercase tracking-wider">MATERIAL</th>
                                <th className="text-[9px] font-bold text-gray-400 border-b border-gray-100 px-4 py-2 w-[25%] uppercase tracking-wider text-center">QUANTITY USED</th>
                                <th className="text-[9px] font-bold text-gray-400 border-b border-gray-100 px-4 py-2 w-[25%] uppercase tracking-wider text-right">COST</th>
                            </tr>
                        </thead>
                        <tbody>
                            {materials.map((mat) => (
                                <tr key={mat.id}>
                                    <td className="px-4 py-2.5 text-[11px] font-bold text-gray-800 border-b border-gray-50">{mat.name}</td>
                                    <td className="px-4 py-2.5 text-[11px] text-gray-600 border-b border-gray-50 text-center">{mat.qty}</td>
                                    <td className="px-4 py-2.5 text-[11px] font-extrabold text-gray-900 border-b border-gray-50 text-right">₱{Number(mat.cost || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="bg-[#ead9d8]/70 text-[#A63228] px-4 py-2.5 flex justify-between items-center m-3 rounded-lg border border-[#e5dfd8]">
                    <span className="text-[10px] font-extrabold tracking-wider uppercase">TODAY'S MATERIAL COST</span>
                    <span className="text-sm font-extrabold">₱{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
            </div>

            {/* ═════════ MODALS ═════════ */}

            {/* BATCH DAILY MATERIAL ADD MODAL */}
            {modalState === 'ADD' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[600px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        <datalist id="material-options">
                            <option value="Cement" />
                            <option value="Hollow Blocks (4 inch)" />
                            <option value="Hollow Blocks (6 inch)" />
                            <option value="Rebar (10mm)" />
                            <option value="Rebar (12mm)" />
                            <option value="Washed Sand" />
                            <option value="Gravel (G1)" />
                            <option value="Tie Wire (#16)" />
                            <option value="Nails (2 inch)" />
                            <option value="Paint (White)" />
                            <option value="G.I. Roofing Sheets" />
                        </datalist>

                        <div className="flex justify-between items-center p-5 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-base font-extrabold text-[#1a1a1a]">Add All Daily Material Usage</h3>
                                <p className="text-xs text-gray-500 font-medium mt-0.5">Record all materials consumed for the entire day.</p>
                            </div>
                            <span className="bg-[#fce8e6] text-[#A63228] text-xs font-bold px-3 py-1 rounded-full">{todayShort}</span>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); setModalState('CONFIRM'); }} className="flex flex-col flex-1 overflow-hidden">
                            <div className="overflow-y-auto p-5 flex flex-col gap-3.5 flex-1" style={{ maxHeight: '48vh' }}>
                                {materialRows.map((row, idx) => (
                                    <div key={idx} className="bg-gray-50/70 border border-gray-100 rounded-xl p-3.5 relative flex flex-col gap-2.5">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-extrabold text-[#A63228] bg-red-50 px-2 py-0.5 rounded-md">
                                                ITEM #{idx + 1}
                                            </span>
                                            {materialRows.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveRow(idx)}
                                                    className="text-xs font-bold text-gray-400 hover:text-red-600 transition-colors px-1"
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
                                                    list="material-options"
                                                    value={row.material}
                                                    onChange={(e) => handleRowChange(idx, 'material', e.target.value)}
                                                    required
                                                    placeholder="Type or select material"
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium focus:border-[#A63228] outline-none"
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-1.5">
                                                <div className="col-span-1">
                                                    <label className="block text-[9px] font-bold text-gray-600 mb-1 uppercase">QTY</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={row.quantity}
                                                        onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                                                        required
                                                        placeholder="0"
                                                        className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-xs font-extrabold focus:border-[#A63228] outline-none"
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="block text-[9px] font-bold text-gray-600 mb-1 uppercase">UNIT</label>
                                                    <select
                                                        value={row.unit}
                                                        onChange={(e) => handleRowChange(idx, 'unit', e.target.value)}
                                                        className="w-full bg-white border border-gray-200 rounded-lg pl-1.5 pr-5 py-2 text-xs font-medium focus:border-[#A63228] outline-none appearance-none"
                                                        style={selectStyles}
                                                    >
                                                        <option value="Bags">Bags</option>
                                                        <option value="Pcs">Pcs</option>
                                                        <option value="Cu.m">Cu.m</option>
                                                        <option value="Kgs">Kgs</option>
                                                        <option value="Pails">Pails</option>
                                                        <option value="Gals">Gals</option>
                                                    </select>
                                                </div>
                                                <div className="col-span-1">
                                                    <label className="block text-[9px] font-bold text-gray-600 mb-1 uppercase">PRICE/UNIT</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={row.price}
                                                        onChange={(e) => handleRowChange(idx, 'price', e.target.value)}
                                                        required
                                                        placeholder="₱ 0"
                                                        className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs font-extrabold text-[#A63228] focus:border-[#A63228] outline-none"
                                                    />
                                                </div>
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

                            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-between items-center gap-3">
                                <div>
                                    <span className="block text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">COMPUTED DAILY TOTAL</span>
                                    <span className="text-base font-extrabold text-[#A63228]">
                                        ₱{materialRows.reduce((sum, r) => sum + ((parseFloat(r.quantity || 0) * parseFloat(r.price || 0))), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setModalState('NONE')}
                                        className="px-4 py-2 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-xs font-extrabold hover:bg-red-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-[#8B1A10] text-white rounded-xl text-xs font-extrabold hover:bg-[#72150d] transition-colors shadow-sm"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* LARGE CONFIRM MODAL */}
            {modalState === 'CONFIRM' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-[420px] shadow-2xl relative text-center">
                        <h3 className="text-lg font-extrabold text-[#1a1a1a] mb-1">Confirm Material Usage</h3>
                        <p className="text-xs text-gray-500 mb-4 font-medium">Review the material usage items to record for {todayShort}.</p>

                        <div className="bg-[#f4f1ee] rounded-xl p-4 flex flex-col gap-2 mb-5 border border-[#e5dfd8] max-h-[40vh] overflow-y-auto">
                            {materialRows.filter(r => r.material.trim() !== '').map((r, i) => {
                                const cost = (parseFloat(r.quantity || 0) * parseFloat(r.price || 0));
                                return (
                                    <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-lg text-left shadow-sm">
                                        <div>
                                            <p className="text-xs font-extrabold text-gray-900">{r.material}</p>
                                            <p className="text-[10px] text-gray-500 font-medium">{r.quantity} {r.unit} @ ₱{parseFloat(r.price || 0).toLocaleString()}/{r.unit}</p>
                                        </div>
                                        <span className="text-xs font-extrabold text-[#A63228]">₱{cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                );
                            })}
                            <div className="w-full h-px bg-gray-300 my-1"></div>
                            <div className="flex justify-between items-center font-extrabold text-xs text-gray-900 pt-1">
                                <span>TOTAL COST:</span>
                                <span className="text-sm text-[#A63228]">₱{materialRows.reduce((sum, r) => sum + ((parseFloat(r.quantity || 0) * parseFloat(r.price || 0))), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 mb-5 leading-relaxed px-2">
                            Are you sure you want to record these material usage item(s) to the project log?
                        </p>

                        <div className="flex gap-3">
                            <button onClick={() => setModalState('ADD')} className="flex-1 py-2.5 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-xs font-extrabold hover:bg-red-50 transition-colors">
                                Back to Edit
                            </button>
                            <button onClick={handleConfirmAddBatch} className="flex-1 py-2.5 bg-[#8B1A10] border border-[#8B1A10] text-white rounded-xl text-xs font-extrabold hover:bg-[#72150d] transition-colors shadow-sm">
                                Confirm & Record
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* LARGE SUCCESS MODAL (As requested) */}
            {modalState === 'SUCCESS' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-xl p-6 w-full max-w-[320px] shadow-2xl text-center relative">
                        <div className="w-14 h-14 bg-[#e6f4ea] rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-extrabold text-[#1a1a1a] mb-1">Added Successfully!</h3>
                        <p className="text-xs text-gray-500 font-medium mb-6">Material log has been updated.</p>
                        <button onClick={() => setModalState('NONE')} className="w-full py-3 bg-[#A63228] text-white rounded-lg text-sm font-bold hover:bg-[#8B1A10]">
                            Done
                        </button>
                    </div>
                </div>
            )}

        </AdminLayout>
    )
}
