import json
import numpy as np
import json
import plotly.graph_objs as go
from helpers import *


if __name__ == "__main__":
    import time
    start_time = time.time()

    # Load parameters from your Markov model's best style output
    with open("mutta_test_payload.json", "r") as f:
        payload = json.load(f)
    player = payload["player"]
    # print(player['gearSets']['mage']['selectedWeapon']['name'])
    room = payload["room"]
    monsters = room["monsters"]

    # You may want to use your find_best_combat_style logic here, but for demo:
    # Fill these in with your actual values or extract from your Markov code
    best_style_small_mutta = find_best_combat_style(player, monsters[0], "mage")
    print(best_style_small_mutta)
    base_small_mutta_hp = monsters[0]["skills"]["hp"]
    max_hit_small_mutta = best_style_small_mutta["max_hit"]
    accuracy_small_mutta = best_style_small_mutta["accuracy"]
    print("Max Hit Small Mutta:", max_hit_small_mutta, "Accuracy Small Mutta:", accuracy_small_mutta)
    attack_speed_small_mutta = player["gearSets"]["mage"]["selectedWeapon"].get("speed", 4)

    # Print probability of 0 damage and expected damage per attack
    p_zero_small_mutta = (1 - accuracy_small_mutta) + accuracy_small_mutta / (max_hit_small_mutta + 1)
    expected_damage_small_mutta = accuracy_small_mutta * (sum(i for i in range(0, max_hit_small_mutta + 1)) / (max_hit_small_mutta + 1))
    print(f"[Sim] Probability of 0 damage: {p_zero_small_mutta:.4f}")
    print(f"[Sim] Expected damage per attack: {expected_damage_small_mutta:.4f}")
    best_style_large_mutta = find_best_combat_style(player, monsters[1], "ranged")
    print(best_style_large_mutta)
    base_large_mutta_hp = monsters[1]["skills"]["hp"]
    max_hit_large_mutta = best_style_large_mutta["max_hit"]
    accuracy_large_mutta = best_style_large_mutta["accuracy"]
    print("Max Hit Large Mutta:", max_hit_large_mutta, "Accuracy Large Mutta:", accuracy_large_mutta)
    # print(accuracy_crystal, max_hit_crystal)
    attack_speed_large_mutta = player["gearSets"]["ranged"]["selectedWeapon"].get("speed", 4)
    p_zero_large_mutta = (1 - accuracy_large_mutta) + accuracy_large_mutta / (max_hit_large_mutta + 1)
    expected_damage_large_mutta = accuracy_large_mutta * (sum(i for i in range(0, max_hit_large_mutta + 1)) / (max_hit_large_mutta + 1))
    tree_accuracy = 0.7852
    base_tree_hp = player['combatStats']['woodcutting'] * 5

    # Simulation for empirical TTK and cumulative kill probability
    trials = 100000
    max_attacks = 100  # Reasonable upper bound for plotting
    tick_counts = []
    crystal_attacks_list = []
    total_tick_list = []
    crystal_avg = []
    tree_ticks_list = []
    small_mutta_ticks_list = []
    small_mutta_ticks_list2 = []
    large_mutta_ticks_list = []
    for _ in range(trials):
        hp_large_mutta = base_large_mutta_hp
        hp_small_mutta = base_small_mutta_hp
        tree_hp = base_tree_hp
        total_ticks = 0
        stalled_ticks = 0
        tree_ticks = 0
        small_mutta_ticks = 0
        large_mutta_ticks = 0

        while tree_hp > 0:
            # Simulate tree cutting
            if np.random.rand() < tree_accuracy:
                tree_hit = np.random.randint(0, player['combatStats']['woodcutting'] + 1)
            else:
                tree_hit = 0
            if base_small_mutta_hp // 2 < max_hit_small_mutta + hp_small_mutta:
                if np.random.rand() < accuracy_small_mutta:
                    hit = np.random.randint(1, max_hit_small_mutta + 1)
                else:
                    hit = 0
                small_mutta_ticks += attack_speed_small_mutta
                hp_small_mutta -= hit
            else:
                stalled_ticks += attack_speed_small_mutta
            tree_hp -= tree_hit
            # if tree_hp < 0:
            #     break
            total_ticks += attack_speed_small_mutta
        tree_ticks_list.append(total_ticks - attack_speed_small_mutta + 1)
        total_ticks += attack_speed_small_mutta + 1

        while hp_small_mutta > 0:
            if np.random.rand() < accuracy_small_mutta:
                hit = np.random.randint(1, max_hit_small_mutta + 1)
            else:
                hit = 0
            small_mutta_ticks += attack_speed_small_mutta
            total_ticks += attack_speed_small_mutta
            hp_small_mutta -= hit
        
        small_mutta_ticks_list.append(small_mutta_ticks)
        small_mutta_ticks_list2.append(total_ticks - stalled_ticks)
        total_ticks += 9  # Delay before switching to large mutta
        while hp_large_mutta > 0:
            if np.random.rand() < accuracy_large_mutta:
                hit = np.random.randint(1, max_hit_large_mutta + 1)
            else:
                hit = 0
            # large_mutta_ticks += attack_speed_large_mutta
            total_ticks += attack_speed_large_mutta
            hp_large_mutta -= hit
            # if hp_large_mutta < 0:
            #     break
            large_mutta_ticks += attack_speed_large_mutta
        large_mutta_ticks_list.append(large_mutta_ticks)
        if total_ticks % 4 != 0:
            total_ticks += 4 - (total_ticks % 4)
        tick_counts.append(total_ticks)
    
    max_ticks = int(max(tick_counts))
    kill_prob = np.zeros(max_ticks + 1)
    for ticks in tick_counts:
        idx = int(ticks)
        if idx <= max_ticks:
            kill_prob[idx:] += 1
    kill_prob = kill_prob / trials
    attack_ticks = np.arange(max_ticks + 1)

    mean_ttk = np.mean(tick_counts)
    mean_tree_ttk = np.mean(tree_ticks_list)
    mean_small_mutta_ttk = np.mean(small_mutta_ticks_list)
    mean_small_mutta_ttk2 = np.mean(small_mutta_ticks_list2)
    mean_large_mutta_ttk = np.mean(large_mutta_ticks_list)
    std_ttk = np.std(tick_counts)

    print(f"[Sim] Trials: {trials}")
    print(f"Expected TTK: {mean_ttk:.2f} ticks ({mean_ttk * 0.6:.2f} seconds)")
    print(f"Expected Tree TTK: {mean_tree_ttk:.2f} ticks ({mean_tree_ttk * 0.6:.2f} seconds)")
    print(f"Expected Small Mutta TTK: {mean_small_mutta_ttk:.2f} ticks ({mean_small_mutta_ttk * 0.6:.2f} seconds)")
    print(f"Expected Small Mutta TTK (excluding stalls): {mean_small_mutta_ttk2:.2f} ticks ({mean_small_mutta_ttk2 * 0.6:.2f} seconds)")
    print(f"Expected Large Mutta TTK: {mean_large_mutta_ttk:.2f} ticks ({mean_large_mutta_ttk * 0.6:.2f} seconds)")

    elapsed = time.time() - start_time
    print(f"Elapsed simulation time: {elapsed:.2f} seconds")

    # Cap the plot at 0.99 cumulative probability
    cap = 0.99
    capped_idx = np.argmax(kill_prob >= cap) + 1 if np.any(kill_prob >= cap) else len(kill_prob)
        # cap = 0.999
    # capped_idx = np.argmax(kill_prob >= cap) + 1 if np.any(kill_prob >= cap) else len(kill_prob)
    # tick_arr = attack_ticks[:capped_idx]
    # Print the Markov kill probability distribution (cumulative)
    kill_prob_increments = np.diff(np.insert(kill_prob, 0, 0))
    # print("\n[Markov] Probability of dying at each tick (PDF, used for expected TTK):")
    # for i in range(capped_idx):
        # print(f"Tick {int(attack_ticks[i])}: P(die at tick) = {kill_prob_increments[i]:.6f}, CDF = {kill_prob[i]:.6f}")

    # Print the empirical kill probability distribution (cumulative)
    # print("\n[Sim] Empirical cumulative kill probability distribution (up to cap):")
    # for i in range(capped_idx):
    #     print(f"Tick {i+1}: P(kill) = {kill_prob[i]:.5f}")

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
    # fig.show()
