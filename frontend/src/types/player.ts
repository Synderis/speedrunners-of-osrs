export interface GearSetPreset {
    id: string;
    name: string;
    description: string;
    gearSets: {
        melee: Record<string, string>;
        mage: Record<string, string>;
        ranged: Record<string, string>;
    };
    inventoryItems: string[]; // Array of inventory item IDs
}

export interface GearSets {
    melee: GearSlot[];
    mage: GearSlot[];
    ranged: GearSlot[];
}

export interface GearSlot {
    slot: string;
    items: Equipment[];
    selected?: Equipment;
}

export interface InventoryItem {
    name: string;
    equipment?: Equipment;
}

export interface Equipment {
    name: string;
    id: number;
    version: string;
    slot: string;
    image: string;
    speed: number;
    category: string;
    bonuses: {
        str: number | null;
        ranged_str: number | null;
        magic_str: number | null;
        prayer: number | null;
    };
    offensive: {
        stab: number | null;
        slash: number | null;
        crush: number | null;
        magic: number | null;
        ranged: number | null;
    };
    defensive: {
        stab: number | null;
        slash: number | null;
        crush: number | null;
        magic: number | null;
        ranged: number | null;
    };
    two_handed: boolean;
    weapon_styles?: WeaponStyles[]; // Optional, if you want to include weapon styles
}

export interface WeaponStyles {
    name: string;
    attack_type: string;
    combat_style: string;
    att: number;
    str: number;
    def: number;
    ranged: number;
    magic: number;
    att_spd_reduction: number;
}

export interface CombatStats {
    attack: number;
    strength: number;
    defense: number;
    ranged: number;
    magic: number;
    hitpoints: number;
    prayer: number;
    woodcutting: number;
    mining: number;
    thieving: number;
}

export type GearSetType = 'melee' | 'mage' | 'ranged';


