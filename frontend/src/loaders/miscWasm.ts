import init, {
    calculate_reset_thresholds_wasm
} from '../wasm/distribution_normalizer/distribution_normalizer_wasm.js';

import wasmUrl from '../wasm/distribution_normalizer/distribution_normalizer_wasm_bg.wasm?url';
import { createWasmThresholdsLoader } from './wasmLoader.js';

const initVoid = async (options: any) => { await init(options); };

export const calculateResetThresholds = createWasmThresholdsLoader(
    initVoid,
    wasmUrl,
    calculate_reset_thresholds_wasm
);