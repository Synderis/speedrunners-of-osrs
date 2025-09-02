use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

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

// --- Markov Matrix Helpers (Python-style, updated) ---
fn build_transition_matrix(hp: usize, max_hit: usize, accuracy: f64) -> Vec<Vec<f64>> {
    let n = hp + 1;
    let mut mat = vec![vec![0.0; n]; n];
    for src in 1..n {
        // Miss: stays at src
        mat[src][src] += 1.0 - accuracy;
        let hit_range = std::cmp::min(src, max_hit);
        if hit_range > 0 {
            for dmg in 1..=hit_range {
                let dest = src - dmg;
                mat[dest][src] += accuracy / hit_range as f64;
            }
        }
    }
    mat[0][0] = 1.0;
    // Normalize columns so each column sums to 1
    for col in 0..n {
        let sum: f64 = mat.iter().map(|row| row[col]).sum();
        if sum > 0.0 {
            for row in 0..n {
                mat[row][col] /= sum;
            }
        }
    }
    mat
}

fn propagate_markov(state: &[f64], mat: &[Vec<f64>]) -> Vec<f64> {
    let n = state.len();
    let mut new_state = vec![0.0; n];
    for dest in 0..n {
        for src in 0..n {
            new_state[dest] += mat[dest][src] * state[src];
        }
    }
    new_state
}

