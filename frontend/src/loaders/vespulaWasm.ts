import init, {
    calculate_dps_with_objects_vespula
} from '../wasm/vespula/vespula_wasm.js';
import wasmUrl from '../wasm/vespula/vespula_wasm_bg.wasm?url';

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
export const calculateDPSWithObjectsVespula = async (player: any, room: any, cap: number = 0.9999) => {
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

        const result = calculate_dps_with_objects_vespula(
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

        return {
            tickData: [],
            hitData: [],
            summary: {
                expectedHit: 0,
                expectedHits: 0,
                accuracy: 0.8 * 100,
                ticksTimeToKill: 0,
                secondsTimeToKill: 0,
                maxHit: 50,
                effectiveStrength: 0,
                effectiveAttack: 0,
                maxAttackRoll: 0,
                maxDefenceRoll: 0,
            }
        };
    }
};