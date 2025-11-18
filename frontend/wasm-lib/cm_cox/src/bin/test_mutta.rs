use std::fs;
use rand::prelude::*;
use rand::rngs::SmallRng;
use rand::distributions::{Uniform};
use rand::SeedableRng;
use osrs_shared_types::*;
use osrs_shared_functions::*;
use serde::{Deserialize, Serialize};

// =========================
// Custom payload with hit lists
// =========================

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct HardcodedHits {
    pub small_mutta_hits: Vec<i32>,
    pub mutta_thrall_hits: Vec<i32>,
    pub large_mutta_hits: Vec<i32>,
    pub zgs_spec_hits: Vec<i32>,
}

// =========================
// Hit generators that can use hardcoded lists or fallback to RNG
// =========================

struct HitGenerator {
    small_mutta_hits: Option<Vec<i32>>,
    mutta_thrall_hits: Option<Vec<i32>>,
    large_mutta_hits: Option<Vec<i32>>,
    zgs_spec_hits: Option<Vec<i32>>,
    small_mutta_index: usize,
    thrall_index: usize,
    large_mutta_index: usize,
    zgs_spec_index: usize,
}

impl HitGenerator {
    fn new(hardcoded_hits: Option<HardcodedHits>) -> Self {
        match hardcoded_hits {
            Some(hits) => HitGenerator {
                small_mutta_hits: Some(hits.small_mutta_hits),
                mutta_thrall_hits: Some(hits.mutta_thrall_hits),
                large_mutta_hits: Some(hits.large_mutta_hits),
                zgs_spec_hits: Some(hits.zgs_spec_hits),
                small_mutta_index: 0,
                thrall_index: 0,
                large_mutta_index: 0,
                zgs_spec_index: 0,
            },
            None => HitGenerator {
                small_mutta_hits: None,
                mutta_thrall_hits: None,
                large_mutta_hits: None,
                zgs_spec_hits: None,
                small_mutta_index: 0,
                thrall_index: 0,
                large_mutta_index: 0,
                zgs_spec_index: 0,
            },
        }
    }

    fn get_small_mutta_hit<R: Rng>(&mut self, _rng: &mut R, _threshold: u32, _max_hit: i32) -> i32 {
        if let Some(ref hits) = self.small_mutta_hits {
            if self.small_mutta_index < hits.len() {
                let hit = hits[self.small_mutta_index];
                self.small_mutta_index += 1;
                return hit; // Use hardcoded value directly (no accuracy roll needed)
            } else {
                panic!("Exhausted hardcoded small mutta hits! Needed hit #{}, but only {} available", 
                       self.small_mutta_index + 1, hits.len());
            }
        }
        panic!("No hardcoded small mutta hits available, but RNG fallback disabled");
    }

    fn get_thrall_hit<R: Rng>(&mut self, _rng: &mut R, _thrall_dmg: &Uniform<i32>) -> i32 {
        if let Some(ref hits) = self.mutta_thrall_hits {
            if self.thrall_index < hits.len() {
                let hit = hits[self.thrall_index];
                self.thrall_index += 1;
                return hit; // Use hardcoded value directly (no accuracy roll needed)
            } else {
                panic!("Exhausted hardcoded thrall hits! Needed hit #{}, but only {} available", 
                       self.thrall_index + 1, hits.len());
            }
        }
        panic!("No hardcoded thrall hits available, but RNG fallback disabled");
    }

    fn get_large_mutta_hit<R: Rng>(&mut self, _rng: &mut R, _threshold: u32, _max_hit: i32) -> i32 {
        if let Some(ref hits) = self.large_mutta_hits {
            if self.large_mutta_index < hits.len() {
                let hit = hits[self.large_mutta_index];
                self.large_mutta_index += 1;
                return hit; // Use hardcoded value directly (no accuracy roll needed)
            } else {
                panic!("Exhausted hardcoded large mutta hits! Needed hit #{}, but only {} available", 
                       self.large_mutta_index + 1, hits.len());
            }
        }
        panic!("No hardcoded large mutta hits available, but RNG fallback disabled");
    }

    fn get_zgs_spec_hit<R: Rng>(&mut self, _rng: &mut R, _threshold: u32, _max_hit: i32) -> i32 {
        if let Some(ref hits) = self.zgs_spec_hits {
            if self.zgs_spec_index < hits.len() {
                let hit = hits[self.zgs_spec_index];
                self.zgs_spec_index += 1;
                return hit; // Use hardcoded value directly (no accuracy roll needed)
            } else {
                panic!("Exhausted hardcoded ZGS spec hits! Needed hit #{}, but only {} available", 
                       self.zgs_spec_index + 1, hits.len());
            }
        }
        panic!("No hardcoded ZGS spec hits available, but RNG fallback disabled");
    }
}

