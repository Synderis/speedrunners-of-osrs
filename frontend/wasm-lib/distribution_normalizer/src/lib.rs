use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json;
use rand::prelude::*;

const N_TRIALS: usize = 100_000;

#[derive(Deserialize)]
pub struct PlotDataPoint {
    pub time: u32,
    pub probability: f64,
}

#[derive(Serialize)]
pub struct ThresholdResult {
    pub input_target: u32,
    pub thresholds: std::collections::HashMap<String, ThresholdInfo>,
}

#[derive(Serialize)]
pub struct ThresholdInfo {
    pub threshold: Option<u32>,
}

#[derive(Deserialize)]
pub struct ThresholdInput {
    pub target_ticks: u32,
    pub floor1: Vec<PlotDataPoint>,
    pub floor2: Vec<PlotDataPoint>,
    pub floor3: Vec<PlotDataPoint>,
    pub olm: Vec<PlotDataPoint>,
    pub raid_total: Vec<PlotDataPoint>,
}

fn cdf_to_pmf(data: &[PlotDataPoint]) -> (Vec<u32>, Vec<f64>, Vec<f64>) {
    let times: Vec<u32> = data.iter().map(|d| d.time).collect();
    let mut probs: Vec<f64> = data.iter().map(|d| d.probability).collect();
    // Ensure monotonic
    for i in 1..probs.len() {
        if probs[i] < probs[i - 1] {
            probs[i] = probs[i - 1];
        }
    }
    let min_t = *times.iter().min().unwrap();
    let max_t = *times.iter().max().unwrap();
    let full_t: Vec<u32> = (min_t..=max_t).collect();
    let mut full_c = Vec::with_capacity(full_t.len());
    for &t in &full_t {
        // Linear interpolation
        let mut idx = 0;
        while idx < times.len() - 1 && times[idx + 1] <= t {
            idx += 1;
        }
        full_c.push(probs[idx]);
    }
    let mut pmf = Vec::with_capacity(full_c.len());
    pmf.push(full_c[0]);
    for i in 1..full_c.len() {
        pmf.push((full_c[i] - full_c[i - 1]).max(0.0));
    }
    let s: f64 = pmf.iter().sum();
    if s > 0.0 {
        for p in pmf.iter_mut() {
            *p /= s;
        }
    }
    (full_t, pmf, full_c)
}

fn sample_from_pmf(time_axis: &[u32], pmf: &[f64], n: usize) -> Vec<u32> {
    let mut rng = thread_rng();
    let dist = rand::distributions::WeightedIndex::new(pmf).unwrap();
    (0..n).map(|_| time_axis[dist.sample(&mut rng)]).collect()
}

fn convolve_pmfs(a: &[f64], b: &[f64]) -> Vec<f64> {
    let mut result = vec![0.0; a.len() + b.len() - 1];
    for i in 0..a.len() {
        for j in 0..b.len() {
            result[i + j] += a[i] * b[j];
        }
    }
    result
}

