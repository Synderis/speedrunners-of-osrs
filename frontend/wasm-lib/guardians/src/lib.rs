use wasm_bindgen::prelude::*;
use osrs_shared_types::*;

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

// --- Calculation logic (same as tekton, but with mining scaling for guardians) ---
fn calculate_max_hit_for_style(player: &Player, style: &WeaponStyle, gear: &GearStats, mining_level: f64) -> (u32, u32) {
    let strength_level = player.combat_stats.strength;
    let potion_bonus = 21.0; // Super strength potion
    let prayer_strength_bonus = 1.23; // Piety
    let style_bonus = style.str_ as f64;
    let void_bonus = 1.0; // No void for now
    let effective_strength = (((strength_level as f64 + potion_bonus) * prayer_strength_bonus + style_bonus + 8.0) * void_bonus).floor() as u32;
    let strength_bonus = gear.bonuses.str as f64;
    let base_max_hit = (0.5 + (effective_strength as f64 * (strength_bonus + 64.0)) / 640.0).floor();
    // Guardians: apply mining level scaling
    let level_requirement = 60.0;
    let damage_multiplier = (50.0 + mining_level + level_requirement) / 150.0;
    let max_hit = (base_max_hit * damage_multiplier).ceil() as u32;
    (max_hit, effective_strength)
}

fn calculate_accuracy_for_style(player: &Player, monster: &Monster, style: &WeaponStyle, gear: &GearStats) -> (f64, u32, u64, u64) {
    let attack_level = player.combat_stats.attack;
    let potion_bonus = 21.0; // Super attack potion
    let prayer_attack_bonus = 1.20; // Piety
    let style_bonus = style.att as f64;
    let void_bonus = 1.0; // No void for now
    let effective_attack = (((attack_level as f64 + potion_bonus) * prayer_attack_bonus + style_bonus + 8.0) * void_bonus).floor() as u32;
    let equipment_bonus = match style.attack_type.to_lowercase().as_str() {
        "stab" => gear.offensive.stab,
        "slash" => gear.offensive.slash,
        "crush" => gear.offensive.crush,
        "magic" => gear.offensive.magic,
        "ranged" => gear.offensive.ranged,
        _ => 0,
    };
    let attack_bonus = equipment_bonus;
    let max_attack_roll = effective_attack as u64 * (attack_bonus + 64) as u64;
    let defence_bonus = match style.attack_type.to_lowercase().as_str() {
        "stab" => monster.defensive.stab,
        "slash" => monster.defensive.slash,
        "crush" => monster.defensive.crush,
        "magic" => monster.defensive.magic,
        "ranged" => monster.defensive.standard,
        _ => 0,
    };
    let max_defence_roll = (monster.skills.def + 9) as u64 * (defence_bonus + 64) as u64;

    let mut accuracy = 0.0;

    if let Some(weapon) = &player.gear_sets.melee.selected_weapon {
        if weapon.name.to_lowercase().contains("osmumten's fang") {
            if max_attack_roll > max_defence_roll {
                accuracy = 1.0 - (((max_defence_roll as f64 + 2.0) * (2.0 * max_defence_roll as f64 + 3.0)) / (6.0 * (max_attack_roll as f64 + 1.0).powf(2.0)));
            } else {
                accuracy = (max_attack_roll as f64 * (4.0 * max_attack_roll as f64 + 5.0)) / (6.0 * (max_attack_roll as f64 + 1.0) * (max_defence_roll as f64 + 1.0));
            };
        } else {
            if max_attack_roll > max_defence_roll {
                accuracy = 1.0 - ((max_defence_roll as f64 + 2.0) / (2.0 * (max_attack_roll as f64 + 1.0)));
            } else {
                accuracy = max_attack_roll as f64 / (2.0 * (max_defence_roll as f64 + 1.0));
            };
        };
    };

    (accuracy, effective_attack, max_attack_roll, max_defence_roll)
}

