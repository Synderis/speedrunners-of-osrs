import equipmentIds from '../data/equipmentIdExclusions';
import { equipmentNameExclusions } from '../data/equipmentNameExclusions';
/**
 * A reverse map of variant item ID -> base item ID for quick lookup.
 */
const equipmentAliasReverseMap: Record<string, string> = (() => {
    const reverse: Record<string, string> = {};
    for (const [base, variants] of Object.entries(equipmentIds)) {
        for (const variant of variants) {
            reverse[String(variant)] = base;
        }
    }
    return reverse;
})();

/**
 * Given an item ID, returns the base item ID if it's a known variant, else returns the original.
 */
export function resolveBaseItemId(itemId: string | number): string | number {
    const idStr = String(itemId);
    return equipmentAliasReverseMap[idStr] || idStr;
}
import type { Equipment } from '../types/equipment';
const WIKI_BASE = 'https://oldschool.runescape.wiki';
const API_BASE = `${WIKI_BASE}/api.php`;

const REQUIRED_PRINTOUTS = [
    'Crush attack bonus',
    'Crush defence bonus',
    'Equipment slot',
    'Item ID',
    'Image',
    'Magic Damage bonus',
    'Magic attack bonus',
    'Magic defence bonus',
    'Prayer bonus',
    'Range attack bonus',
    'Ranged Strength bonus',
    'Range defence bonus',
    'Slash attack bonus',
    'Slash defence bonus',
    'Stab attack bonus',
    'Stab defence bonus',
    'Strength bonus',
    'Version anchor',
    'Weapon attack range',
    'Weapon attack speed',
    'Combat style'
];

const ITEMS_TO_SKIP = [
    'The dogsword',
    'Drygore blowpipe',
    'Amulet of the monarchs',
    'Emperor ring',
    "Devil's element",
    "Nature's reprisal",
    'Gloves of the damned',
    'Crystal blessing',
    'Sunlight spear',
    'Sunlit bracers',
    'Thunder khopesh',
    'Thousand-dragon ward',
    'Arcane grimoire',
    'Wristbands of the arena',
    'Wristbands of the arena (i)',
    'Armadyl chainskirt (or)',
    'Armadyl chestplate (or)',
    'Armadyl helmet (or)',
    "Dagon'hai hat (or)",
    "Dagon'hai robe bottom (or)",
    "Dagon'hai robe top (or)",
    'Dragon warhammer (or)',
    'Centurion cuirass'
];

function getPrintoutValue<T>(prop: T[]): T | null {
    if (!prop || prop.length === 0) return null;
    return prop[0];
}

function getMagicDamageValue(prop: any[]): number | null {
    if (!prop || prop.length === 0) return null;
    return Math.round(Number(prop[0]) * 10);
}

