// guardians_replay.rs
// Simulate Guardians using a preselected sequence of damage values (and optional hit flags)

use crate::osrs_shared_types::*;
use crate::osrs_shared_functions::*;

pub fn simulate_guardians_with_damage(payload_json: &str, damage_values: &[i32], hit_flags: Option<&[bool]>) -> String {
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

    let walk_delay = 27;
    let best_style = find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]);
    let attack_speed = best_style.attack_speed;
    let base_hp = monsters[0].skills.hp;
    let mut tick = 0;
    let mut dmg_idx = 0;
    let mut single_monster_ticks: Vec<f64> = Vec::new();
    let mut first_monster = true;
    for _ in &monsters {
        let mut hp = base_hp;
        let mut ticks_this_monster = 0;
        while hp > 0 {
            tick += 1;
            ticks_this_monster += 1;
            if (tick - 1) % attack_speed == 0 {
                // println!("Attack Tick: {}", tick + 29 - 1);
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
            if hp <= 0 {
                // println!("Monster defeated at tick: {}", tick);
                // println!("Total hits used: {}", dmg_idx);
                // println!("Damage dealt: {}", damage_values[dmg_idx - 1]);
                break;
            }
        }

        // ticks_this_monster += attack_speed - 1;
        single_monster_ticks.push(ticks_this_monster as f64);
    }
    println!("tick before walk delay: {}", tick);
    tick += walk_delay;
    // let base_time = 1060;
    let base_time = 1137;
    // let base_time = 1163;
    let base_time = 1109;
    
    println!("Ticks: {}", tick);
    println!("Ticks - expected: {}", 184 - tick);
    tick += 5; // Guardians end-of-raid delay
    let mut total_raid_time = base_time + tick;
    if total_raid_time % 4 != 0 {
        println!("Adjusting ticks to align with 4-tick intervals {}", (4 - (total_raid_time % 4)));
        tick += 4 - (total_raid_time % 4);
        total_raid_time += 4 - (total_raid_time % 4);
    }
    // total_raid_time += 4;
    // tick += 4;
    // Output: ticks, seconds, and optionally the tick sequence
    let total_seconds = (tick as f64) * 0.6;
    let minutes = (total_seconds / 60.0).floor() as u32;
    let seconds = (total_seconds % 60.0).floor() as u32;
    let tenths = ((total_seconds * 10.0).round() as u32) % 10;
    let formatted_time = format!("{:02}:{:02}.{}", minutes, seconds, tenths);
    

    let result = serde_json::json!({
        "total_ticks": tick,
        "total_time": formatted_time,
        // "tick_sequence": single_monster_ticks,
        "total_raid_ticks": total_raid_time
    });
    result.to_string()
}
