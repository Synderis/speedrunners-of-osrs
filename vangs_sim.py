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

def can_attack_vang(vang_hps, idx, max_hit, threshold=0.4, hp_reset_threshold=108, base_hp=270):
    # If all vangs are below the reset threshold, always allow
    if all(hp < hp_reset_threshold for hp in vang_hps):
        return True
    if max(vang_hps) < hp_reset_threshold:
        return True
    new_hps = vang_hps.copy()
    new_hps[idx] = vang_hps[idx] - max_hit
    min_hp = min(new_hps)
    max_hp = max(new_hps)
    reset_threshold = threshold * base_hp
    # Only allow if max hit does NOT cause a reset
    if (max_hp - min_hp) > reset_threshold:
        return False
    return True

# def vang_sim_loop(vang_hps, max_hit, accuracy, threshold=0.4, hp_reset_threshold=108):
#     full_hp = max(vang_hps)
#     tick = 0
#     while any(hp > 0 for hp in vang_hps):
#         # Choose which Vanguard to attack: try lowest HP above 0, but skip if would cause reset
#         attack_idx = None
#         for idx, hp in sorted(enumerate(vang_hps), key=lambda x: x[1]):
#             if hp > 0 and can_attack_vang(vang_hps, idx, max_hit, threshold, hp_reset_threshold):
#                 attack_idx = idx
#                 break
#         if attack_idx is None:
#             # If no safe attack, just attack the lowest HP one
#             attack_idx = min((i for i, hp in enumerate(vang_hps) if hp > 0), key=lambda i: vang_hps[i])
#         # Perform attack
#         if np.random.rand() < accuracy:
#             hit = np.random.randint(0, max_hit + 1)
#         else:
#             hit = 0
#         vang_hps[attack_idx] = max(0, vang_hps[attack_idx] - hit)
#         tick += 1
#         # After attack, check for reset (unless all are below threshold)
#         if not all(hp < hp_reset_threshold for hp in vang_hps):
#             min_hp = min(vang_hps)
#             max_hp_val = max(vang_hps)
#             if max_hp_val > 0 and (max_hp_val - min_hp) / max_hp_val > threshold:
#                 vang_hps = [full_hp, full_hp, full_hp]
#         # Optionally: break if infinite loop detected (shouldn't happen)
#         if tick > 1000:
#             break
#     return tick

