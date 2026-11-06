//! Proposed Tekton model, subject to further testing. It isn't used by the site: the room still runs
//! calculate_dps_with_objects_tekton (tekton.rs). This is a copy of that room with four changes:
//!
//! 1. The anvil: how long Tekton stays, how much it heals, and when your first swing after it comes
//!    (from Sinkkonen's notes).
//! 2. Enraged first: after each anvil, the first block of attacks is against the enraged form and the
//!    second against the normal form, as seen in VODs (the room does normal first).
//! 3. The maul styles: the first maul, which always lands, is rolled off the maul's Aggressive max hit;
//!    the second keeps the best style for accuracy.
//! 4. The finish: when the kill completes, from the tick the killing hit lands (from Sinkkonen's notes).

use rand::prelude::*;
use rand::rngs::SmallRng;
use rand::distributions::{Uniform, Distribution};
use rand::SeedableRng;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

#[inline(always)]
fn phase_loop(
    mut hit_count: usize,
    hit_count_bounds: &[usize; 2],
    tekton_hp: &mut i32,
    current_phase_ticks: &mut i32,
    attack_speed: i32,
    accuracy: f64,
    max_hit: i32,
    damage_rolls: u32,
    weapon_name: &str,
    ammo: Option<&str>,
    attack_style: &str,
    rng: &mut SmallRng,
    thrall_dist: &Uniform<i32>, // prebuilt 0..=3
    cooldown: &mut AttackCooldown,
) -> (i32, i32, usize, bool) {
    while *tekton_hp > 0 && hit_count >= hit_count_bounds[0] && hit_count <= hit_count_bounds[1] {
        *current_phase_ticks += 1;

        if *current_phase_ticks == 1 || (*current_phase_ticks - 1) % 4 == 0 {
            *tekton_hp -= thrall_dist.sample(rng); // 0..=3
        }
        if *tekton_hp <= 0 {
            return (*tekton_hp, *current_phase_ticks, hit_count, true);
        }

        if cooldown.is_ready() {
            let hit = dmg_modifier_check(rng, max_hit, accuracy, weapon_name, ammo, attack_style, damage_rolls);
            *tekton_hp -= hit;
            hit_count += 1;
            cooldown.reset(attack_speed);
        } else {
            cooldown.tick();
        }
    }
    (*tekton_hp, *current_phase_ticks, hit_count, false)
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_tekton_proposed(payload_json: &str) -> String {
    // Parse payload
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let mut player = payload.player;
    let mut monsters = payload.room.monsters;
    for monster in &mut monsters {
        if player.combat_stats.hitpoints != 99 {
            monster.skills.hp = monster_hp_scaling(monster, &player.combat_stats);
        }
        monster.skills = monster_stat_scaling(monster, player.combat_stats.hitpoints);
    }
    let room_methods = payload.room.methods;
    let trials = 100_000usize;
    player.combat_stats.attack += 2; // account for zamorak brew

    // 🔧 faster, WASM-friendly RNG
    let mut rng = SmallRng::from_entropy();

    // Defensive: Check monsters
    if monsters.is_empty() {
        return "{\"error\": \"No monsters in payload\"}".to_string();
    }
    if monsters.len() < 2 {
        return "{\"error\": \"Tekton simulation requires two monsters (normal and enraged)\"}".to_string();
    }
    if monsters[0].id != 7545 || monsters[1].id != 7544 {
        return "{\"error\": \"First two monsters must be Tekton (normal and enraged)\"}".to_string();
    }

    // Collect inventory items early for defender check
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();

    // Find and validate spec weapon
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

    // Extract Tekton stats
    let base_tekton_hp = monsters[0].skills.hp;

    // Find best style for spec
    let mut tekton_initial = monsters[0].clone();
    let mut tekton_initial_enraged = monsters[1].clone();

    let first_spec_def_normal = (tekton_initial.skills.def as f64 * def_reduction_mult).ceil() as i32;
    tekton_initial.skills.def = (tekton_initial.skills.def as f64 * def_reduction_mult).ceil() as i32;
    let best_style_spec = find_best_combat_style(&player, &tekton_initial, vec!["melee".to_string()]);
    let max_hit_spec = best_style_spec.max_hit;
    // The first maul always lands, so it's rolled off the maul's Aggressive max hit; the second keeps
    // the best style for accuracy
    let max_hit_first_spec = {
        let gear_stats = player.gear_sets.melee.total_gear_stats();
        player.gear_sets.melee.selected_weapon.as_ref()
            .and_then(|w| w.weapon_styles.as_ref())
            .and_then(|styles| styles.iter()
                .filter(|style| style.combat_style.eq_ignore_ascii_case("Aggressive"))
                .map(|style| calculate_max_hit_for_style(&player, &tekton_initial, "melee", style, &gear_stats).0)
                .max())
            .unwrap_or(max_hit_spec)
    };

    // If spec weapon is already equipped in melee gear, swap back to original weapon
    if player.gear_sets.melee.selected_weapon.as_ref().map(|w| w.name.as_str()) == Some(spec_weapon.as_str()) {
        ensure_weapon_swap(&mut player, &swapped_weapon, swapped_offhand.clone());
    }
    let weapon_name = &player.gear_sets.melee.selected_weapon.as_ref().unwrap().name;
    let ammo = player.gear_sets.melee.ammo().map(|a| a.name.clone());

    let first_spec_def_enraged = (tekton_initial_enraged.skills.def as f64 * def_reduction_mult).ceil() as i32;
    tekton_initial_enraged.skills.def = (tekton_initial_enraged.skills.def as f64 * def_reduction_mult).ceil() as i32;

    tekton_initial.skills.def = (tekton_initial.skills.def as f64 * 0.95).ceil() as i32;
    let normal_1_spec_best_style = find_best_combat_style(&player, &tekton_initial, vec!["melee".to_string()]);
    tekton_initial.skills.def = first_spec_def_normal;
    tekton_initial.skills.def = (tekton_initial.skills.def as f64 * def_reduction_mult).ceil() as i32;
    let normal_2_spec_best_style = find_best_combat_style(&player, &tekton_initial, vec!["melee".to_string()]);
    let best_styles_normal = vec![
        normal_1_spec_best_style.clone(),
        normal_2_spec_best_style.clone(),
    ];

    tekton_initial_enraged.skills.def = (tekton_initial_enraged.skills.def as f64 * 0.95).ceil() as i32;
    let enraged_1_spec_best_style = find_best_combat_style(&player, &tekton_initial_enraged, vec!["melee".to_string()]);
    tekton_initial_enraged.skills.def = first_spec_def_enraged;
    tekton_initial_enraged.skills.def = (tekton_initial_enraged.skills.def as f64 * def_reduction_mult).ceil() as i32;
    let enraged_2_spec_best_style = find_best_combat_style(&player, &tekton_initial_enraged, vec!["melee".to_string()]);
    let best_styles_enraged = vec![
        enraged_1_spec_best_style.clone(),
        enraged_2_spec_best_style.clone(),
    ];

    // Prepare simulation
    // NOTE: we still keep per-trial arrays you output; but we’ll build CDF via histogram for speed.
    let mut freq: Vec<usize> = Vec::new();
    let mut sum_ticks: i64 = 0;
    let mut hp_pre_anvil: Vec<i32> = vec![0; trials];
    let mut phase_results: Vec<i32> = vec![0; trials];

    let pre_veng = if room_methods.iter().any(|s| s.eq_ignore_ascii_case("Pre-Veng")) { 1 } else { 0 };
    let tekton_enraged_max_hit = monsters[1].max_hit.unwrap_or(0) as i32;

    let (delay, attack_pattern): (i32, Vec<[usize; 2]>) = if room_methods.iter().any(|s| s.eq_ignore_ascii_case("Tekton Short Lure")) {
        (11, vec![[0, 4], [0, 3], [4, 10]])
    } else {
        (15, vec![[0, 5], [0, 3], [4, 11]])
    };

    // prebuild passive 0..=3 distribution
    let thrall_dmg = Uniform::new_inclusive(0, 3);

    for i in 0..trials {
        let mut tekton_hp = base_tekton_hp;
        let mut total_ticks = delay;
        let mut spec_phase = true;
        let mut specs_hit = 0;
        let mut first_pass = true;
        let mut phase: i32 = 0;
        let mut hp_pre_anvil_val: i32 = 0;
        let mut hit_count = 0usize;
        let mut current_phase_ticks = 0;
        let mut veng_count = pre_veng;
        // Your first swing after the latest anvil (None before the first anvil), and whether the mauls
        // killed it, for the finish
        let mut cycle_first_swing: Option<i32> = None;
        let mut killed_by_maul = false;

        while tekton_hp > 0 {
            let mut cooldown = AttackCooldown::new();
            if spec_phase {
                total_ticks += 6;
                tekton_hp -= dmg_modifier_check(&mut rng, max_hit_first_spec, 1.0, &spec_weapon, ammo.as_ref().map(|a| a.as_str()), &best_style_spec.gear_type, best_style_spec.damage_rolls);
                let hit = dmg_modifier_check(&mut rng, max_hit_spec, best_style_spec.accuracy, &spec_weapon, ammo.as_ref().map(|a| a.as_str()), &best_style_spec.gear_type, best_style_spec.damage_rolls);
                tekton_hp -= hit;
                if hit > 0 {
                    specs_hit += 1;
                }
                total_ticks += 6;
                spec_phase = false;
                killed_by_maul = tekton_hp <= 0;
            }

            // Pre-anvil phase: (0, 5)
            // Only on the first pass: This attack sequence happens once, before Tekton goes to the
            // anvil for the first time. After the post-anvil attacks it goes straight back to the anvil.
            if first_pass {
                let (hp1, ticks1, _, died1) = phase_loop(
                    hit_count,
                    &attack_pattern[0],
                    &mut tekton_hp,
                    &mut current_phase_ticks,
                    best_styles_normal[specs_hit].attack_speed,
                    best_styles_normal[specs_hit].accuracy,
                    best_styles_normal[specs_hit].max_hit,
                    best_styles_normal[specs_hit].damage_rolls,
                    weapon_name,
                    ammo.as_deref(),
                    &best_styles_normal[specs_hit].gear_type,
                    &mut rng,
                    &thrall_dmg,
                    &mut cooldown,
                );
                tekton_hp = hp1;
                current_phase_ticks = ticks1;

                // Save hp_pre_anvil_val at the end of pre-anvil phase
                if tekton_hp > 0 {
                    hp_pre_anvil_val = tekton_hp;
                    first_pass = false;
                    phase += 1;
                }
                if died1 || tekton_hp <= 0 {
                    total_ticks += current_phase_ticks;
                    break;
                }
            }

            // The anvil (from Sinkkonen's notes): Tekton stays 12, 15, 18 or 21 ticks (25% each). It
            // heals every 3 ticks from 3 ticks after it arrives, but not on the tick it reactivates, so
            // stay / 3 - 1 heals of floor(max HP / 100) + 1, capped at its max HP. It arrives 1 tick after
            // your last swing, is attackable 2 ticks after it reactivates and your first swing is 3 ticks
            // after that: stay + 4 ticks after your last swing. The phase loop swings on its first tick,
            // so stay + 3 ticks are added here.
            let stay = 3 * rng.gen_range(4..8);
            let heal = (stay / 3 - 1) * (base_tekton_hp / 100 + 1);
            tekton_hp = (tekton_hp + heal).min(base_tekton_hp);
            total_ticks += stay + 3;
            if current_phase_ticks > 0 {
                total_ticks += current_phase_ticks;
            }
            cooldown.reduce(stay + 3);
            current_phase_ticks = 0;
            // The phase loop's first tick is your first swing after the anvil
            cycle_first_swing = Some(total_ticks + 1);

            // Enraged phase: (0, 3). After the anvil it's enraged first, then normal.
            if veng_count > 0 {
                let veng_hit = rng.gen_range(0..=tekton_enraged_max_hit).max(1);
                let veng_dmg = (veng_hit as f64 * 0.75).floor() as i32;
                tekton_hp -= veng_dmg;
                veng_count -= 1;
            }
            let (hp2, ticks2, hit_count2, died2) = phase_loop(
                hit_count,
                &attack_pattern[1],
                &mut tekton_hp,
                &mut current_phase_ticks,
                best_styles_enraged[specs_hit].attack_speed,
                best_styles_enraged[specs_hit].accuracy,
                best_styles_enraged[specs_hit].max_hit,
                best_styles_enraged[specs_hit].damage_rolls,
                weapon_name,
                ammo.as_deref(),
                &best_styles_enraged[specs_hit].gear_type,
                &mut rng,
                &thrall_dmg,
                &mut cooldown,
            );
            tekton_hp = hp2;
            current_phase_ticks = ticks2;
            hit_count = hit_count2;
            if died2 || tekton_hp <= 0 {
                total_ticks += current_phase_ticks;
                break;
            }
            // Add attack speed to account for the final attack
            // current_phase_ticks += best_styles_normal[specs_hit].attack_speed;

            // Normal phase: (4, 11)
            let (hp3, ticks3, _, died3) = phase_loop(
                hit_count,
                &attack_pattern[2],
                &mut tekton_hp,
                &mut current_phase_ticks,
                best_styles_normal[specs_hit].attack_speed,
                best_styles_normal[specs_hit].accuracy,
                best_styles_normal[specs_hit].max_hit,
                best_styles_normal[specs_hit].damage_rolls,
                weapon_name,
                ammo.as_deref(),
                &best_styles_normal[specs_hit].gear_type,
                &mut rng,
                &thrall_dmg,
                &mut cooldown,
            );
            tekton_hp = hp3;
            current_phase_ticks = ticks3;
            if died3 || tekton_hp <= 0 {
                total_ticks += current_phase_ticks;
                break;
            }
            total_ticks += current_phase_ticks;
            current_phase_ticks = 0;
            hit_count = 0;
            phase += 1;
        }
        // The finish (from Sinkkonen's notes). The killing hit lands 1 tick after the swing (2 ticks
        // after the second maul). Its death starts the next tick, or the same tick if the hit lands on
        // one of Tekton's attack ticks. A start at or after that cycle's return tick (24 ticks after the
        // fight starts before the first anvil; 48 after your first swing after an anvil) adds 3. The
        // kill completes at align(start + 3) + 3, where align(x) = x + ((1 - x) mod 4).
        // A kill queued by an earlier splat of a multi-hit weapon isn't tracked, so this can be 1 tick
        // late in those cases.
        let lethal = if killed_by_maul { delay + 6 + 2 } else { total_ticks + 1 };
        let opening_start = if delay == 11 { 16 } else { 21 };
        let tekton_tick = match cycle_first_swing {
            None => lethal >= opening_start && lethal < opening_start + 24 && (lethal - opening_start) % 3 == 0,
            Some(first) => lethal >= first + 3 && lethal <= first + 45 && (lethal - first) % 3 == 0,
        };
        let mut start = if tekton_tick { lethal } else { lethal + 1 };
        let return_tick = match cycle_first_swing {
            None => opening_start + 24,
            Some(first) => first + 48,
        };
        if start >= return_tick {
            start += 3;
        }
        let x = start + 3;
        total_ticks = x + (1 - x).rem_euclid(4) + 3;

        phase_results[i] = phase;
        hp_pre_anvil[i] = hp_pre_anvil_val;
        sum_ticks += i64::from(total_ticks);
        let idx = total_ticks as usize;
        if idx >= freq.len() {
            freq.resize(idx + 1, 0);
        }
        freq[idx] += 1;
    }

    // Defensive: Check tick_counts
    if freq.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }
    let style_list = vec![best_styles_enraged[0].clone(), best_styles_normal[0].clone()];
    let end_results = results_formatter(&monsters, &style_list, sum_ticks, freq, trials, Vec::new(), phase_results);
    end_results
}
