use rand::prelude::*;
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

#[derive(Clone, PartialEq)]
enum ChestState {
    Idle,
    TravelingToChest,
    OpeningChest,
    TravelingToDump,
}

struct ScavengerSimulation {
    success_rate: f64,
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
        let mut sim = Self {
            success_rate,
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
        };
        sim.reset_trial(&mut rand::thread_rng());
        sim
    }
    
    fn reset_trial(&mut self, rng: &mut ThreadRng) {
        self.hp = 30;
        self.scavenger_grubs = 0;
        self.player_grubs = 0;
        self.tick = 0;
        self.eating_timer = 0;
        self.chest_state = ChestState::Idle;
        self.current_chest = 0;
        self.chest_timer = 0;
        self.chest_attempts = 0;
        
        // Calculate random pre_dump_walk_delay for this trial
        let mut base_delay = 17;
        
        // Add 1 with 1/3 chance
        if rng.gen::<f64>() < 1.0/3.0 {
            base_delay += 1;
        }
        
        // Add one of 3, 5, or 8 with equal chance
        let additional_delays = [3, 5, 8];
        let additional_delay = additional_delays[rng.gen_range(0..3)];
        
        self.pre_dump_walk_delay = base_delay + additional_delay + 2 + 4;
    }
    
    fn attempt_chest(&mut self, rng: &mut ThreadRng) -> bool {
        self.chest_attempts += 1;
        if rng.gen::<f64>() < self.success_rate {
            let grubs_gained = (rng.gen_range(1..=self.grub_max)).max(2);
            self.player_grubs += grubs_gained;
            true
        } else {
            false
        }
    }
    
    fn scavenger_eat_tick(&mut self) {
        // Always increment eating timer (cycle continues even with no grubs)
        self.eating_timer += 1;
        
        // Only eat if there are grubs available
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
    
    fn dump_grubs(&mut self, travel_time: Option<i32>, reset_timer: bool) {
        if let Some(time) = travel_time {
            self.tick += time;
        }
        self.tick += 1; // Time to dump
        
        self.scavenger_grubs += self.player_grubs;
        self.player_grubs = 0;
        
        // Only reset timer for the very first dump
        if reset_timer && self.eating_timer == 0 {
            self.eating_timer = 0;
        }
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
    
    fn do_initial_chests(&mut self, rng: &mut ThreadRng) {
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
    
    fn update_chest_run(&mut self, rng: &mut ThreadRng) -> bool {
        match self.chest_state {
            ChestState::Idle => {
                self.chest_state = ChestState::TravelingToChest;
                self.current_chest = 0;
                self.chest_timer = 0;
                false
            },
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
            },
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
            },
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
        
        // Process eating during travel
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
        
        // Calculate remaining eating time
        self.tick += self.calculate_finish_time();
        true
    }
    
    fn finish_encounter(&mut self) -> bool {
        if self.player_grubs > 0 {
            // Never reset the timer - scavenger maintains its eating cycle
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
    
    fn run_trial(&mut self, rng: &mut ThreadRng) -> (i32, i32) {
        self.reset_trial(rng);
        self.do_initial_chests(rng);
        
        while self.hp > 0 {
            // Check if we can finish
            if self.has_enough_grubs() {
                self.finish_encounter();
                break;
            }
            
            // Process scavenger eating
            self.scavenger_eat_tick();
            
            // Update chest run
            if self.update_chest_run(rng) {
                break;
            }
            
            self.tick += 1;
        }
        
        // Align to next 4-tick cycle
        self.tick += 4 - (self.tick % 4);
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
    let trials = 100000;
    let mut rng = rand::thread_rng();
    
    let thieving_level = player.combat_stats.thieving;
    let lockpick = room_methods.contains(&"Lockpick".to_string());

    // Calculate success rates
    let base_success_rate = (1.0 + ((((99.0 * (99.0 - thieving_level as f64)) / 98.0) + 
                                   ((155.0 * (thieving_level as f64 - 1.0)) / 98.0) + 0.5) as i32) as f64) / 256.0;
    let lockpick_success_rate = (1.0 + ((((153.0 * (99.0 - thieving_level as f64)) / 98.0) + 
                                        ((209.0 * (thieving_level as f64 - 1.0)) / 98.0) + 0.5) as i32) as f64) / 256.0;
    
    let success_rate = if lockpick {
        lockpick_success_rate
    } else {
        base_success_rate
    };
    
    // Calculate max grubs based on thieving level
    let mut max_grubs = 1;
    if thieving_level > 50 {
        max_grubs += 1;
    }
    if thieving_level > 75 {
        max_grubs += 1;
    }
    if thieving_level >= 100 {
        max_grubs += 1;
    }
    
    let mut sim = ScavengerSimulation::new(success_rate, max_grubs);
    let mut tick_counts: Vec<i32> = vec![0; trials];
    let mut phase_list: Vec<i32> = vec![0; trials];
    
    for i in 0..trials {
        let (ticks, chest_attempts) = sim.run_trial(&mut rng);
        tick_counts[i] = ticks;
        phase_list[i] = chest_attempts;
    }
    
    let mean_ttk = tick_counts.iter().sum::<i32>() as f64 / trials as f64;
    let max_ticks = *tick_counts.iter().max().unwrap_or(&0);
    
    let mut kill_prob = vec![0.0f64; (max_ticks + 1) as usize];
    for &ticks in &tick_counts {
        for idx in ticks..=max_ticks {
            kill_prob[idx as usize] += 1.0;
        }
    }
    for prob in &mut kill_prob {
        *prob /= trials as f64;
    }
    
    let kill_prob_by_tick = kill_prob.clone();
    let tick_list: Vec<i32> = (0..=max_ticks).collect();
    
    // Create encounter kill times
    let encounter_kill_times_obj: Vec<serde_json::Value> = kill_prob_by_tick.iter().enumerate()
        .map(|(idx, &prob)| {
            serde_json::json!({
                "tick": tick_list[idx],
                "probability": prob
            })
        })
        .collect();
    
    let expected_ttk = mean_ttk;
    let expected_seconds = mean_ttk * 0.6;
    
    // Create results (empty for scavenger room since it's not a traditional monster)
    let results: Vec<serde_json::Value> = vec![];
    serde_json::json!({
        "results": results,
        "total_expected_ticks": expected_ttk,
        "total_expected_seconds": expected_seconds,
        "encounter_kill_times": encounter_kill_times_obj,
        "phase_results": phase_list,
    }).to_string()
}