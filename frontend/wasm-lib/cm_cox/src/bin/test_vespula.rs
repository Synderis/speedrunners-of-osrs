use std::fs;
use rand::prelude::*;
use rand::rngs::SmallRng;
use rand::SeedableRng;
use osrs_shared_types::*;
use osrs_shared_functions::*;
use serde::{Deserialize, Serialize};

// =========================
// Custom payload with hit lists
// =========================

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct HardcodedHits {
    pub vespula_hits: Vec<i32>,
}

// =========================
// Hit generator for hardcoded hits
// =========================

struct HitGenerator {
    vespula_hits: Option<Vec<i32>>,
    vespula_index: usize,
}

impl HitGenerator {
    fn new(hardcoded_hits: Option<HardcodedHits>) -> Self {
        match hardcoded_hits {
            Some(hits) => HitGenerator {
                vespula_hits: Some(hits.vespula_hits),
                vespula_index: 0,
            },
            None => HitGenerator {
                vespula_hits: None,
                vespula_index: 0,
            },
        }
    }

    fn get_vespula_hit<R: Rng>(&mut self, _rng: &mut R, _accuracy: f64, _max_hit: i32) -> i32 {
        if let Some(ref hits) = self.vespula_hits {
            if self.vespula_index < hits.len() {
                let hit = hits[self.vespula_index];
                self.vespula_index += 1;
                return hit;
            } else {
                panic!("Exhausted hardcoded vespula hits! Needed hit #{}, but only {} available", self.vespula_index + 1, hits.len());
            }
        }
        panic!("No hardcoded vespula hits available, but RNG fallback disabled");
    }
}

// =========================
// Test function for Vespula
// =========================

