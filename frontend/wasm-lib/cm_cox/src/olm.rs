use rand::prelude::*;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

fn phase_loop(
    hp: &mut i32,
    current_phase_ticks: &mut i32,
    attack_speed: i32,
    accuracy: f64,
    max_hit: i32,
    weapon_name: &str,
    rng: &mut ThreadRng,
) -> i32 {
    let mut ticks_spent = 0;
    // Rust translation of the provided Python phase_loop
    while *hp > 0 {
        ticks_spent += 1;
        *current_phase_ticks += 1;
        if (*current_phase_ticks - 1) % attack_speed == 0 {
            let hit = dmg_modifier_check(rng, max_hit, accuracy, weapon_name);
            *hp -= hit;
        }
        if *hp <= 0 {
            break;
        }
        if (*current_phase_ticks - 1) % 4 == 0 {
            *hp -= rng.gen_range(0..=3);
        }
        if *hp <= 0 {
            break;
        }
    }
    *current_phase_ticks += attack_speed - 1;
    ticks_spent += attack_speed - 1;
    ticks_spent
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_olm(payload_json: &str) -> String {
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
    let trials = 100000;
    let mut rng = rand::thread_rng();

    // Defensive: Check monsters
    if monsters.is_empty() {
        return "{\"error\": \"No monsters in payload\"}".to_string();
    }

    let best_style_mage = find_best_combat_style(&player, &monsters[0], vec!["magic".to_string()]);
    let best_style_melee = find_best_combat_style(&player, &monsters[1], vec!["melee".to_string()]);
    let best_style_ranged = find_best_combat_style(&player, &monsters[2], vec!["ranged".to_string()]);


    let swap_result = ensure_weapon_swap(&mut player, "Elder maul", None);
    let (swapped_weapon, swapped_offhand) = match swap_result {
        Some((w, o)) => (w, o),
        None => {
            return "{\"error\": \"Elder maul not found in inventory\"}".to_string();
        }
    };
    let best_style_spec = find_best_combat_style(&player, &monsters[1], vec!["melee".to_string()]);

    if player.gear_sets.melee.selected_weapon.as_ref().map(|w| w.name.as_str()) == Some("Elder maul") {
        ensure_weapon_swap(&mut player, &swapped_weapon, swapped_offhand.clone());
    }
    let weapon_name = &player.gear_sets.melee.selected_weapon.as_ref().unwrap().name;

    let mut olm_melee_hand_specced = monsters[1].clone();
    olm_melee_hand_specced.skills.def = (olm_melee_hand_specced.skills.def as f64 * 0.65).ceil() as i32;
    let best_style_specced = find_best_combat_style(&player, &olm_melee_hand_specced, vec!["melee".to_string()]);
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    let zaryte_crossbow = inventory_items.iter().any(|item| item.name == "Zaryte crossbow");
    // let burning_claws = inventory_items.iter().any(|item| item.name == "Burning claws");

    // Prepare simulation
    let mut tick_counts: Vec<i32> = vec![0; trials];
    let mut phase_results: Vec<i32> = Vec::new();

    let delay_list = vec![22, 38, 39];

    for i in 0..trials {
        let mut total_ticks = 0;
        let mut ranged_hp = monsters[2].skills.hp;
        let mut current_phase_ticks = 0;
        for phase in 0..3 {
            let mut mage_hp = monsters[0].skills.hp;
            let mut melee_hp = monsters[1].skills.hp;
            let mage_ticks;
            let mut melee_ticks;
            let mut spec_hit = false;
            current_phase_ticks = 0;

            mage_ticks = phase_loop(
                &mut mage_hp,
                &mut current_phase_ticks,
                best_style_mage.attack_speed,
                best_style_mage.accuracy,
                best_style_mage.max_hit,
                "Mage".to_string().as_str(),
                &mut rng,
            );
            if rng.gen::<f64>() < best_style_spec.accuracy {
                spec_hit = true;
                melee_hp -= rng.gen_range(0..=best_style_spec.max_hit).max(1);
            };
            if spec_hit {
                melee_ticks = phase_loop(
                    &mut melee_hp,
                    &mut current_phase_ticks,
                    best_style_specced.attack_speed,
                    best_style_specced.accuracy,
                    best_style_specced.max_hit,
                    weapon_name,
                    &mut rng,
                );
            } else {
                melee_ticks = phase_loop(
                    &mut melee_hp,
                    &mut current_phase_ticks,
                    best_style_melee.attack_speed,
                    best_style_melee.accuracy,
                    best_style_melee.max_hit,
                    weapon_name,
                    &mut rng,
                );
            };
            melee_ticks += 6; // Add 6 ticks for spec delay
            total_ticks += mage_ticks + melee_ticks;
            total_ticks += delay_list[phase];
            phase_results.push(melee_ticks + mage_ticks);
        };
        if zaryte_crossbow {
            let spec_dmg = (ranged_hp as f64 * 0.22).floor() as i32;
            ranged_hp -= spec_dmg;
            current_phase_ticks += 5;
        }
        let mut ranged_ticks = phase_loop(
            &mut ranged_hp,
            &mut current_phase_ticks,
            best_style_ranged.attack_speed,
            best_style_ranged.accuracy,
            best_style_ranged.max_hit,
            "Ranged".to_string().as_str(),
            &mut rng,
        );
        if zaryte_crossbow {
            ranged_ticks += 5;
        }
        total_ticks += ranged_ticks;
        if total_ticks % 4 != 0 {
            total_ticks += 4 - (total_ticks % 4);
        };
        tick_counts[i] = total_ticks;
    }


    // Defensive: Check tick_counts
    if tick_counts.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }

    // Compute statistics
    let mean_ttk = tick_counts.iter().sum::<i32>() as f64 / trials as f64;

    // Build cumulative kill probability
    let max_ticks = *tick_counts.iter().max().unwrap_or(&0);
    let mut kill_prob = vec![0.0f64; (max_ticks + 1) as usize];
    for &ticks in &tick_counts {
        for idx in ticks..=max_ticks {
            kill_prob[idx as usize] += 1.0;
        }
    }
    for prob in &mut kill_prob {
        *prob /= trials as f64;
    }

    // Collect results for each monster (if you have more than one)
    let mut results = Vec::new();
    let mut total_expected_ticks = 0.0;
    let mut total_expected_seconds = 0.0;
    let encounter_kill_times = kill_prob.clone();
    let kill_times = kill_prob.clone();
    let expected_ttk = mean_ttk;
    let expected_seconds = mean_ttk * 0.6; // 1 tick = 0.6 seconds

    total_expected_ticks += expected_ttk;
    total_expected_seconds += expected_seconds;

    // Example: For Tekton (single monster)

    let mage_hand = &monsters[0];
    let result_mage = serde_json::json!({
        "monster_id": mage_hand.id,
        "monster_name": mage_hand.name,
        "expected_ticks": expected_ttk,
        "expected_seconds": expected_seconds,
        "combat_type": best_style_mage.attack_type,
        "attack_style": best_style_mage.combat_style,
        "kill_times": kill_times,
    });
    results.push(result_mage);

    let melee_hand = &monsters[1];
    let result_melee = serde_json::json!({
        "monster_id": melee_hand.id,
        "monster_name": melee_hand.name,
        "expected_ticks": expected_ttk,
        "expected_seconds": expected_seconds,
        "combat_type": best_style_melee.attack_type,
        "attack_style": best_style_melee.combat_style,
        "kill_times": kill_times,
    });
    results.push(result_melee);

    let ranged_hand = &monsters[2];
    let result_ranged = serde_json::json!({
        "monster_id": ranged_hand.id,
        "monster_name": ranged_hand.name,
        "expected_ticks": expected_ttk,
        "expected_seconds": expected_seconds,
        "combat_type": best_style_ranged.attack_type,
        "attack_style": best_style_ranged.combat_style,
        "kill_times": kill_times,
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
        "total_expected_ticks": total_expected_ticks,
        "total_expected_seconds": total_expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj,
        "phase_time_results": phase_results,
        "phase_results": [],
    }).to_string()
}

