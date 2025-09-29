import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { fadeInOut, slideInOut, hoverEffects } from '../utils/animations';
import { cmMonsters, rooms, type Monster, type Room } from '../data/monsterStats';
import type { InventoryItem } from '../types/player';
import { gearSetPresets } from '../data/gearTemplates';
import './RoomSelection.css';

export interface SelectedRoomWithMonster extends Room {
    monster?: Monster;
}

interface RoomSelectionProps {
    selectedRooms: SelectedRoomWithMonster[];
    setSelectedRooms: React.Dispatch<React.SetStateAction<SelectedRoomWithMonster[]>>;
    selectedMethods: { [roomId: string]: string[] };
    setSelectedMethods: React.Dispatch<React.SetStateAction<{ [roomId: string]: string[] }>>;
    selectedPreset: string;
    selectedInventoryItems: InventoryItem[]; // <-- Use InventoryItem here
    roomSpecs: { [roomId: string]: { weapon: string; count: number } };
  setRoomSpecs: React.Dispatch<React.SetStateAction<{ [roomId: string]: { weapon: string; count: number } }>>;
}

const RoomSelection: React.FC<RoomSelectionProps> = ({
    selectedRooms,
    setSelectedRooms,
    selectedMethods,
    setSelectedMethods,
    selectedPreset,
    selectedInventoryItems,
    roomSpecs,
    setRoomSpecs
}) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [specDropdownOpen, setSpecDropdownOpen] = useState(false);
    // const [roomSpecs, setRoomSpecs] = useState<{ [roomId: string]: { weapon: string; count: number } }>({});

    const headerRef = useRef(null);
    const displayRef = useRef(null);
    const gridRef = useRef(null);

    const headerInView = useInView(headerRef, { once: true, amount: 0.8 });
    const displayInView = useInView(displayRef, { once: true, amount: 0.5 });
    const gridInView = useInView(gridRef, { once: true, amount: isMobile ? 0.1 : 0.2 });

    // Helper function to get monster stats by room
    const getMonsterByRoom = (room: Room): Monster | undefined => {
        if (!room.id) return undefined;
        return cmMonsters.find(monster => monster.id.toString() === room.id);
    };

    // Helper function to get all monsters for a room
    const getMonstersByRoom = (room: Room): Monster[] => {
        if (!room.monsters) return [];
        return room.monsters
            .map(monsterId => cmMonsters.find(m => m.id.toString() === monsterId))
            .filter((m): m is Monster => m !== undefined);
    };

    // Get all selected monsters for WASM input
    const getSelectedMonsters = (): Monster[] => {
        return selectedRooms.flatMap(room => getMonstersByRoom(room));
    };

    // Update the parent state whenever selected rooms change
    // useEffect(() => {
    //     const monsters = getSelectedMonsters();
    //     setSelectedMonsters(monsters);
    // }, [selectedRooms, setSelectedMonsters]);

    const handleRoomSelect = (room: Room) => {
        setSelectedRooms(prev => {
            const isSelected = prev.some(r => r.id === room.id);
            if (isSelected) {
                return prev.filter(r => r.id !== room.id);
            } else {
                const monster = getMonsterByRoom(room);
                // If only one method, default to empty array unless selected
                const methods = room.methods && room.methods.length === 1 ? [] : room.methods;
                const roomWithMonster: SelectedRoomWithMonster = {
                    ...room,
                    monster,
                    methods
                };
                return [...prev, roomWithMonster];
            }
        });
    };

    const selectAll = () => {
        const roomsWithMonsters: SelectedRoomWithMonster[] = rooms.map(room => {
            const monster = getMonsterByRoom(room);

            // Check if this room already has a selected method from preset
            const existingRoom = selectedRooms.find(r => r.id === room.id);
            const hasPresetMethod = selectedMethods[room.id];

            let methods: string[];
            if (hasPresetMethod && existingRoom) {
                // Preserve the preset method selection
                methods = existingRoom.methods || [];
            } else {
                // Default behavior for rooms without preset methods
                methods = room.methods && room.methods.length === 1 ? [] : room.methods;
            }

            return {
                ...room,
                monster,
                methods
            };
        });
        setSelectedRooms(roomsWithMonsters);
    };

    const clearSelection = () => {
        setSelectedRooms([]);
    };

    const removeRoom = (roomId: string) => {
        setSelectedRooms(prev => prev.filter(r => r.id !== roomId));
    };

    // Debug: Log selected monsters for WASM integration
    useEffect(() => {
        const monsters = getSelectedMonsters();
        console.log('Selected monsters for WASM:', monsters);
    }, [selectedRooms]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Handler for method selection with category support
    const handleMethodSelect = (room: Room, method: string) => {
        const originalRoom = rooms.find(orig => orig.id === room.id);
        if (!originalRoom?.methodCategories) {
            // Fallback to old single-method logic if no categories defined
            setSelectedMethods(prev => ({
                ...prev,
                [room.id]: prev[room.id]?.includes(method) ? prev[room.id].filter(m => m !== method) : [method]
            }));
            return;
        }

        // Find which category this method belongs to
        let methodCategory = '';
        let allowMultiple = true;
        for (const [categoryName, categoryData] of Object.entries(originalRoom.methodCategories)) {
            if (categoryData.methods.includes(method)) {
                methodCategory = categoryName;
                allowMultiple = categoryData.allowMultiple;
                break;
            }
        }

        setSelectedMethods(prev => {
            const currentMethods = prev[room.id] || [];

            if (allowMultiple) {
                // Checkbox behavior - toggle the method
                if (currentMethods.includes(method)) {
                    return {
                        ...prev,
                        [room.id]: currentMethods.filter(m => m !== method)
                    };
                } else {
                    return {
                        ...prev,
                        [room.id]: [...currentMethods, method]
                    };
                }
            } else {
                // Radio button behavior - replace other methods in same category
                const categoryMethods = originalRoom.methodCategories?.[methodCategory]?.methods || [];
                const methodsFromOtherCategories = currentMethods.filter(m => !categoryMethods.includes(m));

                if (currentMethods.includes(method)) {
                    // Deselecting current method
                    return {
                        ...prev,
                        [room.id]: methodsFromOtherCategories
                    };
                } else {
                    // Selecting new method (replace others in same category)
                    return {
                        ...prev,
                        [room.id]: [...methodsFromOtherCategories, method]
                    };
                }
            }
        });

        // Update room methods in selectedRooms
        setSelectedRooms(prevRooms => prevRooms.map(r => {
            if (r.id !== room.id) return r;

            // Get the updated methods list
            const updatedMethods = (() => {
                const currentMethods = selectedMethods[room.id] || [];

                if (allowMultiple) {
                    if (currentMethods.includes(method)) {
                        return currentMethods.filter(m => m !== method);
                    } else {
                        return [...currentMethods, method];
                    }
                } else {
                    const categoryMethods = originalRoom.methodCategories?.[methodCategory]?.methods || [];
                    const methodsFromOtherCategories = currentMethods.filter(m => !categoryMethods.includes(m));

                    if (currentMethods.includes(method)) {
                        return methodsFromOtherCategories;
                    } else {
                        return [...methodsFromOtherCategories, method];
                    }
                }
            })();

            return { ...r, methods: updatedMethods };
        }));
    };

    useEffect(() => {
        const selectedGearPreset = gearSetPresets.find(p => p.id === selectedPreset);
        if (selectedGearPreset) {
            const allowedRoomIds = selectedGearPreset.rooms.map(r => r.id);
            const presetRooms: SelectedRoomWithMonster[] = rooms
                .filter(room => allowedRoomIds.includes(room.id))
                .map(room => {
                    const presetRoom = selectedGearPreset.rooms.find(r => r.id === room.id);
                    let methods: string[] = [];
                    if (presetRoom?.methods) {
                        methods = presetRoom.methods;
                    } else if (presetRoom?.method) {
                        methods = [presetRoom.method];
                    } else if (room.methods && room.methods.length > 1) {
                        methods = room.methods;
                    } // else leave as []
                    return {
                        ...room,
                        monster: getMonsterByRoom(room),
                        methods
                    };
                });
            setSelectedRooms(presetRooms);

            // Set selectedMethods if method is specified
            const newSelectedMethods: { [roomId: string]: string[] } = {};
            selectedGearPreset.rooms.forEach(r => {
                if (r.methods) {
                    newSelectedMethods[r.id] = r.methods;
                } else if (r.method) {
                    newSelectedMethods[r.id] = [r.method];
                }
            });
            setSelectedMethods(newSelectedMethods);
        } else {
            setSelectedRooms([]);
            setSelectedMethods({});
        }
    }, [selectedPreset]);

    return (
        <section id="rooms" className="section">
            <div className="container">
                <motion.div
                    className="room-selection"
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    <motion.div
                        ref={headerRef}
                        className="room-header"
                        initial={{ opacity: 0, y: 30 }}
                        animate={headerInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2 className="section-title">Room Selection</h2>
                        <div className="room-controls">
                            <span className="selected-count">
                                {selectedRooms.length} room{selectedRooms.length !== 1 ? 's' : ''} selected
                                {getSelectedMonsters().length > 0 && (
                                    <span className="monster-count">
                                        ({getSelectedMonsters().length} with monster data)
                                    </span>
                                )}
                            </span>
                            <button
                                className="btn select-all-btn"
                                onClick={selectAll}
                                disabled={selectedRooms.length === rooms.length}
                            >
                                Select All
                            </button>
                            <button
                                className="btn clear-room-btn"
                                onClick={clearSelection}
                                disabled={selectedRooms.length === 0}
                            >
                                Clear All
                            </button>
                        </div>
                    </motion.div>

                    <motion.div
                        ref={displayRef}
                        className="selected-rooms-display"
                        initial={{ opacity: 0, y: 30 }}
                        animate={displayInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <AnimatePresence mode="wait">
                            {selectedRooms.length > 0 ? (
                                <motion.div
                                    className="selected-rooms-list"
                                    {...fadeInOut}
                                >
                                    <h3 className="selected-rooms-title">Selected Rooms:</h3>
                                    <div className="selected-rooms-container">
                                        <AnimatePresence>
                                            {selectedRooms.map((room) => (
                                                <motion.div
                                                    key={room.id}
                                                    className={`selected-room-item ${room.id ? 'has-monster' : 'no-monster'}`}
                                                    onClick={() => removeRoom(room.id)}
                                                    {...slideInOut}
                                                    {...hoverEffects.cardHover}
                                                >
                                                    <img
                                                        src={room.image}
                                                        alt={room.name}
                                                        className="selected-room-item-image"
                                                    />
                                                    <div className="selected-room-info">
                                                        <span className="selected-room-item-name">{room.name}</span>
                                                        {room.id && (
                                                            <div className="monster-stats-preview">
                                                                <span className="monster-level">CB: {room.id}</span>
                                                                <span className="monster-hp">HP: {room.id}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Remove the button entirely */}
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>

                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    className="no-rooms-selected"
                                    {...fadeInOut}
                                >
                                    <span>No rooms selected - click on rooms below to add them</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    <motion.div
                        ref={gridRef}
                        className="rooms-grid"
                        initial={{ opacity: 0 }}
                        animate={gridInView ? { opacity: 1 } : { opacity: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <AnimatePresence>
                            {rooms.filter(room => !selectedRooms.some(r => r.id === room.id)).length === 0 ? (
                                <div className="no-rooms">No rooms available</div>
                            ) : (
                                rooms.filter(room => !selectedRooms.some(r => r.id === room.id)).map((room, index) => {
                                    const hasMonsterData = getMonsterByRoom(room) !== undefined;

                                    return (
                                        <motion.div
                                            key={room.id}
                                            className={`room-card card ${hasMonsterData ? 'has-monster-data' : 'no-monster-data'}`}
                                            onClick={() => handleRoomSelect(room)}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={gridInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                            transition={{
                                                duration: 0.3,
                                                delay: gridInView ? index * 0.05 : 0,
                                                ease: [0.25, 0.1, 0.25, 1]
                                            }}
                                            whileHover={{
                                                y: -8,
                                                scale: 1.02,
                                                transition: { duration: 0.2 }
                                            }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <div className="room-image-container">
                                                <motion.img
                                                    src={room.image}
                                                    alt={room.name}
                                                    className="room-image"
                                                    whileHover={{
                                                        scale: 1.05,
                                                        transition: { duration: 0.2 }
                                                    }}
                                                />
                                                {hasMonsterData && (
                                                    <div className="monster-data-indicator">
                                                        <span>✓</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="room-info">
                                                <h4 className="room-name">{room.name}</h4>
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                        </AnimatePresence>
                    </motion.div>
                    <h2 className="section-title">Room Methods</h2>
                    <div className="all-room-methods">

                        {selectedRooms.map(room => {
                            const originalRoom = rooms.find(orig => orig.id === room.id);

                            // Use method categories if available, otherwise fall back to simple methods
                            if (originalRoom?.methodCategories) {
                                const allCategoryMethods = Object.entries(originalRoom.methodCategories).flatMap(([categoryName, categoryData]) =>
                                    categoryData.methods.map(method => ({
                                        method,
                                        allowMultiple: categoryData.allowMultiple,
                                        categoryName
                                    }))
                                );
                                if (allCategoryMethods.length === 0) return null; // Only render if there are methods

                                return (
                                    <div key={room.id} className="selected-room-methods">
                                        <div className="room-method-buttons">
                                            {allCategoryMethods.map(({ method, allowMultiple }) => {
                                                const isSelected = selectedMethods[room.id]?.includes(method) || false;
                                                const inputType = allowMultiple ? 'checkbox' : 'radio';
                                                return (
                                                    <button
                                                        key={method}
                                                        className={`method-tab ${isSelected ? 'active' : ''} ${inputType}`}
                                                        onClick={() => handleMethodSelect(room, method)}
                                                    >
                                                        {method}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            } else {
                                const showSingleMethod = originalRoom && originalRoom.methods && originalRoom.methods.length === 1;
                                const methodsToShow = (room.methods && room.methods.length > 0)
                                    ? room.methods
                                    : (showSingleMethod ? originalRoom.methods : []);
                                if (!methodsToShow || methodsToShow.length === 0) return null; // Only render if there are methods

                                return (
                                    <div key={room.id} className="selected-room-methods">
                                        <div className="room-method-buttons">
                                            {methodsToShow.map(method => (
                                                <button
                                                    key={method}
                                                    className={`method-tab${selectedMethods[room.id]?.includes(method) ? ' active' : ''}`}
                                                    onClick={() => handleMethodSelect(room, method)}
                                                >
                                                    {method}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                        })}
                    </div>
                    {/* Spec Assignment Dropdown (for all rooms) */}
                    {selectedRooms.length > 0 && (
                        <div className="spec-assignment-container">
                            <button
                                className="spec-dropdown-toggle"
                                style={{ margin: '16px 0' }}
                                onClick={() => setSpecDropdownOpen(open => !open)}
                            >
                                {specDropdownOpen ? 'Hide Spec Assignment' : 'Assign Specs'}
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
                                        {selectedRooms.map(room => (
                                            <div key={room.id} className="spec-assignment-room">
                                                <span className="room-name">{room.name}</span>
                                                <label>
                                                    Weapon:
                                                    <select
                                                        value={roomSpecs[room.id]?.weapon || ''}
                                                        onChange={e =>
                                                            setRoomSpecs(prev => ({
                                                                ...prev,
                                                                [room.id]: {
                                                                    ...prev[room.id],
                                                                    weapon: e.target.value
                                                                }
                                                            }))
                                                        }
                                                    >
                                                        <option value="">Select weapon</option>
                                                        {selectedInventoryItems
                                                            .filter(item => item.equipment?.slot === 'weapon')
                                                            .map(item => (
                                                                <option key={item.equipment?.id} value={item.name}>
                                                                    {item.name}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </label>
                                                <label>
                                                    Spec Count:
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        value={roomSpecs[room.id]?.count || 0}
                                                        onChange={e =>
                                                            setRoomSpecs(prev => ({
                                                                ...prev,
                                                                [room.id]: {
                                                                    ...prev[room.id],
                                                                    count: Number(e.target.value)
                                                                }
                                                            }))
                                                        }
                                                    />
                                                </label>
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </motion.div>

            </div>
        </section>
    );
};

export default RoomSelection;