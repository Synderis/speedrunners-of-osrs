import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { defaultSlotImages } from '../data/constants';
import { GearSlotMultiSelect } from './GearSlotMultiSelect';
import type { GearSetType, GearSets, Equipment } from '../types/equipment';

interface CharacterModelCardProps {
    gearType: GearSetType;
    gearSet: any[];
    setGearSets: React.Dispatch<React.SetStateAction<GearSets>>;
    gearData: Equipment[];
}

const CharacterModelCard: React.FC<CharacterModelCardProps> = ({ gearType, gearSet, setGearSets, gearData }) => {
    return (
        <motion.div
            className="character-model card"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
        >
            <motion.h3 transition={{ duration: 0.3 }}>
                {gearType.charAt(0).toUpperCase() + gearType.slice(1)} Setup
            </motion.h3>
            <div className="model-container">
                <div className="character-silhouette">
                    <AnimatePresence>
                        {gearSet.map((slot, slotIndex) => {
                            const slotKey = slot.slot.toLowerCase().replace('-', '') as keyof typeof defaultSlotImages;
                            const defaultImage = defaultSlotImages[slotKey];
                            // Use S3 url if image exists, otherwise fallback to default
                            return (
                                <div
                                    key={`${gearType}-${slot.slot}-${slotIndex}`}
                                    className={`equipped-${slotKey}`}
                                    style={{ position: 'relative', display: 'inline-block' }}
                                >
                                    <img
                                        src={slot.selected?.image ? `data:image/png;base64,${slot.selected.image}` : defaultImage}
                                        alt={slot.selected?.name || `Empty ${slot.slot}`}
                                        className="equipped-item"
                                        style={{ cursor: slot.selected ? 'pointer' : 'default' }}
                                        onClick={() => {
                                            if (slot.selected) {
                                                setGearSets(prev => ({
                                                    ...prev,
                                                    [gearType]: prev[gearType].map(s =>
                                                        s.slot === slot.slot ? { ...s, selected: undefined } : s
                                                    )
                                                }));
                                            }
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>
            <div style={{ marginTop: 16 }}>
                <GearSlotMultiSelect
                    gearType={gearType}
                    gearData={gearData.map(item =>
                        item.slot && item.slot.toLowerCase() === '2h'
                            ? { ...item, slot: 'Weapon' }
                            : item
                    )}
                    setGearSets={setGearSets}
                />
            </div>
        </motion.div>
    );
};

export default CharacterModelCard;
