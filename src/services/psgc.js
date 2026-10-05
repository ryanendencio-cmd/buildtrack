// PSGC (Philippine Standard Geographic Code) API Service
// Standard endpoint: https://psgc.gitlab.io/api/

const API_BASE = 'https://psgc.gitlab.io/api';

// In-memory cache to prevent unnecessary re-fetching
const cache = {
    regions: null,
    provinces: {},
    cities: {},
    barangays: {}
};

// Fallback regions in case network/offline
const FALLBACK_REGIONS = [
    { code: '130000000', name: 'NCR', regionName: 'National Capital Region' },
    { code: '010000000', name: 'Ilocos Region', regionName: 'Region I' },
    { code: '020000000', name: 'Cagayan Valley', regionName: 'Region II' },
    { code: '030000000', name: 'Central Luzon', regionName: 'Region III' },
    { code: '040000000', name: 'CALABARZON', regionName: 'Region IV-A' },
    { code: '170000000', name: 'MIMAROPA Region', regionName: 'MIMAROPA' },
    { code: '050000000', name: 'Bicol Region', regionName: 'Region V' },
    { code: '060000000', name: 'Western Visayas', regionName: 'Region VI' },
    { code: '070000000', name: 'Central Visayas', regionName: 'Region VII' },
    { code: '080000000', name: 'Eastern Visayas', regionName: 'Region VIII' },
    { code: '090000000', name: 'Zamboanga Peninsula', regionName: 'Region IX' },
    { code: '100000000', name: 'Northern Mindanao', regionName: 'Region X' },
    { code: '110000000', name: 'Davao Region', regionName: 'Region XI' },
    { code: '120000000', name: 'SOCCSKSARGEN', regionName: 'Region XII' },
    { code: '140000000', name: 'CAR', regionName: 'Cordillera Administrative Region' },
    { code: '160000000', name: 'Caraga', regionName: 'Region XIII' },
    { code: '150000000', name: 'BARMM', regionName: 'Bangsamoro Autonomous Region in Muslim Mindanao' }
];

export async function getRegions() {
    if (cache.regions) return cache.regions;
    try {
        const res = await fetch(`${API_BASE}/regions.json`);
        if (!res.ok) throw new Error('Failed to fetch regions');
        const data = await res.json();
        cache.regions = data.sort((a, b) => (a.regionName || a.name).localeCompare(b.regionName || b.name));
        return cache.regions;
    } catch (err) {
        console.warn('Using fallback regions due to network error:', err);
        cache.regions = FALLBACK_REGIONS;
        return cache.regions;
    }
}

export async function getProvinces(regionCode) {
    if (!regionCode) return [];
    if (cache.provinces[regionCode]) return cache.provinces[regionCode];

    // NCR has no provinces
    if (regionCode === '130000000' || regionCode === '1300000000') {
        const ncrProv = [{ code: 'NCR', name: 'Metro Manila (NCR)' }];
        cache.provinces[regionCode] = ncrProv;
        return ncrProv;
    }

    try {
        const res = await fetch(`${API_BASE}/regions/${regionCode}/provinces.json`);
        if (!res.ok) throw new Error('Failed to fetch provinces');
        const data = await res.json();
        if (data.length === 0) {
            // Region without provinces (e.g. NCR or special independent region)
            const defaultProv = [{ code: regionCode, name: 'Special Region / Direct Cities' }];
            cache.provinces[regionCode] = defaultProv;
            return defaultProv;
        }
        data.sort((a, b) => a.name.localeCompare(b.name));
        cache.provinces[regionCode] = data;
        return data;
    } catch (err) {
        console.warn('Error loading provinces:', err);
        return [];
    }
}

