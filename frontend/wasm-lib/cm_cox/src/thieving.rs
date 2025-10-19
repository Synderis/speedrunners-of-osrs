use rand::prelude::*;
use rand::rngs::SmallRng;
use rand::SeedableRng;
use wasm_bindgen::prelude::*;
use osrs_shared_types::*;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[inline]
fn to_threshold(p: f64) -> u32 {
    (p.clamp(0.0, 1.0) * (u32::MAX as f64)) as u32
}

#[derive(Clone, PartialEq)]
enum ChestState {
    Idle,
    TravelingToChest,
    OpeningChest,
    TravelingToDump,
}

struct ScavengerSimulation {
    // params
    success_thr: u32,   // 🔧 threshold form of success_rate
    grub_max: i32,

    // Constants
    chest_open_speed: i32,
    chest_travel_time: i32,
    dump_travel_time: i32,
    post_dump_walk_delay: i32,

    // State
    hp: i32,
    scavenger_grubs: i32,
    player_grubs: i32,
    tick: i32,
    eating_timer: i32,
    chest_state: ChestState,
    current_chest: i32,
    chest_timer: i32,
    chest_attempts: i32,
    pre_dump_walk_delay: i32,
}

impl ScavengerSimulation {
    fn new(success_rate: f64, grub_max: i32) -> Self {
        Self {
            success_thr: to_threshold(success_rate),
            grub_max,
            chest_open_speed: 2,
            chest_travel_time: 2,
            dump_travel_time: 3,
            post_dump_walk_delay: 3,
            hp: 30,
            scavenger_grubs: 0,
            player_grubs: 0,
            tick: 0,
            eating_timer: 0,
            chest_state: ChestState::Idle,
            current_chest: 0,
            chest_timer: 0,
            chest_attempts: 0,
            pre_dump_walk_delay: 0,
        }
    }

    fn reset_trial(&mut self, rng: &mut SmallRng) {
        self.hp = 30;
        self.scavenger_grubs = 0;
        self.player_grubs = 0;
        self.tick = 0;
        self.eating_timer = 0;
        self.chest_state = ChestState::Idle;
        self.current_chest = 0;
        self.chest_timer = 0;
        self.chest_attempts = 0;

        // Base delay
        let mut base_delay = 17;

        // Add 1 with 1/3 chance
        if rng.next_u32() % 3 == 0 {
            base_delay += 1;
        }

        // Add one of 0,3,5,8 equally
        let additional_delays = [0, 3, 5, 8];
        let additional_delay = additional_delays[(rng.next_u32() % 4) as usize];
        if additional_delay == 0 && base_delay == 18 {
            base_delay -= 1; // Adjust for 0 case
        }

        self.pre_dump_walk_delay = base_delay + additional_delay + 2;
    }

    fn attempt_chest(&mut self, rng: &mut SmallRng) -> bool {
        self.chest_attempts += 1;
        if rng.next_u32() <= self.success_thr {
            // ensure at least 2
            let gained = rng.gen_range(1..=self.grub_max).max(2);
            self.player_grubs += gained;
            true
        } else {
            false
        }
    }

    fn scavenger_eat_tick(&mut self) {
        // Always increment eating timer
        self.eating_timer += 1;

        // Eat only if there are grubs and on the 3-tick cadence
        if self.scavenger_grubs > 0 && self.eating_timer % 3 == 0 {
            if self.scavenger_grubs >= 15 {
                self.hp -= 2;
                self.scavenger_grubs -= 2;
            } else {
                self.hp -= 1;
                self.scavenger_grubs -= 1;
            }
        }
    }

    fn dump_grubs(&mut self, travel_time: Option<i32>, _reset_timer: bool) {
        if let Some(time) = travel_time {
            self.tick += time;
        }
        self.tick += 1; // dump action
        self.scavenger_grubs += self.player_grubs;
        self.player_grubs = 0;
        // eating_timer cadence continues (no reset)
    }

