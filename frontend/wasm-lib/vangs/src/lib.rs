use rand::prelude::*;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

fn ensure_weapon_swap(
    player: &mut Player,
    weapon_name: &str,
    equip_offhand: Option<SelectedItem>,
) -> Option<(String, Option<SelectedItem>)> {
    let gear_stats = &mut player.gear_sets.melee.gear_stats;
    let gear_items = &mut player.gear_sets.melee.gear_items;
    let selected_weapon = player.gear_sets.melee.selected_weapon.as_mut()?;

    // Find weapon in inventory
    let inventory_weapon_idx = player.inventory.iter().position(|item| item.name.contains(weapon_name));
    if let Some(idx) = inventory_weapon_idx {
        let inventory_weapon = player.inventory.remove(idx);

        // Find current offhand
        let current_offhand_idx = gear_items.iter().position(|item| {
            item.as_ref().map_or(false, |i| i.slot == "shield")
        });
        let current_offhand = current_offhand_idx
            .and_then(|i| gear_items.remove(i))
            .and_then(|i| Some(i.clone()));

        // Update bonuses
        if let Some(bonuses) = &selected_weapon.bonuses {
            if let Some(inv_bonuses) = inventory_weapon.equipment.as_ref().and_then(|eq| eq.bonuses.as_ref()) {
                gear_stats.bonuses.str -= bonuses.str;
                gear_stats.bonuses.str += inv_bonuses.str;
                gear_stats.bonuses.ranged_str -= bonuses.ranged_str;
                gear_stats.bonuses.ranged_str += inv_bonuses.ranged_str;
                gear_stats.bonuses.magic_str -= bonuses.magic_str;
                gear_stats.bonuses.magic_str += inv_bonuses.magic_str;
                gear_stats.bonuses.prayer -= bonuses.prayer;
                gear_stats.bonuses.prayer += inv_bonuses.prayer;

                if let Some(ref offhand) = current_offhand {
                    if let Some(off_bonuses) = offhand.bonuses.as_ref() {
                        gear_stats.bonuses.str -= off_bonuses.str;
                        gear_stats.bonuses.ranged_str -= off_bonuses.ranged_str;
                        gear_stats.bonuses.magic_str -= off_bonuses.magic_str;
                        gear_stats.bonuses.prayer -= off_bonuses.prayer;
                    }
                }
                if let Some(ref offhand) = equip_offhand {
                    if let Some(off_bonuses) = offhand.bonuses.as_ref() {
                        gear_stats.bonuses.str += off_bonuses.str;
                        gear_stats.bonuses.ranged_str += off_bonuses.ranged_str;
                        gear_stats.bonuses.magic_str += off_bonuses.magic_str;
                        gear_stats.bonuses.prayer += off_bonuses.prayer;
                    }
                }
            }
        }
        // Update offensive
        if let Some(offensive) = &selected_weapon.offensive {
            if let Some(inv_offensive) = inventory_weapon.equipment.as_ref().and_then(|eq| eq.offensive.as_ref()) {
                gear_stats.offensive.stab -= offensive.stab;
                gear_stats.offensive.stab += inv_offensive.stab;
                gear_stats.offensive.slash -= offensive.slash;
                gear_stats.offensive.slash += inv_offensive.slash;
                gear_stats.offensive.crush -= offensive.crush;
                gear_stats.offensive.crush += inv_offensive.crush;
                gear_stats.offensive.magic -= offensive.magic;
                gear_stats.offensive.magic += inv_offensive.magic;
                gear_stats.offensive.ranged -= offensive.ranged;
                gear_stats.offensive.ranged += inv_offensive.ranged;

                if let Some(ref offhand) = current_offhand {
                    if let Some(off_offensive) = offhand.offensive.as_ref() {
                        gear_stats.offensive.stab -= off_offensive.stab;
                        gear_stats.offensive.slash -= off_offensive.slash;
                        gear_stats.offensive.crush -= off_offensive.crush;
                        gear_stats.offensive.magic -= off_offensive.magic;
                        gear_stats.offensive.ranged -= off_offensive.ranged;
                    }
                }
                if let Some(ref offhand) = equip_offhand {
                    if let Some(off_offensive) = offhand.offensive.as_ref() {
                        gear_stats.offensive.stab += off_offensive.stab;
                        gear_stats.offensive.slash += off_offensive.slash;
                        gear_stats.offensive.crush += off_offensive.crush;
                        gear_stats.offensive.magic += off_offensive.magic;
                        gear_stats.offensive.ranged += off_offensive.ranged;
                    }
                }
            }
        }

        // Swap weapon
        let prev_weapon = std::mem::replace(selected_weapon, inventory_weapon.equipment.clone()?);

        player.inventory.push(InventoryItem {
            name: prev_weapon.name.clone(),
            equipment: Some(prev_weapon.clone()),
        });

        // Handle offhand swap
        if let Some(offhand) = current_offhand.clone() {
            player.inventory.push(InventoryItem {
                name: offhand.name.clone(),
                equipment: Some(offhand.clone()),
            });
            return Some((prev_weapon.name.clone(), Some(offhand)));
        }
        if let Some(offhand) = equip_offhand.clone() {
            gear_items.push(Some(offhand.clone()));
        }
        return Some((prev_weapon.name.clone(), current_offhand));
    }
    None
}

