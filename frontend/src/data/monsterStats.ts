export interface Monster {
    id: number;
    name: string;
    combat_level: number;
    hitpoints: number;
    max_hit: number;
    attack_speed: number;
    slayer_level: number | null;
    slayer_xp: number | null;
    attack_level: number;
    strength_level: number;
    defence_level: number;
    magic_level: number;
    ranged_level: number;
    defence_stab: number;
    defence_slash: number;
    defence_crush: number;
    defence_magic: number;
    defence_ranged: number;
    last_updated: string;
    release_date: string;
    examine: string;
    wiki_name: string;
    wiki_url: string;
    attack_type: string[];
    attributes: string[];
    category: string[];
    slayer_masters: string[];
}

export const cmMonsters: Monster[] = [
    {
        id: 10001,
        name: "Tekton (CM)",
        combat_level: 390,
        hitpoints: 450,
        max_hit: 78,
        attack_speed: 3,
        slayer_level: null,
        slayer_xp: null,
        attack_level: 585,
        strength_level: 585,
        defence_level: 246,
        magic_level: 246,
        ranged_level: 1,
        defence_stab: 155,
        defence_slash: 165,
        defence_crush: 105,
        defence_magic: 0,
        defence_ranged: 0,
        last_updated: "2025-08-13",
        release_date: "2018-05-17",
        examine: "Xeric's former artisan.",
        wiki_name: "Tekton (CM)",
        wiki_url: "https://oldschool.runescape.wiki/w/Tekton#Normal_(Challenge_Mode)",
        attack_type: ["melee"],
        attributes: ["xercian"],
        category: ["bosses"],
        slayer_masters: []
    },
    {
        id: 10002,
        name: "Vasa (CM)",
        combat_level: 390,
        hitpoints: 550,
        max_hit: 78,
        attack_speed: 3,
        slayer_level: null,
        slayer_xp: null,
        attack_level: 585,
        strength_level: 585,
        defence_level: 246,
        magic_level: 246,
        ranged_level: 1,
        defence_stab: 155,
        defence_slash: 165,
        defence_crush: 105,
        defence_magic: 0,
        defence_ranged: 0,
        last_updated: "2025-08-13",
        release_date: "2018-05-17",
        examine: "Xeric's former artisan.",
        wiki_name: "Vasa (CM)",
        wiki_url: "https://oldschool.runescape.wiki/w/Vasa#(Challenge_Mode)",
        attack_type: ["melee"],
        attributes: ["xercian"],
        category: ["bosses"],
        slayer_masters: []
    }
];

export interface Room {
    id: string;
    name: string;
    image: string;
    description: string;
}

export const rooms: Room[] = [
    {
        id: '10001',
        name: 'Tekton',
        image: '/rooms/220px-Tekton.webp',
        description: 'High-level boss encounter'
    },
    {
        id: 'crabs',
        name: 'Crabs',
        image: '/rooms/150px-Jewelled_Crab.webp',
        description: 'Low-level training area'
        // No monsterId yet - add when you have crab monster data
    },
    {
        id: 'ice_demon',
        name: 'Ice Demon',
        image: '/rooms/170px-Ice_demon.webp',
        description: 'High-level boss encounter'
    },
    {
        id: 'lizardman_shamans',
        name: 'Lizardman Shamans',
        image: '/rooms/200px-Lizardman_shaman.webp',
        description: 'High-level boss encounter'
    },
    {
        id: 'vanguards',
        name: 'Vanguards',
        image: '/rooms/280px-Vanguard_(magic).webp',
        description: 'God Wars Dungeon - Zamorak'
    },
    {
        id: 'vespula',
        name: 'Vespula',
        image: '/rooms/280px-Vespula.webp',
        description: 'Barrows Brothers minigame'
    },
    {
        id: 'tightrope',
        name: 'Tightrope',
        image: '/rooms/130px-Keystone_crystal_detail.webp',
        description: 'High-level agility course'
    },
    {
        id: 'guardians',
        name: 'Guardians',
        image: '/rooms/guardians.png',
        description: 'High-level boss encounter'
    },
    {
        id: '10002',
        name: 'Vasa',
        image: '/rooms/250px-Vasa_Nistirio.webp',
        description: 'God Wars Dungeon - Zamorak'
    },
    {
        id: 'mystics',
        name: 'Mystics',
        image: '/rooms/mystics.png',
        description: 'Barrows Brothers minigame'
    },
    {
        id: 'muttadile',
        name: 'Muttadile',
        image: '/rooms/250px-Muttadile.webp',
        description: 'High-level boss encounter'
    },
    {
        id: 'olm',
        name: 'Olm',
        image: '/rooms/300px-Great_Olm.webp',
        description: 'High-level boss encounter'
    }
];

export default cmMonsters;