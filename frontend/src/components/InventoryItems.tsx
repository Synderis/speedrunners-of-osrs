import { motion, AnimatePresence } from 'framer-motion';
import type { Equipment, InventoryItem } from '../types/equipment';
import './InventoryItems.css';

const INVENTORY_IDS = [
    25975, 11808, 29577, 29589, 12018, 11865, 27690, 21003
];
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
        setSelectedItems(prev => {
            if (isSelected(eq.id)) {
                // Remove if already selected
                return prev.filter(item => item.equipment?.id !== eq.id);
            } else {
                // Add new InventoryItem
                return [...prev, { name: eq.name, equipment: eq }];
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
                    {inventoryEquipment.map((eq, idx) => (
                        <motion.div
                            key={eq?.id || idx}
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
                                className={`inventory-btn${eq && isSelected(eq.id) ? ' selected' : ''}`}
                                onClick={() => handleToggle(idx)}
                                disabled={!eq}
                            >
                                <img
                                    src={`data:image/png;base64,${eq?.image}` || '/gear/default.webp'}
                                    alt={eq?.name || `Inventory item ${idx + 1}`}
                                />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default InventoryItems;