    fn has_enough_grubs(&self) -> bool {
        (self.scavenger_grubs + self.player_grubs) >= self.hp
    }

    fn calculate_finish_time(&self) -> i32 {
        let mut remaining_hp = self.hp;
        let mut current_grubs = self.scavenger_grubs;
        let mut eating_ticks = 0;
        let mut temp_eating_timer = self.eating_timer;

        while remaining_hp > 0 && current_grubs > 0 {
            eating_ticks += 1;
            temp_eating_timer += 1;
            if temp_eating_timer % 3 == 0 {
                if current_grubs >= 15 {
                    remaining_hp -= 2;
                    current_grubs -= 2;
                } else {
                    remaining_hp -= 1;
                    current_grubs -= 1;
                }
            }
        }

        eating_ticks
    }

    fn do_initial_chests(&mut self, rng: &mut SmallRng) {
        for _ in 0..3 {
            loop {
                self.tick += self.chest_open_speed;
                if self.attempt_chest(rng) {
                    break;
                }
            }
        }

        // Travel to dump and dump grubs
        self.dump_grubs(Some(self.pre_dump_walk_delay), true);
    }

    fn update_chest_run(&mut self, rng: &mut SmallRng) -> bool {
        match self.chest_state {
            ChestState::Idle => {
                self.chest_state = ChestState::TravelingToChest;
                self.current_chest = 0;
                self.chest_timer = 0;
                false
            }
            ChestState::TravelingToChest => {
                self.chest_timer += 1;
                let travel_time = if self.current_chest == 0 {
                    self.post_dump_walk_delay
                } else {
                    self.chest_travel_time
                };

                if self.chest_timer >= travel_time {
                    self.chest_state = ChestState::OpeningChest;
                    self.chest_timer = 0;
                }
                false
            }
            ChestState::OpeningChest => {
                self.chest_timer += 1;

                if self.chest_timer >= self.chest_open_speed {
                    if self.attempt_chest(rng) {
                        // Check if we can finish now
                        if self.has_enough_grubs() {
                            return self.finish_mid_chest_run();
                        }

                        // Move to next chest
                        self.current_chest += 1;
                        if self.current_chest >= 3 {
                            self.chest_state = ChestState::TravelingToDump;
                        } else {
                            self.chest_state = ChestState::TravelingToChest;
                        }
                        self.chest_timer = 0;
                    } else {
                        // Failed - try again
                        self.chest_timer = 0;
                    }
                }
                false
            }
            ChestState::TravelingToDump => {
                self.chest_timer += 1;

                if self.chest_timer >= self.dump_travel_time {
                    self.dump_grubs(None, false);
                    self.chest_state = ChestState::Idle;
                    self.chest_timer = 0;
                }
                false
            }
        }
    }

    fn finish_mid_chest_run(&mut self) -> bool {
        let travel_time = self.post_dump_walk_delay;
        self.tick += travel_time;
        self.eating_timer += travel_time;

        // Eating during travel
        for _ in 0..travel_time {
            if self.eating_timer % 3 == 0 && self.scavenger_grubs > 0 {
                if self.scavenger_grubs >= 15 {
                    self.hp -= 2;
                    self.scavenger_grubs -= 2;
                } else {
                    self.hp -= 1;
                    self.scavenger_grubs -= 1;
                }
            }
            self.eating_timer += 1;
        }

        self.scavenger_grubs += self.player_grubs;
        self.player_grubs = 0;

        // Finish with remaining eating time
        self.tick += self.calculate_finish_time();
        true
    }

    fn finish_encounter(&mut self) -> bool {
        if self.player_grubs > 0 {
            // If no grubs eaten yet, you still travel to dump as needed
            let travel_time = if self.scavenger_grubs == 0 {
                Some(self.dump_travel_time)
            } else {
                Some(0)
            };
            self.dump_grubs(travel_time, false);
        }

        self.tick += self.calculate_finish_time();
        true
    }

