import init, { calculate_dps_with_objects_tekton } from '../wasm/tekton/tekton_wasm.js';
import wasmUrl from '../wasm/tekton/tekton_wasm_bg.wasm?url';
import { createWasmDpsLoader } from './wasmLoader';

// Wrap init to match the expected type (Promise<void>)
const initVoid = async (options: any) => { await init(options); };

export const calculateDPSWithObjectsTekton = createWasmDpsLoader(
  initVoid,
  wasmUrl,
  calculate_dps_with_objects_tekton
);