export interface PlotDataPoint {
    time: number;
    probability: number;
}

export interface CalculationSummary {
    ticksTimeToKill: number;
    secondsTimeToKill: number;
    phaseTimeResults?: any[];
    phaseResults: any[];
}

type WasmInit = (options: any) => Promise<void>;
type WasmCalc = (payload: string) => string;
type WasmThresholdsCalc = (payload: string) => string;

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
            if (parsedResult.error) {
                console.error("WASM error string:", parsedResult.error);
                throw new Error(parsedResult.error);
            }
            console.log("WASM parsed result:", parsedResult.results);
            // console.log("WASM parsed encounter kill times:", parsedResult.debug_trials);

            const tickData: PlotDataPoint[] = (parsedResult.encounter_kill_times || []).map((pt: any) => ({
                time: pt.tick,
                probability: pt.probability
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


export interface ThresholdInfo {
    threshold: number | null;
}

export interface ThresholdResults {
    input_target: number;
    thresholds: {
        [floorId: string]: ThresholdInfo;
    };
}

export const createWasmThresholdsLoader = (
    init: WasmInit,
    wasmUrl: string,
    calcFn: WasmThresholdsCalc
) => {
    let wasmInitialized = false;

    const initWasm = async () => {
        if (!wasmInitialized) {
            await init({ module_or_path: wasmUrl });
            wasmInitialized = true;
        }
    };

    return async (
        targetTicks: number,
        floor1: PlotDataPoint[],
        floor2: PlotDataPoint[],
        floor3: PlotDataPoint[],
        olm: PlotDataPoint[],
        raidTotal: PlotDataPoint[]
    ): Promise<ThresholdResults | null> => {
        await initWasm();
        console.log('Calling WASM threshold function...');
        try {
            const payload = {
                target_ticks: targetTicks,
                floor1,
                floor2,
                floor3,
                olm,
                raid_total: raidTotal
            };
            const result = calcFn(JSON.stringify(payload));
            const parsedResult: ThresholdResults = JSON.parse(result);

            return parsedResult;
        } catch (error) {
            console.error('WASM threshold calculation error:', error);
            return null;
        }
    };
};