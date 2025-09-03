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

fn build_per_tick_matrix(hp: usize, max_hit: usize, accuracy: f64, attack_speed: usize) -> Vec<Vec<f64>> {
    let attack_mat = build_transition_matrix(hp, max_hit, accuracy);
    let n = hp + 1;
    let mut wait_mat = vec![vec![0.0; n]; n];
    for i in 0..n {
        wait_mat[i][i] = 1.0;
    }
    let mut per_tick_mat = vec![vec![0.0; n]; n];
    for i in 0..n {
        for j in 0..n {
            per_tick_mat[i][j] = (1.0 / attack_speed as f64) * attack_mat[i][j]
                + ((attack_speed as f64 - 1.0) / attack_speed as f64) * wait_mat[i][j];
        }
    }
    per_tick_mat
}

fn weapon_kill_times_markov_per_tick_with_delay(
    vasa_hp: usize, vasa_max_hit: usize, vasa_accuracy: f64, vasa_attack_speed: usize,
    crystal_hp: usize, crystal_max_hit: usize, crystal_accuracy: f64, crystal_attack_speed: usize,
    max_crystal_phase_ticks: usize, pre_crystal_attacks: usize, post_crystal_attacks: usize,
    teleport_attacks: usize, teleport_ticks: usize, heal_percent: f64, max_cycles: usize, cap: f64
) -> (Vec<f64>, Vec<f64>, f64, f64) {
    let vasa_per_tick_mat = build_per_tick_matrix(vasa_hp, vasa_max_hit, vasa_accuracy, vasa_attack_speed);
    let crystal_per_tick_mat = build_per_tick_matrix(crystal_hp, crystal_max_hit, crystal_accuracy, crystal_attack_speed);

    let mut vasa_state = vec![0.0; vasa_hp + 1];
    vasa_state[vasa_hp] = 1.0;

    let mut tick = 0.0;
    let mut kill_prob_by_tick = Vec::new();
    let mut tick_list = Vec::new();

    let mut cycles = 0;
    while cycles < max_cycles && vasa_state[0] < cap {
        // --- Pre-crystal Vasa attacks ---
        let total_pre_ticks = pre_crystal_attacks * vasa_attack_speed;
        for _ in 0..total_pre_ticks {
            kill_prob_by_tick.push(vasa_state[0]);
            tick_list.push(tick);

            vasa_state = propagate_markov(&vasa_state, &vasa_per_tick_mat);
            tick += 1.0;
            if vasa_state[0] >= cap { break; }
        }
        if vasa_state[0] >= cap { break; }

        // --- Crystal phase ---
        let mut crystal_state = vec![0.0; crystal_hp + 1];
        crystal_state[crystal_hp] = 1.0;
        for _ in 0..max_crystal_phase_ticks {
            kill_prob_by_tick.push(vasa_state[0]);
            tick_list.push(tick);

            vasa_state = propagate_markov(&vasa_state, &vasa_per_tick_mat);
            crystal_state = propagate_markov(&crystal_state, &crystal_per_tick_mat);
            tick += 1.0;
        }
        // Heal Vasa if crystal survives
        if crystal_state[0] < 1.0 {
            let heal_amount = (vasa_hp as f64 * heal_percent).round() as usize;
            let mut healed_state = vec![0.0; vasa_state.len()];
            for i in 1..vasa_state.len() {
                let dest = std::cmp::min(i + heal_amount, vasa_state.len() - 1);
                healed_state[dest] += vasa_state[i];
            }
            healed_state[0] = vasa_state[0];
            vasa_state = healed_state;
        }

        // --- Post-crystal Vasa attacks ---
        let total_post_ticks = post_crystal_attacks * vasa_attack_speed;
        for _ in 0..total_post_ticks {
            kill_prob_by_tick.push(vasa_state[0]);
            tick_list.push(tick);

            vasa_state = propagate_markov(&vasa_state, &vasa_per_tick_mat);
            tick += 1.0;
            if vasa_state[0] >= cap { break; }
        }
        if vasa_state[0] >= cap { break; }

        // --- Crystal phase again ---
        let mut crystal_state = vec![0.0; crystal_hp + 1];
        crystal_state[crystal_hp] = 1.0;
        for _ in 0..max_crystal_phase_ticks {
            kill_prob_by_tick.push(vasa_state[0]);
            tick_list.push(tick);

            vasa_state = propagate_markov(&vasa_state, &vasa_per_tick_mat);
            crystal_state = propagate_markov(&crystal_state, &crystal_per_tick_mat);
            tick += 1.0;
        }
        if crystal_state[0] < 1.0 {
            let heal_amount = (vasa_hp as f64 * heal_percent).round() as usize;
            let mut healed_state = vec![0.0; vasa_state.len()];
            for i in 1..vasa_state.len() {
                let dest = std::cmp::min(i + heal_amount, vasa_state.len() - 1);
                healed_state[dest] += vasa_state[i];
            }
            healed_state[0] = vasa_state[0];
            vasa_state = healed_state;
        }

        // --- Teleport attacks ---
        let total_teleport_ticks = teleport_attacks * vasa_attack_speed;
        for _ in 0..total_teleport_ticks {
            kill_prob_by_tick.push(vasa_state[0]);
            tick_list.push(tick);

            vasa_state = propagate_markov(&vasa_state, &vasa_per_tick_mat);
            tick += 1.0;
            if vasa_state[0] >= cap { break; }
        }
        if vasa_state[0] >= cap { break; }

        // --- Teleport phase (no attacks, just record state) ---
        for _ in 0..teleport_ticks {
            kill_prob_by_tick.push(vasa_state[0]);
            tick_list.push(tick);
            tick += 1.0;
        }
        cycles += 1;
    }

    // PDF: probability of dying at each tick
    let mut kill_prob_increments = Vec::with_capacity(kill_prob_by_tick.len());
    let mut prev = 0.0;
    for &p in &kill_prob_by_tick {
        kill_prob_increments.push(p - prev);
        prev = p;
    }

    // Find capped index (where CDF >= cap)
    let cap_val = 0.99;
    let capped_idx = kill_prob_by_tick.iter()
        .position(|&p| p >= cap_val)
        .map(|idx| idx + 1)
        .unwrap_or(kill_prob_by_tick.len());

    console_log!("\n[Markov] Probability of dying at each tick (PDF, used for expected TTK):");
    for i in 0..capped_idx {
        console_log!(
            "Tick {}: P(die at tick) = {:.6}, CDF = {:.6}",
            tick_list[i] as usize,
            kill_prob_increments[i],
            kill_prob_by_tick[i]
        );
    }

    // Weighted mean (expected TTK)
    let expected_ttk: f64 = tick_list.iter()
        .zip(kill_prob_increments.iter())
        .map(|(&t, &dp)| t * dp)
        .sum();

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

    // Find capped index (where CDF >= cap)
    let cap_val = 0.99;
    let capped_idx = kill_prob_by_tick.iter()
        .position(|&p| p >= cap_val)
        .map(|idx| idx + 1)
        .unwrap_or(kill_prob_by_tick.len());

    console_log!("\n[Markov] Probability of dying at each tick (PDF, used for expected TTK):");
    for i in 0..capped_idx {
        console_log!(
            "Tick {}: P(die at tick) = {:.6}, CDF = {:.6}",
            tick_list[i] as usize,
            kill_prob_increments[i],
            kill_prob_by_tick[i]
        );
    }

    // Weighted mean (expected TTK)
    let expected_ttk: f64 = tick_list.iter()
        .zip(kill_prob_increments.iter())
        .map(|(&t, &dp)| t * dp)
        .sum();

    // Results for Vasa
    let expected_hits = expected_ttk / vasa_attack_speed as f64;
    let expected_seconds = expected_ttk * 0.6;
    let kill_times: Vec<f64> = kill_prob_by_tick.clone();

    let vasa_result = serde_json::json!({
        "monster_id": vasa.id,
        "monster_name": vasa.name,
        "expected_hits": expected_hits,
        "expected_ticks": expected_ttk,
        "expected_seconds": expected_seconds,
        "combat_type": best_style_vasa.attack_type,
        "attack_style": best_style_vasa.combat_style,
        "kill_times": kill_times,
    });

    // Results for Crystal (example, you may want to use actual values for crystal)
    let crystal_result = serde_json::json!({
        "monster_id": crystal.id,
        "monster_name": crystal.name,
        "expected_hits": 0, // Replace with actual expected hits for crystal if available
        "expected_ticks": 0, // Replace with actual expected ticks for crystal if available
        "expected_seconds": 0.0, // Replace with actual expected seconds for crystal if available
        "combat_type": best_style_crystal.attack_type,
        "attack_style": best_style_crystal.combat_style,
        "kill_times": Vec::<f64>::new(), // Replace with actual kill times for crystal if available
    });

    let results = vec![vasa_result, crystal_result];

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
        "encounter_kill_times": encounter_kill_times_obj,
        "phase_results": [],
    }).to_string()
}