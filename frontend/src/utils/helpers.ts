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
    const cropIndex = data.findIndex(point => point.probability >= 0.999);

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
                const currentProb = data[i].probability;
                const prevProb = data[i - 1].probability;

                const probMass = Math.max(0, currentProb - prevProb);

                if (probMass > 0 && isFinite(probMass)) {
                    pmf[currentTime] = (pmf[currentTime] || 0) + probMass;
                }
            }

            // Handle any remaining probability mass at the end
            const lastPoint = data[data.length - 1];
            const remainingProb = Math.max(0, 1.0 - lastPoint.probability);
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
        // const calculateExpectedValue = (pmf: { [time: number]: number }) => {
        //     return Object.entries(pmf).reduce((sum, [time, prob]) => {
        //         return sum + parseInt(time) * prob;
        //     }, 0);
        // };

        // const expected1 = calculateExpectedValue(pmf1);
        // const expected2 = calculateExpectedValue(pmf2);
        // const expectedCombined = expected1 + expected2 + delayTicks;

        // console.log('PMF Expected Values:', {
        //     room1: expected1.toFixed(1),
        //     room2: expected2.toFixed(1),
        //     delay: delayTicks,
        //     expectedSum: expectedCombined.toFixed(1)
        // });

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
                probability: Math.min(1, Math.max(0, cumulativeProb))
            });
        }

        // Ensure we end at probability 1.0
        if (combinedData.length > 0) {
            const lastPoint = combinedData[combinedData.length - 1];
            if (lastPoint.probability < 0.999) {
                combinedData.push({
                    time: lastPoint.time + 1,
                    probability: 1.0
                });
            }
        }

        // Calculate expected value from the combined PMF
        // const actualExpectedValue = calculateExpectedValue(combinedPMF);

        // console.log('Combined distribution verification:', {
        //     expectedFromSum: expectedCombined.toFixed(1),
        //     actualExpectedValue: actualExpectedValue.toFixed(1),
        //     difference: (actualExpectedValue - expectedCombined).toFixed(1),
        //     totalProbabilityMass: totalCombinedMass.toFixed(6),
        //     distributionRange: [combinedTimes[0], combinedTimes[combinedTimes.length - 1]],
        //     dataPoints: combinedData.length
        // });

        // Crop the distribution to 99.9%
        const croppedData = cropDistributionTo999(combinedData);
        return croppedData;

    } catch (error) {
        console.error('Error calculating combined distribution:', error);
        return [];
    }
};

// Convert CDF to PMF
// const cdfToPmf = (data: PlotDataPoint[]): { timeAxis: number[], pmf: number[] } => {
//     if (!data || data.length === 0) return { timeAxis: [], pmf: [] };

//     const sortedData = [...data].sort((a, b) => a.time - b.time); // Use .time not .ticks
//     const t = sortedData.map(d => Math.round(d.time));
//     const c = sortedData.map(d => Math.max(0, Math.min(1, d.probability)));

//     // Ensure CDF is monotonic
//     for (let i = 1; i < c.length; i++) {
//         c[i] = Math.max(c[i], c[i - 1]);
//     }

//     const tMin = Math.min(...t);
//     const tMax = Math.max(...t);
//     const fullT = Array.from({ length: tMax - tMin + 1 }, (_, i) => tMin + i);

//     // Interpolate CDF values
//     const fullC = fullT.map(time => {
//         if (time <= t[0]) return c[0];
//         if (time >= t[t.length - 1]) return c[c.length - 1];

//         // Linear interpolation
//         let i = 0;
//         while (i < t.length - 1 && t[i + 1] < time) i++;
//         if (t[i] === time) return c[i];

//         const ratio = (time - t[i]) / (t[i + 1] - t[i]);
//         return c[i] + ratio * (c[i + 1] - c[i]);
//     });

//     // Convert CDF to PMF
//     const pmf = [fullC[0]];
//     for (let i = 1; i < fullC.length; i++) {
//         pmf.push(Math.max(0, fullC[i] - fullC[i - 1]));
//     }

//     // Normalize PMF
//     const sum = pmf.reduce((a, b) => a + b, 0);
//     if (sum > 0) {
//         for (let i = 0; i < pmf.length; i++) {
//             pmf[i] /= sum;
//         }
//     }

//     return { timeAxis: fullT, pmf };
// };

// Probability of completing within time limit
// const probLeqTime = (timeAxis: number[], cdf: number[], tLimit: number): number => {
//     if (tLimit < timeAxis[0]) return 0;
//     if (tLimit >= timeAxis[timeAxis.length - 1]) return cdf[cdf.length - 1];

