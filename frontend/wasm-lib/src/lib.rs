use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
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

#[wasm_bindgen]
pub fn greet(name: &str) {
    alert(&format!("Hello, {}!", name));
}

#[derive(Deserialize)]
pub struct CombatStats {
    pub attack: u32,
    pub strength: u32,
    pub defense: u32,
    pub ranged: u32,
    pub magic: u32,
    pub hitpoints: u32,
    pub prayer: u32,
    pub woodcutting: u32,
    pub mining: u32,
    pub thieving: u32,
}

#[derive(Deserialize)]
pub struct GearStats {
    pub attack_stab: i32,
    pub attack_slash: i32,
    pub attack_crush: i32,
    pub attack_magic: i32,
    pub attack_ranged: i32,
    pub defence_stab: i32,
    pub defence_slash: i32,
    pub defence_crush: i32,
    pub defence_magic: i32,
    pub defence_ranged: i32,
    pub melee_strength: i32,
    pub ranged_strength: i32,
    pub magic_damage: i32,
    pub prayer: i32,
}

#[derive(Deserialize)]
pub struct WeaponStat {
    pub id: u32,
    pub item_id: u32,
    pub weapon_name: String,
    pub weapon_type: String,
    pub attack_speed: u32,
    pub attack_bonus: i32,
    pub combat_style: String,
    pub attack_type: String,
    pub attack_style: String,
    pub experience: String,
    pub boosts: Option<String>,
    pub icon: String,
}

#[derive(Deserialize)]
pub struct SelectedWeapon {
    pub name: String,
    pub id: String,
    #[serde(rename = "weaponStats")]
    pub weapon_stats: Vec<WeaponStat>,
}

#[derive(Deserialize)]
pub struct Player {
    #[serde(rename = "combatStats")]
    pub combat_stats: CombatStats,
    #[serde(rename = "gearStats")]
    pub gear_stats: GearStats,
    #[serde(rename = "activeGearTab")]
    pub active_gear_tab: String,
    #[serde(rename = "selectedWeapon")]
    pub selected_weapon: Option<SelectedWeapon>,
}

#[derive(Deserialize)]
pub struct Monster {
    pub hitpoints: u32,
    pub name: String,
    pub combat_level: u32,
    pub defence_level: u32,
    pub defence_slash: i32,
    pub defence_stab: i32,
    pub defence_crush: i32,
    pub defence_magic: i32,
    pub defence_ranged: i32,
    pub magic_level: u32,
    pub max_hit: u32,
}

#[derive(Serialize)]
pub struct CalculationResult {
    pub max_hit: u32,
    pub accuracy: f64,
    pub effective_strength: u32,
    pub effective_attack: u32,
    pub max_attack_roll: u64,
    pub max_defence_roll: u64,
}

fn calculate_max_hit(player: &Player) -> (u32, u32) {
    let strength_level = player.combat_stats.strength;
    let potion_bonus = 19; // Super strength potion
    let prayer_strength_bonus = 1.23; // Piety
    
    // Style bonus based on weapon combat style
    let mut style_bonus = 0;
    if let Some(weapon) = &player.selected_weapon {
        if !weapon.weapon_stats.is_empty() {
            let weapon_stat = &weapon.weapon_stats[0]; // Using first combat style
            
            match weapon_stat.attack_style.as_str() {
                "aggressive" => style_bonus = 3,
                "controlled" => style_bonus = 1,
                _ => style_bonus = 0,
            }
        }
    }
    
    let void_bonus = 1.0; // No void for now
    
    // Calculate effective strength using OSRS formula
    let effective_strength = ((((strength_level + potion_bonus) as f64 * prayer_strength_bonus).floor() + style_bonus as f64 + 8.0) * void_bonus).floor() as u32;
    
    // Get strength bonus from gear
    let strength_bonus = match player.active_gear_tab.as_str() {
        "melee" => player.gear_stats.melee_strength,
        "ranged" => player.gear_stats.ranged_strength,
        "mage" => player.gear_stats.magic_damage,
        _ => player.gear_stats.melee_strength,
    };
    
    // Calculate max hit: floor(0.5 + (Effective Strength × (Strength Bonus + 64)) / 640)
    let max_hit = (0.5 + (effective_strength as f64 * (strength_bonus + 64) as f64) / 640.0).floor() as u32;
    
    console_log!("Max Hit Calculation: strength_level={}, potion_bonus={}, style_bonus={}, effective_strength={}, strength_bonus={}, max_hit={}", 
        strength_level, potion_bonus, style_bonus, effective_strength, strength_bonus, max_hit);
    
    (max_hit, effective_strength)
}

