import { GEAR_TYPES, DEFAULT_GEAR_STATS } from '../data/constants';
import type { CombatStats, Equipment, GearSets } from '../types/player';
import type { Monster, Room } from '../data/monsterStats';
import { cmMonsters } from '../data/monsterStats';
import type { PlotDataPoint } from '../types/loaders';

export const calculateGearStatsForSet = (
    gearType: typeof GEAR_TYPES[number],
    gearSets: GearSets
) => {
    if (!gearSets || !gearSets[gearType]) return { ...DEFAULT_GEAR_STATS };
    // Deep clone to avoid mutation
    const totalStats = JSON.parse(JSON.stringify(DEFAULT_GEAR_STATS));
    for (const slot of gearSets[gearType]) {
        const eq = slot.selected as Equipment | undefined;
        if (eq) {
            // Bonuses (keep special logic for magic_str)
            totalStats.bonuses.str += eq.bonuses.str ?? 0;
            totalStats.bonuses.ranged_str += eq.bonuses.ranged_str ?? 0;
            totalStats.bonuses.magic_str += (eq.bonuses.magic_str ? eq.bonuses.magic_str * 0.1 : 0);
            totalStats.bonuses.prayer += eq.bonuses.prayer ?? 0;
            // Offensive stats
            for (const statName of Object.keys(totalStats.offensive)) {
                totalStats.offensive[statName as keyof typeof totalStats.offensive] +=
                    eq.offensive[statName as keyof typeof eq.offensive] ?? 0;
            }
            // Defensive stats
            for (const statName of Object.keys(totalStats.defensive)) {
                totalStats.defensive[statName as keyof typeof totalStats.defensive] +=
                    eq.defensive[statName as keyof typeof eq.defensive] ?? 0;
            }
        }
    }
    return totalStats;
};

export const getMonstersByRoom = (room: Room): Monster[] => {
    if (!room.monsters) return [];
    return room.monsters
        .map(monsterId => cmMonsters.find(m => m.id.toString() === monsterId))
        .filter((m): m is Monster => m !== undefined);
};
// Add this helper function after the existing helper functions (around line 200)
const cropDistributionTo999 = (data: PlotDataPoint[]): PlotDataPoint[] => {
    if (!data || data.length === 0) return data;

    // Find the index where cumulative probability reaches 0.999
    const cropIndex = data.findIndex(point => point.dps >= 0.999);

    if (cropIndex === -1) {
        // If we never reach 0.999, return the full distribution
        return data;
    }

    // Return data up to and including the 0.999 point, plus a few extra points for smoothness
    const extraPoints = Math.min(10, data.length - cropIndex - 1);
    return data.slice(0, cropIndex + 1 + extraPoints);
};

export const monsterStatScaling = (monster: Monster, playerHp: number) => {
    if (monster.name === "Head" || monster.name === "Melee Hand" || monster.name === "Mage Hand") {
        return monster.skills; // No scaling for Olm forms
    }
    const isTekton = monster.name === "Tekton" || monster.name === "Tekton (enraged)";
    const cmScale = isTekton ? 1.2 : 1.5;
    const hpScaling = (Math.floor(playerHp * (4.0 / 9.0)) + 55.0) / 99.0;

    const scale = (val: number) =>
        Math.floor(Math.floor(Math.floor(val / cmScale) * hpScaling) * cmScale);

    return {
        atk: scale(monster.skills.atk),
        def: scale(monster.skills.def),
        hp: monster.skills.hp,
        magic: scale(monster.skills.magic),
        ranged: scale(monster.skills.ranged),
        str: scale(monster.skills.str),
    };
};

export const monsterHpScaling = (monster: Monster, combatStats: CombatStats) => {
    if (monster.name === "Head" || monster.name === "Melee Hand" || monster.name === "Mage Hand") {
        return monster.skills.hp; // No scaling for Olm forms
    }
    const base =
        (combatStats.defence +
            combatStats.hitpoints +
            Math.floor(combatStats.prayer * 0.5)) *
        0.25;
    const melee = ((combatStats.attack + combatStats.strength) * 13.0) / 40.0;
    const ranged = ((combatStats.ranged * 1.5) * 13.0) / 40.0;
    const magic = ((combatStats.magic * 1.5) * 13.0) / 40.0;
    const cmScale = 1.5;

    let baseHp: number;
    if (monster.name === "Guardian (Chambers of Xeric)") {
        const reducedHp = Math.floor(monster.skills.hp / cmScale);
        baseHp = Math.floor(reducedHp - 99.0 + combatStats.mining);
    } else {
        baseHp = Math.floor(monster.skills.hp / cmScale);
    }
    const combatLevel = Math.floor(base + Math.max(melee, ranged, magic));
    return Math.floor(Math.floor(baseHp * (combatLevel / 126.0)) * cmScale);
};

