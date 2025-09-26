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


def burning_barrage_special(max_hit, accuracy):
    # First accuracy roll
    if np.random.rand() < accuracy:
        max_hit_low = int(max_hit * 0.75)
        max_hit_high = int(max_hit * 1.75)
        dmg = np.random.randint(max_hit_low, max_hit_high + 1)
        # dmg = int(np.random.uniform(0.75, 1.75) * max_hit)
        hit1 = int(0.25 * dmg)
        hit2 = int(0.25 * dmg)
        hit3 = int(0.5 * dmg)
        hits = [hit1, hit2, hit3]
        burn_chance = [0.15, 0.15, 0.15]
    # Second accuracy roll
    elif np.random.rand() < accuracy:
        max_hit_low = int(max_hit * 0.5)
        max_hit_high = int(max_hit * 1.5)
        dmg = np.random.randint(max_hit_low, max_hit_high + 1)
        # dmg = int(np.random.uniform(0.5, 1.5) * max_hit)
        hit1 = int(0.5 * dmg) - 1
        hit2 = int(0.5 * dmg) - 1
        hit3 = dmg - (hit1 + hit2)
        hits = [hit1, hit2, hit3]
        burn_chance = [0.30, 0.30, 0.30]
    # Third accuracy roll
    elif np.random.rand() < accuracy:
        max_hit_low = int(max_hit * 0.25)
        max_hit_high = int(max_hit * 0.75)
        dmg = np.random.randint(max_hit_low, max_hit_high + 1)
        # dmg = int(np.random.uniform(0.25, 1.25) * max_hit)
        hit3 = dmg - 2
        hit1 = 1 if dmg >= 2 else 0
        hit2 = 1 if dmg >= 2 else 0
        hits = [hit1, hit2, hit3]
        burn_chance = [0.45, 0.45, 0.45]
    # All miss
    else:
        roll = np.random.rand()
        if roll < 0.2:
            hits = [0]
        elif roll < 0.6:
            hits = [1]
        else:
            hits = [2]
        burn_chance = [0.0] * len(hits)

    # Burn calculation
    burns = []
    for i, hit in enumerate(hits):
        if burn_chance[i] > 0 and np.random.rand() < burn_chance[i]:
            if i == 2:
                burns.append(9)
            else:
                burns.append(10)
    return hits, burns

def apply_burns(hp, burn_list):
    # Apply burn damage and update burn durations
    new_burn_list = []
    for burn in burn_list:
        if burn > 0:
            hp -= 1
            burn -= 1
        if burn > 0:
            new_burn_list.append(burn)
    return hp, new_burn_list

def can_attack_vang(vang_hps, combat_type, max_hit, threshold=0.4, hp_reset_threshold=108, base_hp=270):
    # If all vangs are below the reset threshold, always allow
    if all(hp < hp_reset_threshold for hp in vang_hps.values()):
        return True
    if max(vang_hps.values()) < hp_reset_threshold:
        return True
    new_hps = vang_hps.copy()
    new_hps[combat_type] = vang_hps[combat_type] - max_hit
    min_hp = min(new_hps.values())
    max_hp = max(new_hps.values())
    reset_threshold = threshold * base_hp
    # Only allow if max hit does NOT cause a reset
    if (max_hp - min_hp) > reset_threshold:
        return False
    return True

