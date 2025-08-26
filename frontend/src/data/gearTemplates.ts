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

export type GearSetType = 'melee' | 'mage' | 'ranged';

export const gearSetPresets: GearSetPreset[] = [
    {
        id: 'CM',
        name: 'CM',
        description: 'Chambers of Xeric Challenge Mode',
        gearSets: {
            melee: {
                weapon: "22325",
                head: "26382",
                neck: "29801",
                cape: "21295",
                shield: "",
                body: "26384",
                legs: "26386",
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
                cape: "22109",
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
            "12018",
            "11865",
            "11808"
        ]
    },
    {
        id: 'sample1',
        name: 'Sample Preset 1',
        description: 'Sample preset for demo',
        gearSets: {
            melee: { weapon: 'dragon_scimitar' },
            mage: { weapon: 'trident_of_the_seas' },
            ranged: { weapon: 'rune_crossbow' }
        },
    inventoryItems: []
    },
    {
        id: 'sample2',
        name: 'Sample Preset 2',
        description: 'Another sample preset',
        gearSets: {
            melee: { weapon: 'granite_maul' },
            mage: { weapon: 'mystic_staff' },
            ranged: { weapon: 'blowpipe' }
        },
    inventoryItems: []
    }
];