if __name__ == "__main__":
    import time
    start_time = time.time()

    # Load parameters from your Markov model's best style output
    with open("vangs_payload.json", "r") as f:
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
    teleports = []
    total_immune_ticks = []
    combat_ticks_list = []
    max_hits = [
        best_style_mage["max_hit"],
        best_style_melee["max_hit"],
        best_style_ranged["max_hit"]
    ]
    accuracies = [
        best_style_mage["accuracy"],
        best_style_melee["accuracy"],
        best_style_ranged["accuracy"]
    ]
    attack_speeds = [
        player['gearSets']['mage']['selectedWeapon']['speed'],
        player['gearSets']['melee']['selectedWeapon']['speed'],
        player['gearSets']['ranged']['selectedWeapon']['speed']
    ]
    print(f"Max Hits: {max_hits}")
    print(f"Accuracies: {accuracies}")
    print(f"Attack Speeds: {attack_speeds}")

    print(f"[Sim] Starting simulation with {trials} trials...")
    for _ in range(trials):
        encounter_ticks = 0
        total_ticks = 0
        mage_hp = 270
        melee_hp = 270
        ranged_hp = 270
        hp_reset_threshold = 108
        # Each Vanguard gets its own style
        vang_hps = [mage_hp, melee_hp, ranged_hp]
        max_hits = [
            best_style_mage["max_hit"],
            best_style_melee["max_hit"],
            best_style_ranged["max_hit"]
        ]
        accuracies = [
            best_style_mage["accuracy"],
            best_style_melee["accuracy"],
            best_style_ranged["accuracy"]
        ]
        attack_speeds = [
            player['gearSets']['mage']['selectedWeapon']['speed'],
            player['gearSets']['melee']['selectedWeapon']['speed'],
            5
        ]
        
        tick = 0
        cooldown = 0  # When the player can next attack
        full_hp = max(vang_hps)
        tick_history = []
        immune_ticks_left = 0
        next_teleport = 20
        teleport = 0
        immune_ticks = 0
        combat_ticks = 0
        
        while any(hp > 0 for hp in vang_hps):
            ko_this_tick = False
            prev_vang_hps = vang_hps.copy()

            # Handle teleport/immune phase
            if immune_ticks_left > 0:
                immune_ticks_left -= 1
                immune_ticks += 1
                tick += 1
                tick_history.append({
                    "tick": tick,
                    "vang_hps": vang_hps.copy(),
                    "cooldown": cooldown,
                    "immune": True
                })
                if len(tick_history) > 10:
                    tick_history.pop(0)
                continue

            # Only check for teleport if not in immune phase
            if tick >= next_teleport:
                teleport += 1
                # print(f"Teleport at tick {tick}, Vang HPs: {vang_hps}")
                immune_ticks_left = 11
                next_teleport += immune_ticks_left + np.random.randint(20, 37)
                continue  # Start immune phase, skip combat this tick
            
            if tick >= cooldown:
                ready_idxs = [i for i, hp in enumerate(vang_hps) if hp > 0]
                attack_idx = None
                for idx in sorted(ready_idxs, key=lambda i: -vang_hps[i]):
                    if can_attack_vang(vang_hps, idx, max_hits[idx], 0.4, hp_reset_threshold):
                        attack_idx = idx
                        break
                if attack_idx is not None:
                    if np.random.rand() < accuracies[attack_idx]:
                        hit = np.random.randint(0, max_hits[attack_idx] + 1)
                    else:
                        hit = 0
                    prev_hp = vang_hps[attack_idx]
                    vang_hps[attack_idx] = max(0, vang_hps[attack_idx] - hit)
                    if prev_hp > 0 and vang_hps[attack_idx] == 0:
                        ko_this_tick = True
                    cooldown = tick + attack_speeds[attack_idx]

            tick_history.append({
                "tick": tick,
                "vang_hps": vang_hps.copy(),
                "cooldown": cooldown,
                "immune": False
            })
            if len(tick_history) > 10:
                tick_history.pop(0)

            tick += 1
            combat_ticks += 1

            if not all(hp < hp_reset_threshold for hp in vang_hps):
                min_hp = min(vang_hps)
                max_hp_val = max(vang_hps)
                reset_threshold = 0.4 * 270
                if max_hp_val > 0 and (max_hp_val - min_hp) > reset_threshold and not ko_this_tick:
                    print("Previous 10 ticks before reset:")
                    for entry in tick_history:
                        print(f"Tick {entry['tick']}: Vang HPs: {entry['vang_hps']}, cooldown: {entry['cooldown']}, immune: {entry['immune']}")
                    print(f"Reset at tick {tick}: {vang_hps}")
                    vang_hps = [full_hp, full_hp, full_hp]
        total_immune_ticks.append(immune_ticks)
        teleports.append(teleport)
        tick_counts.append(tick)

        # if total_ticks % 4 != 0:
        #     total_ticks += 4 - (total_ticks % 4)
        # tick_counts.append(total_ticks)
    print(f"[Sim] Simulation complete.")
    
    max_ticks = int(max(tick_counts))
    kill_prob = np.zeros(max_ticks + 1)
    for ticks in tick_counts:
        idx = int(ticks)
        if idx <= max_ticks:
            kill_prob[idx:] += 1
    kill_prob = kill_prob / trials
    attack_ticks = np.arange(max_ticks + 1)
    # melee_list_mean = np.mean(melee_list)
    # mage_list_mean = np.mean(mage_list)
    # ranged_list_mean = np.mean(ranged_list)
    # phase_list_mean = np.mean(phase_list)
    combat_ticks_list_mean = np.mean(combat_ticks_list)
    immune_ticks_mean = np.mean(total_immune_ticks)
    teleports_mean = np.mean(teleports)
    mean_ttk = np.mean(tick_counts)
    std_ttk = np.std(tick_counts)

    print(f"[Sim] Trials: {trials}")
    print(f"Expected TTK: {mean_ttk:.2f} ticks ({mean_ttk * 0.6:.2f} seconds)")
    print(f"Combat ticks: {combat_ticks_list_mean:.2f} ticks ({combat_ticks_list_mean * 0.6:.2f} seconds)")
    print(f"Teleports: {teleports_mean:.2f} ticks ({teleports_mean * 0.6:.2f} seconds)")
    print(f"Immune ticks: {immune_ticks_mean:.2f} ticks ({immune_ticks_mean * 0.6:.2f} seconds)")
    # print(f"Phase average ticks: {phase_list_mean:.2f} ticks ({phase_list_mean * 0.6:.2f} seconds)")
    # print(f"Melee average ticks: {melee_list_mean:.2f} ticks ({melee_list_mean * 0.6:.2f} seconds)")
    # print(f"Mage average ticks: {mage_list_mean:.2f} ticks ({mage_list_mean * 0.6:.2f} seconds)")
    # print(f"Ranged average ticks: {ranged_list_mean:.2f} ticks ({ranged_list_mean * 0.6:.2f} seconds)")

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