if __name__ == "__main__":
    import time
    start_time = time.time()

    # Load parameters from your Markov model's best style output
    with open("/home/synderis/Documents/github_repos/speedrunners-of-osrs/vangs_payload.json", "r") as f:
        payload = json.load(f)
    player = payload["player"]
    room = payload["room"]
    monsters = room["monsters"]
    burning_claws = True
    voidwaker = False
    spec_list = []
    best_style_mage = find_best_combat_style(player, monsters[0], "mage")
    best_style_melee = find_best_combat_style(player, monsters[1], "melee")
    best_style_ranged = find_best_combat_style(player, monsters[2], "ranged")
    if burning_claws:
        player, current_weapon, current_offhand = ensure_weapon_swap(player, "Burning claws")
    if voidwaker:
        player, current_weapon, current_offhand = ensure_weapon_swap(player, "Voidwaker")
    best_style_spec = find_best_combat_style(player, monsters[1], "melee")

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
    burn_instance_list = []
    # combat_ticks_list = []

    print(f"[Sim] Starting simulation with {trials} trials...")
    debug_trials = []
    debug_trial_count = 3

    for trial_idx in range(trials):
        burn_instances = 0
        spec_count = 0
        if burning_claws:
            spec_count = 3
        if voidwaker:
            spec_count = 2
        encounter_ticks = 0
        total_ticks = 0
        mage_hp = 270
        melee_hp = 270
        ranged_hp = 270
        hp_reset_threshold = 108
        vang_hps = {"mage": mage_hp, "melee": melee_hp, "ranged": ranged_hp}
        max_hits = {
            "mage": best_style_mage["max_hit"],
            "melee": best_style_melee["max_hit"],
            "ranged": best_style_ranged["max_hit"],
            "spec": best_style_spec["max_hit"]
        }
        accuracies = {
            "mage": best_style_mage["accuracy"],
            "melee": best_style_melee["accuracy"],
            "ranged": best_style_ranged["accuracy"],
            "spec": best_style_spec["accuracy"]
        }
        attack_speeds = {
            "mage": best_style_mage["attack_speed"],
            "melee": best_style_melee["attack_speed"],
            "ranged": best_style_ranged["attack_speed"],
            "spec": best_style_spec["attack_speed"]
        }
        initial_delay = 24
        tick = 0
        cooldown = 0
        full_hp = max(vang_hps)
        immune_ticks_left = 0
        next_teleport = 20
        teleport = 0
        immune_ticks = 0
        debug_tick_log = []
        initial_burn_tick = 0
        last_vang_attacked = None
        current_attack_phase_tick = 0
        burns = []
        while any(hp > 0 for hp in vang_hps.values()):
            ko_this_tick = False
            prev_vang_hps = vang_hps.copy()
            # Handle teleport/immune phase
            if immune_ticks_left > 0:
                immune_ticks_left -= 1
                immune_ticks += 1
                tick += 1
                continue
            # Only check for teleport if not in immune phase
            if tick >= next_teleport:
                teleport += 1
                immune_ticks_left = 11
                current_attack_phase_tick = 0
                next_teleport += immune_ticks_left + np.random.randint(20, 37)
                continue

            attack_type = None
            hit = 0
            if tick >= cooldown:
                ready_types = [combat_type for combat_type in vang_hps.keys() if vang_hps[combat_type] > 0]
                for combat_type in sorted(ready_types, key=lambda t: -vang_hps[t]):
                    if can_attack_vang(vang_hps, combat_type, max_hits[combat_type], 0.4, hp_reset_threshold):
                        attack_type = combat_type
                        break
                
                if attack_type is not None:
                    if attack_type != last_vang_attacked:
                        current_attack_phase_tick = 1
                    last_vang_attacked = attack_type
                    if attack_type == "melee" and spec_count > 0:
                        cooldown = tick + attack_speeds["spec"]
                        spec_count -= 1
                        hits, new_burns = burning_barrage_special(max_hits["spec"], accuracies["spec"])
                        if initial_burn_tick == 0 and new_burns:
                            initial_burn_tick = 1
                        for burn in new_burns:  # Iterate over NEW burns
                            if burn > 0 and len(burns) < 5:  # Check existing burns list length
                                burns.append(burn)  # Add to existing burns list
                        hit = sum(hits)
                    else:
                        cooldown = tick + attack_speeds[attack_type]
                        if np.random.rand() < accuracies[attack_type]:
                            hit = max(1, np.random.randint(0, max_hits[attack_type] + 1))
                        else:
                            hit = 0
                    prev_hp = vang_hps[attack_type]
                    vang_hps[attack_type] = max(0, vang_hps[attack_type] - hit)
                    if prev_hp > 0 and vang_hps[attack_type] == 0:
                        ko_this_tick = True

            if initial_burn_tick > 0 and burns and (initial_burn_tick - 1) % 4 == 0:
                vang_hps['melee'], burns = apply_burns(vang_hps['melee'], burns)
                if not burns:
                    initial_burn_tick = 0
            if initial_burn_tick > 0:
                initial_burn_tick += 1
            if immune_ticks_left == 0:
                if (current_attack_phase_tick - 1) % 4 == 0:
                    vang_hps[last_vang_attacked] = vang_hps[last_vang_attacked] - np.random.randint(1, 4)
                current_attack_phase_tick += 1
            tick += 1
        spec_list.append(spec_count)
        burn_instance_list.append(burn_instances)
        total_immune_ticks.append(immune_ticks)
        teleports.append(teleport)
        tick_counts.append(tick + initial_delay + 4)
        if trial_idx < debug_trial_count:
            debug_trials.append(debug_tick_log)
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
    # combat_ticks_list_mean = np.mean(combat_ticks_list)
    spec_list_mean = np.mean(spec_list)
    burn_instance_list_mean = np.mean(burn_instance_list)
    immune_ticks_mean = np.mean(total_immune_ticks)
    teleports_mean = np.mean(teleports)
    mean_ttk = np.mean(tick_counts)
    std_ttk = np.std(tick_counts)

    print(f"[Sim] Trials: {trials}")
    print(f"Expected TTK: {mean_ttk:.2f} ticks ({mean_ttk * 0.6:.2f} seconds)")
    # print(f"Combat ticks: {combat_ticks_list_mean:.2f} ticks ({combat_ticks_list_mean * 0.6:.2f} seconds)")
    print(f"Teleports: {teleports_mean:.2f}")
    print(f"Immune ticks: {immune_ticks_mean:.2f} ticks ({immune_ticks_mean * 0.6:.2f} seconds)")
    print(f"Special attacks used: {spec_list_mean:.2f} out of 3")
    print(f"Burn instances applied: {burn_instance_list_mean:.2f}")
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
