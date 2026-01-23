use rand::prelude::*;
use wasm_bindgen::prelude::*;
use rand::rngs::SmallRng;
use rand::distributions::{Distribution, Uniform};
use rand::SeedableRng;
use osrs_shared_types::*;
use osrs_shared_functions::*;

fn ensure_item_equipped(
    gear_set: &mut GearSetData,
    inventory: &[SelectedItem],
    item_name: &str, // item_name is not needed anymore
) {

    let item = match inventory.iter().find(|item| item.name == item_name) {
        Some(item) => item,
        None => return,
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

fn generate_barrier_delay(rng: &mut SmallRng) -> i32 {
    // Tiles until barrier distribution with frequencies
    let barrier_tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    let frequencies = [4, 4, 6, 2, 6, 10, 6, 14, 6, 7, 2, 1];
    
    // Calculate total frequency for weighted selection
    let total_frequency: i32 = frequencies.iter().sum();
    let random_value = rng.gen_range(0..total_frequency);
    
    let mut cumulative_frequency = 0;
    for (i, &frequency) in frequencies.iter().enumerate() {
        cumulative_frequency += frequency;
        if random_value < cumulative_frequency {
            let tiles = barrier_tiles[i];
            // Convert tiles to ticks: player runs 2 tiles per tick
            return (tiles + 1) / 2; // Round up for odd tiles
        }
    }
    
    // Fallback (should never reach here)
    1
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
    let mut monsters = payload.room.monsters;
    for monster in &mut monsters {
        if player.combat_stats.hitpoints != 99 {
            monster.skills.hp = monster_hp_scaling(monster, &player.combat_stats);
        }
        monster.skills = monster_stat_scaling(monster, player.combat_stats.hitpoints);
    }
    let room_methods = payload.room.methods;
    let spec_count_dict = payload.room.special_attacks;
    let mut spec_count_max = 0;
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    let mut sets = [
        ("magic", &mut player.gear_sets.mage),
        ("ranged", &mut player.gear_sets.ranged),
        ("melee", &mut player.gear_sets.melee),
    ];
    let salve_amulet = inventory_items.iter().any(|item| item.name == "Salve amulet(ei)");
    let slayer_helm = inventory_items.iter().any(|item| item.name == "Slayer helmet (i)");
    let slayer_task = if room_methods.len() > 0 && room_methods[0] == "Mystics Slayer Task" {
        true
    } else {
        false
    };
    if slayer_task && slayer_helm {
        for (_, gear_set) in sets.iter_mut() {
            ensure_item_equipped(gear_set, &inventory_items, "Slayer helmet (i)");
        }
    } else if salve_amulet {
        for (_, gear_set) in sets.iter_mut() {
            ensure_item_equipped(gear_set, &inventory_items, "Salve amulet(ei)");
        }
    } else if slayer_task && !slayer_helm {
        return "{\"error\": \"Please add Slayer helmet (i) to the inventory items\"}".to_string();
    };

    // let walk_delay = 24;
    let trials = 100000;
    let death_animation = 5;
    // let mut tick_counts: Vec<i32> = vec![0; trials];
    let mut rng = SmallRng::from_entropy();
    let thrall_dmg = Uniform::new_inclusive(0, 3);
    let mut freq: Vec<usize> = Vec::new();
    let mut sum_ticks: i64 = 0;

    let best_style = find_best_combat_style(&player, &monsters[0], vec!["magic".to_string(), "ranged".to_string()]);
    let max_hit = best_style.max_hit;
    let accuracy = best_style.accuracy;
    let attack_speed = best_style.attack_speed;
    let base_hp = monsters[0].skills.hp;
    let mut single_monster_ticks : Vec<f64> = Vec::new();
    let hit_delay = if player.gear_sets.mage.selected_weapon.as_ref().unwrap().name == "Tumeken's shadow" { 2 } else { 1 };
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();

    let voidwaker = inventory_items.iter().any(|item| item.name == "Voidwaker");

    if voidwaker {
        spec_count_max = spec_count_dict
            .as_ref()
            .and_then(|vec| vec.iter().find(|sa| sa.name == "Voidwaker").map(|sa| sa.count))
            .unwrap_or(1);
        let defender = match find_defender(&inventory_items) {
            Some(def) => def,
            None => return "{\"error\": \"Please add a defender to the inventory items\"}".to_string(),
        };
        ensure_weapon_swap(&mut player, "Voidwaker", Some(defender));
    }
    let best_style_spec = find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]);

    for _ in 0..trials {
        let mut tick = 0;
        let mut spec_count = spec_count_max;
        let range_max = if attack_speed > 4 { 4 * attack_speed } else { 4 };
        let overkill = if rng.gen_range(1..=range_max) == 1 { 1 } else { 0 };
        for _monster in &monsters {
            let mut hp = base_hp;
            let mut ticks_this_monster = 0;
            while hp > 0 {
                tick += 1;
                ticks_this_monster += 1;
                if (tick - 1) % 4 == 0 {
                    let hit = thrall_dmg.sample(&mut rng);
                    hp -= hit;
                }
                if hp <= 0 {
                    break;
                }
                if spec_count > 0 {
                    let hit = dmg_modifier_check(&mut rng, best_style_spec.max_hit, best_style_spec.accuracy, "Voidwaker");
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
            single_monster_ticks.push(ticks_this_monster as f64);
        }
        let walk_delay = generate_barrier_delay(&mut rng) + 27;
        tick += walk_delay + hit_delay + death_animation - overkill;
        tick += rng.gen_range(0..4); // random animation offset

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

    let style_list = vec![best_style.clone(), best_style.clone(), best_style.clone()];
    let end_results = results_formatter(&monsters, &style_list, sum_ticks, freq, trials, Vec::new(), Vec::new());
    end_results
}