//     // Find the index
//     let idx = 0;
//     while (idx < timeAxis.length - 1 && timeAxis[idx + 1] <= tLimit) idx++;
//     return cdf[idx];
// };

// Convolve two PMFs
// const convolvePmfs = (a: number[], b: number[]): number[] => {
//     const result = new Array(a.length + b.length - 1).fill(0);
//     for (let i = 0; i < a.length; i++) {
//         for (let j = 0; j < b.length; j++) {
//             result[i + j] += a[i] * b[j];
//         }
//     }
//     return result;
// };

// Main threshold calculation function
// export const calculateResetThresholds = (
//     targetTicks: number,
//     floor1Data: PlotDataPoint[],
//     floor2Data: PlotDataPoint[],
//     floor3Data: PlotDataPoint[],
//     olmData: PlotDataPoint[],
//     completeRaidData: PlotDataPoint[]
// ) => {
//     try {
//         // Convert all CDFs to PMFs
//         const { timeAxis: t1, pmf: pmf1 } = cdfToPmf(floor1Data);
//         const { timeAxis: t2, pmf: pmf2 } = cdfToPmf(floor2Data);
//         const { timeAxis: t3, pmf: pmf3 } = cdfToPmf(floor3Data);
//         const { timeAxis: to, pmf: pmfo } = cdfToPmf(olmData);
//         const { timeAxis: tr, pmf: pmfr } = cdfToPmf(completeRaidData);

//         if (pmf1.length === 0 || pmf2.length === 0 || pmf3.length === 0 || pmfo.length === 0 || pmfr.length === 0) {
//             throw new Error('Invalid or empty distribution data');
//         }

//         // Build remaining-content PMFs via convolution
//         // Remaining after Floor 1: F2 + F3 + Olm
//         const pmf_23o = convolvePmfs(convolvePmfs(pmf2, pmf3), pmfo);
//         const t_23o_min = Math.min(...t2) + Math.min(...t3) + Math.min(...to);
//         const t_23o_max = Math.max(...t2) + Math.max(...t3) + Math.max(...to);
//         const t_23o = Array.from({ length: t_23o_max - t_23o_min + 1 }, (_, i) => t_23o_min + i);

//         // Remaining after Floor 2: F3 + Olm
//         const pmf_3o = convolvePmfs(pmf3, pmfo);
//         const t_3o_min = Math.min(...t3) + Math.min(...to);
//         const t_3o_max = Math.max(...t3) + Math.max(...to);
//         const t_3o = Array.from({ length: t_3o_max - t_3o_min + 1 }, (_, i) => t_3o_min + i);

//         // Remaining after Floor 3: Olm
//         const pmf_o = pmfo;
//         const t_o = to;

//         // Elapsed supports for checkpoints
//         const pmf12 = convolvePmfs(pmf1, pmf2);
//         const t12_min = Math.min(...t1) + Math.min(...t2);
//         const t12_max = Math.max(...t1) + Math.max(...t2);
//         const t12 = Array.from({ length: t12_max - t12_min + 1 }, (_, i) => t12_min + i);

//         const pmf123 = convolvePmfs(pmf12, pmf3);
//         const t123_min = t12_min + Math.min(...t3);
//         const t123_max = t12_max + Math.max(...t3);
//         const t123 = Array.from({ length: t123_max - t123_min + 1 }, (_, i) => t123_min + i);

//         // CDFs for remaining segments and full raid
//         const cdf_23o = pmfToCdf(pmf_23o);
//         const cdf_3o = pmfToCdf(pmf_3o);
//         const cdf_o = pmfToCdf(pmf_o);
//         const cdfr = pmfToCdf(pmfr);

//         // Baseline: success prob if restarting now
//         const p_restart = probLeqTime(tr, cdfr, targetTicks);

//         // Floor 1 checkpoint
//         const E1_candidates = Array.from({ length: Math.max(...t1) - Math.min(...t1) + 1 }, (_, i) => Math.min(...t1) + i);
//         const cont_f1 = E1_candidates.map(E1 => probLeqTime(t_23o, cdf_23o, targetTicks - E1));
//         const mask1 = cont_f1.map(p => p >= p_restart);

