import json
import numpy as np
import json
import plotly.graph_objs as go
from helpers import *
import copy

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


# def phase_loop(hp, attack_tick, attack_speed, accuracy, max_hit, hit_counter_bounds, total_ticks):
#     hit_counter = 0
#     while hit_counter <= hit_counter_bounds[0] or hit_counter < hit_counter_bounds[1]:
#         attack_tick += 1
#         if (attack_tick - 1) % attack_speed == 0:
#             # print(f"[Sim] Vasa attack: tick={attack_tick - 1}, hp={hp}")
#             if np.random.rand() < accuracy:
#                 hit = np.random.randint(0, max_hit + 1)
#             else:
#                 hit = 0
#             hp -= hit
#             hit_counter += 1
#             # print(f"[Sim] Vasa hits for {hit}, hp={hp}, hit_counter={hit_counter}")
#         if hp <= 0:
#             total_ticks += (attack_tick - 1)
#             break
#         if (attack_tick - 1) % 4 == 0:
#             # print(f"[Sim] Thrall attack: tick={attack_tick - 1}, hp={hp}")
#             hit = np.random.randint(0, 4)
#             hp -= hit
#         if hp <= 0:
#             total_ticks += (attack_tick - 1) 
#             break
#     attack_tick += attack_speed
#     return hp, attack_tick, hit_counter, total_ticks

def phase_loop(hp, attack_tick, attack_speed, accuracy, max_hit, total_ticks):
    while hp > 0:
        attack_tick += 1
        if (attack_tick - 1) % attack_speed == 0:
            if np.random.rand() < accuracy:
                hit = np.random.randint(0, max_hit + 1)
            else:
                hit = 0
            hp -= hit
        if hp <= 0:
            total_ticks += (attack_tick - 1)
            break
        if (attack_tick - 1) % 4 == 0:
            hit = np.random.randint(0, 4)
            hp -= hit
        if hp <= 0:
            total_ticks += (attack_tick - 1) 
            break
    attack_tick += attack_speed - 1
    return attack_tick

if __name__ == "__main__":
    import time
    start_time = time.time()

    # Load parameters from your Markov model's best style output
    with open("olm_payload.json", "r") as f:
        payload = json.load(f)
    player = payload["player"]
    room = payload["room"]
    monsters = room["monsters"]
    best_style_mage = find_best_combat_style(player, monsters[0], "mage")
    best_style_melee = find_best_combat_style(player, monsters[1], "melee")
    melee_hand = copy.deepcopy(monsters[1])
    melee_hand_specced = copy.deepcopy(monsters[1])
    melee_hand_specced['skills']['def'] = melee_hand_specced['skills']['def'] * 0.65
    player, swapped_weapon, swapped_offhand = ensure_weapon_swap(player, "Elder maul")
    best_style_melee_spec = find_best_combat_style(player, melee_hand, "melee")
    player, _, _ = ensure_weapon_swap(player, swapped_weapon, swapped_offhand)
    best_style_melee_specced = find_best_combat_style(player, melee_hand_specced, "melee")
    best_style_ranged = find_best_combat_style(player, monsters[2], "ranged")



    # Simulation for empirical TTK and cumulative kill probability
    trials = 100000
    max_attacks = 100  # Reasonable upper bound for plotting
    tick_counts = []
    total_tick_list = []
    phase_list = []
    melee_list = []
    mage_list = []
    ranged_list = []
    
    print(f"[Sim] Starting simulation with {trials} trials...")
    for _ in range(trials):
        encounter_ticks = 0
        total_ticks = 0
        for phase in range(3):
            phase_ticks = 0
            mage_hp = monsters[0]["skills"]["hp"]
            melee_hp = monsters[1]["skills"]["hp"]
            attack_tick = 0
            spec_hit = False
            melee_ticks = 0
            mage_ticks = 0
            ranged_ticks = 0
            delay_list = [22, 38, 39]  # Initial delay and intermission delays
            mage_ticks = phase_loop(mage_hp, attack_tick, 5, best_style_mage["accuracy"], best_style_mage["max_hit"], total_ticks)

            if np.random.rand() < best_style_melee_spec["accuracy"]:
                hit = np.random.randint(0, best_style_melee_spec["max_hit"] + 1)
                spec_hit = True
            else:
                hit = 0
            melee_hp -= hit

            if spec_hit == True:
                melee_ticks = phase_loop(melee_hp, attack_tick, 5, best_style_melee_specced["accuracy"], best_style_melee_specced["max_hit"], total_ticks)
            else:
                melee_ticks = phase_loop(melee_hp, attack_tick, 5, best_style_melee["accuracy"], best_style_melee["max_hit"], total_ticks)
            melee_ticks += 6
            total_ticks += delay_list[phase]

            if phase == 2:
                break

            phase_ticks = melee_ticks + mage_ticks
            phase_list.append(phase_ticks)
            mage_list.append(mage_ticks)
            melee_list.append(melee_ticks)
            total_ticks += phase_ticks



        ranged_hp = monsters[2]["skills"]["hp"]
        ranged_ticks = phase_loop(ranged_hp, attack_tick, 5, best_style_ranged["accuracy"], best_style_ranged["max_hit"], total_ticks)
        phase_ticks = melee_ticks + mage_ticks
        phase_list.append(phase_ticks)
        melee_list.append(melee_ticks)
        mage_list.append(mage_ticks)
        ranged_list.append(ranged_ticks)
        total_ticks += phase_ticks + ranged_ticks

        if total_ticks % 4 != 0:
            total_ticks += 4 - (total_ticks % 4)
        tick_counts.append(total_ticks)
    print(f"[Sim] Simulation complete.")
    
    max_ticks = int(max(tick_counts))
    kill_prob = np.zeros(max_ticks + 1)
    for ticks in tick_counts:
        idx = int(ticks)
        if idx <= max_ticks:
            kill_prob[idx:] += 1
    kill_prob = kill_prob / trials
    attack_ticks = np.arange(max_ticks + 1)
    melee_list_mean = np.mean(melee_list)
    mage_list_mean = np.mean(mage_list)
    ranged_list_mean = np.mean(ranged_list)
    phase_list_mean = np.mean(phase_list)
    mean_ttk = np.mean(tick_counts)
    std_ttk = np.std(tick_counts)

    print(f"[Sim] Trials: {trials}")
    print(f"Expected TTK: {mean_ttk:.2f} ticks ({mean_ttk * 0.6:.2f} seconds)")
    print(f"Phase average ticks: {phase_list_mean:.2f} ticks ({phase_list_mean * 0.6:.2f} seconds)")
    print(f"Melee average ticks: {melee_list_mean:.2f} ticks ({melee_list_mean * 0.6:.2f} seconds)")
    print(f"Mage average ticks: {mage_list_mean:.2f} ticks ({mage_list_mean * 0.6:.2f} seconds)")
    print(f"Ranged average ticks: {ranged_list_mean:.2f} ticks ({ranged_list_mean * 0.6:.2f} seconds)")

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
