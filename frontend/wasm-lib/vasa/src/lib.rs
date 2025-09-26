use rand::prelude::*;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

fn phase_loop(
    mut vasa_hp: usize,
    mut vasa_attack_tick: usize,
    attack_speed: usize,
    accuracy: f64,
    max_hit: usize,
    attack_pattern: &[usize; 2],
    mut total_ticks: usize,
    zaryte_crossbow: bool,
    rng: &mut ThreadRng,
) -> (usize, usize, usize, usize) {
    let mut hit_counter = 0;
    let mut pre_crystal_attacks = 0;
    while hit_counter <= attack_pattern[0] || hit_counter < attack_pattern[1] {
        vasa_attack_tick += 1;
        if zaryte_crossbow && (vasa_attack_tick - 1) == attack_speed {
            let spec_dmg = (vasa_hp as f64 * 0.22).floor() as usize;
            vasa_hp = vasa_hp.saturating_sub(spec_dmg);
            hit_counter += 1;
            pre_crystal_attacks += 1;
        } else {
            if (vasa_attack_tick - 1) % attack_speed == 0 {
                let mut hit = 0;
                if rng.gen::<f64>() < accuracy {
                    hit = rng.gen_range(0..=max_hit).max(1);
                }
                vasa_hp = vasa_hp.saturating_sub(hit);
                hit_counter += 1;
                pre_crystal_attacks += 1;
            }
        }
        if vasa_hp == 0 {
            total_ticks += vasa_attack_tick.saturating_sub(1);
            break;
        }
        if (vasa_attack_tick - 1) % 4 == 0 {
            vasa_hp = vasa_hp.saturating_sub(rng.gen_range(0..4));
        }
        if vasa_hp == 0 {
            total_ticks += vasa_attack_tick.saturating_sub(1);
            break;
        }
    }
    vasa_attack_tick += attack_speed;
    (vasa_hp, vasa_attack_tick, pre_crystal_attacks, total_ticks)
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_vasa(payload_json: &str) -> String {
    // Parse payload
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };
    let player = payload.player;
    let monsters = &payload.room.monsters;
    let room_methods = &payload.room.methods;
    let trials = 100000;
    let mut rng = rand::thread_rng();

    if monsters.len() < 2 {
        return "{\"error\": \"Room must have at least two monsters (Vasa and Crystal)\"}".to_string();
    }
    let vasa = &monsters[0];
    let crystal = &monsters[1];
    let best_style_vasa = find_best_combat_style(&player, vasa, vec!["ranged".to_string()]);
    let best_style_crystal = find_best_combat_style(&player, crystal, vec!["melee".to_string()]);

    let vasa_base_hp = vasa.skills.hp as usize;
    let vasa_max_hit = best_style_vasa.max_hit as usize;
    let vasa_accuracy = best_style_vasa.accuracy;
    let vasa_attack_speed = best_style_vasa.attack_speed as usize;

    let crystal_base_hp = crystal.skills.hp as usize;
    let crystal_max_hit = best_style_crystal.max_hit as usize;
    let crystal_accuracy = best_style_crystal.accuracy;
    let crystal_attack_speed = best_style_crystal.attack_speed as usize;
    let mut phase_results: Vec<usize> = vec![0; trials];
    let mut tick_counts: Vec<usize> = vec![0; trials];
    let base_max_attacks_crystal = 70;
    let (initial_delay, attack_pattern): (usize, Vec<[usize; 2]>) = if room_methods.len() > 0 && room_methods[0] == "Flame Skip" {
        (22, vec![[0, 5], [0, 3], [0, 7]])
    } else {
        (29, vec![[0, 4], [0, 3], [0, 7]])
    };
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    let zaryte_crossbow = inventory_items.iter().any(|item| item.name == "Zaryte crossbow");

    for i in 0..trials {
        let mut vasa_hp = vasa_base_hp;
        let mut crystal_hp;
        let mut max_attacks_crystal = base_max_attacks_crystal;
        let mut vasa_attack_tick = 0;
        let mut crystal_attacks = 0;
        let mut crystal_count = 0;
        let mut healing_ticks;
        let mut total_ticks = 0;
        let mut pre_crystal_attacks = 0;

        while vasa_hp > 0 {
            crystal_hp = crystal_base_hp;
            if pre_crystal_attacks < 4 {
                let (new_vasa_hp, new_vasa_attack_tick, new_pre_crystal_attacks, new_total_ticks) = phase_loop(
                    vasa_hp, vasa_attack_tick, vasa_attack_speed, vasa_accuracy, vasa_max_hit, &attack_pattern[0], total_ticks, zaryte_crossbow, &mut rng
                );
                vasa_hp = new_vasa_hp;
                vasa_attack_tick = new_vasa_attack_tick;
                pre_crystal_attacks = new_pre_crystal_attacks;
                total_ticks = new_total_ticks;
            }
            crystal_count += 1;
            healing_ticks = 0;

            while crystal_hp > 0 {
                crystal_attacks += crystal_attack_speed;
                healing_ticks += crystal_attack_speed;
                let mut hit_crystal = 0;
                if rng.gen::<f64>() < crystal_accuracy {
                    hit_crystal = rng.gen_range(0..=crystal_max_hit).max(1);
                }
                crystal_hp = crystal_hp.saturating_sub(hit_crystal);
                if crystal_attacks >= max_attacks_crystal {
                    healing_ticks = healing_ticks / 2;
                    let heal_amount = (vasa_base_hp as f64 * 0.01).floor() as usize * healing_ticks;
                    vasa_hp += heal_amount;
                    vasa_hp = std::cmp::min(vasa_hp, vasa_base_hp);
                    let (new_vasa_hp, new_vasa_attack_tick, _, new_total_ticks) = phase_loop(
                        vasa_hp, vasa_attack_tick, vasa_attack_speed, vasa_accuracy, vasa_max_hit, &attack_pattern[1], total_ticks, false, &mut rng
                    );
                    vasa_hp = new_vasa_hp;
                    vasa_attack_tick = new_vasa_attack_tick;
                    total_ticks = new_total_ticks;
                    if vasa_hp <= 0 {
                        break;
                    }
                    total_ticks += 12 + crystal_attacks - base_max_attacks_crystal;
                    max_attacks_crystal += base_max_attacks_crystal;
                    crystal_attacks = 0;
                    healing_ticks = 0;
                }
                if crystal_hp <= 0 {
                    total_ticks += crystal_attacks;
                    break;
                }
            }
            if vasa_attack_tick > 0 {
                total_ticks += vasa_attack_tick - 1;
            }
            vasa_attack_tick = 0;
            let (new_vasa_hp, new_vasa_attack_tick, _, new_total_ticks) = phase_loop(
                vasa_hp, vasa_attack_tick, vasa_attack_speed, vasa_accuracy, vasa_max_hit, &attack_pattern[2], total_ticks, false, &mut rng
            );
            vasa_hp = new_vasa_hp;
            vasa_attack_tick = new_vasa_attack_tick;
            total_ticks = new_total_ticks;
            if vasa_hp <= 0 {
                break;
            }
        }
        total_ticks += initial_delay;
        if total_ticks % 4 != 0 {
            total_ticks += 4 - (total_ticks % 4);
        }
        phase_results[i] = crystal_count;
        tick_counts[i] = total_ticks;
    }
    let mean_ttk = tick_counts.iter().sum::<usize>() as f64 / trials as f64;
    // let std_ttk = ... (unused)
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

    // For encounter_kill_times_obj
    let kill_prob_by_tick = kill_prob.clone();
    let tick_list: Vec<usize> = (0..=max_ticks).collect();


    // Collect results for each monster (if you have more than one)
    let encounter_attack_speed = vasa_attack_speed; // or whatever is appropriate
    let kill_times = kill_prob.clone();

    let expected_hits = mean_ttk / encounter_attack_speed as f64; // or however you calculate it
    let expected_ttk = mean_ttk;
    let expected_seconds = mean_ttk * 0.6; // 1 tick = 0.6 seconds

    let vasa_result = serde_json::json!({
        "monster_id": vasa.id,
        "monster_name": vasa.name,
        "expected_hits": expected_hits,
        "expected_ticks": expected_ttk,
        "expected_seconds": expected_seconds,
        "combat_type": best_style_vasa.attack_type,
        "attack_style": best_style_vasa.combat_style,
        "kill_times": kill_times,
    });

    // Results for Crystal (example, you may want to use actual values for crystal)
    let crystal_result = serde_json::json!({
        "monster_id": crystal.id,
        "monster_name": crystal.name,
        "expected_hits": 0.0, // Replace with actual expected hits for crystal if available
        "expected_ticks": 0.0, // Replace with actual expected ticks for crystal if available
        "expected_seconds": 0.0, // Replace with actual expected seconds for crystal if available
        "combat_type": best_style_crystal.attack_type,
        "attack_style": best_style_crystal.combat_style,
        "kill_times": Vec::<f64>::new(), // Replace with actual kill times for crystal if available
    });

    let results = vec![vasa_result, crystal_result];

    // Encounter kill times (for plotting, etc.)
    let encounter_kill_times_obj: Vec<serde_json::Value> = kill_prob_by_tick.iter().enumerate()
        .map(|(idx, &prob)| {
            serde_json::json!({
                "tick": tick_list[idx],
                "probability": prob
            })
        })
        .collect();

    let total_expected_hits = expected_hits;
    let total_expected_ticks = expected_ttk;
    let total_expected_seconds = expected_seconds;

    serde_json::json!({
        "results": results,
        "total_hits": total_expected_hits,
        "total_expected_ticks": total_expected_ticks,
        "total_expected_seconds": total_expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj,
        "phase_results": phase_results,
    }).to_string()
}