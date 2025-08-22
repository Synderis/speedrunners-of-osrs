import init, {
    weapon_and_thrall_kill_times,
    distribution_of_hits_to_kill,
    calculate_dps_with_objects_vasa
} from '../wasm/vasa/vasa_wasm.js';
import wasmUrl from '../wasm/vasa/vasa_wasm_bg.wasm?url';

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
    maxDPS: number;
    avgDPS: number;
    accuracy: number;
    timeToKill: number;
    maxHit: number;
    effectiveStrength: number;
    effectiveAttack: number;
    maxAttackRoll: number;
    maxDefenceRoll: number;
}

// New function that accepts a single payload object
export const calculateDPSWithObjectsVasa = async (player: any, monster: any, cap: number = 0.9999) => {
    await initWasm();

    // Package everything into a single payload object
    const payload = {
        player,
        monster,
        config: {
            cap
        }
    };

    console.log('Sending payload to WASM:', payload);

    try {
        console.log('✅ Using calculate_dps_with_objects function');

        const result = calculate_dps_with_objects_vasa(
            JSON.stringify(payload)  // Pass single JSON string
        );

        console.log('WASM result:', result);

        const parsedResult = JSON.parse(result);

        if (parsedResult.error) {
            throw new Error(parsedResult.error);
        }

        const { calculation, kill_times } = parsedResult;

        // Convert kill times to plot data
        const tickData: PlotDataPoint[] = kill_times.map((prob: number, tick: number) => ({
            time: tick + 1,
            dps: prob,
            accuracy: calculation.accuracy * 100
        }));

        // Calculate summary statistics
        const summary: CalculationSummary = {
            maxDPS: calculation.max_hit * calculation.accuracy,
            avgDPS: (calculation.max_hit / 2) * calculation.accuracy,
            accuracy: calculation.accuracy * 100,
            timeToKill: tickData.findIndex(p => p.dps >= 0.95) + 1 || tickData.length,
            maxHit: calculation.max_hit,
            effectiveStrength: calculation.effective_strength,
            effectiveAttack: calculation.effective_attack,
            maxAttackRoll: calculation.max_attack_roll,
            maxDefenceRoll: calculation.max_defence_roll,
        };

        return {
            tickData,
            summary
        };
    } catch (error) {
        console.error('WASM calculation error, falling back to legacy calculation:', error);
        console.error('Make sure to run: npm run build:wasm');

        // Fallback to legacy calculation with estimated values
        const maxHit = 50; // Estimate
        const accuracy = 0.8; // Estimate

        return calculateDPS(monster.hitpoints || 450, maxHit, accuracy, cap);
    }
};

// Keep existing function for backward compatibility
export const calculateDPS = async (hp: number, maxHit: number, accuracy: number, cap: number = 0.99) => {
    await initWasm();

    // Get raw arrays from WASM
    const tickDataRaw = weapon_and_thrall_kill_times(hp, maxHit, accuracy, cap);
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
        maxDPS: maxHit * accuracy,
        avgDPS: (maxHit / 2) * accuracy,
        accuracy: accuracy * 100,
        timeToKill: tickData.findIndex(p => p.dps >= 0.95) + 1 || tickData.length,
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