// Standard Construction Materials and Specific Units
// BuildTrack Construction Management System

export const CONSTRUCTION_MATERIALS = [
    {
        name: 'Cement',
        units: ['bags', 'sacks', 'bag/s', 'sack/s'],
        keywords: ['cement', 'portland', 'pozzolan', 'cemento', 'semento', 'holcim', 'eagle', 'republic', 'apo', 'vulcan']
    },
    {
        name: 'Sand',
        units: ['cu.m', 'truckload', 'elf load', 'cu.m/s'],
        keywords: ['sand', 'buhangin', 'washed sand', 'fine sand', 'vibro sand']
    },
    {
        name: 'Gravel',
        units: ['cu.m', 'truckload', 'cu.m/s'],
        keywords: ['gravel', 'g1', 'g2', 'crushed stone', 'graba', '3/4 gravel']
    },
    {
        name: 'Steel Rebar (Deformed Bars)',
        units: ['pcs', 'length', 'kg', 'ton'],
        keywords: ['steel', 'steel rebar', 'steel bar', 'rebar', 'reinforcing bar', 'deformed bar', 'bakal', 'kabilya', 'deformed', '10mm', '12mm', '16mm', '20mm', '25mm']
    },
    {
        name: 'Sealant / Silicone / Waterproofing',
        units: ['tubes', 'cans', 'gal', 'liters', 'rolls', 'tube/s', 'can/s', 'gal/s', 'liter/s', 'roll/s'],
        keywords: ['sealant', 'silicone', 'waterproofing', 'vulcaseal', 'epoxy sealant', 'seal']
    },
    {
        name: 'G.I. Tie Wire',
        units: ['kg', 'rolls', 'kg/s', 'roll/s'],
        keywords: ['tie wire', 'g.i. tie wire', 'gi tie wire', 'alambre', '#16 wire', 'wire mesh', 'binding wire']
    },
    {
        name: 'C-Purlins / Tubular / Angle Bars',
        units: ['pcs', 'lengths', 'kg', 'pc/s', 'length/s', 'kg/s'],
        keywords: ['purlin', 'c-purlin', 'tubular', 'angle bar', 'channel bar', 'structural bar', 'square tube']
    },
    {
        name: 'Corrugated G.I. Sheets',
        units: ['sheets', 'pcs', 'linear meters', 'pc/s', 'sheet/s', 'linear meter/s'],
        keywords: ['corrugated', 'g.i. sheet', 'gi sheet', 'yero', 'roofing sheet', 'rib type roofing', 'gauge sheet']
    },
    {
        name: 'Concrete Hollow Blocks (CHB)',
        units: ['pcs', 'pc/s'],
        keywords: ['hollow block', 'chb', 'concrete hollow block', 'concrete block', '4 inch block', '6 inch block', '4"', '6"']
    },
    {
        name: 'Bricks / Pavers',
        units: ['pcs', 'sq.m', 'pc/s', 'sq.m/s'],
        keywords: ['brick', 'paver', 'ladrilyo', 'interlocking block', 'paving block', 'clay brick']
    },
    {
        name: 'Lumber / Coco Lumber',
        units: ['bd.ft', 'pcs', 'bd.ft/s (board feet)', 'pc/s'],
        keywords: ['lumber', 'coco lumber', 'good lumber', 'kahoy', 'form lumber', 'rough lumber', '2x2', '2x3', '2x4', 'wood']
    },
    {
        name: 'Plywood / Phenolic Board',
        units: ['sheets', 'pcs', 'sheet/s', 'pc/s'],
        keywords: ['plywood', 'phenolic board', 'phenolic', 'marine plywood', 'ordinary plywood', 'film faced plywood']
    },
    {
        name: 'Gypsum Board / HardieFlex',
        units: ['sheets', 'pcs', 'sheet/s', 'pc/s'],
        keywords: ['gypsum board', 'gypsum', 'hardieflex', 'fiber cement board', 'ceiling board', 'drywall']
    },
    {
        name: 'Common Wire Nails',
        units: ['kg', 'boxes', 'kg/s', 'box/s'],
        keywords: ['common wire nails', 'common nail', 'cwn', 'pako', '1 inch nail', '2 inch nail', '3 inch nail', '4 inch nail']
    },
    {
        name: 'Concrete Nails',
        units: ['kg', 'boxes', 'kg/s', 'box/s'],
        keywords: ['concrete nails', 'concrete nail', 'masonry nail', 'pako sa semento']
    },
    {
        name: 'Tekscrew / Drywall Screws / Blind Rivets',
        units: ['pcs', 'boxes', 'packs', 'pc/s', 'box/s', 'pack/s'],
        keywords: ['tekscrew', 'drywall screw', 'blind rivet', 'rivet', 'screw', 'metal screw', 'self-drilling screw']
    },
    {
        name: 'PVC / PPR Pipes',
        units: ['pcs', 'lengths', 'meters', 'pc/s', 'length/s', 'meter/s'],
        keywords: ['pvc pipe', 'ppr pipe', 'tubo', 'water pipe', 'drain pipe', 'sanitary pipe', 'blue pipe', 'orange pipe']
    },
    {
        name: 'Pipe Fittings',
        units: ['pcs', 'pc/s'],
        keywords: ['pipe fitting', 'elbow', 'tee', 'coupling', 'fitting', 'adapter', 'bushing', 'cleanout']
    },
    {
        name: 'Teflon Tape',
        units: ['rolls', 'pcs', 'roll/s', 'pc/s'],
        keywords: ['teflon tape', 'teflon', 'seal tape', 'thread seal tape']
    },
    {
        name: 'Electrical Wire',
        units: ['boxes', 'meters', 'rolls', 'box/s', 'meter/s', 'roll/s'],
        keywords: ['electrical wire', 'thhn', 'thwn', 'wire', 'cable', 'romex', 'stranded wire', 'solid wire']
    },
    {
        name: 'PVC Conduit / Flexible Hose',
        units: ['pcs', 'lengths', 'meters', 'rolls', 'length/s (3m/pc)', 'meter/s', 'roll/s'],
        keywords: ['pvc conduit', 'flexible hose', 'conduit', 'electrical conduit', 'corrugated flexible hose']
    },
    {
        name: 'Utility Box / Junction Box / Breakers',
        units: ['pcs', 'sets', 'pc/s', 'set/s'],
        keywords: ['utility box', 'junction box', 'breaker', 'circuit breaker', 'panel board', 'safety switch']
    },
    {
        name: 'Paint',
        units: ['gal', 'pail', 'liters', 'tin', 'gal/s (4 Liters)', 'pail/s (16 Liters)', 'liter/s', 'tin/s'],
        keywords: ['paint', 'pintura', 'latex paint', 'enamel', 'primer', 'topcoat', 'flat latex', 'gloss paint']
    },
    {
        name: 'Skim Coat / Tile Adhesive / Grout',
        units: ['bags', 'sacks', 'packs', 'bag/s (20kg / 25kg)', 'pack/s (2kg)'],
        keywords: ['skim coat', 'tile adhesive', 'grout', 'tile grout', 'thinset']
    },
    {
        name: 'Floor & Wall Tiles',
        units: ['pcs', 'boxes', 'sq.m', 'pc/s', 'box/s', 'sq.m/s'],
        keywords: ['tile', 'tiles', 'floor tile', 'wall tile', 'granite tile', 'ceramic tile', 'porcelain tile', '60x60', '30x30']
    }
];

