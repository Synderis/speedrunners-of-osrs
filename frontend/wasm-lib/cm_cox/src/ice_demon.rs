use rand::prelude::*;
use rand::rngs::SmallRng;
use rand::SeedableRng;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

/// Kindling → (heal %, drain %)
fn get_drain_and_heal(kindling: usize) -> (f64, f64) {
    if kindling == 0 {
        (0.01, 0.0)
    } else if (1..=3).contains(&kindling) {
        (0.01, 0.01)
    } else if (4..=8).contains(&kindling) {
        (0.01, 0.02)
    } else if (9..=16).contains(&kindling) {
        (0.01, 0.03)
    } else if (17..=24).contains(&kindling) {
        (0.01, 0.04)
    } else {
        (0.01, 0.05)
    }
}

fn chop_simulation<R: Rng>(rng: &mut R, total_ticks: i32, base_hp: f64) -> i32 {
    let initial_delay = 34;
    let mut chop_hp = base_hp;
    let mut kindling_count = 0;
    let mut time_before_dump = 0;

    // Phase 1: Chop until at least 23 kindling
    while kindling_count < 23 {
        time_before_dump += 1;
        if (time_before_dump - 1) % 5 == 0 {
            kindling_count += rng.gen_range(1..=8);
        }
    }

    let chop_ticks = total_ticks + time_before_dump + 14 - 1;
    let mut burner_1_count = kindling_count;
    kindling_count = 0;
    let mut burner_2_count = 0;
    let mut burner_3_count = 0;
    let mut third_burner_lit = false;
    let mut time_after_dump = 0;

    // Phase 2: Burn phase
    while chop_hp > 0.0 {
        time_after_dump += 1;

        // Second burner
        if burner_2_count == 0 && kindling_count < 23 {
            if (time_after_dump - 1) % 5 == 0 {
                kindling_count += rng.gen_range(1..=8);
            }
            if kindling_count >= 23 {
                burner_2_count = kindling_count;
                kindling_count = 0;
                time_after_dump += 16;
            }
        }

        // Third burner
        if burner_2_count > 0 && !third_burner_lit {
            let target_chops = rng.gen_range(3..=4);
            let mut third_burner_chops = 0;
            let mut third_burner_kindling = 0;
            while third_burner_chops < target_chops {
                third_burner_chops += 1;
                third_burner_kindling += rng.gen_range(1..=8);
                if third_burner_kindling >= 8 {
                    break;
                }
            }
            time_after_dump += 8;
            burner_3_count = third_burner_kindling;
            third_burner_lit = true;
            time_after_dump += third_burner_chops * 5;
        }

        // Every 6 ticks, apply heal/drain
        if (time_after_dump - 1) % 6 == 0 {
            let mut burner_heals = Vec::new();
            let mut burner_drains = Vec::new();

            if burner_1_count > 0 {
                let (heal1, drain1) = get_drain_and_heal(burner_1_count);
                burner_heals.push(heal1);
                burner_drains.push(drain1);
                burner_1_count -= 1;
            }
            if burner_2_count > 0 {
                let (_, drain2) = get_drain_and_heal(burner_2_count);
                burner_drains.push(drain2);
                burner_2_count -= 1;
            }
            if burner_3_count > 0 {
                let (_, drain3) = get_drain_and_heal(burner_3_count);
                burner_drains.push(drain3);
                burner_3_count -= 1;
            }

            let heal_total = burner_heals.iter().cloned().fold(0.0, f64::max);
            let drain_total: f64 = burner_drains.iter().sum();

            chop_hp += heal_total * base_hp;
            chop_hp -= drain_total * base_hp;
            if chop_hp > base_hp {
                chop_hp = base_hp;
            }
        }

        if chop_hp <= 0.0 {
            break;
        }
    }

    chop_ticks + time_after_dump + initial_delay - 1
}

#[inline]
fn thrall_hit<R: Rng>(rng: &mut R, hp: i32) -> i32 {
    let roll = rng.gen_range(0..4);
    let add = if roll == 3 { 1 } else { 0 };
    hp - add
}

