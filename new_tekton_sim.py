import json
import math
import numpy as np
import json
import plotly.graph_objs as go
import copy
from helpers_melee import *

def ensure_weapon_swap(player, weapon, equip_offhand=None):
    gear_stats = player["gearSets"]["melee"]["gearStats"]
    gear_items = player["gearSets"]["melee"]["gearItems"]
    selected_weapon = player["gearSets"]["melee"]["selectedWeapon"]

    for item in player["inventory"]:
        if weapon in item["name"]:
            current_weapon = selected_weapon
            current_offhand = None
            for offhand_item in gear_items:
                if offhand_item["slot"] == "shield":
                    current_offhand = offhand_item
                    break
            inventory_weapon = item

            for stat_type in ["bonuses", "offensive"]:
                for stat in current_weapon[stat_type]:
                    gear_stats[stat_type][stat] -= current_weapon[stat_type][stat]
                    gear_stats[stat_type][stat] += inventory_weapon["equipment"][stat_type][stat]
                    if current_offhand:
                        gear_stats[stat_type][stat] -= current_offhand[stat_type][stat]
                    if equip_offhand:
                        gear_stats[stat_type][stat] += equip_offhand[stat_type][stat]

            player["gearSets"]["melee"]["selectedWeapon"] = inventory_weapon["equipment"]
            new_inventory_weapon = {
                "name": current_weapon["name"],
                "equipment": current_weapon
            }
            player["inventory"].append(new_inventory_weapon)
            player["inventory"].remove(inventory_weapon)
            if current_offhand:
                new_offhand_weapon = {
                    "name": current_offhand["name"],
                    "equipment": current_offhand
                }
                player["inventory"].append(new_offhand_weapon)
                gear_items.remove(current_offhand)
                return player, current_weapon["name"], current_offhand
            if equip_offhand:
                gear_items.append(equip_offhand)
            return player, current_weapon["name"], current_offhand

if __name__ == "__main__":
    import time
    start_time = time.time()

    # Load parameters from your Markov model's best style output
    with open("new_tekton_sim_payload.json", "r") as f:
        payload = json.load(f)
    player = payload["player"]
    room = payload["room"]
    monsters = room["monsters"]

    base_tekton_hp = monsters[0]["skills"]["hp"]
    attack_speed_normal = player["gearSets"]["melee"]["selectedWeapon"].get("speed", 4)
    attack_speed_enraged = player["gearSets"]["melee"]["selectedWeapon"].get("speed", 4)

    player, swapped_weapon, swapped_offhand = ensure_weapon_swap(player, "Elder maul")
    tekton_initial = copy.deepcopy(monsters[0])
    tekton_initial["skills"]["def"] = tekton_initial["skills"]["def"] * 0.65
    best_style_spec = find_best_combat_style(player, tekton_initial, "melee")
    max_hit_spec = best_style_spec["max_hit"]
    accuracy_spec = best_style_spec["accuracy"]
    player, _, _ = ensure_weapon_swap(player, swapped_weapon, swapped_offhand)

    # Simulation for empirical TTK and cumulative kill probability
    trials = 100000
    max_attacks = 1000  # Reasonable upper bound for plotting
    tick_counts = np.zeros(trials)
    total_tick_list = []
    crystal_avg = []
    for i in range(trials):
        tekton_hp = base_tekton_hp
        tekton_normal = copy.deepcopy(monsters[0])
        tekton_enraged = copy.deepcopy(monsters[1])
        total_ticks = 0
        spec_count = True
        pre_anvil = 6
        first_pass = True
        best_style_normal = None
        best_style_enraged = None

        while tekton_hp > 0:
            if spec_count == True:
                tekton_normal["skills"]["def"] = math.ceil(tekton_normal["skills"]["def"] * 0.65)
                tekton_enraged["skills"]["def"] = math.ceil(tekton_enraged["skills"]["def"] * 0.65)
                # print(tekton_normal["skills"]["def"], tekton_enraged["skills"]["def"])
                total_ticks += 6
                tekton_hp -= np.random.randint(0, max_hit_spec + 1)
                if np.random.rand() < accuracy_spec:
                    # print("Spec hit")
                    hit = np.random.randint(0, max_hit_spec + 1)
                    tekton_normal["skills"]["def"] = math.ceil(tekton_normal["skills"]["def"] * 0.65)
                    tekton_enraged["skills"]["def"] = math.ceil(tekton_enraged["skills"]["def"] * 0.65)
                    # print(tekton_normal["skills"]["def"], tekton_enraged["skills"]["def"])
                else:
                    tekton_normal["skills"]["def"] = math.ceil(tekton_normal["skills"]["def"] * 0.95)
                    tekton_enraged["skills"]["def"] = math.ceil(tekton_enraged["skills"]["def"] * 0.95)
                    # print(tekton_normal["skills"]["def"], tekton_enraged["skills"]["def"])
                    hit = 0
                total_ticks += 6
                tekton_hp -= hit
                spec_count = False

            if not best_style_normal or not best_style_enraged:
                best_style_normal = find_best_combat_style(player, tekton_normal, "melee")
                # print("Normal best style:", best_style_normal, '\n')
                max_hit_normal = best_style_normal["max_hit"]
                accuracy_normal = best_style_normal["accuracy"]
                best_style_enraged = find_best_combat_style(player, tekton_enraged, "melee")
                # print('YEP')
                # print("Enraged best style:", best_style_enraged, '\n')
                max_hit_enraged = best_style_enraged["max_hit"]
                accuracy_enraged = best_style_enraged["accuracy"]

            while pre_anvil > 0:
                if np.random.rand() < accuracy_normal:
                    hit = np.random.randint(0, max_hit_normal + 1)
                else:
                    hit = 0
                total_ticks += attack_speed_normal
                tekton_hp -= hit
                pre_anvil -= 1
            anvil_cycle = np.random.randint(3, 6)
            tekton_hp += anvil_cycle * 5
            total_ticks += anvil_cycle * 3

            for n in range(4):
                if np.random.rand() < accuracy_enraged:
                    hit = np.random.randint(0, max_hit_enraged + 1)
                else:
                    hit = 0
                total_ticks += attack_speed_enraged
                tekton_hp -= hit
                if n == 0 and first_pass:
                    tekton_hp -= math.floor(0.75 * np.random.randint(0, 87))
                    first_pass = False

            for _ in range(8):
                if np.random.rand() < accuracy_normal:
                    hit = np.random.randint(0, max_hit_normal + 1)
                else:
                    hit = 0
                total_ticks += attack_speed_normal
                tekton_hp -= hit

        tick_counts[i] = total_ticks

    max_ticks = int(max(tick_counts))
    kill_prob = np.zeros(max_ticks + 1)
    for ticks in tick_counts:
        idx = int(ticks)
        if idx <= max_ticks:
            kill_prob[idx:] += 1
    kill_prob = kill_prob / trials
    attack_ticks = np.arange(max_ticks + 1)

    mean_ttk = np.mean(tick_counts)
    std_ttk = np.std(tick_counts)

    print(f"[Sim] Trials: {trials}")
    print(f"Expected TTK: {mean_ttk:.2f} ticks ({mean_ttk * 0.6:.2f} seconds)")

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
    #     print(f"Tick {int(attack_ticks[i])}: P(die at tick) = {kill_prob_increments[i]:.6f}, CDF = {kill_prob[i]:.6f}")

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
