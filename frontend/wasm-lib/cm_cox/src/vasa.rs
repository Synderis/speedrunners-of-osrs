use rand::prelude::*;
use wasm_bindgen::prelude::*;
use rand::rngs::SmallRng;
use rand::distributions::{Distribution, Uniform};
use rand::SeedableRng;
use osrs_shared_types::*;
use osrs_shared_functions::*;

fn phase_loop(
    mut vasa_hp: i32,
    mut vasa_attack_tick: i32,
    best_style: &StyleResult,
    attack_limit: &i32,
    mut total_ticks: i32,
    zaryte_crossbow: bool,
    rng: &mut SmallRng,
    thrall_dist: &Uniform<i32>,
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
            vasa_hp -= thrall_dist.sample(rng);
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
        if player.combat_stats.hitpoints != 99 {
            monster.skills.hp = monster_hp_scaling(monster, &player.combat_stats);
        }
        monster.skills = monster_stat_scaling(monster, player.combat_stats.hitpoints);
    }
    let room_methods = &payload.room.methods;
    let spec_count_dict = payload.room.special_attacks;
    let mut spec_count_max = 0;
    let trials = 100_000usize;

    // Faster RNG with variability
    let mut rng = SmallRng::from_entropy();

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
    let thrall_dmg = Uniform::new_inclusive(0, 3);

    // Build histogram + running sum instead of storing all tick counts
    let mut freq: Vec<usize> = Vec::new();
    let mut sum_ticks: i64 = 0;
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
        
        // If zaryte crossbow is present and has specs, disable voidwaker specs
        if zaryte_crossbow {
            let zaryte_spec_count = spec_count_dict
                .as_ref()
                .and_then(|vec| vec.iter().find(|sa| sa.name == "Zaryte crossbow").map(|sa| sa.count))
                .unwrap_or(0);
            
            if zaryte_spec_count > 0 {
                spec_count_max = 0;
            }
        }
        let avernic_defender = inventory_items.iter().find(|item| item.name == "Avernic defender").cloned();
        ensure_weapon_swap(&mut player, "Voidwaker", avernic_defender);
    }
    let best_style_spec = find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]);

    let initial_delay = if room_methods.len() > 0 && room_methods[0] == "Vasa Flame Skip" {
        22
    } else {
        29
    };

    let death_animation = 3;
    let crystal_death_animation = 5;

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
                    vasa_hp, vasa_attack_tick, &best_style_vasa, &attack_pattern[0], total_ticks, zaryte_crossbow, &mut rng, &thrall_dmg
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
                    hit_crystal += thrall_dmg.sample(&mut rng);
                }
                crystal_hp -= hit_crystal;
                if crystal_attack_tick_total >= max_attacks_crystal {
                    healing_ticks = healing_ticks / 2;
                    let heal_amount = (vasa_base_hp as f64 * 0.01).floor() as i32 * healing_ticks;
                    vasa_hp += heal_amount;
                    vasa_hp = std::cmp::min(vasa_hp, vasa_base_hp);
                    // Pre teleport dmg phase
                    let (new_vasa_hp, new_vasa_attack_tick, new_total_ticks) = phase_loop(
                        vasa_hp, vasa_attack_tick, &best_style_vasa, &attack_pattern[1], total_ticks, false, &mut rng, &thrall_dmg
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
                vasa_hp, vasa_attack_tick, &best_style_vasa, &attack_pattern[2], total_ticks, false, &mut rng, &thrall_dmg
            );
            vasa_hp = new_vasa_hp;
            vasa_attack_tick = new_vasa_attack_tick;
            total_ticks = new_total_ticks;
            if vasa_hp <= 0 {
                break;
            }
        }
        total_ticks += initial_delay + hit_delay + 2 + death_animation - overkill + crystal_death_animation;
        phase_results[i] = crystal_count;
        sum_ticks += i64::from(total_ticks);
        let idx = total_ticks as usize;
        if idx >= freq.len() {
            freq.resize(idx + 1, 0);
        }
        freq[idx] += 1;
    }

    if freq.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }

    let style_list = vec![best_style_vasa, best_style_crystal];
    let end_results = results_formatter(&monsters, &style_list, sum_ticks, freq, trials, Vec::new(), phase_results);
    end_results
}