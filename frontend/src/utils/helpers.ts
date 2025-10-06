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
        // Validate data structure
        const validateData = (data: PlotDataPoint[], name: string) => {

            for (let i = 0; i < data.length; i++) {
                const point = data[i];
                if (!point || typeof point.time !== 'number' || typeof point.dps !== 'number') {
                    console.error(`Invalid data point in ${name} at index ${i}:`, point);
                    return false;
                }
                // Relax the validation - allow dps values greater than 1 since they might be cumulative probabilities
                if (isNaN(point.time) || isNaN(point.dps) || point.time < 0 || point.dps < 0) {
                    console.error(`Invalid values in ${name} at index ${i}:`, point, {
                        timeNaN: isNaN(point.time),
                        dpsNaN: isNaN(point.dps),
                        timeNegative: point.time < 0,
                        dpsNegative: point.dps < 0
                    });
                    return false;
                }
            }
            return true;
        };

        if (!validateData(room1Data, 'room1') || !validateData(room2Data, 'room2')) {
            return [];
        }

        // Get the max times for both distributions
        const maxTime1 = Math.max(...room1Data.map(d => d.time));
        const maxTime2 = Math.max(...room2Data.map(d => d.time));

        if (!isFinite(maxTime1) || !isFinite(maxTime2) || maxTime1 <= 0 || maxTime2 <= 0) {
            console.error('Invalid max times:', { maxTime1, maxTime2 });
            return [];
        }

        const maxCombinedTime = maxTime1 + maxTime2 + delayTicks;

        if (maxCombinedTime > 10000) { // Prevent memory issues
            console.error('Combined time too large:', maxCombinedTime);
            return [];
        }

        // Convert cumulative distributions to probability mass functions
        const convertToPMF = (data: PlotDataPoint[], maxTime: number) => {
            const pmf = new Array(Math.floor(maxTime) + 1).fill(0);

            let totalMassAdded = 0;
            let nonZeroCount = 0;

            for (let i = 0; i < data.length - 1; i++) {
                const currentProb = data[i].dps;
                const nextProb = data[i + 1]?.dps || 0;
                // For increasing CDF, probability mass is nextProb - currentProb
                const probMass = Math.max(0, nextProb - currentProb);
                const timeIndex = Math.floor(data[i].time);

                if (timeIndex >= 0 && timeIndex < pmf.length && probMass > 0 && isFinite(probMass)) {
                    pmf[timeIndex] = probMass;
                    totalMassAdded += probMass;
                    nonZeroCount++;
                }
            }

            return pmf;
        };

        const pmf1 = convertToPMF(room1Data, maxTime1);
        const pmf2 = convertToPMF(room2Data, maxTime2);

        // Validate PMFs
        if (!pmf1.length || !pmf2.length) {
            console.error('Failed to create PMFs');
            return [];
        }

        // Convolve the distributions with delay
        const combinedPMF = new Array(Math.floor(maxCombinedTime) + 1).fill(0);

        for (let t1 = 0; t1 < pmf1.length; t1++) {
            if (pmf1[t1] > 0) {
                for (let t2 = 0; t2 < pmf2.length; t2++) {
                    if (pmf2[t2] > 0) {
                        const combinedTime = t1 + t2 + delayTicks;
                        if (combinedTime >= 0 && combinedTime < combinedPMF.length) {
                            const product = pmf1[t1] * pmf2[t2];
                            if (isFinite(product)) {
                                combinedPMF[combinedTime] += product;
                            }
                        }
                    }
                }
            }
        }

        // Convert back to cumulative distribution - ONLY ADD NON-ZERO POINTS
        const combinedData: PlotDataPoint[] = [];
        let cumulativeProb = 0;

        // For increasing CDF, we build from left to right (time 0 to max)
        for (let t = 0; t < combinedPMF.length; t++) {
            if (isFinite(combinedPMF[t])) {
                cumulativeProb += combinedPMF[t];
            }

            // ONLY add data points where there's actual probability mass or where cumulative changes
            if (combinedPMF[t] > 0 || (combinedData.length > 0 && cumulativeProb !== combinedData[combinedData.length - 1].dps)) {
                combinedData.push({
                    time: t,
                    dps: Math.min(1, Math.max(0, cumulativeProb)) // Ensure probability is between 0 and 1
                });
            }
        }

        // Crop the distribution to 99.9%
        const croppedData = cropDistributionTo999(combinedData);

        if (!croppedData.length) {
            console.error('No combined data generated after cropping');
            return [];
        }

        return croppedData;
    } catch (error) {
        console.error('Error calculating combined distribution:', error);
        return [];
    }
};