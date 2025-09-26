use rand::prelude::*;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;
use std::collections::HashMap;

fn can_attack_vang(
    vang_hps: &HashMap<String, i32>,
    combat_type: &str,
    max_hit: i32,
    threshold: f64,
    hp_reset_threshold: i32,
    base_hp: i32,
) -> bool {
    if vang_hps.values().all(|&hp| hp < hp_reset_threshold) {
        return true;
    }
    if *vang_hps.values().max().unwrap() < hp_reset_threshold {
        return true;
    }
    let mut new_hps = vang_hps.clone();
    new_hps.insert(combat_type.to_string(), vang_hps[combat_type] - max_hit);
    let min_hp = *new_hps.values().min().unwrap();
    let max_hp = *new_hps.values().max().unwrap();
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

    let mut player = payload.player;
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
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    let burning_claws = inventory_items.iter().any(|item| item.name == "Burning claws");
    let voidwaker = inventory_items.iter().any(|item| item.name == "Voidwaker");

    if burning_claws {
        ensure_weapon_swap(&mut player, "Burning claws", None);
    }
    if voidwaker {
        let avernic_defender = inventory_items.iter().find(|item| item.name == "Avernic defender").cloned();
        ensure_weapon_swap(&mut player, "Voidwaker", avernic_defender);
    }

    let best_style_spec = find_best_combat_style(&player, &monsters[1], vec!["melee".to_string()]);

    // Simulation parameters
    let walk_delay = 18;
    let death_animation = 4;
    let mut tick_counts: Vec<usize> = vec![0; trials];
    let mut phase_list = Vec::with_capacity(trials);

    let max_hp = monsters[0].skills.hp as i32;
    let hp_reset_threshold = (max_hp as f64 * 0.4) as i32;

    let mut vang_hps = HashMap::new();
    vang_hps.insert("mage".to_string(), max_hp);
    vang_hps.insert("melee".to_string(), max_hp);
    vang_hps.insert("ranged".to_string(), max_hp);

    let mut max_hits = HashMap::new();
    max_hits.insert("mage".to_string(), best_style_mage.max_hit as i32);
    max_hits.insert("melee".to_string(), best_style_melee.max_hit as i32);
    max_hits.insert("ranged".to_string(), best_style_ranged.max_hit as i32);
    max_hits.insert("spec".to_string(), best_style_spec.max_hit as i32);

    let mut accuracies = HashMap::new();
    accuracies.insert("mage".to_string(), best_style_mage.accuracy);
    accuracies.insert("melee".to_string(), best_style_melee.accuracy);
    accuracies.insert("ranged".to_string(), best_style_ranged.accuracy);
    accuracies.insert("spec".to_string(), best_style_spec.accuracy);

    let mut attack_speeds = HashMap::new();
    attack_speeds.insert("mage".to_string(), best_style_mage.attack_speed as usize);
    attack_speeds.insert("melee".to_string(), best_style_melee.attack_speed as usize);
    attack_speeds.insert("ranged".to_string(), best_style_ranged.attack_speed as usize);
    attack_speeds.insert("spec".to_string(), best_style_spec.attack_speed as usize);

    let mut hit_delay_map = HashMap::new();
    hit_delay_map.insert("mage".to_string(), if player.gear_sets.mage.selected_weapon.as_ref().unwrap().name == "Tumeken's shadow" { 2 } else { 1 });
    hit_delay_map.insert("melee".to_string(), 0);
    hit_delay_map.insert("ranged".to_string(), 1);

    for i in 0..trials {
        let mut vang_hps_trial = vang_hps.clone();
        let mut tick = 0;
        let mut cooldown = 0;
        let mut immune_ticks_left = 0;
        let mut next_teleport = 20;
        let mut teleport = 0;
        let mut spec_count = if burning_claws { 3 } else if voidwaker { 2 } else { 0 };
        let mut burns = Vec::new();
        let mut initial_burn_tick = 0;
        let mut current_attack_phase_tick = 0;
        let mut last_vang_attacked = String::new();
        let spawn_delay = rng.gen_range(1..=4) + 6;
        let mut overkill = if rng.gen_range(1..=4) == 1 { 1 } else { 0 };

        loop {
            // Exit immediately if all vangs are dead
            if !vang_hps_trial.values().any(|&hp| hp > 0) {
                break;
            }

            // Handle teleport/immune phase
            if immune_ticks_left > 0 {
                immune_ticks_left -= 1;
                tick += 1;
                continue;
            }

            // Only check for teleport if not in immune phase
            if tick >= next_teleport {
                teleport += 1;
                immune_ticks_left = 11;
                current_attack_phase_tick = 0;
                next_teleport += 11 + rng.gen_range(20..=36);
                continue; // Start immune phase, skip combat this tick
            }

            let mut attack_combat_type: Option<String> = None;
            if tick >= cooldown {
                let ready_types: Vec<String> = vang_hps_trial.iter()
                    .filter_map(|(combat_type, &hp)| if hp > 0 { Some(combat_type.clone()) } else { None })
                    .collect();

                let mut sorted_types = ready_types.clone();
                sorted_types.sort_by_key(|combat_type| -vang_hps_trial[combat_type]);

                for combat_type in &sorted_types {
                    if can_attack_vang(&vang_hps_trial, combat_type, max_hits[combat_type], 0.4, hp_reset_threshold, max_hp) {
                        attack_combat_type = Some(combat_type.clone());
                        break;
                    }
                }

                if let Some(combat_type) = &attack_combat_type {
                    if last_vang_attacked != *combat_type {
                        current_attack_phase_tick = 1;
                    }
                    last_vang_attacked = combat_type.clone();
                    let hit = if *combat_type == "melee" && spec_count > 0 {
                        cooldown = tick + attack_speeds["spec"];
                        spec_count -= 1;
                        if voidwaker {
                            // Voidwaker special: guaranteed hit with 50%-150% damage range
                            let lower_bound = (max_hits["spec"] as f64 * 0.5).floor() as i32;
                            let upper_bound = (max_hits["spec"] as f64 * 1.5).floor() as i32;
                            rng.gen_range(lower_bound..=upper_bound)
                        } else if burning_claws {
                            let (hits, new_burns) = burning_barrage_special(&mut rng, max_hits["spec"], accuracies["spec"]);
                            if initial_burn_tick == 0 && !new_burns.is_empty() && burns.is_empty() {
                                initial_burn_tick = 1;
                            }
                            if !new_burns.is_empty() {
                                burns.extend(new_burns);
                                if burns.len() > 5 {
                                    burns.truncate(5);
                                }
                            }
                            hits.iter().sum()
                        } else {
                            // Other special attacks - use normal accuracy roll
                            if rng.gen::<f64>() < accuracies["spec"] {
                                rng.gen_range(0..=max_hits["spec"]).max(1)
                            } else {
                                0
                            }
                        }
                    } else {
                        cooldown = tick + attack_speeds[combat_type];
                        if rng.gen::<f64>() < accuracies[combat_type] {
                            rng.gen_range(0..=max_hits[combat_type]).max(1)
                        } else {
                            0
                        }
                    };
                    let current_hp = vang_hps_trial[combat_type];
                    vang_hps_trial.insert(combat_type.clone(), (current_hp - hit).max(0));
                }
            }
            if initial_burn_tick > 0 && !burns.is_empty() && (initial_burn_tick - 1) % 4 == 0 {
                let melee_hp = vang_hps_trial["melee"];
                let new_melee_hp = apply_burns(melee_hp, &mut burns);
                vang_hps_trial.insert("melee".to_string(), new_melee_hp);
                if burns.is_empty() {
                    initial_burn_tick = 0;
                }
            }
            if initial_burn_tick > 0 {
                initial_burn_tick += 1;
            }
            if immune_ticks_left == 0 {
                if (current_attack_phase_tick - 1) % 4 == 0 {
                    let thrall_hit = rng.gen_range(0..=3);
                    let thrall_dmg_hp = vang_hps_trial[last_vang_attacked.as_str()];
                    vang_hps_trial.insert(last_vang_attacked.clone(), (thrall_dmg_hp - thrall_hit).max(0));
                }
                current_attack_phase_tick += 1;
            }
            tick += 1;
        }
        if &last_vang_attacked == "melee" {
            overkill = 1;
        }
        let hit_delay = hit_delay_map[&last_vang_attacked];
        tick_counts[i] = tick + walk_delay + spawn_delay + hit_delay + death_animation - overkill;
        phase_list.push(teleport);
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
    }).to_string()
}