export const DEFAULT_MATERIAL_UNITS = [
    'pcs', 'bags', 'sacks', 'cu.m', 'kg', 'sheets', 'bd.ft', 'rolls', 'gal', 'pail', 'meters', 'lengths', 'tubes', 'cans', 'boxes', 'sets', 'lots', 'sq.m', 'liters', 'pc/s', 'bag/s', 'sack/s', 'kg/s', 'cu.m/s', 'sheet/s', 'day/s', 'hr/s', 'pax'
];

/**
 * Returns the specific list of units for a given material name,
 * with recommended units first, followed by all standard units.
 */
export const getUnitsForMaterial = (materialName) => {
    if (!materialName || typeof materialName !== 'string') return DEFAULT_MATERIAL_UNITS;
    const clean = materialName.trim().toLowerCase();
    if (!clean) return DEFAULT_MATERIAL_UNITS;

    // High priority checks for Cement / Cemento / Semento
    if (clean.includes('cemento') || clean.includes('semento') || clean.includes('cement') ||
        clean.includes('holcim') || clean.includes('eagle') || clean.includes('pozzolan') ||
        clean.includes('portland') || clean.includes('apo cement') || clean.includes('republic')) {
        return Array.from(new Set(['bags', 'sacks', 'bag/s', 'sack/s', ...DEFAULT_MATERIAL_UNITS]));
    }

    // High priority checks for Steel / Bakal / Rebar / Kabilya
    if (clean.includes('bakal') || clean.includes('kabilya') || clean.includes('rebar') ||
        clean.includes('steel') || clean.includes('deformed')) {
        return Array.from(new Set(['pcs', 'length', 'kg', 'ton', ...DEFAULT_MATERIAL_UNITS]));
    }

    // High priority checks for Sand & Gravel / Buhangin & Graba
    if (clean.includes('sand') || clean.includes('buhangin') || clean.includes('gravel') ||
        clean.includes('graba') || clean.includes('vibro')) {
        return Array.from(new Set(['cu.m', 'truckload', 'elf load', ...DEFAULT_MATERIAL_UNITS]));
    }

    // High priority checks for Sheet materials (Plywood, Yero, Phenolic, Gypsum)
    if (clean.includes('plywood') || clean.includes('phenolic') || clean.includes('yero') ||
        clean.includes('corrugated') || clean.includes('gypsum') || clean.includes('hardieflex')) {
        return Array.from(new Set(['sheets', 'pcs', 'sheet/s', ...DEFAULT_MATERIAL_UNITS]));
    }

    // High priority checks for Lumber / Kahoy
    if (clean.includes('lumber') || clean.includes('kahoy')) {
        return Array.from(new Set(['bd.ft', 'pcs', 'bd.ft/s (board feet)', ...DEFAULT_MATERIAL_UNITS]));
    }

    // High priority checks for Wire / Nails / Pako / Alambre
    if (clean.includes('pako') || clean.includes('nail') || clean.includes('alambre') || clean.includes('tie wire')) {
        return Array.from(new Set(['kg', 'boxes', 'box/s', ...DEFAULT_MATERIAL_UNITS]));
    }

    // High priority checks for Paint / Pintura
    if (clean.includes('paint') || clean.includes('pintura')) {
        return Array.from(new Set(['gal', 'pail', 'liters', 'tin', ...DEFAULT_MATERIAL_UNITS]));
    }

    // 1. Exact match with registered material name
    const exact = CONSTRUCTION_MATERIALS.find(m => m.name.toLowerCase() === clean);
    if (exact) {
        return Array.from(new Set([...exact.units, ...DEFAULT_MATERIAL_UNITS]));
    }

    // 2. Case-insensitive substring match or keyword match
    const matched = CONSTRUCTION_MATERIALS.find(m => {
        const matLower = m.name.toLowerCase();
        if (clean.includes(matLower) || matLower.includes(clean)) return true;
        return m.keywords?.some(k => clean.includes(k) || k.includes(clean));
    });

    return Array.from(new Set([...(matched ? matched.units : []), ...DEFAULT_MATERIAL_UNITS]));
};

