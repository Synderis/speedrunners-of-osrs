import React, { useState } from 'react';
import { motion } from 'framer-motion';
import './InventoryItems.css';

const INVENTORY_IMAGES = [
    '/gear/120px-Lightbearer_detail.webp',
    '/gear/140px-Zamorak_godsword_detail.webp',
    '/gear/130px-Burning_claws_detail.webp',
    '/gear/150px-Emberlight_detail.webp',
    '/gear/150px-Salve_amulet(ei)_detail.webp',
    '/gear/140px-Slayer_helmet_detail.webp',
    '/gear/150px-Voidwaker_detail.webp'
];

const InventoryItems: React.FC = () => {
    const [selected, setSelected] = useState<boolean[]>(() =>
        Array(INVENTORY_IMAGES.length).fill(false)
    );

    const handleToggle = (idx: number) => {
        setSelected(prev =>
            prev.map((val, i) => (i === idx ? !val : val))
        );
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
                    {INVENTORY_IMAGES.map((img, idx) => (
                        <motion.div
                            key={img}
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
                            className={`inventory-btn${selected[idx] ? ' selected' : ''}`}
                            onClick={() => handleToggle(idx)}
                        >
                            <img
                                src={img}
                                alt={`Inventory item ${idx + 1}`}
                            />
                        </button>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default InventoryItems;