// =========================
// Helpers (copied from mutta.rs)
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
fn tick_until_hp_with_generator<R: Rng>(
    rng: &mut R,
    hp: &mut i32,
    stop_hp: i32,
    atk_speed: i32,
    atk_thr: u32,
    max_hit: i32,
    thrall_interval: i32,
    thrall_dmg: &Uniform<i32>,
    hit_generator: &mut HitGenerator,
    is_small_mutta: bool,
) -> i32 {
    let mut current_ticks = 0;
    let mut atk_cd = 0;
    let mut thrall_cd = 0;

    while *hp > stop_hp {
        current_ticks += 1;
        let mut total_hit = 0;

        // main attack
        if atk_cd == 0 {
            total_hit += if is_small_mutta {
                hit_generator.get_small_mutta_hit(rng, atk_thr, max_hit)
            } else {
                hit_generator.get_large_mutta_hit(rng, atk_thr, max_hit)
            };
            atk_cd = atk_speed;
        }

        // thrall
        if thrall_cd == 0 {
            total_hit += hit_generator.get_thrall_hit(rng, thrall_dmg);
            thrall_cd = thrall_interval;
        }

        *hp -= total_hit;

        if atk_cd > 0 {
            atk_cd -= 1;
        }
        if thrall_cd > 0 {
            thrall_cd -= 1;
        }
    }

    current_ticks
}

#[inline]
fn tick_until_dead_with_generator<R: Rng>(
    rng: &mut R,
    hp: &mut i32,
    atk_speed: i32,
    atk_thr: u32,
    max_hit: i32,
    thrall_interval: i32,
    thrall_dmg: &Uniform<i32>,
    hit_generator: &mut HitGenerator,
    is_small_mutta: bool,
) -> i32 {
    tick_until_hp_with_generator(
        rng,
        hp,
        0,
        atk_speed,
        atk_thr,
        max_hit,
        thrall_interval,
        thrall_dmg,
        hit_generator,
        is_small_mutta,
    )
}

// =========================
// Phase sims (copied from mutta.rs)
// =========================

