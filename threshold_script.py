import pandas as pd, numpy as np, argparse, json

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

def pmf_to_cdf(pmf): 
    return np.clip(np.cumsum(pmf), 0.0, 1.0)

def convolve_pmfs(a,b): 
    return np.convolve(a,b)

def prob_leq_time(time_axis, cdf, t_limit):
    if t_limit < time_axis[0]: return 0.0
    if t_limit >= time_axis[-1]: return float(cdf[-1])
    idx = np.searchsorted(time_axis, t_limit, side="right") - 1
    return float(cdf[idx])

def convolve_pmfs(a,b): 
    return np.convolve(a,b)

def compute(target, files):
    # Load per-stage CDFs and full raid CDF
    f1 = pd.read_csv(files["floor1"])  # time, prob
    f2 = pd.read_csv(files["floor2"])  # time, prob
    f3 = pd.read_csv(files["floor3"])  # time, prob
    fo = pd.read_csv(files["olm"])     # time, prob
    fr = pd.read_csv(files["raid"])    # time, prob (complete raid)

    # Convert to PMFs
    t1, pmf1 = cdf_to_pmf(f1)
    t2, pmf2 = cdf_to_pmf(f2)
    t3, pmf3 = cdf_to_pmf(f3)
    to, pmfo = cdf_to_pmf(fo)
    tr, pmfr = cdf_to_pmf(fr)

    # Build remaining-content PMFs via convolution
    # Remaining after Floor 1: F2 + F3 + Olm
    pmf_23o = convolve_pmfs(convolve_pmfs(pmf2, pmf3), pmfo)
    t_23o = np.arange(t2.min() + t3.min() + to.min(),
                      t2.max() + t3.max() + to.max() + 1, dtype=int)

    # Remaining after Floor 2: F3 + Olm
    pmf_3o = convolve_pmfs(pmf3, pmfo)
    t_3o = np.arange(t3.min() + to.min(),
                     t3.max() + to.max() + 1, dtype=int)

    # Remaining after Floor 3: Olm
    pmf_o = pmfo
    t_o = to

    # Elapsed supports for checkpoints (finish-time supports of cumulative stages)
    # End of Floor 1 (E1): support = t1
    # End of Floor 2 (E2): support = t1 + t2 (pmf12)
    pmf12 = convolve_pmfs(pmf1, pmf2)
    t12 = np.arange(t1.min() + t2.min(), t1.max() + t2.max() + 1, dtype=int)
    # End of Floor 3 (E3): support = t1 + t2 + t3 (pmf123)
    pmf123 = convolve_pmfs(pmf12, pmf3)
    t123 = np.arange(t12.min() + t3.min(), t12.max() + t3.max() + 1, dtype=int)

    # CDFs for remaining segments and full raid
    cdf_23o = pmf_to_cdf(pmf_23o)
    cdf_3o  = pmf_to_cdf(pmf_3o)
    cdf_o   = pmf_to_cdf(pmf_o)
    cdfr    = pmf_to_cdf(pmfr)

    # Baseline: success prob if restarting now
    p_restart = prob_leq_time(tr, cdfr, target)

    # ----- Floor 1 checkpoint -----
    E1_candidates = np.arange(t1.min(), t1.max()+1, dtype=int)
    cont_f1 = np.array([prob_leq_time(t_23o, cdf_23o, target - E1) for E1 in E1_candidates])
    mask1 = cont_f1 >= p_restart
    if mask1.any():
        E1_thr = int(E1_candidates[mask1].max()) + 1
        rule1 = "continue if E1 < threshold; reset if E1 >= threshold"
    else:
        E1_thr = None
        rule1 = "reset always"

    # ----- Floor 2 checkpoint -----
    E2_candidates = np.arange(t12.min(), t12.max()+1, dtype=int)
    cont_f2 = np.array([prob_leq_time(t_3o, cdf_3o, target - E2) for E2 in E2_candidates])
    mask2 = cont_f2 >= p_restart
    if mask2.any():
        E2_thr = int(E2_candidates[mask2].max()) + 1
        rule2 = "continue if total E2 less than threshold; reset if E2 > threshold"
    else:
        E2_thr = None
        rule2 = "reset always" if (cont_f2 < p_restart).all() else "never reset"

    # ----- Floor 3 (entering Olm) checkpoint -----
    E3_candidates = np.arange(t123.min(), t123.max()+1, dtype=int)
    cont_f3 = np.array([prob_leq_time(t_o, cdf_o, target - E3) for E3 in E3_candidates])
    mask3 = cont_f3 >= p_restart
    if mask3.any():
        E3_thr = int(E3_candidates[mask3].max()) + 1
        rule3 = "continue if total E3 less than threshold; reset if E3 > threshold"
    else:
        E3_thr = None
        rule3 = "reset always" if (cont_f3 < p_restart).all() else "never reset"

    # At end of floor 1
    thresholds = []
    for idx, e1 in enumerate(t1):
        p_opt = optimal_prob_at_checkpoint(
            elapsed=e1,
            remaining_pmfs=[pmf2, pmf3, pmfo],
            remaining_times=[t2, t3, to],
            target=target,
            p_restart=p_restart
        )
        thresholds.append((e1, p_opt))
    # Find the threshold where it's optimal to continue
    print(thresholds)

    return {
        "input_target": int(target),
        "p_success_if_restart_now": float(p_restart),
        "floor1_checkpoint": {"elapsed_threshold": E1_thr, "decision_rule": rule1},
        "floor2_checkpoint": {"total_elapsed_threshold": E2_thr, "decision_rule": rule2},
        "floor3_checkpoint_EnterOlm": {"total_elapsed_threshold": E3_thr, "decision_rule": rule3},
        "notes": "Thresholds compare continue-vs-restart probabilities at target T. A mid-Olm threshold would need per-phase CDFs."
    }

