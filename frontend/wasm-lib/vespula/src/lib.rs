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
    pub speed: i32,
    pub category: String,
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
    pub att_spd_reduction: i32,
}

#[derive(Deserialize)]
pub struct DPSPayload {
    pub player: Player,
    pub monsters: Vec<Monster>,
    pub config: DPSConfig,
}

#[derive(Deserialize)]
pub struct DPSConfig {
    pub cap: f64,
}

#[derive(Deserialize)]
pub struct DPSRoomPayload {
    pub player: Player,
    pub room: Room,
    pub config: DPSConfig,
}

#[derive(Deserialize)]
pub struct Room {
    pub id: String,
    pub name: String,
    pub image: Option<String>,
    pub description: Option<String>,
    pub monsters: Vec<Monster>,
}

// Custom deserializer for u32 that accepts string or int
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

// Updated calculation functions to use melee gear set
fn calculate_max_hit_for_style(player: &Player, style: &WeaponStyle, gear: &GearStats) -> (u32, u32) {
    let magic_level = player.combat_stats.magic as f64;
    let potion_bonus = 21.0;
    let style_bonus = style.magic as f64;
    let void_bonus = 0.0; // No void for now
    let prayer_magic_bonus = 4.0;
    console_log!("Magic Strength for style: {}", gear.bonuses.magic_str);

    // Get magic damage bonus as a fraction (e.g., 15 for +15% becomes 0.15)
    let magic_damage_bonus = (gear.bonuses.magic_str as f64 + prayer_magic_bonus) / 100.0;

    // Default values
    let mut effective_magic = (magic_level + potion_bonus).floor();
    let mut base_damage = 0.0;
    let mut multiplier = 1.0;

    console_log!("magic_level: {}", magic_level);
    console_log!("potion_bonus: {}", potion_bonus);
    console_log!("style_bonus: {}", style_bonus);
    console_log!("void_bonus: {}", void_bonus);
    console_log!("prayer_magic_bonus: {}", prayer_magic_bonus);
    console_log!("magic_damage_bonus: {}", magic_damage_bonus);

    // Check if selected_weapon exists
    if let Some(ref weapon) = player.gear_sets.mage.selected_weapon {
        console_log!("Selected weapon: {} (category: {})", weapon.name, weapon.category);
        if weapon.name == "Tumeken's shadow" {
            multiplier = 3.0;
            console_log!("Tumeken's shadow: multiplier = {}, base_damage = {}", multiplier, base_damage);
        } 
        if weapon.category == "Powered Staff" {
            effective_magic = (magic_level + potion_bonus).floor();
            base_damage = ((effective_magic / 3.0) - 1.0).floor();
            console_log!("Powered Staff: effective_magic = {}, base_damage = {}", effective_magic, base_damage);
        } else {
            // For other weapons/spells, set base_damage as needed
            base_damage = 0.0;
            console_log!("Other weapon: base_damage = {}", base_damage);
        }
    } else {
        console_log!("No selected weapon found.");
    }

    // Calculate max hit with all modifiers, flooring after each step
    let max_hit = (base_damage * (1.0 + ((magic_damage_bonus + void_bonus) * multiplier).min(2.0))).floor() as u32;
    console_log!("max_hit: {}", max_hit);

    (max_hit, effective_magic as u32)
}

fn calculate_accuracy_for_style(player: &Player, monster: &Monster, style: &WeaponStyle, gear: &GearStats) -> (f64, u32, u64, u64) {
    let magic_level = player.combat_stats.magic;
    let potion_bonus = 21;
    let prayer_magic_bonus = 1.25;
    let style_bonus = style.magic;
    let void_bonus = 1.0; // No void for now
    let effective_magic = ((((magic_level + potion_bonus) as f64 * prayer_magic_bonus).floor() + style_bonus as f64 + 8.0) * void_bonus).floor() as u32;
    let equipment_bonus = match style.attack_type.to_lowercase().as_str() {
        "stab" => gear.offensive.stab,
        "slash" => gear.offensive.slash,
        "crush" => gear.offensive.crush,
        "magic" => gear.offensive.magic,
        "ranged" => gear.offensive.ranged,
        _ => 0,
    };
    let magic_bonus = equipment_bonus;
    let max_attack_roll = effective_magic as u64 * (magic_bonus + 64) as u64;
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
    (accuracy, effective_magic, max_attack_roll, max_defence_roll)
}



fn find_best_combat_style(player: &Player, monster: &Monster) -> StyleResult {
    let mut best_style: Option<StyleResult> = None;
    let mut best_dps = 0.0;
    // Use mage weapon from mage gear set
    if let Some(weapon) = &player.gear_sets.mage.selected_weapon {
        console_log!("Evaluating {} combat styles for mage weapon: {}", weapon.weapon_styles.len(), weapon.name);
        for style in &weapon.weapon_styles {
            let (max_hit, _effective_magic) = calculate_max_hit_for_style(player, style, &player.gear_sets.mage.gear_stats);
            let (accuracy, effective_magic, max_attack_roll, max_defence_roll) = calculate_accuracy_for_style(player, monster, style, &player.gear_sets.mage.gear_stats);
            let effective_dps = max_hit as f64 * accuracy;
            let effective_strength = 0; // Not used for mage
            let effective_attack = effective_magic;
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
                att_spd_reduction: style.att_spd_reduction, // <-- Add this line
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
        let magic_level = player.combat_stats.attack;
        let potion_bonus = 19;
        let prayer_strength_bonus = 1.23;
        let prayer_attack_bonus = 1.20;
        let effective_strength = ((((magic_level + potion_bonus) as f64 * prayer_strength_bonus).floor() + 8.0)).floor() as u32;
        let effective_attack = ((((magic_level + potion_bonus) as f64 * prayer_attack_bonus).floor() + 8.0)).floor() as u32;
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
            att_spd_reduction: 0, // fallback
        });
    }
    let result = best_style.unwrap();
    console_log!("🏆 Best melee combat style selected: {} ({}) with {:.2} effective DPS", result.combat_style, result.attack_type, result.effective_dps);
    result
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
pub fn calculate_dps_with_objects_vespula(payload_json: &str) -> String {
    console_log!("Received payload JSON: {}", payload_json);

    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            console_log!("Failed to parse payload JSON: {}", e);
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let player = payload.player;
    let monsters = payload.room.monsters;
    let cap = payload.config.cap;

    let walk_delay = 21;
    let mut total_expected_hits = 0.0;
    let mut total_expected_ticks = 0.0;
    let mut total_expected_seconds = 0.0;
    let mut first = true;
    let mut results = Vec::new();

    // For cumulative kill times
    let mut encounter_kill_times: Vec<f64> = Vec::new();
    let mut encounter_attack_speed: Option<usize> = None;

    for monster in monsters {
        let best_style = find_best_combat_style(&player, &monster);

        let max_hit = best_style.max_hit as usize;
        let accuracy = best_style.accuracy;
        let hp = monster.skills.hp as usize;

        let attack_speed = if let Some(weapon) = &player.gear_sets.mage.selected_weapon {
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

    // Convert encounter_kill_times to JSON object array
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