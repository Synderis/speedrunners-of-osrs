export interface PresetRoom {
    id: string;
    method?: string;
    methods?: string[]; // Support for multiple methods
    specs?: { weapon: string; count: number }; // Add spec assignment
}

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
    rooms: PresetRoom[]; // Array of room IDs where this preset is applicable
    roomSpecs?: { [roomId: string]: { weapon: string; count: number } }; // Add this line
    combatStats?: {
        attack: number;
        strength: number;
        defence: number;
        ranged: number;
        prayer: number;
        magic: number;
        hitpoints: number;
    };
}

export type GearSetType = "melee" | "mage" | "ranged";

export const gearSetPresets: GearSetPreset[] = [
    {
        id: "CM",
        name: "CM",
        description: "Chambers of Xeric Challenge Mode",
        gearSets: {
            melee: {
                weapon: "22325",
                head: "30750",
                neck: "29801",
                cape: "21295",
                shield: "",
                body: "30753",
                legs: "30756",
                hands: "22981",
                feet: "31097",
                ring: "28307",
                ammo: "11212"
            },
            mage: {
                weapon: "27275",
                head: "21018",
                neck: "12002",
                cape: "21791",
                shield: "",
                body: "21021",
                legs: "21024",
                hands: "31106",
                feet: "31097",
                ring: "28313",
                ammo: "11212"
            },
            ranged: {
                weapon: "20997",
                head: "27235",
                neck: "19547",
                cape: "28955",
                shield: "",
                body: "27238",
                legs: "27241",
                hands: "26235",
                feet: "31097",
                ring: "28310",
                ammo: "11212"
            }
        },
        inventoryItems: [
            "25975",
            "11865",
            "11808",
            "11920",
            "21003",
            "29577",
            "22322",
            "26374"
        ],
        combatStats: {
            attack: 99,
            strength: 99,
            defence: 99,
            ranged: 99,
            prayer: 99,
            magic: 99,
            hitpoints: 99
        },
        rooms: [
            { id: "tekton", methods: ["Tekton Short Lure", "Pre-Veng"] }, // Multiple methods example
            { id: "ice_demon" },
            { id: "lizardman_shamans", method: "Shamans Slayer Task" },
            { id: "vangs" },
            { id: "thieving", method: "Lockpick" },
            { id: "vespula" },
            { id: "guardians" },
            { id: "vasa", method: "Vasa Flame Skip" },
            { id: "mystics" },
            { id: "muttadile" },
            { id: "olm"}
        ]
    },
    {
        id: "sample1",
        name: "Sample Preset 1",
        description: "Sample preset for demo",
        gearSets: {
            melee: { weapon: "dragon_scimitar" },
            mage: { weapon: "trident_of_the_seas" },
            ranged: { weapon: "rune_crossbow" }
        },
    inventoryItems: [],
    rooms: [{ id: "all" }]
    },
    {
        id: "sample2",
        name: "Sample Preset 2",
        description: "Another sample preset",
        gearSets: {
            melee: { weapon: "granite_maul" },
            mage: { weapon: "mystic_staff" },
            ranged: { weapon: "blowpipe" }
        },
    inventoryItems: [],
    rooms: [{ id: "all" }]
    }
];
