/* tslint:disable */
/* eslint-disable */
export function single_matrix(a: number, m: number, hp: number): Float64Array;
export function npc_state(hp: number): Float64Array;
export function hitting_basic_npc(hp: number, max_hit: number, acc: number, no_hits: number): Float64Array;
export function distribution_of_hits_to_kill(hp: number, max_hit: number, acc: number, cap: number): Float64Array;
export function weapon_kill_times(hp: number, max_hit: number, acc: number, cap: number): Float64Array;
export function calculate_dps_with_objects_guardians(payload_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly single_matrix: (a: number, b: number, c: number) => [number, number];
  readonly npc_state: (a: number) => [number, number];
  readonly hitting_basic_npc: (a: number, b: number, c: number, d: number) => [number, number];
  readonly distribution_of_hits_to_kill: (a: number, b: number, c: number, d: number) => [number, number];
  readonly weapon_kill_times: (a: number, b: number, c: number, d: number) => [number, number];
  readonly calculate_dps_with_objects_guardians: (a: number, b: number) => [number, number];
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
