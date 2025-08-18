const WIKI_BASE = 'https://oldschool.runescape.wiki';
const API_BASE = `${WIKI_BASE}/api.php`;

const REQUIRED_PRINTOUTS = [
    'Attack bonus',
    'Attack level',
    'Attack speed',
    'Attack style',
    'Combat level',
    'Crush defence bonus',
    'Defence level',
    'Flat armour',
    'Hitpoints',
    'Image',
    'Immune to poison',
    'Immune to venom',
    'Magic Damage bonus',
    'Magic attack bonus',
    'Magic defence bonus',
    'Magic level',
    'Max hit',
    'Monster attribute',
    'Name',
    'Range attack bonus',
    'Ranged Strength bonus',
    'Range defence bonus',
    'Ranged level',
    'Slash defence bonus',
    'Slayer category',
    'Slayer experience',
    'Stab defence bonus',
    'Strength bonus',
    'Strength level',
    'Size',
    'NPC ID',
    'Category',
    'Elemental weakness',
    'Elemental weakness percent',
    'Light range defence bonus',
    'Standard range defence bonus',
    'Heavy range defence bonus',
    'Immune to burn'
];

export type Monster = {
    id: number;
    name: string;
    version: string;
    image: string;
    level: number;
    speed: number;
    style: string[] | null;
    size: number;
    max_hit: number;
    skills: {
        atk: number;
        def: number;
        hp: number;
        magic: number;
        ranged: number;
        str: number;
    };
    offensive: {
        atk: number;
        magic: number;
        magic_str: number;
        ranged: number;
        ranged_str: number;
        str: number;
    };
    defensive: {
        flat_armour: number;
        crush: number;
        magic: number;
        heavy: number;
        standard: number;
        light: number;
        slash: number;
        stab: number;
    };
    attributes: any[];
    immunities: {
        burn: string | null;
    };
    weakness?: {
        element: string;
        severity: number;
    } | null;
};

function getPrintoutValue<T>(prop: T[], allResults = false): T | T[] | null {
    if (!prop || prop.length === 0) return null;
    return allResults ? prop : prop[0];
}

function hasCategory(categoryArray: any[], category: string) {
    return categoryArray?.some((c: any) => c.fulltext === `Category:${category}`);
}

const stripMarkerRegex = /['"`]*UNIQ--[a-zA-Z0-9]+-[0-9A-F]{8}-QINU['"`]*/g;
function stripParserTags(value: any): any {
    if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) return value.map(stripParserTags);
        const out: any = {};
        for (const k in value) out[k] = stripParserTags(value[k]);
        return out;
    } else if (typeof value === 'string') {
        return value.replace(stripMarkerRegex, '').trim();
    }
    return value;
}

