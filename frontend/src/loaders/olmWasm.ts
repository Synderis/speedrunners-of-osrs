import init, { calculate_dps_with_objects_olm } from '../wasm/olm/olm_wasm.js';
import wasmUrl from '../wasm/olm/olm_wasm_bg.wasm?url';
import { createWasmDpsLoader } from './wasmLoader';

// Wrap init to match the expected type (Promise<void>)
const initVoid = async (options: any) => { await init(options); };

export const calculateDPSWithObjectsOlm = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_olm
);