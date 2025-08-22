import init, {
  calculate_dps_with_objects_tekton
} from '../wasm/tekton/tekton_wasm.js';
import wasmUrl from '../wasm/tekton/tekton_wasm_bg.wasm?url';

let wasmInitialized = false;

export const initWasm = async () => {
  if (!wasmInitialized) {
    await init({ module_or_path: wasmUrl });
    wasmInitialized = true;
  }
};

export interface PlotDataPoint {
  time: number;
  dps: number;
  accuracy: number;
}

export interface HitDataPoint {
  hits: number;
  probability: number;
}

export interface CalculationSummary {
  expectedHit: number;
  expectedHits: number;
  accuracy: number;
  ticksTimeToKill: number;
  secondsTimeToKill: number;
  maxHit: number;
  effectiveStrength: number;
  effectiveAttack: number;
  maxAttackRoll: number;
  maxDefenceRoll: number;
}

// New function that accepts a single payload object
export const calculateDPSWithObjectsTekton = async (player: any, room: any, cap: number = 0.9999) => {
  await initWasm();
  
  // Package everything into a single payload object
  const payload = {
    player,
    room,
    config: {
      cap
    }
  };
  
  console.log('Sending payload to WASM:', payload);
  
  try {
    console.log('✅ Using calculate_dps_with_objects function');
    
    const result = calculate_dps_with_objects_tekton(
      JSON.stringify(payload)  // Pass single JSON string
    );
    
    console.log('WASM result:', result);
    
    const parsedResult = JSON.parse(result);
    
    if (parsedResult.error) {
      throw new Error(parsedResult.error);
    }
    
    // Convert kill times to plot data
    const tickData: PlotDataPoint[] = (parsedResult.encounter_kill_times || []).map((pt: any) => ({
      time: pt.tick,
      dps: pt.probability,
      accuracy: 0
    }));
    
    // Calculate summary statistics
    const summary: CalculationSummary = {
        expectedHit: 0, // Not meaningful for the whole encounter
        expectedHits: parsedResult.total_hits,
        accuracy: 0, // Not meaningful for the whole encounter
        ticksTimeToKill: parsedResult.total_expected_ticks,
        secondsTimeToKill: parsedResult.total_expected_seconds,
        maxHit: 0,
        effectiveStrength: 0,
        effectiveAttack: 0,
        maxAttackRoll: 0,
        maxDefenceRoll: 0,
    };
    
    return {
      tickData,
      summary
    };
  } catch (error) {
    console.error('WASM calculation error, falling back to legacy calculation:', error);
    console.error('Make sure to run: npm run build:wasm');

    return {
            tickData: [],
            hitData: [],
            summary: {
                expectedHit: 0,
                expectedHits: 0,
                accuracy: 0.8 * 100,
                ticksTimeToKill: 0,
                secondsTimeToKill: 0,
                maxHit: 50,
                effectiveStrength: 0,
                effectiveAttack: 0,
                maxAttackRoll: 0,
                maxDefenceRoll: 0,
            }
        };
  }
};