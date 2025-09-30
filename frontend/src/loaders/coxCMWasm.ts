import init, {
    calculate_dps_with_objects_tekton,
    calculate_dps_with_objects_ice_demon,
    calculate_dps_with_objects_guardians,
    calculate_dps_with_objects_mutta,
    calculate_dps_with_objects_vespula,
    calculate_dps_with_objects_mystics,
    calculate_dps_with_objects_olm,
    calculate_dps_with_objects_shamans,
    calculate_dps_with_objects_thieving,
    calculate_dps_with_objects_vangs,
    calculate_dps_with_objects_vasa,
} from '../wasm/cm_cox/cm_cox_wasm.js';
import wasmUrl from '../wasm/cm_cox/cm_cox_wasm_bg.wasm?url';
import { createWasmDpsLoader } from './wasmLoader.js';

const initVoid = async (options: any) => { await init(options); };

export const calculateDPSWithObjectsTekton = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_tekton
);

export const calculateDPSWithObjectsIceDemon = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_ice_demon
);

export const calculateDPSWithObjectsShamans = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_shamans
);

export const calculateDPSWithObjectsVangs = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_vangs
);

export const calculateDPSWithObjectsThieving = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_thieving
);

export const calculateDPSWithObjectsVespula = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_vespula
);

export const calculateDPSWithObjectsGuardians = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_guardians
);

export const calculateDPSWithObjectsVasa = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_vasa
);

export const calculateDPSWithObjectsMystics = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_mystics
);

export const calculateDPSWithObjectsMutta = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_mutta
);

export const calculateDPSWithObjectsOlm = createWasmDpsLoader(
    initVoid,
    wasmUrl,
    calculate_dps_with_objects_olm
);