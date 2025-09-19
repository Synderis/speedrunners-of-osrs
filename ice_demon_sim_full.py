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

def get_drain_and_heal(kindling):
    if kindling == 0:
        return 0.01, 0.0   # heal 1%, drain 0%
    elif 1 <= kindling <= 3:
        return 0.01, 0.01  # heal 1%, drain 1%
    elif 4 <= kindling <= 8:
        return 0.01, 0.02  # heal 1%, drain 2%
    elif 9 <= kindling <= 16:
        return 0.01, 0.03  # heal 1%, drain 3%
    elif 17 <= kindling <= 24:
        return 0.01, 0.04  # heal 1%, drain 4%
    else:  # 25+
        return 0.01, 0.05  # heal 1%, drain 5%

def chop_simulation(total_ticks, base_hp):
    initial_delay = 34
    chop_hp = base_hp
    # Phase 1: Chop until you have at least 25 kindling, then dump into burner 1
    kindling_count = 0
    time_before_dump = 0
    while kindling_count < 23:
        time_before_dump += 1
        if (time_before_dump - 1) % 5 == 0:
            kindling_count += np.random.randint(1, 9)  # 1 to 8 inclusive

    total_ticks += time_before_dump + 14 - 1
    burner_1_count = kindling_count
    kindling_count = 0
    burner_2_count = 0
    burner_3_count = 0
    third_burner_lit = False
    time_after_dump = 0

    # Phase 2: Burn phase, possibly add second and third burners
    while chop_hp > 0:
        time_after_dump += 1

        # Simulate chopping for second burner
        if burner_2_count == 0 and kindling_count < 23:
            if (time_after_dump - 1) % 5 == 0:
                kindling_count += np.random.randint(1, 9)
            if kindling_count >= 23:
                burner_2_count = kindling_count
                kindling_count = 0
                time_after_dump += 16  # time to dump into second burner

        # Simulate chopping for third burner (after second is lit, only get 3-4 instances)
        if burner_2_count > 0 and not third_burner_lit:
            target_chops = np.random.randint(3, 5)  # 3 or 4 instances
            third_burner_chops = 0
            third_burner_kindling = 0
            while third_burner_chops < target_chops:
                third_burner_chops += 1
                third_burner_kindling += np.random.randint(1, 9)
                if third_burner_kindling >= 8:
                    break
            time_after_dump += 8
            burner_3_count = third_burner_kindling
            third_burner_lit = True
            time_after_dump += third_burner_chops * 5

        # Every 6 ticks, kindling is used up and heal/drain is applied
        if (time_after_dump - 1) % 6 == 0:
            # Calculate heal/drain for each burner
            burner_heals = []
            burner_drains = []

            if burner_1_count > 0:
                heal1, drain1 = get_drain_and_heal(burner_1_count)
                burner_heals.append(heal1)
                burner_drains.append(drain1)
                burner_1_count -= 1
            if burner_2_count > 0:
                heal2, drain2 = get_drain_and_heal(burner_2_count)
                burner_drains.append(drain2)
                burner_2_count -= 1
            if burner_3_count > 0:
                heal3, drain3 = get_drain_and_heal(burner_3_count)
                burner_drains.append(drain3)
                burner_3_count -= 1

            # Only apply heal once (take the max heal from all burners, or just 0.01 if any burner is lit)
            heal_total = max(burner_heals) if burner_heals else 0.0
            drain_total = sum(burner_drains)

            chop_hp += heal_total * base_hp
            chop_hp -= drain_total * base_hp
            if chop_hp > base_hp:
                chop_hp = base_hp

        if chop_hp <= 0:
            break

    total_ticks += time_after_dump + initial_delay - 1
    return total_ticks

def thrall_hit(hp):
    hit_thrall = np.random.randint(0, 4)
    if hit_thrall != 3:
        hit_thrall = 0
    else:
        hit_thrall = 1
    hp -= hit_thrall
    return hp

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

