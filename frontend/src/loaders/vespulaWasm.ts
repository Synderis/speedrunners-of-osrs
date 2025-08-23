import init, { calculate_dps_with_objects_vespula } from '../wasm/vespula/vespula_wasm.js';
import wasmUrl from '../wasm/vespula/vespula_wasm_bg.wasm?url';
import { createWasmDpsLoader } from './wasmLoader';

// Wrap init to match the expected type (Promise<void>)
const initVoid = async (options: any) => { await init(options); };

export const calculateDPSWithObjectsVespula = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_vespula
);