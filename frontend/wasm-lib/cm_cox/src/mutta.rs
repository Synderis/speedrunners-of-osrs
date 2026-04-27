use rand::prelude::*;
use rand::rngs::SmallRng;
use rand::distributions::{Uniform, Distribution};
use rand::SeedableRng;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;

// =========================
// Helpers
// =========================

#[inline]
fn sample_hit_if<R: Rng>(rng: &mut R, threshold: u32, max_hit: i32) -> i32 {
    if rng.next_u32() <= threshold {
        rng.gen_range(0..=max_hit).max(1)
    } else {
        0
    }
}

#[inline]
fn process_attack_tick<R: Rng>(
    rng: &mut R,
    hp: &mut i32,
    atk_cd: &mut AttackCooldown,
    thrall_cd: &mut AttackCooldown,
    atk_threshold: u32,
    max_hit: i32,
    attack_speed: i32,
    thrall_dmg: &Uniform<i32>,
    thrall_interval: i32,
) {
    let mut total_hit = 0;

    // main attack (only if weapon is ready)
    if atk_cd.is_ready() {
        total_hit += sample_hit_if(rng, atk_threshold, max_hit);
        atk_cd.reset(attack_speed);
    } else {
        atk_cd.tick();
    }

    // thrall hit
    if thrall_cd.is_ready() {
        total_hit += thrall_dmg.sample(rng);
        thrall_cd.reset(thrall_interval);
    } else {
        thrall_cd.tick();
    }

    *hp -= total_hit;
}

#[inline]
fn tick_until_hp<R: Rng>(
    rng: &mut R,
    hp: &mut i32,
    stop_hp: i32,
    atk_speed: i32,
    atk_thr: u32,
    max_hit: i32,
    thrall_interval: i32,
    thrall_dmg: &Uniform<i32>,
) -> i32 {
    let mut current_ticks = 0;
    let mut atk_cd = AttackCooldown::new();
    let mut thrall_cd = AttackCooldown::new();

    while *hp > stop_hp {
        current_ticks += 1;

        process_attack_tick(
            rng,
            hp,
            &mut atk_cd,
            &mut thrall_cd,
            atk_thr,
            max_hit,
            atk_speed,
            thrall_dmg,
            thrall_interval,
        );
    }

    current_ticks - 1
}

#[inline]
fn tick_until_dead<R: Rng>(
    rng: &mut R,
    hp: &mut i32,
    atk_speed: i32,
    atk_thr: u32,
    max_hit: i32,
    thrall_interval: i32,
    thrall_dmg: &Uniform<i32>,
) -> i32 {
    tick_until_hp(
        rng,
        hp,
        0,
        atk_speed,
        atk_thr,
        max_hit,
        thrall_interval,
        thrall_dmg,
    )
}

// =========================
// Phase sims
// =========================