fn ember_light_kill<R: Rng>(
    rng: &mut R,
    mut hp: i32,
    max_hit: i32,
    accuracy: &[f64],     // [p0, p1, p2]
    attack_speed: i32,
    mut total_ticks: i32,
    spec_count_max: i32,
) -> i32 {
    // precompute thresholds for p0, p1, p2
    let to_thr = |p: f64| -> u32 { (p.clamp(0.0, 1.0) * (u32::MAX as f64)) as u32 };
    let p0 = to_thr(accuracy[0]);
    let p1 = to_thr(accuracy[1]);
    let p2 = to_thr(accuracy[2]);

    // we’ll track which threshold we’re on using an index
    let mut acc_idx = 0; // start at p0
    let mut attack_tick = 0;
    let mut hit_count = 0;

    // first: specials
    while hit_count < spec_count_max {
        attack_tick += 1;
        if (attack_tick - 1) % attack_speed == 0 {
            // roll
            let thr = [p0, p1, p2][acc_idx];
            if rng.next_u32() <= thr {
                let hit = rng.gen_range(0..=max_hit).max(1);
                hp -= hit;
                // toggle p1/p2 when we land a hit (matches original behavior)
                if acc_idx == 1 {
                    acc_idx = 2;
                } else {
                    acc_idx = 1;
                }
            }
            hp = thrall_hit(rng, hp);
            hit_count += 1;
        }
    }

    total_ticks += attack_tick + attack_speed - 1;

    // then: regulars until death
    attack_tick = 0;
    while hp > 0 {
        attack_tick += 1;
        if (attack_tick - 1) % attack_speed == 0 {
            let thr = [p0, p1, p2][acc_idx];
            let mut hit = 0;
            if rng.next_u32() <= thr {
                hit = rng.gen_range(0..=max_hit).max(1);
            }
            hp -= hit;
            hit_count += 1;
            hp = thrall_hit(rng, hp);
        }
        if hp <= 0 {
            total_ticks += attack_tick - 1;
            break;
        }
    }

    total_ticks
}

