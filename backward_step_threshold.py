import pandas as pd, numpy as np

def cdf_to_pmf(df):
    t = df["time"].to_numpy(dtype=int)
    c = df["probability"].to_numpy(dtype=float)
    c = np.clip(np.maximum.accumulate(c), 0.0, 1.0)
    full_t = np.arange(int(t.min()), int(t.max()) + 1, dtype=int)
    full_c = np.interp(full_t, t, c, left=c[0], right=c[-1])
    pmf = np.diff(np.concatenate([[0.0], full_c]))
    pmf = np.clip(pmf, 0.0, None)
    s = pmf.sum()
    if s > 0:
        pmf /= s
    return full_t, pmf

def expected_time_under_threshold(time_axis, pmf, threshold):
    mask = time_axis <= threshold
    if not mask.any():
        return None
    return np.sum(time_axis[mask] * pmf[mask]) / pmf[mask].sum()

def convolve_pmfs(a,b): 
    return np.convolve(a,b)

def recursive_expected_time(stage_pmfs, stage_times, thresholds, target, T0):
    """
    Recursively compute expected time given thresholds at each checkpoint.
    stage_pmfs: list of pmfs for each stage
    stage_times: list of time axes for each stage
    thresholds: list of thresholds [R1, R2, R3]
    target: target time
    T0: expected time for full run (no resets)
    """
    # Base case: last checkpoint (Olm)
    if len(stage_pmfs) == 1:
        t = stage_times[0]
        pmf = stage_pmfs[0]
        if thresholds:
            threshold = thresholds[-1]
            mask = t <= (target - threshold)
            p_success = pmf[mask].sum()
            T_success = expected_time_under_threshold(t, pmf, target - threshold)
            T_fail = T0
            T = p_success * (target - threshold) + (1 - p_success) * (target - threshold + T0)
        else:
            # No thresholds left, just use target
            mask = t <= target
            p_success = pmf[mask].sum()
            T_success = expected_time_under_threshold(t, pmf, target)
            T_fail = T0
            T = p_success * target + (1 - p_success) * (target + T0)
        return T

    # Recursive case: more checkpoints
    t = stage_times[0]
    pmf = stage_pmfs[0]
    threshold = thresholds[0]
    mask = t <= threshold
    p_reach = pmf[mask].sum()
    E_reach = np.sum(t[mask] * pmf[mask]) / p_reach if p_reach > 0 else 0

    # Expected time if reach threshold and continue
    T_continue = recursive_expected_time(stage_pmfs[1:], stage_times[1:], thresholds[1:], target, T0)
    # Expected time if reset
    T_reset = T0

    # Total expected time at this checkpoint
    T = p_reach * (E_reach + T_continue) + (1 - p_reach) * T_reset
    return T

def backward_optimize_thresholds(target, t1, pmf1, t2, pmf2, t3, pmf3, to, pmfo):
    # Compute T0 (no resets)
    pmf123 = convolve_pmfs(convolve_pmfs(pmf1, pmf2), pmf3)
    t123 = np.arange(t1.min() + t2.min() + t3.min(), t1.max() + t2.max() + t3.max() + 1, dtype=int)
    pmf123o = convolve_pmfs(pmf123, pmfo)
    t123o = np.arange(t123.min() + to.min(), t123.max() + to.max() + 1, dtype=int)
    mask0 = t123o <= target
    T0 = np.sum(t123o[mask0] * pmf123o[mask0]) / pmf123o[mask0].sum()

    # Optimize thresholds recursively
    best_thresholds = [None, None, None]
    best_T = float('inf')
    # Grid search over possible thresholds
    for R1 in t1:
        for R2 in t2:
            for R3 in t3:
                thresholds = [R1, R2, R3]
                stage_pmfs = [pmf1, pmf2, pmf3, pmfo]
                stage_times = [t1, t2, t3, to]
                T = recursive_expected_time(stage_pmfs, stage_times, thresholds, target, T0)
                # Find thresholds where expected time for continue equals reset (or is minimized)
                if T < best_T:
                    best_T = T
                    best_thresholds = [R1, R2, R3]
    print(f"Optimal thresholds: R1={best_thresholds[0]}, R2={best_thresholds[1]}, R3={best_thresholds[2]}")
    print(f"Expected time: {best_T}")
    return {
        "T0": T0,
        "R1": int(best_thresholds[0]),
        "R2": int(best_thresholds[1]),
        "R3": int(best_thresholds[2]),
        "ExpectedTime": best_T
    }

if __name__ == "__main__":
    files = {
        "floor1": "floor1.csv", 
        "floor2": "floor2.csv", 
        "floor3": "floor3.csv", 
        "olm":    "olm.csv"
    }
    target = 2300

    # Load per-stage CDFs
    f1 = pd.read_csv(files["floor1"])
    f2 = pd.read_csv(files["floor2"])
    f3 = pd.read_csv(files["floor3"])
    fo = pd.read_csv(files["olm"])

    # Convert to PMFs
    t1, pmf1 = cdf_to_pmf(f1)
    t2, pmf2 = cdf_to_pmf(f2)
    t3, pmf3 = cdf_to_pmf(f3)
    to, pmfo = cdf_to_pmf(fo)

    result = backward_optimize_thresholds(target, t1, pmf1, t2, pmf2, t3, pmf3, to, pmfo)
    print(result)