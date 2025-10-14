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
        dmg = int(np.random.uniform(0.75, 1.75) * max_hit)
        hit1 = int(0.25 * dmg)
        hit2 = int(0.25 * dmg)
        hit3 = int(0.5 * dmg)
        hits = [hit1, hit2, hit3]
        burn_chance = [0.15, 0.15, 0.15]
    # Second accuracy roll
    elif np.random.rand() < accuracy:
        dmg = int(np.random.uniform(0.5, 1.5) * max_hit)
        hit1 = int(0.5 * dmg) - 1
        hit2 = int(0.5 * dmg) - 1
        hit3 = dmg - (hit1 + hit2)
        hits = [hit1, hit2, hit3]
        burn_chance = [0.30, 0.30, 0.30]
    # Third accuracy roll
    elif np.random.rand() < accuracy:
        dmg = int(np.random.uniform(0.25, 1.25) * max_hit)
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
            burns.append(True)
        else:
            burns.append(False)
    return hits, burns

if __name__ == "__main__":
    import time
    start_time = time.time()

    # Load parameters from your Markov model's best style output
    with open("olm_payload.json", "r") as f:
        payload = json.load(f)
    player = payload["player"]
    room = payload["room"]
    monsters = room["monsters"]
    # best_style_mage = find_best_combat_style(player, monsters[0], "mage")
    # best_style_melee = find_best_combat_style(player, monsters[0], "melee")
    burn_max_hit = 42
    burn_acc = 0.4097
    # player, swapped_weapon, swapped_offhand = ensure_weapon_swap(player, "Burning claws")
    # best_style_melee_spec = find_best_combat_style(player, monsters[0], "melee")

    # Simulation for empirical TTK and cumulative kill probability
    trials = 100000
    max_attacks = 100  # Reasonable upper bound for plotting
    tick_counts = []
    total_tick_list = []
    hp_remaining_list = []
    tick_counts_pre = []
    
    print(f"[Sim] Starting simulation with {trials} trials...")
    for _ in range(trials):
        total_ticks = 0
        ice_demon_hp = 210
        attack_tick = 0
        hit_count = 0
        burn_amount = 0
        burn_count = 1
        burn_dict = {}

        while hit_count < 4:
            attack_tick += 1
            if (attack_tick - 1) % 4 == 0:
                hit = burning_barrage_special(43, 0.4018)
                ice_demon_hp -= sum(hit[0])
                if burn_dict:
                    keys = list(burn_dict.keys())
                    for burn in keys:
                        ice_demon_hp -= burn_dict[burn] / 4
                        burn_dict[burn] -= burn_dict[burn] / 4
                        if burn_dict[burn] <= 0:
                            del burn_dict[burn]
                if hit_count not in burn_dict:
                    burn_dict[hit_count] = 0
                burn_dict[hit_count] += sum([10 if burn else 0 for burn in hit[1]])
                # burn_count += 1 if any(hit[1]) else 0
                hit_count += 1
            if ice_demon_hp <= 0:
                total_ticks += (attack_tick - 1)
                break
        tick_counts_pre.append(attack_tick - 1)
        hp_remaining_list.append(ice_demon_hp)
        
        while ice_demon_hp > 0:
            attack_tick += 1
            if (attack_tick - 1) % 4 == 0:
                hit = 0
                if np.random.rand() < 0.4018:
                    hit = np.random.randint(0, 43 + 1)
                if burn_dict:
                    keys = list(burn_dict.keys())
                    for burn in keys:
                        ice_demon_hp -= burn_dict[burn] / 4
                        burn_dict[burn] -= burn_dict[burn] / 4
                        if burn_dict[burn] <= 0:
                            del burn_dict[burn]
                ice_demon_hp -= hit
            if ice_demon_hp <= 0:
                total_ticks += (attack_tick - 1)
                break

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
    mean_ttk = np.mean(tick_counts)
    hp_remaining_mean = np.mean(hp_remaining_list)
    tick_counts_pre_mean = np.mean(tick_counts_pre)
    std_ttk = np.std(tick_counts)

    print(f"[Sim] Trials: {trials}")
    print(f"Expected TTK: {mean_ttk:.2f} ticks ({mean_ttk * 0.6:.2f} seconds)")
    print(f"Mean HP Remaining: {hp_remaining_mean:.2f}")
    print(f"Mean Pre-Burn Ticks: {tick_counts_pre_mean:.2f} ticks ({tick_counts_pre_mean * 0.6:.2f} seconds)")
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

    # fig = go.Figure()
    # fig.add_trace(go.Scatter(
    #     x=total_ticks[:capped_idx],
    #     y=kill_prob[:capped_idx],
    #     mode='lines',
    #     name='Empirical Kill Probability'
    # ))
    # fig.update_layout(
    #     title="Empirical Kill Probability Over Time (Simulation)",
    #     xaxis_title="Tick",
    #     yaxis_title="Cumulative Probability",
    #     legend_title="Legend",
    #     hovermode="x unified"
    # )
    # fig.show()