fn sim_freeze_mutta_with_generator(
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
    hit_generator: &mut HitGenerator,
    is_small_mutta: bool,
) -> i32 {
    let mut current_ticks = 0;

    // let threshold_hp = (mutta.skills.hp as f64 * 0.4) as i32;
    let threshold_hp = (mutta.skills.hp as f64 * 0.6) as i32;

    // Cooldowns: 0 means "ready this tick"
    let mut atk_cd = 0;      // normal attack cooldown
    let mut thrall_cd = 0;   // thrall cooldown (4-tick cycle)

    // =========================
    // Phase 1: DPS down to threshold
    // =========================
    while hp_mutta > threshold_hp {
        current_ticks += 1;

        let mut total_hit = 0;

        // main attack (only if weapon is ready)
        if atk_cd == 0 {
            total_hit += if is_small_mutta {
                hit_generator.get_small_mutta_hit(rng, best_thr_mutta, best_style_mutta.max_hit)
            } else {
                hit_generator.get_large_mutta_hit(rng, best_thr_mutta, best_style_mutta.max_hit)
            };
            atk_cd = best_style_mutta.attack_speed;
            println!("Total hit: {}", total_hit);
        }
        
        // thrall hit
        if thrall_cd == 0 {
            total_hit += hit_generator.get_thrall_hit(rng, thrall_dmg);
            thrall_cd = 4;
        }

        hp_mutta -= total_hit;

        // tick cooldowns
        if atk_cd > 0 {
            atk_cd -= 1;
        }
        if thrall_cd > 0 {
            thrall_cd -= 1;
        }
    }

    // =========================
    // Phase 2: wait until weapon is off CD, then ZGS spec
    // =========================

    // We keep ticking time with thralls only until atk_cd == 0,
    // then on that tick we spend the attack on ZGS spec.
    loop {
        if atk_cd == 0 {
            // This tick is the ZGS spec tick
            current_ticks += 1;

            let mut total_hit = 0;

            // Thrall can still hit on spec tick
            if thrall_cd == 0 {
                total_hit += hit_generator.get_thrall_hit(rng, thrall_dmg);
                thrall_cd = 4;
            }
            
            // ZGS spec: use hardcoded damage value directly (no accuracy check)
            // Positive values = damage, 0 = miss (heal)
            let zgs_hit = hit_generator.get_zgs_spec_hit(rng, zgs_thr, zgs_best_style.max_hit);
            if zgs_hit == 0 {
                // miss => heal up to 50% HP, but not above max
                hp_mutta += (mutta.skills.hp / 2)
                    .min(mutta.skills.hp - hp_mutta);
            } else {
                // hit with hardcoded damage
                total_hit += zgs_hit;
                println!("ZGS spec hit: {}", zgs_hit);
            }

            hp_mutta -= total_hit;

            // ZGS spec imposes a 6-tick cooldown
            atk_cd = 6;

            // tick cooldowns for end of this tick
            if atk_cd > 0 {
                atk_cd -= 1;
            }
            if thrall_cd > 0 {
                thrall_cd -= 1;
            }

            break; // spec is done; move to finish phase
        } else {
            // Weapon still on cooldown:
            // only thrall can hit while we wait.
            current_ticks += 1;

            let mut total_hit = 0;

            if thrall_cd == 0 {
                total_hit += hit_generator.get_thrall_hit(rng, thrall_dmg);
                thrall_cd = 4;
            }

            hp_mutta -= total_hit;

            if atk_cd > 0 {
                atk_cd -= 1;
            }
            if thrall_cd > 0 {
                thrall_cd -= 1;
            }
        }
    }

    // =========================
    // Phase 3: finish it off (CDs persist from spec)
    // =========================
    while hp_mutta > 0 {
        current_ticks += 1;

        let mut total_hit = 0;

        // main attack (normal style again, using same atk_cd timeline)
        if atk_cd == 0 {
            total_hit += if is_small_mutta {
                hit_generator.get_small_mutta_hit(rng, best_thr_mutta, best_style_mutta.max_hit)
            } else {
                hit_generator.get_large_mutta_hit(rng, best_thr_mutta, best_style_mutta.max_hit)
            };
            atk_cd = best_style_mutta.attack_speed;
        }

        // thrall hit
        if thrall_cd == 0 {
            total_hit += hit_generator.get_thrall_hit(rng, thrall_dmg);
            thrall_cd = 4;
        }

        hp_mutta -= total_hit;

        if atk_cd > 0 {
            atk_cd -= 1;
        }
        if thrall_cd > 0 {
            thrall_cd -= 1;
        }
    }

    total_ticks += current_ticks - 3;
    total_ticks
}

