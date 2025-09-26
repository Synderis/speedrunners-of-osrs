use rand::prelude::*;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

fn ensure_item_equipped(
    gear_set: &mut GearSetData,
    inventory: &[SelectedItem],
    _item_name: &str, // item_name is not needed anymore
) {
    // Prefer salve (slot == "neck" and name contains "salve"), else slayer helm (slot == "head" and name contains "slayer")
    let item = if let Some(salve) = inventory.iter().find(|item| item.slot == "neck" && item.name.to_lowercase().contains("salve")) {
        salve
    } else if let Some(slayer_helm) = inventory.iter().find(|item| item.slot == "head" && item.name.to_lowercase().contains("slayer")) {
        slayer_helm
    } else {
        return;
    };

    // Remove any existing item from the relevant slot and subtract its bonuses
    let target_slot = &item.slot;
    let mut i = 0;
    while i < gear_set.gear_items.len() {
        if let Some(existing) = &gear_set.gear_items[i] {
            if &existing.slot == target_slot {
                if let (Some(bonuses), Some(offensive), Some(defensive)) = (
                    existing.bonuses.as_ref(),
                    existing.offensive.as_ref(),
                    existing.defensive.as_ref(),
                ) {
                    gear_set.gear_stats.bonuses.str -= bonuses.str;
                    gear_set.gear_stats.bonuses.ranged_str -= bonuses.ranged_str;
                    gear_set.gear_stats.bonuses.magic_str -= bonuses.magic_str / 10;
                    gear_set.gear_stats.bonuses.prayer -= bonuses.prayer;
                    gear_set.gear_stats.offensive.stab -= offensive.stab;
                    gear_set.gear_stats.offensive.slash -= offensive.slash;
                    gear_set.gear_stats.offensive.crush -= offensive.crush;
                    gear_set.gear_stats.offensive.magic -= offensive.magic;
                    gear_set.gear_stats.offensive.ranged -= offensive.ranged;
                    gear_set.gear_stats.defensive.stab -= defensive.stab;
                    gear_set.gear_stats.defensive.slash -= defensive.slash;
                    gear_set.gear_stats.defensive.crush -= defensive.crush;
                    gear_set.gear_stats.defensive.magic -= defensive.magic;
                    gear_set.gear_stats.defensive.ranged -= defensive.ranged;
                }
                gear_set.gear_items.remove(i);
                continue;
            }
        }
        i += 1;
    }

    // Add the selected item to gear_items as equipped
    gear_set.gear_items.push(Some(item.clone()));

    // Add item's bonuses to gear
    if let (Some(bonuses), Some(offensive), Some(defensive)) = (
        item.bonuses.as_ref(),
        item.offensive.as_ref(),
        item.defensive.as_ref(),
    ) {
        gear_set.gear_stats.bonuses.str += bonuses.str;
        gear_set.gear_stats.bonuses.ranged_str += bonuses.ranged_str;
        gear_set.gear_stats.bonuses.magic_str += bonuses.magic_str;
        gear_set.gear_stats.bonuses.prayer += bonuses.prayer;
        gear_set.gear_stats.offensive.stab += offensive.stab;
        gear_set.gear_stats.offensive.slash += offensive.slash;
        gear_set.gear_stats.offensive.crush += offensive.crush;
        gear_set.gear_stats.offensive.magic += offensive.magic;
        gear_set.gear_stats.offensive.ranged += offensive.ranged;
        gear_set.gear_stats.defensive.stab += defensive.stab;
        gear_set.gear_stats.defensive.slash += defensive.slash;
        gear_set.gear_stats.defensive.crush += defensive.crush;
        gear_set.gear_stats.defensive.magic += defensive.magic;
        gear_set.gear_stats.defensive.ranged += defensive.ranged;
    }
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_mystics(payload_json: &str) -> String {
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let mut player = payload.player;
    let monsters = payload.room.monsters;

    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    let mut sets = [
        ("magic", &mut player.gear_sets.mage),
        ("ranged", &mut player.gear_sets.ranged),
    ];

    for (_, gear_set) in sets.iter_mut() {
        ensure_item_equipped(gear_set, &inventory_items, "salve");
    }

    // let walk_delay = 24;
    let trials = 100000;
    let walk_delay = 0;
    let death_animation = 4;
    let mut tick_counts = vec![0usize; trials];
    let mut rng = rand::thread_rng();

    let best_style = find_best_combat_style(&player, &monsters[0], vec!["magic".to_string(), "ranged".to_string()]);
    let max_hit = best_style.max_hit as i32;
    let accuracy = best_style.accuracy;
    let attack_speed = best_style.attack_speed as usize;
    let base_hp = monsters[0].skills.hp as i32;
    let mut single_monster_ticks : Vec<f64> = Vec::new();
    let hit_delay = if player.gear_sets.mage.selected_weapon.as_ref().unwrap().name == "Tumeken's shadow" { 2 } else { 1 };
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();

    let voidwaker = inventory_items.iter().any(|item| item.name == "Voidwaker");

    if voidwaker {
        let avernic_defender = inventory_items.iter().find(|item| item.name == "Avernic defender").cloned();
        ensure_weapon_swap(&mut player, "Voidwaker", avernic_defender);
    }
    let best_style_spec = find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]);

    for i in 0..trials {
        let mut tick = 0;
        let mut spec_count = if voidwaker { 1 } else { 0 };
        for _monster in &monsters {
            let mut hp = base_hp;
            let mut ticks_this_monster = 0;
            while hp > 0 {
                tick += 1;
                ticks_this_monster += 1;
                if (tick - 1) % 4 == 0 {
                    let hit = rng.gen_range(0..=3);
                    hp -= hit;
                }
                if hp <= 0 {
                    break;
                }
                if spec_count > 0 {
                    let lower_bound = (best_style_spec.max_hit as f64 * 0.5).floor() as i32;
                    let upper_bound = (best_style_spec.max_hit as f64 * 1.5).floor() as i32;
                    let hit = rng.gen_range(lower_bound..=upper_bound);
                    hp -= hit;
                    spec_count -= 1;
                    tick += 4;
                    continue;
                }
                if (tick - 1) % attack_speed == 0 {
                    let hit = if rng.gen::<f64>() < accuracy {
                        rng.gen_range(0..=max_hit).max(1)
                    } else {
                        0
                    };
                    hp -= hit;
                }
                if hp <= 0 {
                    break;
                }
            }
            tick += attack_speed - 1;
            ticks_this_monster += attack_speed - 1;
            single_monster_ticks.push(ticks_this_monster as f64);
        }
        tick -= attack_speed - 1;
        tick += hit_delay + 1 + death_animation;
        tick += 4 - (tick % 4);
        tick_counts[i] = tick;
    }
    // Defensive: Check tick_counts
    if tick_counts.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }

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
    let mean_ttk = tick_counts.iter().sum::<usize>() as f64 / trials as f64;

    // Collect results for each monster (if you have more than one)
    let mut total_expected_ticks = 0.0;
    let mut total_expected_seconds = 0.0;
    let encounter_kill_times = kill_prob.clone();
    let kill_times = kill_prob.clone();

    let expected_ttk = mean_ttk;
    let expected_seconds = mean_ttk * 0.6; // 1 tick = 0.6 seconds

    total_expected_ticks += expected_ttk;
    total_expected_seconds += expected_seconds;
    let mut results = Vec::new();

    for monster in &monsters {
        let result = serde_json::json!({
            "monster_id": monster.id,
            "monster_name": monster.name,
            "expected_hits": 0.0,
            "expected_ticks": 0.0,
            "expected_seconds": 0.0,
            "combat_type": best_style.attack_type,
            "attack_style": best_style.combat_style,
            "kill_times": kill_times,
        });
        results.push(result);
    }
    
    // Convert encounter_kill_times to JSON object array
    let encounter_kill_times_obj: Vec<serde_json::Value> = encounter_kill_times.iter().enumerate()
        .map(|(idx, &prob)| {
            serde_json::json!({
                "tick": idx,
                "probability": prob
            })
        })
        .collect();

    serde_json::json!({
        "results": results,
        "total_hits": 0.0,
        "total_expected_ticks": total_expected_ticks,
        "total_expected_seconds": total_expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj,
        "phase_results": [],
    }).to_string()
}