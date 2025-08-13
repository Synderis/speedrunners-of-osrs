import React, { useState, useEffect } from 'react';
import './RoomSelection.css';

interface Room {
    id: string;
    name: string;
    image: string;
    description: string;
}

const RoomSelection: React.FC = () => {
    const [selectedRooms, setSelectedRooms] = useState<Room[]>([]);

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
        // Re-apply fade-in to all room cards after clearing
        setTimeout(() => {
            const roomCards = document.querySelectorAll('.room-card');
            roomCards.forEach(el => {
                el.classList.add('fade-in');
            });
        }, 50);
    };

    const removeRoom = (roomId: string) => {
        setSelectedRooms(prev => prev.filter(r => r.id !== roomId));
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            const elements = document.querySelectorAll('.room-selection, .room-card');
            elements.forEach((el, index) => {
                setTimeout(() => {
                    el.classList.add('fade-in');
                }, index * 50);
            });
        }, 200);

        return () => clearTimeout(timer);
    }, []);

    return (
        <section id="rooms" className="section">
            <div className="container">
                <div className="room-selection">
                    <div className="room-header">
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
                    </div>

                    <div className="selected-rooms-display">
                        {selectedRooms.length > 0 ? (
                            <div className="selected-rooms-list">
                                <h3 className="selected-rooms-title">Selected Rooms:</h3>
                                <div className="selected-rooms-container">
                                    {selectedRooms.map((room) => (
                                        <div key={room.id} className="selected-room-item">
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
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="no-rooms-selected">
                                <span>No rooms selected - click on rooms below to add them</span>
                            </div>
                        )}
                    </div>

                    <div className="rooms-grid">
                        {rooms.filter(room => !selectedRooms.some(r => r.id === room.id)).map((room, index) => (
                            <div
                                key={room.id}
                                className="room-card card"
                                onClick={() => handleRoomSelect(room)}
                                style={{ animationDelay: `${index * 0.1}s` }}
                            >
                                <div className="room-image-container">
                                    <img
                                        src={room.image}
                                        alt={room.name}
                                        className="room-image"
                                    />
                                </div>
                                <div className="room-info">
                                    <h4 className="room-name">{room.name}</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default RoomSelection;