fn find_best_combat_style(player: &Player, monster: &Monster, mining_level: f64) -> StyleResult {
    let mut best_style: Option<StyleResult> = None;
    let mut best_dps = 0.0;
    if let Some(weapon) = &player.gear_sets.melee.selected_weapon {
        for style in &weapon.weapon_styles {
            let (max_hit, effective_strength) = calculate_max_hit_for_style(player, style, &player.gear_sets.melee.gear_stats, mining_level);
            let (accuracy, effective_attack, max_attack_roll, max_defence_roll) = calculate_accuracy_for_style(player, monster, style, &player.gear_sets.melee.gear_stats);
            let effective_dps = max_hit as f64 * accuracy;
            let style_result = StyleResult {
                combat_style: style.combat_style.clone(),
                attack_type: style.attack_type.clone(),
                max_hit,
                accuracy,
                effective_dps,
                effective_strength,
                effective_attack,
                max_attack_roll,
                max_defence_roll,
                att_spd_reduction: style.att_spd_reduction,
            };
            if effective_dps > best_dps {
                best_dps = effective_dps;
                best_style = Some(style_result);
            }
        }
    }
    best_style.unwrap()
}
fn ensure_pickaxe_equipped(
    gear_set: &mut GearSetData,
    inventory: &[SelectedWeapon],
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
        // Swap selected weapon
        gear_set.selected_weapon = Some(pickaxe.clone());
    }
}

// --- Markov Matrix Helpers (Python-style, updated) ---
fn build_transition_matrix(hp: usize, max_hit: usize, accuracy: f64) -> Vec<Vec<f64>> {
    let n = hp + 1;
    let mut mat = vec![vec![0.0; n]; n];
    for i in 0..n {
        if i == 0 {
            mat[i][i] = 1.0; // Absorbing state
            continue;
        }
        // Probability of 0 damage: miss + hitting 0
        let p_zero = (1.0 - accuracy) + accuracy / (max_hit as f64 + 1.0);
        mat[i][i] += p_zero;
        // Probability of k damage (1 <= k <= min(i, max_hit))
        for dmg in 1..=usize::min(max_hit, i) {
            let next_hp = i.saturating_sub(dmg);
            mat[i][next_hp] += accuracy / (max_hit as f64 + 1.0);
        }
        // Overkill: if max_hit > i, add probability to state 0
        if max_hit > i {
            let overkill_prob = (max_hit - i) as f64 * (accuracy / (max_hit as f64 + 1.0));
            mat[i][0] += overkill_prob;
        }
    }
    mat
}

fn propagate_state(state: &[f64], mat: &[Vec<f64>]) -> Vec<f64> {
    let n = state.len();
    let mut new_state = vec![0.0; n];
    for i in 0..n {
        for j in 0..n {
            new_state[j] += state[i] * mat[i][j];
        }
    }
    new_state
}

