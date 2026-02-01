import React, { useState, useEffect } from 'react';
import { RAID_FLOORS } from '../data/monsterStats';
import { useTheme } from '../hooks/useTheme';
import './CombinedStatsCard.css';


// Map each room name in raid_total to its floor id and name
const raidRoomToFloor = (() => {
    const map: Record<string, { id: string, name: string }> = {};
    RAID_FLOORS.forEach(floor => {
        if (floor.id === 'raid_total') return;
        floor.rooms.forEach(room => {
            map[room.name] = { id: floor.id, name: floor.name };
        });
    });
    return map;
})();

type Stats = {
    total_hits: number;
    total_expected_seconds: number;
    total_expected_ticks: number;
    result?: any;
    phase_time_results?: any[];
    phase_results: any[]
};

type SimplifiedStats = {
    total_expected_ticks: number;
    total_expected_seconds: number;
};

interface CachedResult {
    id: string;
    timestamp: number;
    floorName: string;
    floorId: string;
    gearSets: Record<string, any>;
    combatStats: Record<string, any>;
    inventoryItems: Record<string, any>;
    selectedMethods: Record<string, string[]>;
    roomStats: Array<{ name: string; stats: SimplifiedStats }>;
    expectedTime: number;
}

interface CombinedStatsCardProps {
    gearSets: Record<string, any>;
    combatStats: Record<string, any>;
    inventoryItems: Record<string, any>;
    showSeconds: boolean;
    formatSeconds: (seconds: number) => string;
    activeFloor: string;
    combinedRoomAnalysis: Record<string, {
        plotData: any[];
        expectedTime: number;
        floorName: string;
        roomStats: Array<{ name: string; stats: Stats }>;
        floorId: string;
    } | null>;
    selectedMethods?: Record<string, string[]>;
}