async function fetchMonstersFromWiki(): Promise<Monster[]> {
    let monsters: Record<string, any> = {};
    let offset = 0;

    while (true) {
        const query = new URLSearchParams({
            action: 'ask',
            format: 'json',
            query: `[[Uses infobox::Monster]]|?${REQUIRED_PRINTOUTS.join('|?')}|limit=500|offset=${offset}`
        }).toString();

        const url = `${API_BASE}?${query}`;
        const resp = await fetch(url /* Remove User-Agent header for browser CORS */);
        const data = await resp.json();

        if (!data.query?.results) break;
        monsters = { ...monsters, ...data.query.results };

        if (!data['query-continue-offset'] || Number(data['query-continue-offset']) <= offset) break;
        offset = data['query-continue-offset'];
    }

    const result: Monster[] = [];
    for (const k in monsters) {
        const v = monsters[k];
        if (!v.printouts) continue;
        const po = v.printouts;

        let version = '';
        try {
            version = k.split('#', 2)[1] || '';
        } catch { version = ''; }

        if (/^([A-z]*):/.test(k)) continue;
        if (hasCategory(po['Category'], 'Non-interactive scenery')) continue;
        if (hasCategory(po['Category'], 'Discontinued content')) continue;
        if (version.includes('Spawn point')) continue;
        if (version.includes('Asleep') || version.includes('Defeated')) continue;

        let monster_style = getPrintoutValue(po['Attack style'], true) as string[] | null;
        // Fix: check if monster_style is an array with a single value 'None' or 'N/A'
        if (
            Array.isArray(monster_style) &&
            monster_style.length === 1 &&
            (monster_style[0] === 'None' || monster_style[0] === 'N/A')
        ) {
            monster_style = null;
        }
        if (k.includes('Spinolyp')) monster_style = ['Ranged'];

        let burn_immunity = getPrintoutValue(po['Immune to burn']) as string | null;
        if (burn_immunity) {
            const lower = burn_immunity.toLowerCase();
            if (lower.includes('weak')) burn_immunity = 'Weak';
            else if (lower.includes('normal')) burn_immunity = 'Normal';
            else if (lower.includes('strong')) burn_immunity = 'Strong';
            else burn_immunity = null;
        }

        const monster: Monster = {
            id: Number(getPrintoutValue(po['NPC ID'])) || 0,
            name: k.split('#', 1)[0] || '',
            version,
            image: po['Image']?.[0]?.fulltext?.replace('File:', '') || '',
            level: Number(getPrintoutValue(po['Combat level'])) || 0,
            speed: Number(getPrintoutValue(po['Attack speed'])) || 0,
            style: monster_style,
            size: Number(getPrintoutValue(po['Size'])) || 0,
            max_hit: Number(getPrintoutValue(po['Max hit'])) || 0,
            skills: {
                atk: Number(getPrintoutValue(po['Attack level'])) || 0,
                def: Number(getPrintoutValue(po['Defence level'])) || 0,
                hp: Number(getPrintoutValue(po['Hitpoints'])) || 0,
                magic: Number(getPrintoutValue(po['Magic level'])) || 0,
                ranged: Number(getPrintoutValue(po['Ranged level'])) || 0,
                str: Number(getPrintoutValue(po['Strength level'])) || 0
            },
            offensive: {
                atk: Number(getPrintoutValue(po['Attack bonus'])) || 0,
                magic: Number(getPrintoutValue(po['Magic attack bonus'])) || 0,
                magic_str: Number(getPrintoutValue(po['Magic Damage bonus'])) || 0,
                ranged: Number(getPrintoutValue(po['Range attack bonus'])) || 0,
                ranged_str: Number(getPrintoutValue(po['Ranged Strength bonus'])) || 0,
                str: Number(getPrintoutValue(po['Strength bonus'])) || 0
            },
            defensive: {
                flat_armour: Number(getPrintoutValue(po['Flat armour'])) || 0,
                crush: Number(getPrintoutValue(po['Crush defence bonus'])) || 0,
                magic: Number(getPrintoutValue(po['Magic defence bonus'])) || 0,
                heavy: Number(getPrintoutValue(po['Heavy range defence bonus'])) || 0,
                standard: Number(getPrintoutValue(po['Standard range defence bonus'])) || 0,
                light: Number(getPrintoutValue(po['Light range defence bonus'])) || 0,
                slash: Number(getPrintoutValue(po['Slash defence bonus'])) || 0,
                stab: Number(getPrintoutValue(po['Stab defence bonus'])) || 0
            },
            attributes: po['Monster attribute'] || [],
            immunities: { burn: burn_immunity }
        };

        const weakness = getPrintoutValue(po['Elemental weakness']) as string | null;
        if (weakness) {
            try {
                monster.weakness = {
                    element: weakness.toLowerCase(),
                    severity: Number(getPrintoutValue(po['Elemental weakness percent'])) || 0
                };
            } catch {
                monster.weakness = null;
            }
        } else {
            monster.weakness = null;
        }

        if (monster.id === 14779) monster.skills.hp = 50000;

        if (
            monster.skills.hp === 0 ||
            monster.id === 0 ||
            monster.name.toLowerCase().includes('(historical)') ||
            monster.name.toLowerCase().includes('(pvm arena)') ||
            monster.name.toLowerCase().includes('(deadman: apocalypse)')
        ) continue;

        result.push(stripParserTags(monster));
    }

    return result;
}

// Test timing (uncomment to use in a dev/test environment)
if (import.meta.env.DEV) {
    (async () => {
        console.time('fetchMonstersFromWiki');
        const monsters = await fetchMonstersFromWiki();
        console.timeEnd('fetchMonstersFromWiki');
        console.log('Fetched monsters:', monsters.length);
    })();
}

export { fetchMonstersFromWiki };
