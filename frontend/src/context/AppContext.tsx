// Create contexts/AppContext.tsx
import { createContext, useContext, useState } from 'react';
import type { GearSets, CombatStats, InventoryItem } from '../types/player';
import type { SelectedRoomWithMonster } from '../components/RoomSelection';
import type { ReactNode } from 'react';

interface AppContextType {
    // Gear state
    gearSets: GearSets;
    setGearSets: React.Dispatch<React.SetStateAction<GearSets>>;
    combatStats: CombatStats;
    setCombatStats: React.Dispatch<React.SetStateAction<CombatStats>>;
    selectedInventoryItems: InventoryItem[];
    setSelectedInventoryItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;

    // Room state
    selectedRooms: SelectedRoomWithMonster[];
    setSelectedRooms: React.Dispatch<React.SetStateAction<SelectedRoomWithMonster[]>>;
    selectedMethods: { [roomId: string]: string[] };
    setSelectedMethods: React.Dispatch<React.SetStateAction<{ [roomId: string]: string[] }>>;
    roomSpecs: { [roomId: string]: { [weaponName: string]: number } };
    setRoomSpecs: React.Dispatch<React.SetStateAction<{ [roomId: string]: { [weaponName: string]: number } }>>;

    // Preset state
    selectedPreset: string;
    setSelectedPreset: React.Dispatch<React.SetStateAction<string>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [gearSets, setGearSets] = useState<GearSets>({ melee: [], mage: [], ranged: [] });
    const [combatStats, setCombatStats] = useState<CombatStats>({
        attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99,
        hitpoints: 99, prayer: 99, woodcutting: 99, mining: 99, thieving: 99
    });
    const [selectedInventoryItems, setSelectedInventoryItems] = useState<InventoryItem[]>([]);
    const [selectedRooms, setSelectedRooms] = useState<SelectedRoomWithMonster[]>([]);
    const [selectedMethods, setSelectedMethods] = useState<{ [roomId: string]: string[] }>({});
    const [roomSpecs, setRoomSpecs] = useState<{ [roomId: string]: { [weaponName: string]: number } }>({});
    const [selectedPreset, setSelectedPreset] = useState<string>('');

    return (
        <AppContext.Provider value={{
            gearSets, setGearSets, combatStats, setCombatStats,
            selectedInventoryItems, setSelectedInventoryItems,
            selectedRooms, setSelectedRooms, selectedMethods, setSelectedMethods,
            roomSpecs, setRoomSpecs, selectedPreset, setSelectedPreset
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAppContext must be used within AppProvider');
    return context;
};