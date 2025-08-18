use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

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

// --- Types (same as tekton) ---
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
    #[serde(rename = "ranged_str")]
    pub ranged_str: i32,
    #[serde(rename = "magic_str")]
    pub magic_str: i32,
    pub str: i32,
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
    #[serde(rename = "attack_type")]
    pub attack_type: String,
    #[serde(rename = "combat_style")]
    pub combat_style: String,
    pub att: i32,
    #[serde(rename = "str")]
    pub str_: i32,
    pub def: i32,
    pub ranged: i32,
    pub magic: i32,
    #[serde(rename = "att_spd_reduction")]
    pub att_spd_reduction: i32,
}

#[derive(Deserialize)]
pub struct SelectedWeapon {
    pub name: String,
    #[serde(deserialize_with = "from_str_or_int")]
    pub id: u32,
    #[serde(rename = "weapon_styles")]
    pub weapon_styles: Vec<WeaponStyle>,
}

#[derive(Deserialize)]
pub struct GearSetData {
    #[serde(rename = "gearStats")]
    pub gear_stats: GearStats,
    #[serde(rename = "selectedWeapon")]
    pub selected_weapon: Option<SelectedWeapon>,
    #[serde(rename = "gearType")]
    pub gear_type: String,
}

#[derive(Deserialize)]
pub struct AllGearSets {
    pub melee: GearSetData,
    pub mage: GearSetData,
    pub ranged: GearSetData,
}

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
    #[serde(rename = "ranged_str")]
    pub ranged_str: i32,
    #[serde(rename = "magic_str")]
    pub magic_str: i32,
    pub atk: i32,
    pub magic: i32,
    pub ranged: i32,
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

// --- Custom deserializer for u32 that accepts string or int ---
use serde::de::{self, Deserializer};
fn from_str_or_int<'de, D>(deserializer: D) -> Result<u32, D::Error>
where
    D: Deserializer<'de>,
{
    struct StringOrIntVisitor;
    impl<'de> de::Visitor<'de> for StringOrIntVisitor {
        type Value = u32;
        fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
            formatter.write_str("a string or integer representing a u32")
        }
        fn visit_u64<E>(self, value: u64) -> Result<u32, E>
        where
            E: de::Error,
        {
            Ok(value as u32)
        }
        fn visit_str<E>(self, value: &str) -> Result<u32, E>
        where
            E: de::Error,
        {
            value.parse::<u32>().map_err(E::custom)
        }
    }
    deserializer.deserialize_any(StringOrIntVisitor)
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
    let accuracy = if max_attack_roll > max_defence_roll {
        1.0 - (max_defence_roll + 2) as f64 / (2.0 * (max_attack_roll + 1) as f64)
    } else {
        max_attack_roll as f64 / (2.0 * (max_defence_roll + 1) as f64)
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
            };
            if effective_dps > best_dps {
                best_dps = effective_dps;
                best_style = Some(style_result);
            }
        }
    }
    // Fallback if no melee weapon or weapon styles
    if best_style.is_none() {
        let strength_level = player.combat_stats.strength;
        let attack_level = player.combat_stats.attack;
        let potion_bonus = 21.0;
        let prayer_strength_bonus = 1.23;
        let prayer_attack_bonus = 1.20;
        let effective_strength = (((strength_level as f64 + potion_bonus) * prayer_strength_bonus + 8.0)).floor() as u32;
        let effective_attack = (((attack_level as f64 + potion_bonus) * prayer_attack_bonus + 8.0)).floor() as u32;
        let strength_bonus = player.gear_sets.melee.gear_stats.bonuses.str as f64;
        let attack_bonus = player.gear_sets.melee.gear_stats.offensive.stab;
        let base_max_hit = (0.5 + (effective_strength as f64 * (strength_bonus + 64.0)) / 640.0).floor();
        let level_requirement = 60.0;
        let mining_level = player.combat_stats.mining as f64;
        let damage_multiplier = (50.0 + mining_level + level_requirement) / 150.0;
        let max_hit = (base_max_hit * damage_multiplier).ceil() as u32;
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
    best_style.unwrap()
}

// --- Matrix helpers (same as tekton) ---
fn row_vec_times_square_mat(row: &[f64], mat: &[f64], n: usize) -> Vec<f64> {
    let mut out = vec![0.0; n];
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

fn single_matrix_internal(a: f64, m: usize, hp: usize) -> Vec<f64> {
    let n = hp + 1;
    let mut mat = vec![0.0f64; n * n];
    for i in 0..n {
        let row_start = i * n;
        for j in 0..n {
            if j == i && j != hp {
                mat[row_start + j] = 1.0 - a;
            }
            if j > i && j <= i + m && j != hp {
                mat[row_start + j] = a / (m as f64);
            }
        }
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

fn hitting_basic_npc_internal(hp: usize, max_hit: usize, acc: f64, no_hits: usize) -> Vec<f64> {
    let n = hp + 1;
    let t = single_matrix_internal(acc, max_hit, hp);
    let mut state = npc_state_internal(hp);
    for _ in 0..no_hits {
        state = row_vec_times_square_mat(&state, &t, n);
    }
    state
}

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

fn weapon_kill_times_internal(hp: usize, max_hit: usize, acc: f64, cap: f64) -> Vec<f64> {
    let n = hp + 1;
    let weapon = single_matrix_internal(acc, max_hit, hp);
    let mut state = npc_state_internal(hp);

    let mut out = Vec::with_capacity(512);
    let mut p_dead = state[n - 1];
    let mut tick: usize = 0;

    while p_dead < cap {
        tick += 1;
        // Guardians: Only apply weapon hits (every 5 ticks, or whatever your attack interval is)
        if tick % 5 == 1 {
            state = row_vec_times_square_mat(&state, &weapon, n);
        }
        p_dead = state[n - 1];
        out.push(p_dead);
    }
    out
}

// --- WASM exports (same as tekton) ---
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
pub fn weapon_kill_times(hp: usize, max_hit: usize, acc: f64, cap: f64) -> Vec<f64> {
    weapon_kill_times_internal(hp, max_hit, acc, cap)
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_guardians(payload_json: &str) -> String {
    console_log!("Received payload JSON: {}", payload_json);

    let payload: DPSPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            console_log!("Failed to parse payload JSON: {}", e);
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let player = payload.player;
    let monster = payload.monster;
    let cap = payload.config.cap;
    let mining_level = player.combat_stats.mining as f64;

    console_log!("Extracted player combat stats - Attack: {}, Strength: {}, Mining: {}", 
        player.combat_stats.attack, player.combat_stats.strength, player.combat_stats.mining);
    console_log!("Extracted monster - Name: {}, HP: {}, CB: {:?}", 
        monster.name, monster.skills.hp, monster.level);
    console_log!("Config - Cap: {}", cap);

    let best_style = find_best_combat_style(&player, &monster, mining_level);

    console_log!("Using best melee style - Max Hit: {}, Accuracy: {:.2}%", best_style.max_hit, best_style.accuracy * 100.0);

    let kill_times = weapon_kill_times_internal(monster.skills.hp as usize, best_style.max_hit as usize, best_style.accuracy, cap);

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