fn burning_claws_kill<R: Rng>(
    rng: &mut R,
    mut hp: i32,
    max_hit: i32,
    accuracy: f64,
    attack_speed: i32,
    mut total_ticks: i32,
    spec_count_max: i32,
) -> i32 {
    let acc_thr: u32 = (accuracy.clamp(0.0, 1.0) * (u32::MAX as f64)) as u32;

    let mut attack_tick = 0;
    let mut hit_count = 0;
    let mut burn_list: Vec<i32> = Vec::new();

    // First phase: specials
    while hit_count < spec_count_max && hp > 0 {
        attack_tick += 1;
        if (attack_tick - 1) % attack_speed == 0 {
            let (hits, burns) = burning_barrage_special(rng, max_hit, accuracy);
            hp -= hits.iter().sum::<i32>();
            for burn in burns {
                if burn > 0 && burn_list.len() < 5 {
                    burn_list.push(burn);
                }
            }
            hp = apply_burns(hp, &mut burn_list);
            hit_count += 1;
            hp = thrall_hit(rng, hp);
        }
    }

    if hp <= 0 {
        total_ticks += attack_tick - 1;
        return total_ticks;
    }

    total_ticks += attack_tick + attack_speed - 1;
    attack_tick = 0;

    // Second phase: regulars
    while hp > 0 {
        attack_tick += 1;
        if (attack_tick - 1) % attack_speed == 0 {
            let hit = if rng.next_u32() <= acc_thr {
                rng.gen_range(0..=max_hit).max(1)
            } else {
                0
            };
            hp = apply_burns(hp, &mut burn_list);
            hp -= hit;
            hit_count += 1;
            hp = thrall_hit(rng, hp);
        }
        if hp <= 0 {
            total_ticks += attack_tick - 1;
            break;
        }
    }

    total_ticks
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_ice_demon(payload_json: &str) -> String {
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let mut player = payload.player;
    let mut monsters = payload.room.monsters;
    let spec_count_dict = payload.room.special_attacks;

    for monster in &mut monsters {
        if player.combat_stats.hitpoints != 99 {
            monster.skills.hp = monster_hp_scaling(monster, &player.combat_stats);
        }
        monster.skills = monster_stat_scaling(monster, player.combat_stats.hitpoints);
    }

    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();

    let emberlight = inventory_items.iter().any(|item| item.name == "Emberlight");
    let burning_claws = inventory_items.iter().any(|item| item.name == "Burning claws");

    let mut emberlight_accuracy: Vec<f64> = Vec::new();
    let best_style: StyleResult;
    let attack_speed: i32;
    let max_hit: i32;
    let mut accuracy = 0.0;
    let spec_count_max: i32;

    if emberlight {
        spec_count_max = spec_count_dict
            .as_ref()
            .and_then(|vec| vec.iter().find(|sa| sa.name == "Emberlight").map(|sa| sa.count))
            .unwrap_or(2);
        let avernic_defender = inventory_items
            .iter()
            .find(|item| item.name == "Avernic defender")
            .cloned();
        ensure_weapon_swap(&mut player, "Emberlight", avernic_defender);

        let mut emberlight_ice_demon = monsters[0].clone();
        let base_def = emberlight_ice_demon.skills.def;

        best_style = find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]);

        let style1 = find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]);
        max_hit = style1.max_hit;
        emberlight_accuracy.push(style1.accuracy);

        emberlight_ice_demon.skills.def = ((base_def as f64 * 0.85).floor() - 1.0) as i32;
        let style2 = find_best_combat_style(&player, &emberlight_ice_demon, vec!["melee".to_string()]);
        emberlight_accuracy.push(style2.accuracy);

        emberlight_ice_demon.skills.def = ((base_def as f64 * 0.7).floor() - 2.0) as i32;
        let style3 = find_best_combat_style(&player, &emberlight_ice_demon, vec!["melee".to_string()]);
        emberlight_accuracy.push(style3.accuracy);

        attack_speed = style3.attack_speed;
    } else if burning_claws {
        spec_count_max = spec_count_dict
            .as_ref()
            .and_then(|vec| vec.iter().find(|sa| sa.name == "Burning claws").map(|sa| sa.count))
            .unwrap_or(4);
        ensure_weapon_swap(&mut player, "Burning claws", None);
        best_style = find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]);
        accuracy = best_style.accuracy;
        max_hit = best_style.max_hit;
        attack_speed = best_style.attack_speed;
    } else {
        return "{\"error\": \"No Emberlight or Burning claws found in inventory\"}".to_string();
    }

    let trials = 100_000usize;
    let post_chop_delay = 10;
    let death_animation = 4;

    // 🔧 small, fast RNG (WASM-friendly)
    let mut rng = SmallRng::from_entropy();

    // per-trial phase outputs and histogram
    let mut ice_demon_pop_time: Vec<i32> = vec![0; trials];
    let mut freq: Vec<usize> = Vec::new();
    let mut sum_ticks: i64 = 0;

    for i in 0..trials {
        let mut total_ticks = 0;
        let ice_demon_hp = monsters[0].skills.hp;

        total_ticks = chop_simulation(&mut rng, total_ticks, ice_demon_hp as f64);
        ice_demon_pop_time[i] = total_ticks;    
        // record phase result
        // note: in previous implementation this was stored per trial index; keep same behaviour
        // but we don't need to keep per-trial full tick_counts
        // push later by index; here we just accumulate histogram and sum

        let overkill = if rng.gen_range(1..=4) == 1 { 1 } else { 0 };

        if emberlight {
            total_ticks = ember_light_kill(
                &mut rng,
                ice_demon_hp,
                max_hit,
                &emberlight_accuracy,
                attack_speed,
                total_ticks,
                spec_count_max,
            );
        } else if burning_claws {
            total_ticks = burning_claws_kill(
                &mut rng,
                ice_demon_hp,
                max_hit,
                accuracy,
                attack_speed,
                total_ticks,
                spec_count_max,
            );
        } else {
            return "{\"error\": \"No valid weapon found for killing the Ice Demon.\"}".to_string();
        }

    total_ticks += post_chop_delay;
    total_ticks += 1 + death_animation - overkill;

    // record histogram and running sum
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
    let style_list = vec![best_style.clone()];
    let end_results = results_formatter(&monsters, &style_list, sum_ticks, freq, trials, ice_demon_pop_time, Vec::new());
    end_results
}