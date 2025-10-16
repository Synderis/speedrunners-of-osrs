use rand::prelude::*;
use rand::rngs::SmallRng;
use rand::SeedableRng;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;
use std::collections::HashMap;
use rand::distributions::{Uniform, Distribution};

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
    let mut monsters = payload.room.monsters;
    for monster in &mut monsters {
        if player.combat_stats.hitpoints != 99 {
            monster.skills.hp = monster_hp_scaling(monster, &player.combat_stats);
        }
        monster.skills = monster_stat_scaling(monster, player.combat_stats.hitpoints);
    }
    let _room_methods = payload.room.methods;
    let spec_count_dict = payload.room.special_attacks;
    let mut spec_count_max = 0;
    let trials = 100000;

    // 🔧 Faster, WASM-friendly RNG with entropy
    let mut rng = SmallRng::from_entropy();

// before loop
    let thrall_dmg = Uniform::new_inclusive(0, 3);

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
    let weapon_name = player.gear_sets.melee.selected_weapon.as_ref().unwrap().name.clone();

    if burning_claws {
        spec_count_max = spec_count_dict
            .as_ref()
            .and_then(|vec| vec.iter().find(|sa| sa.name == "Burning claws").map(|sa| sa.count))
            .unwrap_or(3);
        ensure_weapon_swap(&mut player, "Burning claws", None);
    }
    if voidwaker {
        spec_count_max = spec_count_dict
            .as_ref()
            .and_then(|vec| vec.iter().find(|sa| sa.name == "Voidwaker").map(|sa| sa.count))
            .unwrap_or(2);
        let avernic_defender = inventory_items.iter().find(|item| item.name == "Avernic defender").cloned();
        ensure_weapon_swap(&mut player, "Voidwaker", avernic_defender);
    }

    let best_style_spec = find_best_combat_style(&player, &monsters[1], vec!["melee".to_string()]);

    // Simulation parameters
    let walk_delay = 18;
    let death_animation = 4;
    let post_room_delay = 4;
    let mut phase_list: Vec<i32> = Vec::with_capacity(trials);
    let mut freq: Vec<usize> = Vec::new();
    let mut sum_ticks: i64 = 0;

    let max_hp = monsters[0].skills.hp;
    let hp_reset_threshold = (max_hp as f64 * 0.4) as i32;

    let mut vang_hps = HashMap::new();
    vang_hps.insert("mage".to_string(), max_hp);
    vang_hps.insert("melee".to_string(), max_hp);
    vang_hps.insert("ranged".to_string(), max_hp);

    let mut max_hits = HashMap::new();
    max_hits.insert("mage".to_string(), best_style_mage.max_hit);
    max_hits.insert("melee".to_string(), best_style_melee.max_hit);
    max_hits.insert("ranged".to_string(), best_style_ranged.max_hit);
    max_hits.insert("spec".to_string(), best_style_spec.max_hit);

    let mut accuracies = HashMap::new();
    accuracies.insert("mage".to_string(), best_style_mage.accuracy);
    accuracies.insert("melee".to_string(), best_style_melee.accuracy);
    accuracies.insert("ranged".to_string(), best_style_ranged.accuracy);
    accuracies.insert("spec".to_string(), best_style_spec.accuracy);

    // 🔧 Precompute integer thresholds for accuracy rolls (fast + precise)
    let to_threshold = |p: f64| -> u32 {
        (p.clamp(0.0, 1.0) * (u32::MAX as f64)) as u32
    };
    let spec_threshold = to_threshold(accuracies["spec"]);

    let mut attack_speeds = HashMap::new();
    attack_speeds.insert("mage".to_string(), best_style_mage.attack_speed);
    attack_speeds.insert("melee".to_string(), best_style_melee.attack_speed);
    attack_speeds.insert("ranged".to_string(), best_style_ranged.attack_speed);
    attack_speeds.insert("spec".to_string(), best_style_spec.attack_speed);

    let mut hit_delay_map = HashMap::new();
    hit_delay_map.insert(
        "mage".to_string(),
        if player
            .gear_sets
            .mage
            .selected_weapon
            .as_ref()
            .unwrap()
            .name
            == "Tumeken's shadow"
        {
            2
        } else {
            1
        },
    );
    hit_delay_map.insert("melee".to_string(), 0);
    hit_delay_map.insert("ranged".to_string(), 1);

    for _ in 0..trials {
        let mut vang_hps_trial = vang_hps.clone();
        let mut tick = 0;
        let mut cooldown = 0;
        let mut immune_ticks_left = 0;
        let mut next_teleport = 20;
        let mut teleport = 0;
        let mut spec_count = spec_count_max;
        let mut burns = Vec::new();
        let mut initial_burn_tick = 0;
        let mut current_attack_phase_tick = 0;
        let mut last_vang_attacked = String::new();

        // uses SmallRng instance
        let spawn_delay = rng.gen_range(1..=4) + 6;

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
                let ready_types: Vec<String> = vang_hps_trial
                    .iter()
                    .filter_map(|(combat_type, &hp)| if hp > 0 { Some(combat_type.clone()) } else { None })
                    .collect();

                let mut sorted_types = ready_types.clone();
                sorted_types.sort_by_key(|combat_type| -vang_hps_trial[combat_type]);

                for combat_type in &sorted_types {
                    if can_attack_vang(
                        &vang_hps_trial,
                        combat_type,
                        max_hits[combat_type],
                        0.4,
                        hp_reset_threshold,
                        max_hp,
                    ) {
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
                            // Voidwaker special: uses shared function
                            dmg_modifier_check(&mut rng, max_hits["spec"], accuracies["spec"], "Voidwaker")
                        } else if burning_claws {
                            let (hits, new_burns) =
                                burning_barrage_special(&mut rng, max_hits["spec"], accuracies["spec"]);
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
                            // 🔧 Integer threshold accuracy roll (fastest)
                            if rng.next_u32() <= spec_threshold {
                                rng.gen_range(0..=max_hits["spec"]).max(1)
                            } else {
                                0
                            }
                        }
                    } else {
                        cooldown = tick + attack_speeds[combat_type];
                        if *combat_type == "melee" {
                            dmg_modifier_check(
                                &mut rng,
                                max_hits[combat_type],
                                accuracies[combat_type],
                                &weapon_name,
                            )
                        } else {
                            dmg_modifier_check(&mut rng, max_hits[combat_type], accuracies[combat_type], "Other")
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
                    let thrall_hit = thrall_dmg.sample(&mut rng);
                    let thrall_dmg_hp = vang_hps_trial[last_vang_attacked.as_str()];
                    vang_hps_trial.insert(last_vang_attacked.clone(), (thrall_dmg_hp - thrall_hit).max(0));
                }
                current_attack_phase_tick += 1;
            }
            tick += 1;
        }
        let overkill = if &last_vang_attacked == "melee" {
            1
        } else {
            let range_max = if attack_speeds[&last_vang_attacked] > 4 {
                4 * attack_speeds[&last_vang_attacked]
            } else {
                4
            };
            if rng.gen_range(1..=range_max) == 1 { 1 } else { 0 }
        };
        let hit_delay = hit_delay_map[&last_vang_attacked];
        tick += walk_delay + spawn_delay + hit_delay + death_animation - overkill;
        if tick % 4 != 0 {
            tick += 4 - (tick % 4);
        }
        tick += post_room_delay;
        // record histogram and sum
        sum_ticks += i64::from(tick);
        let idx = tick as usize;
        if idx >= freq.len() {
            freq.resize(idx + 1, 0);
        }
        freq[idx] += 1;
        phase_list.push(teleport);
    }
    // Defensive: Check freq
    if freq.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }

    // Use results_formatter for consistent output
    let style_list = vec![best_style_mage.clone(), best_style_melee.clone(), best_style_ranged.clone()];
    let end_results = results_formatter(&monsters, &style_list, sum_ticks, freq, trials, Vec::new(), phase_list);
    end_results
}
