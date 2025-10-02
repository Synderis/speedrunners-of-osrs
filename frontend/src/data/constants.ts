import { 
    calculateDPSWithObjectsTekton,
    calculateDPSWithObjectsIceDemon, 
    calculateDPSWithObjectsShamans, 
    calculateDPSWithObjectsVangs, 
    calculateDPSWithObjectsThieving, 
    calculateDPSWithObjectsVespula, 
    calculateDPSWithObjectsGuardians, 
    calculateDPSWithObjectsVasa, 
    calculateDPSWithObjectsMystics, 
    calculateDPSWithObjectsMutta, 
    calculateDPSWithObjectsOlm 
} from '../loaders/coxCMWasm';


export const defaultSlotImages = {
    weapon: '/gear/weapon.webp',
    shield: '/gear/offhand.webp',
    head: '/gear/helmet.webp',
    cape: '/gear/cape.webp',
    neck: '/gear/neck.webp',
    ammo: '/gear/ammo.webp',
    body: '/gear/body.webp',
    legs: '/gear/legs.webp',
    hands: '/gear/gloves.webp',
    feet: '/gear/boots.webp',
    ring: '/gear/ring.webp'
};

export const statImages = {
    attack: '/gear/attack.webp',
    strength: '/gear/strength.webp',
    defence: '/gear/defence.webp',
    ranged: '/gear/ranged.webp',
    hitpoints: '/gear/hitpoints.webp',
    magic: '/gear/magic.webp',
    prayer: '/gear/prayer.webp',
    mining: '/gear/mining.webp',
    woodcutting: '/gear/woodcutting.webp',
    thieving: '/gear/thieving.webp'
};

export const miscIcons = {
    levels: '/gear/levels.webp',
    attack: '/gear/attack.webp',
    strength: '/gear/strength.webp',
    defence: '/gear/defence.webp',
    ranged: '/gear/ranged.webp',
    hitpoints: '/gear/hitpoints.webp',
    magic: '/gear/magic.webp',
    prayer: '/gear/prayer.webp',
    stab: '/gear/stab.webp',
    crush: '/gear/crush.webp',
    slash: '/gear/slash.webp',
    ranged_strength: '/gear/ranged_strength.webp',
    magic_strength: '/gear/magic_strength.webp',
    max_hit: '/gear/max_hit.webp',
    flat_armor: '/gear/flat_armor.webp',
    magic_defence: '/gear/magic_defence.webp',
    ranged_defence: '/gear/ranged_defence.webp',
    light: '/gear/light.webp',
    standard: '/gear/standard.webp',
    heavy: '/gear/heavy.webp'
};

export const GEAR_TYPES = ['melee', 'mage', 'ranged'] as const;

export const DEFAULT_GEAR_STATS = {
    bonuses: { str: 0, ranged_str: 0, magic_str: 0, prayer: 0 },
    offensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 },
    defensive: { stab: 0, slash: 0, crush: 0, magic: 0, ranged: 0 }
};

export const wasmModelLoaders: Record<string, (player: any, monster: any) => Promise<any>> = {
    'tekton': calculateDPSWithObjectsTekton,
    'vasa': calculateDPSWithObjectsVasa,
    'guardians': calculateDPSWithObjectsGuardians,
    'vespula': calculateDPSWithObjectsVespula,
    'mystics': calculateDPSWithObjectsMystics,
    'lizardman_shamans': calculateDPSWithObjectsShamans,
    'muttadile': calculateDPSWithObjectsMutta,
    "olm": calculateDPSWithObjectsOlm,
    "vangs": calculateDPSWithObjectsVangs,
    "ice_demon": calculateDPSWithObjectsIceDemon,
    "thieving": calculateDPSWithObjectsThieving
};