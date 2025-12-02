use rand::prelude::*;
use rand::seq::SliceRandom;
use rand::rngs::SmallRng;
use rand::distributions::{Uniform, Distribution};
use rand::SeedableRng;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

fn ensure_item_equipped(
    gear_set: &mut GearSetData,
    inventory: &[SelectedItem],
    item_name: &str,
) {
    // Find the item in inventory (exact match)
    let item = match inventory.iter().find(|item| item.name == item_name) {
        Some(item) => item,
        None => return,
    };

    // Get the slot of the item we want to equip
    let target_slot = &item.slot;

    // Remove any existing item from the same slot and subtract its bonuses
    let mut i = 0;
    while i < gear_set.gear_items.len() {
        if let Some(existing) = &gear_set.gear_items[i] {
            if existing.slot == *target_slot {
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
                };
                gear_set.gear_items.remove(i);
                continue;
            };
        }
        i += 1;
    };

    // Add the item to gear_items as equipped
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
    };
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_shamans(payload_json: &str) -> String {
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
    let room_methods = payload.room.methods;
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();

    let mut sets = [
        ("magic", &mut player.gear_sets.mage),
        ("ranged", &mut player.gear_sets.ranged),
    ];
    let slayer_helm = inventory_items.iter().any(|item| item.name == "Slayer helmet (i)");
    let slayer_task = !room_methods.is_empty() && room_methods[0] == "Shamans Slayer Task";
    if slayer_helm && slayer_task {
        for (_, gear_set) in sets.iter_mut() {
            ensure_item_equipped(gear_set, &inventory_items, "Slayer helmet (i)");
        }
    };

    let trials = 100_000usize;
    let walk_delay = 13;
    let post_room_delay = 6;
    let death_animation = 4;

    // 🔧 faster, WASM-friendly RNG
    let mut rng = SmallRng::from_entropy();

    // best style across magic/ranged
    let best_style = find_best_combat_style(&player, &monsters[0], vec!["magic".to_string(), "ranged".to_string()]);

    // hit delay options (unchanged logic)
    let hit_delay_vec = if best_style.gear_type == "ranged" {
        vec![2]
    } else if best_style.gear_type == "magic"
        && player.gear_sets.mage.selected_weapon.as_ref().unwrap().name == "Tumeken's shadow"
    {
        vec![3, 4, 5]
    } else {
        vec![2, 3, 4]
    };

    let max_hit = best_style.max_hit;
    let accuracy = best_style.accuracy;
    let attack_speed = best_style.attack_speed;
    let base_hp = monsters[0].skills.hp;

    // 🔧 precompute accuracy as integer threshold
    let acc_threshold: u32 = (accuracy.clamp(0.0, 1.0) * (u32::MAX as f64)) as u32;

    // 🔧 prebuild the passive 0..=3 distribution
    let passive_dmg = Uniform::new_inclusive(0, 3);

    // histogram mode: accumulate freq + sum_ticks like other modules
    let mut freq: Vec<usize> = Vec::new();
    let mut sum_ticks: i64 = 0;
    let mut single_monster_ticks: Vec<f64> = Vec::new(); // kept if you rely on it elsewhere

    for _ in 0..trials {
        let mut tick = 0;
        let range_max = if attack_speed > 4 { 4 * attack_speed } else { 4 };
        let overkill = if rng.gen_range(1..=range_max) == 1 { 1 } else { 0 };

        for _monster in &monsters {
            let mut hp = base_hp;
            let mut ticks_this_monster = 0;

            while hp > 0 {
                tick += 1;
                ticks_this_monster += 1;

                // passive 4-tick damage (keep modulo timing)
                if (tick - 1) % 4 == 0 {
                    let hit = passive_dmg.sample(&mut rng); // 0..=3
                    hp -= hit;
                }
                if hp <= 0 {
                    break;
                }

                // player attack (keep modulo timing), but use integer threshold roll
                if (tick - 1) % attack_speed == 0 {
                    let hit = if rng.next_u32() <= acc_threshold {
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

            single_monster_ticks.push(ticks_this_monster as f64);
        }

        let hit_delay = *hit_delay_vec.choose(&mut rng).unwrap();
        let total_tick = tick + walk_delay + hit_delay + 1 + death_animation - overkill + post_room_delay;

        sum_ticks += i64::from(total_tick);
        let idx = total_tick as usize;
        if idx >= freq.len() {
            freq.resize(idx + 1, 0);
        }
        freq[idx] += 1;
    }

    if freq.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }

    // use results_formatter for consistent output
    let style_list = vec![best_style.clone(), best_style.clone(), best_style.clone()];
    let end_results = results_formatter(&monsters, &style_list, sum_ticks, freq, trials, Vec::new(), Vec::new());
    end_results
}