    fn run_trial(&mut self, rng: &mut SmallRng) -> (i32, i32) {
        self.reset_trial(rng);
        self.do_initial_chests(rng);

        while self.hp > 0 {
            // Check if we can finish
            if self.has_enough_grubs() {
                self.finish_encounter();
                break;
            }

            // Scavenger eating cadence
            self.scavenger_eat_tick();

            // Update chest run
            if self.update_chest_run(rng) {
                break;
            }

            self.tick += 1;
        }

        // Align-ish to a cycle with a small random jitter like your original
        self.tick += rng.gen_range(0..4);

        (self.tick, self.chest_attempts)
    }
}

#[wasm_bindgen]
pub fn calculate_dps_with_objects_thieving(payload_json: &str) -> String {
    // Parse payload
    let payload: DPSRoomPayload = match serde_json::from_str(payload_json) {
        Ok(p) => p,
        Err(e) => {
            return format!("{{\"error\": \"Failed to parse payload data: {}\"}}", e);
        }
    };
    let player = payload.player;
    let room_methods = payload.room.methods;
    let trials = 100_000usize;

    // Fast RNG with variability
    let mut rng = SmallRng::from_entropy();

    let thieving_level = player.combat_stats.thieving;
    let lockpick = room_methods.contains(&"Lockpick".to_string());

    // Success rates
    let base_success_rate =
        (1.0 + ((((99.0 * (99.0 - thieving_level as f64)) / 98.0)
            + ((155.0 * (thieving_level as f64 - 1.0)) / 98.0)
            + 0.5) as i32) as f64)
            / 256.0;

    let lockpick_success_rate =
        (1.0 + ((((153.0 * (99.0 - thieving_level as f64)) / 98.0)
            + ((209.0 * (thieving_level as f64 - 1.0)) / 98.0)
            + 0.5) as i32) as f64)
            / 256.0;

    let success_rate = if lockpick {
        lockpick_success_rate
    } else {
        base_success_rate
    };

    // Grubs max by level
    let mut max_grubs = 1;
    if thieving_level > 50 { max_grubs += 1; }
    if thieving_level > 75 { max_grubs += 1; }
    if thieving_level >= 100 { max_grubs += 1; }

    let mut sim = ScavengerSimulation::new(success_rate, max_grubs);

    // Run trials
    let mut tick_counts: Vec<i32> = vec![0; trials];
    let mut phase_list: Vec<i32> = vec![0; trials];

    for i in 0..trials {
        let (ticks, chest_attempts) = sim.run_trial(&mut rng);
        tick_counts[i] = ticks;
        phase_list[i] = chest_attempts;
    }

    // Mean
    let mean_ttk = tick_counts.iter().map(|&t| t as i64).sum::<i64>() as f64 / trials as f64;

    // CDF via histogram (O(N))
    let max_ticks = *tick_counts.iter().max().unwrap_or(&0);
    let mut freq = vec![0usize; (max_ticks + 1) as usize];
    for &t in &tick_counts {
        freq[t as usize] += 1;
    }
    let mut encounter_kill_times_obj = Vec::with_capacity(freq.len());
    let mut running = 0usize;
    for (tick, count) in freq.into_iter().enumerate() {
        running += count;
        let prob = running as f64 / trials as f64;
        encounter_kill_times_obj.push(serde_json::json!({
            "tick": tick as i32,
            "probability": prob
        }));
    }

    let expected_ttk = mean_ttk;
    let expected_seconds = mean_ttk * 0.6;

    // No per-monster results for this room
    let results: Vec<serde_json::Value> = vec![];

    serde_json::json!({
        "results": results,
        "total_expected_ticks": expected_ttk,
        "total_expected_seconds": expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj,
        "phase_results": phase_list,
    }).to_string()
}
