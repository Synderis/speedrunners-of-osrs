use rand::prelude::*;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;
fn ensure_weapon_swap(
    player: &mut Player,
    weapon_name: &str,
    equip_offhand: Option<SelectedItem>,
) -> Option<(String, Option<SelectedItem>)> {
    let gear_stats = &mut player.gear_sets.melee.gear_stats;
    let gear_items = &mut player.gear_sets.melee.gear_items;
    let selected_weapon = player.gear_sets.melee.selected_weapon.as_mut()?;

    // Find weapon in inventory
    let inventory_weapon_idx = player.inventory.iter().position(|item| item.name.contains(weapon_name));
    if let Some(idx) = inventory_weapon_idx {
        let inventory_weapon = player.inventory.remove(idx);

        // Find current offhand
        let current_offhand_idx = gear_items.iter().position(|item| {
            item.as_ref().map_or(false, |i| i.slot == "shield")
        });
        let current_offhand = current_offhand_idx
            .and_then(|i| gear_items.remove(i))
            .and_then(|i| Some(i.clone()));

        // Update bonuses
        if let Some(bonuses) = &selected_weapon.bonuses {
            if let Some(inv_bonuses) = inventory_weapon.equipment.as_ref().and_then(|eq| eq.bonuses.as_ref()) {
                gear_stats.bonuses.str -= bonuses.str;
                gear_stats.bonuses.str += inv_bonuses.str;
                gear_stats.bonuses.ranged_str -= bonuses.ranged_str;
                gear_stats.bonuses.ranged_str += inv_bonuses.ranged_str;
                gear_stats.bonuses.magic_str -= bonuses.magic_str;
                gear_stats.bonuses.magic_str += inv_bonuses.magic_str;
                gear_stats.bonuses.prayer -= bonuses.prayer;
                gear_stats.bonuses.prayer += inv_bonuses.prayer;

                if let Some(ref offhand) = current_offhand {
                    if let Some(off_bonuses) = offhand.bonuses.as_ref() {
                        gear_stats.bonuses.str -= off_bonuses.str;
                        gear_stats.bonuses.ranged_str -= off_bonuses.ranged_str;
                        gear_stats.bonuses.magic_str -= off_bonuses.magic_str;
                        gear_stats.bonuses.prayer -= off_bonuses.prayer;
                    }
                }
                if let Some(ref offhand) = equip_offhand {
                    if let Some(off_bonuses) = offhand.bonuses.as_ref() {
                        gear_stats.bonuses.str += off_bonuses.str;
                        gear_stats.bonuses.ranged_str += off_bonuses.ranged_str;
                        gear_stats.bonuses.magic_str += off_bonuses.magic_str;
                        gear_stats.bonuses.prayer += off_bonuses.prayer;
                    }
                }
            }
        }
        // Update offensive
        if let Some(offensive) = &selected_weapon.offensive {
            if let Some(inv_offensive) = inventory_weapon.equipment.as_ref().and_then(|eq| eq.offensive.as_ref()) {
                gear_stats.offensive.stab -= offensive.stab;
                gear_stats.offensive.stab += inv_offensive.stab;
                gear_stats.offensive.slash -= offensive.slash;
                gear_stats.offensive.slash += inv_offensive.slash;
                gear_stats.offensive.crush -= offensive.crush;
                gear_stats.offensive.crush += inv_offensive.crush;
                gear_stats.offensive.magic -= offensive.magic;
                gear_stats.offensive.magic += inv_offensive.magic;
                gear_stats.offensive.ranged -= offensive.ranged;
                gear_stats.offensive.ranged += inv_offensive.ranged;

                if let Some(ref offhand) = current_offhand {
                    if let Some(off_offensive) = offhand.offensive.as_ref() {
                        gear_stats.offensive.stab -= off_offensive.stab;
                        gear_stats.offensive.slash -= off_offensive.slash;
                        gear_stats.offensive.crush -= off_offensive.crush;
                        gear_stats.offensive.magic -= off_offensive.magic;
                        gear_stats.offensive.ranged -= off_offensive.ranged;
                    }
                }
                if let Some(ref offhand) = equip_offhand {
                    if let Some(off_offensive) = offhand.offensive.as_ref() {
                        gear_stats.offensive.stab += off_offensive.stab;
                        gear_stats.offensive.slash += off_offensive.slash;
                        gear_stats.offensive.crush += off_offensive.crush;
                        gear_stats.offensive.magic += off_offensive.magic;
                        gear_stats.offensive.ranged += off_offensive.ranged;
                    }
                }
            }
        }

        // Swap weapon
        let prev_weapon = std::mem::replace(selected_weapon, inventory_weapon.equipment.clone()?);

        player.inventory.push(InventoryItem {
            name: prev_weapon.name.clone(),
            equipment: Some(prev_weapon.clone()),
        });

        // Handle offhand swap
        if let Some(offhand) = current_offhand.clone() {
            player.inventory.push(InventoryItem {
                name: offhand.name.clone(),
                equipment: Some(offhand.clone()),
            });
            return Some((prev_weapon.name.clone(), Some(offhand)));
        }
        if let Some(offhand) = equip_offhand.clone() {
            gear_items.push(Some(offhand.clone()));
        }
        return Some((prev_weapon.name.clone(), current_offhand));
    }
    None
}

