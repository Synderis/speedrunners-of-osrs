import pandas as pd
import numpy as np

N_TRIALS = 100_000
TARGET = 2300

def sample_from_pmf(time_axis, pmf, n):
    return np.random.choice(time_axis, size=n, p=pmf)

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
    return full_t, pmf, full_c

if __name__ == "__main__":
    files = {
        "floor1": "floor1.csv", 
        "floor2": "floor2.csv", 
        "floor3": "floor3.csv", 
        "olm":    "olm.csv"
    }

    # Load PMFs and CDFs
    t1, pmf1, cdf1 = cdf_to_pmf(pd.read_csv(files["floor1"]))
    t2, pmf2, cdf2 = cdf_to_pmf(pd.read_csv(files["floor2"]))
    t3, pmf3, cdf3 = cdf_to_pmf(pd.read_csv(files["floor3"]))
    to, pmfo, cdfo = cdf_to_pmf(pd.read_csv(files["olm"]))

    # Monte Carlo sampling
    f1_times = sample_from_pmf(t1, pmf1, N_TRIALS)
    f2_times = sample_from_pmf(t2, pmf2, N_TRIALS)
    f3_times = sample_from_pmf(t3, pmf3, N_TRIALS)
    olm_times = sample_from_pmf(to, pmfo, N_TRIALS)

    total_times = f1_times + f2_times + f3_times + olm_times

    # Filter successful runs
    mask = total_times <= TARGET
    successful_f1 = f1_times[mask]
    successful_f12 = f1_times[mask] + f2_times[mask]
    successful_f123 = f1_times[mask] + f2_times[mask] + f3_times[mask]
    successful_total = total_times[mask]

    # Probability to reach each respective time (empirical)
    prob_f1 = np.array([np.mean(f1_times <= t) for t in successful_f1])
    prob_f12 = np.array([np.mean((f1_times + f2_times) <= t) for t in successful_f12])
    prob_f123 = np.array([np.mean((f1_times + f2_times + f3_times) <= t) for t in successful_f123])

    # Probability to complete under target given time remaining (using CDFs)
    # For each trial, remaining time after floor1, floor1+2, floor1+2+3
    remaining_after_f1 = TARGET - successful_f1
    remaining_after_f12 = TARGET - successful_f12
    remaining_after_f123 = TARGET - successful_f123

    # For floor1: need CDF of floor2+floor3+olm
    pmf_23o = np.convolve(np.convolve(pmf2, pmf3), pmfo)
    t_23o = np.arange(t2.min() + t3.min() + to.min(), t2.max() + t3.max() + to.max() + 1, dtype=int)
    cdf_23o = np.clip(np.cumsum(pmf_23o), 0.0, 1.0)
    prob_complete_after_f1 = np.interp(remaining_after_f1, t_23o, cdf_23o, left=0, right=1)

    # For floor1+2: need CDF of floor3+olm
    pmf_3o = np.convolve(pmf3, pmfo)
    t_3o = np.arange(t3.min() + to.min(), t3.max() + to.max() + 1, dtype=int)
    cdf_3o = np.clip(np.cumsum(pmf_3o), 0.0, 1.0)
    prob_complete_after_f12 = np.interp(remaining_after_f12, t_3o, cdf_3o, left=0, right=1)

    # For floor1+2+3: need CDF of olm
    prob_complete_after_f123 = np.interp(remaining_after_f123, to, cdfo, left=0, right=1)

    df = pd.DataFrame({
        "floor1": successful_f1,
        "prob_reach_floor1": prob_f1,
        "prob_complete_after_floor1": prob_complete_after_f1,
        "floor1_2": successful_f12,
        "prob_reach_floor1_2": prob_f12,
        "prob_complete_after_floor1_2": prob_complete_after_f12,
        "floor1_2_3": successful_f123,
        "prob_reach_floor1_2_3": prob_f123,
        "prob_complete_after_floor1_2_3": prob_complete_after_f123,
        "total": successful_total
    })
    df.to_csv("successful_mc_trials.csv", index=False)