fn sim_chop_tree_with_generator(
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
    hit_generator: &mut HitGenerator,
) -> (i32, i32) {
    // Chop the tree, possibly hitting small mutta as you go
    let mut current_ticks = 0;
    while tree_hp > 0 {
        // tree roll
        current_ticks += 1;
        let tree_hit = if (current_ticks - 1) % 5 == 0 {
            sample_hit_if(rng, tree_thr, player.combat_stats.woodcutting)
        } else {
            0
        };

        // Small mutta can be hit if it's above half HP
        let tick_index = current_ticks - 1;
        let can_attack_tick = tick_index % best_style_small_mutta.attack_speed == 0;
        let small_above_threshold =
            base_small_mutta_hp / 2 < best_style_small_mutta.max_hit + hp_small_mutta;

        let hit = if can_attack_tick && small_above_threshold {
            hit_generator.get_small_mutta_hit(rng, small_mutta_thr, best_style_small_mutta.max_hit)
        } else {
            0
        };

        let thrall_hit = if tick_index % 4 == 0 && small_above_threshold {
            hit_generator.get_thrall_hit(rng, thrall_dmg)
        } else {
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
        let tick_index = current_ticks - 1;
        let can_attack_tick = tick_index % best_style_small_mutta.attack_speed == 0;

        let hit = if can_attack_tick {
            hit_generator.get_small_mutta_hit(rng, small_mutta_thr, best_style_small_mutta.max_hit)
        } else {
            0
        };

        let thrall_hit = if tick_index % 4 == 0 {
            hit_generator.get_thrall_hit(rng, thrall_dmg)
        } else {
            0
        };

        hp_small_mutta -= hit + thrall_hit;
    }
    total_ticks += current_ticks;
    (total_ticks, (phase_ticks + 1))
}

// =========================
// Test function with threshold debugging
// =========================

pub fn test_mutta_thresholds(payload_json: &str) -> String {
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    // Try to load hardcoded hits from a separate file
    let hardcoded_hits = load_hardcoded_hits();

    let mut player = payload.player;
    let mut monsters = payload.room.monsters;
    let trials = 1usize;

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
                return "{\"error\": \"Zamorak godsword not found in inventory\"}".to_string();
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

    // Debug print thresholds
    println!("=== THRESHOLD DEBUG INFO ===");
    println!("Small Mutta:");
    println!("  Accuracy: {:.4}", best_style_small_mutta.accuracy);
    println!("  Threshold (u32): {}", small_mutta_thr);
    println!("  Max Hit: {}", best_style_small_mutta.max_hit);
    println!("  Attack Speed: {}", best_style_small_mutta.attack_speed);
    
    println!("Large Mutta:");
    println!("  Accuracy: {:.4}", best_style_large_mutta.accuracy);
    println!("  Threshold (u32): {}", large_mutta_thr);
    println!("  Max Hit: {}", best_style_large_mutta.max_hit);
    println!("  Attack Speed: {}", best_style_large_mutta.attack_speed);
    
    println!("Tree:");
    println!("  WC Level: {}", wc_level);
    println!("  Tree Accuracy: {:.4}", tree_accuracy);
    println!("  Tree Threshold (u32): {}", tree_thr);
    println!("  Tree HP: {}", base_tree_hp);
    
    if let Some(zgs_style) = &zgs_best_style {
        println!("ZGS:");
        println!("  Accuracy: {:.4}", zgs_style.accuracy);
        println!("  Threshold (u32): {}", zgs_thr);
        println!("  Max Hit: {}", zgs_style.max_hit);
    }
    
    println!("=== THRESHOLD VALUES AS PERCENTAGES ===");
    println!("Small Mutta hit chance: {:.2}%", (small_mutta_thr as f64 / u32::MAX as f64) * 100.0);
    println!("Large Mutta hit chance: {:.2}%", (large_mutta_thr as f64 / u32::MAX as f64) * 100.0);
    println!("Tree hit chance: {:.2}%", (tree_thr as f64 / u32::MAX as f64) * 100.0);
    if zgs_best_style.is_some() {
        println!("ZGS hit chance: {:.2}%", (zgs_thr as f64 / u32::MAX as f64) * 100.0);
    }

    // Print hardcoded hits info
    if let Some(ref hardcoded) = hardcoded_hits {
        println!("=== HARDCODED HITS DETECTED ===");
        println!("Small Mutta hits: {} values", hardcoded.small_mutta_hits.len());
        println!("Thrall hits: {} values", hardcoded.mutta_thrall_hits.len());
        println!("Large Mutta hits: {} values", hardcoded.large_mutta_hits.len());
        println!("ZGS Spec hits: {} values", hardcoded.zgs_spec_hits.len());
        
        if !hardcoded.small_mutta_hits.is_empty() {
            println!("Small Mutta hits preview: {:?}", &hardcoded.small_mutta_hits[..hardcoded.small_mutta_hits.len().min(10)]);
        }
        if !hardcoded.mutta_thrall_hits.is_empty() {
            println!("Thrall hits preview: {:?}", &hardcoded.mutta_thrall_hits[..hardcoded.mutta_thrall_hits.len().min(10)]);
        }
        if !hardcoded.large_mutta_hits.is_empty() {
            println!("Large Mutta hits preview: {:?}", &hardcoded.large_mutta_hits[..hardcoded.large_mutta_hits.len().min(10)]);
        }
        if !hardcoded.zgs_spec_hits.is_empty() {
            println!("ZGS Spec hits preview: {:?}", &hardcoded.zgs_spec_hits[..hardcoded.zgs_spec_hits.len().min(10)]);
        }
    } else {
        println!("=== USING RANDOM GENERATION ===");
    }
    println!("=============================");

    // Build histogram + running sum instead of storing all tick counts
    let mut freq: Vec<usize> = Vec::new();
    let mut sum_ticks: i64 = 0;
    let mut phase_results: Vec<i32> = vec![0; trials];
    let thrall_dmg = Uniform::new_inclusive(0, 3);

    let death_animation = 4;
    let post_room_delay = 4;
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

    for i in 0..trials {
        // Create a new hit generator for each trial
        let mut hit_generator = HitGenerator::new(hardcoded_hits.clone());
        
        let mut hp_large_mutta = base_large_mutta_hp;
        let hp_small_mutta = base_small_mutta_hp;
        let tree_hp = base_tree_hp;

        let mut total_ticks = 10;
        // Remove RNG for deterministic results - assume no overkill for consistency
        // let overkill_large_mutta = 0;
        // let tick_cycle_offset = rng.gen_range(0..=4);
        let tick_cycle_offset = 0;

        if has_zgs {
            total_ticks = sim_freeze_mutta_with_generator(
                total_ticks,
                hp_small_mutta,
                &monsters[0],
                &best_style_small_mutta,
                zgs_best_style.as_ref().unwrap(),
                &mut rng,
                small_mutta_thr,
                zgs_thr,
                &thrall_dmg,
                &mut hit_generator,
                true, // is_small_mutta
            );
            total_ticks += 1 + hit_delay_small_mutta;
            total_ticks += 4;
            total_ticks += tick_cycle_offset;
            println!("Total ticks after small mutta phase: {}", total_ticks);

            // Large mutta leaving the lake
            total_ticks += 5;

            total_ticks = sim_freeze_mutta_with_generator(
                total_ticks,
                hp_large_mutta,
                &monsters[1],
                &best_style_large_mutta,
                zgs_best_style.as_ref().unwrap(),
                &mut rng,
                large_mutta_thr,
                zgs_thr,
                &thrall_dmg,
                &mut hit_generator,
                false, // is_small_mutta
            );
            phase_results[i] = 0;
        } else {
            let (new_total_ticks, phase_ticks) = sim_chop_tree_with_generator(
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
                &mut hit_generator,
            );
            phase_results[i] = phase_ticks;
            total_ticks = new_total_ticks;

            total_ticks += 1 + hit_delay_small_mutta;
            total_ticks += tick_cycle_offset;

            // Large mutta leaving the lake
            total_ticks += 5;
            total_ticks += 1; // doofus missed a tick

            // Large Mutta finish phase using cooldown helper
            let phase_ticks = tick_until_dead_with_generator(
                &mut rng,
                &mut hp_large_mutta,
                attack_speed_large_mutta,
                large_mutta_thr,
                best_style_large_mutta.max_hit,
                4,
                &thrall_dmg,
                &mut hit_generator,
                false, // is_small_mutta
            );
            total_ticks += phase_ticks;
        }
        total_ticks += 1 + hit_delay + death_animation;
        println!("Total ticks after all phases: {}", total_ticks);
        total_ticks += 1474; // walking time
        // Align to next 4-tick cycle starting at the tick_cycle_offset
        println!("Total ticks before alignment: {}", total_ticks);
        let alignment = (tick_cycle_offset + 4 - (total_ticks % 4)) % 4;
        println!("Alignment needed: {}", alignment);
        total_ticks += (tick_cycle_offset + 4 - (total_ticks % 4)) % 4;
        println!("Total ticks after alignment: {}", total_ticks);
        total_ticks += post_room_delay;
        println!("Total ticks after room delay: {}", total_ticks);

        sum_ticks += total_ticks as i64;
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

fn load_hardcoded_hits() -> Option<HardcodedHits> {
    // Try to load from hardcoded_hits.json in current directory
    if let Ok(content) = fs::read_to_string("/home/synderis/Documents/github_repos/speedrunners-of-osrs/frontend/wasm-lib/cm_cox/src/bin/hardcoded_hits.json") {
        if let Ok(hits) = serde_json::from_str::<HardcodedHits>(&content) {
            println!("Loaded hardcoded hits from hardcoded_hits.json");
            return Some(hits);
        }
    }
    None
}

// =========================
// Main function for CLI
// =========================

fn main() {
    // Load player data
    let player_json = match fs::read_to_string("/home/synderis/Documents/github_repos/speedrunners-of-osrs/frontend/wasm-lib/cm_cox/src/bin/test_payload_player.json") {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Failed to read player file: {}", e);
            std::process::exit(1);
        }
    };

    // Load room data
    let rooms_json = match fs::read_to_string("/home/synderis/Documents/github_repos/speedrunners-of-osrs/frontend/wasm-lib/cm_cox/src/bin/test_payload_rooms.json") {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Failed to read rooms file: {}", e);
            std::process::exit(1);
        }
    };

    // Parse both JSON files
    let player_data: serde_json::Value = match serde_json::from_str(&player_json) {
        Ok(data) => data,
        Err(e) => {
            eprintln!("Failed to parse player JSON: {}", e);
            std::process::exit(1);
        }
    };

    let rooms_data: serde_json::Value = match serde_json::from_str(&rooms_json) {
        Ok(data) => data,
        Err(e) => {
            eprintln!("Failed to parse rooms JSON: {}", e);
            std::process::exit(1);
        }
    };

    // Combine into the expected payload format
    let combined_payload = serde_json::json!({
        "player": player_data["player"],
        "room": rooms_data["mutta"]["room"],
        "config": player_data["config"]
    });

    let payload_json = combined_payload.to_string();
    test_mutta_thresholds(&payload_json);
    // println!("{}", result);
}