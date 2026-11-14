use rand::prelude::*;
use rand::rngs::SmallRng;
use rand::distributions::{Distribution, Uniform};
use rand::SeedableRng;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

fn phase_loop(
    hp: &mut i32,
    current_phase_ticks: &mut i32,
    attack_speed: i32,
    accuracy: f64,
    max_hit: i32,
    damage_rolls: u32,
    weapon_name: &str,
    ammo: Option<&str>,
    attack_style: &str,
    rng: &mut SmallRng,
    passive_dmg: &Uniform<i32>, // prebuilt 0..=3
    cooldown: &mut AttackCooldown,
    zorya: Option<&StyleResult>,
    zorya_specs: i32,
) -> i32 {
    let mut ticks_spent = 0;
    // Zorya's tome specs are your first attacks on the target. Buffed attacks still due when it dies
    // aren't used.
    let mut zorya_specs_left = zorya_specs;
    let mut zorya_pending: Vec<i32> = Vec::new();
    // Ticks from the killing attack to your next action
    let mut tail = attack_speed - 1;
    while *hp > 0 {
        ticks_spent += 1;
        *current_phase_ticks += 1;

        if let Some(z) = zorya {
            if zorya_buffed_attacks(rng, z, *current_phase_ticks, hp, &mut zorya_pending) && *hp <= 0 {
                tail = ZORYA_BUFFED_SPEED - 1;
                break;
            }
        }
        if cooldown.is_ready() && zorya_specs_left > 0 {
            zorya_specs_left -= 1;
            let next = zorya_spec(rng, zorya.unwrap(), *current_phase_ticks, hp, &mut zorya_pending);
            cooldown.reset(next);
            tail = ZORYA_SPEC_SPEED - 1;
        } else if cooldown.is_ready() {
            let hit = dmg_modifier_check(rng, max_hit, accuracy, weapon_name, ammo, attack_style, damage_rolls);
            *hp -= hit;
            cooldown.reset(attack_speed);
            tail = attack_speed - 1;
        } else {
            cooldown.tick();
        }
        if *hp <= 0 {
            break;
        }

        if (*current_phase_ticks - 1) % 4 == 0 {
            *hp -= passive_dmg.sample(rng); // 0..=3
        }
        if *hp <= 0 {
            break;
        }
    }
    *current_phase_ticks += tail;
    ticks_spent + tail
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_olm(payload_json: &str) -> String {
    // Parse payload
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let mut player = payload.player;
    let monsters = payload.room.monsters;
    let _room_methods = payload.room.methods;
    let trials = 100_000usize;

    // Faster RNG with variability
    let mut rng = SmallRng::from_entropy();

    // Defensive: Check monsters
    if monsters.is_empty() {
        return "{\"error\": \"No monsters in payload\"}".to_string();
    }

    let best_style_mage = find_best_combat_style(&player, &monsters[0], vec!["magic".to_string()]);
    // Zorya's tome: specs on the mage hand, as your first attacks on it. The count (default 4) is split
    // across the phases in order: up to 2 in phase 1, 1 in phase 2 and 1 in phase 3.
    let zorya = zorya_style(&player, &monsters[0], false);
    let zorya_specs = if zorya.is_some() {
        payload.room.special_attacks
            .as_ref()
            .and_then(|vec| vec.iter().find(|sa| sa.name.eq_ignore_ascii_case("Zorya's tome")).map(|sa| sa.count))
            .unwrap_or(4)
    } else {
        0
    };
    let mut zorya_phase_specs = [0; 3];
    let mut zorya_specs_left = zorya_specs.max(0);
    for (phase, cap) in [2, 1, 1].iter().enumerate() {
        zorya_phase_specs[phase] = zorya_specs_left.min(*cap);
        zorya_specs_left -= zorya_phase_specs[phase];
    }
    let best_style_melee = find_best_combat_style(&player, &monsters[1], vec!["melee".to_string()]);
    let best_style_ranged = find_best_combat_style(&player, &monsters[2], vec!["ranged".to_string()]);

    // Collect inventory items early for defender check
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();

    // With tome specs at Olm, the maul spec on the melee hand isn't used: there isn't the spec energy for both
    let use_maul = zorya_specs == 0;
    // (the maul's style, your style against the melee hand after a maul spec hits)
    let mut maul: Option<(StyleResult, StyleResult)> = None;
    if use_maul {
        // Find and validate spec weapon (convert to String to avoid borrow conflict)
        let spec_weapon = match player.inventory.iter().find_map(|item| {
            match item.name.to_lowercase().as_str() {
                "elder maul" | "dragon warhammer" => Some(item.name.clone()),
                _ => None,
            }
        }) {
            Some(weapon) => weapon,
            None => return "{\"error\": \"Please select Elder maul or DWH\"}".to_string(),
        };

        let def_reduction_mult = if spec_weapon.eq_ignore_ascii_case("Elder maul") { 0.65 } else { 0.7 };
    
        // For DWH, find defender and swap with it; for Elder maul, swap without offhand
        let defender = if spec_weapon.eq_ignore_ascii_case("Dragon warhammer") {
            match find_defender(&inventory_items) {
                Some(def) => Some(def),
                None => return "{\"error\": \"Please add a defender to the inventory items\"}".to_string(),
            }
        } else {
            None
        };

        // Swap to spec weapon and store original weapon
        let (swapped_weapon, swapped_offhand) = match ensure_weapon_swap(&mut player, &spec_weapon, defender) {
            Some((w, o)) => (w, o),
            None => return format!("{{\"error\": \"{} not found in inventory\"}}", spec_weapon),
        };

        let best_style_spec = find_best_combat_style(&player, &monsters[1], vec!["melee".to_string()]);

        // If spec weapon is already equipped in melee gear, swap back to original weapon
        if player.gear_sets.melee.selected_weapon.as_ref().map(|w| w.name.as_str()) == Some(spec_weapon.as_str()) {
            ensure_weapon_swap(&mut player, &swapped_weapon, swapped_offhand.clone());
        }
        let mut olm_melee_hand_specced = monsters[1].clone();
        olm_melee_hand_specced.skills.def = (olm_melee_hand_specced.skills.def as f64 * def_reduction_mult).ceil() as i32;
        let best_style_specced = find_best_combat_style(&player, &olm_melee_hand_specced, vec!["melee".to_string()]);
        maul = Some((best_style_spec, best_style_specced));
    }
    let weapon_name = &player.gear_sets.melee.selected_weapon.as_ref().unwrap().name;
    let melee_ammo = player.gear_sets.melee.ammo().map(|a| a.name.clone());
    let mage_ammo = player.gear_sets.mage.ammo().map(|a| a.name.clone());
    let ranged_ammo = player.gear_sets.ranged.ammo().map(|a| a.name.clone());
    let zcb_accuracy = zcb_spec_proc_chance(&player, &monsters[2], &inventory_items);
    let zaryte_crossbow = zcb_accuracy.is_some();
    let zcb_threshold = (zcb_accuracy.unwrap_or(0.0) * (u32::MAX as f64)) as u32;
    // let burning_claws = inventory_items.iter().any(|item| item.name.eq_ignore_ascii_case("Burning claws"));

    // --- Optimized stats building ---
    let passive_dmg = Uniform::new_inclusive(0, 3);
    let spec_hit_dmg = Uniform::new_inclusive(0, maul.as_ref().map_or(0, |(spec, _)| spec.max_hit.max(0)));
    let acc_threshold = maul.as_ref().map_or(0, |(spec, _)| (spec.accuracy.clamp(0.0, 1.0) * (u32::MAX as f64)) as u32);

    // Build histogram + running sum instead of storing all tick counts
    let mut freq: Vec<usize> = Vec::new();
    let mut sum_ticks: i64 = 0;
    let mut phase_results: Vec<i32> = Vec::with_capacity(trials * 3);

    let delay_list = [22, 38, 39];

    for _ in 0..trials {
        let mut total_ticks = 0;
        let mut ranged_hp = monsters[2].skills.hp;
        let mut current_phase_ticks = 0;

        for phase in 0..3 {
            let mut mage_hp = monsters[0].skills.hp;
            let mut melee_hp = monsters[1].skills.hp;
            let mage_ticks;
            let mut melee_ticks;
            let mut spec_hit = false;
            current_phase_ticks = 0;
            let mut mage_cooldown = AttackCooldown::new();

            mage_ticks = phase_loop(
                &mut mage_hp,
                &mut current_phase_ticks,
                best_style_mage.attack_speed,
                best_style_mage.accuracy,
                best_style_mage.max_hit,
                best_style_mage.damage_rolls,
                "Mage",
                mage_ammo.as_deref(),
                &best_style_mage.gear_type,
                &mut rng,
                &passive_dmg,
                &mut mage_cooldown,
                zorya.as_ref(),
                zorya_phase_specs[phase],
            );

            // spec: Bernoulli via u32 threshold (faster than gen::<f64>())
            if maul.is_some() && rng.next_u32() <= acc_threshold {
                spec_hit = true;
                melee_hp -= spec_hit_dmg.sample(&mut rng).max(1);
            };
            let melee_style = match maul.as_ref() {
                Some((_, specced)) if spec_hit => specced,
                _ => &best_style_melee,
            };
            let melee_accuracy = melee_style.accuracy;
            let melee_max_hit = melee_style.max_hit;
            let melee_attack_speed = melee_style.attack_speed;
            let melee_damage_rolls = melee_style.damage_rolls;
            let mut melee_cooldown = AttackCooldown::new();
            melee_ticks = phase_loop(
                &mut melee_hp,
                &mut current_phase_ticks, 
                melee_attack_speed, 
                melee_accuracy, 
                melee_max_hit, 
                melee_damage_rolls,
                weapon_name, 
                melee_ammo.as_deref(),
                &best_style_melee.gear_type,
                &mut rng, 
                &passive_dmg,
                &mut melee_cooldown,
                None,
                0,
            );
            if maul.is_some() {
                melee_ticks += 6; // Add 6 ticks for spec delay
            }
            total_ticks += mage_ticks + melee_ticks;
            total_ticks += delay_list[phase];
            phase_results.push(melee_ticks + mage_ticks);
        };

        if zaryte_crossbow {
            if rng.next_u32() <= zcb_threshold {
                ranged_hp -= zcb_spec_damage(ranged_hp);
            }
            current_phase_ticks += 5;
        }
        let mut ranged_cooldown = AttackCooldown::new();
        let mut ranged_ticks = phase_loop(
            &mut ranged_hp,
            &mut current_phase_ticks,
            best_style_ranged.attack_speed,
            best_style_ranged.accuracy,
            best_style_ranged.max_hit,
            best_style_ranged.damage_rolls,
            "Ranged",
            ranged_ammo.as_deref(),
            &best_style_ranged.gear_type,
            &mut rng,
            &passive_dmg,
            &mut ranged_cooldown,
            None,
            0,
        );
        if zaryte_crossbow {
            ranged_ticks += 5;
        }
        total_ticks += ranged_ticks;

        sum_ticks += i64::from(total_ticks);
        let idx = total_ticks as usize;
        if idx >= freq.len() {
            freq.resize(idx + 1, 0);
        }
        freq[idx] += 1;
    }

    if freq.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }
    let style_list = vec![best_style_mage.clone(), best_style_melee.clone(), best_style_ranged.clone()];
    let end_results = results_formatter(&monsters, &style_list, sum_ticks, freq, trials, phase_results, Vec::new());
    end_results
}
