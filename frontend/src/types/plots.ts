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