fn sim_freeze_mutta(
    mut total_ticks: i32,
    mut hp_mutta: i32,
    mutta: &Monster,
    best_style_mutta: &StyleResult,
    zgs_best_style: &StyleResult,
    rng: &mut SmallRng,
    // precomputed thresholds
    best_thr_mutta: u32,
    zgs_thr: u32,
    thrall_dmg: &Uniform<i32>,
) -> i32 {
    let mut current_ticks = 0;

    let threshold_hp = (mutta.skills.hp as f64 * 0.5) as i32;

    // Cooldowns
    let mut atk_cd = AttackCooldown::new();
    let mut thrall_cd = AttackCooldown::new();

    // =========================
    // Phase 1: DPS down to threshold
    // =========================
    while hp_mutta > threshold_hp {
        current_ticks += 1;

        process_attack_tick(
            rng,
            &mut hp_mutta,
            &mut atk_cd,
            &mut thrall_cd,
            best_thr_mutta,
            best_style_mutta.max_hit,
            best_style_mutta.attack_speed,
            thrall_dmg,
            4, // thrall interval is always 4 for mutta
        );
    }

    // =========================
    // Phase 2: wait until weapon is off CD, then ZGS spec
    // =========================

    // We keep ticking time with thralls only until atk_cd == 0,
    // then on that tick we spend the attack on ZGS spec.
    loop {
        current_ticks += 1;
        let mut total_hit = 0;

        // Thrall can hit every tick (if off cooldown)
        if thrall_cd.is_ready() {
            total_hit += thrall_dmg.sample(rng);
            thrall_cd.reset(4);
        } else {
            thrall_cd.tick();
        }

        if atk_cd.is_ready() {
            // This tick is the ZGS spec tick
            // ZGS freeze: on miss, heal; on hit, damage
            if rng.next_u32() > zgs_thr {
                // miss => heal up to 50% HP, but not above max
                hp_mutta += (mutta.skills.hp / 2)
                    .min(mutta.skills.hp - hp_mutta);
            } else {
                // hit with ZGS spec
                let spec_hit = rng
                    .gen_range(0..=zgs_best_style.max_hit)
                    .max(1);
                total_hit += spec_hit;
            }

            // ZGS spec imposes a 6-tick cooldown
            atk_cd.reset(6);
            hp_mutta -= total_hit;
            break; // spec is done; move to finish phase
        } else {
            atk_cd.tick();
        }

        hp_mutta -= total_hit;
    }

    // =========================
    // Phase 3: finish it off (CDs persist from spec)
    // =========================
    while hp_mutta > 0 {
        current_ticks += 1;

        process_attack_tick(
            rng,
            &mut hp_mutta,
            &mut atk_cd,
            &mut thrall_cd,
            best_thr_mutta,
            best_style_mutta.max_hit,
            best_style_mutta.attack_speed,
            thrall_dmg,
            4, // thrall interval is always 4 for mutta
        );
    }

    total_ticks += current_ticks - 3;
    total_ticks
}


fn sim_chop_tree(
    player: &Player,
    mut total_ticks: i32,
    mut tree_hp: i32,
    // tree chop accuracy as threshold
    tree_thr: u32,
    mut hp_small_mutta: i32,
    base_small_mutta_hp: i32,
    best_style_small_mutta: &StyleResult,
    rng: &mut SmallRng,
    // precomputed thresholds
    small_mutta_thr: u32,
    thrall_dmg: &Uniform<i32>,
) -> (i32, i32) {
    // Chop the tree, possibly hitting small mutta as you go
    let mut current_ticks = 0;
    let mut wc_cooldown = AttackCooldown::new();
    let mut attack_cooldown = AttackCooldown::new();
    let mut thrall_cooldown = AttackCooldown::new();
    
    while tree_hp > 0 {
        current_ticks += 1;
        
        // tree roll (woodcutting every 5 ticks)
        let tree_hit = if wc_cooldown.is_ready() {
            wc_cooldown.reset(5);
            sample_hit_if(rng, tree_thr, player.combat_stats.woodcutting)
        } else {
            wc_cooldown.tick();
            0
        };

        // Small mutta can be hit if it's above half HP
        let small_above_threshold =
            base_small_mutta_hp / 2 < best_style_small_mutta.max_hit + hp_small_mutta;

        let hit = if attack_cooldown.is_ready() && small_above_threshold {
            attack_cooldown.reset(best_style_small_mutta.attack_speed);
            sample_hit_if(rng, small_mutta_thr, best_style_small_mutta.max_hit)
        } else {
            if !small_above_threshold {
                attack_cooldown = AttackCooldown::new(); // Reset when can't attack
            } else {
                attack_cooldown.tick();
            }
            0
        };

        let thrall_hit = if thrall_cooldown.is_ready() && small_above_threshold {
            thrall_cooldown.reset(4);
            thrall_dmg.sample(rng)
        } else {
            if !small_above_threshold {
                thrall_cooldown = AttackCooldown::new(); // Reset when can't attack
            } else {
                thrall_cooldown.tick();
            }
            0
        };

        hp_small_mutta -= hit + thrall_hit;
        tree_hp -= tree_hit;
        if tree_hp < 0 {
            break;
        }
    }
    let phase_ticks = total_ticks;
    total_ticks += best_style_small_mutta.attack_speed;

    while hp_small_mutta > 0 {
        current_ticks += 1;

        let hit = if attack_cooldown.is_ready() {
            attack_cooldown.reset(best_style_small_mutta.attack_speed);
            sample_hit_if(rng, small_mutta_thr, best_style_small_mutta.max_hit)
        } else {
            attack_cooldown.tick();
            0
        };

        let thrall_hit = if thrall_cooldown.is_ready() {
            thrall_cooldown.reset(4);
            thrall_dmg.sample(rng)
        } else {
            thrall_cooldown.tick();
            0
        };

        hp_small_mutta -= hit + thrall_hit;
    }
    total_ticks += current_ticks;
    (total_ticks, (phase_ticks + 1))
}

