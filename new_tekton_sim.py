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

def phase_loop(hit_count, hit_count_bounds, tekton_hp, current_phase_ticks, attack_speed, accuracy, max_hit):
    while tekton_hp > 0 and hit_count_bounds[0] <= hit_count <= hit_count_bounds[1]:
        current_phase_ticks += 1
        if current_phase_ticks == 1 or (current_phase_ticks - 1) % 4 == 0:
        # if (current_phase_ticks - 1) % 4 == 0:
            # print(f"[Sim] Thrall attack: tick={current_phase_ticks - 1}, hp={tekton_hp}")
            tekton_hp -= np.random.randint(0, 4)
        if tekton_hp <= 0:
            return tekton_hp, current_phase_ticks, hit_count, True  # signal to break outer loop
        if current_phase_ticks == 1 or (current_phase_ticks - 1) % attack_speed == 0:
        # if (current_phase_ticks - 1) % attack_speed == 0:
            hit = 0
            if np.random.rand() < accuracy:
                hit = np.random.randint(0, max_hit + 1)
            # print(f"[Sim] Player attack: tick={current_phase_ticks - 1}, hp={tekton_hp}, hit={hit}")
            tekton_hp -= hit
            hit_count += 1
    # current_phase_ticks += attack_speed
    return tekton_hp, current_phase_ticks, hit_count, False

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
    tekton_missed = copy.deepcopy(monsters[0])
    tekton_missed["skills"]["def"] = math.ceil(math.ceil(tekton_missed["skills"]["def"] * 0.65) * 0.95)
    tekton_hit = copy.deepcopy(monsters[0])
    tekton_hit["skills"]["def"] = math.ceil(math.ceil(tekton_hit["skills"]["def"] * 0.65) * 0.65)
    best_style_spec = find_best_combat_style(player, tekton_initial, "melee")
    max_hit_spec = best_style_spec["max_hit"]
    accuracy_spec = best_style_spec["accuracy"]
    player, _, _ = ensure_weapon_swap(player, swapped_weapon, swapped_offhand)
    best_style_missed = find_best_combat_style(player, tekton_missed, "melee")
    best_style_hit = find_best_combat_style(player, tekton_hit, "melee")

    # Simulation for empirical TTK and cumulative kill probability
    trials = 100000
    max_attacks = 1000  # Reasonable upper bound for plotting
    tick_counts = np.zeros(trials)
    total_tick_list = []
    anvil_count_list = np.zeros(trials)
    hp_anvil_list = np.zeros(trials)
    for i in range(trials):
        tekton_hp = base_tekton_hp
        tekton_normal = copy.deepcopy(monsters[0])
        tekton_enraged = copy.deepcopy(monsters[1])
        total_ticks = 0
        current_phase_ticks = 0
        initial_delay = 17
        spec_count = True
        pre_anvil = 0
        first_pass = True
        best_style_normal = None
        best_style_enraged = None
        hit_count = 0
        first_pass = True
        phase = 0
        hp_pre_anvil = 0

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

            tekton_hp, current_phase_ticks, pre_anvil, died = phase_loop(
                hit_count, (0, 7), tekton_hp, current_phase_ticks, attack_speed_normal, accuracy_normal, max_hit_normal
            )
            if died or tekton_hp <= 0:
                total_ticks += current_phase_ticks - 1
                break

            if tekton_hp > 0 and first_pass:
                hp_pre_anvil = tekton_hp
                first_pass = False
                phase += 1
                # print("Phase:", phase, "Ticks so far:", total_ticks, "HP:", tekton_hp)
            anvil_cycle = np.random.randint(3, 7)
            tekton_hp += anvil_cycle * 5

            # This is to remove the cd on that final hit since hes on the anvil
            total_ticks += (anvil_cycle * 3) - attack_speed_normal

            if current_phase_ticks > 0:
                total_ticks += current_phase_ticks - 1
            current_phase_ticks = 0
            # print("[Sim] Total ticks before phase", total_ticks, "Ticks from last phase:", current_phase_ticks - 1, "Actual last hit tick:", initial_delay + total_ticks + current_phase_ticks - 1)
            tekton_hp, current_phase_ticks, hit_count, died = phase_loop(
                hit_count, (0, 3), tekton_hp, current_phase_ticks, attack_speed_normal, accuracy_normal, max_hit_normal
            )
            if died or tekton_hp <= 0:
                # print("[Sim] Died in normal phase", tekton_hp, current_phase_ticks, hit_count, died)
                total_ticks += current_phase_ticks - 1
                break
            # This is to add back the cd on that final hit and adjust for the extra tick from phase loop
            current_phase_ticks += attack_speed_normal - 1
            # print("[Sim] Total ticks before enrage", total_ticks, "Ticks from last phase:", current_phase_ticks, "Actual last hit tick:", initial_delay + total_ticks + current_phase_ticks - 1)
            tekton_hp, current_phase_ticks, hit_count, died = phase_loop(
                hit_count, (4, 11), tekton_hp, current_phase_ticks, attack_speed_enraged, accuracy_enraged, max_hit_enraged
            )
            # print("[Sim] Total ticks before after", total_ticks, "Ticks from last phase:", current_phase_ticks - 1, "Actual last hit tick:", initial_delay + total_ticks + current_phase_ticks - 1)
            if died or tekton_hp <= 0:
                # print("[Sim] Died in enraged phase", tekton_hp, current_phase_ticks, hit_count, died)
                total_ticks += current_phase_ticks - 1
                break

            # This is to add back the cd on that final hit and adjust for the extra tick from phase loop
            total_ticks += current_phase_ticks - 1
            current_phase_ticks = 0
            hit_count = 0
            phase += 1
            # print("Phase:", phase, "Ticks so far:", total_ticks, "HP:", tekton_hp)
        # print("Defeated Tekton in", total_ticks, "ticks", "HP before anvil:", hp_pre_anvil, "Phases:", phase)
        total_ticks += initial_delay + attack_speed_normal
        if total_ticks % 4 != 0:
            total_ticks += 4 - (total_ticks % 4)
        anvil_count_list[i] = phase
        hp_anvil_list[i] = hp_pre_anvil
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
    median_ttk = np.median(tick_counts)
    std_ttk = np.std(tick_counts)

    print(f"[Sim] Trials: {trials}")
    print(f"Expected TTK: {mean_ttk:.2f} ticks ({mean_ttk * 0.6:.2f} seconds)")
    print(f"Median TTK: {median_ttk:.2f} ticks ({median_ttk * 0.6:.2f} seconds)")

    mean_anvils = np.mean(anvil_count_list)
    mean_hp_pre_anvil = np.mean(hp_anvil_list)
    print(f"Average number of anvils used: {mean_anvils:.2f}")
    print(f"Average HP before first anvil: {mean_hp_pre_anvil:.2f}")
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

    # Plot cumulative kill probability (existing)
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

    # Plot histogram of tick counts (TTK distribution)
    hist_fig = go.Figure()
    hist_fig.add_trace(go.Histogram(
        x=tick_counts,
        nbinsx=100,
        name='TTK Histogram',
        marker_color='rgba(0, 123, 255, 0.7)'
    ))
    hist_fig.update_layout(
        title="Histogram of TTK (Ticks to Kill)",
        xaxis_title="Ticks to Kill",
        yaxis_title="Frequency",
        bargap=0.05
    )
    # hist_fig.show()
