use serde::{Deserialize, Serialize};

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

#[derive(Deserialize, Clone)]
pub struct GearBonuses {
    #[serde(rename = "ranged_str")]
    pub ranged_str: i32,
    #[serde(rename = "magic_str")]
    pub magic_str: i32,
    pub str: i32,
    pub prayer: i32,
}

#[derive(Deserialize, Clone)]
pub struct GearOffensive {
    pub stab: i32,
    pub slash: i32,
    pub crush: i32,
    pub magic: i32,
    pub ranged: i32,
}

#[derive(Deserialize, Clone)]
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

#[derive(Deserialize, Clone)]
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

#[derive(Deserialize, Clone)]
pub struct SelectedItem {
    pub name: String,
    #[serde(deserialize_with = "from_str_or_int")]
    pub id: u32,
    pub speed: i32,
    pub two_handed: bool,
    pub slot: String,
    pub category: String,
    #[serde(rename = "weapon_styles")]
    pub weapon_styles: Option<Vec<WeaponStyle>>,
    #[serde(default)]
    pub bonuses: Option<GearBonuses>,
    #[serde(default)]
    pub offensive: Option<GearOffensive>,
    #[serde(default)]
    pub defensive: Option<GearDefensive>,
}

#[derive(Deserialize)]
pub struct GearSetData {
    #[serde(rename = "gearStats")]
    pub gear_stats: GearStats,
    #[serde(rename = "selectedWeapon")]
    pub selected_weapon: Option<SelectedItem>,
    #[serde(rename = "gearType")]
    pub gear_type: String,
    #[serde(rename = "gearItems")]
    pub gear_items: Vec<Option<SelectedItem>>,
}

#[derive(Deserialize)]
pub struct AllGearSets {
    pub melee: GearSetData,
    pub mage: GearSetData,
    pub ranged: GearSetData,
}

#[derive(Deserialize, Clone)]
pub struct InventoryItem {
    pub name: String,
    pub equipment: Option<SelectedItem>,
}

#[derive(Deserialize)]
pub struct Player {
    #[serde(rename = "combatStats")]
    pub combat_stats: CombatStats,
    #[serde(rename = "gearSets")]
    pub gear_sets: AllGearSets,
    pub inventory: Vec<InventoryItem>,
}

#[derive(Deserialize, Clone)]
pub struct MonsterSkills {
    pub atk: u32,
    pub def: u32,
    pub hp: u32,
    pub magic: u32,
    pub ranged: u32,
    pub str: u32,
}

#[derive(Deserialize, Clone)]
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

#[derive(Deserialize, Clone)]
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

#[derive(Deserialize, Clone)]
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

impl SelectedItem {
    pub fn get_stat(&self, stat_type: &str, stat: &str) -> i32 {
        match stat_type {
            "bonuses" => self.bonuses.as_ref().and_then(|b| match stat {
                "str" => Some(b.str),
                "ranged_str" => Some(b.ranged_str),
                "magic_str" => Some(b.magic_str),
                "prayer" => Some(b.prayer),
                _ => None,
            }).unwrap_or(0),
            "offensive" => self.offensive.as_ref().and_then(|o| match stat {
                "stab" => Some(o.stab),
                "slash" => Some(o.slash),
                "crush" => Some(o.crush),
                "magic" => Some(o.magic),
                "ranged" => Some(o.ranged),
                _ => None,
            }).unwrap_or(0),
            _ => 0,
        }
    }
}

use serde::de::{self, Deserializer};
pub fn from_str_or_int<'de, D>(deserializer: D) -> Result<u32, D::Error>
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