use rand::prelude::*;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

fn sim_freeze_mutta(
        mut total_ticks: i32,
        mut hp_mutta: i32,
        mutta: &Monster,
        best_style_mutta: &StyleResult,
        zgs_best_style: &StyleResult,
        rng: &mut ThreadRng,
    ) -> i32 {
    while hp_mutta > (mutta.skills.hp as f64 * 0.4) as i32 {
        let hit = if rng.gen::<f64>() < best_style_mutta.accuracy {
            rng.gen_range(0..=best_style_mutta.max_hit).max(1)
        } else {
            0
        };
        total_ticks += best_style_mutta.attack_speed;
        hp_mutta -= hit;
    }

    // Attempt to freeze with ZGS if miss add ticks and heal mutta
    if rng.gen::<f64>() > zgs_best_style.accuracy {
        hp_mutta += (mutta.skills.hp / 2).min(mutta.skills.hp - hp_mutta);
    } else {
        let hit = rng.gen_range(0..=zgs_best_style.max_hit).max(1);
        hp_mutta -= hit;
    }
    total_ticks += 6;
    // Continue attacking until dead
    while hp_mutta > 0 {
        let hit = if rng.gen::<f64>() < best_style_mutta.accuracy {
            rng.gen_range(0..=best_style_mutta.max_hit).max(1)
        } else {
            0
        };
        total_ticks += best_style_mutta.attack_speed;
        hp_mutta -= hit;
    }
    total_ticks
}
fn sim_chop_tree(
        player: &Player, 
        mut total_ticks: i32, 
        mut tree_hp: i32, 
        tree_accuracy: f64, 
        mut hp_small_mutta: i32, 
        base_small_mutta_hp: i32, 
        best_style_small_mutta: &StyleResult, 
        rng: &mut ThreadRng,
    ) -> (i32, i32) {
    while tree_hp > 0 {
        let mut tree_hit = 0;
        if rng.gen::<f64>() < tree_accuracy {
            tree_hit = rng.gen_range(0..=player.combat_stats.woodcutting);
        }
        // Small mutta can be hit if it's above half HP
        if base_small_mutta_hp / 2 < best_style_small_mutta.max_hit + hp_small_mutta {
            let hit = if rng.gen::<f64>() < best_style_small_mutta.accuracy {
                rng.gen_range(0..=best_style_small_mutta.max_hit).max(1)
            } else {
                0
            };
            hp_small_mutta -= hit;
        }
        tree_hp -= tree_hit;
        if tree_hp < 0 {
            break;
        }
        total_ticks += best_style_small_mutta.attack_speed;
    }
    let phase_ticks = total_ticks;
    total_ticks += best_style_small_mutta.attack_speed;
    // Finish off small mutta
    while hp_small_mutta > 0 {
        let hit = if rng.gen::<f64>() < best_style_small_mutta.accuracy {
            rng.gen_range(0..=best_style_small_mutta.max_hit).max(1)
        } else {
            0
        };
        total_ticks += best_style_small_mutta.attack_speed;
        hp_small_mutta -= hit;
    }
    (total_ticks, (phase_ticks + 1))
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_mutta(payload_json: &str) -> String {
    use rand::Rng;

    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let mut player = payload.player;
    let mut monsters = payload.room.monsters;
    let trials = 100_000;
    let mut rng = rand::thread_rng();
    for monster in &mut monsters {
        if player.combat_stats.hitpoints != 99 {
            monster.skills.hp = monster_hp_scaling(monster, &player.combat_stats);
        }
        monster.skills = monster_stat_scaling(monster, player.combat_stats.hitpoints);
    }
    

    // Defensive: Check monsters
    if monsters.len() < 2 {
        return "{\"error\": \"Muttadile simulation requires two monsters (small and large)}\"".to_string();
    }
    let mut zgs_best_style = None;
    let has_zgs = player.inventory.iter().any(|item| item.name.to_lowercase().contains("zamorak godsword"));
    if has_zgs {
        let swap_result = ensure_weapon_swap(&mut player, "Zamorak godsword", None);
        let (swapped_weapon, swapped_offhand) = match swap_result {
            Some((w, o)) => (w, o),
            None => {
                return "{\"error\": \"Elder maul not found in inventory\"}".to_string();
            }
        };
        zgs_best_style = Some(find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]));
        ensure_weapon_swap(&mut player, &swapped_weapon, swapped_offhand.clone());
    }


    // Small Mutta (magic)
    let best_style_small_mutta = find_best_combat_style(&player, &monsters[0], vec!["magic".to_string()]);
    let base_small_mutta_hp = monsters[0].skills.hp;
    let attack_speed_small_mutta = player.gear_sets.mage.selected_weapon.as_ref().map(|w| w.speed).unwrap_or(4);

    // Large Mutta (ranged)
    let best_style_large_mutta = find_best_combat_style(&player, &monsters[1], vec!["ranged".to_string()]);
    let base_large_mutta_hp = monsters[1].skills.hp;
    let attack_speed_large_mutta = player.gear_sets.ranged.selected_weapon.as_ref().map(|w| w.speed).unwrap_or(4);

    // Tree
    let wc_level = player.combat_stats.woodcutting;
    let tree_accuracy = (1.0 + ((((50.0 * (99.0 - wc_level as f64)) / 98.0) + ((200.0 * (wc_level as f64 - 1.0)) / 98.0) + 0.5)).floor()) / 256.0;
    let base_tree_hp = wc_level * 5;
    let death_animation = 4;
    let post_room_delay = 4;
    let hit_delay = 1;
    let hit_delay_small_mutta = if player.gear_sets.mage.selected_weapon.as_ref().unwrap().name == "Tumeken's shadow" { 2 } else { 1 };

    let mut tick_counts: Vec<i32> = vec![0; trials];
    let mut phase_results: Vec<i32> = vec![0; trials];

    for i in 0..trials {
        let mut hp_large_mutta = base_large_mutta_hp;
        let hp_small_mutta = base_small_mutta_hp;
        let tree_hp = base_tree_hp;
        let mut total_ticks = 0;
        let range_max = if attack_speed_large_mutta > 4 { 4 * attack_speed_large_mutta } else { 4 };
        let overkill_large_mutta = if rng.gen_range(1..=range_max) == 1 { 1 } else { 0 };
        let tick_cycle_offset = rng.gen_range(0..=4);
        if has_zgs {
            total_ticks = sim_freeze_mutta(total_ticks, hp_small_mutta, &monsters[0], &best_style_small_mutta, zgs_best_style.as_ref().unwrap(), &mut rng);
            total_ticks -= attack_speed_small_mutta;
            total_ticks += 1 + hit_delay_small_mutta;
            total_ticks += tick_cycle_offset;
            // Large mutta leaving the lake
            total_ticks += 5;
            total_ticks = sim_freeze_mutta(total_ticks, hp_large_mutta, &monsters[1], &best_style_large_mutta, zgs_best_style.as_ref().unwrap(), &mut rng);
            phase_results[i] = 0;
        } else {
            let (new_total_ticks, phase_ticks) = sim_chop_tree(&player, total_ticks, tree_hp, tree_accuracy, hp_small_mutta, base_small_mutta_hp, &best_style_small_mutta, &mut rng);
            phase_results[i] = phase_ticks;
            total_ticks = new_total_ticks;
            total_ticks -= attack_speed_small_mutta;
            total_ticks += 1 + hit_delay_small_mutta;
            total_ticks += tick_cycle_offset;
            // Large mutta leaving the lake
            total_ticks += 5;
            while hp_large_mutta > 0 {
                let hit = if rng.gen::<f64>() < best_style_large_mutta.accuracy {
                    rng.gen_range(0..=best_style_large_mutta.max_hit).max(1)
                } else {
                    0
                };
                total_ticks += attack_speed_large_mutta;
                hp_large_mutta -= hit;
            }
        }
        total_ticks -= attack_speed_large_mutta;
        total_ticks += 1 + hit_delay + death_animation - overkill_large_mutta + post_room_delay;
        // Align to next 4-tick cycle starting at the tick_cycle_offset
        total_ticks += (tick_cycle_offset + 4 - (total_ticks % 4)) % 4;
        tick_counts[i] = total_ticks;
    }

    // Calculate kill probability and stats
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


    let monster_enraged = &monsters[1];
    let result_enraged = serde_json::json!({
        "monster_id": monster_enraged.id,
        "monster_name": monster_enraged.name,
        "expected_ticks": expected_ttk,
        "expected_seconds": expected_seconds,
        "combat_type": best_style_large_mutta.attack_type,
        "attack_style": best_style_large_mutta.combat_style,
        "kill_times": kill_times,
    });
    results.push(result_enraged);
    let monster_normal = &monsters[0];
    let result_normal = serde_json::json!({
        "monster_id": monster_normal.id,
        "monster_name": monster_normal.name,
        "expected_ticks": expected_ttk,
        "expected_seconds": expected_seconds,
        "combat_type": best_style_small_mutta.attack_type,
        "attack_style": best_style_small_mutta.combat_style,
        "kill_times": kill_times,
    });
    results.push(result_normal);
    // Convert encounter_kill_times to JSON object array
    // let attack_speed = small_mutta_attack_speed;
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
        "phase_results": phase_results,
    }).to_string()
}