#[wasm_bindgen]
pub fn calculate_reset_thresholds_wasm(input: &str) -> String {
    let parsed: ThresholdInput = match serde_json::from_str(input) {
        Ok(val) => val,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let target_ticks = parsed.target_ticks;
    let (t1, pmf1, _cdf1) = cdf_to_pmf(&parsed.floor1);
    let (t2, pmf2, _cdf2) = cdf_to_pmf(&parsed.floor2);
    let (t3, pmf3, _cdf3) = cdf_to_pmf(&parsed.floor3);
    let (to, pmfo, cdfo) = cdf_to_pmf(&parsed.olm);
    let (_tr, _pmfr, _cdfr) = cdf_to_pmf(&parsed.raid_total);

    // Monte Carlo sampling
    let f1_times = sample_from_pmf(&t1, &pmf1, N_TRIALS);
    let f2_times = sample_from_pmf(&t2, &pmf2, N_TRIALS);
    let f3_times = sample_from_pmf(&t3, &pmf3, N_TRIALS);
    let olm_times = sample_from_pmf(&to, &pmfo, N_TRIALS);

    let total_times: Vec<u32> = f1_times.iter().zip(&f2_times).zip(&f3_times).zip(&olm_times)
        .map(|(((a, b), c), d)| a + b + c + d).collect();

    // Filter successful runs
    let mask: Vec<bool> = total_times.iter().map(|&t| t <= target_ticks).collect();
    let successful_f1: Vec<u32> = f1_times.iter().zip(&mask).filter_map(|(&t, &m)| if m { Some(t) } else { None }).collect();
    let successful_f2: Vec<u32> = f2_times.iter().zip(&mask).filter_map(|(&t, &m)| if m { Some(t) } else { None }).collect();
    let successful_f3: Vec<u32> = f3_times.iter().zip(&mask).filter_map(|(&t, &m)| if m { Some(t) } else { None }).collect();
    let _successful_olm: Vec<u32> = olm_times.iter().zip(&mask).filter_map(|(&t, &m)| if m { Some(t) } else { None }).collect();
    let successful_f12: Vec<u32> = successful_f1.iter().zip(&successful_f2).map(|(&a, &b)| a + b).collect();
    let successful_f123: Vec<u32> = successful_f12.iter().zip(&successful_f3).map(|(&a, &b)| a + b).collect();
    let successful_total: Vec<u32> = total_times.iter().zip(&mask).filter_map(|(&t, &m)| if m { Some(t) } else { None }).collect();

    // Empirical probabilities
    let prob_f1: Vec<f64> = successful_f1.iter().map(|&t| {
        let count = f1_times.iter().filter(|&&x| x <= t).count();
        count as f64 / N_TRIALS as f64
    }).collect();
    let prob_f12: Vec<f64> = successful_f12.iter().map(|&t| {
        let count = f1_times.iter().zip(&f2_times).filter(|(&a, &b)| a + b <= t).count();
        count as f64 / N_TRIALS as f64
    }).collect();
    let prob_f123: Vec<f64> = successful_f123.iter().map(|&t| {
        let count = f1_times.iter().zip(&f2_times).zip(&f3_times)
            .filter(|((&a, &b), &c)| a + b + c <= t).count();
        count as f64 / N_TRIALS as f64
    }).collect();

    // Remaining time after each checkpoint
    let remaining_after_f1: Vec<u32> = successful_f1.iter().map(|&t| target_ticks.saturating_sub(t)).collect();
    let remaining_after_f12: Vec<u32> = successful_f12.iter().map(|&t| target_ticks.saturating_sub(t)).collect();
    let remaining_after_f123: Vec<u32> = successful_f123.iter().map(|&t| target_ticks.saturating_sub(t)).collect();

    // CDFs for remaining segments
    let pmf_23o: Vec<f64> = {
        let tmp = convolve_pmfs(&pmf2, &pmf3);
        convolve_pmfs(&tmp, &pmfo)
    };
    let t_23o_min = t2[0] + t3[0] + to[0];
    let t_23o: Vec<u32> = (0..pmf_23o.len()).map(|i| t_23o_min + i as u32).collect();
    let cdf_23o: Vec<f64> = {
        let mut cdf = Vec::with_capacity(pmf_23o.len());
        let mut sum = 0.0;
        for &p in &pmf_23o {
            sum += p;
            cdf.push(sum.min(1.0).max(0.0));
        }
        cdf
    };

    let pmf_3o = convolve_pmfs(&pmf3, &pmfo);
    let t_3o_min = t3[0] + to[0];
    let t_3o: Vec<u32> = (0..pmf_3o.len()).map(|i| t_3o_min + i as u32).collect();
    let cdf_3o: Vec<f64> = {
        let mut cdf = Vec::with_capacity(pmf_3o.len());
        let mut sum = 0.0;
        for &p in &pmf_3o {
            sum += p;
            cdf.push(sum.min(1.0).max(0.0));
        }
        cdf
    };

    // Probability to complete after each checkpoint
    let prob_complete_after_f1: Vec<f64> = remaining_after_f1.iter()
        .map(|&t| {
            let idx = t_23o.iter().position(|&x| x > t).unwrap_or(t_23o.len() - 1);
            cdf_23o[idx]
        }).collect();
    let prob_complete_after_f12: Vec<f64> = remaining_after_f12.iter()
        .map(|&t| {
            let idx = t_3o.iter().position(|&x| x > t).unwrap_or(t_3o.len() - 1);
            cdf_3o[idx]
        }).collect();
    let prob_complete_after_f123: Vec<f64> = remaining_after_f123.iter()
        .map(|&t| {
            let idx = to.iter().position(|&x| x > t).unwrap_or(to.len() - 1);
            cdfo[idx]
        }).collect();

    // Build DataFrame-like structure and filter
    let mut filtered: Vec<(u32, u32, u32)> = Vec::new();
    for i in 0..successful_total.len() {
        if successful_total[i] > target_ticks { continue; }
        if prob_f1[i] <= prob_complete_after_f1[i]
            && prob_f12[i] <= prob_complete_after_f12[i]
            && prob_f123[i] <= prob_complete_after_f123[i] {
            filtered.push((successful_f1[i], successful_f12[i], successful_f123[i]));
        }
    }
    let floor1_threshold = filtered.iter().map(|x| x.0).max();
    let floor12_threshold = filtered.iter().map(|x| x.1).max();
    let floor123_threshold = filtered.iter().map(|x| x.2).max();

    let mut thresholds = std::collections::HashMap::new();
    thresholds.insert("floor1".to_string(), ThresholdInfo { threshold: floor1_threshold });
    thresholds.insert("floor2".to_string(), ThresholdInfo { threshold: floor12_threshold });
    thresholds.insert("floor3".to_string(), ThresholdInfo { threshold: floor123_threshold });

    let result = ThresholdResult {
        input_target: target_ticks,
        thresholds,
    };

    match serde_json::to_string(&result) {
        Ok(s) => s,
        Err(_) => {
            "{\"error\": \"Serialization failed\"}".to_string()
        }
    }
}