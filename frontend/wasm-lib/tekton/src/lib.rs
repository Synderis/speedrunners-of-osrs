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
pub struct GearBonuses {
    pub str: i32,
    pub ranged_str: i32,
    pub magic_str: i32,
    pub prayer: i32,
}

#[derive(Deserialize)]
pub struct GearOffensive {
    pub stab: i32,
    pub slash: i32,
    pub crush: i32,
    pub magic: i32,
    pub ranged: i32,
}

#[derive(Deserialize)]
pub struct GearDefensive {
    pub stab: i32,
    pub slash: i32,
    pub crush: i32,
    pub magic: i32,
    pub ranged: i32,
}

#[derive(Deserialize)]
pub struct GearStats {
    pub bonuses: GearBonuses,
    pub offensive: GearOffensive,
    pub defensive: GearDefensive,
}


#[derive(Deserialize)]
pub struct WeaponStyle {
    pub name: String,
    pub attack_type: String,
    pub combat_style: String,
    pub att: i32,
    #[serde(rename = "str")]
    pub str_: i32,
    pub def: i32,
    pub ranged: i32,
    pub magic: i32,
    pub att_spd_reduction: i32,
}

#[derive(Deserialize)]
pub struct SelectedWeapon {
    pub name: String,
    pub id: u32,
    #[serde(rename = "weapon_styles")]
    pub weapon_styles: Vec<WeaponStyle>,
}


// New struct for individual gear set data
#[derive(Deserialize)]
pub struct GearSetData {
    #[serde(rename = "gearStats")]
    pub gear_stats: GearStats,
    #[serde(rename = "selectedWeapon")]
    pub selected_weapon: Option<SelectedWeapon>,
    #[serde(rename = "gearType")]
    pub gear_type: String,
}

// New struct for all gear sets
#[derive(Deserialize)]
pub struct AllGearSets {
    pub melee: GearSetData,
    pub mage: GearSetData,
    pub ranged: GearSetData,
}

// Updated Player struct to use new gear sets structure
#[derive(Deserialize)]
pub struct Player {
    #[serde(rename = "combatStats")]
    pub combat_stats: CombatStats,
    #[serde(rename = "gearSets")]
    pub gear_sets: AllGearSets,
}


#[derive(Deserialize)]
pub struct MonsterSkills {
    pub atk: u32,
    pub def: u32,
    pub hp: u32,
    pub magic: u32,
    pub ranged: u32,
    pub str: u32,
}

#[derive(Deserialize)]
pub struct MonsterOffensive {
    pub atk: i32,
    pub magic: i32,
    pub magic_str: i32,
    pub ranged: i32,
    pub ranged_str: i32,
    pub str: i32,
}

#[derive(Deserialize)]
pub struct MonsterDefensive {
    pub flat_armour: i32,
    pub crush: i32,
    pub magic: i32,
    pub heavy: i32,
    pub standard: i32,
    pub light: i32,
    pub slash: i32,
    pub stab: i32,
}

