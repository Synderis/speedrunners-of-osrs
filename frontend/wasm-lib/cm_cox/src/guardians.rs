use rand::prelude::*;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

#[wasm_bindgen]
pub fn calculate_dps_with_objects_guardians(payload_json: &str) -> String {

    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    // Make mutable copies for gear/inventory mutation
    let mut player = payload.player;
    let monsters = payload.room.monsters;

    // --- Ensure pickaxe is equipped in melee gear if present in inventory ---
    // Collect inventory weapons (flattened from inventory items with equipment)
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    // Find Avernic defender in inventory items
    let avernic_defender = inventory_items.iter().find(|item| item.name == "Avernic defender").cloned();
    // ensure_pickaxe_equipped(&mut player.gear_sets.melee, &inventory_items);
    ensure_weapon_swap(&mut player, "Dragon pickaxe", avernic_defender);
    
    let trials = 100000;
    let mut rng = rand::thread_rng();
    let walk_delay = 28;
    let mut tick_counts: Vec<i32> = vec![0; trials];

    let best_style = find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]);
    let max_hit = best_style.max_hit;
    let accuracy = best_style.accuracy;
    let attack_speed = best_style.attack_speed;
    let base_hp = monsters[0].skills.hp;
    let mut single_monster_ticks : Vec<f64> = Vec::new();

    for i in 0..trials {
        let mut tick = 0;
        for _ in &monsters {
            let mut hp = base_hp;
            let mut ticks_this_monster = 0;
            while hp > 0 {
                tick += 1;
                ticks_this_monster += 1;
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
        if (tick - 1) % 4 != 0 {
            tick += 4 - ((tick - 1) % 4);
        }
        tick_counts[i] = tick + walk_delay;
    }
    // Defensive: Check tick_counts
    if tick_counts.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }
    // let single_monster_ticks_mean = single_monster_ticks.iter().sum::<f64>() / single_monster_ticks.len() as f64;
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
    let mean_ttk = tick_counts.iter().sum::<i32>() as f64 / trials as f64;

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
        "total_expected_ticks": total_expected_ticks,
        "total_expected_seconds": total_expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj,
        "phase_results": [],
    }).to_string()
}