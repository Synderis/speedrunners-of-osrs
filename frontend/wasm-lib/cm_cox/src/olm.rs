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
    weapon_name: &str,
    rng: &mut SmallRng,
    passive_dmg: &Uniform<i32>, // prebuilt 0..=3
) -> i32 {
    let mut ticks_spent = 0;
    // keep modulo logic exactly as prod
    while *hp > 0 {
        ticks_spent += 1;
        *current_phase_ticks += 1;

        if (*current_phase_ticks - 1) % attack_speed == 0 {
            let hit = dmg_modifier_check(rng, max_hit, accuracy, weapon_name);
            *hp -= hit;
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
    *current_phase_ticks += attack_speed - 1;
    ticks_spent + (attack_speed - 1)
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
    let best_style_melee = find_best_combat_style(&player, &monsters[1], vec!["melee".to_string()]);
    let best_style_ranged = find_best_combat_style(&player, &monsters[2], vec!["ranged".to_string()]);

    // Collect inventory items early for defender check
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();

    // Find and validate spec weapon (convert to String to avoid borrow conflict)
    let spec_weapon = match player.inventory.iter().find_map(|item| {
        match item.name.as_str() {
            "Elder maul" | "Dragon warhammer" => Some(item.name.clone()),
            _ => None,
        }
    }) {
        Some(weapon) => weapon,
        None => return "{\"error\": \"Please select Elder maul or DWH\"}".to_string(),
    };

    let def_reduction_mult = if spec_weapon == "Elder maul" { 0.65 } else { 0.7 };
    
    // For DWH, find defender and swap with it; for Elder maul, swap without offhand
    let defender = if spec_weapon == "Dragon warhammer" {
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
    let weapon_name = &player.gear_sets.melee.selected_weapon.as_ref().unwrap().name;

    let mut olm_melee_hand_specced = monsters[1].clone();
    olm_melee_hand_specced.skills.def = (olm_melee_hand_specced.skills.def as f64 * def_reduction_mult).ceil() as i32;
    let best_style_specced = find_best_combat_style(&player, &olm_melee_hand_specced, vec!["melee".to_string()]);
    let zaryte_crossbow = inventory_items.iter().any(|item| item.name == "Zaryte crossbow");
    // let burning_claws = inventory_items.iter().any(|item| item.name == "Burning claws");

    // --- Optimized stats building ---
    let passive_dmg = Uniform::new_inclusive(0, 3);
    let spec_hit_dmg = Uniform::new_inclusive(0, best_style_spec.max_hit.max(0));
    let acc_threshold = (best_style_spec.accuracy.clamp(0.0, 1.0) * (u32::MAX as f64)) as u32;

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

            mage_ticks = phase_loop(
                &mut mage_hp,
                &mut current_phase_ticks,
                best_style_mage.attack_speed,
                best_style_mage.accuracy,
                best_style_mage.max_hit,
                "Mage",
                &mut rng,
                &passive_dmg,
            );

            // spec: Bernoulli via u32 threshold (faster than gen::<f64>())
            if rng.next_u32() <= acc_threshold {
                spec_hit = true;
                melee_hp -= spec_hit_dmg.sample(&mut rng).max(1);
            };

            if spec_hit {
                melee_ticks = phase_loop(
                    &mut melee_hp,
                    &mut current_phase_ticks,
                    best_style_specced.attack_speed,
                    best_style_specced.accuracy,
                    best_style_specced.max_hit,
                    weapon_name,
                    &mut rng,
                    &passive_dmg,
                );
            } else {
                melee_ticks = phase_loop(
                    &mut melee_hp,
                    &mut current_phase_ticks,
                    best_style_melee.attack_speed,
                    best_style_melee.accuracy,
                    best_style_melee.max_hit,
                    weapon_name,
                    &mut rng,
                    &passive_dmg,
                );
            };
            melee_ticks += 6; // Add 6 ticks for spec delay
            total_ticks += mage_ticks + melee_ticks;
            total_ticks += delay_list[phase];
            phase_results.push(melee_ticks + mage_ticks);
        };

        if zaryte_crossbow {
            let spec_dmg = (ranged_hp as f64 * 0.22).floor() as i32;
            ranged_hp -= spec_dmg;
            current_phase_ticks += 5;
        }
        let mut ranged_ticks = phase_loop(
            &mut ranged_hp,
            &mut current_phase_ticks,
            best_style_ranged.attack_speed,
            best_style_ranged.accuracy,
            best_style_ranged.max_hit,
            "Ranged",
            &mut rng,
            &passive_dmg,
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
