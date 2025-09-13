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
    mut hit_count: usize,
    hit_count_bounds: &[usize; 2],
    tekton_hp: &mut i32,
    current_phase_ticks: &mut usize,
    attack_speed: usize,
    accuracy: f64,
    max_hit: i32,
    rng: &mut ThreadRng,
) -> (i32, usize, usize, bool) {
    // Rust translation of the provided Python phase_loop
    while *tekton_hp > 0 && hit_count >= hit_count_bounds[0] && hit_count <= hit_count_bounds[1] {
        *current_phase_ticks += 1;
        if *current_phase_ticks == 1 || (*current_phase_ticks - 1) % 4 == 0 {
            *tekton_hp -= rng.gen_range(0..4);
        }
        if *tekton_hp <= 0 {
            return (*tekton_hp, *current_phase_ticks, hit_count, true); // signal to break outer loop
        }
        if *current_phase_ticks == 1 || (*current_phase_ticks - 1) % attack_speed == 0 {
            let mut hit = 0;
            if rng.gen::<f64>() < accuracy {
                hit = rng.gen_range(0..=max_hit);
            }
            *tekton_hp -= hit;
            hit_count += 1;
        }
    }
    (*tekton_hp, *current_phase_ticks, hit_count, false)
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_tekton(payload_json: &str) -> String {
    // Parse payload
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let mut player = payload.player;
    let monsters = payload.room.monsters;
    let room_methods = payload.room.methods;
    let trials = 100000;
    let mut rng = rand::thread_rng();

    // Defensive: Check monsters
    if monsters.is_empty() {
        return "{\"error\": \"No monsters in payload\"}".to_string();
    }
    if monsters.len() < 2 {
        return "{\"error\": \"Tekton simulation requires two monsters (normal and enraged)\"}".to_string();
    }
    if monsters[0].id != 7545 || monsters[1].id != 7544 {
        return "{\"error\": \"First two monsters must be Tekton (normal and enraged)\"}".to_string();
    }
    let initial_best_style = find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]);
    let initial_best_style_enraged = find_best_combat_style(&player, &monsters[1], vec!["melee".to_string()]);
    // --- SWAP TO ELDER MAUL BEFORE SIMULATION ---
    let swap_result = ensure_weapon_swap(&mut player, "Elder maul", None);
    let (swapped_weapon, swapped_offhand) = match swap_result {
        Some((w, o)) => (w, o),
        None => {
            return "{\"error\": \"Elder maul not found in inventory\"}".to_string();
        }
    };

    // Extract Tekton stats
    let base_tekton_hp = monsters[0].skills.hp as i32;
    let mut attack_speed_normal = player.gear_sets.melee.selected_weapon.as_ref().map(|w| w.speed).unwrap_or(4) as usize;
    let mut attack_speed_enraged = attack_speed_normal;

    // Find best style for spec
    let mut tekton_initial = monsters[0].clone();
    tekton_initial.skills.def = (tekton_initial.skills.def as f64 * 0.65) as u32;
    let best_style_spec = find_best_combat_style(&player, &tekton_initial, vec!["melee".to_string()]);
    let max_hit_spec = best_style_spec.max_hit as i32;
    let accuracy_spec = best_style_spec.accuracy;

    // Prepare simulation
    let mut tick_counts = vec![0usize; trials];
    let mut best_style_normal: Option<StyleResult> = None;
    let mut best_style_enraged: Option<StyleResult> = None;
    let mut hp_pre_anvil: Vec<usize> = vec![0; trials];
    let mut phase_results: Vec<usize> = vec![0; trials];


    let (delay, attack_pattern): (usize, Vec<[usize; 2]>) = if room_methods.len() > 0 && room_methods[0] == "Tekton Short Lure" {
        // (12, vec![[0, 4], [0, 3], [4, 10]])
        (12, vec![[0, 4], [0, 3], [4, 10]])
    } else {
        (17, vec![[0, 5], [0, 3], [4, 11]])
    };
    // let delay = 17;
    // let attack_pattern = vec![[0, 5], [0, 3], [4, 11]];

    for i in 0..trials {
        let mut tekton_hp = base_tekton_hp;
        let mut tekton_normal = monsters[0].clone();
        let mut tekton_enraged = monsters[1].clone();
        let mut total_ticks = delay;
        let mut spec_count = true;
        let mut best_style_normal = None;
        let mut best_style_enraged = None;
        let mut first_pass = true;
        let mut phase: usize = 0;
        let mut hp_pre_anvil_val: i32 = 0;
        let mut hit_count = 0;
        let mut current_phase_ticks = 0;

        while tekton_hp > 0 {
            if spec_count {
                if tekton_normal.skills.def != tekton_enraged.skills.def {
                    return "{\"error\": \"Defences are not equal\"}".to_string();
                }
                tekton_normal.skills.def = (tekton_normal.skills.def as f64 * 0.65) as u32;
                tekton_enraged.skills.def = (tekton_enraged.skills.def as f64 * 0.65) as u32;
                if tekton_normal.skills.def != tekton_enraged.skills.def {
                    return "{\"error\": \"Defences are not equal\"}".to_string();
                }
                total_ticks += 6;
                tekton_hp -= rng.gen_range(0..=max_hit_spec);
                if rng.gen::<f64>() < accuracy_spec {
                    let hit = rng.gen_range(0..=max_hit_spec);
                    tekton_normal.skills.def = (tekton_normal.skills.def as f64 * 0.65) as u32;
                    tekton_enraged.skills.def = (tekton_enraged.skills.def as f64 * 0.65) as u32;
                    if tekton_normal.skills.def != tekton_enraged.skills.def {
                        return "{\"error\": \"Defences are not equal\"}".to_string();
                    }
                    tekton_hp -= hit;
                } else {
                    tekton_normal.skills.def = (tekton_normal.skills.def as f64 * 0.95) as u32;
                    tekton_enraged.skills.def = (tekton_enraged.skills.def as f64 * 0.95) as u32;
                    if tekton_normal.skills.def != tekton_enraged.skills.def {
                        return "{\"error\": \"Defences are not equal\"}".to_string();
                    }
                }
                total_ticks += 6;
                spec_count = false;
            }
            if player.gear_sets.melee.selected_weapon.as_ref().map(|w| w.name.as_str()) == Some("Elder maul") {
                ensure_weapon_swap(&mut player, &swapped_weapon, swapped_offhand.clone());
            }
            // Find best styles if not already found
            if best_style_normal.is_none() || best_style_enraged.is_none() {
                best_style_normal = Some(find_best_combat_style(&player, &tekton_normal, vec!["melee".to_string()]));
                best_style_enraged = Some(find_best_combat_style(&player, &tekton_enraged, vec!["melee".to_string()]));
                attack_speed_normal = best_style_normal.as_ref().unwrap().attack_speed as usize;
                attack_speed_enraged = best_style_enraged.as_ref().unwrap().attack_speed as usize;
            }

            let best_style_normal = match best_style_normal.as_ref() {
                Some(style) => style,
                None => return "{\"error\": \"No best style found (normal)\"}".to_string(),
            };
            let best_style_enraged = match best_style_enraged.as_ref() {
                Some(style) => style,
                None => return "{\"error\": \"No best style found (enraged)\"}".to_string(),
            };

            // --- PHASE LOOP TRANSLATION ---
            // Pre-anvil phase: (0, 5)
            let (hp1, ticks1, _, died1) = phase_loop(
                hit_count as usize,
                &attack_pattern[0],
                &mut tekton_hp,
                &mut current_phase_ticks,
                best_style_normal.attack_speed as usize,
                best_style_normal.accuracy,
                best_style_normal.max_hit as i32,
                &mut rng,
            );
            tekton_hp = hp1;
            current_phase_ticks = ticks1;

            // Save hp_pre_anvil_val at the end of pre-anvil phase
            if tekton_hp > 0 && first_pass {
                hp_pre_anvil_val = tekton_hp;
                first_pass = false;
                phase += 1;
            }
            if died1 || tekton_hp <= 0 {
                total_ticks += current_phase_ticks - 1;
                break;
            }

            let anvil_cycle = rng.gen_range(3..7);
            tekton_hp += (anvil_cycle * 5) as i32;
            total_ticks += ((anvil_cycle * 3) - best_style_normal.attack_speed as usize) as usize;
            if current_phase_ticks > 0 {
                total_ticks += current_phase_ticks - 1;
            }
            current_phase_ticks = 0;

            // Normal phase: (0, 3)
            let (hp2, ticks2, hit_count2, died2) = phase_loop(
                hit_count,
                &attack_pattern[1],
                &mut tekton_hp,
                &mut current_phase_ticks,
                best_style_normal.attack_speed as usize,
                best_style_normal.accuracy,
                best_style_normal.max_hit as i32,
                &mut rng,
            );
            tekton_hp = hp2;
            current_phase_ticks = ticks2;
            hit_count = hit_count2;
            if died2 || tekton_hp <= 0 {
                total_ticks += current_phase_ticks - 1;
                break;
            }
            // Add attack speed to account for the final attack
            current_phase_ticks += attack_speed_normal - 1;

            // Enraged phase: (4, 11)
            let (hp3, ticks3, hit_count3, died3) = phase_loop(
                hit_count,
                &attack_pattern[2],
                &mut tekton_hp,
                &mut current_phase_ticks,
                best_style_enraged.attack_speed as usize,
                best_style_enraged.accuracy,
                best_style_enraged.max_hit as i32,
                &mut rng,
            );
            tekton_hp = hp3;
            current_phase_ticks = ticks3;
            hit_count = hit_count3;
            if died3 || tekton_hp <= 0 {
                total_ticks += current_phase_ticks - 1;
                break;
            }
            total_ticks += current_phase_ticks - 1;
            current_phase_ticks = 0;
            hit_count = 0;
            phase += 1;
        }
        // Add initial delay and round up to next multiple of 4
        let initial_delay = delay; // Set as needed
        // Add attack speed to account for the final attack
        total_ticks += initial_delay + best_style_normal.as_ref().unwrap().attack_speed as usize;
        if total_ticks % 4 != 0 {
            total_ticks += 4 - (total_ticks % 4);
        }
        tick_counts[i] = total_ticks;
        phase_results[i] = phase;
        hp_pre_anvil[i] = hp_pre_anvil_val as usize;
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
    let mut encounter_kill_times = Vec::new();
    // let encounter_attack_speed = Some(best_style_normal.as_ref().unwrap().attack_speed as usize);
    let kill_times = kill_prob.clone();

    // let expected_hits = mean_ttk / best_style_normal.as_ref().unwrap().attack_speed as f64; // or however you calculate it
    let expected_ttk = mean_ttk;
    let expected_seconds = mean_ttk * 0.6; // 1 tick = 0.6 seconds

    // total_expected_hits += expected_hits;
    total_expected_ticks += expected_ttk;
    total_expected_seconds += expected_seconds;
    encounter_kill_times = kill_prob.clone();

    // Example: For Tekton (single monster)

    let monster_normal = &monsters[1];
    let result_normal = serde_json::json!({
        "monster_id": monster_normal.id,
        "monster_name": monster_normal.name,
        "expected_hits": 0.0,
        "expected_ticks": 0.0,
        "expected_seconds": 0.0,
        "combat_type": initial_best_style.attack_type,
        "attack_style": initial_best_style.combat_style,
        "kill_times": kill_times,
    });
    results.push(result_normal);

    let monster_enraged = &monsters[0];
    let result_enraged = serde_json::json!({
        "monster_id": monster_enraged.id,
        "monster_name": monster_enraged.name,
        "expected_hits": 0.0,
        "expected_ticks": 0.0,
        "expected_seconds": 0.0,
        "combat_type": initial_best_style_enraged.attack_type,
        "attack_style": initial_best_style_enraged.combat_style,
        "kill_times": kill_times,
    });
    results.push(result_enraged);


    // results.push(result_enraged);
    // if !results.is_empty() {
    //     return serde_json::json!({ "results": results }).to_string();
    // }




    // Convert encounter_kill_times to JSON object array
    // let attack_speed = encounter_attack_speed.unwrap_or(1);
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
        "total_hits": 0.0,
        "total_expected_ticks": total_expected_ticks,
        "total_expected_seconds": total_expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj,
        "phase_results": phase_results,
    }).to_string()
}

