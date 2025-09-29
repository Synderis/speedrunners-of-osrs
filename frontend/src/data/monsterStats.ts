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
        "id": 7544,
        "name": "Tekton (enraged)",
        "version": "Enraged (Challenge Mode)",
        "image": "Tekton (enraged).png",
        "level": 0,
        "speed": 3,
        "style": [
            "Stab",
            "Slash",
            "Crush"
        ],
        "size": 4,
        "max_hit": 87,
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
            "str": 30
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 180,
            "magic": 0,
            "heavy": 0,
            "standard": 0,
            "light": 0,
            "slash": 290,
            "stab": 280
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
        "id": 7568,
        "name": "Glowing crystal",
        "version": "Normal",
        "image": "Glowing crystal.png",
        "level": 0,
        "size": 4,
        "max_hit": 0,
        "speed": 4,
        "style": null,
        "skills": {
            "atk": 1,
            "def": 100,
            "hp": 120,
            "magic": 100,
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
            "stab": -5,
            "slash": 180,
            "crush": 180,
            "magic": 0,
            "light": 0,
            "standard": 0,
            "heavy": 0
        },
        "attributes": [
            "xerician"
        ],
        "weakness": null,
        "immunities": {
            "burn": null
        }
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
    {
        "id": 7573,
        "name": "Lizardman shaman (Chambers of Xeric)",
        "version": "Challenge Mode",
        "image": "Lizardman shaman (1).png",
        "level": 0,
        "speed": 4,
        "style": [
            "Melee",
            "Ranged"
        ],
        "size": 3,
        "max_hit": 65,
        "skills": {
            "atk": 195,
            "def": 315,
            "hp": 285,
            "magic": 195,
            "ranged": 195,
            "str": 195
        },
        "offensive": {
            "atk": 58,
            "magic": 0,
            "magic_str": 0,
            "ranged": 56,
            "ranged_str": 49,
            "str": 52
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 150,
            "magic": 160,
            "heavy": 0,
            "standard": 0,
            "light": 0,
            "slash": 160,
            "stab": 102
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
        "id": 7561,
        "name": "Large Muttadile",
        "version": "Large (Challenge Mode)",
        "image": "Muttadile.png",
        "level": 0,
        "speed": 4,
        "style": [
            "Melee",
            "Magic",
            "Ranged"
        ],
        "size": 5,
        "max_hit": 71,
        "skills": {
            "atk": 375,
            "def": 330,
            "hp": 375,
            "magic": 375,
            "ranged": 375,
            "str": 375
        },
        "offensive": {
            "atk": 88,
            "magic": 0,
            "magic_str": -8,
            "ranged": 82,
            "ranged_str": 47,
            "str": 55
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 60,
            "magic": 75,
            "heavy": 0,
            "standard": 0,
            "light": 0,
            "slash": 82,
            "stab": -5
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
        "id": 7562,
        "name": "Small Muttadile",
        "version": "Small (Challenge Mode)",
        "image": "Muttadile.png",
        "level": 0,
        "speed": 4,
        "style": [
            "Melee",
            "Ranged"
        ],
        "size": 3,
        "max_hit": 41,
        "skills": {
            "atk": 225,
            "def": 207,
            "hp": 375,
            "magic": 1,
            "ranged": 225,
            "str": 225
        },
        "offensive": {
            "atk": 71,
            "magic": 0,
            "magic_str": -8,
            "ranged": 83,
            "ranged_str": 56,
            "str": 48
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 50,
            "magic": 60,
            "heavy": 0,
            "standard": 0,
            "light": 0,
            "slash": 72,
            "stab": -5
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
        "id": 7585,
        "name": "Ice demon",
        "version": "Challenge Mode",
        "image": "Ice demon.png",
        "level": 0,
        "speed": 3,
        "style": [
            "Ranged",
            "Magic"
        ],
        "size": 2,
        "max_hit": 0,
        "skills": {
            "atk": 1,
            "def": 240,
            "hp": 210,
            "magic": 585,
            "ranged": 585,
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
            "crush": 110,
            "magic": 40,
            "heavy": 140,
            "standard": 140,
            "light": 140,
            "slash": 70,
            "stab": 70
        },
        "attributes": [
            "demon",
            "xerician"
        ],
        "immunities": {
            "burn": null
        },
        "weakness": {
            "element": "fire",
            "severity": 150
        }
    },
    {
        "id": 7554,
        "name": "Head",
        "version": "Head (Challenge Mode)",
        "image": "Great Olm.png",
        "level": 1043,
        "speed": 4,
        "style": [
            "Magic",
            "Ranged"
        ],
        "size": 5,
        "max_hit": 38,
        "skills": {
            "atk": 375,
            "def": 225,
            "hp": 800,
            "magic": 375,
            "ranged": 375,
            "str": 375
        },
        "offensive": {
            "atk": 0,
            "magic": 60,
            "magic_str": 0,
            "ranged": 60,
            "ranged_str": 0,
            "str": 0
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 200,
            "magic": 200,
            "heavy": 50,
            "standard": 50,
            "light": 50,
            "slash": 200,
            "stab": 200
        },
        "attributes": [
            "dragon",
            "xerician"
        ],
        "immunities": {
            "burn": null
        },
        "weakness": {
            "element": "earth",
            "severity": 50
        }
    },
    {
        "id": 7555,
        "name": "Melee Hand",
        "version": "Left claw (Challenge Mode)",
        "image": "Great Olm.png",
        "level": 750,
        "speed": 0,
        "style": [
            "None"
        ],
        "size": 5,
        "max_hit": 0,
        "skills": {
            "atk": 375,
            "def": 262,
            "hp": 600,
            "magic": 262,
            "ranged": 375,
            "str": 375
        },
        "offensive": {
            "atk": 0,
            "magic": 60,
            "magic_str": 0,
            "ranged": 60,
            "ranged_str": 0,
            "str": 0
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 50,
            "magic": 200,
            "heavy": 200,
            "standard": 200,
            "light": 200,
            "slash": 50,
            "stab": 50
        },
        "attributes": [
            "dragon",
            "xerician"
        ],
        "immunities": {
            "burn": null
        },
        "weakness": {
            "element": "earth",
            "severity": 50
        }
    },
    {
        "id": 7553,
        "name": "Mage Hand",
        "version": "Right claw (Challenge Mode)",
        "image": "Great Olm.png",
        "level": 549,
        "speed": 0,
        "style": [
            "None"
        ],
        "size": 5,
        "max_hit": 0,
        "skills": {
            "atk": 375,
            "def": 262,
            "hp": 600,
            "magic": 130,
            "ranged": 375,
            "str": 375
        },
        "offensive": {
            "atk": 0,
            "magic": 60,
            "magic_str": 0,
            "ranged": 60,
            "ranged_str": 0,
            "str": 0
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 200,
            "magic": 50,
            "heavy": 200,
            "standard": 200,
            "light": 200,
            "slash": 200,
            "stab": 200
        },
        "attributes": [
            "dragon",
            "xerician"
        ],
        "immunities": {
            "burn": null
        },
        "weakness": {
            "element": "earth",
            "severity": 50
        }
    },
    {
        "id": 7529,
        "name": "Vanguard (magic)",
        "version": "Magic",
        "image": "Vanguard (magic).png",
        "level": 0,
        "speed": 4,
        "style": [
            "Magic"
        ],
        "size": 3,
        "max_hit": 22,
        "skills": {
            "atk": 225,
            "def": 240,
            "hp": 270,
            "magic": 225,
            "ranged": 225,
            "str": 225
        },
        "offensive": {
            "atk": 0,
            "magic": 40,
            "magic_str": 25,
            "ranged": 0,
            "ranged_str": 0,
            "str": 0
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 400,
            "magic": 110,
            "heavy": 50,
            "standard": 50,
            "light": 50,
            "slash": 340,
            "stab": 315
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
        "id": 7527,
        "name": "Vanguard (melee)",
        "version": "Melee",
        "image": "Vanguard (melee).png",
        "level": 0,
        "speed": 4,
        "style": [
            "Melee"
        ],
        "size": 3,
        "max_hit": 18,
        "skills": {
            "atk": 225,
            "def": 240,
            "hp": 270,
            "magic": 225,
            "ranged": 225,
            "str": 225
        },
        "offensive": {
            "atk": 20,
            "magic": 0,
            "magic_str": 0,
            "ranged": 0,
            "ranged_str": 0,
            "str": 10
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 150,
            "magic": 20,
            "heavy": 400,
            "standard": 400,
            "light": 400,
            "slash": 150,
            "stab": 150
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
        "id": 7528,
        "name": "Vanguard (ranged)",
        "version": "Ranged",
        "image": "Vanguard (ranged).png",
        "level": 0,
        "speed": 4,
        "style": [
            "Ranged"
        ],
        "size": 3,
        "max_hit": 22,
        "skills": {
            "atk": 225,
            "def": 240,
            "hp": 270,
            "magic": 225,
            "ranged": 225,
            "str": 225
        },
        "offensive": {
            "atk": 0,
            "magic": 0,
            "magic_str": 0,
            "ranged": 40,
            "ranged_str": 25,
            "str": 0
        },
        "defensive": {
            "flat_armour": 0,
            "crush": 100,
            "magic": 400,
            "heavy": 300,
            "standard": 300,
            "light": 300,
            "slash": 60,
            "stab": 55
        },
        "attributes": [
            "xerician"
        ],
        "immunities": {
            "burn": null
        },
        "weakness": null
    }
];

export interface FloorRoom {
    roomId: string;
    name: string;
    isDelay?: boolean;
    delayTicks?: number;
}

export interface Floor {
    id: string;
    name: string;
    rooms: FloorRoom[];
}

export const RAID_FLOORS: Floor[] = [
    {
        id: 'floor1',
        name: 'Floor 1',
        rooms: [
            { roomId: 'tekton', name: 'Tekton' },
            { roomId: 'crabs_delay', name: 'Crabs', isDelay: true, delayTicks: 89 },
            { roomId: 'ice_demon', name: 'Ice Demon' },
            { roomId: 'lizardman_shamans', name: 'Shamans' },
            { roomId: 'post_shamans_delay', name: 'Post Shamans', isDelay: true, delayTicks: 36 }
        ]
    },
    {
        id: 'floor2',
        name: 'Floor 2',
        rooms: [
            { roomId: 'vangs', name: 'Vanguards' },
            { roomId: 'thieving', name: 'Thieving' }, // Not implemented yet
            { roomId: 'vespula', name: 'Vespula' },
            { roomId: 'tightrope', name: 'Tightrope', isDelay: true, delayTicks: 77 },
            { roomId: 'post_tightrope_delay', name: 'Post Tightrope', isDelay: true, delayTicks: 18 }
        ]
    },
    {
        id: 'floor3',
        name: 'Floor 3',
        rooms: [
            { roomId: 'guardians', name: 'Guardians' },
            { roomId: 'vasa', name: 'Vasa' },
            { roomId: 'mystics', name: 'Mystics' },
            { roomId: 'muttadile', name: 'Muttadile' },
            { roomId: 'post_mutta_delay', name: 'Post Muttadile', isDelay: true, delayTicks: 40 }
        ]
    },
    {
        id: 'raid_total',
        name: 'Complete Raid',
        rooms: [
            { roomId: 'tekton', name: 'Tekton' },
            { roomId: 'crabs_delay', name: 'Crabs', isDelay: true, delayTicks: 89 },
            { roomId: 'ice_demon', name: 'Ice Demon' },
            { roomId: 'lizardman_shamans', name: 'Shamans' },
            { roomId: 'post_shamans_delay', name: 'Post Shamans', isDelay: true, delayTicks: 36 },
            { roomId: 'vangs', name: 'Vanguards' },
            { roomId: 'thieving', name: 'Thieving' },
            { roomId: 'vespula', name: 'Vespula' },
            { roomId: 'tightrope', name: 'Tightrope', isDelay: true, delayTicks: 77 },
            { roomId: 'post_tightrope_delay', name: 'Post Tightrope', isDelay: true, delayTicks: 18 },
            { roomId: 'guardians', name: 'Guardians' },
            { roomId: 'vasa', name: 'Vasa' },
            { roomId: 'mystics', name: 'Mystics' },
            { roomId: 'muttadile', name: 'Muttadile' },
            { roomId: 'post_mutta_delay', name: 'Post Muttadile', isDelay: true, delayTicks: 40 },
            { roomId: 'olm', name: 'Olm' }
        ]
    }
];

export interface Room {
    id: string;
    name: string;
    image: string;
    description?: string;
    monsters?: string[];
    units: string;
    methods: string[];
    methodCategories?: {
        [categoryName: string]: {
            methods: string[];
            allowMultiple: boolean; // if true, checkboxes; if false, radio buttons
        };
    };
}

export const rooms: Room[] = [
    {
        id: 'tekton',
        name: 'Tekton',
        image: '/rooms/220px-Tekton.webp',
        description: 'High-level boss encounter',
        monsters: ['7545', '7544'],
        units: 'Anvils',
        methods: ['Tekton Long Lure', 'Tekton Medium Lure', 'Tekton Short Lure', 'Pre-Veng'],
        methodCategories: {
            'Lure Method': {
                methods: ['Tekton Long Lure', 'Tekton Medium Lure', 'Tekton Short Lure'],
                allowMultiple: false // radio buttons
            },
            'Additional Methods': {
                methods: ['Pre-Veng'],
                allowMultiple: true // checkboxes
            }
        }
    },
    // {
    //     id: 'crabs',
    //     name: 'Crabs',
    //     image: '/rooms/150px-Jewelled_Crab.webp',
    //     description: 'Low-level training area',
    //     monsters: ['crabs'],
    //     units: 'Crabs',
    //     methods: []
    // },
    {
        id: 'ice_demon',
        name: 'Ice Demon',
        image: '/rooms/170px-Ice_demon.webp',
        description: 'High-level boss encounter',
        monsters: ['7585'],
        units: 'Pop Time',
        methods: []
    },
    {
        id: 'lizardman_shamans',
        name: 'Lizardman Shamans',
        image: '/rooms/200px-Lizardman_shaman.webp',
        description: 'High-level boss encounter',
        monsters: ['7573', '7573'],
        units: 'Lizardman Shamans',
        methods: ["Shamans Slayer Task"]
    },
    {
        id: 'vangs',
        name: 'Vanguards',
        image: '/rooms/280px-Vanguard_(magic).webp',
        description: 'God Wars Dungeon - Zamorak',
        monsters: ['7527', '7528', '7529'],
        units: 'Digs',
        methods: []
    },
    {
        id: 'thieving',
        name: 'Thieving',
        image: '/rooms/250px-Chest_(Chambers_of_Xeric,_closed).webp',
        description: 'High-level agility course',
        monsters: [],
        units: 'Chests',
        methods: ['Lockpick']
    },
    {
        id: 'vespula',
        name: 'Vespula',
        image: '/rooms/280px-Vespula.webp',
        description: 'Barrows Brothers minigame',
        monsters: ['7533'],
        units: 'Portals',
        methods: []
    },
    {
        id: 'guardians',
        name: 'Guardians',
        image: '/rooms/guardians.png',
        description: 'High-level boss encounter',
        monsters: ['7570', '7570'],
        units: 'Guardians',
        methods: []
    },
    {
        id: 'vasa',
        name: 'Vasa',
        image: '/rooms/250px-Vasa_Nistirio.webp',
        description: 'God Wars Dungeon - Zamorak',
        monsters: ['7566', '7568'],
        units: 'Crystals',
        methods: ['Flame Skip']
    },
    {
        id: 'mystics',
        name: 'Mystics',
        image: '/rooms/mystics.png',
        description: 'Barrows Brothers minigame',
        monsters: ['7604', '7604', '7604'],
        units: 'Mystics',
        methods: ['Mystics Slayer Task']
    },
    {
        id: 'muttadile',
        name: 'Muttadile',
        image: '/rooms/250px-Muttadile.webp',
        description: 'High-level boss encounter',
        monsters: ['7562', '7561'],
        units: 'Muttadiles',
        methods: []
    },
    {
        id: 'olm',
        name: 'Olm',
        image: '/rooms/300px-Great_Olm.webp',
        description: 'High-level boss encounter',
        monsters: ['7553', '7555', '7554'],
        units: 'Olm',
        methods: []
    }
];

export default cmMonsters;