import React, { useState, useEffect } from 'react';
import type { Floor } from '../data/monsterStats';
import type { PlotDataPoint } from '../types/loaders';
// import { calculateResetThresholds } from '../utils/helpers';
import { useTheme } from '../hooks/useTheme';
import { 
    calculateResetThresholds
} from '../loaders/miscWasm';
import './ThresholdCard.css';

interface ThresholdCardProps {
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
    showSeconds,
    formatSeconds,
    availableFloors,
    combinedRoomAnalysis,
    olmDistribution
}) => {
    const { theme } = useTheme();
    
    // Set theme attribute on document for CSS variables
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);
    
    // --- Target Time state ---
    const [targetTimeTicks, setTargetTimeTicks] = useState<number>(0);
    const [targetTimeDisplay, setTargetTimeDisplay] = useState<string>('');
    const [thresholdResults, setThresholdResults] = useState<{
        input_target: number;
        thresholds: {
            [floorId: string]: {
                threshold: number | null;
            };
        };
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

    const handleCalculateThresholds = async () => {
        const floor1Data = combinedRoomAnalysis['floor1']?.plotData || [];
        const floor2Data = combinedRoomAnalysis['floor2']?.plotData || [];
        const floor3Data = combinedRoomAnalysis['floor3']?.plotData || [];
        const completeRaidData = combinedRoomAnalysis['raid_total']?.plotData || [];
        
        
        if (!floor1Data.length || !floor2Data.length || !floor3Data.length || 
            !olmDistribution.length || !completeRaidData.length) {
            console.error('Missing required distribution data');
            return;
        }
        
        const thresholds = await calculateResetThresholds(
            targetTimeTicks,
            floor1Data,
            floor2Data,
            floor3Data,
            olmDistribution,
            completeRaidData
        );
        
        if (thresholds) {
            // console.log('Reset Thresholds:', thresholds);
            setThresholdResults(thresholds); // Store the results in state
        } else {
            console.error('Failed to calculate thresholds');
            setThresholdResults(null);
        }
    };
    const handleButtonClick = async () => {
        const parsedTicks = parseDisplayToTicks(targetTimeDisplay);
        setTargetTimeTicks(parsedTicks);

        // Optionally update the display format
        if (parsedTicks > 0) {
            setTargetTimeDisplay(formatDisplayValue(parsedTicks, showSeconds));
        } else {
            setTargetTimeDisplay('');
        }

        // Wait for state update before calculation (optional, but safe)
        await handleCalculateThresholds();
    };

    return (
        <div className="stat-card card threshold-card">
            {/* Target Time Input */}
            <div className="threshold-input-container">
                <label className="threshold-input-label">
                    Target Complete Raid Time ({showSeconds ? 'mm:ss' : 'ticks'}):
                </label>
                <input
                    type="text"
                    value={targetTimeDisplay}
                    className='threshold-input'
                    onChange={(e) => setTargetTimeDisplay(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    placeholder={showSeconds ? "24:00" : "2400"}
                />
                <button
                    className={`btn calculate ${targetTimeTicks > 0 ? 'active' : 'inactive'}`}
                    onClick={handleButtonClick}
                >
                    Calculate Reset Thresholds
                </button>
            </div>
            {availableFloors.length > 0 && (
                    <div className="thresholds-container">
                        {availableFloors.slice(0, -1).map((floor, index) => {
                            // Get threshold value or fall back to expected time
                            const thresholdData = thresholdResults?.thresholds[floor.id];
                            const displayValue = (thresholdData?.threshold !== null && thresholdData?.threshold !== undefined) 
                                ? thresholdData.threshold 
                                : (0);

                            return (
                                <div key={floor.id} className="threshold-item">
                                    <span className="threshold-item-label">
                                        {floor.name} Reset Threshold
                                    </span>
                                    <span className="threshold-item-value">
                                        {showSeconds
                                            ? formatSeconds(displayValue * 0.6)
                                            : displayValue.toFixed(1)
                                        }
                                    </span>
                                    {index < availableFloors.length - 1 && (
                                        <span className="threshold-item-arrow">
                                            {/* → */}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                        {targetTimeTicks > 0 && (
            <div className="target-time-display">
                <span className="target-time-label">
                    Target Time
                </span>
                <span className="target-time-value">
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