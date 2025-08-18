import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { fadeInOut, slideInOut, hoverEffects } from '../utils/animations';
import { cmMonsters, rooms, type Monster, type Room } from '../data/monsterStats';
import './RoomSelection.css';

interface SelectedRoomWithMonster extends Room {
    monster?: Monster;
}

interface RoomSelectionProps {
    setSelectedMonsters: React.Dispatch<React.SetStateAction<Monster[]>>;
}

const RoomSelection: React.FC<RoomSelectionProps> = ({
    setSelectedMonsters
}) => {
    const [selectedRooms, setSelectedRooms] = useState<SelectedRoomWithMonster[]>([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

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

    // Get all selected monsters for WASM input
    const getSelectedMonsters = (): Monster[] => {
        return selectedRooms
            .map(room => room.monster)
            .filter((monster): monster is Monster => monster !== undefined);
    };

    // Update the parent state whenever selected rooms change
    useEffect(() => {
        const monsters = getSelectedMonsters();
        setSelectedMonsters(monsters);
    }, [selectedRooms, setSelectedMonsters]);

    const handleRoomSelect = (room: Room) => {
        setSelectedRooms(prev => {
            const isSelected = prev.some(r => r.id === room.id);
            if (isSelected) {
                return prev.filter(r => r.id !== room.id);
            } else {
                const monster = getMonsterByRoom(room);
                const roomWithMonster: SelectedRoomWithMonster = {
                    ...room,
                    monster
                };
                return [...prev, roomWithMonster];
            }
        });
    };

    const selectAll = () => {
        const roomsWithMonsters: SelectedRoomWithMonster[] = rooms.map(room => ({
            ...room,
            monster: getMonsterByRoom(room)
        }));
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
                                                    className={`selected-room-item ${room.monster ? 'has-monster' : 'no-monster'}`}
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
                                                        {room.monster && (
                                                            <div className="monster-stats-preview">
                                                                <span className="monster-level">CB: {room.monster.level}</span>
                                                                <span className="monster-hp">HP: {room.monster.skills.hp}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        className="remove-room-btn"
                                                        onClick={() => removeRoom(room.id)}
                                                        aria-label={`Remove ${room.name}`}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M18 6L6 18M6 6L18 18" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    </button>
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
                </motion.div>
            </div>
        </section>
    );
};

export default RoomSelection;