async function fetchEquipmentFromWiki(): Promise<Equipment[]> {
    let equipment: Record<string, any> = {};
    let offset = 0;

    while (true) {
        const query = new URLSearchParams({
            action: 'ask',
            format: 'json',
            query: `[[Equipment slot::+]][[Item ID::+]]|?${REQUIRED_PRINTOUTS.join('|?')}|limit=5000|offset=${offset}`
        }).toString();

        const url = `${API_BASE}?${query}`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (!data.query?.results) break;
        equipment = { ...equipment, ...data.query.results };

        if (!data['query-continue-offset'] || Number(data['query-continue-offset']) <= offset) break;
        offset = data['query-continue-offset'];
    }

    const result: Equipment[] = [];
    for (const k in equipment) {
        const v = equipment[k];
        if (!v.printouts) continue;
        const po = v.printouts;
        const item_id_raw = getPrintoutValue(po['Item ID']);
        // Ensure id is string or number, fallback to empty string if unknown
        const item_id: string | number = typeof item_id_raw === 'string' || typeof item_id_raw === 'number'
            ? item_id_raw
            : '';

        // Remove if this id is a variant in the alias list
        const allVariantIds = new Set(Object.values(equipmentIds).flat().map(String));
        if (allVariantIds.has(String(item_id))) continue;

        const name = k.split('#', 1)[0];
        let slot_raw = getPrintoutValue(po['Equipment slot']);
        let slot = typeof slot_raw === 'string' ? slot_raw : '';
        let two_handed = false;
        if (slot === '2h') {
            slot = 'weapon';
            two_handed = true;
        }

        let version_raw = getPrintoutValue(po['Version anchor']);
        let version = typeof version_raw === 'string' ? version_raw : '';
        if (version === 'Nightmare Zone') version = '';

        if (name.includes('(Last Man Standing)')) continue;
        if (ITEMS_TO_SKIP.includes(name)) continue;
        if (name.includes('Keris partisan of amascut') && k.includes('Outside ToA')) continue;
        const isExcluded = (name: string) =>
            equipmentNameExclusions.some(exclusion => name.includes(exclusion));
        if (isExcluded(name)) continue;
        const versionLower = version.toLowerCase();
        if (
            versionLower !== '' &&
            versionLower !== 'unpoisoned' &&
            versionLower !== 'normal' &&
            versionLower !== 'recoil' &&
            versionLower !== 'activated' &&
            versionLower !== 'undamaged' &&
            versionLower !== 'charged' &&
            versionLower !== 'restored' &&
            versionLower !== 'active'
        ) continue;

        const equipmentItem: Equipment = {
            name,
            id: resolveBaseItemId(item_id),
            version,
            slot,
            image: po['Image']?.[0]?.fulltext?.replace('File:', '') || '',
            speed: Number(getPrintoutValue(po['Weapon attack speed'])) || 0,
            category: getPrintoutValue(po['Combat style']) || '',
            bonuses: {
                str: getPrintoutValue(po['Strength bonus']),
                ranged_str: getPrintoutValue(po['Ranged Strength bonus']),
                magic_str: getMagicDamageValue(po['Magic Damage bonus']),
                prayer: getPrintoutValue(po['Prayer bonus']),
            },
            offensive: {
                stab: getPrintoutValue(po['Stab attack bonus']),
                slash: getPrintoutValue(po['Slash attack bonus']),
                crush: getPrintoutValue(po['Crush attack bonus']),
                magic: getPrintoutValue(po['Magic attack bonus']),
                ranged: getPrintoutValue(po['Range attack bonus']),
            },
            defensive: {
                stab: getPrintoutValue(po['Stab defence bonus']),
                slash: getPrintoutValue(po['Slash defence bonus']),
                crush: getPrintoutValue(po['Crush defence bonus']),
                magic: getPrintoutValue(po['Magic defence bonus']),
                ranged: getPrintoutValue(po['Range defence bonus']),
            },
            two_handed,
        };

        // Filter: skip if all bonuses, offensive, and defensive stats are 0

        const b = equipmentItem.bonuses;
        const o = equipmentItem.offensive;
        const d = equipmentItem.defensive;
        const allStats = [
            b.str, b.ranged_str, b.magic_str, b.prayer,
            o.stab, o.slash, o.crush, o.magic, o.ranged,
            d.stab, d.slash, d.crush, d.magic, d.ranged
        ];
        const excludedIds = new Set(['25975', '2550']);
        const itemIdStr = String(equipmentItem.id);

        // Filter: skip if all bonuses are negative or zero (no positive stat)
        const allNegative = allStats.every(val => val === null || Number(val) <= 0);
        if (allNegative && !excludedIds.has(itemIdStr)) continue;

        result.push(equipmentItem);
    }

    // Optionally sort by name
    result.sort((a, b) => a.name.localeCompare(b.name));
    // Remove duplicate ids, keeping the first occurrence
    // Remove any items whose id appears as a variant in the alias list
    const allVariantIds = new Set(
        Object.values(equipmentIds).flat().map(String)
    );
    const filteredResult = result.filter(item => !allVariantIds.has(String(item.id)));
    return filteredResult;
}

export async function fetchImageMapFromSupabase(): Promise<Record<string, string>> {
    const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_REF;
    const url = `https://${projectRef}.supabase.co/storage/v1/object/public/data/gear_image_map.json`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to fetch gear_image_map.json');
    return await resp.json();
}

// Only export fetchEquipmentFromWiki, not Equipment
export { fetchEquipmentFromWiki };
