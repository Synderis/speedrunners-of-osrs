// vespula_replay.rs
// Simulate Vespula using a preselected sequence of damage values (and optional hit flags)

use crate::osrs_shared_types::*;
use crate::osrs_shared_functions::*;

pub fn simulate_vespula_with_damage(payload_json: &str, damage_values: &[i32], hit_flags: Option<&[bool]>) -> String {
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let player = payload.player;
    let mut monsters = payload.room.monsters;
    for monster in &mut monsters {
        if player.combat_stats.hitpoints != 99 {
            monster.skills.hp = monster_hp_scaling(monster, &player.combat_stats);
        }
        monster.skills = monster_stat_scaling(monster, player.combat_stats.hitpoints);
    }

    let walk_delay = 21;
    let death_animation = 4;
    let best_style = find_best_combat_style(&player, &monsters[0], vec!["magic".to_string(), "ranged".to_string()]);
    let attack_speed = best_style.attack_speed;
    let base_hp = monsters[0].skills.hp;
    let hit_delay = if best_style.gear_type == "ranged" { 2 } else if best_style.gear_type == "magic" && player.gear_sets.mage.selected_weapon.as_ref().unwrap().name == "Tumeken's shadow" { 5 } else { 4 };
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    let zaryte_crossbow = inventory_items.iter().any(|item| item.name == "Zaryte crossbow");

    let mut tick = 0;
    let mut dmg_idx = 0;
    let mut single_monster_ticks: Vec<f64> = Vec::new();
    for _monster in &monsters {
        let mut hp = base_hp;
        let mut ticks_this_monster = 0;
        while hp > 0 {
            tick += 1;
            ticks_this_monster += 1;
            if zaryte_crossbow && (tick - 1) == attack_speed {
                let spec_dmg = (hp as f64 * 0.22).floor() as i32;
                hp -= spec_dmg;
            } else {
                if (tick - 1) % attack_speed == 0 {
                    if dmg_idx >= damage_values.len() || (hit_flags.is_some() && dmg_idx >= hit_flags.unwrap().len()) {
                        return format!("{{\"error\": \"Not enough damage values or hit flags for simulation (needed {}, got {})\"}}", dmg_idx + 1, damage_values.len());
                    }
                    let hit = if let Some(flags) = hit_flags {
                        if flags[dmg_idx] {
                            damage_values[dmg_idx]
                        } else {
                            0
                        }
                    } else {
                        damage_values[dmg_idx]
                    };
                    dmg_idx += 1;
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
    tick += walk_delay + hit_delay + death_animation;
    // Output: ticks, seconds (mm:ss), and optionally the tick sequence
    let total_seconds = (tick as f64) * 0.6;
    let minutes = (total_seconds / 60.0).floor() as u32;
    let seconds = (total_seconds % 60.0).round() as u32;
    let formatted_time = format!("{:02}:{:02}", minutes, seconds);
    let result = serde_json::json!({
        "total_ticks": tick,
        "total_time": formatted_time,
        "tick_sequence": single_monster_ticks
    });
    result.to_string()
}
