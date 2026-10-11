// Standard Construction Materials and Specific Units
// BuildTrack Construction Management System

export const CONSTRUCTION_MATERIALS = [
    {
        name: 'Cement',
        units: ['bag/s', 'sack/s'],
        keywords: ['cement', 'portland', 'pozzolan', 'semento']
    },
    {
        name: 'Sand',
        units: ['cu.m/s (cubic meter)', 'cu.yd/s', 'truckload/s', 'elf load/s'],
        keywords: ['sand', 'buhangin', 'washed sand', 'fine sand', 'vibro']
    },
    {
        name: 'Gravel',
        units: ['cu.m/s', 'cu.yd/s', 'truckload/s'],
        keywords: ['gravel', 'g1', 'g2', 'crushed stone', 'graba', '3/4']
    },
    {
        name: 'Deformed Reinforcing Bars (Rebar)',
        units: ['pc/s (piece)', 'length/s', 'kg/s', 'ton/s / MT'],
        keywords: ['rebar', 'reinforcing', 'deformed bar', 'bakal', '10mm', '12mm', '16mm', '20mm', '25mm']
    },
    {
        name: 'G.I. Tie Wire',
        units: ['kg/s', 'roll/s'],
        keywords: ['tie wire', 'g.i. tie wire', 'alambre', '#16']
    },
    {
        name: 'C-Purlins, Tubular, Angle Bars',
        units: ['pc/s', 'length/s', 'kg/s'],
        keywords: ['purlin', 'c-purlin', 'tubular', 'angle bar', 'channel bar', 'steel bar', 'square tube']
    },
    {
        name: 'Corrugated G.I. Sheets',
        units: ['pc/s', 'sheet/s', 'linear foot/s', 'linear meter/s'],
        keywords: ['corrugated', 'g.i. sheet', 'yero', 'roofing', 'rib type', 'gauge']
    },
    {
        name: 'Concrete Hollow Blocks',
        units: ['pc/s'],
        keywords: ['hollow block', 'chb', 'block', 'concrete block', '4 inch', '6 inch', '4"', '6"']
    },
    {
        name: 'Bricks / Pavers',
        units: ['pc/s', 'sq.m/s'],
        keywords: ['brick', 'paver', 'ladrilyo', 'interlocking', 'paving block']
    },
    {
        name: 'Lumber / Coco Lumber / Good Lumber',
        units: ['bd.ft/s (board feet)', 'pc/s'],
        keywords: ['lumber', 'coco lumber', 'good lumber', 'kahoy', 'form lumber', 'rough lumber', '2x2', '2x3', '2x4']
    },
    {
        name: 'Plywood / Phenolic Board',
        units: ['sheet/s', 'pc/s'],
        keywords: ['plywood', 'phenolic board', 'phenolic', 'marine plywood', 'ordinary plywood', 'film faced']
    },
    {
        name: 'Gypsum Board / HardieFlex',
        units: ['sheet/s', 'pc/s'],
        keywords: ['gypsum board', 'gypsum', 'hardieflex', 'fiber cement board', 'ceiling board', 'drywall']
    },
    {
        name: 'Common Wire Nails',
        units: ['kg/s', 'box/s'],
        keywords: ['common wire nails', 'common nail', 'cwn', 'pako', '1 inch', '2 inch', '3 inch', '4 inch']
    },
    {
        name: 'Concrete Nails',
        units: ['kg/s', 'box/s'],
        keywords: ['concrete nails', 'concrete nail', 'pako sa semento']
    },
    {
        name: 'Tekscrew / Drywall Screws / Blind Rivets',
        units: ['pc/s', 'box/s', 'pack/s'],
        keywords: ['tekscrew', 'drywall screw', 'blind rivet', 'rivet', 'screw', 'metal screw']
    },
    {
        name: 'PVC / PPR Pipes',
        units: ['pc/s', 'length/s', 'meter/s'],
        keywords: ['pvc pipe', 'ppr pipe', 'tubo', 'water pipe', 'drain pipe', 'sanitary pipe', 'blue pipe', 'orange pipe']
    },
    {
        name: 'Pipe Fittings',
        units: ['pc/s'],
        keywords: ['pipe fitting', 'elbow', 'tee', 'coupling', 'fitting', 'adapter', 'bushing', 'union patente', 'cleanout']
    },
    {
        name: 'Teflon Tape',
        units: ['roll/s', 'pc/s'],
        keywords: ['teflon tape', 'teflon', 'seal tape', 'thread seal']
    },
    {
        name: 'Electrical Wire',
        units: ['box/s', 'meter/s', 'roll/s'],
        keywords: ['electrical wire', 'thhn', 'thwn', 'wire', 'cable', 'romex', 'stranded wire', 'solid wire']
    },
    {
        name: 'PVC Conduit / Flexible Hose',
        units: ['length/s (3m/pc)', 'meter/s', 'roll/s'],
        keywords: ['pvc conduit', 'flexible hose', 'conduit', 'electrical pipe', 'corrugated flexible']
    },
    {
        name: 'Utility Box, Junction Box, Breakers',
        units: ['pc/s', 'set/s'],
        keywords: ['utility box', 'junction box', 'breaker', 'circuit breaker', 'panel board', 'safety switch']
    },
    {
        name: 'Paint',
        units: ['gal/s (4 Liters)', 'pail/s (16 Liters)', 'liter/s', 'tin/s'],
        keywords: ['paint', 'pintura', 'latex', 'enamel', 'primer', 'topcoat', 'epoxy', 'flat latex', 'gloss']
    },
    {
        name: 'Skim Coat / Tile Adhesive / Grout',
        units: ['bag/s (20kg / 25kg)', 'pack/s (2kg)'],
        keywords: ['skim coat', 'tile adhesive', 'grout', 'tile grout', 'thinset']
    },
    {
        name: 'Tiles (Floor & Wall Tiles)',
        units: ['pc/s', 'box/s', 'sq.m/s'],
        keywords: ['tile', 'tiles', 'floor tile', 'wall tile', 'granite tile', 'ceramic tile', 'porcelain tile', '60x60', '30x30']
    }
];

