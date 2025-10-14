import pandas as pd
import numpy as np

TARGET = 2300

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

def convolve_pmfs(a, b):
    return np.convolve(a, b)

def find_analytical_thresholds(target, t1, pmf1, cdf1, t2, pmf2, t3, pmf3, to, pmfo, cdfo):
    # Build convolved CDFs for remaining stages
    # Floor2+3+Olm
    pmf_23o = convolve_pmfs(convolve_pmfs(pmf2, pmf3), pmfo)
    t_23o = np.arange(t2.min() + t3.min() + to.min(), t2.max() + t3.max() + to.max() + 1, dtype=int)
    cdf_23o = np.clip(np.cumsum(pmf_23o), 0.0, 1.0)
    
    # Floor3+Olm  
    pmf_3o = convolve_pmfs(pmf3, pmfo)
    t_3o = np.arange(t3.min() + to.min(), t3.max() + to.max() + 1, dtype=int)
    cdf_3o = np.clip(np.cumsum(pmf_3o), 0.0, 1.0)
    
    # Floor1+2
    pmf_12 = convolve_pmfs(pmf1, pmf2)
    t_12 = np.arange(t1.min() + t2.min(), t1.max() + t2.max() + 1, dtype=int)
    cdf_12 = np.clip(np.cumsum(pmf_12), 0.0, 1.0)
    
    # Floor1+2+3
    pmf_123 = convolve_pmfs(pmf_12, pmf3)
    t_123 = np.arange(t_12.min() + t3.min(), t_12.max() + t3.max() + 1, dtype=int)
    cdf_123 = np.clip(np.cumsum(pmf_123), 0.0, 1.0)
    
    # Find thresholds where prob_reach <= prob_complete_remaining
    
    # Floor 1 threshold
    prob_complete_after_f1 = np.interp(target - t1, t_23o, cdf_23o, left=0, right=1)
    mask1 = cdf1 <= prob_complete_after_f1
    floor_1_threshold = t1[mask1].max() if mask1.any() else t1.min()
    
    # Floor 1+2 threshold  
    prob_complete_after_f12 = np.interp(target - t_12, t_3o, cdf_3o, left=0, right=1)
    mask12 = cdf_12 <= prob_complete_after_f12
    floor_12_threshold = t_12[mask12].max() if mask12.any() else t_12.min()
    
    # Floor 1+2+3 threshold
    prob_complete_after_f123 = np.interp(target - t_123, to, cdfo, left=0, right=1)
    mask123 = cdf_123 <= prob_complete_after_f123
    floor_123_threshold = t_123[mask123].max() if mask123.any() else t_123.min()
    
    return floor_1_threshold, floor_12_threshold, floor_123_threshold

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

    floor_1_threshold, floor_12_threshold, floor_123_threshold = find_analytical_thresholds(
        TARGET, t1, pmf1, cdf1, t2, pmf2, t3, pmf3, to, pmfo, cdfo
    )
    
    print(f"Floor 1 threshold: {floor_1_threshold} ticks ({floor_1_threshold * 0.6:.2f} seconds)")
    print(f"Floor 1+2 threshold: {floor_12_threshold} ticks ({floor_12_threshold * 0.6:.2f} seconds)")
    print(f"Floor 1+2+3 threshold: {floor_123_threshold} ticks ({floor_123_threshold * 0.6:.2f} seconds)")