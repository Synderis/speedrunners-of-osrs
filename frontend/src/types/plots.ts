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
    maxDPS: number;
    avgDPS: number;
    accuracy: number;
    timeToKill: number;
    maxHit: number;
    effectiveStrength: number;
    effectiveAttack: number;
    maxAttackRoll: number;
    maxDefenceRoll: number;
}

export type MonsterResult = {
  attack_style: string;
  combat_type: string;
  expected_hits: number;
  expected_seconds: number;
  expected_ticks: number;
  kill_times: number[];
  monster_id: number;
  monster_name: string;
  // ...other fields
};

export type RoomResult = {
  tickData: PlotDataPoint[];
  summary: CalculationSummary;
  monsters: Record<number, MonsterResult>; // monster_id as key
};

export type AllResults = Record<string, RoomResult>; // room.id as key