// Define the interface
export interface Monster {
    id: number;
    name: string;
    version: string;
    image: string;
    level: number;
    speed: number;
    style: string[] | null;
    size: number;
    max_hit: string | number;
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
}

// Use the interface for your array
export const cmMonsters: Monster[] = [
    {
        "id": 7545,
        "name": "Tekton",
        "version": "Normal (Challenge Mode)",
        "image": "Tekton.png",
        "level": 0,
        "speed": 3,
        "style": [
            "Stab",
            "Slash",
            "Crush"
        ],
        "size": 4,
        "max_hit": 78,
        "skills": {
            "atk": 585,
            "def": 246,
            "hp": 450,
            "magic": 246,
            "ranged": 1,
            "str": 585
        },
        "offensive": {
            "atk": 64,
            "magic": 0,
            "magic_str": 0,
            "ranged": 0,
            "ranged_str": 0,
            "str": 20
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 105,
            "magic": 0,
            "heavy": 0,
            "standard": 0,
            "light": 0,
            "slash": 165,
            "stab": 155
        },
        "attributes": [
            "xerician"
        ],
        "immunities": {
            "burn": null
        },
        "weakness": null
    },
    {
        "id": 7566,
        "name": "Vasa Nistirio",
        "version": "Challenge Mode",
        "image": "Vasa Nistirio.png",
        "level": 0,
        "speed": 3,
        "style": [
            "Magic",
            "Ranged"
        ],
        "size": 5,
        "max_hit": 0,
        "skills": {
            "atk": 1,
            "def": 262,
            "hp": 450,
            "magic": 345,
            "ranged": 345,
            "str": 1
        },
        "offensive": {
            "atk": 0,
            "magic": 0,
            "magic_str": 0,
            "ranged": 100,
            "ranged_str": 0,
            "str": 0
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 40,
            "magic": 400,
            "heavy": 30,
            "standard": 40,
            "light": 40,
            "slash": 190,
            "stab": 170
        },
        "attributes": [
            "xerician"
        ],
        "immunities": {
            "burn": null
        },
        "weakness": null
    },
    {
        "id": 7570,
        "name": "Guardian (Chambers of Xeric)",
        "version": "Challenge Mode",
        "image": "Guardian (Chambers of Xeric, female).png",
        "level": 0,
        "speed": 4,
        "style": [
            "Slash"
        ],
        "size": 0,
        "max_hit": 33,
        "skills": {
            "atk": 210,
            "def": 150,
            "hp": 375,
            "magic": 1,
            "ranged": 1,
            "str": 210
        },
        "offensive": {
            "atk": 0,
            "magic": 0,
            "magic_str": 0,
            "ranged": 0,
            "ranged_str": 0,
            "str": 20
        },
        "defensive": {
            "flat_armour": 0,
            "crush": -10,
            "magic": 0,
            "heavy": 0,
            "standard": 0,
            "light": 0,
            "slash": 180,
            "stab": 80
        },
        "attributes": [
            "xerician"
        ],
        "immunities": {
            "burn": null
        },
        "weakness": null
    },
    {
        "id": 7533,
        "name": "Abyssal portal",
        "version": "Challenge Mode",
        "image": "Abyssal portal.png",
        "level": 0,
        "speed": 2,
        "style": [
            "None"
        ],
        "size": 4,
        "max_hit": 0,
        "skills": {
            "atk": 1,
            "def": 264,
            "hp": 375,
            "magic": 264,
            "ranged": 1,
            "str": 1
        },
        "offensive": {
            "atk": 0,
            "magic": 0,
            "magic_str": 0,
            "ranged": 0,
            "ranged_str": 0,
            "str": 0
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 0,
            "magic": 60,
            "heavy": 110,
            "standard": 140,
            "light": 140,
            "slash": 0,
            "stab": 0
        },
        "attributes": [
            "xerician"
        ],
        "immunities": {
            "burn": null
        },
        "weakness": {
            "element": "fire",
            "severity": 50
        }
    },
    {
        "id": 7604,
        "name": "Skeletal Mystic",
        "version": "Challenge Mode",
        "image": "Skeletal mystic (1).png",
        "level": 0,
        "speed": 4,
        "style": [
            "Magic",
            "Melee"
        ],
        "size": 2,
        "max_hit": 0,
        "skills": {
            "atk": 210,
            "def": 280,
            "hp": 240,
            "magic": 210,
            "ranged": 1,
            "str": 210
        },
        "offensive": {
            "atk": 85,
            "magic": 40,
            "magic_str": 38,
            "ranged": 0,
            "ranged_str": 0,
            "str": 50
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 75,
            "magic": 140,
            "heavy": 75,
            "standard": 115,
            "light": 115,
            "slash": 155,
            "stab": 155
        },
        "attributes": [
            "undead",
            "xerician"
        ],
        "immunities": {
            "burn": null
        },
        "weakness": null
    },
];

export interface Room {
    id: string;
    name: string;
    image: string;
    description: string;
    monsters: string[]
}

export const rooms: Room[] = [
    {
        id: '7545',
        name: 'Tekton',
        image: '/rooms/220px-Tekton.webp',
        description: 'High-level boss encounter',
        monsters: ['7545']
    },
    {
        id: 'crabs',
        name: 'Crabs',
        image: '/rooms/150px-Jewelled_Crab.webp',
        description: 'Low-level training area',
        monsters: ['crabs']
    },
    {
        id: 'ice_demon',
        name: 'Ice Demon',
        image: '/rooms/170px-Ice_demon.webp',
        description: 'High-level boss encounter',
        monsters: ['ice_demon']
    },
    {
        id: 'lizardman_shamans',
        name: 'Lizardman Shamans',
        image: '/rooms/200px-Lizardman_shaman.webp',
        description: 'High-level boss encounter',
        monsters: ['lizardman_shaman']
    },
    {
        id: 'vanguards',
        name: 'Vanguards',
        image: '/rooms/280px-Vanguard_(magic).webp',
        description: 'God Wars Dungeon - Zamorak',
        monsters: ['vanguard']
    },
    {
        id: 'vespula',
        name: 'Vespula',
        image: '/rooms/280px-Vespula.webp',
        description: 'Barrows Brothers minigame',
        monsters: ['7533']
    },
    {
        id: 'tightrope',
        name: 'Tightrope',
        image: '/rooms/130px-Keystone_crystal_detail.webp',
        description: 'High-level agility course',
        monsters: []
    },
    {
        id: 'guardians',
        name: 'Guardians',
        image: '/rooms/guardians.png',
        description: 'High-level boss encounter',
        monsters: ['7570', '7570']
    },
    {
        id: 'vasa',
        name: 'Vasa',
        image: '/rooms/250px-Vasa_Nistirio.webp',
        description: 'God Wars Dungeon - Zamorak',
        monsters: ['7566']
    },
    {
        id: 'mystics',
        name: 'Mystics',
        image: '/rooms/mystics.png',
        description: 'Barrows Brothers minigame',
        // monsters: ['7604', '7604', '7604']
        monsters: ['7604']
    },
    {
        id: 'muttadile',
        name: 'Muttadile',
        image: '/rooms/250px-Muttadile.webp',
        description: 'High-level boss encounter',
        monsters: ['muttadile']
    },
    {
        id: 'olm',
        name: 'Olm',
        image: '/rooms/300px-Great_Olm.webp',
        description: 'High-level boss encounter',
        monsters: ['olm']
    }
];

export default cmMonsters;