//         let E1_thr: number | null = null;
//         let rule1 = "never reset";
//         if (mask1.some(Boolean)) {
//             const validE1s = E1_candidates.filter((_, i) => mask1[i]);
//             E1_thr = Math.max(...validE1s) + 1;
//             rule1 = "continue if E1 < threshold; reset if E1 ≥ threshold";
//         } else if (cont_f1.every(p => p < p_restart)) {
//             rule1 = "reset always";
//         }

//         // Floor 2 checkpoint
//         const E2_candidates = Array.from({ length: t12_max - t12_min + 1 }, (_, i) => t12_min + i);
//         const cont_f2 = E2_candidates.map(E2 => probLeqTime(t_3o, cdf_3o, targetTicks - E2));
//         const mask2 = cont_f2.map(p => p >= p_restart);

//         let E2_thr: number | null = null;
//         let rule2 = "never reset";
//         if (mask2.some(Boolean)) {
//             const validE2s = E2_candidates.filter((_, i) => mask2[i]);
//             E2_thr = Math.max(...validE2s) + 1;
//             rule2 = "continue if total E2 < threshold; reset if E2 ≥ threshold";
//         } else if (cont_f2.every(p => p < p_restart)) {
//             rule2 = "reset always";
//         }

//         // Floor 3 checkpoint (entering Olm)
//         const E3_candidates = Array.from({ length: t123_max - t123_min + 1 }, (_, i) => t123_min + i);
//         const cont_f3 = E3_candidates.map(E3 => probLeqTime(t_o, cdf_o, targetTicks - E3));
//         const mask3 = cont_f3.map(p => p >= p_restart);

//         let E3_thr: number | null = null;
//         let rule3 = "never reset";
//         if (mask3.some(Boolean)) {
//             const validE3s = E3_candidates.filter((_, i) => mask3[i]);
//             E3_thr = Math.max(...validE3s) + 1;
//             rule3 = "continue if total E3 < threshold; reset if E3 ≥ threshold";
//         } else if (cont_f3.every(p => p < p_restart)) {
//             rule3 = "reset always";
//         }

//         return {
//             input_target: targetTicks,
//             p_success_if_restart_now: p_restart,
//             thresholds: {
//                 floor1: { threshold: E1_thr, decision_rule: rule1 },
//                 floor2: { threshold: E2_thr, decision_rule: rule2 },
//                 floor3: { threshold: E3_thr, decision_rule: rule3 }
//             },
//             notes: "Thresholds compare continue-vs-restart probabilities at target time."
//         };
//     } catch (error) {
//         console.error('Error calculating thresholds:', error);
//         return null;
//     }
// };

// export const calculateResetThresholds = (
//     targetTicks: number,
//     floor1Data: PlotDataPoint[],
//     floor2Data: PlotDataPoint[],
//     floor3Data: PlotDataPoint[],
//     olmData: PlotDataPoint[],
//     completeRaidData: PlotDataPoint[]
// ) => {
//     // Convert CDFs to PMFs and time axes
//     const { timeAxis: t1, pmf: pmf1 } = cdfToPmf(floor1Data);
//     const { timeAxis: t2, pmf: pmf2 } = cdfToPmf(floor2Data);
//     const { timeAxis: t3, pmf: pmf3 } = cdfToPmf(floor3Data);
//     const { timeAxis: to, pmf: pmfo } = cdfToPmf(olmData);

//     // Helper to get CDF from PMF
//     const pmfToCdf = (pmf: number[]) => {
//         const cdf: number[] = [];
//         let sum = 0;
//         for (const p of pmf) {
//             sum += p;
//             cdf.push(Math.max(0, Math.min(1, sum)));
//         }
//         return cdf;
//     };

//     // Convolve PMFs for remaining floors
//     const pmf_23o = convolvePmfs(convolvePmfs(pmf2, pmf3), pmfo);
//     const t_23o_min = t2[0] + t3[0] + to[0];
//     const t_23o = Array.from({ length: pmf_23o.length }, (_, i) => t_23o_min + i);
//     const cdf_23o = pmfToCdf(pmf_23o);

//     const pmf_3o = convolvePmfs(pmf3, pmfo);
//     const t_3o_min = t3[0] + to[0];
//     const t_3o = Array.from({ length: pmf_3o.length }, (_, i) => t_3o_min + i);
//     const cdf_3o = pmfToCdf(pmf_3o);

