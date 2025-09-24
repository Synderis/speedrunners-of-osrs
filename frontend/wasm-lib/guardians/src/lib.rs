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

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

fn ensure_pickaxe_equipped(
    gear_set: &mut GearSetData,
    inventory: &[SelectedItem],
) {
    // Check if current selected weapon is a pickaxe
    let is_pickaxe = gear_set.selected_weapon
        .as_ref()
        .map_or(false, |w| w.category == "Pickaxe");

    if is_pickaxe {
        return;
    }

    // Remove current weapon's bonuses from gear
    if let Some(current_weapon) = &gear_set.selected_weapon {
        if let (Some(bonuses), Some(offensive), Some(defensive)) = (
            current_weapon.bonuses.as_ref(),
            current_weapon.offensive.as_ref(),
            current_weapon.defensive.as_ref(),
        ) {
            gear_set.gear_stats.bonuses.str -= bonuses.str;
            gear_set.gear_stats.bonuses.ranged_str -= bonuses.ranged_str;
            gear_set.gear_stats.bonuses.magic_str -= bonuses.magic_str;
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
    }

    // Find a pickaxe in inventory
    if let Some(pickaxe) = inventory.iter().find(|w| w.category == "Pickaxe") {
        if let (Some(bonuses), Some(offensive), Some(defensive)) = (
            pickaxe.bonuses.as_ref(),
            pickaxe.offensive.as_ref(),
            pickaxe.defensive.as_ref(),
        ) {
            gear_set.gear_stats.bonuses.str += bonuses.str;
            gear_set.gear_stats.bonuses.ranged_str += bonuses.ranged_str;
            gear_set.gear_stats.bonuses.magic_str += bonuses.magic_str / 10;
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
        // Swap selected weapon
        gear_set.selected_weapon = Some(pickaxe.clone());
    }
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_guardians(payload_json: &str) -> String {
    console_log!("Received payload JSON: {}", payload_json);

    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            console_log!("Failed to parse payload JSON: {}", e);
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    // Make mutable copies for gear/inventory mutation
    let mut player = payload.player;
    let monsters = payload.room.monsters;
    let cap = payload.config.cap;

    // --- Ensure pickaxe is equipped in melee gear if present in inventory ---
    // Collect inventory weapons (flattened from inventory items with equipment)
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    // Find Avernic defender in inventory items
    let avernic_defender = inventory_items.iter().find(|item| item.name == "Avernic defender").cloned();
    // ensure_pickaxe_equipped(&mut player.gear_sets.melee, &inventory_items);
    ensure_weapon_swap(&mut player, "Dragon pickaxe", avernic_defender);
    console_log!("Using pickaxe and defender");
    
    let trials = 100000;
    let mut rng = rand::thread_rng();
    let walk_delay = 28;
    let mut tick_counts = vec![0usize; trials];

    // For cumulative kill times
    let mut encounter_kill_times: Vec<f64> = Vec::new();
    let mut encounter_attack_speed: Option<usize> = None;
    let best_style = find_best_combat_style(&player, &monsters[0], vec!["melee".to_string()]);
    let max_hit = best_style.max_hit as i32;
    let accuracy = best_style.accuracy;
    let attack_speed = best_style.attack_speed as usize;
    console_log!("Max hit: {}, Accuracy: {}, Attack speed: {}", max_hit, accuracy, attack_speed);
    let base_hp = monsters[0].skills.hp as i32;
    let mut single_monster_ticks : Vec<f64> = Vec::new();

    for i in 0..trials {
        let mut tick = 0;
        for monster in &monsters {
            let mut hp = base_hp;
            let mut ticks_this_monster = 0;
            while hp > 0 {
                tick += 1;
                ticks_this_monster += 1;
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
            tick += attack_speed - 1;
            ticks_this_monster += attack_speed - 1;
            single_monster_ticks.push(ticks_this_monster as f64);
        }
        if (tick - 1) % 4 != 0 {
            tick += 4 - ((tick - 1) % 4);
        }
        tick_counts[i] = tick + walk_delay;
    }
    // Defensive: Check tick_counts
    if tick_counts.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }
    let single_monster_ticks_mean = single_monster_ticks.iter().sum::<f64>() / single_monster_ticks.len() as f64;
    console_log!("Single monster mean TTK: {}", single_monster_ticks_mean);
    console_log!("Tick counts sample: {:?}", &tick_counts[0..10.min(tick_counts.len())]);
    // console_log!("Using combat style: {:?}", best_style);
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
    let mean_ttk = tick_counts.iter().sum::<usize>() as f64 / trials as f64;

    // Collect results for each monster (if you have more than one)
    
    let mut total_expected_ticks = 0.0;
    let mut total_expected_seconds = 0.0;
    let encounter_kill_times = kill_prob.clone();
    let kill_times = kill_prob.clone();

    let expected_ttk = mean_ttk;
    let expected_seconds = mean_ttk * 0.6; // 1 tick = 0.6 seconds

    total_expected_ticks += expected_ttk;
    total_expected_seconds += expected_seconds;
    let mut results = Vec::new();

    for monster in &monsters {
        let result = serde_json::json!({
            "monster_id": monster.id,
            "monster_name": monster.name,
            "expected_hits": 0.0,
            "expected_ticks": 0.0,
            "expected_seconds": 0.0,
            "combat_type": best_style.attack_type,
            "attack_style": best_style.combat_style,
            "kill_times": kill_times,
        });
        results.push(result);
    }
    
    // Convert encounter_kill_times to JSON object array
    let encounter_kill_times_obj: Vec<serde_json::Value> = encounter_kill_times.iter().enumerate()
        .map(|(idx, &prob)| {
            serde_json::json!({
                "tick": idx,
                "probability": prob
            })
        })
        .collect();

    serde_json::json!({
        "results": results,
        "total_hits": 0.0,
        "total_expected_ticks": total_expected_ticks,
        "total_expected_seconds": total_expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj,
        "phase_results": [],
    }).to_string()
}