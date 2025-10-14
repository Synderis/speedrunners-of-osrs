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
    showSeconds,
    formatSeconds,
    activeFloor,
    combinedRoomAnalysis,
    selectedMethods
}) => {
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
                <p
                    className="stat-value"
                    style={{ fontSize: '2rem', color: chartColors.primary, opacity: 1 }}
                >
                    {combinedRoomAnalysis[activeFloor] ? (showSeconds
                        ? formatSeconds(combinedRoomAnalysis[activeFloor]!.expectedTime * 0.6)
                        : combinedRoomAnalysis[activeFloor]!.expectedTime.toFixed(1)
                    ) : '--'}
                </p>
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