import equipmentIds from '../data/equipmentIdExclusions';

const equipmentAliasReverseMap: Record<string, string> = (() => {
    const reverse: Record<string, string> = {};
    for (const [base, variants] of Object.entries(equipmentIds)) {
        for (const variant of variants) {
            reverse[String(variant)] = base;
        }
    }
    return reverse;
})();

export function resolveBaseItemId(itemId: string | number): string | number {
    const idStr = String(itemId);
    return equipmentAliasReverseMap[idStr] || idStr;
}
import type { Equipment } from '../types/player';

async function fetchEquipmentFromWiki(): Promise<Equipment[]> {
    const url = 'https://osrs-sim-data-synderis.s3.us-east-2.amazonaws.com/equipment.json';
    const resp = await fetch(url);
    const equipment = await resp.json();
    console.log('Fetched equipment data:', equipment);
    if (!resp.ok) {
        throw new Error(`Failed to fetch equipment data: ${resp.status} ${resp.statusText}`);
    }

    const result: Equipment[] = [];
    for (const equipmentItem of equipment) {
        result.push(equipmentItem);
    }

    // Remove variant IDs
    const allVariantIds = new Set(Object.values(equipmentIds).flat().map(String));
    const filteredResult = result.filter(item => !allVariantIds.has(String(item.id)));

    // Sort by name
    filteredResult.sort((a, b) => a.name.localeCompare(b.name));
    
    console.log('Processed equipment length:', filteredResult.length);
    return filteredResult;
}

export async function fetchImageMapFromSupabase(): Promise<Record<string, string>> {
    const url = 'https://osrs-sim-data-synderis.s3.us-east-2.amazonaws.com/gear_image_map.json';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Failed to fetch gear_image_map.json');
    return await resp.json();
}

// Only export fetchEquipmentFromWiki, not Equipment
export { fetchEquipmentFromWiki };
