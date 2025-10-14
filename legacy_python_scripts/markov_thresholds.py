import pandas as pd
import numpy as np

TARGET = 2300

def cdf_to_full(t, c):
    t = np.array(t, dtype=int)
    c = np.array(c, dtype=float)
    c = np.clip(np.maximum.accumulate(c), 0.0, 1.0)
    full_t = np.arange(int(t.min()), int(t.max()) + 1, dtype=int)
    full_c = np.interp(full_t, t, c, left=c[0], right=c[-1])
    return full_t, full_c

def find_threshold(times, prob_reach, prob_complete):
    mask = prob_reach <= prob_complete
    if np.any(mask):
        return times[mask].max()
    return None

if __name__ == "__main__":
    files = {
        "floor1": "floor1.csv", 
        "floor2": "floor2.csv", 
        "floor3": "floor3.csv", 
        "olm":    "olm.csv"
    }

    # Load CDFs
    t1, cdf1 = cdf_to_full(*pd.read_csv(files["floor1"])[["time", "probability"]].values.T)
    t2, cdf2 = cdf_to_full(*pd.read_csv(files["floor2"])[["time", "probability"]].values.T)
    t3, cdf3 = cdf_to_full(*pd.read_csv(files["floor3"])[["time", "probability"]].values.T)
    to, cdfo = cdf_to_full(*pd.read_csv(files["olm"])[["time", "probability"]].values.T)

    # Convolve for remaining floors
    pmf1 = np.diff(np.concatenate([[0.0], cdf1]))
    pmf2 = np.diff(np.concatenate([[0.0], cdf2]))
    pmf3 = np.diff(np.concatenate([[0.0], cdf3]))
    pmfo = np.diff(np.concatenate([[0.0], cdfo]))

    # Floor 2 + 3 + olm
    pmf_23o = np.convolve(np.convolve(pmf2, pmf3), pmfo)
    t_23o = np.arange(t2.min() + t3.min() + to.min(), t2.max() + t3.max() + to.max() + 1, dtype=int)
    cdf_23o = np.clip(np.cumsum(pmf_23o), 0.0, 1.0)

    # Floor 3 + olm
    pmf_3o = np.convolve(pmf3, pmfo)
    t_3o = np.arange(t3.min() + to.min(), t3.max() + to.max() + 1, dtype=int)
    cdf_3o = np.clip(np.cumsum(pmf_3o), 0.0, 1.0)

    # Thresholds
    # Floor 1
    remaining_after_f1 = TARGET - t1
    prob_complete_after_f1 = np.interp(remaining_after_f1, t_23o, cdf_23o, left=0, right=1)
    # Only consider times where prob_reach > 0 (i.e., possible in simulation)
    possible_mask = pmf1 > 0
    floor_1_threshold = find_threshold(t1[possible_mask], cdf1[possible_mask], prob_complete_after_f1[possible_mask])

    # Floor 1+2
    t1_grid, t2_grid = np.meshgrid(t1, t2, indexing='ij')
    t12 = (t1_grid + t2_grid).flatten()
    pmf12 = (np.outer(pmf1, pmf2)).flatten()
    total_time_12 = t12 + t3.min() + to.min()
    valid_mask = total_time_12 <= TARGET
    t12_valid = t12[valid_mask]
    pmf12_valid = pmf12[valid_mask]

    # For each valid t12, calculate prob_reach (sum of pmf12 up to t12)
    sort_idx = np.argsort(t12_valid)
    t12_sorted = t12_valid[sort_idx]
    pmf12_sorted = pmf12_valid[sort_idx]
    prob_reach = np.cumsum(pmf12_sorted)

    remaining_after_f12 = TARGET - t12_sorted
    prob_complete_after_f12 = np.interp(remaining_after_f12, t_3o, cdf_3o, left=0, right=1)

    threshold_mask = prob_reach <= prob_complete_after_f12
    if np.any(threshold_mask):
        floor_1_2_threshold = t12_sorted[threshold_mask].max()
    else:
        floor_1_2_threshold = None

    # Floor 1+2+3
    t1_grid, t2_grid, t3_grid = np.meshgrid(t1, t2, t3, indexing='ij')
    t123 = (t1_grid + t2_grid + t3_grid).flatten()
    pmf123 = (np.outer(np.outer(pmf1, pmf2), pmf3)).flatten()
    total_time_123 = t123 + to.min()
    valid_mask = total_time_123 <= TARGET
    t123_valid = t123[valid_mask]
    pmf123_valid = pmf123[valid_mask]

    # For each valid t123, calculate prob_reach (sum of pmf123 up to t123)
    sort_idx = np.argsort(t123_valid)
    t123_sorted = t123_valid[sort_idx]
    pmf123_sorted = pmf123_valid[sort_idx]
    prob_reach = np.cumsum(pmf123_sorted)

    remaining_after_f123 = TARGET - t123_sorted
    prob_complete_after_f123 = np.interp(remaining_after_f123, to, cdfo, left=0, right=1)

    threshold_mask = prob_reach <= prob_complete_after_f123
    if np.any(threshold_mask):
        floor_1_2_3_threshold = t123_sorted[threshold_mask].max()
    else:
        floor_1_2_3_threshold = None

    print("Floor 1 threshold:", floor_1_threshold)
    print("Floor 1+2 threshold:", floor_1_2_threshold)
    print("Floor 1+2+3 threshold:", floor_1_2_3_threshold)