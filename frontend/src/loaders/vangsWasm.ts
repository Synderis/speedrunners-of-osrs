import init, { calculate_dps_with_objects_vangs } from '../wasm/vangs/vangs_wasm.js';
import wasmUrl from '../wasm/vangs/vangs_wasm_bg.wasm?url';
import { createWasmDpsLoader } from './wasmLoader';

// Wrap init to match the expected type (Promise<void>)
const initVoid = async (options: any) => { await init(options); };

export const calculateDPSWithObjectsVangs = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_vangs
);