fn weapon_kill_times_markov_per_tick_with_delay(
    hp: usize,
    max_hit: usize,
    accuracy: f64,
    cap: f64,
    max_steps: usize,
    attack_speed: usize,
    start_tick: usize, // <-- number of ticks to wait before first attack
) -> (Vec<f64>, usize, f64, f64) {
    let n = hp + 1;
    let mat = build_transition_matrix(hp, max_hit, accuracy);
    let mut state = vec![0.0; n];
    state[hp] = 1.0; // Start at full HP (index = hp)
    let mut kill_times = Vec::new();
    let mut p_dead = state[0];

    for _ in 0..start_tick {
        kill_times.push(p_dead); // Fill initial ticks with current state
    }
    let mut prev_p_dead = p_dead;
    let mut expected_ttk = 0.0;
    let mut expected_hits = 0.0;
    let mut attack_num = 1;

    while p_dead < cap && kill_times.len() < max_steps {
        state = propagate_state(&state, &mat);
        p_dead = state[0];
        kill_times.push(p_dead);
        let dp = p_dead - prev_p_dead;
        let tick = start_tick + (attack_num) * attack_speed + 1;
        expected_ttk += tick as f64 * dp;
        expected_hits += attack_num as f64 * dp;
        prev_p_dead = p_dead;
        attack_num += 1;
    }
    if expected_ttk % 4.0 != 0.0 {
        expected_ttk += 4.0 - (expected_ttk % 4.0);
    }
    (kill_times, attack_speed, expected_hits, expected_ttk)
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
    let mining_level = player.combat_stats.mining as f64;

    // --- Ensure pickaxe is equipped in melee gear if present in inventory ---
    // Collect inventory weapons (flattened from inventory items with equipment)
    let inventory_weapons: Vec<SelectedWeapon> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    ensure_pickaxe_equipped(&mut player.gear_sets.melee, &inventory_weapons);
    console_log!("Using pickaxe");
    

    let walk_delay = 28;
    let mut total_expected_hits = 0.0;
    let mut total_expected_ticks = 0.0;
    let mut total_expected_seconds = 0.0;
    let mut first = true;
    let mut results = Vec::new();

    // For cumulative kill times
    let mut encounter_kill_times: Vec<f64> = Vec::new();
    let mut encounter_attack_speed: Option<usize> = None;


    for monster in monsters {
        let best_style = find_best_combat_style(&player, &monster, mining_level);

        let max_hit = best_style.max_hit as usize;
        let accuracy = best_style.accuracy;
        let hp = monster.skills.hp as usize;

        let attack_speed = if let Some(weapon) = &player.gear_sets.melee.selected_weapon {
            weapon.speed as usize
        } else {
            5
        };
        if encounter_attack_speed.is_none() {
            encounter_attack_speed = Some(attack_speed);
        }

        let walk = if first { walk_delay } else { 0 };

        let (kill_times_per_tick, _attack_speed, expected_hits, expected_ttk) = weapon_kill_times_markov_per_tick_with_delay(
            hp, max_hit, accuracy, cap, 1000, attack_speed, walk
        );

        let kill_times: Vec<f64> = kill_times_per_tick.iter().cloned().skip(walk).collect();

        let expected_seconds = expected_ttk * 0.6;

        total_expected_hits += expected_hits;
        total_expected_ticks += expected_ttk;
        total_expected_seconds += expected_seconds;

        // --- Cumulative kill times for the encounter ---
        if first {
            encounter_kill_times = kill_times.clone();
        } else {
            // Convert both to PMF
            let mut pmf1 = vec![0.0; encounter_kill_times.len()];
            let mut pmf2 = vec![0.0; kill_times.len()];
            for i in 0..encounter_kill_times.len() {
                pmf1[i] = if i == 0 { encounter_kill_times[0] } else { encounter_kill_times[i] - encounter_kill_times[i - 1] };
            }
            for i in 0..kill_times.len() {
                pmf2[i] = if i == 0 { kill_times[0] } else { kill_times[i] - kill_times[i - 1] };
            }
            // Convolve PMFs
            let mut new_pmf = vec![0.0; pmf1.len() + pmf2.len() - 1];
            for i in 0..pmf1.len() {
                for j in 0..pmf2.len() {
                    new_pmf[i + j] += pmf1[i] * pmf2[j];
                }
            }
            // Convert back to CDF
            let mut new_cdf = vec![0.0; new_pmf.len()];
            let mut sum = 0.0;
            for (i, &v) in new_pmf.iter().enumerate() {
                sum += v;
                new_cdf[i] = sum;
            }
            encounter_kill_times = new_cdf;
        }
        console_log!("Monster: {}, Max Hit: {}, Accuracy: {:.4}, DPS: {:.4}", monster.name, max_hit, accuracy, best_style.effective_dps);
        let result = serde_json::json!({
            "monster_id": monster.id,
            "monster_name": monster.name,
            "expected_hits": expected_hits,
            "expected_ticks": expected_ttk,
            "expected_seconds": expected_seconds,
            "kill_times": kill_times,
        });
        results.push(result);

        first = false;
    }

    let encounter_kill_times_obj: Vec<serde_json::Value> = encounter_kill_times.iter().enumerate()
        .map(|(idx, &prob)| {
            serde_json::json!({
                "tick": idx * encounter_attack_speed.unwrap(),
                "probability": prob
            })
        })
        .collect();

    serde_json::json!({
        "results": results,
        "total_hits": total_expected_hits,
        "total_expected_ticks": total_expected_ticks,
        "total_expected_seconds": total_expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj
    }).to_string()
}