#[derive(Deserialize)]
pub struct Monster {
    pub id: u32,
    pub name: String,
    pub version: Option<String>,
    pub image: Option<String>,
    pub level: Option<u32>,
    pub speed: Option<u32>,
    pub style: Option<Vec<String>>,
    pub size: Option<u32>,
    pub max_hit: Option<u32>,
    pub skills: MonsterSkills,
    pub offensive: MonsterOffensive,
    pub defensive: MonsterDefensive,
    pub attributes: Option<Vec<String>>,
    pub immunities: Option<serde_json::Value>,
    pub weakness: Option<serde_json::Value>,
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

// Updated calculation functions to use melee gear set
fn calculate_max_hit_for_style(player: &Player, style: &WeaponStyle, gear: &GearStats) -> (u32, u32) {
    let strength_level = player.combat_stats.strength;
    let potion_bonus = 19; // Super strength potion
    let prayer_strength_bonus = 1.23; // Piety
    // Style bonus based on combat style
    let style_bonus = style.str_;
    let void_bonus = 1.0; // No void for now
    let effective_strength = ((((strength_level + potion_bonus) as f64 * prayer_strength_bonus).floor() + style_bonus as f64 + 8.0) * void_bonus).floor() as u32;
    let strength_bonus = gear.bonuses.str;
    let max_hit = (0.5 + (effective_strength as f64 * (strength_bonus + 64) as f64) / 640.0).floor() as u32;
    (max_hit, effective_strength)
}

fn calculate_accuracy_for_style(player: &Player, monster: &Monster, style: &WeaponStyle, gear: &GearStats) -> (f64, u32, u64, u64) {
    let attack_level = player.combat_stats.attack;
    let potion_bonus = 19; // Super attack potion
    let prayer_attack_bonus = 1.20; // Piety
    let style_bonus = style.att;
    let void_bonus = 1.0; // No void for now
    let effective_attack = ((((attack_level + potion_bonus) as f64 * prayer_attack_bonus).floor() + style_bonus as f64 + 8.0) * void_bonus).floor() as u32;
    let equipment_bonus = match style.attack_type.to_lowercase().as_str() {
        "stab" => gear.offensive.stab,
        "slash" => gear.offensive.slash,
        "crush" => gear.offensive.crush,
        "magic" => gear.offensive.magic,
        "ranged" => gear.offensive.ranged,
    };
    let attack_bonus = equipment_bonus;
    let max_attack_roll = effective_attack as u64 * (attack_bonus + 64) as u64;
    let defence_bonus = match style.attack_type.to_lowercase().as_str() {
        "stab" => monster.defensive.stab,
        "slash" => monster.defensive.slash,
        "crush" => monster.defensive.crush,
        "magic" => monster.defensive.magic,
        "ranged" => monster.defensive.standard, // Use standard for ranged defence
    };
    let max_defence_roll = (monster.skills.def + 9) as u64 * (defence_bonus + 64) as u64;
    let accuracy = if max_attack_roll > max_defence_roll {
        1.0 - (max_defence_roll + 2) as f64 / (2.0 * (max_attack_roll + 1) as f64)
    } else {
        max_attack_roll as f64 / (2.0 * (max_defence_roll + 1) as f64)
    };
    (accuracy, effective_attack, max_attack_roll, max_defence_roll)
}

#[derive(Serialize)]
pub struct StyleResult {
    pub combat_style: String,
    pub attack_type: String,
    pub max_hit: u32,
    pub accuracy: f64,
    pub effective_dps: f64,
    pub effective_strength: u32,
    pub effective_attack: u32,
    pub max_attack_roll: u64,
    pub max_defence_roll: u64,
}

fn find_best_combat_style(player: &Player, monster: &Monster) -> StyleResult {
    let mut best_style: Option<StyleResult> = None;
    let mut best_dps = 0.0;
    // Use melee weapon from melee gear set
    if let Some(weapon) = &player.gear_sets.melee.selected_weapon {
        console_log!("Evaluating {} combat styles for melee weapon: {}", weapon.weapon_styles.len(), weapon.name);
        for style in &weapon.weapon_styles {
            let (max_hit, effective_strength) = calculate_max_hit_for_style(player, style, &player.gear_sets.melee.gear_stats);
            let (accuracy, effective_attack, max_attack_roll, max_defence_roll) = calculate_accuracy_for_style(player, monster, style, &player.gear_sets.melee.gear_stats);
            let effective_dps = max_hit as f64 * accuracy;
            console_log!("Style: {} ({}), Max Hit: {}, Accuracy: {:.2}%, Effective DPS: {:.2}", style.combat_style, style.attack_type, max_hit, accuracy * 100.0, effective_dps);
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
            };
            if effective_dps > best_dps {
                best_dps = effective_dps;
                best_style = Some(style_result);
            }
        }
    }
    // Fallback if no melee weapon or weapon styles
    if best_style.is_none() {
        console_log!("No melee weapon styles found, using fallback calculation");
        let strength_level = player.combat_stats.strength;
        let attack_level = player.combat_stats.attack;
        let potion_bonus = 19;
        let prayer_strength_bonus = 1.23;
        let prayer_attack_bonus = 1.20;
        let effective_strength = ((((strength_level + potion_bonus) as f64 * prayer_strength_bonus).floor() + 8.0)).floor() as u32;
        let effective_attack = ((((attack_level + potion_bonus) as f64 * prayer_attack_bonus).floor() + 8.0)).floor() as u32;
        let strength_bonus = player.gear_sets.melee.gear_stats.bonuses.str;
        let attack_bonus = player.gear_sets.melee.gear_stats.offensive.stab;
        let max_hit = (0.5 + (effective_strength as f64 * (strength_bonus + 64) as f64) / 640.0).floor() as u32;
        let max_attack_roll = effective_attack as u64 * (attack_bonus + 64) as u64;
    let max_defence_roll = (monster.skills.def + 9) as u64 * (monster.defensive.stab + 64) as u64;
        let accuracy = if max_attack_roll > max_defence_roll {
            1.0 - (max_defence_roll + 2) as f64 / (2.0 * (max_attack_roll + 1) as f64)
        } else {
            max_attack_roll as f64 / (2.0 * (max_defence_roll + 1) as f64)
        };
        best_style = Some(StyleResult {
            combat_style: "fallback".to_string(),
            attack_type: "stab".to_string(),
            max_hit,
            accuracy,
            effective_dps: max_hit as f64 * accuracy,
            effective_strength,
            effective_attack,
            max_attack_roll,
            max_defence_roll,
        });
    }
    let result = best_style.unwrap();
    console_log!("🏆 Best melee combat style selected: {} ({}) with {:.2} effective DPS", result.combat_style, result.attack_type, result.effective_dps);
    result
}