fn weapon_kill_times_markov_per_tick_with_delay(
    vasa_hp: usize, vasa_max_hit: usize, vasa_accuracy: f64, vasa_attack_speed: usize,
    crystal_hp: usize, crystal_max_hit: usize, crystal_accuracy: f64, crystal_attack_speed: usize,
    max_crystal_phase_ticks: usize, pre_crystal_attacks: usize, post_crystal_attacks: usize,
    teleport_attacks: usize, teleport_ticks: usize, heal_percent: f64, max_cycles: usize, cap: f64
) -> (Vec<f64>, Vec<f64>, f64, f64) {
    let vasa_mat = build_transition_matrix(vasa_hp, vasa_max_hit, vasa_accuracy);
    let crystal_mat = build_transition_matrix(crystal_hp, crystal_max_hit, crystal_accuracy);

    let mut vasa_state = vec![0.0; vasa_hp + 1];
    vasa_state[vasa_hp] = 1.0;

    let mut tick = 0.0;
    let mut kill_prob_by_tick = Vec::new();
    let mut tick_list = Vec::new();

    let mut cycles = 0;
    while cycles < max_cycles && vasa_state[0] < cap {
        // Pre-crystal Vasa attacks
        for _ in 0..pre_crystal_attacks {
            tick += vasa_attack_speed as f64;
            vasa_state = propagate_markov(&vasa_state, &vasa_mat);
            kill_prob_by_tick.push(vasa_state[0]);
            tick_list.push(tick);
            if vasa_state[0] >= cap { break; }
        }
        if vasa_state[0] >= cap { break; }

        // Crystal phase (weighted tick advancement)
        let mut crystal_state = vec![0.0; crystal_hp + 1];
        crystal_state[crystal_hp] = 1.0;
        let n_attacks = max_crystal_phase_ticks / crystal_attack_speed;
        let mut death_tick_probs = Vec::new();
        let mut prev_dead = 0.0;
        let mut local_tick = tick;
        for _ in 0..n_attacks {
            local_tick += crystal_attack_speed as f64;
            crystal_state = propagate_markov(&crystal_state, &crystal_mat);
            let died_this_attack = crystal_state[0] - prev_dead;
            if died_this_attack > 0.0 {
                death_tick_probs.push((died_this_attack, local_tick));
            }
            prev_dead = crystal_state[0];
        }
        let survived_prob = 1.0 - crystal_state[0];
        let final_tick = tick + max_crystal_phase_ticks as f64;

        if !death_tick_probs.is_empty() {
            let weighted_tick: f64 = death_tick_probs.iter().map(|(prob, t)| prob * t).sum::<f64>()
                / death_tick_probs.iter().map(|(prob, _)| prob).sum::<f64>();
            tick = weighted_tick;
        } else {
            tick = final_tick;
            // Heal Vasa if crystal survives
            let heal_amount = (vasa_hp as f64 * heal_percent).round() as usize;
            let mut healed_state = vec![0.0; vasa_state.len()];
            for i in 1..vasa_state.len() {
                let dest = std::cmp::min(i + heal_amount, vasa_state.len() - 1);
                healed_state[dest] += vasa_state[i];
            }
            healed_state[0] = vasa_state[0];
            vasa_state = healed_state;
        }

        // Post-crystal Vasa attacks
        for _ in 0..post_crystal_attacks {
            tick += vasa_attack_speed as f64;
            vasa_state = propagate_markov(&vasa_state, &vasa_mat);
            kill_prob_by_tick.push(vasa_state[0]);
            tick_list.push(tick);
            if vasa_state[0] >= cap { break; }
        }
        if vasa_state[0] >= cap { break; }

        // Crystal phase again (weighted tick advancement)
        let mut crystal_state = vec![0.0; crystal_hp + 1];
        crystal_state[crystal_hp] = 1.0;
        let n_attacks = max_crystal_phase_ticks / crystal_attack_speed;
        let mut death_tick_probs = Vec::new();
        let mut prev_dead = 0.0;
        let mut local_tick = tick;
        for _ in 0..n_attacks {
            local_tick += crystal_attack_speed as f64;
            crystal_state = propagate_markov(&crystal_state, &crystal_mat);
            let died_this_attack = crystal_state[0] - prev_dead;
            if died_this_attack > 0.0 {
                death_tick_probs.push((died_this_attack, local_tick));
            }
            prev_dead = crystal_state[0];
        }
        let survived_prob = 1.0 - crystal_state[0];
        let final_tick = tick + max_crystal_phase_ticks as f64;

        if !death_tick_probs.is_empty() {
            let weighted_tick: f64 = death_tick_probs.iter().map(|(prob, t)| prob * t).sum::<f64>()
                / death_tick_probs.iter().map(|(prob, _)| prob).sum::<f64>();
            tick = weighted_tick;
        } else {
            tick = final_tick;
            let heal_amount = (vasa_hp as f64 * heal_percent).round() as usize;
            let mut healed_state = vec![0.0; vasa_state.len()];
            for i in 1..vasa_state.len() {
                let dest = std::cmp::min(i + heal_amount, vasa_state.len() - 1);
                healed_state[dest] += vasa_state[i];
            }
            healed_state[0] = vasa_state[0];
            vasa_state = healed_state;
        }

        // Teleport attacks
        for _ in 0..teleport_attacks {
            tick += vasa_attack_speed as f64;
            vasa_state = propagate_markov(&vasa_state, &vasa_mat);
            kill_prob_by_tick.push(vasa_state[0]);
            tick_list.push(tick);
            if vasa_state[0] >= cap { break; }
        }
        if vasa_state[0] >= cap { break; }

        // Teleport phase
        tick += teleport_ticks as f64;
        cycles += 1;
    }

    // PDF: probability of dying at each tick
    let mut kill_prob_increments = Vec::with_capacity(kill_prob_by_tick.len());
    let mut prev = 0.0;
    for &p in &kill_prob_by_tick {
        kill_prob_increments.push(p - prev);
        prev = p;
    }

    Weighted mean (expected TTK)
    let expected_ttk: f64 = tick_list.iter()
        .zip(kill_prob_increments.iter())
        .map(|(&t, &dp)| t * dp)
        .sum();
    console_log!("Expected TTK: {:.6}", expected_ttk);

    (kill_prob_by_tick, tick_list, 0.0, expected_ttk)
}


