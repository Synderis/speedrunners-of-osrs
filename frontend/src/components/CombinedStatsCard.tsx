import React from 'react';
import { RAID_FLOORS } from '../data/monsterStats';
import { useTheme } from '../hooks/useTheme';


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

    // CSV Export logic
    const handleExportCSV = () => {
        if (!combinedRoomAnalysis[activeFloor]?.roomStats) return;
        const floor = RAID_FLOORS.find(f => f.id === activeFloor);
        if (!floor) return;

        let tightropeDelayAdjustment = 0;
        if (selectedMethods && selectedMethods['vespula'] && selectedMethods['vespula'].includes('Vespula Pots Skip')) {
            tightropeDelayAdjustment = 11;
        }

        let runningTotal = 0;
        let roomStatsIndex = 0;
        const csvRows: string[] = [];

        // Define the slot order for the raid (adjust as needed)
        const slotOrder = [
            'Weapon', 'Head', 'Neck', 'Cape', 'Shield', 'Body', 'Legs', 'Hands', 'Feet', 'Ring', 'Ammo'
        ];

        // Prepare inventory item names as array
        let inventoryItemNamesArr: string[] = [];
        if (Array.isArray(inventoryItems)) {
            inventoryItemNamesArr = inventoryItems.map((item: any) => item.name);
        } else if (inventoryItems && typeof inventoryItems === 'object') {
            inventoryItemNamesArr = Object.values(inventoryItems).map((item: any) => item.name);
        }

        // Prepare combat stats as array of [name, value] pairs
        let combatStatsArr: Array<{ name: string; value: any }> = [];
        if (combatStats && typeof combatStats === 'object') {
            combatStatsArr = Object.entries(combatStats).map(([name, value]) => ({ name, value }));
        }

        // CSV header
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
        if (gearSets && gearSets.melee) {
            slotOrder.forEach(slot => {
                const slotObj = gearSets.melee.find((s: any) => s.slot.toLowerCase() === slot.toLowerCase());
                if (slotObj && slotObj.selected && slotObj.selected.name) {
                    meleeGearBySlot[slot] = slotObj.selected.name;
                }
            });
        }
        if (gearSets && gearSets.ranged) {
            slotOrder.forEach(slot => {
                const slotObj = gearSets.ranged.find((s: any) => s.slot.toLowerCase() === slot.toLowerCase());
                if (slotObj && slotObj.selected && slotObj.selected.name) {
                    rangedGearBySlot[slot] = slotObj.selected.name;
                }
            });
        }
        if (gearSets && gearSets.mage) {
            slotOrder.forEach(slot => {
                const slotObj = gearSets.mage.find((s: any) => s.slot.toLowerCase() === slot.toLowerCase());
                if (slotObj && slotObj.selected && slotObj.selected.name) {
                    mageGearBySlot[slot] = slotObj.selected.name;
                }
            });
        }

        // Determine the max number of rows needed for the main table
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
            // Always fill slot and gear columns for the row that matches a slot in slotOrder, regardless of delay or not
            if (slotOrder[i]) {
                slot = slotOrder[i];
                meleeItem = meleeGearBySlot[slot] || '';
                rangedItem = rangedGearBySlot[slot] || '';
                mageItem = mageGearBySlot[slot] || '';
            }
            // Fill inventory item for this row if available
            if (inventoryItemNamesArr[i]) {
                inventoryItem = inventoryItemNamesArr[i];
            }
            // Fill combat stat name and value for this row if available
            let combatStatName = '';
            let combatStatValue = '';
            if (combatStatsArr[i]) {
                combatStatName = combatStatsArr[i].name;
                combatStatValue = combatStatsArr[i].value;
            }

            // Fill room/time/total columns if this row corresponds to a floor room
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
                    const roomStat = combinedRoomAnalysis[activeFloor]!.roomStats![roomStatsIndex];
                    if (roomStat) {
                        runningTotal += roomStat.stats.total_expected_ticks;
                        roomName = roomStat.name;
                        timeVal = showSeconds ? formatSeconds(roomStat.stats.total_expected_seconds) : roomStat.stats.total_expected_ticks.toFixed(1);
                        totalVal = showSeconds ? formatSeconds(runningTotal * 0.6) : runningTotal.toFixed(1);
                        // Get methods for this room
                        const roomMethods = selectedMethods && selectedMethods[floorRoom.roomId] ? selectedMethods[floorRoom.roomId] : [];
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

        // If there are more inventory items or combat stats than rows, add them at the end (already handled by maxRows loop)

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${combinedRoomAnalysis[activeFloor]?.floorName || activeFloor}_stats.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    const { theme } = useTheme();
    const chartColors = {
        primary: '#3b82f6',
        secondary: '#6366f1',
        grid: theme === 'light' ? '#e9ecef' : '#333333',
        text: theme === 'light' ? '#0a0a0a' : '#ffffff',
        background: 'transparent'
    };
    return (
        <div className="combined-stats-card">
            <div
                className="stat-card card"
                style={{
                    background: `linear-gradient(135deg, ${chartColors.primary}20, ${chartColors.secondary}20)`
                }}
            >
                <h3>Total Expected {combinedRoomAnalysis[activeFloor]?.floorName || 'Floor'} Time</h3>
                <div style={{ position: 'relative', margin: '0.5rem 0 0rem 0'}}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <p
                            className="stat-value"
                            style={{ fontSize: '2rem', color: chartColors.primary, opacity: 1, margin: 0 }}
                        >
                            {combinedRoomAnalysis[activeFloor] ? (showSeconds
                                ? formatSeconds(combinedRoomAnalysis[activeFloor]!.expectedTime * 0.6)
                                : combinedRoomAnalysis[activeFloor]!.expectedTime.toFixed(1)
                            ) : '--'}
                        </p>
                    </div>
                    <button
                        onClick={handleExportCSV}
                        title="Download CSV"
                        className="btn export"
                        style={{
                            position: 'absolute',
                            top: 5,
                            left: 0,
                            padding: 0,
                            background: chartColors.primary,
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '2.5rem',
                            minHeight: '2.5rem',
                        }}
                    >
                        <svg width="25" height="25" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                            <g>
                                <path d="M3,12.3v7a2,2,0,0,0,2,2H19a2,2,0,0,0,2-2v-7" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                                <polyline fill="none" points="7.9 12.3 12 16.3 16.1 12.3" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                                <line fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="12" x2="12" y1="2.7" y2="14.2"/>
                            </g>
                        </svg>
                    </button>
                </div>
                <span className="stat-unit">
                    {showSeconds ? 'min:sec' : 'ticks'} (including delays)
                </span>
                <div style={{
                    marginTop: '1rem',
                    fontSize: '0.9rem',
                    color: chartColors.text + '80'
                }}>
                    {/* Header Row */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr',
                        gap: '0.5rem',
                        padding: '0.5rem 0',
                        borderBottom: `1px solid ${chartColors.text}40`,
                        fontWeight: 'bold'
                    }}>
                        <div style={{ color: chartColors.primary, textAlign: 'center' }}>Room</div>
                        <div style={{ color: chartColors.primary, textAlign: 'center' }}>Time</div>
                        <div style={{ color: chartColors.primary, textAlign: 'center' }}>Total</div>
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
                                    <div key={i} style={{
                                        display: 'grid',
                                        gridTemplateColumns: '2fr 1fr 1fr',
                                        gap: '0.5rem',
                                        padding: '0.3rem 0',
                                        borderBottom: (floorRoom.name && floorRoom.name.includes('Post'))
                                            ? `1px solid ${chartColors.primary}`
                                            : `1px solid ${chartColors.text}20`,
                                        fontStyle: 'italic',
                                        color: chartColors.text + '99'
                                    }}>
                                        <div><strong>{floorRoom.name || 'Delay'}</strong></div>
                                        <div style={{ textAlign: 'center' }}>
                                            {showSeconds
                                                ? formatSeconds(delayTicks * 0.6)
                                                : delayTicks.toFixed(1)
                                            }
                                        </div>
                                        <div style={{ textAlign: 'center', color: chartColors.primary }}>
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
                                        <div key={i} style={{
                                            display: 'grid',
                                            gridTemplateColumns: '2fr 1fr 1fr',
                                            gap: '0.5rem',
                                            padding: '0.3rem 0',
                                            borderBottom: (roomStat.name && roomStat.name.includes('Post'))
                                                ? `1px solid ${chartColors.primary}`
                                                : (!nextIsDelay && roomStatsIndex < combinedRoomAnalysis[activeFloor]!.roomStats!.length - 1
                                                    ? `1px solid ${chartColors.text}20`
                                                    : 'none')
                                        }}>
                                            <div><strong>{roomStat.name}</strong></div>
                                            <div style={{ textAlign: 'center' }}>
                                                {showSeconds
                                                    ? formatSeconds(roomStat.stats.total_expected_seconds)
                                                    : roomStat.stats.total_expected_ticks.toFixed(1)
                                                }
                                            </div>
                                            <div style={{ textAlign: 'center', color: chartColors.primary }}>
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
                                                style={{
                                                    border: 'none',
                                                    borderTop: `1px solid ${chartColors.text}20`
                                                }}
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
                                        <div key={`summary-${summaryId}-${i}`} style={{
                                            display: 'grid',
                                            gridTemplateColumns: '2fr 1fr 1fr',
                                            gap: '0.5rem',
                                            padding: '0.3rem 0',
                                            background: `${chartColors.primary}10`,
                                            fontWeight: 'bold',
                                            borderBottom: `1px solid ${chartColors.primary}`
                                        }}>
                                            <div>{summaryLabel}</div>
                                            <div style={{ textAlign: 'center', color: chartColors.primary }}>
                                                {showSeconds
                                                    ? formatSeconds(expectedTime * 0.6)
                                                    : expectedTime.toFixed(1)
                                                }
                                            </div>
                                            <div style={{ textAlign: 'center', color: chartColors.primary }}>
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