/// Updated function that accepts new player object structure and uses melee gear set
#[wasm_bindgen]
pub fn calculate_dps_with_objects_tekton(payload_json: &str) -> String {
    console_log!("Received payload JSON: {}", payload_json);
    
    let payload: DPSPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            console_log!("Failed to parse payload JSON: {}", e);
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };
    
    // Extract player, monster, and config from payload
    let player = payload.player;
    let monster = payload.monster;
    let cap = payload.config.cap;
    
    console_log!("Extracted player combat stats - Attack: {}, Strength: {}", 
        player.combat_stats.attack, player.combat_stats.strength);
    console_log!("Extracted monster - Name: {}, HP: {}, CB: {:?}", 
        monster.name, monster.skills.hp, monster.level);
    console_log!("Config - Cap: {}", cap);
    
    console_log!("Using melee gear set for calculations");
    console_log!("Melee gear stats - Attack Stab: {}, Melee Strength: {}", 
        player.gear_sets.melee.gear_stats.offensive.stab, 
        player.gear_sets.melee.gear_stats.bonuses.str);
    
    if let Some(weapon) = &player.gear_sets.melee.selected_weapon {
        console_log!("Melee weapon: {}", weapon.name);
    } else {
        console_log!("No melee weapon selected");
    }
    
    // Find the best combat style using melee gear set
    let best_style = find_best_combat_style(&player, &monster);
    
    console_log!("Using best melee style - Max Hit: {}, Accuracy: {:.2}%", best_style.max_hit, best_style.accuracy * 100.0);
    
    // Generate kill time distribution using the best style
    let kill_times = weapon_and_thrall_kill_times_internal(monster.skills.hp as usize, best_style.max_hit as usize, best_style.accuracy, cap);
    
    let result = CalculationResult {
        max_hit: best_style.max_hit,
        accuracy: best_style.accuracy,
        effective_strength: best_style.effective_strength,
        effective_attack: best_style.effective_attack,
        max_attack_roll: best_style.max_attack_roll,
        max_defence_roll: best_style.max_defence_roll,
    };
    
    let response = serde_json::json!({
        "calculation": result,
        "best_style": {
            "combat_style": best_style.combat_style,
            "attack_type": best_style.attack_type,
            "effective_dps": best_style.effective_dps,
            "gear_type": "melee"
        },
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

#[derive(Deserialize)]
pub struct DPSPayload {
    pub player: Player,
    pub monster: Monster,
    pub config: DPSConfig,
}

#[derive(Deserialize)]
pub struct DPSConfig {
    pub cap: f64,
}
