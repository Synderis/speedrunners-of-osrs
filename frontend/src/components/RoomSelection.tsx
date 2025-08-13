import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { fadeInOut, slideInOut, hoverEffects } from '../utils/animations';
import './RoomSelection.css';

interface Room {
    id: string;
    name: string;
    image: string;
    description: string;
}

const RoomSelection: React.FC = () => {
    const [selectedRooms, setSelectedRooms] = useState<Room[]>([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    
    const headerRef = useRef(null);
    const displayRef = useRef(null);
    const gridRef = useRef(null);
    
    const headerInView = useInView(headerRef, { once: true, amount: 0.8 });
    const displayInView = useInView(displayRef, { once: true, amount: 0.5 });
    const gridInView = useInView(gridRef, { once: true, amount: isMobile ? 0.1 : 0.2 });

    const rooms: Room[] = [
        {
            id: 'tekton',
            name: 'Tekton',
            image: '/rooms/220px-Tekton.webp',
            description: 'High-level boss encounter'
        },
        {
            id: 'crabs',
            name: 'Crabs',
            image: '/rooms/150px-Jewelled_Crab.webp',
            description: 'Low-level training area'
        },
        {
            id: 'ice_demon',
            name: 'Ice Demon',
            image: '/rooms/170px-Ice_demon.webp',
            description: 'High-level boss encounter'
        },
        {
            id: 'lizardman_shamans',
            name: 'Lizardman Shamans',
            image: '/rooms/200px-Lizardman_shaman.webp',
            description: 'High-level boss encounter'
        },
        {
            id: 'vanguards',
            name: 'Vanguards',
            image: '/rooms/280px-Vanguard_(magic).webp',
            description: 'God Wars Dungeon - Zamorak'
        },
        {
            id: 'vespula',
            name: 'Vespula',
            image: '/rooms/280px-Vespula.webp',
            description: 'Barrows Brothers minigame'
        },
        {
            id: 'tightrope',
            name: 'Tightrope',
            image: '/rooms/130px-Keystone_crystal_detail.webp',
            description: 'High-level agility course'
        },
        {
            id: 'guardians',
            name: 'Guardians',
            image: '/rooms/guardians.png',
            description: 'High-level boss encounter'
        },
        {
            id: 'vasa',
            name: 'Vasa',
            image: '/rooms/250px-Vasa_Nistirio.webp',
            description: 'God Wars Dungeon - Zamorak'
        },
        {
            id: 'mystics',
            name: 'Mystics',
            image: '/rooms/mystics.png',
            description: 'Barrows Brothers minigame'
        },
        {
            id: 'muttadile',
            name: 'Muttadile',
            image: '/rooms/250px-Muttadile.webp',
            description: 'High-level boss encounter'
        },
        {
            id: 'olm',
            name: 'Olm',
            image: '/rooms/300px-Great_Olm.webp',
            description: 'High-level boss encounter'
        }
    ];

    const handleRoomSelect = (room: Room) => {
        setSelectedRooms(prev => {
            const isSelected = prev.some(r => r.id === room.id);
            if (isSelected) {
                return prev.filter(r => r.id !== room.id);
            } else {
                return [...prev, room];
            }
        });
    };

    const selectAll = () => {
        setSelectedRooms([...rooms]);
    };

    const clearSelection = () => {
        setSelectedRooms([]);
    };

    const removeRoom = (roomId: string) => {
        setSelectedRooms(prev => prev.filter(r => r.id !== roomId));
    };

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
                                                    className="selected-room-item"
                                                    {...slideInOut}
                                                    {...hoverEffects.cardHover}
                                                >
                                                    <img
                                                        src={room.image}
                                                        alt={room.name}
                                                        className="selected-room-item-image"
                                                    />
                                                    <span className="selected-room-item-name">{room.name}</span>
                                                    <button
                                                        className="remove-room-btn"
                                                        onClick={() => removeRoom(room.id)}
                                                        aria-label={`Remove ${room.name}`}
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                            <path d="M18 6L6 18M6 6L18 18" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
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
                            {rooms.filter(room => !selectedRooms.some(r => r.id === room.id)).map((room, index) => (
                                <motion.div
                                    key={room.id}
                                    className="room-card card"
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
                                    </div>
                                    <div className="room-info">
                                        <h4 className="room-name">{room.name}</h4>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
};

export default RoomSelection;
