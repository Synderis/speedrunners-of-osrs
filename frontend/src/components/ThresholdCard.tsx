import React, { useState, useEffect } from 'react';
import type { Floor } from '../data/monsterStats';
import type { PlotDataPoint } from '../types/loaders';
import { calculateResetThresholds } from '../utils/helpers';

interface ThresholdCardProps {
    chartColors: {
        primary: string;
        secondary: string;
        text: string;
    };
    theme: string;
    showSeconds: boolean;
    formatSeconds: (seconds: number) => string;
    availableFloors: Floor[];
    combinedRoomAnalysis: Record<string, {
        expectedTime: number;
        floorName: string;
        plotData: PlotDataPoint[];
    } | null>;
    olmDistribution: PlotDataPoint[];
}

const ThresholdCard: React.FC<ThresholdCardProps> = ({
    chartColors,
    theme,
    showSeconds,
    formatSeconds,
    availableFloors,
    combinedRoomAnalysis,
    olmDistribution
}) => {
    // --- Target Time state ---
    const [targetTimeTicks, setTargetTimeTicks] = useState<number>(0);
    const [targetTimeDisplay, setTargetTimeDisplay] = useState<string>('');
    const [thresholdResults, setThresholdResults] = useState<{
        input_target: number;
        p_success_if_restart_now: number;
        thresholds: {
            [floorId: string]: {
                threshold: number | null;
                decision_rule: string;
            };
        };
        notes: string;
    } | null>(null);

    // Helper functions:
    const parseDisplayToTicks = (displayValue: string): number => {
        if (!displayValue.trim()) return 0;

        if (showSeconds) {
            // In mm:ss mode
            if (displayValue.includes(':')) {
                // Format: "24:35"
                const parts = displayValue.split(':');
                if (parts.length === 2) {
                    const minutes = parseInt(parts[0]) || 0;
                    const seconds = parseInt(parts[1]) || 0;
                    const totalSeconds = minutes * 60 + seconds;
                    return Math.round(totalSeconds / 0.6); // Convert to ticks
                }
            } else {
                // Format: "2435" -> treat as "24:35"
                const numStr = displayValue.replace(/\D/g, '');
                if (numStr.length >= 3) {
                    const minutes = parseInt(numStr.slice(0, -2)) || 0;
                    const seconds = parseInt(numStr.slice(-2)) || 0;
                    const totalSeconds = minutes * 60 + seconds;
                    return Math.round(totalSeconds / 0.6); // Convert to ticks
                } else if (numStr.length > 0) {
                    // Less than 3 digits, treat as seconds
                    const seconds = parseInt(numStr) || 0;
                    return Math.round(seconds / 0.6); // Convert to ticks
                }
            }
        } else {
            // In ticks mode - direct conversion
            return parseInt(displayValue) || 0;
        }
        return 0;
    };

    const formatDisplayValue = (ticks: number, showSeconds: boolean): string => {
        if (ticks === 0) return '';

        if (showSeconds) {
            // Convert ticks to mm:ss format
            const totalSeconds = ticks * 0.6;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = Math.floor(totalSeconds % 60);
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
            // Show raw ticks
            return ticks.toString();
        }
    };

    // Handle display conversion when showSeconds changes
    useEffect(() => {
        if (targetTimeTicks > 0) {
            setTargetTimeDisplay(formatDisplayValue(targetTimeTicks, showSeconds));
        }
    }, [showSeconds, targetTimeTicks]);

    const handleBlur = () => {
        const parsedTicks = parseDisplayToTicks(targetTimeDisplay);
        setTargetTimeTicks(parsedTicks);

        if (parsedTicks > 0) {
            setTargetTimeDisplay(formatDisplayValue(parsedTicks, showSeconds));
        } else {
            setTargetTimeDisplay('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const parsedTicks = parseDisplayToTicks(targetTimeDisplay);
            setTargetTimeTicks(parsedTicks);

            if (parsedTicks > 0) {
                setTargetTimeDisplay(formatDisplayValue(parsedTicks, showSeconds));
            } else {
                setTargetTimeDisplay('');
            }

            e.currentTarget.blur();
        }
    };

    const handleCalculateThresholds = () => {
        console.log('Calculating reset thresholds for target time (ticks):', targetTimeTicks);
        
        // Get the floor distributions from combinedRoomAnalysis
        const floor1Data = combinedRoomAnalysis['floor1']?.plotData || [];
        const floor2Data = combinedRoomAnalysis['floor2']?.plotData || [];
        const floor3Data = combinedRoomAnalysis['floor3']?.plotData || [];
        const completeRaidData = combinedRoomAnalysis['raid_total']?.plotData || [];
        
        console.log('Distribution data:', {
            floor1: floor1Data.length,
            floor2: floor2Data.length,
            floor3: floor3Data.length,
            olm: olmDistribution.length,
            completeRaid: completeRaidData.length
        });
        
        if (!floor1Data.length || !floor2Data.length || !floor3Data.length || 
            !olmDistribution.length || !completeRaidData.length) {
            console.error('Missing required distribution data');
            return;
        }
        
        const thresholds = calculateResetThresholds(
            targetTimeTicks,
            floor1Data,
            floor2Data,
            floor3Data,
            olmDistribution,
            completeRaidData
        );
        
        if (thresholds) {
            console.log('Reset Thresholds:', thresholds);
            setThresholdResults(thresholds); // Store the results in state
        } else {
            console.error('Failed to calculate thresholds');
            setThresholdResults(null);
        }
    };

    return (
        <div
            className="stat-card card"
            style={{
                marginTop: '1rem',
                background: `linear-gradient(135deg, ${chartColors.primary}15, ${chartColors.secondary}15)`,
                border: `1px solid ${chartColors.secondary}40`
            }}
        >
            {/* Target Time Input */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1rem',
                justifyContent: 'center',
                flexWrap: 'wrap'
            }}>
                <label style={{
                    color: chartColors.text,
                    fontSize: '0.9rem',
                    fontWeight: 'bold'
                }}>
                    Target Complete Raid Time ({showSeconds ? 'mm:ss' : 'ticks'}):
                </label>
                <input
                    type="text"
                    value={targetTimeDisplay}
                    onChange={(e) => setTargetTimeDisplay(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={showSeconds ? "2435 or 24:35" : "3000"}
                    style={{
                        width: '120px',
                        padding: '6px 10px',
                        borderRadius: '4px',
                        border: `1px solid ${chartColors.primary}50`,
                        backgroundColor: theme === 'light' ? 'white' : '#2a2a2a',
                        color: chartColors.text,
                        textAlign: 'center',
                        fontSize: '0.9rem'
                    }}
                />
                <button
                    className="btn"
                    onClick={handleCalculateThresholds}
                    disabled={targetTimeTicks <= 0}
                    style={{
                        fontSize: '0.8rem',
                        padding: '6px 12px',
                        backgroundColor: targetTimeTicks > 0 ? chartColors.secondary : '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: targetTimeTicks > 0 ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap'
                    }}
                >
                    Calculate Reset Thresholds
                </button>
            </div>
            {availableFloors.length > 0 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '2rem',
                        flexWrap: 'wrap',
                        padding: '0.75rem',
                        backgroundColor: `${chartColors.secondary}10`,
                        borderRadius: '6px',
                        border: `1px solid ${chartColors.secondary}30`
                    }}>
                        {availableFloors.slice(0, -1).map((floor, index) => {
                            const floorAnalysis = combinedRoomAnalysis[floor.id];
                            
                            // Get threshold value or fall back to expected time
                            const thresholdData = thresholdResults?.thresholds[floor.id];
                            const displayValue = (thresholdData?.threshold !== null && thresholdData?.threshold !== undefined) 
                                ? thresholdData.threshold 
                                : (floorAnalysis?.expectedTime || 0);

                            return (
                                <div key={floor.id} style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    minWidth: '100px',
                                    position: 'relative'
                                }}>
                                    <span style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 'bold',
                                        color: chartColors.text
                                    }}>
                                        {floor.name} Reset Threshold
                                    </span>
                                    <span style={{
                                        fontSize: '1rem',
                                        fontWeight: 'bold',
                                        color: chartColors.secondary
                                    }}>
                                        {showSeconds
                                            ? formatSeconds(displayValue * 0.6)
                                            : displayValue.toFixed(1)
                                        }
                                    </span>
                                    {index < availableFloors.length - 1 && (
                                        <span style={{
                                            position: 'absolute',
                                            right: '-1rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            color: chartColors.text + '60',
                                            fontSize: '1.2rem'
                                        }}>
                                            {/* → */}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                        {targetTimeTicks > 0 && (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                minWidth: '100px',
                paddingLeft: '1rem',
                borderLeft: `2px solid ${chartColors.text}30`
            }}>
                <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    color: chartColors.text
                }}>
                    Target Time
                </span>
                <span style={{
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    color: chartColors.primary
                }}>
                    {showSeconds 
                        ? formatSeconds(targetTimeTicks * 0.6) 
                        : targetTimeTicks.toFixed(1)
                    }
                </span>
            </div>
        )}
                    </div>
                )}
            </div>
        );
    };

export default ThresholdCard;