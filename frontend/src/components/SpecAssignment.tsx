import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDefaultSpecCount } from '../data/monsterStats';
import type { InventoryItem } from '../types/player';
import type { SelectedRoomWithMonster } from './RoomSelection';

interface SpecAssignmentProps {
    selectedRooms: SelectedRoomWithMonster[];
    selectedInventoryItems: InventoryItem[];
    roomSpecs: { [roomId: string]: { [weaponName: string]: number } };
    setRoomSpecs: React.Dispatch<React.SetStateAction<{ [roomId: string]: { [weaponName: string]: number } }>>;
}

const SpecAssignment: React.FC<SpecAssignmentProps> = ({
    selectedRooms,
    selectedInventoryItems,
    roomSpecs,
    setRoomSpecs
}) => {
    const [specDropdownOpen, setSpecDropdownOpen] = useState(false);

    // Check if any rooms have weapons with default specs
    const hasSpecAssignments = selectedRooms.some(room =>
        selectedInventoryItems.some(item =>
            item.equipment?.slot === 'weapon' && getDefaultSpecCount(room.id, item.name) > 0
        )
    );

    if (!hasSpecAssignments) {
        return null;
    }

    return (
        <div className="spec-assignment-container">
            <button
                className="btn"
                style={{ margin: '16px 0' }}
                onClick={() => setSpecDropdownOpen(open => !open)}
            >
                {specDropdownOpen ? 'Hide Spec Assignment' : 'Manually Assign Specs'}
            </button>
            <AnimatePresence>
                {specDropdownOpen && (
                    <motion.div
                        className="spec-dropdown"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        <h2 className="section-title">Spec Assignment</h2>
                        {selectedRooms
                            .filter(room =>
                                selectedInventoryItems.some(item =>
                                    item.equipment?.slot === 'weapon' && getDefaultSpecCount(room.id, item.name) > 0
                                )
                            )
                            .map(room => {
                                // Get weapons that have defaults for this room
                                const availableWeapons = selectedInventoryItems
                                    .filter(item =>
                                        item.equipment?.slot === 'weapon' &&
                                        getDefaultSpecCount(room.id, item.name) > 0
                                    );

                                return (
                                    <div key={room.id} className="spec-assignment-room">
                                        <span className="room-name">{room.name}</span>
                                        <div className="weapon-spec-list">
                                            {availableWeapons.map(item => {
                                                const defaultCount = getDefaultSpecCount(room.id, item.name);
                                                const isSelected = roomSpecs[room.id]?.[item.name] !== undefined;

                                                return (
                                                    <div key={item.equipment?.id} className="weapon-spec-item">
                                                        <button
                                                            className={`weapon-spec-button ${isSelected ? 'selected' : ''}`}
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    // Remove this specific weapon from the room
                                                                    setRoomSpecs(prev => {
                                                                        const newSpecs = { ...prev };
                                                                        if (newSpecs[room.id]) {
                                                                            delete newSpecs[room.id][item.name];
                                                                            // If no weapons left for this room, remove the room entry
                                                                            if (Object.keys(newSpecs[room.id]).length === 0) {
                                                                                delete newSpecs[room.id];
                                                                            }
                                                                        }
                                                                        return newSpecs;
                                                                    });
                                                                } else {
                                                                    // Add this weapon to the room
                                                                    setRoomSpecs(prev => ({
                                                                        ...prev,
                                                                        [room.id]: {
                                                                            ...prev[room.id],
                                                                            [item.name]: defaultCount
                                                                        }
                                                                    }));
                                                                }
                                                            }}
                                                        >
                                                            <span className="weapon-name">{item.name}</span>
                                                            <span className="spec-count">(Default: {defaultCount} specs)</span>
                                                        </button>
                                                        {isSelected && (
                                                            <label className="spec-count-input">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    value={roomSpecs[room.id]?.[item.name] || defaultCount}
                                                                    onChange={e =>
                                                                        setRoomSpecs(prev => ({
                                                                            ...prev,
                                                                            [room.id]: {
                                                                                ...prev[room.id],
                                                                                [item.name]: Number(e.target.value)
                                                                            }
                                                                        }))
                                                                    }
                                                                />
                                                            </label>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SpecAssignment;