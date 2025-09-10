import init, { calculate_dps_with_objects_mutta } from '../wasm/mutta/mutta_wasm.js';
import wasmUrl from '../wasm/mutta/mutta_wasm_bg.wasm?url';
import { createWasmDpsLoader } from './wasmLoader';

// Wrap init to match the expected type (Promise<void>)
const initVoid = async (options: any) => { await init(options); };

export const calculateDPSWithObjectsMutta = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_mutta
);