def optimal_prob_at_checkpoint(elapsed, remaining_pmfs, remaining_times, target, p_restart):
    """
    Recursively compute the optimal probability of success from this checkpoint.
    elapsed: elapsed time so far
    remaining_pmfs: list of PMFs for remaining stages
    remaining_times: list of time axes for remaining stages
    target: target raid time
    p_restart: probability of success if restarting now
    """
    if not remaining_pmfs:
        # No stages left, already at the end
        return 1.0 if elapsed <= target else 0.0

    # Option 1: Continue now
    # Convolve remaining PMFs to get total remaining distribution
    total_pmf = remaining_pmfs[0]
    total_time = remaining_times[0]
    for pmf, t in zip(remaining_pmfs[1:], remaining_times[1:]):
        total_pmf = convolve_pmfs(total_pmf, pmf)
        total_time = np.arange(total_time.min() + t.min(), total_time.max() + t.max() + 1, dtype=int)
    total_cdf = pmf_to_cdf(total_pmf)
    p_continue = prob_leq_time(total_time, total_cdf, target - elapsed)

    # Option 2: Reset now
    p_reset_now = p_restart

    # Option 3: Reset at next checkpoint (if there is one)
    if len(remaining_pmfs) > 1:
        # For each possible time at the next checkpoint, compute optimal probability
        next_pmf = remaining_pmfs[0]
        next_time = remaining_times[0]
        best_p = 0.0
        for idx, t_next in enumerate(next_time):
            # Elapsed if we reach next checkpoint: elapsed + t_next
            # Remaining stages: remaining_pmfs[1:]
            p_next = optimal_prob_at_checkpoint(
                elapsed + t_next,
                remaining_pmfs[1:],
                remaining_times[1:],
                target,
                p_restart
            )
            # Weight by probability of reaching t_next
            best_p += next_pmf[idx] * max(p_next, p_reset_now)
        p_future_reset = best_p
    else:
        p_future_reset = p_continue

    # Return the best option
    return max(p_continue, p_reset_now, p_future_reset)

def write_cumulative_csvs(files):
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

    # Floor 1 + Floor 2 + Floor 3
    pmf123 = convolve_pmfs(convolve_pmfs(pmf1, pmf2), pmf3)
    t123 = np.arange(t1.min() + t2.min() + t3.min(), t1.max() + t2.max() + t3.max() + 1, dtype=int)
    cdf123 = pmf_to_cdf(pmf123)
    df123 = pd.DataFrame({"time": t123, "probability": cdf123})
    df123.to_csv("floor1_plus_floor2_plus_floor3.csv", index=False)

    # # Floor 3 + Olm (unchanged)
    # pmf3o = convolve_pmfs(pmf3, pmfo)
    # t3o = np.arange(t3.min() + to.min(), t3.max() + to.max() + 1, dtype=int)
    # cdf3o = pmf_to_cdf(pmf3o)
    # df3o = pd.DataFrame({"time": t3o, "probability": cdf3o})
    # df3o.to_csv("floor3_plus_olm.csv", index=False)

