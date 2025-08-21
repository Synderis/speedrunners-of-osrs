use serde::{Deserialize, Serialize};
use std::fs;
use std::env;

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

#[derive(Deserialize)]
pub struct InputPayload {
    pub player: Player,
    pub monster: Monster,
    pub config: Config,
}

#[derive(Deserialize)]
pub struct Config {
    pub cap: f64,
}

#[derive(Serialize)]
pub struct Output {
    pub best_style: BestStyle,
    pub calculation: Calculation,
    pub kill_times: Vec<f64>,
}

#[derive(Serialize)]
pub struct BestStyle {
    pub attack_type: String,
    pub combat_style: String,
    pub effective_dps: f64,
    pub gear_type: String,
}

#[derive(Serialize)]
pub struct Calculation {
    pub accuracy: f64,
    pub effective_attack: u32,
    pub effective_strength: u32,
    pub max_attack_roll: u64,
    pub max_defence_roll: u64,
    pub max_hit: u32,
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

fn calculate_max_hit(player: &Player, style: &WeaponStyle, gear: &GearStats) -> (u32, u32) {
    let strength_level = player.combat_stats.strength;
    let potion_bonus = 21.0; // Super strength potion
    let prayer_strength_bonus = 1.23; // Piety
    let style_bonus = style.str_ as f64;
    let void_bonus = 1.0; // No void for now
    let effective_strength = (((strength_level as f64 + potion_bonus) * prayer_strength_bonus + style_bonus + 8.0) * void_bonus).floor() as u32;
    let strength_bonus = gear.bonuses.str as f64;
    let max_hit = (0.5 + (effective_strength as f64 * (strength_bonus + 64.0)) / 640.0).floor() as u32;
    (max_hit, effective_strength)
}

fn calculate_accuracy(player: &Player, monster: &Monster, style: &WeaponStyle, gear: &GearStats) -> (f64, u32, u64, u64) {
    let attack_level = player.combat_stats.attack;
    let potion_bonus = 21.0; // Super attack potion
    let prayer_attack_bonus = 1.20; // Piety
    let style_bonus = style.att as f64;
    let void_bonus = 1.0; // No void for now
    let effective_attack = (((attack_level as f64 + potion_bonus) * prayer_attack_bonus + style_bonus + 8.0) * void_bonus).floor() as u32;
    let attack_type = style.attack_type.to_lowercase();
    let equipment_bonus = match attack_type.as_str() {
        "stab" => gear.offensive.stab,
        "slash" => gear.offensive.slash,
        "crush" => gear.offensive.crush,
        "magic" => gear.offensive.magic,
        "ranged" => gear.offensive.ranged,
        _ => 0,
    } as f64;
    let attack_bonus = equipment_bonus;
    let max_attack_roll = effective_attack as u64 * (attack_bonus as u64 + 64);
    let defence_bonus = match attack_type.as_str() {
        "stab" => monster.defensive.stab,
        "slash" => monster.defensive.slash,
        "crush" => monster.defensive.crush,
        "magic" => monster.defensive.magic,
        "ranged" => monster.defensive.standard,
        _ => 0,
    } as f64;
    let max_defence_roll = (monster.skills.def as u64 + 9) * (defence_bonus as u64 + 64);
    let accuracy = if max_attack_roll > max_defence_roll {
        1.0 - (max_defence_roll as f64 + 2.0) / (2.0 * (max_attack_roll as f64 + 1.0))
    } else {
        max_attack_roll as f64 / (2.0 * (max_defence_roll as f64 + 1.0))
    };
    (accuracy, effective_attack, max_attack_roll, max_defence_roll)
}

fn build_transition_matrix(hp: usize, max_hit: usize, accuracy: f64) -> Vec<Vec<f64>> {
    let n = hp + 1;
    let mut mat = vec![vec![0.0; n]; n];
    for i in 0..n {
        if i == 0 {
            mat[i][i] = 1.0;
            continue;
        }
        mat[i][i] += 1.0 - accuracy;
        for dmg in 0..=max_hit.min(i) {
            let next_hp = i.saturating_sub(dmg);
            mat[i][next_hp] += accuracy / (max_hit as f64 + 1.0);
        }
    }
    mat
}

fn propagate_state(state: &Vec<f64>, mat: &Vec<Vec<f64>>) -> Vec<f64> {
    let n = state.len();
    let mut new_state = vec![0.0; n];
    for i in 0..n {
        for j in 0..n {
            new_state[j] += state[i] * mat[i][j];
        }
    }
    new_state
}

fn kill_time_distribution_matrix(hp: usize, max_hit: usize, accuracy: f64, cap: f64, max_steps: usize) -> Vec<f64> {
    let n = hp + 1;
    let mat = build_transition_matrix(hp, max_hit, accuracy);
    let mut state = vec![0.0; n];
    state[hp] = 1.0;
    let mut kill_times = Vec::new();
    let mut p_dead = 0.0;
    while p_dead < cap && kill_times.len() < max_steps {
        state = propagate_state(&state, &mat);
        p_dead = state[0];
        kill_times.push(p_dead);
    }
    kill_times
}

fn find_best_melee_style(player: &Player, monster: &Monster, damage_multiplier: f64) -> (WeaponStyle, u32, f64, u32, u32, u64, u64, f64) {
    let gear = &player.gear_sets.melee.gear_stats;
    let weapon = player.gear_sets.melee.selected_weapon.as_ref().expect("No melee weapon");
    let mut best: Option<(WeaponStyle, u32, f64, u32, u32, u64, u64, f64)> = None;
    let mut best_dps = 0.0;
    for style in &weapon.weapon_styles {
        let (max_hit, effective_strength) = calculate_max_hit(player, style, gear);
        let max_hit = ((max_hit as f64) * damage_multiplier).ceil() as u32;
        let (accuracy, effective_attack, max_attack_roll, max_defence_roll) = calculate_accuracy(player, monster, style, gear);
        let dps = max_hit as f64 * accuracy;
        if dps > best_dps {
            best_dps = dps;
            best = Some((style.clone(), max_hit, accuracy, effective_strength, effective_attack, max_attack_roll, max_defence_roll, dps));
        }
    }
    best.expect("No best style found")
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: guardians_sim INPUT_JSON_FILE");
        std::process::exit(1);
    }
    let input_path = &args[1];
    let input_data = fs::read_to_string(input_path).expect("Failed to read input file");
    let payload: InputPayload = serde_json::from_str(&input_data).expect("Failed to parse input JSON");

    let player = payload.player;
    let monster = payload.monster;
    let cap = payload.config.cap;
    let mining_level = player.combat_stats.mining as f64;
    let level_requirement = 60.0;
    let damage_multiplier = (50.0 + mining_level + level_requirement) / 150.0;

    let (style, max_hit, accuracy, effective_strength, effective_attack, max_attack_roll, max_defence_roll, dps) = find_best_melee_style(&player, &monster, damage_multiplier);
    let kill_times = kill_time_distribution_matrix(
        monster.skills.hp as usize,
        max_hit as usize,
        accuracy,
        cap,
        512,
    );

    let output = Output {
        best_style: BestStyle {
            attack_type: style.attack_type,
            combat_style: style.combat_style,
            effective_dps: dps,
            gear_type: "melee".to_string(),
        },
        calculation: Calculation {
            accuracy,
            effective_attack,
            effective_strength,
            max_attack_roll,
            max_defence_roll,
            max_hit,
        },
        kill_times,
    };

    println!("{}", serde_json::to_string(&output).unwrap());
}