fn phase_loop(
    hp: &mut i32,
    attack_tick: &mut usize,
    attack_speed: usize,
    accuracy: f64,
    max_hit: i32,
    total_ticks: &mut usize,
    rng: &mut ThreadRng,
) -> usize {
    while *hp > 0 {
        *attack_tick += 1;
        if (*attack_tick - 1) % attack_speed == 0 {
            let hit = if rng.gen::<f64>() < accuracy {
                rng.gen_range(0..=max_hit)
            } else {
                0
            };
            *hp -= hit;
        }
        if *hp <= 0 {
            *total_ticks += *attack_tick - 1;
            break;
        }
        if (*attack_tick - 1) % 4 == 0 {
            let hit = rng.gen_range(0..4);
            *hp -= hit;
        }
        if *hp <= 0 {
            *total_ticks += *attack_tick - 1;
            break;
        }
    }
    *attack_tick += attack_speed - 1;
    *attack_tick
}

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

    // Simulation parameters
    let initial_delay = 24;
    let mut tick_counts = Vec::with_capacity(trials);
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

    for trial in 0..trials {
        let mut vang_hps = [max_hp, max_hp, max_hp];
        let mut tick = 0;
        let mut cooldown = 0;
        let mut immune_ticks_left = 0;
        let mut next_teleport = 20;
        let mut teleport = 0;
        let mut ko_this_tick = false;
        // let mut debug_tick_log = Vec::new();

        loop {
            // Exit immediately if all vangs are dead
            if !vang_hps.iter().any(|&hp| hp > 0) {
                break;
            }
            ko_this_tick = false;
            let prev_vang_hps = vang_hps;

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
            let mut hit = 0;
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
                    hit = if rng.gen::<f64>() < accuracies[idx] {
                        rng.gen_range(0..=max_hits[idx])
                    } else {
                        0
                    };
                    let prev_hp = vang_hps[idx];
                    vang_hps[idx] = (vang_hps[idx] - hit).max(0);
                    if prev_hp > 0 && vang_hps[idx] == 0 {
                        ko_this_tick = true;
                    }
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
        tick_counts.push(tick + initial_delay);
        phase_list.push(teleport);
        // debug_trials.push(debug_tick_log);
    }

    // Defensive: Check tick_counts
    if tick_counts.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }

    // Compute statistics
    let mean_ttk = tick_counts.iter().sum::<usize>() as f64 / trials as f64;
    let std_ttk = {
        let mean = mean_ttk;
        let var = tick_counts.iter().map(|&x| {
            let diff = x as f64 - mean;
            diff * diff
        }).sum::<f64>() / trials as f64;
        var.sqrt()
    };

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
    let mut encounter_kill_times = kill_prob.clone();
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
    let attack_speed = 5;
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