fn calculate_accuracy(player: &Player, monster: &Monster) -> (f64, u32, u64, u64) {
    let attack_level = player.combat_stats.attack;
    let potion_bonus = 19; // Super attack potion
    let prayer_attack_bonus = 1.20; // Piety
    
    // Style bonus based on weapon combat style
    let mut style_bonus = 0;
    if let Some(weapon) = &player.selected_weapon {
        if !weapon.weapon_stats.is_empty() {
            let weapon_stat = &weapon.weapon_stats[0]; // Using first combat style
            
            match weapon_stat.attack_style.as_str() {
                "accurate" => style_bonus = 3,
                "controlled" => style_bonus = 1,
                _ => style_bonus = 0,
            }
        }
    }
    
    let void_bonus = 1.0; // No void for now
    
    // Calculate effective attack level - use style_bonus in the calculation
    let effective_attack = ((((attack_level + potion_bonus) as f64 * prayer_attack_bonus).floor() + style_bonus as f64 + 8.0) * void_bonus).floor() as u32;
    
    // Get attack bonus from gear based on weapon's attack type
    let mut attack_bonus = 0;
    if let Some(weapon) = &player.selected_weapon {
        if !weapon.weapon_stats.is_empty() {
            let weapon_stat = &weapon.weapon_stats[0];
            
            // Get equipment bonus based on attack type
            let equipment_bonus = match weapon_stat.attack_type.as_str() {
                "stab" => player.gear_stats.attack_stab,
                "slash" => player.gear_stats.attack_slash,
                "crush" => player.gear_stats.attack_crush,
                "magic" => player.gear_stats.attack_magic,
                "ranged" => player.gear_stats.attack_ranged,
                _ => player.gear_stats.attack_stab,
            };
            
            // Total attack bonus = equipment bonus (weapon attack bonus is already included in gear stats)
            attack_bonus = equipment_bonus;
            
            console_log!("Using weapon attack type: {}, equipment bonus: {}", weapon_stat.attack_type, equipment_bonus);
        }
    } else {
        // Fallback to gear stats only
        attack_bonus = match player.active_gear_tab.as_str() {
            "melee" => player.gear_stats.attack_stab,
            "ranged" => player.gear_stats.attack_ranged,
            "mage" => player.gear_stats.attack_magic,
            _ => player.gear_stats.attack_stab,
        };
    }
    
    // Calculate max attack roll
    let max_attack_roll = effective_attack as u64 * (attack_bonus + 64) as u64;
    
    // Calculate max defence roll (using appropriate defence type)
    let defence_bonus = if let Some(weapon) = &player.selected_weapon {
        if !weapon.weapon_stats.is_empty() {
            let weapon_stat = &weapon.weapon_stats[0];
            match weapon_stat.attack_type.as_str() {
                "stab" => monster.defence_stab,
                "slash" => monster.defence_slash,
                "crush" => monster.defence_crush,
                "magic" => monster.defence_magic,
                "ranged" => monster.defence_ranged,
                _ => monster.defence_stab,
            }
        } else {
            monster.defence_stab
        }
    } else {
        monster.defence_stab
    };
    
    let max_defence_roll = (monster.defence_level + 9) as u64 * (defence_bonus + 64) as u64;
    
    // Calculate accuracy
    let accuracy = if max_attack_roll > max_defence_roll {
        1.0 - (max_defence_roll + 2) as f64 / (2.0 * (max_attack_roll + 1) as f64)
    } else {
        max_attack_roll as f64 / (2.0 * (max_defence_roll + 1) as f64)
    };
    
    console_log!("Accuracy Calculation: attack_level={}, effective_attack={}, attack_bonus={}, max_attack_roll={}, defence_bonus={}, max_defence_roll={}, accuracy={}%", 
        attack_level, effective_attack, attack_bonus, max_attack_roll, defence_bonus, max_defence_roll, accuracy * 100.0);
    
    (accuracy, effective_attack, max_attack_roll, max_defence_roll)
}

