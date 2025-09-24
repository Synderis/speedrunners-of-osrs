use rand::prelude::*;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;


fn can_attack_vang(
    vang_hps: &[i32],
    idx: usize,
    max_hit: i32,
    threshold: f64,
    hp_reset_threshold: i32,
    base_hp: i32,
) -> bool {
    if vang_hps.iter().all(|&hp| hp < hp_reset_threshold) {
        return true;
    }
    if *vang_hps.iter().max().unwrap() < hp_reset_threshold {
        return true;
    }
    let mut new_hps = vang_hps.to_vec();
    new_hps[idx] = vang_hps[idx] - max_hit;
    let min_hp = *new_hps.iter().min().unwrap();
    let max_hp = *new_hps.iter().max().unwrap();
    let reset_threshold = (threshold * base_hp as f64) as i32;
    if (max_hp - min_hp) > reset_threshold {
        return false;
    }
    true
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_vangs(payload_json: &str) -> String {
    // Parse payload
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let player = payload.player;
    let monsters = payload.room.monsters;
    let _room_methods = payload.room.methods;
    let trials = 100000; // Reduce for debug
    let mut rng = rand::thread_rng();

    // Defensive: Check monsters
    if monsters.len() < 3 {
        return "{\"error\": \"Not enough monsters in payload\"}".to_string();
    }

    let best_style_mage = find_best_combat_style(&player, &monsters[0], vec!["magic".to_string()]);
    let best_style_melee = find_best_combat_style(&player, &monsters[1], vec!["melee".to_string()]);
    let best_style_ranged = find_best_combat_style(&player, &monsters[2], vec!["ranged".to_string()]);

    // Simulation parameters
    let initial_delay = 24;
    let death_animation = 4;
    let mut tick_counts: Vec<usize> = vec![0; trials];
    let mut phase_list = Vec::with_capacity(trials);
    // let mut debug_trials = Vec::with_capacity(trials);

    let max_hp = monsters[0].skills.hp as i32;
    let hp_reset_threshold = (max_hp as f64 * 0.4) as i32;

    let max_hits = [
        best_style_mage.max_hit as i32,
        best_style_melee.max_hit as i32,
        best_style_ranged.max_hit as i32,
    ];
    let accuracies = [
        best_style_mage.accuracy,
        best_style_melee.accuracy,
        best_style_ranged.accuracy,
    ];
    let attack_speeds = [
        best_style_mage.attack_speed as usize,
        best_style_melee.attack_speed as usize,
        best_style_ranged.attack_speed as usize,
    ];

    for i in 0..trials {
        let mut vang_hps = [max_hp, max_hp, max_hp];
        let mut tick = 0;
        let mut cooldown = 0;
        let mut immune_ticks_left = 0;
        let mut next_teleport = 20;
        let mut teleport = 0;
        // let mut debug_tick_log = Vec::new();

        loop {
            // Exit immediately if all vangs are dead
            if !vang_hps.iter().any(|&hp| hp > 0) {
                break;
            }

            // Handle teleport/immune phase
            if immune_ticks_left > 0 {
                // debug_tick_log.push(serde_json::json!({
                //     "tick": tick,
                //     "vang_hps": vang_hps,
                //     "immune_ticks_left": immune_ticks_left,
                //     "next_teleport": next_teleport,
                //     "teleport": teleport,
                //     "cooldown": cooldown,
                //     "event": "immune"
                // }));
                immune_ticks_left -= 1;
                tick += 1;
                continue;
            }

            // Only check for teleport if not in immune phase
            if tick >= next_teleport {
                // Exit immediately if all vangs are dead before teleport
                if !vang_hps.iter().any(|&hp| hp > 0) {
                    break;
                }
                // debug_tick_log.push(serde_json::json!({
                //     "tick": tick,
                //     "vang_hps": vang_hps,
                //     "immune_ticks_left": immune_ticks_left,
                //     "next_teleport": next_teleport,
                //     "teleport": teleport,
                //     "cooldown": cooldown,
                //     "event": "teleport"
                // }));
                teleport += 1;
                immune_ticks_left = 11;
                next_teleport += 11 + rng.gen_range(20..=36);
                continue; // Start immune phase, skip combat this tick
            }

            let mut attack_idx: Option<usize> = None;
            if tick >= cooldown {
                let ready_idxs: Vec<usize> = vang_hps.iter().enumerate().filter_map(|(i, &hp)| if hp > 0 { Some(i) } else { None }).collect();
                let mut sorted_idxs = ready_idxs.clone();
                sorted_idxs.sort_by_key(|&i| -vang_hps[i]);
                for &idx in &sorted_idxs {
                    if can_attack_vang(&vang_hps, idx, max_hits[idx], 0.4, hp_reset_threshold, max_hp) {
                        attack_idx = Some(idx);
                        break;
                    }
                }
                if let Some(idx) = attack_idx {
                    let hit = if rng.gen::<f64>() < accuracies[idx] {
                        rng.gen_range(0..=max_hits[idx]).max(1)
                    } else {
                        0
                    };
                    vang_hps[idx] = (vang_hps[idx] - hit).max(0);
                    cooldown = tick + attack_speeds[idx];
                }
            }
            // debug_tick_log.push(serde_json::json!({
            //     "tick": tick,
            //     "vang_hps": vang_hps,
            //     "immune_ticks_left": immune_ticks_left,
            //     "next_teleport": next_teleport,
            //     "teleport": teleport,
            //     "cooldown": cooldown,
            //     "attack_idx": attack_idx,
            //     "hit": hit,
            //     "event": "attack_or_idle"
            // }));
            tick += 1;
        }
        tick_counts[i] = tick + initial_delay + death_animation;
        phase_list.push(teleport);
        // debug_trials.push(debug_tick_log);
    }

    // Defensive: Check tick_counts
    if tick_counts.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }

    // Compute statistics
    let mean_ttk = tick_counts.iter().sum::<usize>() as f64 / trials as f64;

    // Build cumulative kill probability
    let max_ticks = match tick_counts.iter().max().copied() {
        Some(val) => val,
        None => return "{\"error\": \"No max tick found\"}".to_string(),
    };
    let mut kill_prob = vec![0.0f64; max_ticks + 1];
    for &ticks in &tick_counts {
        for idx in ticks..=max_ticks {
            kill_prob[idx] += 1.0;
        }
    }
    for prob in &mut kill_prob {
        *prob /= trials as f64;
    }

    // Collect results for each monster (if you have more than one)
    let mut results = Vec::new();
    let mut total_expected_hits = 0.0;
    let mut total_expected_ticks = 0.0;
    let mut total_expected_seconds = 0.0;
    let encounter_kill_times = kill_prob.clone();
    let encounter_attack_speed = 5; // or whatever is appropriate
    let expected_hits = mean_ttk / encounter_attack_speed as f64; // or however you calculate it
    let expected_ttk = mean_ttk;
    let expected_seconds = mean_ttk * 0.6; // 1 tick = 0.6 seconds

    total_expected_hits += expected_hits;
    total_expected_ticks += expected_ttk;
    total_expected_seconds += expected_seconds;

    let mage_vang = &monsters[0];
    let result_mage = serde_json::json!({
        "monster_id": mage_vang.id,
        "monster_name": mage_vang.name,
        "expected_hits": 0.0,
        "expected_ticks": 0.0,
        "expected_seconds": 0.0,
        "combat_type": best_style_mage.attack_type,
        "attack_style": best_style_mage.combat_style,
        "kill_times": kill_prob.clone(),
    });
    results.push(result_mage);

    let melee_vang = &monsters[1];
    let result_melee = serde_json::json!({
        "monster_id": melee_vang.id,
        "monster_name": melee_vang.name,
        "expected_hits": 0.0,
        "expected_ticks": 0.0,
        "expected_seconds": 0.0,
        "combat_type": best_style_melee.attack_type,
        "attack_style": best_style_melee.combat_style,
        "kill_times": kill_prob.clone(),
    });
    results.push(result_melee);

    let ranged_vang = &monsters[2];
    let result_ranged = serde_json::json!({
        "monster_id": ranged_vang.id,
        "monster_name": ranged_vang.name,
        "expected_hits": 0.0,
        "expected_ticks": 0.0,
        "expected_seconds": 0.0,
        "combat_type": best_style_ranged.attack_type,
        "attack_style": best_style_ranged.combat_style,
        "kill_times": kill_prob.clone(),
    });
    results.push(result_ranged);

    // Convert encounter_kill_times to JSON object array
    let encounter_kill_times_obj: Vec<serde_json::Value> = encounter_kill_times.iter().enumerate()
        .map(|(idx, &prob)| {
            serde_json::json!({
                "tick": idx,
                "probability": prob
            })
        })
        .collect();

    // Final output
    serde_json::json!({
        "results": results,
        "total_hits": total_expected_hits,
        "total_expected_ticks": total_expected_ticks,
        "total_expected_seconds": total_expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj,
        "phase_results": phase_list,
        // "debug_trials": debug_trials,
    }).to_string()
}

