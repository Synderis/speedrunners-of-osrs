export interface PlotDataPoint {
    time: number;
    dps: number;
    accuracy: number;
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

type WasmInit = (options: any) => Promise<void>;
type WasmCalc = (payload: string) => string;

export const createWasmDpsLoader = (
    init: WasmInit,
    wasmUrl: string,
    calcFn: WasmCalc
) => {
    let wasmInitialized = false;

    const initWasm = async () => {
        if (!wasmInitialized) {
            await init({ module_or_path: wasmUrl });
            wasmInitialized = true;
        }
    };

    return async (player: any, room: any, cap: number = 0.9999) => {
        await initWasm();
        const payload = { player, room, config: { cap } };
        try {
            const result = calcFn(JSON.stringify(payload));
            const parsedResult = JSON.parse(result);
            if (parsedResult.error) throw new Error(parsedResult.error);

            const tickData: PlotDataPoint[] = (parsedResult.encounter_kill_times || []).map((pt: any) => ({
                time: pt.tick,
                dps: pt.probability,
                accuracy: 0
            }));

            const summary: CalculationSummary = {
                expectedHit: 0,
                expectedHits: parsedResult.total_hits,
                accuracy: 0,
                ticksTimeToKill: parsedResult.total_expected_ticks,
                secondsTimeToKill: parsedResult.total_expected_seconds,
                maxHit: 0,
                effectiveStrength: 0,
                effectiveAttack: 0,
                maxAttackRoll: 0,
                maxDefenceRoll: 0,
            };

            return { tickData, summary, perMonster: parsedResult.results };
        } catch (error) {
            console.error('WASM calculation error:', error);
            return {
                tickData: [],
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
};