/**
 * Returns the dynamic default unit for a given material.
 * For cement / cemento -> 'bags'
 * For bakal / steel -> 'pcs'
 * For sand / buhangin / gravel / graba -> 'cu.m'
 * For plywood / yero -> 'sheets'
 * For kahoy / lumber -> 'bd.ft'
 * For pako / tie wire -> 'kg'
 * For pintura / paint -> 'gal'
 */
export const getDefaultUnitForMaterial = (materialName) => {
    if (!materialName || typeof materialName !== 'string') return 'pcs';
    const clean = materialName.trim().toLowerCase();
    if (!clean) return 'pcs';

    // Cement / Cemento / Semento
    if (clean.includes('cemento') || clean.includes('semento') || clean.includes('cement') ||
        clean.includes('holcim') || clean.includes('eagle') || clean.includes('pozzolan') ||
        clean.includes('portland') || clean.includes('apo cement') || clean.includes('republic') ||
        clean.includes('vulcan')) {
        return 'bags';
    }

    // Steel / Bakal / Rebar / Kabilya
    if (clean.includes('bakal') || clean.includes('kabilya') || clean.includes('rebar') ||
        clean.includes('steel') || clean.includes('deformed') || clean.includes('angle bar') ||
        clean.includes('c-purlin') || clean.includes('purlin') || clean.includes('tubular')) {
        return 'pcs';
    }

    // Sand & Gravel / Buhangin & Graba
    if (clean.includes('sand') || clean.includes('buhangin') || clean.includes('gravel') ||
        clean.includes('graba') || clean.includes('vibro') || clean.includes('crushed stone')) {
        return 'cu.m';
    }

    // Hollow Blocks / CHB / Bricks / Blocks
    if (clean.includes('hollow') || clean.includes('chb') || clean.includes('block') ||
        clean.includes('brick') || clean.includes('ladrilyo') || clean.includes('paver')) {
        return 'pcs';
    }

    // Plywood, Phenolic, Yero, HardieFlex, Gypsum
    if (clean.includes('plywood') || clean.includes('phenolic') || clean.includes('yero') ||
        clean.includes('corrugated') || clean.includes('gypsum') || clean.includes('hardieflex') ||
        clean.includes('sheet') || clean.includes('board')) {
        return 'sheets';
    }

    // Lumber / Kahoy
    if (clean.includes('lumber') || clean.includes('kahoy') || clean.includes('coco') || clean.includes('wood')) {
        return 'bd.ft';
    }

    // Tie Wire / Alambre / Nails / Pako
    if (clean.includes('pako') || clean.includes('nail') || clean.includes('alambre') ||
        clean.includes('tie wire') || clean.includes('wire mesh')) {
        return 'kg';
    }

    // Paint / Pintura
    if (clean.includes('paint') || clean.includes('pintura') || clean.includes('latex') ||
        clean.includes('enamel') || clean.includes('primer') || clean.includes('topcoat')) {
        return 'gal';
    }

    // Pipes / Tubo
    if (clean.includes('pipe') || clean.includes('tubo') || clean.includes('pvc') || clean.includes('ppr')) {
        return 'pcs';
    }

    // Sealants / VulcaSeal
    if (clean.includes('sealant') || clean.includes('silicone') || clean.includes('vulcaseal')) {
        return 'tubes';
    }

    // Electrical Wire / Cables
    if (clean.includes('electrical wire') || clean.includes('thhn') || clean.includes('thwn')) {
        return 'boxes';
    }

    // Teflon Tape / Mesh tape
    if (clean.includes('tape')) {
        return 'rolls';
    }

    const units = getUnitsForMaterial(materialName);
    return units && units.length > 0 ? units[0] : 'pcs';
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