fn sim_freeze_mutta(
        player: &Player,
        mut total_ticks: i32,
        mut hp_mutta: i32,
        mutta: &Monster,
        attack_small_mutta: i32,
        best_style_mutta: &StyleResult,
        zgs_best_style: &StyleResult,
        rng: &mut ThreadRng,
    ) -> i32 {
    while hp_mutta > (mutta.skills.hp as f64 * 0.4) as i32 {
        let hit = if rng.gen::<f64>() < best_style_mutta.accuracy {
            rng.gen_range(0..=best_style_mutta.max_hit as u32) as i32
        } else {
            0
        };
        total_ticks += attack_small_mutta;
        hp_mutta -= hit;
    }

    // Attempt to freeze with ZGS if miss add ticks and heal mutta
    if rng.gen::<f64>() > zgs_best_style.accuracy {
        hp_mutta += (mutta.skills.hp as i32 / 2).min(mutta.skills.hp as i32 - hp_mutta);
    } else {
        let hit = rng.gen_range(0..=zgs_best_style.max_hit as u32) as i32;
        hp_mutta -= hit;
    }
    total_ticks += 6;
    // Continue attacking until dead
    while hp_mutta > 0 {
        let hit = if rng.gen::<f64>() < best_style_mutta.accuracy {
            rng.gen_range(0..=best_style_mutta.max_hit as u32) as i32
        } else {
            0
        };
        total_ticks += attack_small_mutta;
        hp_mutta -= hit;
    }
    total_ticks
}
fn sim_chop_tree(
        player: &Player, 
        mut total_ticks: i32, 
        mut tree_hp: i32, 
        tree_accuracy: f64, 
        attack_speed_small_mutta: i32, 
        mut hp_small_mutta: i32, 
        base_small_mutta_hp: i32, 
        best_style_small_mutta: &StyleResult, 
        rng: &mut ThreadRng,
    ) -> (i32, i32) {
    while tree_hp > 0 {
        let mut hit = 0;
        let mut tree_hit = 0;
        if rng.gen::<f64>() < tree_accuracy {
            tree_hit = rng.gen_range(0..=player.combat_stats.woodcutting as u32) as i32;
        }
        // Small mutta can be hit if it's above half HP
        if base_small_mutta_hp / 2 < best_style_small_mutta.max_hit as i32 + hp_small_mutta {
            if rng.gen::<f64>() < best_style_small_mutta.accuracy {
                hit = rng.gen_range(0..=best_style_small_mutta.max_hit as u32) as i32;
            } else {
                hit = 0;
            }
            hp_small_mutta -= hit;
        }
        tree_hp -= tree_hit;
        if tree_hp < 0 {
            break;
        }
        total_ticks += attack_speed_small_mutta;
    }
    let phase_ticks = total_ticks;
    total_ticks += attack_speed_small_mutta;
    // Finish off small mutta
    while hp_small_mutta > 0 {
        let hit = if rng.gen::<f64>() < best_style_small_mutta.accuracy {
            rng.gen_range(0..=best_style_small_mutta.max_hit as u32) as i32
        } else {
            0
        };
        total_ticks += attack_speed_small_mutta;
        hp_small_mutta -= hit;
    }
    (total_ticks, (phase_ticks + 1) as i32)
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
    let monsters = payload.room.monsters;
    let trials = 100_000;
    let mut rng = rand::thread_rng();
    

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
    let base_small_mutta_hp = monsters[0].skills.hp as i32;
    let attack_speed_small_mutta = player.gear_sets.mage.selected_weapon.as_ref().map(|w| w.speed).unwrap_or(4) as i32;

    // Large Mutta (ranged)
    let best_style_large_mutta = find_best_combat_style(&player, &monsters[1], vec!["ranged".to_string()]);
    let base_large_mutta_hp = monsters[1].skills.hp as i32;
    let attack_speed_large_mutta = player.gear_sets.ranged.selected_weapon.as_ref().map(|w| w.speed).unwrap_or(4) as i32;

    // Tree
    let tree_accuracy = 0.7852 as f64;
    let base_tree_hp = player.combat_stats.woodcutting as i32 * 5;

    let mut tick_counts: Vec<i32> = vec![0; trials];
    let mut phase_results: Vec<i32> = vec![0; trials];

    for i in 0..trials {
        let mut hp_large_mutta = base_large_mutta_hp;
        let mut hp_small_mutta = base_small_mutta_hp;
        let mut tree_hp = base_tree_hp;
        let mut total_ticks = 0;
        if has_zgs {
            total_ticks = sim_freeze_mutta(&player, total_ticks, hp_small_mutta, &monsters[0], attack_speed_small_mutta, &best_style_small_mutta, zgs_best_style.as_ref().unwrap(), &mut rng);
            total_ticks += 9;
            total_ticks = sim_freeze_mutta(&player, total_ticks, hp_large_mutta, &monsters[1], attack_speed_large_mutta, &best_style_large_mutta, zgs_best_style.as_ref().unwrap(), &mut rng);
            phase_results[i] = 0;
        } else {
            let (new_total_ticks, phase_ticks) = sim_chop_tree(&player, total_ticks, tree_hp, tree_accuracy, attack_speed_small_mutta, hp_small_mutta, base_small_mutta_hp, &best_style_small_mutta, &mut rng);
            phase_results[i] = phase_ticks;
            total_ticks = new_total_ticks;
            total_ticks += 9;
            while hp_large_mutta > 0 {
                let hit = if rng.gen::<f64>() < best_style_large_mutta.accuracy {
                    rng.gen_range(0..=best_style_large_mutta.max_hit as u32) as i32
                } else {
                    0
                };
                total_ticks += attack_speed_large_mutta;
                hp_large_mutta -= hit;
            }
        }

        // Round up to next multiple of 4
        if total_ticks % 4 != 0 {
            total_ticks += 4 - (total_ticks % 4);
        }
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
    let std_ttk = {
        let mean = mean_ttk;
        let var = tick_counts.iter().map(|&x| {
            let diff = x as f64 - mean;
            diff * diff
        }).sum::<f64>() / trials as f64;
        var.sqrt()
    };

    // Collect results for each monster (if you have more than one)
    let mut results = Vec::new();
    let mut total_expected_hits = 0.0;
    let mut total_expected_ticks = 0.0;
    let mut total_expected_seconds = 0.0;
    let mut encounter_kill_times = Vec::new();
    // let encounter_attack_speed = Some(attack_speed_small_mutta); // or whatever is appropriate
    let kill_times = kill_prob.clone();

    let expected_hits = mean_ttk / attack_speed_small_mutta as f64; // or however you calculate it
    let expected_ttk = mean_ttk;
    let expected_seconds = mean_ttk * 0.6; // 1 tick = 0.6 seconds

    total_expected_hits += expected_hits;
    total_expected_ticks += expected_ttk;
    total_expected_seconds += expected_seconds;
    encounter_kill_times = kill_prob.clone();

    // Example: For Tekton (single monster)


    let monster_enraged = &monsters[1];
    let result_enraged = serde_json::json!({
        "monster_id": monster_enraged.id,
        "monster_name": monster_enraged.name,
        "expected_hits": expected_hits,
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
        "expected_hits": expected_hits,
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
        "total_hits": total_expected_hits,
        "total_expected_ticks": total_expected_ticks,
        "total_expected_seconds": total_expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj,
        "phase_results": phase_results,
    }).to_string()
}

