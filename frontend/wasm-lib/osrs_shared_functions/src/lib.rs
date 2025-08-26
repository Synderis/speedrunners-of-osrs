use wasm_bindgen::prelude::*;
use osrs_shared_types::*;

#[wasm_bindgen]
extern "C" {
    // fn alert(s: &str);
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}
pub fn find_best_combat_style(player: &Player, monster: &Monster, combat_types: Vec<String>) -> StyleResult {
    let mut best_style: Option<StyleResult> = None;
    let mut best_dps = 0.0;

    for combat_type in combat_types {
        let (selected_weapon, gear_stats) = match combat_type.as_str() {
            "magic" => (&player.gear_sets.mage.selected_weapon, &player.gear_sets.mage.gear_stats),
            "ranged" => (&player.gear_sets.ranged.selected_weapon, &player.gear_sets.ranged.gear_stats),
            "melee" => (&player.gear_sets.melee.selected_weapon, &player.gear_sets.melee.gear_stats),
            _ => continue,
        };

        if let Some(weapon) = selected_weapon {
            if let Some(styles) = &weapon.weapon_styles {
                console_log!(
                    "Evaluating {} combat styles for {} weapon: {}",
                    styles.len(),
                    combat_type,
                    weapon.name
                );
                for style in styles {
                    let (max_hit, _effective_level) = calculate_max_hit_for_style(player, monster, &combat_type, style, gear_stats);
                    let (accuracy, effective_level, max_attack_roll, max_defence_roll) = calculate_accuracy_for_style(player, monster, &combat_type, style, gear_stats);
                    let effective_dps = (max_hit as f64 * accuracy) / (weapon.speed as f64 - style.att_spd_reduction as f64);
                    let effective_strength = 0; // Not used for mage/ranged
                    let effective_attack = effective_level;
                    console_log!(
                        "Style: {} ({}), effective_level: {}, max_attack_roll: {:.2}%, max_defence_roll: {:.2}%",
                        style.combat_style,
                        style.attack_type,
                        effective_level,
                        max_attack_roll,
                        max_defence_roll
                    );
                    console_log!(
                        "Style: {} ({}), Max Hit: {}, Accuracy: {:.2}%, Effective DPS: {:.2}",
                        style.combat_style,
                        style.attack_type,
                        max_hit,
                        accuracy * 100.0,
                        effective_dps
                    );
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
        }
    }
    let result = best_style.unwrap();
    console_log!(
        "🏆 Best combat style selected: {} ({}) with {:.2} effective DPS",
        result.combat_style,
        result.attack_type,
        result.effective_dps
    );
    result
}


pub fn calculate_max_hit_for_style(
    player: &Player,
    monster: &Monster,
    combat_type: &str,
    style: &WeaponStyle,
    gear: &GearStats,
) -> (u32, u32) {
    // Get the relevant level, prayer bonus, bonus, style bonus, and weapon
    let (level, prayer_bonus, gear_set, bonus, style_bonus, weapon) = match combat_type {
        "magic" => (
            player.combat_stats.magic as f64,
            4.0, // This is a flat addition, not a multiplier!
            &player.gear_sets.mage,
            gear.bonuses.magic_str as f64,
            style.magic as f64,
            player.gear_sets.mage.selected_weapon.as_ref(),
        ),
        "ranged" => (
            player.combat_stats.ranged as f64,
            1.23,
            &player.gear_sets.ranged,
            gear.bonuses.ranged_str as f64,
            style.ranged as f64,
            player.gear_sets.ranged.selected_weapon.as_ref(),
        ),
        "melee" => (
            player.combat_stats.strength as f64,
            1.23,
            &player.gear_sets.melee,
            gear.bonuses.str as f64,
            style.str_ as f64,
            player.gear_sets.melee.selected_weapon.as_ref(),
        ),
        _ => (0.0, 0.0, &player.gear_sets.mage, 0.0, 0.0, None),
    };

    let potion_bonus = 21.0;
    let void_bonus = 0.0; // No void for now

    let mut effective_level = (level + potion_bonus).floor();
    if combat_type == "melee" {
        effective_level = (((level + potion_bonus) * prayer_bonus).floor() + style_bonus + 8.0).floor();
    };
    let mut base_damage;
    let mut multiplier = 1.0;
    let mut max_hit = 0u32;
    let weapon = weapon.unwrap();
    console_log!("Selected weapon: {} (combat type: {})", weapon.name, combat_type);
    console_log!("Weapon category: {}", weapon.category);
    let mut salve_mod = 1.0;
    if gear_set.gear_items.iter().any(|item_opt| {
        item_opt.as_ref().map_or(false, |item| item.name == "Salve amulet(ei)")
    }) {
        if let Some(attributes) = &monster.attributes {
            if attributes.contains(&"undead".to_string()) {
                salve_mod = 1.2;
                console_log!("Salve amulet(ei) bonus applied, new salve_mod: {}", salve_mod);
            }
        }
    };

    if combat_type == "magic" {
        if weapon.category == "Powered Staff" {
            effective_level = (level + potion_bonus).floor();
            base_damage = ((effective_level / 3.0) - 1.0).floor();
        } else {
            base_damage = 0.0;
        };
        if weapon.name == "Tumeken's shadow" {
            multiplier = 3.0;
            effective_level = (level + potion_bonus).floor();
            base_damage = ((effective_level / 3.0) + 1.0).floor();
        };
        console_log!("Base magic damage before bonuses: {}, bonus: {}, prayer_bonus: {}, void_bonus: {}, salve_mod: {}, multiplier: {}", base_damage, bonus, prayer_bonus, void_bonus, salve_mod, multiplier);
        // For magic, prayer_bonus is a flat addition to the gear bonus, not a multiplier
        salve_mod = 20.0;
        let magic_strength = (bonus * multiplier).min(100.0) + salve_mod + prayer_bonus + void_bonus;
        max_hit = (base_damage * (1.0 + (magic_strength / 100.0))).floor() as u32;
    } else if combat_type == "ranged" {
        let mut max_hit_multiplier = 1.0;
        if weapon.name == "Twisted bow" {
            // OSRS formula for Twisted Bow damage multiplier
            let magic = monster.skills.magic as f64;
            let tbow_mult = (
                250.0
                + ((((10.0 * 3.0 * magic) / 10.0) - 14.0) / 100.0)
                - ((((3.0 * magic) / 10.0) - 140.0).powf(2.0) / 100.0)
            ) / 100.0;
            // console_log!("Twisted Bow damage multiplier: {}", tbow_mult);
            max_hit_multiplier = tbow_mult.clamp(1.0, 2.5);
        };
        let effective_ranged = ((level + potion_bonus) * prayer_bonus + style_bonus + 8.0).floor();
        max_hit = (0.5 + (effective_ranged * (bonus + 64.0)) / 640.0).floor() as u32;
        // console_log!("Ranged max_hit before multiplier: {}", max_hit);
        max_hit = (max_hit as f64 * max_hit_multiplier * salve_mod).floor() as u32;
        // console_log!("Ranged max_hit after multiplier: {}", max_hit);
    } else if combat_type == "melee" {
        if weapon.category == "Pickaxe" {
            let base_max_hit = (0.5 + (effective_level * (bonus + 64.0)) / 640.0).floor();
            let level_requirement = 60.0;
            let mining_level = player.combat_stats.mining as f64;
            let damage_multiplier = (50.0 + mining_level + level_requirement) / 150.0;
            max_hit = (base_max_hit * damage_multiplier).ceil() as u32;
        } else {
            max_hit = (0.5 + (effective_level * (bonus + 64.0)) / 640.0).floor() as u32;
        };
    };
    // console_log!("Gear items: {:?}", gear_set.gear_items);
    

    (max_hit, effective_level as u32)
}

pub fn calculate_max_rolls_for_style(
    player: &Player,
    monster: &Monster,
    combat_type: &str,
    style: &WeaponStyle,
    gear: &GearStats,
) -> (u64, u64) {
    // Select the correct stat and style bonus
    let (level, gear_set, style_bonus, prayer_bonus, selected_weapon) = match combat_type {
        "magic" => (
            player.combat_stats.magic as f64,
            &player.gear_sets.mage,
            style.magic as f64,
            1.25,
            player.gear_sets.mage.selected_weapon.as_ref(),
        ),
        "ranged" => (
            player.combat_stats.ranged as f64,
            &player.gear_sets.ranged,
            style.ranged as f64,
            1.20,
            player.gear_sets.ranged.selected_weapon.as_ref(),
        ),
        "melee" => (
            player.combat_stats.attack as f64,
            &player.gear_sets.melee,
            style.att as f64,
            1.20,
            player.gear_sets.melee.selected_weapon.as_ref(),
        ),
        _ => (0.0, &player.gear_sets.mage, 0.0, 0.0, None),
    };

    let potion_bonus = 21.0;
    let void_bonus = 1.0; // No void for now

    let effective_level = ((((level + potion_bonus) * prayer_bonus).floor() + style_bonus + 8.0) * void_bonus).floor() as u32;

    let (equipment_bonus, defence_bonus) = match style.attack_type.to_lowercase().as_str() {
        "stab" => (gear.offensive.stab, monster.defensive.stab),
        "slash" => (gear.offensive.slash, monster.defensive.slash),
        "crush" => (gear.offensive.crush, monster.defensive.crush),
        "magic" => (gear.offensive.magic, monster.defensive.magic),
        "ranged" => (gear.offensive.ranged, monster.defensive.standard),
        _ => (0, 0),
    };
    let mut bonus = equipment_bonus;

    let mut max_attack_roll = effective_level as u64 * (bonus + 64) as u64;
    let weapon = selected_weapon.unwrap();
    if weapon.name == "Tumeken's shadow" {
        bonus *= 3;
        max_attack_roll = effective_level as u64 * (bonus + 64) as u64;
    };

    if weapon.name == "Twisted bow" {
        // OSRS Twisted Bow accuracy multiplier
        let magic = monster.skills.magic as f64;
        let tbow_mult = (
            140.0
            + (((10.0 * 3.0 * magic) - 10.0) / 100.0)
            - (((3.0 * magic) / 10.0 - 100.0).powf(2.0) / 100.0)
        ) / 100.0;
        let tbow_mult = tbow_mult.clamp(1.0, 1.4);
        max_attack_roll = (max_attack_roll as f64 * tbow_mult).floor() as u64;
    };
    if gear_set.gear_items.iter().any(|item_opt| {
        item_opt.as_ref().map_or(false, |item| item.name == "Salve amulet(ei)")
    }) {
        if let Some(attributes) = &monster.attributes {
            if attributes.contains(&"undead".to_string()) {
                max_attack_roll = (max_attack_roll as f64 * 1.2).floor() as u64;
                console_log!("Salve amulet(ei) bonus applied, new max_attack_roll: {}", max_attack_roll);
            }
        }
    };
    console_log!("Monster def: {}, monster def bonus: {}", monster.skills.def, defence_bonus);
    let max_defence_roll;
    if combat_type == "magic" {
        max_defence_roll = (monster.skills.magic + 9) as u64 * (defence_bonus + 64) as u64;
    } else {
        max_defence_roll = (monster.skills.def + 9) as u64 * (defence_bonus + 64) as u64;
    };
    

    (max_attack_roll, max_defence_roll)
}

pub fn calculate_accuracy_for_style(player: &Player, monster: &Monster, combat_type: &str, style: &WeaponStyle, gear: &GearStats) -> (f64, u32, u64, u64) {
    let (max_attack_roll, max_defence_roll) = calculate_max_rolls_for_style(player, monster, combat_type, style, gear);
    let mut accuracy;
    let (selected_weapon, gear_items) = match combat_type {
        "magic" => (
            player.gear_sets.mage.selected_weapon.as_ref(),
            &player.gear_sets.mage.gear_items,
        ),
        "ranged" => (
            player.gear_sets.ranged.selected_weapon.as_ref(),
            &player.gear_sets.ranged.gear_items,
        ),
        "melee" => (
            player.gear_sets.melee.selected_weapon.as_ref(),
            &player.gear_sets.melee.gear_items,
        ),
        _ => (None, &vec![]),
    };
    let weapon = selected_weapon.unwrap();
    let is_two_handed = weapon.two_handed;
    if weapon.name == "Osmumten's fang" {
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

    // console_log!("Base accuracy: {:.2}%", accuracy * 100.0);
    // console_log!("player gear items: {:?}", gear_items);
    if gear_items.iter().any(|item_opt| {
        item_opt.as_ref().map_or(false, |item| item.name == "Confliction gauntlets")
    }) && !is_two_handed {
        let pone = accuracy;
        let ptwo = if max_attack_roll >= max_defence_roll {
            1.0 - ((max_defence_roll + 2) as f64 * (2.0 * max_defence_roll as f64 + 3.0)) / (6.0 * (max_attack_roll as f64 + 1.0).powf(2.0))
        } else {
            (max_attack_roll as f64 * (4.0 * max_attack_roll as f64 + 5.0)) / (6.0 * (max_attack_roll as f64 + 1.0) * (max_defence_roll as f64 + 1.0))
        };
        // console_log!("Confliction gauntlets bonus applied pone: {}", pone);
        // console_log!("Confliction gauntlets bonus applied ptwo: {}", ptwo);
        accuracy = ptwo / (1.0 + ptwo - pone);
    };
    
    // console_log!("Final accuracy: {:.2}%", accuracy * 100.0);

    (accuracy, 0, max_attack_roll, max_defence_roll)
}