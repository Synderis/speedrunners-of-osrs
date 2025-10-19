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
    weapon_name: &str,
    rng: &mut SmallRng,
    thrall_dist: &Uniform<i32>, // prebuilt 0..=3
) -> (i32, i32, usize, bool) {
    // keep your modulo timing exactly the same, just sample from a prebuilt Uniform
    while *tekton_hp > 0 && hit_count >= hit_count_bounds[0] && hit_count <= hit_count_bounds[1] {
        *current_phase_ticks += 1;

        if *current_phase_ticks == 1 || (*current_phase_ticks - 1) % 4 == 0 {
            *tekton_hp -= thrall_dist.sample(rng); // 0..=3
        }
        if *tekton_hp <= 0 {
            return (*tekton_hp, *current_phase_ticks, hit_count, true);
        }

        if *current_phase_ticks == 1 || (*current_phase_ticks - 1) % attack_speed == 0 {
            let hit = dmg_modifier_check(rng, max_hit, accuracy, weapon_name);
            *tekton_hp -= hit;
            hit_count += 1;
        }
    }
    (*tekton_hp, *current_phase_ticks, hit_count, false)
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_tekton(payload_json: &str) -> String {
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

    // --- SWAP TO ELDER MAUL BEFORE SIMULATION ---
    let swap_result = ensure_weapon_swap(&mut player, "Elder maul", None);
    let (swapped_weapon, swapped_offhand) = match swap_result {
        Some((w, o)) => (w, o),
        None => {
            return "{\"error\": \"Elder maul not found in inventory\"}".to_string();
        }
    };

    // Extract Tekton stats
    let base_tekton_hp = monsters[0].skills.hp;

    // Find best style for spec
    let mut tekton_initial = monsters[0].clone();
    let mut tekton_initial_enraged = monsters[1].clone();

    let first_spec_def_normal = (tekton_initial.skills.def as f64 * 0.65).ceil() as i32;
    tekton_initial.skills.def = (tekton_initial.skills.def as f64 * 0.65).ceil() as i32;
    let best_style_spec = find_best_combat_style(&player, &tekton_initial, vec!["melee".to_string()]);
    let max_hit_spec = best_style_spec.max_hit;

    if player.gear_sets.melee.selected_weapon.as_ref().map(|w| w.name.as_str()) == Some("Elder maul") {
        ensure_weapon_swap(&mut player, &swapped_weapon, swapped_offhand.clone());
    }
    let weapon_name = &player.gear_sets.melee.selected_weapon.as_ref().unwrap().name;

    let first_spec_def_enraged = (tekton_initial_enraged.skills.def as f64 * 0.65).ceil() as i32;
    tekton_initial_enraged.skills.def = (tekton_initial_enraged.skills.def as f64 * 0.65).ceil() as i32;

    tekton_initial.skills.def = (tekton_initial.skills.def as f64 * 0.95).ceil() as i32;
    let normal_1_spec_best_style = find_best_combat_style(&player, &tekton_initial, vec!["melee".to_string()]);
    tekton_initial.skills.def = first_spec_def_normal;
    tekton_initial.skills.def = (tekton_initial.skills.def as f64 * 0.65).ceil() as i32;
    let normal_2_spec_best_style = find_best_combat_style(&player, &tekton_initial, vec!["melee".to_string()]);
    let best_styles_normal = vec![
        normal_1_spec_best_style.clone(),
        normal_2_spec_best_style.clone(),
    ];

    tekton_initial_enraged.skills.def = (tekton_initial_enraged.skills.def as f64 * 0.95).ceil() as i32;
    let enraged_1_spec_best_style = find_best_combat_style(&player, &tekton_initial_enraged, vec!["melee".to_string()]);
    tekton_initial_enraged.skills.def = first_spec_def_enraged;
    tekton_initial_enraged.skills.def = (tekton_initial_enraged.skills.def as f64 * 0.65).ceil() as i32;
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

    let pre_veng = if room_methods.contains(&"Pre-Veng".to_string()) { 1 } else { 0 };
    let tekton_enraged_max_hit = monsters[1].max_hit.unwrap_or(0) as i32;

    let (delay, attack_pattern): (i32, Vec<[usize; 2]>) = if room_methods.contains(&"Tekton Short Lure".to_string()) {
        (12, vec![[0, 4], [0, 3], [4, 10]])
    } else {
        (16, vec![[0, 5], [0, 3], [4, 11]])
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
        let death_animation = if player.gear_sets.melee.selected_weapon.as_ref().map(|w| w.name.as_str()) == Some("Scythe of vitur") { 3 } else { 4 };
        let mut veng_count = pre_veng;

        while tekton_hp > 0 {
            if spec_phase {
                total_ticks += 6;
                tekton_hp -= dmg_modifier_check(&mut rng, max_hit_spec, 1.0, "Elder maul");
                let hit = dmg_modifier_check(&mut rng, max_hit_spec, best_style_spec.accuracy, "Elder maul");
                tekton_hp -= hit;
                if hit > 0 {
                    specs_hit += 1;
                }
                total_ticks += 6;
                spec_phase = false;
            }

            // Pre-anvil phase: (0, 5)
            let (hp1, ticks1, _, died1) = phase_loop(
                hit_count,
                &attack_pattern[0],
                &mut tekton_hp,
                &mut current_phase_ticks,
                best_styles_normal[specs_hit].attack_speed,
                best_styles_normal[specs_hit].accuracy,
                best_styles_normal[specs_hit].max_hit,
                weapon_name,
                &mut rng,
                &thrall_dmg,
            );
            tekton_hp = hp1;
            current_phase_ticks = ticks1;

            // Save hp_pre_anvil_val at the end of pre-anvil phase
            if tekton_hp > 0 && first_pass {
                hp_pre_anvil_val = tekton_hp;
                first_pass = false;
                phase += 1;
            }
            if died1 || tekton_hp <= 0 {
                total_ticks += current_phase_ticks - 1;
                break;
            }

            let anvil_cycle = rng.gen_range(3..7);
            tekton_hp += (anvil_cycle * 5) as i32;
            total_ticks += ((anvil_cycle * 3) - best_styles_normal[0].attack_speed) as i32;
            if current_phase_ticks > 0 {
                total_ticks += current_phase_ticks - 1;
            }
            current_phase_ticks = 0;

            // Normal phase: (0, 3)
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
                best_styles_normal[specs_hit].attack_speed,
                best_styles_normal[specs_hit].accuracy,
                best_styles_normal[specs_hit].max_hit,
                weapon_name,
                &mut rng,
                &thrall_dmg,
            );
            tekton_hp = hp2;
            current_phase_ticks = ticks2;
            hit_count = hit_count2;
            if died2 || tekton_hp <= 0 {
                total_ticks += current_phase_ticks - 1;
                break;
            }
            // Add attack speed to account for the final attack
            current_phase_ticks += best_styles_normal[specs_hit].attack_speed - 1;

            // Enraged phase: (4, 11)
            let (hp3, ticks3, _, died3) = phase_loop(
                hit_count,
                &attack_pattern[2],
                &mut tekton_hp,
                &mut current_phase_ticks,
                best_styles_enraged[specs_hit].attack_speed,
                best_styles_enraged[specs_hit].accuracy,
                best_styles_enraged[specs_hit].max_hit,
                weapon_name,
                &mut rng,
                &thrall_dmg,
            );
            tekton_hp = hp3;
            current_phase_ticks = ticks3;
            if died3 || tekton_hp <= 0 {
                total_ticks += current_phase_ticks - 1;
                break;
            }
            total_ticks += current_phase_ticks - 1;
            current_phase_ticks = 0;
            hit_count = 0;
            phase += 1;
        }
        // Add initial delay and round up to next multiple of 4
        let initial_delay = delay;
        total_ticks += initial_delay + death_animation;
        if total_ticks % 4 != 0 {
            total_ticks += 4 - (total_ticks % 4);
        }
        total_ticks += 4; // end crystal animation

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
