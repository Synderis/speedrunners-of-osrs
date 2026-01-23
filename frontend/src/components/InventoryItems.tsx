import { motion, AnimatePresence } from 'framer-motion';
import type { Equipment, InventoryItem } from '../types/player';
import './InventoryItems.css';

const INVENTORY_IDS = [
    11808, // Zamorak godsword
    29577, // Burning claws
    29589, // Emberlight
    12018, // Salve amulet (ei)
    11865, // Slayer helmet (i)
    27690, // Voidwaker
    11920, // Dragon pickaxe
    1275, // Rune pickaxe
    22322, // Avernic defender
    12954, // Dragon defender
    26374, // Zaryte crossbow
    21003, // Elder maul
    13576 // Dragon warhammer
];
//25975 Lightbearer removing for now
//make sure to add lockpick somehow as its not technically an item so we will exclude it for now

interface InventoryItemsProps {
    equipment: Equipment[];
    selectedItems: InventoryItem[];
    setSelectedItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
}

const InventoryItems: React.FC<InventoryItemsProps> = ({
    equipment,
    selectedItems = [],
    setSelectedItems
}) => {
    // Find Equipment objects for inventory IDs
    const inventoryEquipment = INVENTORY_IDS.map(id =>
        equipment.find(eq => Number(eq.id) === id)
    );

    const isSelected = (id: number | string) =>
        selectedItems.some(item => item.equipment?.id === id);

    const handleToggle = (idx: number) => {
        const eq = inventoryEquipment[idx];
        if (!eq) return;
        // Define mutually exclusive pairs
        const exclusivePairs: [number, number][] = [
            [21003, 13576],
            [12954, 22322],
            [1275, 11920],
        ];
        setSelectedItems(prev => {
            let newSelected = prev;
            // Remove the paired item if this one is in a pair
            for (const [a, b] of exclusivePairs) {
                if (eq.id === a) {
                    newSelected = newSelected.filter(item => item.equipment?.id !== b);
                } else if (eq.id === b) {
                    newSelected = newSelected.filter(item => item.equipment?.id !== a);
                }
            }
            if (isSelected(eq.id)) {
                // Remove if already selected
                return newSelected.filter(item => item.equipment?.id !== eq.id);
            } else {
                // Add new InventoryItem
                return [...newSelected, { name: eq.name, equipment: eq }];
            }
        });
    };

    return (
        <div className="inventory-items-row">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <span className="inventory-items-label">Inventory items:</span>
            </motion.div>
            <div className="inventory-items">
                <AnimatePresence>
                    {inventoryEquipment.map((eq, idx) =>
                        eq ? (
                            <motion.div
                                key={eq.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.1 * idx }}
                                whileHover={{
                                    y: -6,
                                    transition: { duration: 0.1 }
                                }}
                            >
                                <button
                                    type="button"
                                    className={`inventory-btn${isSelected(eq.id) ? ' selected' : ''}`}
                                    onClick={() => handleToggle(idx)}
                                >
                                    <img
                                        src={`data:image/png;base64,${eq.image}`}
                                        alt={eq.name}
                                    />
                                </button>
                            </motion.div>
                        ) : null
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default InventoryItems;