#[wasm_bindgen]
pub fn calculate_dps_with_objects_vasa(payload_json: &str) -> String {
    // Parse payload
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let monsters = &payload.room.monsters;
    if monsters.len() < 2 {
        return "{\"error\": \"Room must have at least two monsters (Vasa and Crystal)\"}".to_string();
    }

    // Assign Vasa and Crystal
    let vasa = &monsters[0];
    let crystal = &monsters[1];
    let mut player = payload.player;

    // Find best style for Vasa (first monster)
    let best_style_vasa = find_best_combat_style(
        &player,
        vasa,
        vec!["ranged".to_string()]
    );
    let vasa_hp = vasa.skills.hp as usize;
    let vasa_max_hit = best_style_vasa.max_hit as usize;
    let vasa_accuracy = best_style_vasa.accuracy;
    let vasa_attack_speed = if let Some(weapon) = &player.gear_sets.ranged.selected_weapon {
        if best_style_vasa.combat_style == "Aggressive" {
            (weapon.speed - 1) as usize
        } else {
            5
        }
    } else {
        5
    };


    // Find best style for Crystal (second monster)
    let best_style_crystal = find_best_combat_style(
        &player,
        crystal,
        vec!["melee".to_string()]
    );
    let crystal_hp = crystal.skills.hp as usize;
    let crystal_max_hit = best_style_crystal.max_hit as usize;
    let crystal_accuracy = best_style_crystal.accuracy;
    let crystal_attack_speed = if let Some(weapon) = &player.gear_sets.melee.selected_weapon {
        weapon.speed as usize
    } else {
        5
    };

    // Markov simulation parameters
    let cap = payload.config.cap;
    let max_cycles = 10;
    let max_crystal_phase_ticks = 70;
    let pre_crystal_attacks = 4;
    let post_crystal_attacks = 7;
    let teleport_attacks = 3;
    let teleport_ticks = 12;
    let heal_percent = 0.01;

    console_log!("Vasa HP: {}", vasa_hp);
    console_log!("Vasa Max Hit: {}", vasa_max_hit);
    console_log!("Vasa Accuracy: {:.5}", vasa_accuracy);
    console_log!("Vasa Attack Speed: {}", vasa_attack_speed);

    console_log!("Crystal HP: {}", crystal_hp);
    console_log!("Crystal Max Hit: {}", crystal_max_hit);
    console_log!("Crystal Accuracy: {:.5}", crystal_accuracy);
    console_log!("Crystal Attack Speed: {}", crystal_attack_speed);

    console_log!("cap: {:.5}, max_cycles: {}, max_crystal_phase_ticks: {}, pre_crystal_attacks: {}, post_crystal_attacks: {}, teleport_attacks: {}, teleport_ticks: {}, heal_percent: {:.5}",
        cap, max_cycles, max_crystal_phase_ticks, pre_crystal_attacks, post_crystal_attacks, teleport_attacks, teleport_ticks, heal_percent
    );

    // Run Markov simulation
    let (kill_prob_by_tick, tick_list, _unused, expected_ttk) = weapon_kill_times_markov_per_tick_with_delay(
        vasa_hp, vasa_max_hit, vasa_accuracy, vasa_attack_speed,
        crystal_hp, crystal_max_hit, crystal_accuracy, crystal_attack_speed,
        max_crystal_phase_ticks, pre_crystal_attacks, post_crystal_attacks,
        teleport_attacks, teleport_ticks, heal_percent, max_cycles, cap
    );

    console_log!("First 10 kill_prob_by_tick values:");
    for i in 0..10.min(kill_prob_by_tick.len()) {
        console_log!("{}: {:.5}", i, kill_prob_by_tick[i]);
    }

    console_log!("First 10 tick_list values:");
    for i in 0..10.min(tick_list.len()) {
        console_log!("{}: {:.2}", i, tick_list[i]);
    }

    // PDF: probability of dying at each tick
    let mut kill_prob_increments = Vec::with_capacity(kill_prob_by_tick.len());
    let mut prev = 0.0;
    for &p in &kill_prob_by_tick {
        kill_prob_increments.push(p - prev);
        prev = p;
    }

    // Results for Vasa
    let expected_hits = expected_ttk / vasa_attack_speed as f64;
    let expected_seconds = expected_ttk * 0.6;
    let kill_times: Vec<f64> = kill_prob_by_tick.clone();

    let result = serde_json::json!({
        "monster_id": vasa.id,
        "monster_name": vasa.name,
        "expected_hits": expected_hits,
        "expected_ticks": expected_ttk,
        "expected_seconds": expected_seconds,
        "kill_times": kill_times,
    });

    let results = vec![result];

    // Encounter kill times (for plotting, etc.)
    let encounter_kill_times_obj: Vec<serde_json::Value> = kill_prob_by_tick.iter().enumerate()
        .map(|(idx, &prob)| {
            serde_json::json!({
                "tick": tick_list[idx],
                "probability": prob
            })
        })
        .collect();

    let total_expected_hits = expected_hits;
    let total_expected_ticks = expected_ttk;
    let total_expected_seconds = expected_seconds;

    serde_json::json!({
        "results": results,
        "total_hits": total_expected_hits,
        "total_expected_ticks": total_expected_ticks,
        "total_expected_seconds": total_expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj
    }).to_string()
}