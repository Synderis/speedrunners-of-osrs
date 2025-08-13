export interface GearPreset {
    id: string;
    name: string;
    description: string;
    gearIds: Record<string, string>;
}

export type GearSetType = 'melee' | 'mage' | 'ranged';

export const presetsByType: Record<GearSetType, GearPreset[]> = {
    melee: [
        {
            id: 'strength_training',
            name: 'Max Melee Torva',
            description: 'Max Melee Torva',
            gearIds: {
                weapon: '22978',
                shield: '22322',
                head: '26382',
                cape: '23622',
                neck: '29801',
                ammo: '11212',
                body: '26384',
                legs: '26386',
                hands: '22981',
                feet: '13239',
                ring: '25485'
            }
        },
        {
            id: 'budget_melee',
            name: 'Budget Melee',
            description: 'Affordable melee setup',
            gearIds: {
                weapon: 'dragon_scimitar',
                shield: 'rune_kiteshield',
                head: 'rune_full_helm',
                cape: 'legends_cape',
                neck: 'amulet_of_strength',
                body: 'rune_platebody',
                legs: 'rune_platelegs',
                hands: 'rune_gloves',
                feet: 'rune_boots',
                ring: 'ring_of_wealth'
            }
        },
        {
            id: 'obsidian_setup',
            name: 'Obsidian Tank',
            description: 'High defence obsidian setup',
            gearIds: {
                weapon: 'granite_maul',
                head: 'berserker_helm',
                cape: 'obsidian_cape',
                neck: 'amulet_of_glory',
                legs: 'obsidian_platelegs',
                hands: 'dragon_gloves',
                feet: 'climbing_boots',
                ring: 'warrior_ring'
            }
        }
    ],
    mage: [
        {
            id: 'magic_training',
            name: 'Max Mage Torva',
            description: 'Max Mage Torva',
            gearIds: {
                weapon: '22978',
                shield: '22322',
                head: '26382',
                cape: '23622',
                neck: '29801',
                ammo: '11212',
                body: '26384',
                legs: '26386',
                hands: '22981',
                feet: '13239',
                ring: '25485'
            }
        },
        {
            id: 'budget_magic',
            name: 'Budget Magic',
            description: 'Affordable magic setup',
            gearIds: {
                weapon: 'dragon_scimitar',
                shield: 'rune_kiteshield',
                head: 'rune_full_helm',
                cape: 'legends_cape',
                neck: 'amulet_of_strength',
                body: 'rune_platebody',
                legs: 'rune_platelegs',
                hands: 'rune_gloves',
                feet: 'rune_boots',
                ring: 'ring_of_wealth'
            }
        },
        {
            id: 'obsidian_setup',
            name: 'Obsidian Tank',
            description: 'High defence obsidian setup',
            gearIds: {
                weapon: 'granite_maul',
                head: 'berserker_helm',
                cape: 'obsidian_cape',
                neck: 'amulet_of_glory',
                legs: 'obsidian_platelegs',
                hands: 'dragon_gloves',
                feet: 'climbing_boots',
                ring: 'warrior_ring'
            }
        }
    ],
    ranged: [
        {
            id: 'ranged_training',
            name: 'Max Ranged Torva',
            description: 'Max Ranged Torva',
            gearIds: {
                weapon: '22978',
                shield: '22322',
                head: '26382',
                cape: '23622',
                neck: '29801',
                ammo: '11212',
                body: '26384',
                legs: '26386',
                hands: '22981',
                feet: '13239',
                ring: '25485'
            }
        },
        {
            id: 'budget_ranged',
            name: 'Budget Ranged',
            description: 'Affordable ranged setup',
            gearIds: {
                weapon: 'dragon_scimitar',
                shield: 'rune_kiteshield',
                head: 'rune_full_helm',
                cape: 'legends_cape',
                neck: 'amulet_of_strength',
                body: 'rune_platebody',
                legs: 'rune_platelegs',
                hands: 'rune_gloves',
                feet: 'rune_boots',
                ring: 'ring_of_wealth'
            }
        },
        {
            id: 'obsidian_setup',
            name: 'Obsidian Tank',
            description: 'High defence obsidian setup',
            gearIds: {
                weapon: 'granite_maul',
                head: 'berserker_helm',
                cape: 'obsidian_cape',
                neck: 'amulet_of_glory',
                legs: 'obsidian_platelegs',
                hands: 'dragon_gloves',
                feet: 'climbing_boots',
                ring: 'warrior_ring'
            }
        }
    ]
};
