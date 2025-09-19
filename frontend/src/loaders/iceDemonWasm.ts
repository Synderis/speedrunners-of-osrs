import init, { calculate_dps_with_objects_ice_demon } from '../wasm/ice_demon/ice_demon_wasm.js';
import wasmUrl from '../wasm/ice_demon/ice_demon_wasm_bg.wasm?url';
import { createWasmDpsLoader } from './wasmLoader';

// Wrap init to match the expected type (Promise<void>)
const initVoid = async (options: any) => { await init(options); };

export const calculateDPSWithObjectsIceDemon = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_ice_demon
);