export const calculateCombinedDistribution = (
    room1Data: PlotDataPoint[],
    room2Data: PlotDataPoint[],
    delayTicks: number = 89
): PlotDataPoint[] => {
    // Input validation
    if (!room1Data || !room2Data || !Array.isArray(room1Data) || !Array.isArray(room2Data)) {
        console.error('Invalid input data for combined distribution');
        return [];
    }

    if (!room1Data.length || !room2Data.length) {
        console.error('Empty data arrays for combined distribution');
        return [];
    }

    try {
        // Sort data by time to ensure proper ordering
        const sortedRoom1 = [...room1Data].sort((a, b) => a.time - b.time);
        const sortedRoom2 = [...room2Data].sort((a, b) => a.time - b.time);

        // CORRECTED: Convert CDF to PMF properly
        const convertToPMF = (data: PlotDataPoint[]) => {
            const pmf: { [time: number]: number } = {};
            
            // Skip the first point - it represents cumulative probability up to that time
            // The actual probability mass starts from the differences between consecutive points
            
            for (let i = 1; i < data.length; i++) {
                const currentTime = Math.floor(data[i].time);
                const currentProb = data[i].dps;
                const prevProb = data[i - 1].dps;
                
                const probMass = Math.max(0, currentProb - prevProb);
                
                if (probMass > 0 && isFinite(probMass)) {
                    pmf[currentTime] = (pmf[currentTime] || 0) + probMass;
                }
            }
            
            // Handle any remaining probability mass at the end
            const lastPoint = data[data.length - 1];
            const remainingProb = Math.max(0, 1.0 - lastPoint.dps);
            if (remainingProb > 0.001) { // Only if significant
                const lastTime = Math.floor(lastPoint.time);
                pmf[lastTime + 1] = (pmf[lastTime + 1] || 0) + remainingProb;
            }
            
            // Normalize the PMF to ensure it sums to 1
            const totalMass = Object.values(pmf).reduce((sum, prob) => sum + prob, 0);
            if (totalMass > 0) {
                Object.keys(pmf).forEach(time => {
                    pmf[parseInt(time)] = pmf[parseInt(time)] / totalMass;
                });
            }
            
            return pmf;
        };

        const pmf1 = convertToPMF(sortedRoom1);
        const pmf2 = convertToPMF(sortedRoom2);

        // Calculate expected values from PMFs to verify
        const calculateExpectedValue = (pmf: { [time: number]: number }) => {
            return Object.entries(pmf).reduce((sum, [time, prob]) => {
                return sum + parseInt(time) * prob;
            }, 0);
        };

        const expected1 = calculateExpectedValue(pmf1);
        const expected2 = calculateExpectedValue(pmf2);
        const expectedCombined = expected1 + expected2 + delayTicks;

        console.log('PMF Expected Values:', {
            room1: expected1.toFixed(1),
            room2: expected2.toFixed(1),
            delay: delayTicks,
            expectedSum: expectedCombined.toFixed(1)
        });

        const times1 = Object.keys(pmf1).map(Number).sort((a, b) => a - b);
        const times2 = Object.keys(pmf2).map(Number).sort((a, b) => a - b);
        
        if (times1.length === 0 || times2.length === 0) {
            console.error('Failed to create valid PMFs');
            return [];
        }

        // Convolve the distributions
        const combinedPMF: { [time: number]: number } = {};

        for (const t1 of times1) {
            const prob1 = pmf1[t1];
            if (prob1 > 0) {
                for (const t2 of times2) {
                    const prob2 = pmf2[t2];
                    if (prob2 > 0) {
                        const combinedTime = t1 + t2 + delayTicks;
                        const combinedProb = prob1 * prob2;
                        
                        if (isFinite(combinedProb) && combinedProb > 0) {
                            combinedPMF[combinedTime] = (combinedPMF[combinedTime] || 0) + combinedProb;
                        }
                    }
                }
            }
        }

        // Normalize the combined PMF
        const totalCombinedMass = Object.values(combinedPMF).reduce((sum, prob) => sum + prob, 0);
        if (totalCombinedMass > 0) {
            Object.keys(combinedPMF).forEach(time => {
                combinedPMF[parseInt(time)] = combinedPMF[parseInt(time)] / totalCombinedMass;
            });
        }

        // Convert back to CDF
        const combinedTimes = Object.keys(combinedPMF).map(Number).sort((a, b) => a - b);
        const combinedData: PlotDataPoint[] = [];
        let cumulativeProb = 0;

        for (const time of combinedTimes) {
            cumulativeProb += combinedPMF[time];
            combinedData.push({
                time: time,
                dps: Math.min(1, Math.max(0, cumulativeProb))
            });
        }

        // Ensure we end at probability 1.0
        if (combinedData.length > 0) {
            const lastPoint = combinedData[combinedData.length - 1];
            if (lastPoint.dps < 0.999) {
                combinedData.push({
                    time: lastPoint.time + 1,
                    dps: 1.0
                });
            }
        }

        // Calculate expected value from the combined PMF
        const actualExpectedValue = calculateExpectedValue(combinedPMF);

        console.log('Combined distribution verification:', {
            expectedFromSum: expectedCombined.toFixed(1),
            actualExpectedValue: actualExpectedValue.toFixed(1),
            difference: (actualExpectedValue - expectedCombined).toFixed(1),
            totalProbabilityMass: totalCombinedMass.toFixed(6),
            distributionRange: [combinedTimes[0], combinedTimes[combinedTimes.length - 1]],
            dataPoints: combinedData.length
        });

        // Crop the distribution to 99.9%
        const croppedData = cropDistributionTo999(combinedData);
        return croppedData;

    } catch (error) {
        console.error('Error calculating combined distribution:', error);
        return [];
    }
};