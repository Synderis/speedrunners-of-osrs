
export interface GearSetPreset {
    id: string;
    name: string;
    description: string;
    gearSets: {
        melee: Record<string, string>;
        mage: Record<string, string>;
        ranged: Record<string, string>;
    };
}

export type GearSetType = 'melee' | 'mage' | 'ranged';

export const gearSetPresets: GearSetPreset[] = [
    {
        id: 'CM',
        name: 'CM',
        description: 'Chambers of Xeric Challenge Mode',
        gearSets: {
            melee: {
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
            },
            mage: {
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
            },
            ranged: {
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
        }
    },
    {
        id: 'sample1',
        name: 'Sample Preset 1',
        description: 'Sample preset for demo',
        gearSets: {
            melee: { weapon: 'dragon_scimitar' },
            mage: { weapon: 'trident_of_the_seas' },
            ranged: { weapon: 'rune_crossbow' }
        }
    },
    {
        id: 'sample2',
        name: 'Sample Preset 2',
        description: 'Another sample preset',
        gearSets: {
            melee: { weapon: 'granite_maul' },
            mage: { weapon: 'mystic_staff' },
            ranged: { weapon: 'blowpipe' }
        }
    }
];