//     // Floor 1 threshold
//     const possible_mask1 = pmf1.map(p => p > 0);
//     const E1_candidates = t1.filter((_, i) => possible_mask1[i]);
//     const cdf1_masked = pmfToCdf(pmf1.filter((p, i) => possible_mask1[i]));
//     const remaining_after_f1 = E1_candidates.map(E1 => targetTicks - E1);
//     const prob_complete_after_f1 = remaining_after_f1.map(t => probLeqTime(t_23o, cdf_23o, t));
//     let floor1Threshold: number | null = null;
//     for (let i = E1_candidates.length - 1; i >= 0; --i) {
//         if (cdf1_masked[i] <= prob_complete_after_f1[i]) {
//             floor1Threshold = E1_candidates[i];
//             break;
//         }
//     }

//     // Floor 1+2 threshold
//     const t12: number[] = [];
//     const pmf12: number[] = [];
//     for (let i = 0; i < t1.length; ++i) {
//         for (let j = 0; j < t2.length; ++j) {
//             const total = t1[i] + t2[j];
//             const prob = pmf1[i] * pmf2[j];
//             if (prob > 0 && total + t3[0] + to[0] <= targetTicks) {
//                 t12.push(total);
//                 pmf12.push(prob);
//             }
//         }
//     }
//     const sortIdx12 = t12.map((t, i) => [t, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
//     const t12_sorted = sortIdx12.map(i => t12[i]);
//     const pmf12_sorted = sortIdx12.map(i => pmf12[i]);
//     const cdf12_sorted = pmfToCdf(pmf12_sorted);
//     const remaining_after_f12 = t12_sorted.map(E2 => targetTicks - E2);
//     const prob_complete_after_f12 = remaining_after_f12.map(t => probLeqTime(t_3o, cdf_3o, t));
//     let floor12Threshold: number | null = null;
//     for (let i = t12_sorted.length - 1; i >= 0; --i) {
//         if (cdf12_sorted[i] <= prob_complete_after_f12[i]) {
//             floor12Threshold = t12_sorted[i];
//             break;
//         }
//     }

//     // Floor 1+2+3 threshold
//     const t123: number[] = [];
//     const pmf123: number[] = [];
//     for (let i = 0; i < t1.length; ++i) {
//         for (let j = 0; j < t2.length; ++j) {
//             for (let k = 0; k < t3.length; ++k) {
//                 const total = t1[i] + t2[j] + t3[k];
//                 const prob = pmf1[i] * pmf2[j] * pmf3[k];
//                 if (prob > 0 && total + to[0] <= targetTicks) {
//                     t123.push(total);
//                     pmf123.push(prob);
//                 }
//             }
//         }
//     }
//     const sortIdx123 = t123.map((t, i) => [t, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
//     const t123_sorted = sortIdx123.map(i => t123[i]);
//     const pmf123_sorted = sortIdx123.map(i => pmf123[i]);
//     const cdf123_sorted = pmfToCdf(pmf123_sorted);
//     const remaining_after_f123 = t123_sorted.map(E3 => targetTicks - E3);
//     const prob_complete_after_f123 = remaining_after_f123.map(t => probLeqTime(to, pmfToCdf(pmfo), t));
//     let floor123Threshold: number | null = null;
//     for (let i = t123_sorted.length - 1; i >= 0; --i) {
//         if (cdf123_sorted[i] <= prob_complete_after_f123[i]) {
//             floor123Threshold = t123_sorted[i];
//             break;
//         }
//     }

//     const { timeAxis: tr, pmf: pmfr } = cdfToPmf(completeRaidData);
//     const cdfr = pmfToCdf(pmfr);
//     const p_success_if_restart_now = probLeqTime(tr, cdfr, targetTicks);

//     // Decision rules
//     const rule1 = floor1Threshold !== null
//         ? "continue if E1 < threshold; reset if E1 ≥ threshold"
//         : "never reset";
//     const rule2 = floor12Threshold !== null
//         ? "continue if total E2 < threshold; reset if E2 ≥ threshold"
//         : "never reset";
//     const rule3 = floor123Threshold !== null
//         ? "continue if total E3 < threshold; reset if E3 ≥ threshold"
//         : "never reset";

//     return {
//         input_target: targetTicks,
//         p_success_if_restart_now,
//         thresholds: {
//             floor1: {
//                 threshold: floor1Threshold,
//                 decision_rule: rule1
//             },
//             floor2: {
//                 threshold: floor12Threshold,
//                 decision_rule: rule2
//             },
//             floor3: {
//                 threshold: floor123Threshold,
//                 decision_rule: rule3
//             }
//         },
//         notes: "Thresholds compare continue-vs-restart probabilities at target time."
//     };
// };