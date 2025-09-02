import json
import numpy as np
import json
import plotly.graph_objs as go
from helpers import *

def simulate_ttk(monster_hp, max_hit, accuracy, attack_speed, trials=100_000):
    ttks = []
    for _ in range(trials):
        hp = monster_hp
        ticks = 0
        while hp > 0:
            ticks += attack_speed
            if np.random.rand() < accuracy:
                hit = np.random.randint(0, max_hit + 1)  # 0 to max_hit, inclusive
            else:
                hit = 0
            hp -= hit
        ttks.append(ticks)
    return np.mean(ttks), np.std(ttks)

if __name__ == "__main__":
    import time
    start_time = time.time()

    # Load parameters from your Markov model's best style output
    with open("new_vasa_payload.json", "r") as f:
        payload = json.load(f)
    player = payload["player"]
    room = payload["room"]
    monsters = room["monsters"]

    # You may want to use your find_best_combat_style logic here, but for demo:
    # Fill these in with your actual values or extract from your Markov code
    best_style = find_best_combat_style(player, monsters[0], "ranged")
    monster_hp = monsters[0]["skills"]["hp"]
    max_hit = best_style["max_hit"]
    print(max_hit)
    accuracy = best_style["accuracy"]
    print(accuracy)
    attack_speed = 5

    # Print probability of 0 damage and expected damage per attack
    p_zero = (1 - accuracy) + accuracy / (max_hit + 1)
    expected_damage = accuracy * (sum(i for i in range(0, max_hit + 1)) / (max_hit + 1))
    print(f"[Sim] Probability of 0 damage: {p_zero:.4f}")
    print(f"[Sim] Expected damage per attack: {expected_damage:.4f}")
    best_style_crystal = find_best_combat_style(player, monsters[1], "melee")
    hp_crystal = monsters[1]["skills"]["hp"]
    max_hit_crystal = best_style_crystal["max_hit"]
    accuracy_crystal = best_style_crystal["accuracy"]
    # print(accuracy_crystal, max_hit_crystal)
    attack_speed_crystal = player["gearSets"]["melee"]["selectedWeapon"].get("speed", 4)
    p_zero_crystal = (1 - accuracy_crystal) + accuracy_crystal / (max_hit_crystal + 1)
    expected_damage_crystal = accuracy_crystal * (sum(i for i in range(0, max_hit_crystal + 1)) / (max_hit_crystal + 1))

    # Simulation for empirical TTK and cumulative kill probability
    trials = 100000
    max_attacks = 100  # Reasonable upper bound for plotting
    tick_counts = []
    crystal_attacks_list = []
    total_tick_list = []
    crystal_avg = []
    for _ in range(trials):
        hp = monster_hp
        monster_hp_crystal = hp_crystal
        base_max_attacks_crystal = 70
        max_attacks_crystal = 70
        vasa_attacks = 0
        total_ticks = 0
        crystal_attacks = 0
        count_check = 0
        crystal_count = 0
        vasa_attack_tick = 0

        while hp > 0:
            vasa_attacks += attack_speed
            total_ticks += attack_speed
            # print(vasa_attacks, total_ticks, crystal_attacks, monster_hp_crystal)
            if vasa_attacks == 20 or ((vasa_attacks - 20) % 8 == 0 and vasa_attacks > 20):
                crystal_count += 1
                healing_ticks = 0
                crystal_attack_tick = 0
                while monster_hp_crystal > 0:
                    crystal_attacks += attack_speed_crystal
                    healing_ticks += attack_speed_crystal
                    # for tick in range(attack_speed_crystal):
                    #     crystal_attack_tick += 1
                    #     if crystal_attack_tick % 3 == 0:
                    #         passive_hit = np.random.randint(0, 4)  # 0-3 inclusive
                    #         monster_hp_crystal -= passive_hit
                    if crystal_attacks >= max_attacks_crystal:
                        break
                    if np.random.rand() < accuracy_crystal:
                        hit_crystal = np.random.randint(0, max_hit_crystal + 1)
                    else:
                        hit_crystal = 0
                    monster_hp_crystal -= hit_crystal
                if crystal_attacks >= max_attacks_crystal:
                    healing_ticks = healing_ticks // 2
                    hp += int(monster_hp * 0.01) * healing_ticks
                    hp = min(hp, monster_hp)
                monster_hp_crystal = hp_crystal
                total_ticks += crystal_attacks
            if crystal_attacks >= max_attacks_crystal:
                count_check += 1
            if count_check > 3:
                total_ticks += 12
                max_attacks_crystal += base_max_attacks_crystal
                count_check = 0

            # for tick in range(attack_speed):
            #     vasa_attack_tick += 1
            #     if vasa_attack_tick % 3 == 0:
            #         passive_hit = np.random.randint(0, 4)  # 0-3 inclusive
            #         hp -= passive_hit

            if np.random.rand() < accuracy:
                hit = np.random.randint(0, max_hit + 1)
            else:
                hit = 0
            hp -= hit
        crystal_avg.append(crystal_count)
        crystal_attacks_list.append(crystal_attacks)
        tick_counts.append(total_ticks)
    
    max_ticks = int(max(tick_counts))
    kill_prob = np.zeros(max_ticks + 1)
    for ticks in tick_counts:
        idx = int(ticks)
        if idx <= max_ticks:
            kill_prob[idx:] += 1
    kill_prob = kill_prob / trials
    attack_ticks = np.arange(max_ticks + 1)

    crystal_count_avg = np.mean(crystal_avg)
    crystal_ttk = np.mean(crystal_attacks_list)
    mean_ttk = np.mean(tick_counts)
    std_ttk = np.std(tick_counts)

    print(f"[Sim] Trials: {trials}")
    print(f"[Sim] Crystal Count Avg: {crystal_count_avg:.2f}")
    print(f"[Sim] Crystal TTK: {crystal_ttk} ticks ({crystal_ttk * 0.6:.2f} seconds)")
    print(f"Expected TTK: {mean_ttk:.2f} ticks ({mean_ttk * 0.6:.2f} seconds)")

    elapsed = time.time() - start_time
    print(f"Elapsed simulation time: {elapsed:.2f} seconds")

    # Cap the plot at 0.99 cumulative probability
    cap = 0.99
    capped_idx = np.argmax(kill_prob >= cap) + 1 if np.any(kill_prob >= cap) else len(kill_prob)

    # Print the empirical kill probability distribution (cumulative)
    # print("\n[Sim] Empirical cumulative kill probability distribution (up to cap):")
    for i in range(capped_idx):
        print(f"Tick {i+1}: P(kill) = {kill_prob[i]:.5f}")

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
