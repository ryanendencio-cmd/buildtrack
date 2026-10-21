import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import Tesseract from 'tesseract.js'
import { api } from '../api'
import { CONSTRUCTION_MATERIALS, getUnitsForMaterial, getDefaultUnitForMaterial, resolveStandardMaterial } from '../constants/materials'

function SearchableMaterialDropdown({ value, onChange, placeholder, category }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCustomMode, setIsCustomMode] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const query = (value || '').trim().toLowerCase();

    let sourceList = [];
    if (category === 'Manpower') {
        sourceList = [
            'Project Foreman',
            'Lead Carpenter',
            'Master Mason',
            'Steelman / Bar Bender',
            'Certified Welder',
            'Licensed Electrician',
            'Master Plumber',
            'Painter',
            'General Construction Laborer',
            'Site Helper'
        ];
    } else if (category === 'Equipment') {
        sourceList = [
            'Excavator Rental',
            'Backhoe Loader',
            'One-Bagger Concrete Mixer',
            'Tamping Rammer / Compactor',
            'Electric Jackhammer',
            'Mobile Crane Rental',
            'Tubular Scaffolding Set',
            '10-Wheeler Dump Truck',
            'Diesel Generator Set',
            'Inverter Welding Machine',
            'Submersible Water Pump',
            'Diesel Fuel / Gasoline'
        ];
    } else {
        sourceList = CONSTRUCTION_MATERIALS.map(m => m.name);
    }

    const filtered = sourceList.filter(item => {
        if (!query) return true;
        return item.toLowerCase().includes(query);
    }).sort((a, b) => {
        if (!query) return 0;
        const aStarts = a.toLowerCase().startsWith(query);
        const bStarts = b.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
    });

    const isExactMatch = sourceList.some(item => item.toLowerCase() === query);

    const handleSelectCustom = () => {
        setIsCustomMode(true);
        setIsOpen(false);
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                inputRef.current.select();
            }
        }, 50);
    };

    const currentPlaceholder = isCustomMode
        ? (category === 'Manpower' ? 'Type custom worker...' : category === 'Equipment' ? 'Type custom equipment...' : 'Type custom material...')
        : placeholder;

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative flex items-center">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    required
                    placeholder={currentPlaceholder}
                    className="w-full bg-white border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-semibold text-gray-800 placeholder:text-[10px] sm:placeholder:text-[10.5px] placeholder:text-gray-400 placeholder:font-normal focus:border-[#A63228] focus:ring-1 focus:ring-[#A63228]/20 outline-none transition-all shadow-2xs"
                />
                <button
                    type="button"
                    tabIndex="-1"
                    onClick={() => setIsOpen(prev => !prev)}
                    className="absolute right-2 text-gray-400 hover:text-gray-700 p-1 rounded-md"
                    title="Toggle dropdown"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
            </div>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-56 overflow-y-auto z-50 py-1 divide-y divide-gray-50">
                    {filtered.length > 0 ? (
                        filtered.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => {
                                    onChange(item);
                                    setIsCustomMode(false);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-red-50/70 hover:text-[#A63228] transition-colors ${value === item ? 'bg-red-50 text-[#A63228] font-bold' : 'text-gray-700 font-medium'}`}
                            >
                                <span>{item}</span>
                                {query.length > 0 && item.toLowerCase().startsWith(query) && (
                                    <span className="text-[8px] bg-red-100 text-[#A63228] px-1.5 py-0.2 rounded font-extrabold uppercase">Top Match</span>
                                )}
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-xs text-gray-400 italic">
                            No standard item matches "{query}"
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={handleSelectCustom}
                        className="w-full text-left px-3 py-2 text-xs font-bold text-[#A63228] bg-amber-50/50 hover:bg-amber-100/70 flex items-center gap-1.5 transition-colors border-t border-gray-100"
                    >
                        <span>✏️</span>
                        <span>
                            {query && !isExactMatch ? `Use "${value}" as custom item` : 'Other / Type Custom Item...'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}

export default function Expenses() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [todayISO, setTodayISO] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');

    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [viewAllModal, setViewAllModal] = useState(false);

    const [deletedExpenses, setDeletedExpenses] = useState([]);
    const [galleryTab, setGalleryTab] = useState('ACTIVE');
    const [gallerySort, setGallerySort] = useState('date_desc');

    const [receiptModalState, setReceiptModalState] = useState('NONE');
    const [editFormData, setEditFormData] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    // ── MAIN MODAL & CAMERA/SCAN STATES ──
    const [modalState, setModalState] = useState('NONE');
    const [formData, setFormData] = useState({
        project: '',
        receiptNo: '',
        date: '',
        time: '',
        category: 'Materials',
        items: [{ qty: '', unit: 'pcs', description: '', price: '', category: 'Materials' }],
        amount: '',
        cashTendered: '',
        change: ''
    });

    const [photoData, setPhotoData] = useState(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [scanProgress, setScanProgress] = useState('Extracting details...');

    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);

    useEffect(() => {
        const date = new Date();
        const iso = date.toISOString().split('T')[0];
        queueMicrotask(() => {
            setTodayISO(iso);
            setFormData(prev => ({
                ...prev,
                date: iso,
                time: date.toTimeString().split(' ')[0].substring(0, 5)
            }));
        });
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

    const isOngoingStatus = (statusStr) => {
        const s = (statusStr || '').toUpperCase();
        return s === 'ONGOING' || s === 'ACTIVE';
    };
    const isUpcomingStatus = (statusStr) => {
        const s = (statusStr || '').toUpperCase();
        return s === 'UPCOMING' || s === 'STANDBY' || s.includes('UPCOMING') || s.includes('STANDBY');
    };

    const [mockProjects, setMockProjects] = useState([]);

    useEffect(() => {
        api.get('/projects').then(data => {
            setMockProjects(data.map(p => ({
                id: String(p.id),
                name: p.name,
                allocated: Number(p.budget) || 0,
                actual: 0,
                status: p.status || 'ONGOING'
            })));
        }).catch(console.error);
    }, []);

    const activeProject = mockProjects.find(p => isOngoingStatus(p.status)) || mockProjects[0];
    const currentProjectId = id || (activeProject?.id ?? (mockProjects[0]?.id ?? "1"));
    const currentProjectData = mockProjects.find(p => p.id === currentProjectId);
    const currentProjectName = currentProjectData?.name || '';
    const isCurrentProjectOngoing = isOngoingStatus(currentProjectData?.status);
    const isCurrentProjectUpcoming = !isCurrentProjectOngoing;

    const [expensesList, setExpensesList] = useState([]);

    useEffect(() => {
        if (!currentProjectId) return;
        api.get(`/expenses/${currentProjectId}`).then(data => setExpensesList(data)).catch(console.error);
        queueMicrotask(() => {
            setFilterDate('');
            setFormData(prev => ({ ...prev, project: currentProjectName }));
        });
    }, [currentProjectId, mockProjects, currentProjectName]);

    const MAX_AMOUNT = 999999999999;
    const [amountError, setAmountError] = useState('');

    // ── GENERAL ADD/EDIT HANDLERS ──
    const handleInputChange = (e, isEdit = false) => {
        const { name, value } = e.target;
        if (name === 'project') {
            const matched = mockProjects.find(p => p.name === value);
            if (matched && !isOngoingStatus(matched?.status)) {
                alert(`Bawal mag-add ng expenses sa proyektong hindi Ongoing ("${matched.name}").`);
                return;
            }
        }
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
        if (name === 'category') {
            const defaultUnit = value === 'Manpower' ? 'day/s' : value === 'Equipment' ? 'day/s' : 'pcs';
            if (isEdit) {
                setEditFormData(prev => ({
                    ...prev,
                    [name]: value,
                    items: prev.items ? prev.items.map(item => ({
                        ...item,
                        category: value,
                        unit: (item.description === '' && item.price === '') || !item.unit || item.unit === 'pcs' || item.unit === 'day/s' ? defaultUnit : item.unit
                    })) : []
                }));
            } else {
                setFormData(prev => ({
                    ...prev,
                    [name]: value,
                    items: prev.items.map(item => {
                        // Preserve items that already have a description entered so changing category doesn't overwrite them
                        if (item.description && item.description.trim() !== '') {
                            return item;
                        }
                        return {
                            ...item,
                            category: value,
                            unit: defaultUnit
                        };
                    })
                }));
            }
            return;
        }

        if (isEdit) {
            setEditFormData(prev => ({ ...prev, [name]: value }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleItemCategoryChange = (index, newCategory) => {
        const newItems = [...formData.items];
        const current = newItems[index];
        const defaultUnit = newCategory === 'Manpower' ? 'day/s' : newCategory === 'Equipment' ? 'day/s' : 'pcs';

        let unit = current.unit;
        if (newCategory === 'Manpower' && unit !== 'day/s' && unit !== 'hr/s') {
            unit = 'day/s';
        } else if (newCategory === 'Equipment' && !['day/s', 'hr/s', 'month/s', 'unit/s', 'liter/s'].includes(unit)) {
            unit = 'day/s';
        } else if (newCategory === 'Materials' && (unit === 'day/s' || unit === 'hr/s')) {
            const matUnits = getUnitsForMaterial(current.description);
            unit = matUnits[0] || 'pcs';
        }

        newItems[index] = {
            ...current,
            category: newCategory,
            unit
        };
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const getItemUnits = (item) => {
        const cat = item.category || formData.category || 'Materials';
        if (cat === 'Manpower') {
            return ['day/s', 'hr/s', 'pax', 'month/s', 'lot/s'];
        }
        if (cat === 'Equipment') {
            return ['day/s', 'hr/s', 'month/s', 'unit/s', 'liter/s', 'lot/s'];
        }
        return getUnitsForMaterial(item.description);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        const currentItem = { ...newItems[index], [field]: value };
        const itemCat = currentItem.category || formData.category || 'Materials';
        if (field === 'description') {
            if (itemCat === 'Materials') {
                if (value && value.trim()) {
                    currentItem.unit = getDefaultUnitForMaterial(value);
                } else {
                    currentItem.unit = 'pcs';
                }
            } else if (itemCat === 'Manpower') {
                if (!['day/s', 'hr/s', 'pax', 'month/s', 'lot/s'].includes(currentItem.unit)) {
                    currentItem.unit = 'day/s';
                }
            } else if (itemCat === 'Equipment') {
                if (!['day/s', 'hr/s', 'month/s', 'unit/s', 'liter/s', 'lot/s'].includes(currentItem.unit)) {
                    currentItem.unit = 'day/s';
                }
            }
        }
        newItems[index] = currentItem;
        setFormData({ ...formData, items: newItems });
    };

    const addNewItem = () => {
        const lastItem = formData.items[formData.items.length - 1];
        const currentCat = lastItem?.category || formData.category || 'Materials';
        const defaultUnit = currentCat === 'Manpower' ? 'day/s' : currentCat === 'Equipment' ? 'day/s' : 'pcs';
        setFormData(prev => ({
            ...prev,
            items: [
                ...prev.items,
                { qty: '', unit: defaultUnit, description: '', price: '', category: currentCat }
            ]
        }));
    };
    const removeItem = (index) => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });

    const computedTotal = formData.items.reduce((sum, item) => {
        const q = parseFloat(item.qty) || 0;
        const p = parseFloat(item.price) || 0;
        return sum + q * p;
    }, 0);

    const handleProjectChange = (e) => navigate(`/expenses/${e.target.value}`);

    const handleInitialSubmit = (e) => {
        e.preventDefault();
        const selectedProj = mockProjects.find(p => p.name === formData.project || p.id === String(currentProjectId));
        if (selectedProj && !isOngoingStatus(selectedProj?.status)) {
            setAmountError(`Bawal mag-add ng expenses sa proyektong hindi Ongoing ("${selectedProj?.name || 'Project'}"). Dapat ay ONGOING ang status nito.`);
            return;
        }
        const amt = computedTotal;
        if (amt > MAX_AMOUNT) {
            setAmountError('Total amount cannot exceed ₱999,999,999,999.');
            return;
        }
        if (amt <= 0) {
            setAmountError('Please add at least one item with quantity and unit price.');
            return;
        }
        const hasInvalidItem = formData.items.some(it => {
            return !it.description?.trim() || !parseFloat(it.qty) || !parseFloat(it.price);
        });
        if (hasInvalidItem) {
            setAmountError('Please make sure each item has a name/description, quantity, and unit price.');
            return;
        }
        if (!photoData) {
            setAmountError('Kailangang mag-upload ng katibayan o litrato ng resibo bago mai-save ang gastusin (Receipt upload is REQUIRED).');
            return;
        }
        setAmountError('');
        // Sync computed total into formData.amount before going to CONFIRM
        const resolvedItems = formData.items.map(it => ({
            ...it,
            category: it.category || 'Materials',
            description: it.description?.trim() || ''
        }));
        const cats = [...new Set(resolvedItems.map(it => it.category))];
        const primaryCategory = cats.length === 1 ? cats[0] : (cats[0] || 'Materials');
        setFormData(prev => ({ ...prev, amount: String(amt), items: resolvedItems, category: primaryCategory }));
        setModalState('CONFIRM');
    };

    const handleConfirmAdd = () => {
        const proj = mockProjects.find(p => p.id === String(currentProjectId) || p.name === formData.project);
        if (proj && !isOngoingStatus(proj?.status)) {
            alert(`Bawal mag-add ng expenses sa proyektong hindi Ongoing ("${proj?.name || 'Project'}"). Dapat ay ONGOING ang status nito.`);
            return;
        }
        const resolvedItems = formData.items.map(it => ({
            ...it,
            category: it.category || formData.category || 'Materials',
            description: it.description?.trim() || ''
        }));
        const cats = [...new Set(resolvedItems.map(it => it.category))];
        const primaryCategory = cats.length === 1 ? cats[0] : (formData.category || 'Materials');

        const payload = {
            project_id: currentProjectId,
            project: proj?.name || '',
            category: primaryCategory,
            amount: parseFloat(formData.amount || 0),
            receipt_no: formData.receiptNo || '',
            date: formData.date,
            time: formData.time,
            items: resolvedItems,
            cash_tendered: parseFloat(formData.cashTendered || formData.amount || 0),
            change: parseFloat(formData.change || 0),
            image: photoData || null
        };
        api.post('/expenses', payload).then(newExpense => {
            setExpensesList(prev => [newExpense, ...prev]);
            setModalState('SUCCESS');
        }).catch(err => {
            console.error(err);
            alert(err.message || err.error || 'Failed to save expense. Make sure the server is running.');
        });
    };

    const handleScanDetailsSubmit = (e) => {
        e.preventDefault();
        const selectedProj = mockProjects.find(p => p.name === formData.project || p.id === String(currentProjectId));
        if (selectedProj && !isOngoingStatus(selectedProj?.status)) {
            setAmountError(`Bawal mag-add ng expenses sa proyektong hindi Ongoing ("${selectedProj?.name || 'Project'}"). Dapat ay ONGOING ang status nito.`);
            return;
        }
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
        if (!photoData) {
            setAmountError('Kailangang may kalakip na litrato o scan ng resibo bago mai-save ang gastusin (Receipt upload is REQUIRED).');
            return;
        }
        setAmountError('');
        setModalState('SCAN_CONFIRM');
    };
    const handleScanConfirmAdd = () => handleConfirmAdd(); // Reuse confirm add logic

    // ── OCR LOGIC ──
    const handleStartScanning = async () => {
        setModalState('SCANNING');
        try {
            const result = await Tesseract.recognize(photoData, 'eng', {
                logger: (m) => { if (m.status === 'recognizing text') setScanProgress(`Reading text... ${Math.round(m.progress * 100)}%`); }
            });

            const safeText = result.data.text.replace(/Cashier.*$/mi, '');
            const extractMoney = (keywords) => {
                const match = safeText.match(new RegExp(`\\b(?:${keywords})\\b[^\\d]*([\\d,]+\\.\\d{2})`, 'i'));
                return match ? match[1].replace(/,/g, '') : '';
            };

            let parsedAmount = extractMoney('TOTAL AMOUNT|TOTAL');
            let parsedCash = extractMoney('CASH PAID|CASH|PAID|TENDERED');
            let parsedChange = extractMoney('CHANGE');
            if (parseFloat(parsedAmount) > MAX_AMOUNT) parsedAmount = '';
            if (parseFloat(parsedCash) > MAX_AMOUNT) parsedCash = '';
            if (parseFloat(parsedChange) > MAX_AMOUNT) parsedChange = '';

            let parsedDate = todayISO;
            const dateMatch = safeText.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i);
            if (dateMatch) {
                const d = new Date(dateMatch[0]);
                if (!isNaN(d)) parsedDate = d.toISOString().split('T')[0];
            }

            const receiptMatch = safeText.match(/(?:Receipt No|OR#?)[^\d]*(\d+)/i);
            const parsedReceiptNo = receiptMatch ? receiptMatch[1] : '';

            let parsedTime = '';
            const timeMatch = safeText.match(/Time[^\d]*(\d{1,2})[:.;](\d{2})\s*([AP]M)/i);
            if (timeMatch) {
                let hrs = parseInt(timeMatch[1]);
                if (timeMatch[3].toUpperCase() === 'PM' && hrs < 12) hrs += 12;
                if (timeMatch[3].toUpperCase() === 'AM' && hrs === 12) hrs = 0;
                parsedTime = `${hrs.toString().padStart(2, '0')}:${timeMatch[2]}`;
            }

            let parsedItems = [];
            let match;
            const itemRegex = /\b(\d+)\s+([A-Za-z\s]+?)\s+@/g;
            while ((match = itemRegex.exec(safeText)) !== null) parsedItems.push({ qty: match[1], description: match[2].trim() });
            if (parsedItems.length === 0) parsedItems = [{ qty: '', description: 'Scanned Item' }];

            setFormData(prev => ({
                ...prev, receiptNo: parsedReceiptNo, amount: parsedAmount, date: parsedDate, time: parsedTime,
                items: parsedItems, cashTendered: parsedCash, change: parsedChange, category: 'Materials'
            }));

            setModalState('SCAN_DETAILS');
        } catch (error) {
            console.error("OCR Error:", error);
            setScanProgress('Failed to read image clearly. Please enter manually.');
            setTimeout(() => setModalState('SCAN_DETAILS'), 2000);
        }
    };

    // ── CAMERA HANDLERS ──
    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);
            setIsCameraOn(true);
        } catch (err) {
            console.error("Error accessing camera", err);
            alert("Camera access denied or unavailable.");
        }
    };

    const stopCamera = () => {
        if (stream) stream.getTracks().forEach(track => track.stop());
        setStream(null);
        if (videoRef.current) videoRef.current.srcObject = null;
        setIsCameraOn(false);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { setPhotoData(reader.result); setModalState('SCAN_REVIEW'); };
            reader.readAsDataURL(file);
        }
    };

    const handleManualFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { setPhotoData(reader.result); };
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
            project: currentProjectData?.name, receiptNo: '', date: todayISO, time: '08:00', category: 'Materials', items: [{ qty: '', unit: 'pcs', description: '', price: '', category: 'Materials' }], amount: '', cashTendered: '', change: ''
        });
    };

    // ── RECEIPT VIEWER LOGIC ──
    const openReceiptViewer = (exp) => {
        setSelectedReceipt({
            ...exp,
            cashPaid: exp.cash_tendered ?? exp.cashPaid,
            cashChange: exp.change ?? exp.cashChange
        });
        setReceiptModalState('VIEW');
    };
    const handleEditClick = () => {
        setAmountError('');
        setEditFormData({
            ...selectedReceipt,
            desc: getExpenseDescription(selectedReceipt),
            date: normalizeDate(selectedReceipt.date)
        });
        setReceiptModalState('EDIT');
    };
    const handleDeleteClick = () => { setReceiptModalState('CONFIRM_DELETE'); };

    const confirmEditSave = () => {
        const amt = parseFloat(editFormData.amount || 0);
        if (amt > MAX_AMOUNT) {
            alert('Expense amount cannot exceed ₱999,999,999,999.');
            return;
        }
        if (amt <= 0) {
            alert('Please enter a valid expense amount.');
            return;
        }
        const paid = parseFloat(editFormData.cashPaid || editFormData.amount || 0);
        if (paid > MAX_AMOUNT) {
            alert('Cash paid cannot exceed ₱999,999,999,999.');
            return;
        }
        const updatedExp = {
            ...editFormData,
            amount: amt,
            cashPaid: paid,
            cashChange: paid - amt,
            cash_tendered: paid,
            change: paid - amt,
            date: normalizeDate(editFormData.date),
            items: [{ qty: editFormData.qty || '1', description: editFormData.desc }]
        };
        api.put(`/expenses/${updatedExp.id}`, updatedExp).catch(console.error);
        setExpensesList(expensesList.map(exp => exp.id === updatedExp.id ? updatedExp : exp));
        setSelectedReceipt(updatedExp);
        setSuccessMessage('Receipt details updated successfully.');
        setReceiptModalState('SUCCESS_ACTION');
    };

    const confirmDelete = () => {
        if (selectedReceipt?.id) {
            api.delete(`/expenses/${selectedReceipt.id}`).catch(console.error);
        }
        setDeletedExpenses([selectedReceipt, ...deletedExpenses]);
        setExpensesList(expensesList.filter(exp => exp.id !== selectedReceipt.id));
        setSuccessMessage('Receipt moved to trash.');
        setReceiptModalState('SUCCESS_ACTION');
    };

    const confirmRestore = () => {
        if (selectedReceipt) {
            const restoredPayload = {
                ...selectedReceipt,
                id: undefined,
                project_id: selectedReceipt.project_id || currentProjectId
            };
            delete restoredPayload.id;
            api.post('/expenses', restoredPayload).then(newExp => {
                setExpensesList(prev => [newExp, ...prev.filter(exp => exp.id !== selectedReceipt.id)]);
            }).catch(console.error);
        }
        setDeletedExpenses(deletedExpenses.filter(item => item.id !== selectedReceipt.id));
        setSuccessMessage('Receipt restored successfully.');
        setReceiptModalState('SUCCESS_ACTION');
    };

    const confirmPermDelete = () => {
        setDeletedExpenses(deletedExpenses.filter(item => item.id !== selectedReceipt.id));
        setSuccessMessage('Receipt permanently deleted.');
        setReceiptModalState('SUCCESS_ACTION');
    };

    const normalizeDate = (rawDate) => {
        if (!rawDate) return '';
        if (typeof rawDate === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) return rawDate.trim();
            if (rawDate.includes('T')) {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    return `${y}-${m}-${day}`;
                }
            }
            const match = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
            if (match) return match[1];
        }
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
        return String(rawDate).slice(0, 10);
    };

    const formatDisplayDate = (dateVal) => {
        if (!dateVal) return '';
        const norm = normalizeDate(dateVal);
        const parts = norm.split('-');
        if (parts.length === 3) {
            const [y, m, d] = parts;
            const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
            return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        return norm;
    };

    const getExpenseDescription = (exp) => {
        if (!exp) return '';
        if (exp.desc) return exp.desc;
        if (exp.items) {
            let itemsArr = exp.items;
            if (typeof itemsArr === 'string') {
                try { itemsArr = JSON.parse(itemsArr); } catch { itemsArr = []; }
            }
            if (Array.isArray(itemsArr) && itemsArr.length > 0) {
                const descs = itemsArr.map(it => it.description || it.desc || '').filter(Boolean);
                if (descs.length > 0) return descs.join(', ');
            }
        }
        return exp.category || 'General Expense';
    };

    const getExpenseItems = (exp) => {
        if (!exp) return [];
        let items = exp.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch { items = []; }
        }
        if (Array.isArray(items) && items.length > 0) return items;
        if (exp.desc || exp.qty) {
            return [{ qty: exp.qty || '1', unit: exp.unit || '', description: exp.desc, price: exp.price || exp.amount || 0 }];
        }
        return [];
    };

    const getReceiptNumber = (exp) => {
        if (!exp) return '';
        return exp.receipt_no || exp.receiptId || `#${String(exp.id || '').padStart(4, '0')}`;
    };

    const getReceiptImage = (exp) => {
        if (!exp) return null;
        return exp.image || exp.photoData || exp.receipt_image || exp.image_url || exp.receiptImage || null;
    };

    const formatTime = (time24) => {
        if (!time24) return '';
        const parts = String(time24).split(':');
        if (parts.length < 2) return time24;
        const hour = parseInt(parts[0], 10);
        const m = parts[1];
        return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
    };

    const getSortedReceipts = (list) => {
        return [...list].sort((a, b) => {
            if (gallerySort === 'date_desc') return new Date(b.date) - new Date(a.date) || b.id - a.id;
            if (gallerySort === 'date_asc') return new Date(a.date) - new Date(b.date) || a.id - b.id;
            const aNum = getReceiptNumber(a);
            const bNum = getReceiptNumber(b);
            if (gallerySort === 'receipt_asc') return aNum.localeCompare(bNum);
            if (gallerySort === 'receipt_desc') return bNum.localeCompare(aNum);
            return 0;
        });
    };

    const displayedExpenses = expensesList.filter(exp => {
        const matchDate = !filterDate || normalizeDate(exp.date) === filterDate;
        const matchCategory = filterCategory === 'All' || (exp.category || '').toLowerCase() === filterCategory.toLowerCase();
        return matchDate && matchCategory;
    });
    const allocatedBudget = currentProjectData?.allocated || 0;
    const totalActualExpense = expensesList.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const remainingBudget = allocatedBudget - totalActualExpense;
    const overallProgress = allocatedBudget > 0 ? Math.min((totalActualExpense / allocatedBudget) * 100, 100) : 0;

    const tableTotal = displayedExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const matTotal = expensesList.filter(e => e.category === 'Materials').reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const manTotal = expensesList.filter(e => e.category === 'Manpower').reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const eqpTotal = expensesList.filter(e => (e.category || '').toLowerCase().includes('equipment')).reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const selectStyles = { backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '0.8rem 0.8rem' };

    return (
        <AdminLayout>
            {!viewAllModal ? (
                <>
                    <div className="mb-1.5">
                        <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">EXPENSES MANAGEMENT</span>
                        <h1 className="text-lg font-extrabold text-gray-900 mt-0.5 tracking-tight">Expenses Management</h1>
                        <p className="text-[10px] text-gray-500 mt-0.5">Track and manage daily project expenses.</p>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-3 gap-3">
                        <div className="w-full md:max-w-sm">
                            <label className="block text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-1">PROJECT</label>
                            <select value={currentProjectId} onChange={handleProjectChange} className="w-full bg-white border border-gray-100 shadow-sm rounded-lg pl-2.5 pr-6 py-1.5 text-[10px] font-extrabold text-gray-800 outline-none appearance-none" style={selectStyles}>
                                {mockProjects.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} {!isOngoingStatus(p.status) ? `— (${(p.status || 'Not Ongoing').toUpperCase()})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={() => {
                                    if (isCurrentProjectUpcoming) return;
                                    setModalState('ADD');
                                }}
                                disabled={isCurrentProjectUpcoming}
                                title={!isCurrentProjectOngoing ? `Bawal mag-add ng expenses: Ang proyektong ito ay ${currentProjectData?.status || 'hindi Ongoing'}.` : "Add Expense"}
                                className={isCurrentProjectUpcoming
                                    ? "bg-gray-100 text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm cursor-not-allowed opacity-75 flex items-center justify-center gap-1 flex-1 md:flex-none"
                                    : "bg-[#E8C547] text-gray-900 px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm hover:bg-[#d4b33d] transition-colors flex items-center justify-center gap-1 flex-1 md:flex-none"
                                }
                            >
                                <span>+</span> Add Expense
                            </button>
                            <button
                                onClick={() => {
                                    if (isCurrentProjectUpcoming) return;
                                    setModalState('SCAN_START');
                                    setPhotoData(null);
                                }}
                                disabled={isCurrentProjectUpcoming}
                                title={!isCurrentProjectOngoing ? `Bawal mag-scan ng resibo: Ang proyektong ito ay ${currentProjectData?.status || 'hindi Ongoing'}.` : "Scan Receipt"}
                                className={isCurrentProjectUpcoming
                                    ? "bg-gray-100 text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm cursor-not-allowed opacity-75 flex-1 md:flex-none"
                                    : "bg-white border border-[#A63228] text-[#A63228] px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm hover:bg-red-50 transition-colors flex-1 md:flex-none"
                                }
                            >
                                Scan Receipt
                            </button>
                        </div>
                    </div>

                    {!isCurrentProjectOngoing && (
                        <div className="bg-[#fffbeb] border border-[#fde68a] text-[#92400e] px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2.5 mb-3 shadow-xs">
                            <svg className="w-4 h-4 text-[#d97706] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div className="flex-1">
                                <span className="font-extrabold uppercase text-[9px] tracking-wider text-[#b45309] mr-1.5">{(currentProjectData?.status || 'HINDI ONGOING').toUpperCase()} PROJECT:</span>
                                <span className="text-[10px] font-medium text-amber-900">
                                    Ang proyektong ito ay may status na <strong>{(currentProjectData?.status || 'Hindi Ongoing').toUpperCase()}</strong>. Bawal magdagdag o mag-scan ng gastusin (expenses) hangga't hindi ito naka-set sa <strong>ONGOING</strong>.
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                        <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                            <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase mb-0.5">ACTUAL EXPENSES</span>
                            <h2 className="text-xl font-extrabold text-[#A63228]">₱{totalActualExpense.toLocaleString()}</h2>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                            <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase mb-0.5">REMAINING BUDGET</span>
                            <h2 className={`text-xl font-extrabold ${remainingBudget < 0 ? 'text-[#A63228]' : 'text-[#2e7d32]'}`}>
                                {remainingBudget < 0 ? `-₱${Math.abs(remainingBudget).toLocaleString()}` : `₱${remainingBudget.toLocaleString()}`}
                            </h2>
                        </div>
                        <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                            <span className="text-[9px] font-bold text-gray-400 tracking-wider uppercase mb-0.5">ALLOCATED BUDGET</span>
                            <h2 className="text-xl font-extrabold text-gray-900">₱{allocatedBudget.toLocaleString()}</h2>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-[#5a0f0a] via-[#7B1F16] to-[#4a0c08] rounded-xl shadow-sm p-4 text-white mb-3">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-[9px] font-extrabold tracking-widest uppercase text-white/70">EXPENSES VS BUDGET</h3>
                            <span className="text-[9px] text-white/70 font-bold uppercase tracking-wider">{overallProgress.toFixed(0)}% USED</span>
                        </div>

                        <div className="flex flex-col gap-2.5 mb-3">
                            <div>
                                <div className="flex justify-between text-[10px] mb-1">
                                    <span className="font-medium text-white/90">Recent Materials</span>
                                    <span className="font-bold">₱{matTotal.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-white/20 rounded-full h-1 overflow-hidden"><div className="bg-[#E8C547] h-full rounded-full" style={{ width: `${Math.min((matTotal / (tableTotal || 1)) * 100, 100)}%` }}></div></div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] mb-1">
                                    <span className="font-medium text-white/90">Recent Manpower</span>
                                    <span className="font-bold">₱{manTotal.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-white/20 rounded-full h-1 overflow-hidden"><div className="bg-[#E8C547] h-full rounded-full" style={{ width: `${Math.min((manTotal / (tableTotal || 1)) * 100, 100)}%` }}></div></div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] mb-1">
                                    <span className="font-medium text-white/90">Recent Equipment</span>
                                    <span className="font-bold">₱{eqpTotal.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-white/20 rounded-full h-1 overflow-hidden"><div className="bg-[#E8C547] h-full rounded-full" style={{ width: `${Math.min((eqpTotal / (tableTotal || 1)) * 100, 100)}%` }}></div></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-3">
                        <div className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-[10px] font-extrabold text-gray-900 tracking-wide uppercase">Daily Expenses</h3>
                                <span className="bg-gray-100 text-gray-600 text-[8px] font-bold px-1.5 py-0.5 rounded">
                                    {filterDate ? `${displayedExpenses.length} filtered` : `${expensesList.length} total`}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {(filterDate || filterCategory !== 'All') && (
                                    <button
                                        type="button"
                                        onClick={() => { setFilterDate(''); setFilterCategory('All'); }}
                                        className="text-[9px] text-[#A63228] font-bold hover:underline cursor-pointer flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                                        title="Clear filters to view all saved expenses"
                                    >
                                        <span>✕</span> Clear Filters
                                    </button>
                                )}
                                <div className="flex items-center gap-1">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase">Category:</label>
                                    <select
                                        value={filterCategory}
                                        onChange={(e) => setFilterCategory(e.target.value)}
                                        className={`bg-[#f4f1ee] px-2 py-1 rounded-md text-[9px] font-bold outline-none border transition-colors cursor-pointer ${filterCategory !== 'All' ? 'border-[#A63228] text-[#A63228] font-extrabold shadow-sm' : 'border-transparent text-gray-700'}`}
                                    >
                                        <option value="All">All Categories</option>
                                        <option value="Materials">Materials</option>
                                        <option value="Manpower">Manpower</option>
                                        <option value="Equipment">Equipment</option>
                                        <option value="Fuel">Fuel</option>
                                        <option value="Food/Meals">Food/Meals</option>
                                        <option value="Others">Others</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-1">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase">Date:</label>
                                    <input
                                        type="date"
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                        className={`bg-[#f4f1ee] px-2.5 py-1 rounded-md text-[9px] font-bold outline-none border transition-colors cursor-pointer ${filterDate ? 'border-[#A63228] text-[#A63228] font-extrabold shadow-sm' : 'border-transparent text-gray-700'}`}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[500px]">
                                <thead>
                                    <tr>
                                        <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[15%] uppercase tracking-wider">DATE</th>
                                        <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[20%] uppercase tracking-wider">CATEGORY</th>
                                        <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[45%] uppercase tracking-wider">DESCRIPTION</th>
                                        <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 text-right pr-2 w-[20%] uppercase tracking-wider">AMOUNT</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedExpenses.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="text-center py-6 text-[10px] text-gray-400 italic">
                                                {filterDate ? (
                                                    <div className="flex flex-col items-center justify-center gap-1">
                                                        <span>No expenses recorded for <strong>{formatDisplayDate(filterDate)}</strong>.</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFilterDate('')}
                                                            className="text-[9px] text-[#A63228] font-bold underline hover:text-[#8B1A10] cursor-pointer"
                                                        >
                                                            Clear filter to view all saved expenses ({expensesList.length})
                                                        </button>
                                                    </div>
                                                ) : (
                                                    'No expenses recorded for this project.'
                                                )}
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedExpenses.map((exp) => (
                                            <tr key={exp.id} className="hover:bg-gray-50/60 transition-colors">
                                                <td className="py-2.5 text-[10px] font-bold text-gray-800 border-b border-gray-50">{formatDisplayDate(exp.date)}</td>
                                                <td className="py-2.5 border-b border-gray-50"><span className="text-[9px] font-bold text-gray-900 uppercase tracking-wider">{exp.category}</span></td>
                                                <td className="py-2.5 text-[10px] font-medium text-gray-600 border-b border-gray-50">{getExpenseDescription(exp)}</td>
                                                <td className="py-2.5 text-[10px] font-extrabold text-[#A63228] border-b border-gray-50 text-right pr-2">₱{Number(exp.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100 text-[10px]">
                            <span className="font-extrabold text-gray-600 uppercase tracking-wider">
                                {filterDate ? `TOTAL EXPENSES FOR ${formatDisplayDate(filterDate)}` : `TOTAL EXPENSES (${displayedExpenses.length} RECORD${displayedExpenses.length === 1 ? '' : 'S'})`}
                            </span>
                            <strong className="font-extrabold text-[#A63228] text-xs">
                                ₱{tableTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </strong>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-[11px] font-extrabold text-gray-900 uppercase">Receipts</h3>
                            <button onClick={() => setViewAllModal(true)} className="text-[9px] text-[#A63228] font-bold hover:underline">View All →</button>
                        </div>

                        {displayedExpenses.length === 0 ? (
                            <p className="text-[10px] text-gray-400 italic">No receipts available{filterDate ? ` for ${formatDisplayDate(filterDate)}` : ''}.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {displayedExpenses.map(exp => {
                                    const receiptImg = getReceiptImage(exp);
                                    return (
                                        <div key={exp.id} onClick={() => openReceiptViewer(exp)} className="bg-[#f9fafb] p-2.5 rounded-xl border border-gray-100 flex flex-col cursor-pointer hover:border-[#A63228] hover:shadow-md transition-all group">
                                            {receiptImg ? (
                                                <div className="relative w-full h-28 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-xs mb-2 flex items-center justify-center group-hover:border-[#A63228] transition-all">
                                                    <img
                                                        src={receiptImg}
                                                        alt={`Receipt ${getReceiptNumber(exp)}`}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        loading="lazy"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                                                        <span className="text-[8px] font-bold text-white bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                            View Receipt
                                                        </span>
                                                        <span className="text-[8px] font-extrabold text-white/90 uppercase tracking-wider">
                                                            {exp.category}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-24 w-full bg-white rounded-lg flex flex-col items-center justify-center text-gray-300 border border-dashed border-gray-200 shadow-xs mb-2 group-hover:bg-red-50/50 group-hover:border-red-200 transition-colors">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                                    <span className="text-[8px] font-semibold text-gray-400 mt-1">No Receipt Image</span>
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <p className="text-[10px] font-extrabold text-gray-900 mb-0.5">Receipt {getReceiptNumber(exp)}</p>
                                                <p className="text-[9px] text-gray-500 font-medium">{exp.category} · {formatDisplayDate(exp.date)}</p>
                                            </div>
                                            <p className="text-xs font-extrabold text-[#A63228] mt-1.5">₱{Number(exp.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                // ── VIEW ALL RECEIPTS GALLERY ──
                <div className="animate-fade-in flex flex-col">
                    <button onClick={() => { setViewAllModal(false); setGalleryTab('ACTIVE'); }} className="text-gray-500 hover:text-[#A63228] text-xs font-bold flex items-center gap-1 transition-colors w-fit mb-3">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Back to Expenses
                    </button>

                    <div className="mb-4 flex flex-col md:flex-row md:items-end justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-extrabold text-gray-900">All Receipts Gallery</h2>
                            <p className="text-[10px] text-gray-500 mt-0.5">Showing records for {currentProjectData?.name}</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                            <select
                                value={gallerySort}
                                onChange={(e) => setGallerySort(e.target.value)}
                                className="bg-white border border-gray-200 text-gray-700 pl-3 pr-8 py-1.5 rounded-lg text-[10px] font-bold outline-none appearance-none cursor-pointer focus:border-[#A63228] shadow-sm"
                                style={selectStyles}
                            >
                                <option value="date_desc">Sort by Date (Newest First)</option>
                                <option value="date_asc">Sort by Date (Oldest First)</option>
                                <option value="receipt_asc">Receipt No. (A-Z)</option>
                                <option value="receipt_desc">Receipt No. (Z-A)</option>
                            </select>

                            <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
                                <button
                                    onClick={() => setGalleryTab('ACTIVE')}
                                    className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-colors ${galleryTab === 'ACTIVE' ? 'bg-white text-[#A63228] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    Active ({expensesList.length})
                                </button>
                                <button
                                    onClick={() => setGalleryTab('DELETED')}
                                    className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-colors ${galleryTab === 'DELETED' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    Trash ({deletedExpenses.length})
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 min-h-[50vh]">
                        {/* ACTIVE TAB */}
                        {galleryTab === 'ACTIVE' && (
                            <>
                                {expensesList.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic text-center py-10">No active receipts available.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {getSortedReceipts(expensesList).map(exp => {
                                            const receiptImg = getReceiptImage(exp);
                                            return (
                                                <div key={exp.id} onClick={() => openReceiptViewer(exp)} className="bg-[#f9fafb] p-3 rounded-xl border border-gray-200 flex flex-col cursor-pointer hover:border-[#A63228] hover:shadow-md transition-all group">
                                                    {receiptImg ? (
                                                        <div className="h-32 w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-xs mb-3 relative flex items-center justify-center group-hover:border-[#A63228] transition-colors">
                                                            <img
                                                                src={receiptImg}
                                                                alt={`Receipt ${getReceiptNumber(exp)}`}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                loading="lazy"
                                                            />
                                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                                                                <span className="text-[8px] font-bold text-white bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs flex items-center gap-1">
                                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                                                    View Receipt
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="h-28 w-full bg-white rounded-lg flex flex-col items-center justify-center text-gray-300 border border-dashed border-gray-200 shadow-xs mb-3 group-hover:bg-red-50/50 group-hover:border-red-200 transition-colors">
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                                            <span className="text-[8px] font-semibold text-gray-400 mt-1">No Receipt Image</span>
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <p className="text-xs font-extrabold text-gray-900">Receipt {getReceiptNumber(exp)}</p>
                                                            <span className="bg-[#fce8e6] text-[#A63228] text-[8px] font-extrabold px-1.5 py-0.5 rounded tracking-wider">{formatDisplayDate(exp.date)}</span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 font-medium uppercase">{exp.category}</p>
                                                    </div>
                                                    <p className="text-sm font-extrabold text-[#A63228] mt-2">₱{Number(exp.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* DELETED TAB (TRASH) */}
                        {galleryTab === 'DELETED' && (
                            <>
                                {deletedExpenses.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic text-center py-10">Trash is empty.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {getSortedReceipts(deletedExpenses).map(exp => {
                                            const receiptImg = getReceiptImage(exp);
                                            return (
                                                <div key={exp.id} className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col relative overflow-hidden group">
                                                    <div className="absolute top-2 right-2 bg-red-100 text-red-600 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase z-10">Deleted</div>
                                                    {receiptImg ? (
                                                        <div className="h-28 w-full bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-xs mb-2 relative flex items-center justify-center opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-90 transition-all">
                                                            <img
                                                                src={receiptImg}
                                                                alt={`Receipt ${getReceiptNumber(exp)}`}
                                                                className="w-full h-full object-cover"
                                                                loading="lazy"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="h-20 bg-white rounded-lg flex items-center justify-center text-gray-300 border border-gray-200 shadow-sm mb-2 opacity-60">
                                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                                        </div>
                                                    )}
                                                    <div className="flex-1 opacity-70">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <p className="text-xs font-extrabold text-gray-600">Receipt {getReceiptNumber(exp)}</p>
                                                            <span className="bg-gray-200 text-gray-500 text-[8px] font-extrabold px-1.5 py-0.5 rounded tracking-wider">{formatDisplayDate(exp.date)}</span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 font-medium uppercase">{exp.category}</p>
                                                    </div>
                                                    <p className="text-sm font-extrabold text-gray-500 mt-1.5 mb-3 line-through">₱{Number(exp.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>

                                                    <div className="flex gap-1.5 mt-auto pt-2 border-t border-gray-200">
                                                        <button onClick={(e) => { e.stopPropagation(); setSelectedReceipt(exp); setReceiptModalState('CONFIRM_RESTORE'); }} className="flex-1 py-1.5 bg-[#e6f4ea] text-[#2e7d32] rounded border border-[#c8e6c9] text-[9px] font-bold hover:bg-[#c8e6c9] transition-colors">
                                                            Restore
                                                        </button>
                                                        <button onClick={(e) => { e.stopPropagation(); setSelectedReceipt(exp); setReceiptModalState('CONFIRM_PERM_DELETE'); }} className="flex-1 py-1.5 bg-[#fce8e6] text-[#A63228] rounded border border-[#fce8e6] text-[9px] font-bold hover:bg-red-100 transition-colors">
                                                            Perm. Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ═════════ RECEIPT VIEWER / EDIT MODALS ═════════ */}

            {receiptModalState !== 'NONE' && selectedReceipt && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 transition-all">

                    {/* --- VIEW MODE --- */}
                    {receiptModalState === 'VIEW' && (
                        <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl relative flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center p-3 border-b border-gray-100 bg-gray-50">
                                <div>
                                    <h3 className="text-[11px] font-extrabold text-[#1a1a1a]">Receipt Details</h3>
                                    <p className="text-[9px] text-gray-500 font-medium">Receipt {getReceiptNumber(selectedReceipt)}</p>
                                </div>
                                <button onClick={() => setReceiptModalState('NONE')} className="text-gray-400 hover:text-[#A63228] transition-colors p-1 bg-white rounded-full shadow-sm">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="p-3 flex flex-col gap-3">
                                {selectedReceipt.image || selectedReceipt.photoData ? (
                                    <div className="w-full h-44 bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200 shadow-inner group relative">
                                        <img
                                            src={selectedReceipt.image || selectedReceipt.photoData}
                                            alt={`Receipt ${getReceiptNumber(selectedReceipt)}`}
                                            className="max-h-full max-w-full object-contain cursor-pointer"
                                            onClick={() => window.open(selectedReceipt.image || selectedReceipt.photoData, '_blank')}
                                            title="Click to view full image in new tab"
                                        />
                                        <span className="absolute bottom-1 right-2 bg-black/60 text-white text-[7px] px-1.5 py-0.5 rounded font-semibold">Click to expand 🔍</span>
                                    </div>
                                ) : (
                                    <div className="w-full h-28 bg-[#f4f1ee] rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                        <span className="text-[9px] font-medium">No receipt image attached</span>
                                    </div>
                                )}

                                <div className="bg-[#f9fafb] p-3 rounded-lg border border-gray-100 flex flex-col gap-2">
                                    <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
                                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Amount</span>
                                        <span className="text-base font-extrabold text-[#A63228]">₱{Number(selectedReceipt.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-1">
                                        <div className="flex flex-col col-span-2"><span className="text-[8px] font-bold text-gray-400 uppercase">Project</span><span className="text-[10px] font-bold text-gray-900">{selectedReceipt.project || '-'}</span></div>
                                        <div className="flex flex-col"><span className="text-[8px] font-bold text-gray-400 uppercase">Receipt No.</span><span className="text-[10px] font-bold text-gray-900">{getReceiptNumber(selectedReceipt)}</span></div>
                                        <div className="flex flex-col"><span className="text-[8px] font-bold text-gray-400 uppercase">Category</span><span className="text-[10px] font-bold text-gray-900 uppercase">{selectedReceipt.category}</span></div>
                                        <div className="flex flex-col"><span className="text-[8px] font-bold text-gray-400 uppercase">Date Logged</span><span className="text-[10px] font-bold text-gray-900">{formatDisplayDate(selectedReceipt.date)}</span></div>
                                        <div className="flex flex-col"><span className="text-[8px] font-bold text-gray-400 uppercase">Time</span><span className="text-[10px] font-bold text-gray-900">{formatTime(selectedReceipt.time)}</span></div>
                                    </div>
                                    <div className="border-t border-gray-100 pt-2 mt-1">
                                        <span className="text-[8px] font-bold text-gray-400 uppercase">Items / Labor</span>
                                        {getExpenseItems(selectedReceipt).length > 0 ? (
                                            <div className="mt-1 divide-y divide-gray-100">
                                                {getExpenseItems(selectedReceipt).map((item, index) => {
                                                    const qty = Number(item.qty) || 0;
                                                    const price = Number(item.price) || 0;
                                                    return <div key={index} className="grid grid-cols-[auto_1fr_auto] gap-2 py-1.5 text-[9px] items-start">
                                                        <span className="font-bold text-gray-600 shrink-0">{item.qty || '-'} {item.unit || ''}</span>
                                                        <div>
                                                            <span className="font-medium text-gray-900 block">{item.description || item.desc || '-'}</span>
                                                            {item.remarks && <span className="text-[8px] text-gray-400 italic block">Purpose: {item.remarks}</span>}
                                                            {price > 0 && <span className="text-[8px] text-gray-400 block">₱{price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each</span>}
                                                        </div>
                                                        <span className="font-bold text-[#2e7d32] whitespace-nowrap">₱{(qty * price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>;
                                                })}
                                            </div>
                                        ) : <p className="text-[9px] text-gray-500 mt-1">{getExpenseDescription(selectedReceipt)}</p>}
                                    </div>
                                    {selectedReceipt.cashPaid !== undefined && (
                                        <div className="flex justify-between bg-white p-2 rounded border border-gray-50 mt-1">
                                            <div className="flex flex-col"><span className="text-[8px] font-bold text-gray-400 uppercase">Cash Paid</span><span className="text-[10px] font-bold text-[#2e7d32]">₱{Number(selectedReceipt.cashPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                            <div className="flex flex-col text-right"><span className="text-[8px] font-bold text-gray-400 uppercase">Cash Change</span><span className="text-[10px] font-bold text-gray-900">₱{Number(selectedReceipt.cashChange || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 border-t border-gray-100 bg-gray-50 flex gap-2">
                                <button onClick={handleEditClick} className="flex-1 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-[10px] font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-1">Edit</button>
                                <button onClick={handleDeleteClick} className="flex-1 py-1.5 bg-white border border-[#A63228] text-[#A63228] rounded-lg text-[10px] font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-1">Delete</button>
                            </div>
                        </div>
                    )}

                    {/* --- EDIT MODE --- */}
                    {receiptModalState === 'EDIT' && editFormData && (
                        <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl relative flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center p-3 border-b border-gray-100 bg-gray-50">
                                <div><h3 className="text-[11px] font-extrabold text-[#1a1a1a]">Edit Receipt</h3><p className="text-[9px] text-gray-500 font-medium">Receipt {getReceiptNumber(editFormData)}</p></div>
                                <button onClick={() => setReceiptModalState('VIEW')} className="text-gray-400 hover:text-gray-700"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                            </div>
                            <div className="p-4 max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div><label className="block text-[8px] font-bold text-gray-700 mb-1 uppercase">DATE</label><input type="date" name="date" value={editFormData.date} onChange={(e) => handleInputChange(e, true)} className="w-full bg-[#f4f1ee] rounded-md px-2 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none" /></div>
                                    <div><label className="block text-[8px] font-bold text-gray-700 mb-1 uppercase">TIME</label><input type="time" name="time" value={editFormData.time} onChange={(e) => handleInputChange(e, true)} className="w-full bg-[#f4f1ee] rounded-md px-2 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none" /></div>
                                    <div className="col-span-2">
                                        <label className="block text-[8px] font-bold text-gray-700 mb-1 uppercase">CATEGORY</label>
                                        <select name="category" value={editFormData.category} onChange={(e) => handleInputChange(e, true)} className="w-full bg-[#f4f1ee] rounded-md px-2 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}>
                                            <option value="Materials">Materials</option><option value="Manpower">Manpower</option><option value="Equipment">Equipment</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2"><label className="block text-[8px] font-bold text-gray-700 mb-1 uppercase">ITEM DESCRIPTION</label><input type="text" name="desc" value={editFormData.desc} onChange={(e) => handleInputChange(e, true)} className="w-full bg-[#f4f1ee] rounded-md px-2 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none" /></div>
                                    <div><label className="block text-[8px] font-bold text-gray-700 mb-1 uppercase">QUANTITY</label><input type="number" name="qty" value={editFormData.qty} onChange={(e) => handleInputChange(e, true)} className="w-full bg-[#f4f1ee] rounded-md px-2 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none" /></div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-[8px] font-bold text-gray-700 uppercase">AMOUNT (₱)</label>
                                            <span className="text-[7px] text-gray-400 font-semibold">Max: ₱999,999,999,999</span>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            max="999999999999"
                                            name="amount"
                                            value={editFormData.amount}
                                            onChange={(e) => handleInputChange(e, true)}
                                            className={`w-full bg-[#f4f1ee] rounded-md px-2 py-1.5 text-[9px] font-medium focus:border-[#A63228] outline-none border transition-colors ${amountError ? 'border-red-500 text-red-600' : 'border-transparent'}`}
                                        />
                                        {amountError && (
                                            <p className="text-[8px] text-red-600 font-bold mt-1 flex items-center gap-1">
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                                {amountError}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 border-t border-gray-100 bg-gray-50 flex gap-2">
                                <button onClick={() => setReceiptModalState('VIEW')} className="flex-1 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-[10px] font-bold hover:bg-gray-100">Cancel</button>
                                <button onClick={confirmEditSave} disabled={Boolean(amountError) || parseFloat(editFormData.amount || 0) > MAX_AMOUNT} className="flex-1 py-1.5 bg-[#8B1A10] text-white rounded-lg text-[10px] font-bold hover:bg-[#72150d] disabled:opacity-50 disabled:cursor-not-allowed">Save Changes</button>
                            </div>
                        </div>
                    )}

                    {/* --- CONFIRM DELETE MODAL (MOVE TO TRASH) --- */}
                    {receiptModalState === 'CONFIRM_DELETE' && (
                        <div className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-2xl relative text-center">
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-[#A63228]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-base font-extrabold text-[#1a1a1a] mb-2">Delete Receipt?</h3>
                            <p className="text-xs text-gray-500 mb-6 px-2 leading-relaxed">This action will move the receipt to the Trash. Are you sure?</p>
                            <div className="flex gap-3">
                                <button onClick={() => setReceiptModalState('VIEW')} className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors">Cancel</button>
                                <button onClick={confirmDelete} className="flex-1 py-2.5 bg-[#A63228] text-white rounded-xl text-xs font-bold hover:bg-[#8B1A10] transition-colors">Move to Trash</button>
                            </div>
                        </div>
                    )}

                    {/* --- CONFIRM RESTORE MODAL --- */}
                    {receiptModalState === 'CONFIRM_RESTORE' && (
                        <div className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-2xl relative text-center">
                            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <h3 className="text-base font-extrabold text-[#1a1a1a] mb-2">Restore Receipt?</h3>
                            <p className="text-xs text-gray-500 mb-6 px-2 leading-relaxed">This will return the receipt to the active list.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setReceiptModalState('NONE')} className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors">Cancel</button>
                                <button onClick={confirmRestore} className="flex-1 py-2.5 bg-[#2e7d32] text-white rounded-xl text-xs font-bold hover:bg-[#1b5e20] transition-colors">Restore</button>
                            </div>
                        </div>
                    )}

                    {/* --- CONFIRM PERMANENT DELETE MODAL --- */}
                    {receiptModalState === 'CONFIRM_PERM_DELETE' && (
                        <div className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-2xl relative text-center">
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-[#A63228]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-base font-extrabold text-[#1a1a1a] mb-2">Delete Forever?</h3>
                            <p className="text-xs text-gray-500 mb-6 px-2 leading-relaxed">This action cannot be undone. The receipt will be lost forever.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setReceiptModalState('NONE')} className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors">Cancel</button>
                                <button onClick={confirmPermDelete} className="flex-1 py-2.5 bg-[#A63228] text-white rounded-xl text-xs font-bold hover:bg-[#8B1A10] transition-colors">Delete Forever</button>
                            </div>
                        </div>
                    )}

                    {/* --- SUCCESS ACTION MODAL --- */}
                    {receiptModalState === 'SUCCESS_ACTION' && (
                        <div className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-2xl text-center relative">
                            <div className="w-12 h-12 bg-[#e6f4ea] rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-base font-extrabold text-[#1a1a1a] mb-2">Success!</h3>
                            <p className="text-xs text-gray-500 mb-6">{successMessage}</p>
                            <button onClick={() => { setReceiptModalState('NONE'); if (!selectedReceipt) setSelectedReceipt(null); }} className="w-full py-2.5 bg-[#8B1A10] text-white rounded-xl text-xs font-bold hover:bg-[#72150d] transition-colors">
                                Done
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ═════════ ADD / SCAN EXPENSE MODALS ═════════ */}

            {/* ADD EXPENSE MODAL (CARD-BASED LIKE MATERIAL USAGE) */}
            {modalState === 'ADD' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-[620px] shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
                        <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 shrink-0">
                            <div>
                                <h3 className="text-sm sm:text-base font-extrabold text-[#1a1a1a]">Add Expense</h3>
                                <p className="text-[10px] sm:text-xs text-gray-500 font-medium mt-0.5">Track project materials, labor, or equipment purchases.</p>
                            </div>
                            <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <form onSubmit={handleInitialSubmit} className="flex flex-col flex-1 overflow-hidden">
                            {/* Top Settings Section (Single Row Compact) */}
                            <div className="p-3 sm:p-3.5 border-b border-gray-100 bg-gray-50/60 shrink-0">
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                                    <div className="sm:col-span-6">
                                        <label className="block text-[8px] font-extrabold text-gray-500 tracking-wider uppercase mb-1">PROJECT</label>
                                        <select
                                            name="project"
                                            value={formData.project}
                                            onChange={handleInputChange}
                                            className="w-full bg-white border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-extrabold text-gray-800 outline-none appearance-none shadow-2xs focus:border-[#A63228]"
                                            style={selectStyles}
                                        >
                                            {mockProjects.map(p => (
                                                <option key={p.id} value={p.name} disabled={!isOngoingStatus(p.status)}>
                                                    {p.name} {!isOngoingStatus(p.status) ? `— (${p.status || 'Not Ongoing'} - Disabled)` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="sm:col-span-3">
                                        <label className="block text-[8px] font-extrabold text-gray-500 tracking-wider uppercase mb-1">DATE LOGGED</label>
                                        <input
                                            type="date"
                                            name="date"
                                            value={formData.date}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#A63228] outline-none shadow-2xs focus:border-[#A63228]"
                                        />
                                    </div>
                                    <div className="sm:col-span-3">
                                        <label className="block text-[8px] font-extrabold text-gray-500 tracking-wider uppercase mb-1">TIME</label>
                                        <input
                                            type="time"
                                            name="time"
                                            value={formData.time}
                                            onChange={handleInputChange}
                                            required
                                            className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-gray-800 outline-none shadow-2xs focus:border-[#A63228]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Scrollable Item Cards (Compact) */}
                            <div className="overflow-y-auto p-3 sm:p-3.5 flex flex-col gap-2.5 flex-1 bg-gray-50/30">
                                <div className="flex justify-between items-center px-0.5">
                                    <span className="text-[9.5px] font-extrabold text-gray-700 uppercase tracking-wider">
                                        {formData.items.some(it => it.category !== formData.items[0]?.category)
                                            ? 'EXPENSES BREAKDOWN (MIXED ITEMS)'
                                            : (formData.items[0]?.category === 'Manpower'
                                                ? 'WORKERS / LABOR FORCE LIST'
                                                : formData.items[0]?.category === 'Equipment'
                                                    ? 'EQUIPMENT & ITEMS LIST'
                                                    : 'MATERIALS / CONSUMABLES LIST')}
                                    </span>
                                    <span className="text-[9px] font-bold text-gray-400">
                                        {formData.items.length} item(s) in list
                                    </span>
                                </div>

                                {formData.items.map((item, idx) => {
                                    const itemCat = item.category || formData.category || 'Materials';
                                    const q = parseFloat(item.qty) || 0;
                                    const p = parseFloat(item.price) || 0;
                                    const subtotal = q * p;

                                    return (
                                        <div key={idx} className="bg-white border border-gray-200/90 rounded-xl p-3 relative flex flex-col gap-2 shadow-2xs hover:border-gray-300 transition-all">
                                            {/* Item Card Header */}
                                            <div className="flex justify-between items-center pb-1.5 border-b border-gray-100">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9.5px] font-extrabold text-[#A63228] bg-red-50 border border-red-100 px-2 py-0.5 rounded-md">
                                                        ITEM #{idx + 1}
                                                    </span>
                                                    <select
                                                        value={itemCat}
                                                        onChange={(e) => handleItemCategoryChange(idx, e.target.value)}
                                                        className="text-[9.5px] font-bold text-gray-700 bg-gray-100/90 hover:bg-gray-200/80 border border-gray-200 rounded-md px-1.5 py-0.5 outline-none cursor-pointer focus:border-[#A63228] transition-colors"
                                                        title="Category for this item"
                                                    >
                                                        <option value="Materials">Materials</option>
                                                        <option value="Manpower">Manpower</option>
                                                        <option value="Equipment">Equipment</option>
                                                    </select>
                                                </div>
                                                {formData.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(idx)}
                                                        className="text-[11px] font-bold text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-red-50"
                                                        title="Remove item"
                                                    >
                                                        ✕ Remove
                                                    </button>
                                                )}
                                            </div>

                                            {/* Row 1: Item Description */}
                                            <div>
                                                <div className="mb-0.5">
                                                    <label className="block text-[8.5px] font-extrabold text-gray-700 uppercase tracking-wider">
                                                        {itemCat === 'Manpower' ? 'WORKER / ROLE' : itemCat === 'Equipment' ? 'EQUIPMENT / ITEM' : 'MATERIAL / ITEM'} <span className="text-[#A63228]">*</span>
                                                    </label>
                                                </div>
                                                <SearchableMaterialDropdown
                                                    value={item.description}
                                                    onChange={(val) => handleItemChange(idx, 'description', val)}
                                                    placeholder={
                                                        itemCat === 'Materials'
                                                            ? 'Select or type material (e.g. Cement, Sand...)'
                                                            : itemCat === 'Manpower'
                                                                ? 'Select or type worker (e.g. Mason, Carpenter...)'
                                                                : 'Select or type equipment (e.g. Mixer, Fuel...)'
                                                    }
                                                    category={itemCat}
                                                />
                                            </div>

                                            {/* Row 2: 4-Column Metric Grid */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end pt-0.5">
                                                {/* Quantity */}
                                                <div>
                                                    <label className="block text-[8.5px] font-extrabold text-gray-700 uppercase tracking-wider mb-1">
                                                        {itemCat === 'Manpower' ? 'DAYS / QTY' : 'QUANTITY'} <span className="text-[#A63228]">*</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        min="0.01"
                                                        value={item.qty}
                                                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                                                        required
                                                        placeholder="0"
                                                        className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-extrabold text-gray-900 focus:border-[#A63228] outline-none shadow-2xs"
                                                    />
                                                </div>

                                                {/* Unit */}
                                                <div>
                                                    <label className="block text-[8.5px] font-extrabold text-gray-700 uppercase tracking-wider mb-1">
                                                        UNIT <span className="text-[#A63228]">*</span>
                                                    </label>
                                                    <select
                                                        value={item.unit}
                                                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                                        required
                                                        className="w-full bg-white border border-gray-200 rounded-lg pl-2 pr-6 py-1.5 text-xs font-semibold text-gray-800 focus:border-[#A63228] outline-none appearance-none shadow-2xs cursor-pointer"
                                                        style={selectStyles}
                                                    >
                                                        {getItemUnits(item).map(u => (
                                                            <option key={u} value={u}>{u}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Unit Price */}
                                                <div>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <label className="block text-[8.5px] font-extrabold text-gray-700 uppercase tracking-wider">
                                                            {itemCat === 'Manpower' ? 'DAILY RATE' : 'UNIT PRICE'} <span className="text-[#A63228]">*</span>
                                                        </label>
                                                        {item.unit && (
                                                            <span className="text-[7.5px] font-semibold text-gray-400">/{item.unit}</span>
                                                        )}
                                                    </div>
                                                    <div className="relative flex items-center">
                                                        <span className="absolute left-2 text-xs font-bold text-gray-400">₱</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            value={item.price}
                                                            onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                                                            required
                                                            placeholder="0.00"
                                                            className="w-full bg-white border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 text-xs font-extrabold text-[#A63228] focus:border-[#A63228] outline-none shadow-2xs"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Subtotal - Single clean line, NO formula/computation text */}
                                                <div>
                                                    <label className="block text-[8.5px] font-extrabold text-gray-700 uppercase tracking-wider mb-1">
                                                        SUBTOTAL
                                                    </label>
                                                    <div className="flex items-center justify-end h-[31px] bg-red-50/70 border border-red-200/70 rounded-lg px-2.5 text-right">
                                                        <span className="text-xs font-black text-[#A63228] truncate">
                                                            ₱{subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={addNewItem}
                                    className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-xs font-extrabold text-gray-600 hover:text-[#A63228] hover:border-[#A63228] hover:bg-red-50/30 transition-all flex items-center justify-center gap-1.5"
                                >
                                    <span>+</span> Add Another Item
                                </button>

                                {/* Receipt Upload (REQUIRED) */}
                                <div className={`p-2.5 rounded-xl border transition-colors ${!photoData ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200' : 'bg-gray-50/70 border-gray-200'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-[8.5px] font-bold text-gray-700 uppercase flex items-center gap-1">
                                            <span>Receipt / Proof Image</span>
                                            <span className="text-red-700 font-extrabold text-[7.5px] bg-red-100 border border-red-300 px-1.5 py-0.2 rounded uppercase">* Required (Kailangan)</span>
                                        </label>
                                        {photoData ? (
                                            <span className="text-[8.5px] font-bold text-[#2e7d32]">✓ Receipt Attached</span>
                                        ) : (
                                            <span className="text-[8.5px] font-bold text-amber-700">⚠ Mag-attach ng Resibo</span>
                                        )}
                                    </div>
                                    {photoData ? (
                                        <div className="relative w-full rounded-lg overflow-hidden border border-[#A63228]/30 bg-white">
                                            <img src={photoData} alt="Receipt preview" className="w-full max-h-32 object-contain py-1" />
                                            <button
                                                type="button"
                                                onClick={() => setPhotoData(null)}
                                                className="absolute top-1.5 right-1.5 bg-white/90 hover:bg-red-50 text-gray-500 hover:text-[#A63228] rounded-full p-1 shadow transition-colors"
                                                title="Remove receipt"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <label className={`flex flex-col items-center justify-center gap-0.5 w-full py-2.5 px-3 rounded-lg border-2 border-dashed ${!photoData && amountError.includes('receipt') ? 'border-red-400 bg-red-50/30' : 'border-gray-300 hover:border-[#A63228] hover:bg-red-50/20 bg-white'} cursor-pointer transition-colors`}>
                                            <div className="flex items-center gap-1.5">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#A63228]"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                                <span className="text-[9.5px] font-bold text-gray-700">Attach Receipt, Signed Payroll, or Voucher Photo</span>
                                            </div>
                                            <span className="text-[8px] text-gray-400">Official Receipt (OR), Cash Voucher, Signed Payroll Sheet, or Rental Agreement (JPG, PNG)</span>
                                            <input type="file" accept="image/*" onChange={handleManualFileUpload} className="hidden" />
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Bottom Summary Bar */}
                            <div className="p-3 sm:p-3.5 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-2.5 shrink-0">
                                <div className="text-left w-full sm:w-auto">
                                    <span className="block text-[8.5px] font-extrabold text-gray-400 uppercase tracking-wider">TOTAL EXPENSE COST</span>
                                    <span className="text-base font-extrabold text-[#A63228]">
                                        ₱{computedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    {amountError && (
                                        <p className="text-[8.5px] text-red-600 font-bold mt-0.5">{amountError}</p>
                                    )}
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={resetAndClose}
                                        className="flex-1 sm:flex-initial px-3.5 py-2 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-xs font-extrabold hover:bg-red-50 transition-colors uppercase tracking-wider"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={computedTotal <= 0 || computedTotal > MAX_AMOUNT || !photoData}
                                        title={!photoData ? "Kailangang mag-upload ng resibo bago mag-save (Receipt is REQUIRED)" : "Save All Items"}
                                        className="flex-1 sm:flex-initial px-4 py-2 bg-[#E8C547] text-gray-900 rounded-xl text-xs font-extrabold hover:bg-[#d4b33d] transition-colors shadow-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Save All {formData.items.length} Item(s)
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SCAN_START */}
            {modalState === 'SCAN_START' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-xl w-full max-w-[300px] shadow-2xl relative overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
                            <div><h3 className="text-[13px] font-extrabold text-[#1a1a1a]">Scan Receipt</h3><p className="text-[9px] text-gray-500 font-medium mt-0.5">Take a photo or upload file.</p></div>
                            <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-700"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                        </div>
                        <div className="p-4 flex flex-col shrink-0">
                            <div className="bg-gray-50 h-40 rounded-lg flex items-center justify-center border border-[#e5dfd8] mb-4 overflow-hidden relative w-full">
                                <div className="flex flex-col items-center justify-center text-gray-400">
                                    <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    <span className="text-[10px] font-medium">Ready to scan</span>
                                </div>
                            </div>
                            <label className="w-full py-2 bg-[#E8C547] text-gray-900 rounded-lg text-[10px] font-bold hover:bg-[#d4b33d] transition-colors mb-2 cursor-pointer text-center block">Take a Photo<input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} className="hidden" /></label>
                            <div className="text-center mb-2"><span className="text-[9px] text-gray-400">or</span></div>
                            <label className="w-full py-2 bg-[#fce8e6] text-[#A63228] rounded-lg text-[10px] font-bold hover:bg-red-100 transition-colors cursor-pointer text-center block">Upload Receipt<input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" /></label>
                        </div>
                    </div>
                </div>
            )}

            {/* SCAN_REVIEW */}
            {modalState === 'SCAN_REVIEW' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-xl w-full max-w-[300px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
                            <div><h3 className="text-[13px] font-extrabold text-[#1a1a1a]">Review Receipt</h3><p className="text-[9px] text-gray-500 font-medium mt-0.5">Make sure the receipt is clear.</p></div>
                            <button onClick={resetAndClose} className="text-gray-400 hover:text-gray-700"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                        </div>
                        <div className="p-4 flex flex-col shrink-0">
                            <div className="bg-gray-100 h-48 rounded-lg flex items-center justify-center border border-[#e5dfd8] mb-3 overflow-hidden">
                                {photoData ? <img src={photoData} alt="Captured receipt" className="w-full h-full object-contain" /> : <span className="text-[9px] text-gray-400">No image captured</span>}
                            </div>
                            <div className="flex items-center justify-center gap-1.5 mb-4">
                                <svg className="w-3.5 h-3.5 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                <span className="text-[9px] text-[#2e7d32] font-bold">Image loaded successfully.</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={retakePhoto} className="flex-1 py-2 bg-white border border-[#A63228] text-[#A63228] rounded-lg text-[10px] font-bold hover:bg-red-50 transition-colors">Retake</button>
                                <button onClick={handleStartScanning} className="flex-1 py-2 bg-[#E8C547] text-gray-900 rounded-lg text-[10px] font-bold hover:bg-[#d4b33d] transition-colors">Continue</button>
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

            {/* SCAN_DETAILS WITH CASH PAID/CHANGE */}
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">PROJECT</label>
                                        <select name="project" value={formData.project} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-3 pr-8 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}>
                                            {mockProjects.map(p => (
                                                <option key={p.id} value={p.name} disabled={!isOngoingStatus(p.status)}>
                                                    {p.name} {!isOngoingStatus(p.status) ? `— (${p.status || 'Not Ongoing'} - Disabled)` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div><label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">EXPENSE CATEGORY</label><select name="category" value={formData.category} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-3 pr-8 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none appearance-none" style={selectStyles}><option value="Materials">Materials</option><option value="Manpower">Manpower</option><option value="Equipment">Equipment / Fuel</option></select></div>
                                </div>

                                <div className="grid grid-cols-12 gap-3">
                                    <div className="col-span-12 sm:col-span-4"><label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">RECEIPT NO.</label><input type="text" name="receiptNo" value={formData.receiptNo} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="e.g. 0042" /></div>
                                    <div className="col-span-6 sm:col-span-4"><label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">DATE</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] border border-[#2e7d32] rounded-lg px-3 py-2.5 text-xs font-medium outline-none text-[#2e7d32]" /></div>
                                    <div className="col-span-6 sm:col-span-4"><label className="block text-[9px] font-bold text-gray-700 mb-1.5 uppercase">TIME</label><input type="time" name="time" value={formData.time} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" /></div>
                                </div>

                                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 mt-1">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="block text-[10px] font-extrabold text-gray-800 uppercase">ITEMS SCANNED</label>
                                        <button type="button" onClick={addNewItem} className="bg-white border border-[#A63228] text-[#A63228] text-[10px] px-2 py-1 rounded-md font-bold hover:bg-red-50 flex items-center gap-1 shadow-sm transition-colors"><span>+</span> Add Item</button>
                                    </div>
                                    <div className="flex flex-col gap-2.5">
                                        {formData.items.map((item, idx) => (
                                            <div key={idx} className="flex gap-2.5 items-center relative">
                                                <div className="w-1/4 sm:w-1/5"><input type="number" value={item.qty} onChange={(e) => handleItemChange(idx, 'qty', e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="Qty" /></div>
                                                <div className="flex-1 flex gap-2">
                                                    <input type="text" value={item.description} onChange={(e) => handleItemChange(idx, 'description', e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="Item Description" />
                                                    {formData.items.length > 1 && (<button type="button" onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-600 px-2 shrink-0 bg-white border border-gray-200 rounded-lg hover:border-red-200 hover:bg-red-50 transition-colors">✕</button>)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* SCANNED FINANCIALS WITH CASH PAID/CHANGE */}
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
                                        <label className="block text-[8px] font-bold text-gray-700 mb-1.5 uppercase">CHANGE</label>
                                        <input type="number" step="0.01" min="0" max="999999999999" name="change" value={formData.change} onChange={handleInputChange} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-3 py-2.5 text-xs font-medium focus:border-[#A63228] outline-none" placeholder="₱ 0.00" />
                                    </div>
                                </div>
                                {amountError && (
                                    <p className="text-[9px] text-red-600 font-bold flex items-center gap-1 -mt-1">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                        {amountError}
                                    </p>
                                )}

                                <div className="mt-1">
                                    <div className="bg-[#e6f4ea] border border-[#c8e6c9] rounded-xl px-3 py-2.5 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        <span className="text-xs font-bold text-[#2e7d32]">Receipt attached & read</span>
                                    </div>
                                </div>

                                <button type="submit" disabled={Boolean(amountError) || parseFloat(formData.amount || 0) > MAX_AMOUNT} className="w-full mt-3 py-3 bg-[#E8C547] text-gray-900 rounded-xl text-xs font-bold hover:bg-[#d4b33d] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">Confirm Details</button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRM MODAL (MANUAL ADD) */}
            {modalState === 'CONFIRM' && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-4 bg-gray-900 text-white flex justify-between items-center shrink-0">
                            <div>
                                <span className="text-[9px] font-bold text-[#E8C547] uppercase tracking-wider block">FINAL VERIFICATION</span>
                                <h3 className="text-sm font-extrabold text-white mt-0.5">Confirm Expense & Materials</h3>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white uppercase tracking-wider">
                                {formData.category}
                            </span>
                        </div>

                        {/* Body */}
                        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-left">
                            {/* Meta info card */}
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                                <div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase block">PROJECT SITE</span>
                                    <strong className="text-gray-900 font-extrabold truncate block">
                                        {formData.project || currentProjectName || 'Project Site'}
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase block">DATE & TIME</span>
                                    <strong className="text-gray-800 font-bold block">
                                        {formData.date || todayISO} {formData.time ? `• ${formData.time}` : ''}
                                    </strong>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <span className="text-[8px] font-bold text-gray-400 uppercase block">RECEIPT NO.</span>
                                    <strong className="text-gray-800 font-bold block">
                                        {formData.receiptNo ? `#${formData.receiptNo}` : '— (No Receipt)'}
                                    </strong>
                                </div>
                            </div>

                            {/* Materials / Items Table */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <h4 className="text-[10px] font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>📦</span>
                                        <span>
                                            {formData.category === 'Materials' ? 'Materials Information' : 'Expense Items Breakdown'}
                                        </span>
                                        <span className="text-[9px] font-bold text-[#A63228] bg-red-50 px-1.5 py-0.2 rounded-full">
                                            {formData.items?.filter(it => it.description || it.qty).length || 1} item(s)
                                        </span>
                                    </h4>
                                    <span className="text-[8px] text-gray-400 font-medium">Verify units & quantity</span>
                                </div>

                                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                                    <table className="w-full text-left border-collapse text-[10px]">
                                        <thead className="bg-gray-100/80 text-[8px] font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                            <tr>
                                                <th className="py-2 px-3">MATERIAL / ITEM NAME</th>
                                                <th className="py-2 px-2 text-center">QUANTITY & UNIT</th>
                                                <th className="py-2 px-2 text-right">UNIT PRICE</th>
                                                <th className="py-2 px-3 text-right">SUBTOTAL</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {formData.items?.filter(it => it.description || it.qty || it.price).map((item, idx) => {
                                                const q = parseFloat(item.qty || 0);
                                                const p = parseFloat(item.price || 0);
                                                const sub = q * p;
                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                                                        <td className="py-2.5 px-3">
                                                            <div className="font-extrabold text-gray-900 leading-tight flex items-center gap-1.5 flex-wrap">
                                                                <span>{item.description || 'Unspecified Item'}</span>
                                                                <span className="text-[7.5px] font-bold px-1.5 py-0.2 rounded bg-gray-100 text-gray-600">
                                                                    {item.category === 'Manpower' ? '👷 Manpower' : item.category === 'Equipment' ? '🚜 Equipment' : '📦 Materials'}
                                                                </span>
                                                            </div>
                                                            {item.baseMaterial && item.baseMaterial !== item.description && (
                                                                <span className="text-[7.5px] font-bold text-gray-400 block mt-0.5">
                                                                    Base: {item.baseMaterial}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-2 text-center">
                                                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-extrabold text-[9px]">
                                                                {item.qty || '0'} {item.unit || ''}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-2 text-right font-extrabold text-gray-700">
                                                            ₱{p.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            <span className="text-[7.5px] font-normal text-gray-400 block">/{item.unit || 'unit'}</span>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-black text-[#A63228]">
                                                            ₱{sub.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Total Amount Box */}
                            <div className="bg-[#fce8e6]/40 rounded-xl p-3.5 border border-[#fce8e6] flex items-center justify-between">
                                <div>
                                    <span className="text-[8.5px] font-extrabold text-gray-500 uppercase tracking-wider block">TOTAL EXPENSE COST</span>
                                    <span className="text-xl font-black text-[#A63228] tracking-tight">
                                        ₱{parseFloat(formData.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                {photoData && (
                                    <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200">
                                        <img src={photoData} alt="Proof thumbnail" className="w-8 h-8 rounded object-cover" />
                                        <span className="text-[8px] font-bold text-[#2e7d32]">Receipt Attached</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="p-3.5 border-t border-gray-100 bg-gray-50 flex gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => setModalState('ADD')}
                                className="flex-1 py-2.5 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-xs font-extrabold hover:bg-red-50 transition-colors uppercase tracking-wider"
                            >
                                ← Back to Edit
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmAdd}
                                className="flex-1 py-2.5 bg-[#8B1A10] border border-[#8B1A10] text-white rounded-xl text-xs font-extrabold hover:bg-[#72150d] transition-colors shadow-sm uppercase tracking-wider"
                            >
                                ✓ Confirm & Add Expense
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SCAN_CONFIRM (Big Confirm Modal) */}
            {modalState === 'SCAN_CONFIRM' && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 transition-all">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-4 bg-gray-900 text-white flex justify-between items-center shrink-0">
                            <div>
                                <span className="text-[9px] font-bold text-[#E8C547] uppercase tracking-wider block">SCANNED RECEIPT VERIFICATION</span>
                                <h3 className="text-sm font-extrabold text-white mt-0.5">Confirm Scanned Expense</h3>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white uppercase tracking-wider">
                                {formData.category}
                            </span>
                        </div>

                        {/* Body */}
                        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-left">
                            {/* Meta info card */}
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                                <div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase block">PROJECT SITE</span>
                                    <strong className="text-gray-900 font-extrabold truncate block">
                                        {formData.project || currentProjectName || 'Project Site'}
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase block">DATE & TIME</span>
                                    <strong className="text-gray-800 font-bold block">
                                        {formData.date || todayISO} {formData.time ? `• ${formData.time}` : ''}
                                    </strong>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <span className="text-[8px] font-bold text-gray-400 uppercase block">RECEIPT NO.</span>
                                    <strong className="text-gray-800 font-bold block">
                                        {formData.receiptNo ? `#${formData.receiptNo}` : '— (No Receipt)'}
                                    </strong>
                                </div>
                            </div>

                            {/* Materials / Items Table */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <h4 className="text-[10px] font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>📦</span>
                                        <span>Scanned Materials & Items</span>
                                        <span className="text-[9px] font-bold text-[#A63228] bg-red-50 px-1.5 py-0.2 rounded-full">
                                            {formData.items?.filter(it => it.description || it.qty).length || 1} item(s)
                                        </span>
                                    </h4>
                                    <span className="text-[8px] text-gray-400 font-medium">Extracted from receipt</span>
                                </div>

                                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                                    <table className="w-full text-left border-collapse text-[10px]">
                                        <thead className="bg-gray-100/80 text-[8px] font-extrabold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                                            <tr>
                                                <th className="py-2 px-3">MATERIAL / ITEM NAME</th>
                                                <th className="py-2 px-2 text-center">QUANTITY</th>
                                                <th className="py-2 px-3 text-right">UNIT / STATUS</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {formData.items?.filter(it => it.description || it.qty).map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-extrabold text-gray-900 leading-tight">
                                                            {item.description || 'Scanned Item'}
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-2 text-center">
                                                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-extrabold text-[9px]">
                                                            {item.qty || '1'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-medium text-gray-500">
                                                        {item.unit || 'Scanned'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Total Amount Box */}
                            <div className="bg-[#fce8e6]/40 rounded-xl p-3.5 border border-[#fce8e6] flex items-center justify-between">
                                <div>
                                    <span className="text-[8.5px] font-extrabold text-gray-500 uppercase tracking-wider block">TOTAL EXTRACTED AMOUNT</span>
                                    <span className="text-xl font-black text-[#A63228] tracking-tight">
                                        ₱{parseFloat(formData.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    {formData.cashTendered && (
                                        <div className="text-[8px] text-gray-500 font-bold mt-0.5">
                                            Cash Paid: ₱{parseFloat(formData.cashTendered || 0).toLocaleString()} • Change: ₱{parseFloat(formData.change || 0).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                                {photoData && (
                                    <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-gray-200">
                                        <img src={photoData} alt="Receipt thumbnail" className="w-8 h-8 rounded object-cover" />
                                        <span className="text-[8px] font-bold text-[#2e7d32]">Scanned Proof</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="p-3.5 border-t border-gray-100 bg-gray-50 flex gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => setModalState('SCAN_DETAILS')}
                                className="flex-1 py-2.5 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-xs font-extrabold hover:bg-red-50 transition-colors uppercase tracking-wider"
                            >
                                ← Back to Edit
                            </button>
                            <button
                                type="button"
                                onClick={handleScanConfirmAdd}
                                className="flex-1 py-2.5 bg-[#8B1A10] border border-[#8B1A10] text-white rounded-xl text-xs font-extrabold hover:bg-[#72150d] transition-colors shadow-sm uppercase tracking-wider"
                            >
                                ✓ Confirm & Save Receipt
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
                            <svg className="w-8 h-8 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-base font-extrabold text-[#1a1a1a] mb-2">Saved Successfully!</h3>
                        <p className="text-xs text-gray-500 font-medium mb-1">Expense recorded for {currentProjectData?.name}.</p>
                        <p className="text-2xl font-extrabold text-[#A63228] mb-3 mt-3">₱{parseFloat(formData.amount || 0).toLocaleString()}</p>
                        <span className="inline-block text-gray-700 bg-gray-100 text-[10px] font-extrabold uppercase tracking-wider mb-8 rounded px-3 py-1">{formData.category}</span>
                        <button onClick={resetAndClose} className="w-full py-3 bg-[#8B1A10] text-white rounded-xl text-sm font-bold hover:bg-[#72150d] shadow-sm transition-colors">Done</button>
                    </div>
                </div>
            )}

        </AdminLayout>
    )
}
