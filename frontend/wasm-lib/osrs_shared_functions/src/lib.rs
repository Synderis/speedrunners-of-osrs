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

fn tbow_scaling(magic: u32, mode: &str) -> f64 {
    let (factor, base, clamp) = if mode == "accuracy" {
        (10.0, 140.0, 1.4)
    } else {
        (14.0, 250.0, 2.5)
    };

    // t2: trunc((3*magic - factor)/100)
    let t2 = (((3.0 * magic as f64) - factor) / 100.0).trunc();

    // t3: trunc((trunc(3*magic/10) - 10*factor)^2 / 100)
    let inner = ((3.0 * magic as f64) / 10.0).trunc() - 10.0 * factor;
    let t3 = ((inner * inner) / 100.0).trunc();

    // (base + t2 - t3) is already an integer once t2/t3 are truncated,
    // so truncating here is redundant, but harmless.
    let mult = ((base + t2 - t3) / 100.0).clamp(1.0, clamp);
    mult
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
                // console_log!(
                //     "Evaluating {} combat styles for {} weapon: {}",
                //     styles.len(),
                //     combat_type,
                //     weapon.name
                // );
                for style in styles {
                    let (max_hit, _effective_level) = calculate_max_hit_for_style(player, monster, &combat_type, style, gear_stats);
                    let (accuracy, effective_level, max_attack_roll, max_defence_roll) = calculate_accuracy_for_style(player, monster, &combat_type, style, gear_stats);
                    let effective_dps = (max_hit as f64 * accuracy) / (weapon.speed as f64 - style.att_spd_reduction as f64);
                    let effective_strength = 0; // Not used for mage/ranged
                    let effective_attack = effective_level;
                    // console_log!(
                    //     "Style: {} ({}), effective_level: {}, max_attack_roll: {:.2}%, max_defence_roll: {:.2}%",
                    //     style.combat_style,
                    //     style.attack_type,
                    //     effective_level,
                    //     max_attack_roll,
                    //     max_defence_roll
                    // );
                    // console_log!(
                    //     "Style: {} ({}), Max Hit: {}, Accuracy: {:.2}%, Effective DPS: {:.2}",
                    //     style.combat_style,
                    //     style.attack_type,
                    //     max_hit,
                    //     accuracy * 100.0,
                    //     effective_dps
                    // );
                    let style_result = StyleResult {
                        gear_type: combat_type.clone(),
                        combat_style: style.combat_style.clone(),
                        attack_type: style.attack_type.clone(),
                        max_hit,
                        accuracy,
                        effective_dps,
                        effective_strength,
                        effective_attack,
                        max_attack_roll,
                        max_defence_roll,
                        attack_speed: weapon.speed - style.att_spd_reduction,
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
    // console_log!(
    //     "🏆 Best combat style selected: {} ({}) with {:.2} effective DPS",
    //     result.combat_style,
    //     result.attack_type,
    //     result.effective_dps
    // );
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

    let potion_bonus = if monster.name == "Tekton" {
        (level * 15.0 / 100.0).floor() as f64 + 5.0
    } else {
        (level * 16.0 / 100.0).floor() as f64 + 6.0
    };

    let void_bonus = 0.0; // No void for now

    let mut effective_level = (level + potion_bonus).floor();
    if combat_type == "melee" {
        effective_level = (((level + potion_bonus) * prayer_bonus).floor() + style_bonus + 8.0).floor();
    };
    let mut base_damage;
    let mut multiplier = 1.0;
    let mut max_hit = 0u32;
    let weapon = weapon.unwrap();
    // console_log!("Selected weapon: {} (combat type: {})", weapon.name, combat_type);
    // console_log!("Weapon category: {}", weapon.category);
    let mut salve_bonus = 1.0;
    if gear_set.gear_items.iter().any(|item_opt| {
        item_opt.as_ref().map_or(false, |item| item.name == "Salve amulet(ei)")
    }) {
        if let Some(attributes) = &monster.attributes {
            if attributes.contains(&"undead".to_string()) {
                salve_bonus = 1.2;
            }
        }
    };
    let mut slayer_bonus = 1.0;
    if gear_set.gear_items.iter().any(|item_opt| {
        item_opt.as_ref().map_or(false, |item| item.name == "Slayer helmet (i)")
    }) {
        slayer_bonus = 1.15;
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
        // For magic, prayer_bonus is a flat addition to the gear bonus, not a multiplier
        salve_bonus = (salve_bonus - 1.0) * 100.0;
        slayer_bonus = (slayer_bonus - 1.0) * 100.0;
        let magic_strength = (bonus * multiplier).min(100.0) + salve_bonus + slayer_bonus + prayer_bonus + void_bonus;
        max_hit = (base_damage * (1.0 + (magic_strength / 100.0))).floor() as u32;
    } else if combat_type == "ranged" {
        let mut max_hit_multiplier = 1.0;
        if weapon.name == "Twisted bow" {
            // OSRS formula for Twisted Bow damage multiplier
            let magic = std::cmp::max(
                monster.skills.magic.clamp(0, 350) as u32,
                monster.offensive.magic.clamp(0, 350) as u32,
            );
            max_hit_multiplier = tbow_scaling(magic, "damage");
        };
        let effective_ranged = ((level + potion_bonus) * prayer_bonus + style_bonus + 8.0).floor();
        max_hit = (0.5 + (effective_ranged * (bonus + 64.0)) / 640.0).floor() as u32;
        max_hit = (max_hit as f64 * max_hit_multiplier * salve_bonus * slayer_bonus).floor() as u32;
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
        if weapon.name == "Scythe of vitur" {
            max_hit = max_hit + (max_hit / 2) + (max_hit / 4);
        };
        if weapon.name == "Emberlight" && monster.attributes.as_ref().map_or(false, |attrs| attrs.contains(&"demon".to_string())) {
            max_hit = (max_hit as f64 * 1.70).floor() as u32;
        }
        if weapon.name == "Burning claws" && monster.attributes.as_ref().map_or(false, |attrs| attrs.contains(&"demon".to_string())) {
            max_hit = (max_hit as f64 * 1.05).floor() as u32;
        };
        if weapon.name == "Zamorak godsword" && (style.combat_style == "Slash" || style.combat_style == "Crush") {
            max_hit = (max_hit as f64 * 1.10).floor() as u32;
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

    let potion_bonus = if monster.name.contains("Tekton") {
        19.0
    } else {
        21.0
    };
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
    let mut slayer_bonus = 1.0;
    let mut salve_bonus = 1.0;
    let mut tbow_mult = 1.0;

    let mut max_attack_roll = effective_level as u64 * (bonus + 64) as u64;

    let weapon = selected_weapon.unwrap();
    if weapon.name == "Emberlight" && monster.attributes.as_ref().map_or(false, |attrs| attrs.contains(&"demon".to_string())) {
        max_attack_roll = (max_attack_roll as f64 * 1.70).floor() as u64;
    };
    if weapon.name == "Burning claws" && monster.attributes.as_ref().map_or(false, |attrs| attrs.contains(&"demon".to_string())) {
        max_attack_roll = (max_attack_roll as f64 * 1.05).floor() as u64;
    };
    if weapon.name == "Tumeken's shadow" {
        bonus *= 3;
        max_attack_roll = effective_level as u64 * (bonus + 64) as u64;
    };
    if weapon.name == "Zamorak godsword" && (style.combat_style == "Slash" || style.combat_style == "Crush") {
        max_attack_roll = max_attack_roll * 2;
    };

    if weapon.name == "Twisted bow" {
        // OSRS Twisted Bow accuracy multiplier
        let magic = std::cmp::max(
            monster.skills.magic.clamp(0, 350) as u32,
            monster.offensive.magic.clamp(0, 350) as u32,
        );
        tbow_mult = tbow_scaling(magic, "accuracy");
    };
    if gear_set.gear_items.iter().any(|item_opt| {
        item_opt.as_ref().map_or(false, |item| item.name == "Salve amulet(ei)")
    }) {
        if let Some(attributes) = &monster.attributes {
            if attributes.contains(&"undead".to_string()) {
                salve_bonus = 1.2;
            }
        }
    };
    if gear_set.gear_items.iter().any(|item_opt| {
        item_opt.as_ref().map_or(false, |item| item.name == "Slayer helmet (i)")
    }) {
        slayer_bonus = 7.0 / 6.0;
    };
    max_attack_roll = (max_attack_roll as f64 * slayer_bonus * salve_bonus * tbow_mult).floor() as u64;
    // console_log!("Monster def: {}, monster def bonus: {}", monster.skills.def, defence_bonus);
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

pub fn ensure_weapon_swap(
    player: &mut Player,
    weapon_name: &str,
    equip_offhand: Option<SelectedItem>,
) -> Option<(String, Option<SelectedItem>)> {
    let gear_stats = &mut player.gear_sets.melee.gear_stats;
    let gear_items = &mut player.gear_sets.melee.gear_items;
    let selected_weapon = player.gear_sets.melee.selected_weapon.as_mut()?;

    // Find weapon in inventory
    let inventory_weapon_idx = player.inventory.iter().position(|item| item.name.contains(weapon_name));
    if let Some(idx) = inventory_weapon_idx {
        let inventory_weapon = player.inventory.remove(idx);

        // Find current offhand
        let current_offhand_idx = gear_items.iter().position(|item| {
            item.as_ref().map_or(false, |i| i.slot == "shield")
        });
        let current_offhand = current_offhand_idx
            .and_then(|i| gear_items.remove(i))
            .and_then(|i| Some(i.clone()));

        // Update bonuses
        if let Some(bonuses) = &selected_weapon.bonuses {
            if let Some(inv_bonuses) = inventory_weapon.equipment.as_ref().and_then(|eq| eq.bonuses.as_ref()) {
                gear_stats.bonuses.sub_assign(bonuses);
                gear_stats.bonuses.add_assign(inv_bonuses);

                if let Some(ref offhand) = current_offhand {
                    if let Some(off_bonuses) = offhand.bonuses.as_ref() {
                        gear_stats.bonuses.sub_assign(off_bonuses);
                    }
                }
                if let Some(ref offhand) = equip_offhand {
                    if let Some(off_bonuses) = offhand.bonuses.as_ref() {
                        gear_stats.bonuses.add_assign(off_bonuses);
                    }
                }
            }
        }
        // Update offensive
        if let Some(offensive) = &selected_weapon.offensive {
            if let Some(inv_offensive) = inventory_weapon.equipment.as_ref().and_then(|eq| eq.offensive.as_ref()) {
                gear_stats.offensive.sub_assign(offensive);
                gear_stats.offensive.add_assign(inv_offensive);

                if let Some(ref offhand) = current_offhand {
                    if let Some(off_offensive) = offhand.offensive.as_ref() {
                        gear_stats.offensive.sub_assign(off_offensive);
                    }
                }
                if let Some(ref offhand) = equip_offhand {
                    if let Some(off_offensive) = offhand.offensive.as_ref() {
                        gear_stats.offensive.add_assign(off_offensive);
                    }
                }
            }
        }

        // Swap weapon
        let prev_weapon = std::mem::replace(selected_weapon, inventory_weapon.equipment.clone()?);

        player.inventory.push(InventoryItem {
            name: prev_weapon.name.clone(),
            equipment: Some(prev_weapon.clone()),
        });

        // Handle offhand swap
        if let Some(offhand) = current_offhand.clone() {
            player.inventory.push(InventoryItem {
                name: offhand.name.clone(),
                equipment: Some(offhand.clone()),
            });
            return Some((prev_weapon.name.clone(), Some(offhand)));
        }
        if let Some(offhand) = equip_offhand.clone() {
            gear_items.push(Some(offhand.clone()));
        }
        return Some((prev_weapon.name.clone(), current_offhand));
    }
    None
}