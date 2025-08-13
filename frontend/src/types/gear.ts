import type { WeaponStat } from '../services/weaponStatsService';

export interface GearItem {
    id: string;
    name: string;
    image: string;
    slot: string;
    stats: {
        attack_stab: number;
        attack_slash: number;
        attack_crush: number;
        attack_magic: number;
        attack_ranged: number;
        defence_stab: number;
        defence_slash: number;
        defence_crush: number;
        defence_magic: number;
        defence_ranged: number;
        melee_strength: number;
        ranged_strength: number;
        magic_damage: number;
        prayer: number;
    };
    weaponStats?: WeaponStat[];
}

export interface GearSlot {
    slot: string;
    items: GearItem[];
    selected?: GearItem;
}

export interface GearSets {
    melee: GearSlot[];
    mage: GearSlot[];
    ranged: GearSlot[];
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