def ember_light_kill(hp, max_hit, accuracy, attack_speed, total_ticks):
    accuracy_val = accuracy[0]
    attack_tick = 0
    hit_count = 0
    while hit_count < 2:
        attack_tick += 1
        if (attack_tick - 1) % attack_speed == 0:
            # print(hit_count, attack_tick - 1, ice_demon_hp)
            if np.random.rand() < accuracy_val:
                # spec_count += 1
                hit = np.random.randint(0, max_hit + 1)
                if accuracy_val == accuracy[1]:
                    accuracy_val = accuracy[2]
                else:
                    accuracy_val = accuracy[1]
                hp -= hit
            hp = thrall_hit(hp)
            hit_count += 1
    total_ticks += (attack_tick + attack_speed - 1)
    attack_tick = 0
    while True:
        attack_tick += 1
        if (attack_tick - 1) % attack_speed == 0:
            hit = 0
            if np.random.rand() < accuracy_val:
                hit = np.random.randint(0, max_hit + 1)
            hp -= hit
            hit_count += 1
            hp = thrall_hit(hp)
        if hp <= 0:
            if hit_count < 5:
                early_death.append(1)
            else:
                early_death.append(0)
            total_ticks += (attack_tick + attack_speed - 1)
            break
    return total_ticks

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

def burning_claws_kill(hp, max_hit, accuracy, attack_speed, total_ticks):
    attack_tick = 0
    hit_count = 0
    burn_list = []

    # First phase: 4 special attacks
    while hit_count < 4 and hp > 0:
        attack_tick += 1
        if (attack_tick - 1) % attack_speed == 0:
            hit, burns = burning_barrage_special(max_hit, accuracy)
            hp -= sum(hit)
            # Add new burns, max 5 at a time
            for burn in burns:
                if burn > 0 and len(burn_list) < 5:
                    burn_list.append(burn)
            hp, burn_list = apply_burns(hp, burn_list)
            hit_count += 1
            hp = thrall_hit(hp)

    if hp <= 0:
        early_death.append(1)
        total_ticks += (attack_tick + attack_speed - 1)
        return total_ticks

    early_death.append(0)
    total_ticks += (attack_tick + attack_speed - 1)
    attack_tick = 0

    # Second phase: regular attacks
    while True:
        attack_tick += 1
        if (attack_tick - 1) % attack_speed == 0:
            hit = np.random.randint(0, max_hit + 1) if np.random.rand() < accuracy else 0
            hp, burn_list = apply_burns(hp, burn_list)
            hp -= hit
            hit_count += 1
            hp = thrall_hit(hp)
        if hp <= 0:
            total_ticks += (attack_tick + attack_speed - 1)
            break
    return total_ticks

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
    spec_count_list = []
    tick_counts_post = []
    early_death = []
    ice_demon_pop_time = []
    
    print(f"[Sim] Starting simulation with {trials} trials...")
    for _ in range(trials):
        total_ticks = 0
        ice_demon_hp = 210
        total_ticks = chop_simulation(total_ticks, ice_demon_hp)
        ice_demon_pop_time.append(total_ticks)
        post_chop_delay = 10
        post_death_delay = 6
        attack_tick = 0
        attack_speed = 4  # in ticks
        emberlight = False
        if emberlight:
            total_ticks = ember_light_kill(ice_demon_hp, 64, [0.6925, 0.7382, 0.7839], attack_speed, total_ticks)
        else:
            total_ticks = burning_claws_kill(ice_demon_hp, 42, 0.4927, attack_speed, total_ticks)
        total_ticks += post_chop_delay
        if total_ticks % 4 != 0:
            total_ticks += 4 - (total_ticks % 4)
        total_ticks += post_death_delay
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
    median_ttk = np.median(tick_counts)
    # hp_remaining_mean = np.mean(hp_remaining_list)
    # tick_counts_pre_mean = np.mean(tick_counts_pre)
    std_ttk = np.std(tick_counts)

    print(f"[Sim] Trials: {trials}")
    print(f"Expected TTK: {mean_ttk:.2f} ticks ({mean_ttk * 0.6:.2f} seconds)")
    print(f"Expected Pop Time: {np.mean(ice_demon_pop_time):.2f} ticks ({np.mean(ice_demon_pop_time) * 0.6:.2f} seconds)")
    print(f"Median TTK: {median_ttk:.2f} ticks ({median_ttk * 0.6:.2f} seconds)")
    # early_death_sum = sum(early_death) / len(early_death)
    # print(f"Early Death: {early_death_sum:.2f}")
    # print(f"Mean HP Remaining: {hp_remaining_mean:.2f}")
    # print(f"Mean Pre-Burn Ticks: {tick_counts_pre_mean:.2f} ticks ({tick_counts_pre_mean * 0.6:.2f} seconds)")
    # print(f"Spec Attacks hit: {np.mean(spec_count_list):.2f}")
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
        x=np.arange(capped_idx),
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