export const DEFAULT_MATERIAL_UNITS = [
    'pc/s', 'bag/s', 'box/s', 'kg/s', 'meter/s', 'roll/s', 'set/s', 'sq.m/s', 'cu.m/s', 'gal/s', 'pail/s', 'lot/s'
];

/**
 * Returns the specific list of units for a given material name.
 * If the material is not recognized or empty, returns DEFAULT_MATERIAL_UNITS.
 */
export const getUnitsForMaterial = (materialName) => {
    if (!materialName || typeof materialName !== 'string') return DEFAULT_MATERIAL_UNITS;
    const clean = materialName.trim().toLowerCase();
    if (!clean) return DEFAULT_MATERIAL_UNITS;

    // 1. Exact match with registered material name
    const exact = CONSTRUCTION_MATERIALS.find(m => m.name.toLowerCase() === clean);
    if (exact) return exact.units;

    // 2. Case-insensitive substring match or keyword match
    const matched = CONSTRUCTION_MATERIALS.find(m => {
        const matLower = m.name.toLowerCase();
        if (clean.includes(matLower) || matLower.includes(clean)) return true;
        return m.keywords?.some(k => clean.includes(k) || k.includes(clean));
    });

    return matched ? matched.units : DEFAULT_MATERIAL_UNITS;
};

/**
 * Returns the first default unit for a given material.
 */
export const getDefaultUnitForMaterial = (materialName) => {
    const units = getUnitsForMaterial(materialName);
    return units && units.length > 0 ? units[0] : 'pc/s';
};

/**
 * Resolves the standard material name from a customized or edited name.
 * Strips added words and restores the original base standard material.
 */
export const resolveStandardMaterial = (customName, baseMaterial = '') => {
    // If baseMaterial is given and customName still contains it, prioritize baseMaterial
    if (baseMaterial) {
        const base = CONSTRUCTION_MATERIALS.find(m => m.name.toLowerCase() === baseMaterial.toLowerCase());
        if (base) {
            if (!customName || customName.toLowerCase().includes(base.name.toLowerCase())) {
                return base.name;
            }
        }
    }

    if (!customName || typeof customName !== 'string') {
        return baseMaterial || '';
    }

    const clean = customName.trim().toLowerCase();
    if (!clean) return baseMaterial || '';

    // 1. Exact match with registered material name
    const exact = CONSTRUCTION_MATERIALS.find(m => m.name.toLowerCase() === clean);
    if (exact) return exact.name;

    // 2. Custom text contains a standard material name (longer names checked first)
    const sortedByNameLength = [...CONSTRUCTION_MATERIALS].sort((a, b) => b.name.length - a.name.length);
    const foundByName = sortedByNameLength.find(m => clean.includes(m.name.toLowerCase()));
    if (foundByName) return foundByName.name;

    // 3. Check if standard name contains the clean text
    const foundReverse = sortedByNameLength.find(m => m.name.toLowerCase().includes(clean));
    if (foundReverse) return foundReverse.name;

    // 4. Keyword match
    const foundByKeyword = CONSTRUCTION_MATERIALS.find(m => m.keywords?.some(k => clean.includes(k)));
    if (foundByKeyword) return foundByKeyword.name;

    return baseMaterial || '';
};
