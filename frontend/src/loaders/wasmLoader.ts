export interface PlotDataPoint {
    time: number;
    dps: number;
}

export interface CalculationSummary {
    ticksTimeToKill: number;
    secondsTimeToKill: number;
    phaseTimeResults?: any[];
    phaseResults: any[];
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
            console.log("WASM result string:", result);
            const parsedResult = JSON.parse(result);
            if (parsedResult.error) {
                console.error("WASM error string:", parsedResult.error);
                throw new Error(parsedResult.error);
            }
            console.log("WASM parsed result:", parsedResult.results);
            // console.log("WASM parsed encounter kill times:", parsedResult.debug_trials);

            const tickData: PlotDataPoint[] = (parsedResult.encounter_kill_times || []).map((pt: any) => ({
                time: pt.tick,
                dps: pt.probability
            }));

            const summary: CalculationSummary = {
                ticksTimeToKill: parsedResult.total_expected_ticks,
                secondsTimeToKill: parsedResult.total_expected_seconds,
                phaseTimeResults: parsedResult.phase_time_results || [],
                phaseResults: parsedResult.phase_results || [],
            };

            return { tickData, summary, perMonster: parsedResult.results };
        } catch (error) {
            console.error('WASM calculation error:', error);
            return {
                tickData: [],
                summary: {
                    ticksTimeToKill: 0,
                    secondsTimeToKill: 0,
                    phaseTimeResults: [],
                    phaseResults: [],
                }
            };
        }
    };
};