def expected_time_under_threshold(time_axis, pmf, threshold):
    mask = time_axis <= threshold
    if not mask.any():
        return None
    return np.sum(time_axis[mask] * pmf[mask]) / pmf[mask].sum()

def compute_expected_time(target, thresholds, t1, pmf1, t2, pmf2, t3, pmf3, to, pmfo):
    # Convolve PMFs for cumulative stages
    pmf12 = convolve_pmfs(pmf1, pmf2)
    t12 = np.arange(t1.min() + t2.min(), t1.max() + t2.max() + 1, dtype=int)
    pmf123 = convolve_pmfs(pmf12, pmf3)
    t123 = np.arange(t12.min() + t3.min(), t12.max() + t3.max() + 1, dtype=int)
    pmf123o = convolve_pmfs(pmf123, pmfo)
    t123o = np.arange(t123.min() + to.min(), t123.max() + to.max() + 1, dtype=int)

    # T(0): expected time to finish under target with no resets
    mask0 = t123o <= target
    T0 = np.sum(t123o[mask0] * pmf123o[mask0]) / pmf123o[mask0].sum()

    # T(1): expected time with reset at R1
    R1 = thresholds[0]
    mask1 = t1 <= R1
    # Probability of reaching R1
    p_reach_R1 = pmf1[mask1].sum()
    # Expected time to reach R1
    E_R1 = np.sum(t1[mask1] * pmf1[mask1]) / p_reach_R1 if p_reach_R1 > 0 else 0
    # Expected time for rest of raid if reached R1
    pmf_rest1 = convolve_pmfs(convolve_pmfs(pmf2, pmf3), pmfo)
    t_rest1 = np.arange(t2.min() + t3.min() + to.min(), t2.max() + t3.max() + to.max() + 1, dtype=int)
    mask_rest1 = t_rest1 <= (target - R1)
    T_rest1 = np.sum(t_rest1[mask_rest1] * pmf_rest1[mask_rest1]) / pmf_rest1[mask_rest1].sum() if pmf_rest1[mask_rest1].sum() > 0 else 0
    # Expected time if reset at R1
    T1 = p_reach_R1 * (E_R1 + T_rest1) + (1 - p_reach_R1) * T0

    # T(2): expected time with resets at R1 and R2
    R2 = thresholds[1]
    # Similar logic: probability and expected time to reach R2, then rest of raid, etc.
    # (You can expand this for more checkpoints as needed.)

    # T(3): expected time with resets at R1, R2, R3
    R3 = thresholds[2]
    # Similar logic...

    return T0, T1, R1, T_rest1, p_reach_R1

def backward_optimize_thresholds(target, t1, pmf1, t2, pmf2, t3, pmf3, to, pmfo):
    # Start with dummy thresholds
    thresholds = [550, 1050, 1600]
    # Forward compute expected times
    T0, T1, R1, T_rest1, p_reach_R1 = compute_expected_time(target, thresholds, t1, pmf1, t2, pmf2, t3, pmf3, to, pmfo)
    # Backward solve for optimal thresholds using your equations
    # For example, for R3:
    # T3 * prob[raid time < TT | threshold R3 reached] = TT - R3
    # You can use root finding or grid search to solve for R3, then R2, then R1

    # This is a scaffold; you can expand with more detailed logic as needed.
    print(f"T0 (no resets): {T0}")
    print(f"T1 (reset at R1={R1}): {T1}")
    print(f"Probability reach R1: {p_reach_R1}")
    print(f"Expected time for rest after R1: {T_rest1}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="CoX reset thresholds given target time (with explicit Olm stage)")
    ap.add_argument("--target", type=int, help="Target raid time (same units as CSV 'time')")
    ap.add_argument("--floor1", default="floor1.csv")
    ap.add_argument("--floor2", default="floor2.csv")
    ap.add_argument("--floor3", default="floor3.csv")
    ap.add_argument("--olm",    default="olm.csv")
    ap.add_argument("--raid",   default="complete_raid.csv")
    args = ap.parse_args()
    files = {
        "floor1": args.floor1, 
        "floor2": args.floor2, 
        "floor3": args.floor3, 
        "olm":    args.olm, 
        "raid":   args.raid
    }
    target = args.target
    files = {
        "floor1": "floor1.csv", 
        "floor2": "floor2.csv", 
        "floor3": "floor3.csv", 
        "olm":    "olm.csv", 
        "raid":   "complete_raid.csv"
    }
    target = 2300
    # write_cumulative_csvs(files)
    out = compute(target, files)
    print(json.dumps(out, indent=2))