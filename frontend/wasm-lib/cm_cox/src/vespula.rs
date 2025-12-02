use rand::prelude::*;
use wasm_bindgen::prelude::*;
use rand::rngs::SmallRng;
use rand::SeedableRng;
use osrs_shared_types::*;
use osrs_shared_functions::*;


pub fn simulate_vespula<R: rand::RngCore, F: FnMut(i32) -> i32>(
    payload: &DPSRoomPayload,
    mut hit_provider: F,
    rng: &mut R,
    trials: usize,
    bypass_accuracy: bool,
) -> String {
    let player = &payload.player;
    let mut monsters = payload.room.monsters.clone();
    for monster in &mut monsters {
        if player.combat_stats.hitpoints != 99 {
            monster.skills.hp = monster_hp_scaling(monster, &player.combat_stats);
        }
        monster.skills = monster_stat_scaling(monster, player.combat_stats.hitpoints);
    }

    let mut freq: Vec<usize> = Vec::new();
    let mut sum_ticks: i64 = 0;
    let walk_delay = 32;
    let death_animation = 3;
    let best_style = find_best_combat_style(&player, &monsters[0], vec!["magic".to_string(), "ranged".to_string()]);
    let max_hit = best_style.max_hit;
    let accuracy = best_style.accuracy;
    let attack_speed = best_style.attack_speed;
    let base_hp = monsters[0].skills.hp;
    let mut single_monster_ticks : Vec<f64> = Vec::new();
    let hit_delay = if best_style.gear_type == "ranged" { 2 } else if best_style.gear_type == "magic" && player.gear_sets.mage.selected_weapon.as_ref().map(|w| w.name.as_str()) == Some("Tumeken's shadow") { 5 } else { 4 };
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    let zaryte_crossbow = inventory_items.iter().any(|item| item.name == "Zaryte crossbow");

    for _ in 0..trials {
        let mut tick = 0;
        for _monster in &monsters {
            let mut hp = base_hp;
            let mut ticks_this_monster = 0;
            while hp > 0 {
                tick += 1;
                ticks_this_monster += 1;
                if zaryte_crossbow && (tick - 1) == attack_speed {
                    let spec_dmg = (base_hp as f64 * 0.22).floor() as i32;
                    hp -= spec_dmg;
                } else {
                    if (tick - 1) % attack_speed == 0 {
                        let hit = if bypass_accuracy || rng.gen::<f64>() < accuracy {
                            hit_provider(max_hit)
                        } else {
                            0
                        };
                        hp -= hit;
                    }
                }
                if hp <= 0 {
                    break;
                }
            }
            ticks_this_monster += hit_delay;
            single_monster_ticks.push(ticks_this_monster as f64);
        }
        tick += walk_delay + hit_delay + 1 + death_animation;
        tick += rng.gen_range(0..4);
        sum_ticks += i64::from(tick);
        let idx = tick as usize;
        if idx >= freq.len() {
            freq.resize(idx + 1, 0);
        }
        freq[idx] += 1;
    }
    // Defensive: Check tick_counts
    if freq.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }
    let style_list = vec![best_style.clone()];
    let end_results = results_formatter(&monsters, &style_list, sum_ticks, freq, trials, Vec::new(), Vec::new());
    println!("End results: {}", end_results);
    end_results
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_vespula(payload_json: &str) -> String {
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };
    let mut rng_hit = SmallRng::from_entropy();
    let mut rng_tick = SmallRng::from_entropy();
    simulate_vespula(
        &payload,
        |max_hit| rng_hit.gen_range(0..=max_hit).max(1),
        &mut rng_tick,
        100_000,
        false,
    )
}