// =========================
// WASM entrypoint
// =========================

#[wasm_bindgen]
pub fn calculate_dps_with_objects_mutta(payload_json: &str) -> String {
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    let mut player = payload.player;
    let mut monsters = payload.room.monsters;
    let trials = 100_000usize;

    // Fast RNG with variability
    let mut rng = SmallRng::from_entropy();

    for monster in &mut monsters {
        if player.combat_stats.hitpoints != 99 {
            monster.skills.hp = monster_hp_scaling(monster, &player.combat_stats);
        }
        monster.skills = monster_stat_scaling(monster, player.combat_stats.hitpoints);
    }

    // Defensive: Check monsters
    if monsters.len() < 2 {
        return "{\"error\": \"Muttadile simulation requires two monsters (small and large)}\""
            .to_string();
    }

    // ZGS setup (optional)
    let mut zgs_best_style: Option<StyleResult> = None;
    let has_zgs = player
        .inventory
        .iter()
        .any(|item| item.name.to_lowercase().contains("zamorak godsword"));

    if has_zgs {
        let swap_result = ensure_weapon_swap(&mut player, "Zamorak godsword", None);
        let (swapped_weapon, swapped_offhand) = match swap_result {
            Some((w, o)) => (w, o),
            None => {
                return "{\"error\": \"Elder maul not found in inventory\"}".to_string();
            }
        };
        zgs_best_style = Some(find_best_combat_style(
            &player,
            &monsters[0],
            vec!["melee".to_string()],
        ));
        // swap back
        ensure_weapon_swap(&mut player, &swapped_weapon, swapped_offhand.clone());
    }

    // Small Mutta (magic)
    let best_style_small_mutta =
        find_best_combat_style(&player, &monsters[0], vec!["magic".to_string()]);
    let base_small_mutta_hp = monsters[0].skills.hp;

    // Large Mutta (ranged)
    let best_style_large_mutta =
        find_best_combat_style(&player, &monsters[1], vec!["ranged".to_string()]);
    let base_large_mutta_hp = monsters[1].skills.hp;
    let attack_speed_large_mutta = player
        .gear_sets
        .ranged
        .selected_weapon
        .as_ref()
        .map(|w| w.speed)
        .unwrap_or(4);

    // Tree
    let wc_level = player.combat_stats.woodcutting;
    let tree_accuracy = (1.0
        + ((((50.0 * (99.0 - wc_level as f64)) / 98.0)
            + ((200.0 * (wc_level as f64 - 1.0)) / 98.0)
            + 0.5))
            .floor())
        / 256.0;
    let base_tree_hp = wc_level * 5;

    let death_animation = 4;
    let post_room_delay = 4;
    let walk_delay = 10;
    let hit_delay = 1;
    let hit_delay_small_mutta =
        if player
            .gear_sets
            .mage
            .selected_weapon
            .as_ref()
            .unwrap()
            .name
            == "Tumeken's shadow"
        {
            2
        } else {
            1
        };

    // ===== Precompute thresholds =====
    let small_mutta_thr =
        (best_style_small_mutta.accuracy.clamp(0.0, 1.0) * (u32::MAX as f64)) as u32;
    let large_mutta_thr =
        (best_style_large_mutta.accuracy.clamp(0.0, 1.0) * (u32::MAX as f64)) as u32;
    let tree_thr = (tree_accuracy.clamp(0.0, 1.0) * (u32::MAX as f64)) as u32;
    let zgs_thr = zgs_best_style
        .as_ref()
        .map(|s| (s.accuracy.clamp(0.0, 1.0) * (u32::MAX as f64)) as u32)
        .unwrap_or(0);

    // Build histogram + running sum instead of storing all tick counts
    let mut freq: Vec<usize> = Vec::new();
    let mut sum_ticks: i64 = 0;
    let mut phase_results: Vec<i32> = vec![0; trials];
    let thrall_dmg = Uniform::new_inclusive(0, 3);

    for i in 0..trials {
        let mut hp_large_mutta = base_large_mutta_hp;
        let hp_small_mutta = base_small_mutta_hp;
        let tree_hp = base_tree_hp;

        let mut total_ticks = 0;
        let range_max = if attack_speed_large_mutta > 4 {
            4 * attack_speed_large_mutta
        } else {
            4
        };
        let overkill_large_mutta = if rng.gen_range(1..=range_max) == 1 { 1 } else { 0 };
        let tick_cycle_offset = rng.gen_range(0..=4);

        if has_zgs {
            total_ticks = sim_freeze_mutta(
                total_ticks,
                hp_small_mutta,
                &monsters[0],
                &best_style_small_mutta,
                zgs_best_style.as_ref().unwrap(),
                &mut rng,
                small_mutta_thr,
                zgs_thr,
                &thrall_dmg,
            );
            total_ticks += 1 + hit_delay_small_mutta + death_animation - overkill_large_mutta;
            total_ticks += tick_cycle_offset;

            // Large mutta leaving the lake
            total_ticks += 5;

            total_ticks = sim_freeze_mutta(
                total_ticks,
                hp_large_mutta,
                &monsters[1],
                &best_style_large_mutta,
                zgs_best_style.as_ref().unwrap(),
                &mut rng,
                large_mutta_thr,
                zgs_thr,
                &thrall_dmg,
            );
            phase_results[i] = 0;
        } else {
            let (new_total_ticks, phase_ticks) = sim_chop_tree(
                &player,
                total_ticks,
                tree_hp,
                tree_thr,
                hp_small_mutta,
                base_small_mutta_hp,
                &best_style_small_mutta,
                &mut rng,
                small_mutta_thr,
                &thrall_dmg,
            );
            phase_results[i] = phase_ticks;
            total_ticks = new_total_ticks;

            total_ticks += 1 + hit_delay_small_mutta + death_animation - overkill_large_mutta;
            total_ticks += tick_cycle_offset;

            // Large mutta leaving the lake
            total_ticks += 5;

            // Large Mutta finish phase using cooldown helper
            let phase_ticks = tick_until_dead(
                &mut rng,
                &mut hp_large_mutta,
                attack_speed_large_mutta,
                large_mutta_thr,
                best_style_large_mutta.max_hit,
                4,
                &thrall_dmg,
            );
            total_ticks += phase_ticks;
        }
        total_ticks += 1 + walk_delay + hit_delay + death_animation - overkill_large_mutta;

        // Align to next 4-tick cycle starting at the tick_cycle_offset
        total_ticks += (tick_cycle_offset + 4 - (total_ticks % 4)) % 4;

        total_ticks += post_room_delay;

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
    let style_list = vec![best_style_small_mutta, best_style_large_mutta];
    let end_results = results_formatter(
        &monsters,
        &style_list,
        sum_ticks,
        freq,
        trials,
        phase_results,
        Vec::new(),
    );
    end_results
}