const CombinedStatsCard: React.FC<CombinedStatsCardProps> = ({
    gearSets,
    combatStats,
    inventoryItems,
    showSeconds,
    formatSeconds,
    activeFloor,
    combinedRoomAnalysis,
    selectedMethods
}) => {

    // State for cached results
    const [cachedResults, setCachedResults] = useState<CachedResult[]>([]);
    const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
    const [showResultsDropdown, setShowResultsDropdown] = useState(false);
    
    // Track last saved result to prevent duplicate saves
    const lastSavedRef = React.useRef<string>('');
    
    // Ref for dropdown to detect clicks outside
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Load cached results from local storage on mount
    useEffect(() => {
        const stored = localStorage.getItem('cachedRaidResults');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setCachedResults(parsed);
            } catch (e) {
                console.error('Failed to parse cached results:', e);
            }
        }
    }, []);

    // Save current result to cache when combinedRoomAnalysis changes
    useEffect(() => {
        if (combinedRoomAnalysis[activeFloor]?.roomStats) {
            const expectedTime = combinedRoomAnalysis[activeFloor]!.expectedTime;
            const resultKey = `${activeFloor}-${expectedTime.toFixed(2)}`;
            
            // Skip if we just saved this exact result
            if (lastSavedRef.current === resultKey) {
                return;
            }

            // Extract only selected gear items (not all available items) to reduce storage size
            const extractSelectedGear = (gearSet: any) => {
                if (!gearSet) return {};
                return gearSet.map((slot: any) => ({
                    slot: slot.slot,
                    selected: slot.selected ? {
                        id: slot.selected.id,
                        name: slot.selected.name
                    } : null
                }));
            };

            const newResult: CachedResult = {
                id: Date.now().toString(),
                timestamp: Date.now(),
                floorName: combinedRoomAnalysis[activeFloor]!.floorName,
                floorId: activeFloor,
                gearSets: {
                    melee: extractSelectedGear(gearSets.melee),
                    mage: extractSelectedGear(gearSets.mage),
                    ranged: extractSelectedGear(gearSets.ranged)
                },
                combatStats: { ...combatStats },
                inventoryItems: Array.isArray(inventoryItems) 
                    ? inventoryItems.map((item: any) => ({ name: item.name }))
                    : Object.values(inventoryItems || {}).map((item: any) => ({ name: item.name })),
                selectedMethods: { ...(selectedMethods || {}) },
                roomStats: combinedRoomAnalysis[activeFloor]!.roomStats!.map(rs => ({
                    name: rs.name,
                    stats: {
                        total_expected_ticks: rs.stats.total_expected_ticks,
                        total_expected_seconds: rs.stats.total_expected_seconds
                    }
                })),
                expectedTime: expectedTime
            };

            setCachedResults(prev => {
                // Check if result is similar to any existing (avoid duplicates)
                const isDuplicate = prev.some(r => 
                    r.floorId === newResult.floorId &&
                    Math.abs(r.expectedTime - newResult.expectedTime) < 0.1
                );
                
                if (isDuplicate) {
                    lastSavedRef.current = resultKey;
                    return prev;
                }

                try {
                    // Keep only the 5 most recent results
                    const updated = [newResult, ...prev].slice(0, 5);
                    localStorage.setItem('cachedRaidResults', JSON.stringify(updated));
                    lastSavedRef.current = resultKey;
                    return updated;
                } catch (error) {
                    // If quota exceeded, remove oldest and try again
                    console.warn('LocalStorage quota exceeded, removing oldest cached result');
                    const updated = [newResult, ...prev.slice(0, 3)]; // Keep only 4 results
                    try {
                        localStorage.setItem('cachedRaidResults', JSON.stringify(updated));
                        lastSavedRef.current = resultKey;
                        return updated;
                    } catch (e) {
                        console.error('Failed to cache result even after cleanup:', e);
                        return prev;
                    }
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [combinedRoomAnalysis, activeFloor]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowResultsDropdown(false);
            }
        };

        if (showResultsDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showResultsDropdown]);

    const toggleResultSelection = (id: string) => {
        setSelectedResultIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    // CSV Export logic - now handles multiple selected results
    const handleExportCSV = () => {
        // Get results to export (selected cached results or current result)
        const resultsToExport: Array<{
            data: CachedResult,
            label: string
        }> = [];

        if (selectedResultIds.size > 0) {
            // Export selected cached results
            cachedResults
                .filter(r => selectedResultIds.has(r.id))
                .forEach((result, idx) => {
                    resultsToExport.push({
                        data: result,
                        label: `Result ${idx + 1} (${new Date(result.timestamp).toLocaleString()})`
                    });
                });
        } else {
            // Export current result - use the same simplified structure
            if (!combinedRoomAnalysis[activeFloor]?.roomStats) return;
            
            // Extract only selected gear items
            const extractSelectedGear = (gearSet: any) => {
                if (!gearSet) return [];
                return gearSet.map((slot: any) => ({
                    slot: slot.slot,
                    selected: slot.selected ? {
                        id: slot.selected.id,
                        name: slot.selected.name
                    } : null
                }));
            };
            
            resultsToExport.push({
                data: {
                    id: 'current',
                    timestamp: Date.now(),
                    floorName: combinedRoomAnalysis[activeFloor]!.floorName,
                    floorId: activeFloor,
                    gearSets: {
                        melee: extractSelectedGear(gearSets.melee),
                        mage: extractSelectedGear(gearSets.mage),
                        ranged: extractSelectedGear(gearSets.ranged)
                    },
                    combatStats,
                    inventoryItems,
                    selectedMethods: selectedMethods || {},
                    roomStats: combinedRoomAnalysis[activeFloor]!.roomStats!,
                    expectedTime: combinedRoomAnalysis[activeFloor]!.expectedTime
                },
                label: 'Current Result'
            });
        }

        if (resultsToExport.length === 0) return;

        const csvRows: string[] = [];

        // Define the slot order for the raid
        const slotOrder = [
            'Weapon', 'Head', 'Neck', 'Cape', 'Shield', 'Body', 'Legs', 'Hands', 'Feet', 'Ring', 'Ammo'
        ];

        // Export each result stacked vertically
        resultsToExport.forEach((resultData, resultIndex) => {
            const { data: result, label } = resultData;
            const floor = RAID_FLOORS.find(f => f.id === result.floorId);
            if (!floor) return;

            // Add result separator
            if (resultIndex > 0) {
                csvRows.push(''); // Empty row between results
            }

            // Add result label
            csvRows.push(`"${label} - ${result.floorName}"`);

            let tightropeDelayAdjustment = 0;
            if (result.selectedMethods && result.selectedMethods['vespula'] && 
                result.selectedMethods['vespula'].includes('Vespula Pots Skip')) {
                tightropeDelayAdjustment = 11;
            }

            let runningTotal = 0;
            let roomStatsIndex = 0;

            // Prepare inventory item names as array
            let inventoryItemNamesArr: string[] = [];
            if (Array.isArray(result.inventoryItems)) {
                inventoryItemNamesArr = result.inventoryItems.map((item: any) => item.name);
            } else if (result.inventoryItems && typeof result.inventoryItems === 'object') {
                inventoryItemNamesArr = Object.values(result.inventoryItems).map((item: any) => item.name);
            }

            // Prepare combat stats as array
            let combatStatsArr: Array<{ name: string; value: any }> = [];
            if (result.combatStats && typeof result.combatStats === 'object') {
                combatStatsArr = Object.entries(result.combatStats).map(([name, value]) => ({ name, value }));
            }

            // CSV header for this result
            csvRows.push([
                'Room',
                'Time',
                'Total',
                '',
                'Methods',
                '',
                'Slots',
                'Melee',
                'Ranged',
                'Mage',
                '',
                'Inventory Items',
                '',
                'Combat Stat Name',
                'Combat Stat Value'
            ].join(','));

            // Precompute all gear for slotOrder
            const meleeGearBySlot: Record<string, string> = {};
            const rangedGearBySlot: Record<string, string> = {};
            const mageGearBySlot: Record<string, string> = {};
            
            if (result.gearSets && result.gearSets.melee) {
                slotOrder.forEach(slot => {
                    const slotObj = result.gearSets.melee.find((s: any) => s.slot.toLowerCase() === slot.toLowerCase());
                    if (slotObj && slotObj.selected && slotObj.selected.name) {
                        meleeGearBySlot[slot] = slotObj.selected.name;
                    }
                });
            }
            if (result.gearSets && result.gearSets.ranged) {
                slotOrder.forEach(slot => {
                    const slotObj = result.gearSets.ranged.find((s: any) => s.slot.toLowerCase() === slot.toLowerCase());
                    if (slotObj && slotObj.selected && slotObj.selected.name) {
                        rangedGearBySlot[slot] = slotObj.selected.name;
                    }
                });
            }
            if (result.gearSets && result.gearSets.mage) {
                slotOrder.forEach(slot => {
                    const slotObj = result.gearSets.mage.find((s: any) => s.slot.toLowerCase() === slot.toLowerCase());
                    if (slotObj && slotObj.selected && slotObj.selected.name) {
                        mageGearBySlot[slot] = slotObj.selected.name;
                    }
                });
            }

            // Determine the max number of rows needed
            const maxRows = Math.max(floor.rooms.length, inventoryItemNamesArr.length, combatStatsArr.length);

            for (let i = 0; i < maxRows; i++) {
                const floorRoom = floor.rooms[i];
                let slot = '';
                let meleeItem = '';
                let rangedItem = '';
                let mageItem = '';
                let inventoryItem = '';
                let roomName = '';
                let timeVal = '';
                let totalVal = '';
                let methodsVal = '';
                
                if (slotOrder[i]) {
                    slot = slotOrder[i];
                    meleeItem = meleeGearBySlot[slot] || '';
                    rangedItem = rangedGearBySlot[slot] || '';
                    mageItem = mageGearBySlot[slot] || '';
                }
                
                if (inventoryItemNamesArr[i]) {
                    inventoryItem = inventoryItemNamesArr[i];
                }
                
                let combatStatName = '';
                let combatStatValue = '';
                if (combatStatsArr[i]) {
                    combatStatName = combatStatsArr[i].name;
                    combatStatValue = combatStatsArr[i].value;
                }

                // Fill room/time/total columns
                if (i < floor.rooms.length) {
                    if (floorRoom.isDelay) {
                        let delayTicks = floorRoom.delayTicks || 0;
                        if (floorRoom.roomId === 'tightrope' && tightropeDelayAdjustment > 0) {
                            delayTicks = Math.max(0, delayTicks - tightropeDelayAdjustment);
                        }
                        runningTotal += delayTicks;
                        roomName = `${floorRoom.name || 'Delay'}`;
                        timeVal = showSeconds ? formatSeconds(delayTicks * 0.6) : delayTicks.toFixed(1);
                        totalVal = showSeconds ? formatSeconds(runningTotal * 0.6) : runningTotal.toFixed(1);
                        methodsVal = 'N/A';
                    } else {
                        const roomStat = result.roomStats[roomStatsIndex];
                        if (roomStat) {
                            runningTotal += roomStat.stats.total_expected_ticks;
                            roomName = roomStat.name;
                            timeVal = showSeconds ? formatSeconds(roomStat.stats.total_expected_seconds) : roomStat.stats.total_expected_ticks.toFixed(1);
                            totalVal = showSeconds ? formatSeconds(runningTotal * 0.6) : runningTotal.toFixed(1);
                            const roomMethods = result.selectedMethods && result.selectedMethods[floorRoom.roomId] 
                                ? result.selectedMethods[floorRoom.roomId] 
                                : [];
                            methodsVal = roomMethods.length > 0 ? roomMethods.join('; ') : 'N/A';
                            roomStatsIndex++;
                        }
                    }
                }

                csvRows.push([
                    roomName,
                    timeVal,
                    totalVal,
                    '',
                    `"${methodsVal}"`,
                    '',
                    slot,
                    meleeItem,
                    rangedItem,
                    mageItem,
                    '',
                    inventoryItem,
                    '',
                    combatStatName,
                    combatStatValue
                ].join(','));
            }
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const filename = selectedResultIds.size > 1 
            ? `Comparison_${Date.now()}.csv`
            : `${resultsToExport[0].data.floorName || 'floor'}_stats.csv`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const { theme } = useTheme();
    
    // Set theme attribute on document for CSS variables
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);
    
    return (
        <div className="combined-stats-card">
            <div className="stat-card card">
                <h3>Total Expected {combinedRoomAnalysis[activeFloor]?.floorName || 'Floor'} Time</h3>
                <div className="card-header">
                    <div className="card-value-container">
                        <p className="stat-value">
                            {combinedRoomAnalysis[activeFloor] ? (showSeconds
                                ? formatSeconds(combinedRoomAnalysis[activeFloor]!.expectedTime * 0.6)
                                : combinedRoomAnalysis[activeFloor]!.expectedTime.toFixed(1)
                            ) : '--'}
                        </p>
                    </div>
                    
                    {/* Button Container */}
                    <div className="button-container">
                        <button
                            onClick={handleExportCSV}
                            title="Download CSV"
                            className="btn export"
                        >
                            <svg width="25" height="25" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <g>
                                    <path d="M3,12.3v7a2,2,0,0,0,2,2H19a2,2,0,0,0,2-2v-7" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                                    <polyline fill="none" points="7.9 12.3 12 16.3 16.1 12.3" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                                    <line fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="12" x2="12" y1="2.7" y2="14.2"/>
                                </g>
                            </svg>
                        </button>

                        {/* Cached Results Dropdown */}
                        {cachedResults.filter(r => r.floorId === activeFloor).length > 0 && (
                            <div ref={dropdownRef} className="dropdown-wrapper">
                                <button
                                    onClick={() => setShowResultsDropdown(!showResultsDropdown)}
                                    title="Manage Cached Results"
                                    className="btn cached-toggle"
                                >
                                    ▼({cachedResults.filter(r => r.floorId === activeFloor).length})
                                </button>
                                {showResultsDropdown && (
                                    <div className="dropdown-panel">
                                        <div className="dropdown-header">
                                            <h4>Cached Results - {combinedRoomAnalysis[activeFloor]?.floorName}</h4>
                                            <button
                                                onClick={() => {
                                                    // Clear only results for this floor
                                                    const updated = cachedResults.filter(r => r.floorId !== activeFloor);
                                                    setCachedResults(updated);
                                                    setSelectedResultIds(new Set());
                                                    localStorage.setItem('cachedRaidResults', JSON.stringify(updated));
                                                }}
                                                className="btn clear-all"
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                        <div className="dropdown-description">
                                            Select results to compare (exports stacked vertically):
                                        </div>
                                        <div className="dropdown-results">
                                            {cachedResults.filter(r => r.floorId === activeFloor).map((result) => (
                                                <label
                                                    key={result.id}
                                                    className={`result-item ${selectedResultIds.has(result.id) ? 'selected' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedResultIds.has(result.id)}
                                                        onChange={() => toggleResultSelection(result.id)}
                                                    />
                                                    <div className="result-item-content">
                                                        <div className="result-item-title">
                                                            {result.floorName}
                                                        </div>
                                                        <div className="result-item-meta">
                                                            {new Date(result.timestamp).toLocaleString()}
                                                        </div>
                                                        <div className="result-item-meta">
                                                            Time: {showSeconds 
                                                                ? formatSeconds(result.expectedTime * 0.6) 
                                                                : result.expectedTime.toFixed(1)}
                                                        </div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                        {selectedResultIds.size > 0 && (
                                            <div className="selection-summary">
                                                {selectedResultIds.size} result{selectedResultIds.size > 1 ? 's' : ''} selected for export
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <span className="stat-unit">
                    {showSeconds ? 'min:sec' : 'ticks'} (including delays)
                </span>
                <div className="room-stats">
                    {/* Header Row */}
                    <div className="stats-header">
                        <div className="stats-header-cell">Room</div>
                        <div className="stats-header-cell">Time</div>
                        <div className="stats-header-cell">Total</div>
                    </div>

                    {/* Data Rows */}
                    {(() => {
                        if (!combinedRoomAnalysis[activeFloor]?.roomStats) return null;

                        const floor = RAID_FLOORS.find(f => f.id === activeFloor);
                        if (!floor) return null;

                        // Determine if Vespula Pots Skip is selected
                        let tightropeDelayAdjustment = 0;
                        if (selectedMethods && selectedMethods['vespula'] && selectedMethods['vespula'].includes('Vespula Pots Skip')) {
                            tightropeDelayAdjustment = 11;
                        }

                        let runningTotal = 0;
                        const rows: JSX.Element[] = [];
                        let roomStatsIndex = 0;

                        // Iterate through floor.rooms to maintain proper order and include delays
                        for (let i = 0; i < floor.rooms.length; i++) {
                            const floorRoom = floor.rooms[i];

                            if (floorRoom.isDelay) {
                                // Adjust tightrope delay if needed
                                let delayTicks = floorRoom.delayTicks || 0;
                                if (floorRoom.roomId === 'tightrope' && tightropeDelayAdjustment > 0) {
                                    delayTicks = Math.max(0, delayTicks - tightropeDelayAdjustment);
                                }
                                runningTotal += delayTicks;
                                rows.push(
                                    <div 
                                        key={i} 
                                        className={`stats-row delay ${floorRoom.name && floorRoom.name.includes('Post') ? 'post-floor' : ''}`}
                                    >
                                        <div><strong>{floorRoom.name || 'Delay'}</strong></div>
                                        <div className="stats-cell center">
                                            {showSeconds
                                                ? formatSeconds(delayTicks * 0.6)
                                                : delayTicks.toFixed(1)
                                            }
                                        </div>
                                        <div className="stats-cell center primary">
                                            {showSeconds
                                                ? formatSeconds(runningTotal * 0.6)
                                                : runningTotal.toFixed(1)
                                            }
                                        </div>
                                    </div>
                                );
                            } else {
                                // This is a combat room
                                const roomStat = combinedRoomAnalysis[activeFloor]!.roomStats![roomStatsIndex];
                                if (roomStat) {
                                    const nextIsDelay = floor.rooms[i + 1] && floor.rooms[i + 1].isDelay;

                                    runningTotal += roomStat.stats.total_expected_ticks;
                                    rows.push(
                                        <div 
                                            key={i} 
                                            className={`stats-row combat ${
                                                roomStat.name && roomStat.name.includes('Post') 
                                                    ? 'post-floor' 
                                                    : (!nextIsDelay && roomStatsIndex < combinedRoomAnalysis[activeFloor]!.roomStats!.length - 1 
                                                        ? 'has-border' 
                                                        : '')
                                            }`}
                                        >
                                            <div><strong>{roomStat.name}</strong></div>
                                            <div className="stats-cell center">
                                                {showSeconds
                                                    ? formatSeconds(roomStat.stats.total_expected_seconds)
                                                    : roomStat.stats.total_expected_ticks.toFixed(1)
                                                }
                                            </div>
                                            <div className="stats-cell center primary">
                                                {showSeconds
                                                    ? formatSeconds(runningTotal * 0.6)
                                                    : runningTotal.toFixed(1)
                                                }
                                            </div>
                                        </div>
                                    );
                                    // Insert horizontal line after any combat room followed by a delay room
                                    if (nextIsDelay) {
                                        rows.push(
                                            <hr
                                                key={`hr-after-${roomStat.name}-${i}`}
                                                className="stats-row-separator"
                                            />
                                        );
                                    }
                                    roomStatsIndex++;
                                }
                            }

                            if (
                                // activeFloor === 'raid_total' &&
                                floorRoom.name &&
                                raidRoomToFloor[floorRoom.name]
                            ) {
                                // Only add summary row if this is the last room of the floor in raid_total
                                // That is, if the next room is not mapped to the same floor
                                const currentFloorId = raidRoomToFloor[floorRoom.name].id;
                                const nextRoom = floor.rooms[i + 1];
                                const isLastRoomOfFloor =
                                    !nextRoom ||
                                    !raidRoomToFloor[nextRoom.name] ||
                                    raidRoomToFloor[nextRoom.name].id !== currentFloorId;

                                if (isLastRoomOfFloor) {
                                    const floorTag = raidRoomToFloor[floorRoom.name];
                                    const summaryLabel = `${floorTag.name} Total`;
                                    const summaryId = floorTag.id;
                                    const expectedTime = combinedRoomAnalysis[summaryId]?.expectedTime || 0;

                                    rows.push(
                                        <div key={`summary-${summaryId}-${i}`} className="stats-row summary">
                                            <div>{summaryLabel}</div>
                                            <div className="stats-cell center primary">
                                                {showSeconds
                                                    ? formatSeconds(expectedTime * 0.6)
                                                    : expectedTime.toFixed(1)
                                                }
                                            </div>
                                            <div className="stats-cell center primary">
                                                {showSeconds
                                                    ? formatSeconds(runningTotal * 0.6)
                                                    : runningTotal.toFixed(1)
                                                }
                                            </div>
                                        </div>
                                    );
                                }
                            }
                        }

                        return rows;
                    })()}
                </div>
            </div>
        </div>
    );
};

export default CombinedStatsCard;