pub fn test_vespula_thresholds(payload_json: &str) -> String {
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };

    // Try to load hardcoded hits from a separate file
    let hardcoded_hits = load_hardcoded_hits();

    let player = payload.player;
    let mut monsters = payload.room.monsters;

    // Fast RNG with variability
    let mut rng = SmallRng::from_entropy();

    for monster in &mut monsters {
        if player.combat_stats.hitpoints != 99 {
            monster.skills.hp = monster_hp_scaling(monster, &player.combat_stats);
        }
        monster.skills = monster_stat_scaling(monster, player.combat_stats.hitpoints);
    }

    // Defensive: Check monsters
    if monsters.is_empty() {
        return "{\"error\": \"Vespula simulation requires at least one monster\"}".to_string();
    }

    let best_style = find_best_combat_style(&player, &monsters[0], vec!["magic".to_string(), "ranged".to_string()]);
    let max_hit = best_style.max_hit;
    let accuracy = best_style.accuracy;
    let attack_speed = best_style.attack_speed;
    let base_hp = monsters[0].skills.hp;
    let mut single_monster_ticks : Vec<f64> = Vec::new();
    
    // Add missing delays from main simulation
    let walk_delay = 32;
    let death_animation = 4;
    let hit_delay = if best_style.gear_type == "ranged" { 2 } else if best_style.gear_type == "magic" && player.gear_sets.mage.selected_weapon.as_ref().unwrap().name == "Tumeken's shadow" { 5 } else { 4 };

    // Detect Zaryte Crossbow in inventory
    let inventory_items: Vec<SelectedItem> = player
        .inventory
        .iter()
        .filter_map(|item| item.equipment.clone())
        .collect();
    let zaryte_crossbow = inventory_items.iter().any(|item| item.name == "Zaryte crossbow");

    // Debug print thresholds
    println!("=== THRESHOLD DEBUG INFO ===");
    println!("Vespula:");
    println!("  Accuracy: {:.4}", accuracy);
    println!("  Max Hit: {}", max_hit);
    println!("  Attack Speed: {}", attack_speed);
    println!("  HP: {}", base_hp);
    println!("  Hit Delay: {}", hit_delay);
    println!("  Walk Delay: {}", walk_delay);
    println!("  Death Animation: {}", death_animation);
    println!("  ZCB Present: {}", zaryte_crossbow);

    // Print hardcoded hits info
    if let Some(ref hardcoded) = hardcoded_hits {
        println!("=== HARDCODED HITS DETECTED ===");
        println!("Vespula hits: {} values", hardcoded.vespula_hits.len());
        if !hardcoded.vespula_hits.is_empty() {
            println!("Vespula hits preview: {:?}", &hardcoded.vespula_hits[..hardcoded.vespula_hits.len().min(10)]);
        }
    } else {
        println!("=== USING RANDOM GENERATION ===");
    }
    println!("=============================");

    // Build histogram + running sum instead of storing all tick counts
    let mut freq: Vec<usize> = Vec::new();
    let mut sum_ticks: i64 = 0;
    let trials = 1;

    for _ in 0..trials {
        let mut hit_generator = HitGenerator::new(hardcoded_hits.clone());
        let mut tick = 0;
        for _monster in &monsters {
            let mut hp = base_hp;
            let mut ticks_this_monster = 0;
            let mut cooldown = AttackCooldown::new();
            while hp > 0 {
                tick += 1;
                ticks_this_monster += 1;
                // ZCB spec logic: on second attack (tick == attack_speed + 1)
                if zaryte_crossbow && tick == attack_speed + 1 {
                    let spec_dmg = (base_hp as f64 * 0.22).floor() as i32;
                    hp -= spec_dmg;
                    cooldown.reset(attack_speed);
                    println!("[DEBUG] ZCB spec applied: {} damage on tick {} (hp now {})", spec_dmg, tick, hp);
                } else {
                    // Regular attacks using cooldown
                    if cooldown.is_ready() {
                        let hit = hit_generator.get_vespula_hit(&mut rng, accuracy, max_hit);
                        hp -= hit;
                        cooldown.reset(attack_speed);
                        println!("[DEBUG] Regular hit: {} on tick {} (hp now {})", hit, tick, hp);
                    } else {
                        cooldown.tick();
                    }
                }
                if hp <= 0 {
                    break;
                }
            }
            println!("[DEBUG] Monster defeated in {} ticks", tick);
            tick += hit_delay + 1;
            // ticks_this_monster += hit_delay;
            single_monster_ticks.push(ticks_this_monster as f64);
            println!("[DEBUG] Added hit delay: {} ticks, total monster ticks: {}", hit_delay, ticks_this_monster);
        }
        tick += walk_delay;
        println!("[DEBUG] Added walk_delay ({})", tick);
        tick += death_animation;
        println!("[DEBUG] Added death_animation ({})", tick);
        // let random_variance = rng.gen_range(0..4);
        let random_variance = 4;
        tick += random_variance;
        println!("[DEBUG] Added random variance: {} ticks", random_variance);
        sum_ticks += i64::from(tick);
        println!("[DEBUG] Final tick count Expecting 102: {}", sum_ticks);
        println!("=============================");
        let idx = tick as usize;
        if idx >= freq.len() {
            freq.resize(idx + 1, 0);
        }
        freq[idx] += 1;
    }
    // Defensive: Check tick_counts
    if freq.is_empty() {
        return "{\"error\": \"No tick counts generated\"}".to_string();
    }
    let style_list = vec![best_style.clone()];
    let end_results = results_formatter(&monsters, &style_list, sum_ticks, freq, trials, Vec::new(), Vec::new());
    end_results
}

fn load_hardcoded_hits() -> Option<HardcodedHits> {
    // Try to load from hardcoded_hits_vespula.json in current directory
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

    // Combine into the expected payload format (need vespula room)
    let combined_payload = serde_json::json!({
        "player": player_data["player"],
        "room": rooms_data["vespula"]["room"],
        "config": player_data["config"]
    });

    let payload_json = combined_payload.to_string();
    test_vespula_thresholds(&payload_json);
    // println!("{}", result);
}
