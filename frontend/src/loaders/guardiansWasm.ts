import init, { calculate_dps_with_objects_guardians } from '../wasm/guardians/guardians_wasm.js';
import wasmUrl from '../wasm/tekton/tekton_wasm_bg.wasm?url';
import { createWasmDpsLoader } from './wasmLoader';

// Wrap init to match the expected type (Promise<void>)
const initVoid = async (options: any) => { await init(options); };

export const calculateDPSWithObjectsGuardians = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_guardians
);