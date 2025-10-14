use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json;

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
    
    // Interpolate CDF values
    let mut full_c = Vec::with_capacity(full_t.len());
    for &t in &full_t {
        let mut idx = 0;
        while idx < times.len() - 1 && times[idx + 1] <= t {
            idx += 1;
        }
        full_c.push(probs[idx]);
    }
    
    // Convert CDF to PMF
    let mut pmf = Vec::with_capacity(full_c.len());
    pmf.push(full_c[0]);
    for i in 1..full_c.len() {
        pmf.push((full_c[i] - full_c[i - 1]).max(0.0));
    }
    
    // Normalize PMF
    let s: f64 = pmf.iter().sum();
    if s > 0.0 {
        for p in pmf.iter_mut() {
            *p /= s;
        }
    }
    
    (full_t, pmf, full_c)
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

fn interpolate(x: u32, x_vals: &[u32], y_vals: &[f64]) -> f64 {
    if x_vals.is_empty() {
        return 0.0;
    }
    if x <= x_vals[0] {
        return 0.0;
    }
    if x >= x_vals[x_vals.len() - 1] {
        return 1.0;
    }
    
    let mut idx = 0;
    while idx < x_vals.len() - 1 && x_vals[idx + 1] <= x {
        idx += 1;
    }
    
    y_vals[idx]
}

fn find_analytical_thresholds(
    target: u32,
    t1: &[u32], pmf1: &[f64], cdf1: &[f64],
    t2: &[u32], pmf2: &[f64],
    t3: &[u32], pmf3: &[f64],
    to: &[u32], pmfo: &[f64], cdfo: &[f64]
) -> (Option<u32>, Option<u32>, Option<u32>) {
    
    // Build convolved CDFs for remaining stages
    
    // Floor2+3+Olm
    let pmf_23 = convolve_pmfs(pmf2, pmf3);
    let pmf_23o = convolve_pmfs(&pmf_23, pmfo);
    let t_23o_min = t2[0] + t3[0] + to[0];
    let t_23o: Vec<u32> = (0..pmf_23o.len()).map(|i| t_23o_min + i as u32).collect();
    let cdf_23o: Vec<f64> = {
        let mut cdf = Vec::with_capacity(pmf_23o.len());
        let mut sum = 0.0;
        for &p in &pmf_23o {
            sum += p;
            cdf.push(sum.min(1.0));
        }
        cdf
    };
    
    // Floor3+Olm  
    let pmf_3o = convolve_pmfs(pmf3, pmfo);
    let t_3o_min = t3[0] + to[0];
    let t_3o: Vec<u32> = (0..pmf_3o.len()).map(|i| t_3o_min + i as u32).collect();
    let cdf_3o: Vec<f64> = {
        let mut cdf = Vec::with_capacity(pmf_3o.len());
        let mut sum = 0.0;
        for &p in &pmf_3o {
            sum += p;
            cdf.push(sum.min(1.0));
        }
        cdf
    };
    
    // Floor1+2
    let pmf_12 = convolve_pmfs(pmf1, pmf2);
    let t_12_min = t1[0] + t2[0];
    let t_12: Vec<u32> = (0..pmf_12.len()).map(|i| t_12_min + i as u32).collect();
    let cdf_12: Vec<f64> = {
        let mut cdf = Vec::with_capacity(pmf_12.len());
        let mut sum = 0.0;
        for &p in &pmf_12 {
            sum += p;
            cdf.push(sum.min(1.0));
        }
        cdf
    };
    
    // Floor1+2+3
    let pmf_123 = convolve_pmfs(&pmf_12, pmf3);
    let t_123_min = t_12_min + t3[0];
    let t_123: Vec<u32> = (0..pmf_123.len()).map(|i| t_123_min + i as u32).collect();
    let cdf_123: Vec<f64> = {
        let mut cdf = Vec::with_capacity(pmf_123.len());
        let mut sum = 0.0;
        for &p in &pmf_123 {
            sum += p;
            cdf.push(sum.min(1.0));
        }
        cdf
    };
    
    // Find thresholds where prob_reach <= prob_complete_remaining
    
    // Floor 1 threshold
    let mut floor_1_threshold = None;
    for i in 0..t1.len() {
        let t = t1[i];
        if t >= target { break; }
        let remaining = target - t;
        let prob_complete = interpolate(remaining, &t_23o, &cdf_23o);
        if cdf1[i] <= prob_complete {
            floor_1_threshold = Some(t);
        }
    }
    
    // Floor 1+2 threshold  
    let mut floor_12_threshold = None;
    for i in 0..t_12.len() {
        let t = t_12[i];
        if t >= target { break; }
        let remaining = target - t;
        let prob_complete = interpolate(remaining, &t_3o, &cdf_3o);
        if cdf_12[i] <= prob_complete {
            floor_12_threshold = Some(t);
        }
    }
    
    // Floor 1+2+3 threshold
    let mut floor_123_threshold = None;
    for i in 0..t_123.len() {
        let t = t_123[i];
        if t >= target { break; }
        let remaining = target - t;
        let prob_complete = interpolate(remaining, to, cdfo);
        if cdf_123[i] <= prob_complete {
            floor_123_threshold = Some(t);
        }
    }
    
    (floor_1_threshold, floor_12_threshold, floor_123_threshold)
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
    let (t1, pmf1, cdf1) = cdf_to_pmf(&parsed.floor1);
    let (t2, pmf2, _cdf2) = cdf_to_pmf(&parsed.floor2);
    let (t3, pmf3, _cdf3) = cdf_to_pmf(&parsed.floor3);
    let (to, pmfo, cdfo) = cdf_to_pmf(&parsed.olm);

    let (floor_1_threshold, floor_12_threshold, floor_123_threshold) = find_analytical_thresholds(
        target_ticks, &t1, &pmf1, &cdf1, &t2, &pmf2, &t3, &pmf3, &to, &pmfo, &cdfo
    );

    let mut thresholds = std::collections::HashMap::new();
    thresholds.insert("floor1".to_string(), ThresholdInfo { threshold: floor_1_threshold });
    thresholds.insert("floor2".to_string(), ThresholdInfo { threshold: floor_12_threshold });
    thresholds.insert("floor3".to_string(), ThresholdInfo { threshold: floor_123_threshold });

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