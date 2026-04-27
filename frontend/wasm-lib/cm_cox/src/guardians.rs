use rand::prelude::*;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

#[wasm_bindgen]
pub fn calculate_dps_with_objects_guardians(payload_json: &str) -> String {

    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    // Make mutable copies for gear/inventory mutation
    let mut player = payload.player;
    let mut monsters = payload.room.monsters;
    for monster in &mut monsters { 
        if player.combat_stats.hitpoints != 99 {
            monster.skills.hp = monster_hp_scaling(monster, &player.combat_stats);
        }
        monster.skills = monster_stat_scaling(monster, player.combat_stats.hitpoints);
    }

    // --- Ensure pickaxe is equipped in melee gear if present in inventory ---
    // Collect inventory weapons (flattened from inventory items with equipment)
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    // Find Avernic defender in inventory items
    let defender = match find_defender(&inventory_items) {
        Some(def) => def,
        None => return "{\"error\": \"Please add a defender to the inventory items\"}".to_string(),
    };
    let pickaxe = inventory_items.iter()
        .find_map(|item| {
            if item.name == "Dragon pickaxe" || item.name == "Rune pickaxe" {
                Some(item.name.as_str())
            } else {
                None
            }
        });
    if pickaxe.is_none() {
        return "{\"error\": \"Please add a pickaxe to the inventory items\"}".to_string();
    }
    // ensure_pickaxe_equipped(&mut player.gear_sets.melee, &inventory_items);
    ensure_weapon_swap(&mut player, pickaxe.unwrap(), Some(defender));
    
    let trials = 100_000usize;

    // Faster RNG with variability
    let mut rng = SmallRng::from_entropy();
    let walk_delay = 27;
    let mut freq: Vec<usize> = Vec::new();
    let mut sum_ticks: i64 = 0;

    let best_style = find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]);
    let max_hit = best_style.max_hit;
    let accuracy = best_style.accuracy;
    let attack_speed = best_style.attack_speed;
    let base_hp = monsters[0].skills.hp;
    let mut single_monster_ticks : Vec<f64> = Vec::new();
    let death_animation = 2;

    for _ in 0..trials {
        let mut tick = 0;
        let mut cooldown = AttackCooldown::new();
        for _ in &monsters {
            let mut hp = base_hp;
            let mut ticks_this_monster = 0;
            while hp > 0 {
                tick += 1;
                ticks_this_monster += 1;
                if cooldown.is_ready() {
                    let hit = if rng.gen::<f64>() < accuracy {
                        rng.gen_range(0..=max_hit).max(1)
                    } else {
                        0
                    };
                    hp -= hit;
                    cooldown.reset(attack_speed);
                } else {
                    cooldown.tick();
                }
                if hp <= 0 {
                    break;
                }
            }
            single_monster_ticks.push(ticks_this_monster as f64);
        }
        tick += walk_delay;
        tick += death_animation;
        tick += rng.gen_range(0..4);
        
        sum_ticks += i64::from(tick);
        let idx = tick as usize;
        if idx >= freq.len() {
            freq.resize(idx + 1, 0);
        }
        freq[idx] += 1;
    }

    if freq.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }
    let style_list = vec![best_style.clone(), best_style.clone(), best_style.clone()];
    let end_results = results_formatter(&monsters, &style_list, sum_ticks, freq, trials, Vec::new(), Vec::new());
    end_results
}