use rand::prelude::*;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;
use web_sys::console;

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
    mut vasa_hp: i32,
    mut vasa_attack_tick: i32,
    best_style: &StyleResult,
    attack_limit: &i32,
    mut total_ticks: i32,
    zaryte_crossbow: bool,
    rng: &mut ThreadRng,
) -> (i32, i32, i32) {
    while vasa_attack_tick <= *attack_limit {
        vasa_attack_tick += 1;
        if zaryte_crossbow && (vasa_attack_tick - 1) == best_style.attack_speed {
            let spec_dmg = (vasa_hp as f64 * 0.22).floor() as i32;
            vasa_hp = vasa_hp - spec_dmg;
        } else {
            if (vasa_attack_tick - 1) % best_style.attack_speed == 0 {
                let mut hit = 0;
                if rng.gen::<f64>() < best_style.accuracy {
                    hit = rng.gen_range(0..=best_style.max_hit).max(1);
                }
                vasa_hp = vasa_hp - hit;
            }
        }
        if vasa_hp <= 0 {
            total_ticks += vasa_attack_tick - 1;
            break;
        }
        if (vasa_attack_tick - 1) % 4 == 0 {
            vasa_hp -= rng.gen_range(0..=3);
        }
        if vasa_hp <= 0 {
            total_ticks += vasa_attack_tick - 1;
            break;
        }
    }
    vasa_attack_tick += best_style.attack_speed;
    (vasa_hp, vasa_attack_tick, total_ticks)
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
    let mut player = payload.player;
    let mut monsters = payload.room.monsters;
    for monster in &mut monsters {
        console::log_1(&format!("Processing monster: {}", monster.name).into());
        console::log_1(&format!("Original HP: {}, Original skills: {:?}", monster.skills.hp, monster.skills).into());
        
        if player.combat_stats.hitpoints != 99 {
            let old_hp = monster.skills.hp;
            monster.skills.hp = monster_hp_scaling(monster, &player.combat_stats);
            console::log_1(&format!("HP scaled from {} to {} (player HP: {})", old_hp, monster.skills.hp, player.combat_stats.hitpoints).into());
        }
        
        let old_skills = monster.skills.clone();
        monster.skills = monster_stat_scaling(monster, player.combat_stats.hitpoints);
        console::log_1(&format!("Skills scaled from {:?} to {:?}", old_skills, monster.skills).into());
        console::log_1(&"---".into());
    }
    let room_methods = &payload.room.methods;
    let spec_count_dict = payload.room.special_attacks;
    let mut spec_count_max = 0;
    let trials = 100000;
    let mut rng = rand::thread_rng();

    if monsters.len() < 2 {
        return "{\"error\": \"Room must have at least two monsters (Vasa and Crystal)\"}".to_string();
    }
    let vasa = &monsters[0];
    let crystal = &monsters[1];
    let best_style_vasa = find_best_combat_style(&player, vasa, vec!["ranged".to_string()]);
    let best_style_crystal = find_best_combat_style(&player, crystal, vec!["melee".to_string()]);
    let weapon_name = player.gear_sets.melee.selected_weapon.as_ref().unwrap().name.clone();
    let vasa_base_hp = vasa.skills.hp;
    let crystal_base_hp = crystal.skills.hp;

    let mut phase_results: Vec<i32> = vec![0; trials];
    let mut tick_counts: Vec<i32> = vec![0; trials];
    let base_max_attacks_crystal = 70;
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    let zaryte_crossbow = inventory_items.iter().any(|item| item.name == "Zaryte crossbow");
    let voidwaker = inventory_items.iter().any(|item| item.name == "Voidwaker");
    if voidwaker {
        spec_count_max = spec_count_dict
            .as_ref()
            .and_then(|vec| vec.iter().find(|sa| sa.name == "Voidwaker").map(|sa| sa.count))
            .unwrap_or(2);
        
        let avernic_defender = inventory_items.iter().find(|item| item.name == "Avernic defender").cloned();
        ensure_weapon_swap(&mut player, "Voidwaker", avernic_defender);
    }
    let best_style_spec = find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]);

    let initial_delay = if room_methods.len() > 0 && room_methods[0] == "Vasa Flame Skip" {
        22
    } else {
        29
    };

    let death_animation = 6;

    for i in 0..trials {
        let mut vasa_hp = vasa_base_hp;
        let mut crystal_hp;
        let max_attacks_crystal = base_max_attacks_crystal;
        let mut vasa_attack_tick: i32 = 0;
        let mut crystal_attack_tick: i32 = 0;
        let mut crystal_attack_tick_total: i32 = 0;
        let mut crystal_count: i32 = 0;
        let mut healing_ticks: i32;
        let mut total_ticks: i32 = 0;
        let mut spec_count = spec_count_max;
        let mut pre_crystal_phase = true;
        let mut attack_pattern: Vec<i32>;
        attack_pattern = if room_methods.len() > 0 && room_methods[0] == "Vasa Flame Skip" && voidwaker {
            vec![20, 15, rng.gen_range(33..=36)]
        } else if room_methods.len() > 0 && room_methods[0] == "Vasa Flame Skip" {
            vec![25, 15, rng.gen_range(33..=36)]
        } else {
            vec![20, 15, rng.gen_range(33..=36)]
        };
        let range_max = if best_style_vasa.attack_speed > 4 { 4 * best_style_vasa.attack_speed } else { 4 };
        let overkill = if rng.gen_range(1..=range_max) == 1 { 1 } else { 0 };
        let hit_delay = if rng.gen_range(1..=8) < 3 { 1 } else { 2 };

        while vasa_hp > 0 {
            attack_pattern[2] = rng.gen_range(33..=36);
            crystal_hp = crystal_base_hp;
            if pre_crystal_phase == true {
                let (new_vasa_hp, new_vasa_attack_tick, new_total_ticks) = phase_loop(
                    vasa_hp, vasa_attack_tick, &best_style_vasa, &attack_pattern[0], total_ticks, zaryte_crossbow, &mut rng
                );
                let mut spec_dmg = 0;
                let mut spec_ticks = 0;
                loop {
                    if spec_count == 0 {
                        break;
                    }
                    let hit = dmg_modifier_check(&mut rng, best_style_spec.max_hit, best_style_spec.accuracy, "Voidwaker");
                    spec_dmg += hit;
                    spec_count -= 1;
                    spec_ticks += best_style_spec.attack_speed;
                }
                vasa_hp = new_vasa_hp - spec_dmg;
                vasa_attack_tick = new_vasa_attack_tick + spec_ticks;
                pre_crystal_phase = false;
                total_ticks = new_total_ticks + spec_ticks;
            }
            crystal_count += 1;
            healing_ticks = 0;

            while crystal_hp > 0 {
                crystal_attack_tick += 1;
                crystal_attack_tick_total += 1;
                healing_ticks += 1;
                let mut hit_crystal = 0;
                if (crystal_attack_tick - 1) % best_style_crystal.attack_speed == 0 {
                    hit_crystal = dmg_modifier_check(&mut rng, best_style_crystal.max_hit, best_style_crystal.accuracy, &weapon_name);
                }
                if (crystal_attack_tick - 1) % 4 == 0 {
                    hit_crystal += rng.gen_range(0..=3);
                }
                crystal_hp -= hit_crystal;
                if crystal_attack_tick_total >= max_attacks_crystal {
                    healing_ticks = healing_ticks / 2;
                    let heal_amount = (vasa_base_hp as f64 * 0.01).floor() as i32 * healing_ticks;
                    vasa_hp += heal_amount;
                    vasa_hp = std::cmp::min(vasa_hp, vasa_base_hp);
                    // Pre teleport dmg phase
                    let (new_vasa_hp, new_vasa_attack_tick, new_total_ticks) = phase_loop(
                        vasa_hp, vasa_attack_tick, &best_style_vasa, &attack_pattern[1], total_ticks, false, &mut rng
                    );
                    vasa_hp = new_vasa_hp;
                    vasa_attack_tick = new_vasa_attack_tick;
                    total_ticks = new_total_ticks + crystal_attack_tick - 1;
                    attack_pattern[0] = 20;
                    pre_crystal_phase = true;
                    if vasa_hp <= 0 {
                        break;
                    }
                    total_ticks += 12;
                    crystal_attack_tick_total = 0;
                    break;
                }
                if crystal_hp <= 0 {
                    total_ticks += crystal_attack_tick - 1;
                    break;
                }
            }
            crystal_attack_tick = 0;

            if vasa_attack_tick > 0 {
                total_ticks += vasa_attack_tick - 1;
            }
            vasa_attack_tick = 0;
            let (new_vasa_hp, new_vasa_attack_tick, new_total_ticks) = phase_loop(
                vasa_hp, vasa_attack_tick, &best_style_vasa, &attack_pattern[2], total_ticks, false, &mut rng
            );
            vasa_hp = new_vasa_hp;
            vasa_attack_tick = new_vasa_attack_tick;
            total_ticks = new_total_ticks;
            if vasa_hp <= 0 {
                break;
            }
        }
        total_ticks += initial_delay + hit_delay + 2 + death_animation - overkill;
        phase_results[i] = crystal_count;
        tick_counts[i] = total_ticks;
    }
    let mean_ttk = tick_counts.iter().sum::<i32>() as f64 / trials as f64;
    // let std_ttk = ... (unused)
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

    // For encounter_kill_times_obj
    let kill_prob_by_tick = kill_prob.clone();
    let tick_list: Vec<i32> = (0..=max_ticks).collect();


    // Collect results for each monster (if you have more than one)
    // let encounter_attack_speed = vasa_attack_speed; // or whatever is appropriate
    let kill_times = kill_prob.clone();

    // let expected_hits = mean_ttk / encounter_attack_speed as f64; // or however you calculate it
    let expected_ttk = mean_ttk;
    let expected_seconds = mean_ttk * 0.6; // 1 tick = 0.6 seconds

    let vasa_result = serde_json::json!({
        "monster_id": vasa.id,
        "monster_name": vasa.name,
        "expected_ticks": 0.0,
        "expected_seconds": 0.0,
        "combat_type": best_style_vasa.attack_type,
        "attack_style": best_style_vasa.combat_style,
        "kill_times": kill_times,
    });

    // Results for Crystal (example, you may want to use actual values for crystal)
    let crystal_result = serde_json::json!({
        "monster_id": crystal.id,
        "monster_name": crystal.name,
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

    serde_json::json!({
        "results": results,
        "total_expected_ticks": expected_ttk,
        "total_expected_seconds": expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj,
        "phase_results": phase_results,
    }).to_string()
}