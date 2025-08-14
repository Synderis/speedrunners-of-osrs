declare module '../wasm/osrs_dps_wasm.js' {
  export default function init(input?: { module_or_path: string | URL | Request | BufferSource | WebAssembly.Module }): Promise<void>;

  export function weapon_and_thrall_kill_times(hp: number, max_hit: number, acc: number, cap: number): Float64Array;
  export function distribution_of_hits_to_kill(hp: number, max_hit: number, acc: number, cap: number): Float64Array;
  export function single_matrix(a: number, m: number, hp: number): Float64Array;
  export function npc_state(hp: number): Float64Array;
  export function hitting_basic_npc(hp: number, max_hit: number, acc: number, no_hits: number): Float64Array;
}

declare module '../wasm/osrs_dps_wasm_bg.wasm?url' {
  const url: string;
  export default url;
}