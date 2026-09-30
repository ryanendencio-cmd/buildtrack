import React, { useState, useEffect } from 'react';
import {
    getRegions,
    getProvinces,
    getCitiesMunicipalities,
    getBarangays,
    formatRegionLabel
} from '../services/psgc';

export default function PhilippineAddressSelector({
    value = {},
    onChange,
    disabled = false
}) {
    const [regions, setRegions] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [cities, setCities] = useState([]);
    const [barangays, setBarangays] = useState([]);

    const [loadingRegions, setLoadingRegions] = useState(true);
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);
    const [loadingBarangays, setLoadingBarangays] = useState(false);

    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.5rem center',
        backgroundSize: '1em 1em'
    };

    // 1. Initial Load: Fetch Regions
    useEffect(() => {
        let isMounted = true;
        getRegions().then(data => {
            if (isMounted) {
                setRegions(data);
                setLoadingRegions(false);
            }
        }).catch(() => {
            if (isMounted) setLoadingRegions(false);
        });
        return () => { isMounted = false; };
    }, []);

    // 2. When Region changes, fetch Provinces
    useEffect(() => {
        let isMounted = true;
        if (!value.regionCode) {
            return;
        }

        queueMicrotask(() => setLoadingProvinces(true));
        getProvinces(value.regionCode).then(provList => {
            if (!isMounted) return;
            setProvinces(provList);
            setLoadingProvinces(false);
        }).catch(() => {
            if (isMounted) setLoadingProvinces(false);
        });
        return () => { isMounted = false; };
    }, [value.regionCode]);

    // 3. When Province changes, fetch Cities
    useEffect(() => {
        let isMounted = true;
        if (!value.regionCode || !value.provinceCode) {
            return;
        }

        queueMicrotask(() => setLoadingCities(true));
        getCitiesMunicipalities(value.regionCode, value.provinceCode).then(cityList => {
            if (!isMounted) return;
            setCities(cityList);
            setLoadingCities(false);
        }).catch(() => {
            if (isMounted) setLoadingCities(false);
        });
        return () => { isMounted = false; };
    }, [value.regionCode, value.provinceCode]);

    // 4. When City changes, fetch Barangays
    useEffect(() => {
        let isMounted = true;
        if (!value.cityCode) {
            return;
        }

        queueMicrotask(() => setLoadingBarangays(true));
        getBarangays(value.cityCode).then(bgyList => {
            if (!isMounted) return;
            setBarangays(bgyList);
            setLoadingBarangays(false);
        }).catch(() => {
            if (isMounted) setLoadingBarangays(false);
        });
        return () => { isMounted = false; };
    }, [value.cityCode]);

    // Event Handlers
    const handleRegionSelect = (e) => {
        const selectedCode = e.target.value;
        const reg = regions.find(r => r.code === selectedCode);
        const regName = reg ? formatRegionLabel(reg) : '';

        onChange({
            ...value,
            regionCode: selectedCode,
            regionName: regName,
            provinceCode: '',
            provinceName: '',
            cityCode: '',
            cityName: '',
            barangayName: ''
        });
    };

    const handleProvinceSelect = (e) => {
        const selectedCode = e.target.value;
        const prov = provinces.find(p => p.code === selectedCode);
        const provName = prov ? prov.name : selectedCode;

        onChange({
            ...value,
            provinceCode: selectedCode,
            provinceName: provName,
            cityCode: '',
            cityName: '',
            barangayName: ''
        });
    };

    const handleCitySelect = (e) => {
        const selectedCode = e.target.value;
        const cityObj = cities.find(c => c.code === selectedCode);
        const cityName = cityObj ? cityObj.name : '';

        onChange({
            ...value,
            cityCode: selectedCode,
            cityName: cityName,
            barangayName: ''
        });
    };

    const handleBarangaySelect = (e) => {
        const bgyName = e.target.value;
        onChange({
            ...value,
            barangayName: bgyName
        });
    };

    return (
        <div className="space-y-2">
            {/* Region & Province */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                    <label className="block text-[7px] font-bold text-gray-500 uppercase mb-0.5">
                        Region <span className="text-[#A63228]">*</span>
                    </label>
                    <select
                        value={value.regionCode || ''}
                        onChange={handleRegionSelect}
                        disabled={disabled || loadingRegions}
                        className="w-full bg-white border border-gray-200 rounded-md pl-2 pr-6 py-1 text-[9px] font-bold text-gray-800 outline-none appearance-none disabled:opacity-50 disabled:bg-gray-100"
                        style={selectStyles}
                    >
                        {loadingRegions ? (
                            <option value="">Loading regions...</option>
                        ) : (
                            <>
                                <option value="">Select Region</option>
                                {regions.map(r => (
                                    <option key={r.code} value={r.code}>
                                        {formatRegionLabel(r)}
                                    </option>
                                ))}
                            </>
                        )}
                    </select>
                </div>

                <div>
                    <label className="block text-[7px] font-bold text-gray-500 uppercase mb-0.5">
                        Province <span className="text-[#A63228]">*</span>
                    </label>
                    <select
                        value={value.provinceCode || ''}
                        onChange={handleProvinceSelect}
                        disabled={disabled || !value.regionCode || loadingProvinces}
                        className="w-full bg-white border border-gray-200 rounded-md pl-2 pr-6 py-1 text-[9px] font-bold text-gray-800 outline-none appearance-none disabled:opacity-50 disabled:bg-gray-100"
                        style={selectStyles}
                    >
                        {loadingProvinces ? (
                            <option value="">Loading provinces...</option>
                        ) : provinces.length === 0 ? (
                            <option value="">Select Region First</option>
                        ) : (
                            <>
                                <option value="">Select Province</option>
                                {provinces.map(p => (
                                    <option key={p.code} value={p.code}>
                                        {p.name}
                                    </option>
                                ))}
                            </>
                        )}
                    </select>
                </div>
            </div>

            {/* Municipality/City & Barangay */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                    <label className="block text-[7px] font-bold text-gray-500 uppercase mb-0.5">
                        Municipality / City <span className="text-[#A63228]">*</span>
                    </label>
                    <select
                        value={value.cityCode || ''}
                        onChange={handleCitySelect}
                        disabled={disabled || !value.provinceCode || loadingCities}
                        className="w-full bg-white border border-gray-200 rounded-md pl-2 pr-6 py-1 text-[9px] font-bold text-gray-800 outline-none appearance-none disabled:opacity-50 disabled:bg-gray-100"
                        style={selectStyles}
                    >
                        {loadingCities ? (
                            <option value="">Loading cities...</option>
                        ) : cities.length === 0 ? (
                            <option value="">Select Province First</option>
                        ) : (
                            <>
                                <option value="">Select Municipality / City</option>
                                {cities.map(c => (
                                    <option key={c.code} value={c.code}>
                                        {c.name}
                                    </option>
                                ))}
                            </>
                        )}
                    </select>
                </div>

                <div>
                    <label className="block text-[7px] font-bold text-gray-500 uppercase mb-0.5">
                        Barangay <span className="text-[#A63228]">*</span>
                    </label>
                    <select
                        value={value.barangayName || ''}
                        onChange={handleBarangaySelect}
                        disabled={disabled || !value.cityCode || loadingBarangays}
                        className="w-full bg-white border border-gray-200 rounded-md pl-2 pr-6 py-1 text-[9px] font-bold text-gray-800 outline-none appearance-none disabled:opacity-50 disabled:bg-gray-100"
                        style={selectStyles}
                    >
                        {loadingBarangays ? (
                            <option value="">Loading barangays...</option>
                        ) : barangays.length === 0 ? (
                            <option value="">Select City First</option>
                        ) : (
                            <>
                                <option value="">Select Barangay</option>
                                {barangays.map(b => (
                                    <option key={b.code || b.name} value={b.name}>
                                        {b.name}
                                    </option>
                                ))}
                            </>
                        )}
                    </select>
                </div>
            </div>
        </div>
    );
}
