import type { Raid, Room } from '../types/raid';

export const CM_ROOMS: Room[] = [
    {
        id: 'tekton',
        name: 'Tekton',
        image: '/rooms/220px-Tekton.webp',
        monsters: ['7545', '7544']
    },
    {
        id: 'crabs',
        name: 'Crabs',
        image: '/rooms/150px-Jewelled_Crab.webp',
        monsters: []
    },
    {
        id: 'ice_demon',
        name: 'Ice Demon',
        image: '/rooms/170px-Ice_demon.webp',
        monsters: []
    },
    {
        id: 'lizardman_shamans',
        name: 'Lizardman Shamans',
        image: '/rooms/200px-Lizardman_shaman.webp',
        monsters: []
    },
    {
        id: 'vanguards',
        name: 'Vanguards',
        image: '/rooms/280px-Vanguard_(magic).webp',
        monsters: []
    },
    {
        id: 'vespula',
        name: 'Vespula',
        image: '/rooms/280px-Vespula.webp',
        monsters: []
    },
    {
        id: 'tightrope',
        name: 'Tightrope',
        image: '/rooms/130px-Keystone_crystal_detail.webp',
        monsters: []
    },
    {
        id: 'guardians',
        name: 'Guardians',
        image: '/rooms/guardians.png',
        monsters: []
    },
    {
        id: 'vasa',
        name: 'Vasa',
        image: '/rooms/250px-Vasa_Nistirio.webp',
        monsters: ['7566']
    },
    {
        id: 'mystics',
        name: 'Mystics',
        image: '/rooms/mystics.png',
        monsters: []
    },
    {
        id: 'muttadile',
        name: 'Muttadile',
        image: '/rooms/250px-Muttadile.webp',
        monsters: []
    },
    {
        id: 'olm',
        name: 'Olm',
        image: '/rooms/300px-Great_Olm.webp',
        monsters: []
    }
];

export const RAIDS: Raid[] = [
    {
        id: 'cm_cox',
        name: 'Chambers of Xeric',
        description: 'The Chambers of Xeric is a raid located in the Kebos Lowlands.',
        rooms: CM_ROOMS
    }
];

