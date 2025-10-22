export interface Raid {
    id: string;
    name: string;
    description: string;
    rooms: Room[];
}

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

export interface Room {
    id: string;
    name: string;
    image: string;
    monsters?: string[];
    units: string;
    methods: string[];
    specialAttacks?: {
        name: string;
        count: number;
    }[];
    methodCategories?: {
        [categoryName: string]: {
            methods: string[];
            allowMultiple: boolean; // if true, checkboxes; if false, radio buttons
        };
    };
}