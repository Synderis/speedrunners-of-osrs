import json
import numpy as np
import json
import plotly.graph_objs as go
from helpers import *

class ScavengerSimulation:
    def __init__(self, success_rate, grub_max, thieving_level):
        self.success_rate = success_rate
        self.grub_max = grub_max
        self.thieving_level = thieving_level
        
        # Constants
        self.chest_open_speed = 2
        self.chest_travel_time = 2
        # This is chest 9 from the straight path image idk what the actual times are so this is a placeholder
        self.dump_travel_time = 3
        # This is chest 7,8,9 from the straight path image idk what the actual times are so this is a placeholder
        self.post_dump_walk_delay = 3
    
        # State
        self.reset_trial()

    def reset_trial(self):
        self.hp = 30
        self.scavenger_grubs = 0
        self.player_grubs = 0
        self.tick = 0
        self.eating_timer = 0
        self.chest_state = "idle"
        self.current_chest = 0
        self.chest_timer = 0
        self.chest_attempts = 0  # Track chest attempts for this trial
        
        # Calculate random pre_dump_walk_delay for this trial
        base_delay = 17
        
        # # Add 1 with 1/3 chance
        if np.random.rand() < 1/3:
            base_delay += 1
        
        # Add one of 3, 5, or 8 with equal chance
        additional_delay = np.random.choice([3, 5, 8])
        
        self.pre_dump_walk_delay = base_delay + additional_delay + 2

    def attempt_chest(self):
        """Attempt to open a chest, returns True if successful"""
        self.chest_attempts += 1  # Increment attempt counter
        if np.random.rand() < self.success_rate:
            self.player_grubs += max(2, np.random.randint(1, self.grub_max + 1))
            return True
        return False
    
    def scavenger_eat_tick(self):
        """Process one tick of scavenger eating"""
        # Always increment eating timer (cycle continues even with no grubs)
        self.eating_timer += 1
        
        # Only eat if there are grubs available
        if self.scavenger_grubs > 0 and self.eating_timer % 3 == 0:
            if self.scavenger_grubs >= 15:
                self.hp -= 2
                self.scavenger_grubs -= 2
            else:
                self.hp -= 1
                self.scavenger_grubs -= 1
            # Don't reset eating_timer when grubs hit 0

    def dump_grubs(self, travel_time=None, reset_timer=True):
        """Dump player grubs to scavenger trough"""
        if travel_time:
            self.tick += travel_time
        self.tick += 1  # Time to dump

        self.scavenger_grubs += self.player_grubs
        self.player_grubs = 0
        
        # Only reset timer for the very first dump
        if reset_timer and self.eating_timer == 0:
            self.eating_timer = 0
    
    def has_enough_grubs(self):
        """Check if total grubs are enough to finish"""
        return (self.scavenger_grubs + self.player_grubs) >= self.hp
    
    def calculate_finish_time(self):
        """Calculate remaining ticks to finish eating all grubs"""
        remaining_hp = self.hp
        current_grubs = self.scavenger_grubs
        eating_ticks = 0
        temp_eating_timer = self.eating_timer
        
        while remaining_hp > 0 and current_grubs > 0:
            eating_ticks += 1
            temp_eating_timer += 1
            if temp_eating_timer % 3 == 0:
                if current_grubs >= 15:
                    remaining_hp -= 2
                    current_grubs -= 2
                else:
                    remaining_hp -= 1
                    current_grubs -= 1
        
        return eating_ticks
    
    def do_initial_chests(self):
        """Do the initial 3 chest attempts"""
        for _ in range(3):
            while True:
                self.tick += self.chest_open_speed
                if self.attempt_chest():
                    break
        
        # Travel to dump and dump grubs
        self.dump_grubs(self.pre_dump_walk_delay)
    
    def update_chest_run(self):
        """Update the ongoing chest run state machine"""
        if self.chest_state == "idle":
            self.chest_state = "traveling_to_chest"
            self.current_chest = 0
            self.chest_timer = 0
        
        elif self.chest_state == "traveling_to_chest":
            self.chest_timer += 1
            travel_time = self.post_dump_walk_delay if self.current_chest == 0 else self.chest_travel_time
            
            if self.chest_timer >= travel_time:
                self.chest_state = "opening_chest"
                self.chest_timer = 0
        
        elif self.chest_state == "opening_chest":
            self.chest_timer += 1
            
            if self.chest_timer >= self.chest_open_speed:
                if self.attempt_chest():
                    # Check if we can finish now
                    if self.has_enough_grubs():
                        return self.finish_mid_chest_run()
                    
                    # Move to next chest
                    self.current_chest += 1
                    if self.current_chest >= 3:
                        self.chest_state = "traveling_to_dump"
                    else:
                        self.chest_state = "traveling_to_chest"
                    self.chest_timer = 0
                else:
                    # Failed - try again
                    self.chest_timer = 0
        
        elif self.chest_state == "traveling_to_dump":
            self.chest_timer += 1
            
            if self.chest_timer >= self.dump_travel_time:
                self.dump_grubs()
                self.chest_state = "idle"
                self.chest_timer = 0
        
        return False  # Not finished
    
    def finish_mid_chest_run(self):
        """Finish the encounter mid-chest run"""
        travel_time = self.post_dump_walk_delay
        self.tick += travel_time
        self.eating_timer += travel_time
        
        # Process eating during travel
        for _ in range(travel_time):
            if self.eating_timer % 3 == 0 and self.scavenger_grubs > 0:
                if self.scavenger_grubs >= 15:
                    self.hp -= 2
                    self.scavenger_grubs -= 2
                else:
                    self.hp -= 1
                    self.scavenger_grubs -= 1
            self.eating_timer += 1
        
        self.scavenger_grubs += self.player_grubs
        self.player_grubs = 0
        
        # Calculate remaining eating time
        self.tick += self.calculate_finish_time()
        return True
    
    def finish_encounter(self):
        """Finish the encounter normally"""
        if self.player_grubs > 0:
            # Never reset the timer - scavenger maintains its eating cycle
            self.dump_grubs(self.dump_travel_time if self.scavenger_grubs == 0 else 0, reset_timer=False)
        
        self.tick += self.calculate_finish_time()
        return True
    
    def run_trial(self):
        """Run a single trial simulation"""
        self.reset_trial()
        self.do_initial_chests()
        
        while self.hp > 0:
            # Check if we can finish
            if self.has_enough_grubs():
                self.finish_encounter()
                break
            
            # Process scavenger eating
            self.scavenger_eat_tick()
            
            # Update chest run
            if self.update_chest_run():
                break
            
            self.tick += 1
        if self.tick % 4 != 0:
            self.tick += (4 - (self.tick % 4)) # Align to next 4-tick cycle
        return self.tick, self.chest_attempts  # Return both tick count and chest attempts

