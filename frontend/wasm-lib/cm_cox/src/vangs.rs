use rand::prelude::*;
use rand::rngs::SmallRng;
use rand::SeedableRng;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;
use osrs_shared_functions::*;
use rand::distributions::{Uniform, Distribution};

#[wasm_bindgen]
pub fn calculate_dps_with_objects_vangs(payload_json: &str) -> String {
    const VANG_TYPES: [&str; 3] = ["mage", "melee", "ranged"];
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
	let _room_methods = payload.room.methods;
	let spec_count_dict = payload.room.special_attacks;
	let mut spec_count_max = 0;
	let trials = 100000;

	// 🔧 Faster, WASM-friendly RNG with entropy
	let mut rng = SmallRng::from_entropy();
	let thrall_dmg = Uniform::new_inclusive(0, 3);

	// Defensive: Check monsters
	if monsters.len() < 3 {
		return "{\"error\": \"Not enough monsters in payload\"}".to_string();
	}

	// Precompute best styles and static data
	let best_styles = [
		find_best_combat_style(&player, &monsters[0], vec!["magic".to_string()]),
		find_best_combat_style(&player, &monsters[1], vec!["melee".to_string()]),
		find_best_combat_style(&player, &monsters[2], vec!["ranged".to_string()]),
	];
	let best_style_spec = find_best_combat_style(&player, &monsters[1], vec!["melee".to_string()]);
	let inventory_items: Vec<SelectedItem> = player
		.inventory
		.iter()
		.filter_map(|item| item.equipment.clone())
		.collect();
	let burning_claws = inventory_items.iter().any(|item| item.name == "Burning claws");
	let voidwaker = inventory_items.iter().any(|item| item.name == "Voidwaker");
	let weapon_name = player.gear_sets.melee.selected_weapon.as_ref().unwrap().name.clone();

	if burning_claws {
		spec_count_max = spec_count_dict
			.as_ref()
			.and_then(|vec| vec.iter().find(|sa| sa.name == "Burning claws").map(|sa| sa.count))
			.unwrap_or(3);
		ensure_weapon_swap(&mut player, "Burning claws", None);
	}
	if voidwaker {
		spec_count_max = spec_count_dict
			.as_ref()
			.and_then(|vec| vec.iter().find(|sa| sa.name == "Voidwaker").map(|sa| sa.count))
			.unwrap_or(2);
		let defender = match find_defender(&inventory_items) {
			Some(def) => def,
			None => return "{\"error\": \"Please add a defender to the inventory items\"}".to_string(),
		};
		ensure_weapon_swap(&mut player, "Voidwaker", Some(defender));
	}

	// Precompute per-vang arrays for hot loop
	let max_hp = monsters[0].skills.hp;
	let hp_reset_threshold = (max_hp as f64 * 0.4) as i32;
	let max_hits = [best_styles[0].max_hit, best_styles[1].max_hit, best_styles[2].max_hit, best_style_spec.max_hit];
	let accuracies = [best_styles[0].accuracy, best_styles[1].accuracy, best_styles[2].accuracy, best_style_spec.accuracy];
	let attack_speeds = [best_styles[0].attack_speed, best_styles[1].attack_speed, best_styles[2].attack_speed, best_style_spec.attack_speed];
	let hit_delay_map = [
		if player.gear_sets.mage.selected_weapon.as_ref().unwrap().name == "Tumeken's shadow" { 2 } else { 1 },
		0,
		1,
	];
	let to_threshold = |p: f64| -> u32 { (p.clamp(0.0, 1.0) * (u32::MAX as f64)) as u32 };
	let spec_threshold = to_threshold(accuracies[3]);

	// Map vang type to index for array access
	fn vang_idx(s: &str) -> usize {
		match s {
			"mage" => 0,
			"melee" => 1,
			"ranged" => 2,
			_ => panic!("Invalid vang type"),
		}
	}

	let mut phase_list: Vec<i32> = Vec::with_capacity(trials);
	let mut freq: Vec<usize> = Vec::new();
	let mut sum_ticks: i64 = 0;
	let walk_delay = 18;
	let death_animation = 4;
	let post_room_delay = 4;

	for _ in 0..trials {
		// Use arrays for vang HPs and avoid HashMap
		let mut vang_hps_trial = [max_hp; 3];
		let mut tick = 0;
		let mut cooldown = 0;
		let mut immune_ticks_left = 0;
		let mut next_teleport = 20;
		let mut teleport = 0;
		let mut spec_count = spec_count_max;
		let mut burns = Vec::new();
		let mut initial_burn_tick = 0;
		let mut current_attack_phase_tick = 0;
		let mut last_vang_attacked_idx = 0;

		let spawn_delay = rng.gen_range(1..=4) + 6;

		loop {
			// Exit immediately if all vangs are dead
			if vang_hps_trial.iter().all(|&hp| hp <= 0) {
				break;
			}

			// Handle teleport/immune phase
			if immune_ticks_left > 0 {
				immune_ticks_left -= 1;
				tick += 1;
				continue;
			}

			// Only check for teleport if not in immune phase
			if tick >= next_teleport {
				teleport += 1;
				immune_ticks_left = 11;
				current_attack_phase_tick = 0;
				next_teleport += 11 + rng.gen_range(20..=36);
				continue;
			}

			// Find attackable vang (sorted by highest HP)
			if tick >= cooldown {
				let mut ready_idxs: Vec<usize> = (0..3).filter(|&i| vang_hps_trial[i] > 0).collect();
				ready_idxs.sort_by_key(|&i| -vang_hps_trial[i]);
				let mut attack_idx_opt = None;
				for &i in &ready_idxs {
					// Inline can_attack_vang for arrays
					let mut new_hps = vang_hps_trial;
					new_hps[i] -= max_hits[i];
					let min_hp = *new_hps.iter().min().unwrap();
					let max_hp_v = *new_hps.iter().max().unwrap();
					let reset_threshold = (0.4 * max_hp as f64) as i32;
					if vang_hps_trial.iter().all(|&hp| hp < hp_reset_threshold)
						|| *vang_hps_trial.iter().max().unwrap() < hp_reset_threshold
						|| (max_hp_v - min_hp) <= reset_threshold
					{
						attack_idx_opt = Some(i);
						break;
					}
				}
				if let Some(attack_idx) = attack_idx_opt {
					if last_vang_attacked_idx != attack_idx {
						current_attack_phase_tick = 1;
					}
					last_vang_attacked_idx = attack_idx;
					let hit = if attack_idx == 1 && spec_count > 0 {
						cooldown = tick + attack_speeds[3];
						spec_count -= 1;
						if voidwaker {
							dmg_modifier_check(&mut rng, max_hits[3], accuracies[3], "Voidwaker")
						} else if burning_claws {
							let (hits, new_burns) = burning_barrage_special(&mut rng, max_hits[3], accuracies[3]);
							if initial_burn_tick == 0 && !new_burns.is_empty() && burns.is_empty() {
								initial_burn_tick = 1;
							}
							if !new_burns.is_empty() {
								burns.extend(new_burns);
								if burns.len() > 5 {
									burns.truncate(5);
								}
							}
							hits.iter().sum()
						} else {
							if rng.next_u32() <= spec_threshold {
								rng.gen_range(0..=max_hits[3]).max(1)
							} else {
								0
							}
						}
					} else {
						cooldown = tick + attack_speeds[attack_idx];
						if attack_idx == 1 {
							dmg_modifier_check(&mut rng, max_hits[attack_idx], accuracies[attack_idx], &weapon_name)
						} else {
							dmg_modifier_check(&mut rng, max_hits[attack_idx], accuracies[attack_idx], "Other")
						}
					};
					vang_hps_trial[attack_idx] = (vang_hps_trial[attack_idx] - hit).max(0);
				}
			}
			if initial_burn_tick > 0 && !burns.is_empty() && (initial_burn_tick - 1) % 4 == 0 {
				let melee_hp = vang_hps_trial[1];
				let new_melee_hp = apply_burns(melee_hp, &mut burns);
				vang_hps_trial[1] = new_melee_hp;
				if burns.is_empty() {
					initial_burn_tick = 0;
				}
			}
			if initial_burn_tick > 0 {
				initial_burn_tick += 1;
			}
			if immune_ticks_left == 0 {
				if (current_attack_phase_tick - 1) % 4 == 0 {
					let thrall_hit = thrall_dmg.sample(&mut rng);
					vang_hps_trial[last_vang_attacked_idx] = (vang_hps_trial[last_vang_attacked_idx] - thrall_hit).max(0);
				}
				current_attack_phase_tick += 1;
			}
			tick += 1;
		}
		let overkill = if last_vang_attacked_idx == 1 {
			1
		} else {
			let range_max = if attack_speeds[last_vang_attacked_idx] > 4 {
				4 * attack_speeds[last_vang_attacked_idx]
			} else {
				4
			};
			if rng.gen_range(1..=range_max) == 1 { 1 } else { 0 }
		};
		let hit_delay = hit_delay_map[last_vang_attacked_idx];
		tick += walk_delay + spawn_delay + hit_delay + death_animation - overkill;
		tick += rng.gen_range(0..4);
		tick += post_room_delay;
		sum_ticks += i64::from(tick);
		let idx = tick as usize;
		if idx >= freq.len() {
			freq.resize(idx + 1, 0);
		}
		freq[idx] += 1;
		phase_list.push(teleport);
	}

	// Defensive: Check freq
	if freq.is_empty() {
		return "{\"error\": \"No tick counts generated\"}".to_string();
	}

	// Use results_formatter for consistent output
	let style_list = best_styles.to_vec();
	let end_results: serde_json::Value = serde_json::from_str(&results_formatter(&monsters, &style_list, sum_ticks, freq, trials, Vec::new(), phase_list)).unwrap_or_else(|_| serde_json::json!({"error": "Failed to parse results"}));
	// Add elapsed time to output
	// end_results["elapsed_seconds"] = serde_json::json!(elapsed.as_secs_f64());
	end_results.to_string()
}