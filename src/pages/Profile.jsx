import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import PhilippineAddressSelector from '../components/PhilippineAddressSelector'
import { api } from '../api'

export default function Profile() {
    const navigate = useNavigate();
    const defaultProfile = {
        firstName: '',
        middleName: '',
        lastName: '',
        email: '',
        role: 'Administrator',
        phone: '',
        homeAddress: '',
        addressObj: {},
        empId: 'SCON-ADMIN-001',
        dept: 'Management'
    };

    const formatName = (profile) => [profile.firstName, profile.middleName, profile.lastName]
        .filter(Boolean).join(' ') || profile.name || profile.fullName || 'Administrator';

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to log out?')) {
            localStorage.removeItem('user');
            localStorage.removeItem('adminId');
            localStorage.removeItem('adminSession');
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminProfile');
            sessionStorage.clear();
            navigate('/login');
        }
    };

    // ── STATE PARA SA PROFILE DATA ──
    const [profileData, setProfileData] = useState(() => {
        try {
            const savedProfile = JSON.parse(localStorage.getItem('adminProfile') || '{}');
            return { ...defaultProfile, ...savedProfile };
        } catch {
            return defaultProfile;
        }
    });

    const [is2FAEnabled, setIs2FAEnabled] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // ── FETCH PROFILE MULA SA DATABASE ──
    const loadProfileFromDB = () => {
        const adminId = localStorage.getItem('adminId') || 1;
        api.get(`/admin/profile/${adminId}`)
            .then(data => {
                if (data && !data.error) {
                    const loadedProfile = {
                        id: data.id,
                        firstName: data.firstName || '',
                        middleName: data.middleName || '',
                        lastName: data.lastName || '',
                        fullName: data.fullName || '',
                        email: data.email || '',
                        role: data.role || 'Administrator',
                        phone: data.phone || '',
                        homeAddress: data.homeAddress || '',
                        addressObj: data.addressObj && typeof data.addressObj === 'object' ? data.addressObj : {},
                        empId: data.empId || 'SCON-ADMIN-001',
                        dept: data.dept || 'Management'
                    };
                    loadedProfile.name = formatName(loadedProfile);
                    setProfileData(loadedProfile);
                    localStorage.setItem('adminProfile', JSON.stringify(loadedProfile));
                    window.dispatchEvent(new Event('admin-profile-updated'));
                }
            })
            .catch(err => {
                console.warn('Could not load profile from database:', err);
            });
    };

    useEffect(() => {
        loadProfileFromDB();
    }, []);

    // ── MODAL STATES ──
    const [modalState, setModalState] = useState('NONE'); // NONE, EDIT_PROFILE, CHANGE_PASS, TWO_FACTOR, SUCCESS
    const [formData, setFormData] = useState({});
    const [successMsg, setSuccessMsg] = useState('');

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const capitalizeWords = (value) => value
        .split(' ')
        .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
        .join(' ');

    const handleNameChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: capitalizeWords(value) }));
    };

    const handlePhoneChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');

        if (value.length === 1 && value !== '0') {
            value = `09${value}`;
        } else if (value.length === 2 && value[0] === '0' && value[1] !== '9') {
            value = `09${value[1]}`;
        }

        setFormData(prev => ({ ...prev, phone: value.slice(0, 11) }));
    };

    const openEditProfile = () => {
        const addrObj = profileData.addressObj || {};
        setFormData({
            ...profileData,
            name: formatName(profileData),
            street: addrObj.street || '',
            addressObj: addrObj
        });
        setErrorMsg('');
        setModalState('EDIT_PROFILE');
    };

    const openChangePassword = () => {
        setFormData({ current: '', newPass: '', confirm: '' });
        setErrorMsg('');
        setModalState('CHANGE_PASS');
    };

    const open2FAModal = () => {
        setFormData({ code: '' });
        setErrorMsg('');
        setModalState('TWO_FACTOR');
    };

    // ── SAVE PROFILE SA DATABASE ──
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        setErrorMsg('');

        const addrObj = {
            ...(formData.addressObj || {}),
            street: (formData.street || '').trim()
        };

        const locParts = [
            formData.street ? formData.street.trim() : '',
            addrObj.barangayName ? `Brgy. ${addrObj.barangayName}` : '',
            addrObj.cityName,
            addrObj.provinceName && addrObj.provinceName !== 'NCR' && addrObj.provinceName !== addrObj.cityName ? addrObj.provinceName : '',
            addrObj.regionName
        ].filter(Boolean);

        const computedHomeAddress = locParts.length > 0 ? locParts.join(', ') : (formData.homeAddress || '');

        const updatedProfile = {
            ...profileData,
            firstName: capitalizeWords((formData.firstName || '').trim()),
            middleName: capitalizeWords((formData.middleName || '').trim()),
            lastName: capitalizeWords((formData.lastName || '').trim()),
            email: (formData.email || '').trim(),
            phone: (formData.phone || '').trim(),
            homeAddress: computedHomeAddress,
            addressObj: addrObj
        };
        updatedProfile.name = formatName(updatedProfile);

        const adminId = localStorage.getItem('adminId') || profileData.id || 1;

        try {
            const result = await api.post('/admin/profile/save', {
                adminId,
                firstName: updatedProfile.firstName,
                middleName: updatedProfile.middleName,
                lastName: updatedProfile.lastName,
                email: updatedProfile.email,
                phone: updatedProfile.phone,
                homeAddress: updatedProfile.homeAddress,
                addressObj: updatedProfile.addressObj,
                role: updatedProfile.role,
                empId: updatedProfile.empId,
                dept: updatedProfile.dept
            });

            setProfileData(updatedProfile);
            localStorage.setItem('adminProfile', JSON.stringify(updatedProfile));
            window.dispatchEvent(new Event('admin-profile-updated'));
            setSuccessMsg('Admin profile information has been saved to the database successfully.');
            setModalState('SUCCESS');
        } catch (err) {
            console.error('Error saving profile to database:', err);
            setErrorMsg(err.message || 'Failed to save admin profile to database.');
        } finally {
            setSaving(false);
        }
    };

    // ── UPDATE PASSWORD SA DATABASE ──
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (formData.newPass !== formData.confirm) {
            setErrorMsg('New password and confirm password do not match.');
            return;
        }

        if (formData.newPass.length < 6) {
            setErrorMsg('Password must be at least 6 characters long.');
            return;
        }

        const adminId = localStorage.getItem('adminId') || profileData.id || 1;
        setSaving(true);

        try {
            await api.put(`/admin/${adminId}/password`, {
                currentPassword: formData.current,
                newPassword: formData.newPass
            });

            setSuccessMsg('Account password has been changed securely in the database.');
            setModalState('SUCCESS');
        } catch (err) {
            console.error('Password change error:', err);
            setErrorMsg(err.message || 'Server connection failed. Could not update password in database.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle2FA = (e) => {
        e.preventDefault();
        setIs2FAEnabled(!is2FAEnabled);
        setSuccessMsg(is2FAEnabled ? 'Two-Factor Authentication has been disabled.' : 'Two-Factor Authentication has been successfully enabled.');
        setModalState('SUCCESS');
    };

    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '0.8rem 0.8rem'
    };

    return (
        <AdminLayout>
            {/* ── HEADER ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-2">
                <div>
                    <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">PROFILE</span>
                    <h1 className="text-xl font-extrabold text-gray-900 mt-0.5 tracking-tight">Admin Profile</h1>
                    <p className="text-[10px] text-gray-500 mt-0.5">Manage your account information and settings.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={openEditProfile} className="bg-white border border-[#A63228] text-[#A63228] px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Edit Profile
                    </button>
                    <button onClick={handleLogout} className="bg-[#A63228] text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-[#8B1A10] transition-colors flex items-center justify-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        Log Out
                    </button>
                </div>
            </div>

            {/* ── MAIN GRID ── */}
            <div className="flex flex-col lg:flex-row gap-3">

                {/* ── LEFT COLUMN (Profile Info) ── */}
                <div className="w-full lg:w-[55%] flex flex-col gap-3">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-sm font-extrabold text-gray-900 mb-6">Profile Information</h3>

                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            <div className="flex-shrink-0">
                                <div className="w-24 h-24 bg-[#EAD9D8] text-[#A63228] rounded-full flex items-center justify-center text-3xl font-extrabold shadow-sm">
                                    {formatName(profileData).substring(0, 2).toUpperCase()}
                                </div>
                            </div>

                            <div className="flex-1 w-full flex flex-col">
                                <div className="flex justify-between items-center py-3 border-b border-gray-50">
                                    <span className="text-[10px] text-gray-500 font-medium w-1/3 uppercase tracking-wider">Full Name</span>
                                    <strong className="text-xs font-bold text-gray-900 w-2/3">{formatName(profileData)}</strong>
                                </div>
                                <div className="flex justify-between items-center py-3 border-b border-gray-50">
                                    <span className="text-[10px] text-gray-500 font-medium w-1/3 uppercase tracking-wider">Email Address</span>
                                    <strong className="text-xs font-bold text-gray-900 w-2/3 truncate">{profileData.email}</strong>
                                </div>
                                <div className="flex justify-between items-center py-3 border-b border-gray-50">
                                    <span className="text-[10px] text-gray-500 font-medium w-1/3 uppercase tracking-wider">Role</span>
                                    <strong className="text-xs font-bold text-gray-900 w-2/3">{profileData.role}</strong>
                                </div>
                                <div className="flex justify-between items-center py-3 border-b border-gray-50">
                                    <span className="text-[10px] text-gray-500 font-medium w-1/3 uppercase tracking-wider">Phone Number</span>
                                    <strong className="text-xs font-bold text-gray-900 w-2/3">{profileData.phone}</strong>
                                </div>
                                <div className="flex justify-between items-start py-3 border-b border-gray-50">
                                    <span className="text-[10px] text-gray-500 font-medium w-1/3 uppercase tracking-wider">Home Address</span>
                                    <strong className="text-xs font-bold text-gray-900 w-2/3 leading-relaxed">{profileData.homeAddress || 'Not provided'}</strong>
                                </div>
                                <div className="flex justify-between items-center py-3 border-b border-gray-50">
                                    <span className="text-[10px] text-gray-500 font-medium w-1/3 uppercase tracking-wider">Employee ID</span>
                                    <strong className="text-xs font-bold text-gray-900 w-2/3">{profileData.empId}</strong>
                                </div>
                                <div className="flex justify-between items-center py-3">
                                    <span className="text-[10px] text-gray-500 font-medium w-1/3 uppercase tracking-wider">Department</span>
                                    <strong className="text-xs font-bold text-gray-900 w-2/3">{profileData.dept}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT COLUMN (Security & Preferences) ── */}
                <div className="w-full lg:w-[45%] flex flex-col gap-3">

                    {/* Account Security */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                        <h3 className="text-xs font-extrabold text-gray-900 mb-4">Account Security</h3>
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Password</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-bold text-gray-900 tracking-widest">••••••••••••</span>
                                    <button onClick={openChangePassword} className="border border-[#A63228] text-[#A63228] px-3 py-1 rounded-md text-[9px] font-extrabold hover:bg-red-50 transition-colors uppercase">Change</button>
                                </div>
                            </div>
                            <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Two-Factor Auth</span>
                                <div className="flex items-center gap-4">
                                    <span className={`text-xs font-bold ${is2FAEnabled ? 'text-[#2e7d32]' : 'text-gray-900'}`}>{is2FAEnabled ? 'Enabled' : 'Disabled'}</span>
                                    <button onClick={open2FAModal} className={`border px-3 py-1 rounded-md text-[9px] font-extrabold transition-colors uppercase ${is2FAEnabled ? 'border-gray-300 text-gray-600 hover:bg-gray-100' : 'border-[#A63228] text-[#A63228] hover:bg-red-50'}`}>
                                        {is2FAEnabled ? 'Turn Off' : 'Enable'}
                                    </button>
                                </div>
                            </div>
                            <div className="flex justify-between items-center py-2.5">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Last login</span>
                                <strong className="text-xs font-bold text-gray-900">August 23, 2026</strong>
                            </div>
                        </div>
                    </div>

                    {/* Preferences */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                        <h3 className="text-xs font-extrabold text-gray-900 mb-4">System Preferences</h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Language</span>
                                <select className="bg-[#f4f1ee] border border-transparent text-gray-900 text-xs font-bold rounded-lg p-2 w-40 outline-none appearance-none" style={selectStyles} defaultValue="English">
                                    <option value="English">English (US)</option>
                                    <option value="Tagalog">Tagalog</option>
                                </select>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Currency</span>
                                <select className="bg-[#f4f1ee] border border-transparent text-gray-900 text-xs font-bold rounded-lg p-2 w-40 outline-none appearance-none" style={selectStyles} defaultValue="PHP (₱)">
                                    <option value="PHP (₱)">PHP (₱)</option>
                                    <option value="USD ($)">USD ($)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═════════ MODALS ═════════ */}

            {/* 1. EDIT PROFILE MODAL */}
            {modalState === 'EDIT_PROFILE' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl p-7 w-full max-w-[480px] shadow-2xl relative">
                        <h3 className="text-lg font-extrabold text-[#1a1a1a] mb-1.5">Edit Profile</h3>
                        <p className="text-xs text-gray-500 mb-4 font-medium">Update your personal information to keep your account current.</p>

                        {errorMsg && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-[#A63228] text-xs font-bold rounded-lg">
                                {errorMsg}
                            </div>
                        )}

                        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-extrabold text-gray-700 mb-1.5 uppercase tracking-wider">First Name</label>
                                    <input type="text" name="firstName" value={formData.firstName || ''} onChange={handleNameChange} required className="w-full bg-[#f4f1ee] rounded-lg px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none transition-colors border border-transparent" />
                                </div>
                                <div>
                                    <label className="block text-xs font-extrabold text-gray-700 mb-1.5 uppercase tracking-wider">Middle Name</label>
                                    <input type="text" name="middleName" value={formData.middleName || ''} onChange={handleNameChange} className="w-full bg-[#f4f1ee] rounded-lg px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none transition-colors border border-transparent" />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-extrabold text-gray-700 mb-1.5 uppercase tracking-wider">Last Name</label>
                                    <input type="text" name="lastName" value={formData.lastName || ''} onChange={handleNameChange} required className="w-full bg-[#f4f1ee] rounded-lg px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none transition-colors border border-transparent" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-gray-700 mb-1.5 uppercase tracking-wider">Email Address</label>
                                <input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] rounded-lg px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none transition-colors border border-transparent" />
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-gray-700 mb-1.5 uppercase tracking-wider">Phone Number</label>
                                <input type="text" name="phone" value={formData.phone || ''} onChange={handlePhoneChange} maxLength="11" required className="w-full bg-[#f4f1ee] rounded-lg px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none transition-colors border border-transparent" placeholder="09XX XXX XXXX" />
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-gray-700 mb-1.5 uppercase tracking-wider">Home Address</label>
                                <div className="w-full bg-[#f4f1ee] rounded-lg p-4 focus-within:border-[#A63228] border border-transparent transition-colors">
                                    <div className="mb-3">
                                        <label className="block text-[10px] font-bold text-gray-600 mb-1 uppercase">House No. / Building / Street / Subdivision</label>
                                        <input
                                            type="text"
                                            name="street"
                                            value={formData.street || ''}
                                            onChange={handleInputChange}
                                            placeholder="e.g. Unit 4B, 123 Rizal Ave, Villa Verde"
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-900 focus:border-[#A63228] outline-none"
                                        />
                                    </div>

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
                                            setFormData(prev => ({ ...prev, addressObj: newObj, homeAddress: fullAddress }));
                                        }} 
                                    />
                                    {formData.homeAddress && (
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                            <span className="text-[9px] font-bold text-gray-500 uppercase">Complete Address Preview</span>
                                            <p className="text-xs font-bold text-gray-900 mt-1 leading-relaxed">{formData.homeAddress}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => setModalState('NONE')} disabled={saving} className="flex-1 py-3 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-xs font-extrabold hover:bg-red-50 transition-colors uppercase tracking-wider">Cancel</button>
                                <button type="submit" disabled={saving} className="flex-1 py-3 bg-[#8B1A10] text-white rounded-xl text-xs font-extrabold hover:bg-[#72150d] transition-colors shadow-sm uppercase tracking-wider disabled:opacity-50">
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 2. CHANGE PASSWORD MODAL */}
            {modalState === 'CHANGE_PASS' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl p-7 w-full max-w-[480px] shadow-2xl relative">
                        <h3 className="text-lg font-extrabold text-[#1a1a1a] mb-1.5">Change Password</h3>
                        <p className="text-xs text-gray-500 mb-4 font-medium">Please enter your current password and choose a secure new password.</p>

                        {errorMsg && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-[#A63228] text-xs font-bold rounded-lg">
                                {errorMsg}
                            </div>
                        )}

                        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-extrabold text-gray-700 mb-1.5 uppercase tracking-wider">Current Password</label>
                                <input type="password" name="current" value={formData.current || ''} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] rounded-lg px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none tracking-widest border border-transparent" placeholder="••••••••" />
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-gray-700 mb-1.5 uppercase tracking-wider">New Password</label>
                                <input type="password" name="newPass" value={formData.newPass || ''} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] rounded-lg px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none tracking-widest border border-transparent" placeholder="••••••••" />
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-gray-700 mb-1.5 uppercase tracking-wider">Confirm New Password</label>
                                <input type="password" name="confirm" value={formData.confirm || ''} onChange={handleInputChange} required className="w-full bg-[#f4f1ee] rounded-lg px-4 py-3 text-sm font-medium focus:border-[#A63228] outline-none tracking-widest border border-transparent" placeholder="••••••••" />
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button type="button" onClick={() => setModalState('NONE')} disabled={saving} className="flex-1 py-3 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-xs font-extrabold hover:bg-red-50 transition-colors uppercase tracking-wider">Cancel</button>
                                <button type="submit" disabled={saving} className="flex-1 py-3 bg-[#8B1A10] text-white rounded-xl text-xs font-extrabold hover:bg-[#72150d] transition-colors shadow-sm uppercase tracking-wider disabled:opacity-50">
                                    {saving ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 3. TWO-FACTOR AUTHENTICATION MODAL */}
            {modalState === 'TWO_FACTOR' && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl p-7 w-full max-w-[420px] shadow-2xl relative text-center">
                        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-600">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                        <h3 className="text-lg font-extrabold text-[#1a1a1a] mb-2">{is2FAEnabled ? 'Disable Two-Factor Auth?' : 'Enable Two-Factor Auth'}</h3>
                        <p className="text-xs text-gray-500 mb-6 font-medium px-4 leading-relaxed">
                            {is2FAEnabled
                                ? 'Are you sure you want to turn off two-factor authentication? Your account will be less secure.'
                                : 'To enable 2FA, please enter the 6-digit verification code sent to your email.'}
                        </p>

                        <form onSubmit={handleToggle2FA} className="flex flex-col gap-5">
                            {!is2FAEnabled && (
                                <div>
                                    <input type="text" name="code" value={formData.code || ''} onChange={handleInputChange} required maxLength="6" className="w-full bg-[#f4f1ee] rounded-lg px-4 py-3 text-2xl font-bold focus:border-[#A63228] outline-none text-center tracking-[0.5em] border border-transparent" placeholder="000000" />
                                </div>
                            )}

                            <div className="flex gap-3 mt-2">
                                <button type="button" onClick={() => setModalState('NONE')} className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-extrabold hover:bg-gray-50 transition-colors uppercase tracking-wider">Cancel</button>
                                <button type="submit" className={`flex-1 py-3 text-white rounded-xl text-xs font-extrabold transition-colors shadow-sm uppercase tracking-wider ${is2FAEnabled ? 'bg-[#A63228] hover:bg-[#8B1A10]' : 'bg-[#2e7d32] hover:bg-[#1b5e20]'}`}>
                                    {is2FAEnabled ? 'Disable 2FA' : 'Verify & Enable'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 4. SUCCESS MODAL */}
            {modalState === 'SUCCESS' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
                    <div className="bg-white rounded-2xl p-7 w-full max-w-[320px] shadow-2xl text-center relative">
                        <div className="w-14 h-14 bg-[#e6f4ea] rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-base font-extrabold text-gray-900 mb-2">Success!</h3>
                        <p className="text-xs text-gray-500 font-medium mb-6 leading-relaxed">{successMsg}</p>
                        <button onClick={() => setModalState('NONE')} className="w-full py-3 bg-[#8B1A10] text-white rounded-xl text-xs font-extrabold hover:bg-[#72150d] transition-colors uppercase tracking-wider">Done</button>
                    </div>
                </div>
            )}

        </AdminLayout>
    )
}