/// New function that accepts player and monster data and calculates everything internally
#[wasm_bindgen]
pub fn calculate_dps_with_objects(player_json: &str, monster_json: &str, cap: f64) -> String {
    console_log!("Received player JSON: {}", player_json);
    console_log!("Received monster JSON: {}", monster_json);
    
    let player: Player = match serde_json::from_str(player_json) {
        Ok(p) => p,
        Err(e) => {
            console_log!("Failed to parse player JSON: {}", e);
            return format!("{{\"error\": \"Failed to parse player data: {}\"}}", e);
        }
    };
    
    let monster: Monster = match serde_json::from_str(monster_json) {
        Ok(m) => m,
        Err(e) => {
            console_log!("Failed to parse monster JSON: {}", e);
            return format!("{{\"error\": \"Failed to parse monster data: {}\"}}", e);
        }
    };
    
    // Calculate max hit and accuracy
    let (max_hit, effective_strength) = calculate_max_hit(&player);
    let (accuracy, effective_attack, max_attack_roll, max_defence_roll) = calculate_accuracy(&player, &monster);
    
    console_log!("Calculated max_hit: {}, accuracy: {}", max_hit, accuracy);
    
    // Generate kill time distribution
    let kill_times = weapon_and_thrall_kill_times_internal(monster.hitpoints as usize, max_hit as usize, accuracy, cap);
    
    let result = CalculationResult {
        max_hit,
        accuracy,
        effective_strength,
        effective_attack,
        max_attack_roll,
        max_defence_roll,
    };
    
    let response = serde_json::json!({
        "calculation": result,
        "kill_times": kill_times
    });
    
    response.to_string()
}

/// Multiply a 1xN row vector by an NxN matrix (both row-major).
fn row_vec_times_square_mat(row: &[f64], mat: &[f64], n: usize) -> Vec<f64> {
    let mut out = vec![0.0; n];
    // out[j] = sum_i row[i] * mat[i,j]
    for i in 0..n {
        let r = row[i];
        if r == 0.0 { continue; }
        let row_start = i * n;
        for j in 0..n {
            out[j] += r * mat[row_start + j];
        }
    }
    out
}

/// Build transition matrix for a single-hit weapon:
/// accuracy=a, max hit=m, hp.
/// Returns row-major (hp+1) x (hp+1).
fn single_matrix_internal(a: f64, m: usize, hp: usize) -> Vec<f64> {
    let n = hp + 1;
    let mut mat = vec![0.0f64; n * n];

    for i in 0..n {
        let row_start = i * n;

        for j in 0..n {
            // Diagonal: stay in same state on miss (except absorbing last column)
            if j == i && j != hp {
                mat[row_start + j] = 1.0 - a;
            }
            // Past diagonal up to i+m: uniform damage distribution (except absorbing col)
            if j > i && j <= i + m && j != hp {
                mat[row_start + j] = a / (m as f64);
            }
        }

        // Final column j=hp gets the remaining probability mass, making rows sum to 1.
        let mut sum = 0.0;
        for j in 0..n {
            sum += mat[row_start + j];
        }
        mat[row_start + (n - 1)] = 1.0 - sum;
    }

    mat
}

