import init, { calculate_dps_with_objects_vasa } from '../wasm/vasa/vasa_wasm.js';
import wasmUrl from '../wasm/vasa/vasa_wasm_bg.wasm?url';
import { createWasmDpsLoader } from './wasmLoader';

const initVoid = async (options: any) => { await init(options); };

export const calculateDPSWithObjectsVasa = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_vasa
);