export async function getCitiesMunicipalities(regionCode, provinceCode) {
    if (!regionCode) return [];
    const cacheKey = `${regionCode}_${provinceCode}`;
    if (cache.cities[cacheKey]) return cache.cities[cacheKey];

    try {
        let url = '';
        if (provinceCode && provinceCode !== 'NCR' && provinceCode !== regionCode) {
            url = `${API_BASE}/provinces/${provinceCode}/cities-municipalities.json`;
        } else {
            url = `${API_BASE}/regions/${regionCode}/cities-municipalities.json`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch cities/municipalities');
        const data = await res.json();
        data.sort((a, b) => a.name.localeCompare(b.name));
        cache.cities[cacheKey] = data;
        return data;
    } catch (err) {
        console.warn('Error loading cities:', err);
        return [];
    }
}

export async function getBarangays(cityCode) {
    if (!cityCode) return [];
    if (cache.barangays[cityCode]) return cache.barangays[cityCode];

    try {
        const res = await fetch(`${API_BASE}/cities-municipalities/${cityCode}/barangays.json`);
        if (!res.ok) throw new Error('Failed to fetch barangays');
        const data = await res.json();
        data.sort((a, b) => a.name.localeCompare(b.name));
        cache.barangays[cityCode] = data;
        return data;
    } catch (err) {
        console.warn('Error loading barangays:', err);
        return [];
    }
}

export function formatRegionLabel(region) {
    if (!region) return '';
    if (region.regionName && region.name && !region.name.includes(region.regionName)) {
        return `${region.regionName} - ${region.name}`;
    }
    return region.regionName || region.name;
}

// Philippine Zip Codes lookup table by City/Municipality name
const PHILIPPINE_ZIP_CODES = {
    // NCR (Metro Manila)
    "manila": "1000",
    "city of manila": "1000",
    "quezon city": "1100",
    "makati": "1200",
    "city of makati": "1200",
    "pasay": "1300",
    "city of pasay": "1300",
    "caloocan": "1400",
    "city of caloocan": "1400",
    "navotas": "1485",
    "city of navotas": "1485",
    "malabon": "1470",
    "city of malabon": "1470",
    "valenzuela": "1440",
    "city of valenzuela": "1440",
    "mandaluyong": "1550",
    "city of mandaluyong": "1550",
    "san juan": "1500",
    "city of san juan": "1500",
    "pasig": "1600",
    "city of pasig": "1600",
    "taguig": "1630",
    "city of taguig": "1630",
    "pateros": "1620",
    "marikina": "1800",
    "city of marikina": "1800",
    "parañaque": "1700",
    "city of parañaque": "1700",
    "las piñas": "1740",
    "city of las piñas": "1740",
    "muntinlupa": "1770",
    "city of muntinlupa": "1770",

    // Cavite
    "bacoor": "4102",
    "city of bacoor": "4102",
    "imus": "4103",
    "city of imus": "4103",
    "dasmariñas": "4114",
    "city of dasmariñas": "4114",
    "general trias": "4107",
    "city of general trias": "4107",
    "tagaytay": "4120",
    "city of tagaytay": "4120",
    "cavite city": "4100",
    "city of cavite": "4100",
    "trece martires": "4109",
    "city of trece martires": "4109",
    "silang": "4118",
    "carmona": "4116",
    "kawit": "4104",
    "noveleta": "4105",
    "rosario": "4106",
    "tanza": "4108",
    "naic": "4110",
    "alfonso": "4123",

    // Laguna
    "santa rosa": "4026",
    "city of santa rosa": "4026",
    "calamba": "4027",
    "city of calamba": "4027",
    "biñan": "4024",
    "city of biñan": "4024",
    "san pedro": "4023",
    "city of san pedro": "4023",
    "cabuyao": "4025",
    "city of cabuyao": "4025",
    "los baños": "4030",
    "san pablo": "4000",
    "city of san pablo": "4000",
    "santa cruz": "4009",

    // Batangas
    "batangas city": "4200",
    "city of batangas": "4200",
    "lipa city": "4217",
    "city of lipa": "4217",
    "tanauan": "4232",
    "city of tanauan": "4232",
    "santo tomas": "4234",
    "city of santo tomas": "4234",
    "bauan": "4201",
    "nasugbu": "4231",

    // Bulacan
    "malolos": "3000",
    "city of malolos": "3000",
    "meycauayan": "3020",
    "city of meycauayan": "3020",
    "san jose del monte": "3023",
    "city of san jose del monte": "3023",
    "marilao": "3019",
    "bocaue": "3018",
    "santa maria": "3022",
    "baliuag": "3006",
    "city of baliwag": "3006",

    // Pampanga
    "san fernando": "2000",
    "city of san fernando": "2000",
    "angeles city": "2009",
    "city of angeles": "2009",
    "mabalacat": "2010",
    "city of mabalacat": "2010",
    "guagua": "2003",
    "lubao": "2005",

    // Rizal
    "antipolo": "1870",
    "city of antipolo": "1870",
    "cainta": "1900",
    "taytay": "1920",
    "angono": "1930",
    "binangonan": "1940",
    "san mateo": "1850",

    // Cebu
    "cebu city": "6000",
    "city of cebu": "6000",
    "mandaue": "6014",
    "city of mandaue": "6014",
    "lapu-lapu": "6015",
    "city of lapu-lapu": "6015",
    "talisay": "6045",
    "city of talisay": "6045",
    "naga": "6037",
    "city of naga": "6037",

    // Davao
    "davao city": "8000",
    "city of davao": "8000",
    "tagum": "8100",
    "city of tagum": "8100",
    "digos": "8002",
    "city of digos": "8002",

    // Major Regional Capitals
    "iloilo city": "5000",
    "city of iloilo": "5000",
    "bacolod": "6100",
    "city of bacolod": "6100",
    "cagayan de oro": "9000",
    "city of cagayan de oro": "9000",
    "general santos": "9500",
    "city of general santos": "9500",
    "zamboanga city": "7000",
    "city of zamboanga": "7000",
    "baguio": "2600",
    "city of baguio": "2600",
    "laoag": "2900",
    "city of laoag": "2900",
    "vigan": "2700",
    "city of vigan": "2700",
    "tuguegarao": "3500",
    "city of tuguegarao": "3500",
    "legazpi": "4500",
    "city of legazpi": "4500",
    "tacloban": "6500",
    "city of tacloban": "6500",
    "puerto princesa": "5300",
    "city of puerto princesa": "5300",
    "cotabato city": "9400",
    "city of cotabato": "9400",
    "butuan": "8600",
    "city of butuan": "8600"
};

export function getZipCodeForCity(cityName, cityCode) {
    if (!cityName) return '';
    const cleanName = cityName.trim().toLowerCase();

    if (PHILIPPINE_ZIP_CODES[cleanName]) {
        return PHILIPPINE_ZIP_CODES[cleanName];
    }

    const strippedName = cleanName.replace(/^city of\s+/i, '');
    if (PHILIPPINE_ZIP_CODES[strippedName]) {
        return PHILIPPINE_ZIP_CODES[strippedName];
    }

    if (cityCode && cityCode.length >= 4) {
        const prefix = cityCode.substring(0, 2);
        const zipPrefixMap = {
            '01': '2900',
            '02': '3500',
            '03': '2000',
            '04': '4000',
            '05': '4500',
            '06': '5000',
            '07': '6000',
            '08': '6500',
            '09': '7000',
            '10': '9000',
            '11': '8000',
            '12': '9500',
            '13': '1000',
            '14': '2600',
            '15': '9600',
            '16': '8600',
            '17': '5200'
        };
        return zipPrefixMap[prefix] || '1000';
    }

    return '1000';
}

export async function parseLocationToAddress(locStr) {
    if (!locStr) return null;
    const parts = locStr.split(',').map(s => s.trim());
    const locLower = locStr.toLowerCase();

    const regions = await getRegions();

    function findRegionInText(text) {
        if (!text) return null;
        const lower = text.toLowerCase();
        const sortedByName = [...regions].sort((a, b) => (b.name || '').length - (a.name || '').length);
        for (const r of sortedByName) {
            if (r.name && lower.includes(r.name.toLowerCase())) return r;
        }
        const sortedByRegionName = [...regions].sort((a, b) => (b.regionName || '').length - (a.regionName || '').length);
        for (const r of sortedByRegionName) {
            if (r.regionName && lower.includes(r.regionName.toLowerCase())) return r;
        }
        return null;
    }

    function cleanName(str) {
        return (str || '').toLowerCase()
            .replace(/^(brgy\.?|city of|municipality of)\s+/i, '')
            .replace(/\s+(city|municipality)$/i, '')
            .trim();
    }

    // Check if parts[0] is region (Mobile format)
    const firstPartRegion = findRegionInText(parts[0]);
    // Check if last part is region (Web format)
    const lastPartRegion = findRegionInText(parts[parts.length - 1]);

    const isMobileFormat = Boolean(firstPartRegion);
    const matchedRegion = firstPartRegion || lastPartRegion || findRegionInText(locStr);

    if (!matchedRegion) {
        return {
            regionCode: '',
            regionName: '',
            provinceCode: '',
            provinceName: '',
            cityCode: '',
            cityName: '',
            barangayName: '',
            street: ''
        };
    }

    const regCode = matchedRegion.code;
    const regName = formatRegionLabel(matchedRegion);
    const isNCR = regCode === '130000000';

    let provTarget = '';
    let cityTarget = '';
    let bgyTarget = '';
    let streetVal = '';

    if (isMobileFormat) {
        // Mobile format: [Region, Province, City, Barangay]
        // or NCR: [Region, Metro Manila, City, Barangay]
        provTarget = parts[1] || '';
        cityTarget = isNCR && parts.length === 3 ? parts[1] : (parts[2] || '');
        bgyTarget = parts[3] || parts[parts.length - 1] || '';
    } else {
        // Web format: [Street?, Brgy?, City, Province, Region]
        // or NCR: [Street?, Brgy?, City, Metro Manila?, NCR]
        const bgyPart = parts.find(p => p.toLowerCase().startsWith('brgy.'));
        bgyTarget = bgyPart ? bgyPart.replace(/brgy\./i, '').trim() : '';

        if (parts[0] && !parts[0].toLowerCase().startsWith('brgy.') && !parts[0].toLowerCase().startsWith('zip')) {
            streetVal = parts[0];
        }

        if (isNCR) {
            const mmIndex = parts.findIndex(p => p.toLowerCase().includes('metro manila'));
            cityTarget = mmIndex > 0 ? parts[mmIndex - 1] : (parts.length > 2 ? parts[parts.length - 2] : '');
        } else {
            provTarget = parts.length > 3 ? parts[parts.length - 2] : '';
            cityTarget = parts.length > 2 ? parts[parts.length - (parts.length > 4 ? 3 : 2)] : '';
        }
    }

    let provCode = isNCR ? 'NCR' : '';
    let provName = isNCR ? 'Metro Manila (NCR)' : '';
    let cityCode = '';
    let cityName = '';
    let bgyVal = '';

    try {
        if (!isNCR) {
            const provRes = await getProvinces(regCode);
            const cleanProv = cleanName(provTarget);
            const matchedProv = provRes.find(p => cleanName(p.name) === cleanProv) || 
                                provRes.find(p => cleanName(p.name).includes(cleanProv) || cleanProv.includes(cleanName(p.name)));
            if (matchedProv) {
                provCode = matchedProv.code;
                provName = matchedProv.name;
            }
        }

        // Fetch cities for province or NCR region
        let cities = [];
        if (isNCR) {
            cities = await getCitiesMunicipalities(regCode, 'NCR');
        } else if (provCode) {
            cities = await getCitiesMunicipalities(regCode, provCode);
        }

        if (cities && cities.length > 0) {
            const cleanCity = cleanName(cityTarget);
            
            // PRIORITY 1: Exact name match on target part!
            let matchedCity = cities.find(c => cleanName(c.name) === cleanCity);
            
            // PRIORITY 2: Match with prefix/suffix (e.g. City of Calamba vs Calamba)
            if (!matchedCity && cleanCity) {
                matchedCity = cities.find(c => cleanName(c.name).includes(cleanCity) || cleanCity.includes(cleanName(c.name)));
            }

            if (matchedCity) {
                cityCode = matchedCity.code;
                cityName = matchedCity.name;

                // Fetch barangays for this city
                const bgys = await getBarangays(cityCode);
                const cleanBgy = cleanName(bgyTarget);

                let matchedBgy = bgys.find(b => cleanName(b.name) === cleanBgy);
                if (!matchedBgy && cleanBgy) {
                    matchedBgy = bgys.find(b => cleanName(b.name).includes(cleanBgy) || cleanBgy.includes(cleanName(b.name)));
                }
                if (matchedBgy) {
                    bgyVal = matchedBgy.name;
                } else {
                    bgyVal = bgyTarget;
                }
            }
        }
    } catch (e) {
        console.warn('Error resolving address details:', e);
    }

    return {
        regionCode: regCode,
        regionName: regName,
        provinceCode: provCode,
        provinceName: provName || provTarget,
        cityCode: cityCode,
        cityName: cityName || cityTarget,
        barangayName: bgyVal || bgyTarget,
        street: streetVal
    };
}