fn npc_state_internal(hp: usize) -> Vec<f64> {
    let mut v = vec![0.0f64; hp + 1];
    v[0] = 1.0;
    v
}

/// Apply transition matrix `no_hits` times.
fn hitting_basic_npc_internal(hp: usize, max_hit: usize, acc: f64, no_hits: usize) -> Vec<f64> {
    let n = hp + 1;
    let t = single_matrix_internal(acc, max_hit, hp);
    let mut state = npc_state_internal(hp);
    for _ in 0..no_hits {
        state = row_vec_times_square_mat(&state, &t, n);
    }
    state
}

/// Distribution of P(dead) by number of hits, until cap is reached.
/// Returns a Vec of cumulative death probabilities per hit index (0-based: after i hits).
fn distribution_of_hits_to_kill_internal(hp: usize, max_hit: usize, acc: f64, cap: f64) -> Vec<f64> {
    let n = hp + 1;
    let t = single_matrix_internal(acc, max_hit, hp);
    let mut state = npc_state_internal(hp);

    let mut out = Vec::with_capacity(128);
    let mut p_dead = state[n - 1];
    out.push(p_dead);

    while p_dead < cap {
        state = row_vec_times_square_mat(&state, &t, n);
        p_dead = state[n - 1];
        out.push(p_dead);
    }

    out
}

/// Thrall matrix: accuracy 0.75, max hit 3
fn thrall_matrix_internal(hp: usize) -> Vec<f64> {
    single_matrix_internal(0.75, 3, hp)
}

/// Weapon+Thrall tick simulation:
/// - weapon hits every 5th tick, starting at tick 1 (ticks: 1,6,11,...)
/// - thrall hits every 4th tick, starting at tick 2 (ticks: 2,6,10,...)
/// Returns cumulative P(dead) per tick, until cap hit.
fn weapon_and_thrall_kill_times_internal(hp: usize, max_hit: usize, acc: f64, cap: f64) -> Vec<f64> {
    let n = hp + 1;
    let weapon = single_matrix_internal(acc, max_hit, hp);
    let thrall = thrall_matrix_internal(hp);
    let mut state = npc_state_internal(hp);

    let mut out = Vec::with_capacity(512);
    let mut p_dead = state[n - 1];
    let mut tick: usize = 0;

    while p_dead < cap {
        tick += 1;

        // weapon on ticks 1,6,11,... => tick % 5 == 1
        if tick % 5 == 1 {
            state = row_vec_times_square_mat(&state, &weapon, n);
        }
        // thrall on ticks 2,6,10,... => tick % 4 == 2
        if tick % 4 == 2 {
            state = row_vec_times_square_mat(&state, &thrall, n);
        }

        p_dead = state[n - 1];
        out.push(p_dead);
    }
    out
}

// Keep existing functions for backward compatibility
#[wasm_bindgen]
pub fn single_matrix(a: f64, m: usize, hp: usize) -> Vec<f64> {
    single_matrix_internal(a, m, hp)
}

#[wasm_bindgen]
pub fn npc_state(hp: usize) -> Vec<f64> {
    npc_state_internal(hp)
}

#[wasm_bindgen]
pub fn hitting_basic_npc(hp: usize, max_hit: usize, acc: f64, no_hits: usize) -> Vec<f64> {
    hitting_basic_npc_internal(hp, max_hit, acc, no_hits)
}

#[wasm_bindgen]
pub fn distribution_of_hits_to_kill(hp: usize, max_hit: usize, acc: f64, cap: f64) -> Vec<f64> {
    distribution_of_hits_to_kill_internal(hp, max_hit, acc, cap)
}

#[wasm_bindgen]
pub fn weapon_and_thrall_kill_times(hp: usize, max_hit: usize, acc: f64, cap: f64) -> Vec<f64> {
    weapon_and_thrall_kill_times_internal(hp, max_hit, acc, cap)
}
