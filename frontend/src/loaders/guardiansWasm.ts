import init, {
    weapon_kill_times,
    distribution_of_hits_to_kill,
    calculate_dps_with_objects_guardians
} from '../wasm/guardians/guardians_wasm.js';
import wasmUrl from '../wasm/guardians/guardians_wasm_bg.wasm?url';

let wasmInitialized = false;

export const initWasm = async () => {
    if (!wasmInitialized) {
        await init({ module_or_path: wasmUrl });
        wasmInitialized = true;
    }
};

export interface PlotDataPoint {
    time: number;
    dps: number;
    accuracy: number;
}

export interface HitDataPoint {
    hits: number;
    probability: number;
}

export interface CalculationSummary {
    expectedHit: number;
    expectedHits: number;
    accuracy: number;
    ticksTimeToKill: number;
    secondsTimeToKill: number;
    maxHit: number;
    effectiveStrength: number;
    effectiveAttack: number;
    maxAttackRoll: number;
    maxDefenceRoll: number;
}

// New function that accepts a single payload object
export const calculateDPSWithObjectsGuardians = async (player: any, room: any, cap: number = 0.99) => {
    await initWasm();

    const payload = {
        player,
        room,
        config: {
            cap
        }
    };

    console.log('Sending payload to WASM:', payload);

    try {
        console.log('✅ Using calculate_dps_with_objects function');

        const result = calculate_dps_with_objects_guardians(
            JSON.stringify(payload)
        );

        console.log('WASM result:', result);

        const parsedResult = JSON.parse(result);

        if (parsedResult.error) {
            throw new Error(parsedResult.error);
        }

        // Use encounter_kill_times for the overall plot
        const encounterKillTimes = parsedResult.encounter_kill_times || [];
        const tickData: PlotDataPoint[] = encounterKillTimes.map((prob: number, idx: number) => ({
            time: idx * 5, // ticks are 1-based
            dps: prob,     // This is actually cumulative probability
            accuracy: 0    // Not meaningful for the encounter as a whole
        }));

        // Optionally, you can also expose per-monster kill_times if you want
        // const perMonsterTickData = parsedResult.results.map((res: any) =>
        //     res.kill_times.map((prob: number, idx: number) => ({
        //         time: idx + 1,
        //         dps: prob,
        //         accuracy: 0
        //     }))
        // );

        // Calculate summary statistics for the whole encounter
        const summary: CalculationSummary = {
            expectedHit: 0, // Not meaningful for the whole encounter
            expectedHits: parsedResult.total_hits,
            accuracy: 0, // Not meaningful for the whole encounter
            ticksTimeToKill: parsedResult.total_expected_ticks,
            secondsTimeToKill: parsedResult.total_expected_seconds,
            maxHit: 0,
            effectiveStrength: 0,
            effectiveAttack: 0,
            maxAttackRoll: 0,
            maxDefenceRoll: 0,
        };

        return {
            tickData,
            summary,
            perMonster: parsedResult.results // Expose per-monster results if needed
        };
    } catch (error) {
        console.error('WASM calculation error, falling back to legacy calculation:', error);
        console.error('Make sure to run: npm run build:wasm');

        // Fallback to legacy calculation with estimated values
        const maxHit = 50; // Estimate
        const accuracy = 0.8; // Estimate

        return calculateDPS(maxHit, maxHit, accuracy, cap);
    }
};

// Keep existing function for backward compatibility
export const calculateDPS = async (hp: number, maxHit: number, accuracy: number, cap: number = 0.99) => {
    await initWasm();

    // Get raw arrays from WASM
    const tickDataRaw = weapon_kill_times(hp, maxHit, accuracy, cap);
    const hitDataRaw = distribution_of_hits_to_kill(hp, maxHit, accuracy, Math.min(0.999, Math.max(cap, 0.99)));

    // Log what WASM returns
    console.log('WASM tickDataRaw:', tickDataRaw);
    console.log('WASM hitDataRaw:', hitDataRaw);
    console.log('tickDataRaw type:', typeof tickDataRaw);
    console.log('hitDataRaw type:', typeof hitDataRaw);
    console.log('tickDataRaw length:', tickDataRaw?.length);
    console.log('hitDataRaw length:', hitDataRaw?.length);

    // Convert Float64Array to proper JavaScript arrays with correct structure
    const tickData: PlotDataPoint[] = Array.from(tickDataRaw).map((prob: number, tick: number) => ({
        time: tick + 1, // ticks are 1-based
        dps: prob, // This is actually P(dead) not DPS, but keeping for chart compatibility
        accuracy: accuracy * 100
    }));

    const hitData: HitDataPoint[] = Array.from(hitDataRaw).map((prob: number, hits: number) => ({
        hits,
        probability: prob
    }));

    console.log('Converted tickData:', tickData.slice(0, 5)); // Log first 5 items
    console.log('Converted hitData:', hitData.slice(0, 5)); // Log first 5 items

    // Simplified summary for legacy function (real calculations are in WASM)
    const summary: CalculationSummary = {
        expectedHit: (maxHit / 2) * accuracy,
        expectedHits: (maxHit / 2) * accuracy,
        accuracy: accuracy * 100,
        ticksTimeToKill: tickData.find(p => p.dps >= 0.95)?.time ?? (tickData.length * 5),
        secondsTimeToKill: tickData.find(p => p.dps >= 0.95)?.time ?? (tickData.length * 5) / 20,
        // These values are not available in legacy mode
        maxHit: maxHit,
        effectiveStrength: 0,
        effectiveAttack: 0,
        maxAttackRoll: 0,
        maxDefenceRoll: 0,
    };

    return {
        tickData,
        hitData,
        summary
    };
};