def run_simulation():
    import time
    start_time = time.time()

    # Load parameters
    with open("vangs_payload.json", "r") as f:
        payload = json.load(f)
    
    player = payload["player"]
    thieving_level = player["combatStats"]["thieving"]
    lockpick = True
    base_success_rate = (1.0 + int((((99.0 * (99.0 - thieving_level)) / 98.0) + 
                                   ((155.0 * (thieving_level - 1.0)) / 98.0) + 0.5))) / 256.0
    lockpick_success_rate = (1.0 + int((((153.0 * (99.0 - thieving_level)) / 98.0) + 
                                ((209.0 * (thieving_level - 1.0)) / 98.0) + 0.5))) / 256.0
    # Calculate success rates
    if lockpick:
        success_rate = lockpick_success_rate
    else:
        success_rate = base_success_rate

    max_grubs = 1
    if thieving_level > 50:
        max_grubs += 1
    if thieving_level > 75:
        max_grubs += 1
    if thieving_level >= 100:
        max_grubs += 1

    sim = ScavengerSimulation(success_rate, max_grubs, thieving_level)

    trials = 100000
    tick_counts = []
    chest_attempt_counts = []  # Track chest attempts per trial
    
    print(f"[Sim] Starting simulation with {trials} trials...")
    
    for trial in range(trials):
        ticks, chest_attempts = sim.run_trial()
        tick_counts.append(ticks)
        chest_attempt_counts.append(chest_attempts)
    
    elapsed = time.time() - start_time
    print(f"Elapsed simulation time: {elapsed:.2f} seconds")
    
    return tick_counts, chest_attempt_counts, trials, elapsed

if __name__ == "__main__":
    tick_counts, chest_attempt_counts, trials, elapsed = run_simulation()
    print(int(min(tick_counts)))
    max_ticks = int(max(tick_counts))
    kill_prob = np.zeros(max_ticks + 1)
    for ticks in tick_counts:
        idx = int(ticks)
        if idx <= max_ticks:
            kill_prob[idx:] += 1
    kill_prob = kill_prob / trials
    attack_ticks = np.arange(max_ticks + 1)

    mean_ttk = np.mean(tick_counts)
    mean_chest_attempts = np.mean(chest_attempt_counts)
    std_ttk = np.std(tick_counts)

    print(f"[Sim] Trials: {trials}")
    print(f"Expected TTK: {mean_ttk:.2f} ticks ({mean_ttk * 0.6:.2f} seconds)")
    print(f"Average chest attempts per trial: {mean_chest_attempts:.2f}")
    print(f"Min chest attempts: {min(chest_attempt_counts)}")
    print(f"Max chest attempts: {max(chest_attempt_counts)}")

    print(f"Elapsed simulation time: {elapsed:.2f} seconds")

    # Cap the plot at 0.99 cumulative probability
    cap = 0.99
    capped_idx = np.argmax(kill_prob >= cap) + 1 if np.any(kill_prob >= cap) else len(kill_prob)

    kill_prob_increments = np.diff(np.insert(kill_prob, 0, 0))

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=attack_ticks[:capped_idx],
        y=kill_prob[:capped_idx],
        mode='lines',
        name='Empirical Kill Probability'
    ))
    fig.update_layout(
        title="Empirical Kill Probability Over Time (Simulation)",
        xaxis_title="Tick",
        yaxis_title="Cumulative Probability",
        legend_title="Legend",
        hovermode="x unified"
    )
    fig.show()
