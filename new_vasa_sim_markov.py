import json
import numpy as np
import json
import plotly.graph_objs as go
from helpers import *


def build_transition_matrix(hp, max_hit, accuracy):
    n = hp + 1
    mat = np.zeros((n, n))
    for src in range(1, n):
        # Miss: stays at src
        mat[src, src] += (1 - accuracy)
        hit_range = min(src, max_hit)
        if hit_range > 0:
            for dmg in range(1, hit_range + 1):
                dest = src - dmg
                mat[dest, src] += accuracy / hit_range
    mat[0, 0] = 1.0
    # Normalize columns (not rows) so each column sums to 1
    col_sums = mat.sum(axis=0, keepdims=True)
    col_sums[col_sums == 0] = 1
    mat = mat / col_sums
    return mat

def build_passive_matrix(hp, passive_hit_max):
    n = hp + 1
    mat = np.zeros((n, n))
    passive_probs = np.ones(passive_hit_max + 1) / (passive_hit_max + 1)
    for i in range(1, n):
        for passive_hit, passive_p in enumerate(passive_probs):
            dest = 0 if passive_hit >= i else i - passive_hit
            mat[i, dest] += passive_p
    mat[0, 0] = 1.0
    return mat

def propagate_markov(state, mat, steps):
    """Propagate state vector by repeatedly applying the transition matrix."""
    for _ in range(steps):
        state = mat @ state
    return state

def vasa_attack_phase(state, mat, n_attacks, attack_speed, tick_start, kill_prob_by_tick, tick_list):
    tick = tick_start
    for atk in range(n_attacks):
        tick += attack_speed  # Advance by attack speed per attack
        state = mat @ state   # Apply Markov transition (damage) only on attack tick
        print(f"Attack {atk+1}, tick {tick}, dead probability: {state[0]:.6f}")
        kill_prob_by_tick.append(state[0])  # Update kill probability after attack
        tick_list.append(tick)
        if state[0] >= 0.999:
            return state, tick, True
    return state, tick, False

def crystal_phase(crystal_hp, crystal_attack_speed, crystal_mat, max_phase_ticks, vasa_state, tick_start):
    crystal_state = np.zeros(crystal_hp + 1)
    crystal_state[crystal_hp] = 1.0
    tick = tick_start
    n_attacks = max_phase_ticks // crystal_attack_speed

    # Track probability mass that dies at each attack
    death_probs = []
    prev_dead = 0.0
    for atk in range(n_attacks):
        tick += crystal_attack_speed
        crystal_state = crystal_mat @ crystal_state
        died_this_attack = crystal_state[0] - prev_dead
        death_probs.append((died_this_attack, tick))
        prev_dead = crystal_state[0]
        if crystal_state[0] >= 0.999:
            break

    # Surviving mass after all attacks
    survived_prob = 1.0 - crystal_state[0]
    final_tick = tick_start + n_attacks * crystal_attack_speed

    # Return a list of (probability, tick) for each possible death, plus surviving mass
    return death_probs, survived_prob, final_tick

def teleport_phase(vasa_state, teleport_ticks, tick_start):
    tick = tick_start + teleport_ticks
    return vasa_state, tick

def run_vasa_crystal_markov(
    vasa_hp, vasa_max_hit, vasa_accuracy, vasa_attack_speed,
    crystal_hp, crystal_max_hit, crystal_accuracy, crystal_attack_speed,
    passive_hit_max=3, passive_tick_interval=3,
    max_crystal_phase_ticks=70, pre_crystal_attacks=4, post_crystal_attacks=7,
    teleport_attacks=3, teleport_ticks=12, heal_percent=0.01, max_cycles=10
):
    vasa_mat = build_transition_matrix(vasa_hp, vasa_max_hit, vasa_accuracy)
    crystal_mat = build_transition_matrix(crystal_hp, crystal_max_hit, crystal_accuracy)

    vasa_state = np.zeros(vasa_hp + 1)
    vasa_state[vasa_hp] = 1.0

    tick = 0
    kill_prob_by_tick = []
    tick_list = []

    cycles = 0
    while cycles < max_cycles and vasa_state[0] < 0.999:
        # Vasa attack phase
        for _ in range(pre_crystal_attacks):
            tick += vasa_attack_speed
            vasa_state = vasa_mat @ vasa_state
            kill_prob_by_tick.append(vasa_state[0])
            tick_list.append(tick)
            if vasa_state[0] >= 0.999:
                break
        if vasa_state[0] >= 0.999:
            break

        # Crystal phase: weighted tick advancement
        crystal_state = np.zeros(crystal_hp + 1)
        crystal_state[crystal_hp] = 1.0
        n_attacks = max_crystal_phase_ticks // crystal_attack_speed
        death_tick_probs = []
        prev_dead = 0.0
        local_tick = tick
        for atk in range(n_attacks):
            local_tick += crystal_attack_speed
            crystal_state = crystal_mat @ crystal_state
            died_this_attack = crystal_state[0] - prev_dead
            if died_this_attack > 0:
                # For the portion that kills the crystal at this tick, advance tick and continue
                death_tick_probs.append((died_this_attack, local_tick))
            prev_dead = crystal_state[0]
        survived_prob = 1.0 - crystal_state[0]
        final_tick = tick + max_crystal_phase_ticks

        # Weighted average tick for crystal phase
        if death_tick_probs:
            # Weighted tick for crystal deaths
            weighted_tick = sum(prob * t for prob, t in death_tick_probs) / sum(prob for prob, t in death_tick_probs)
            tick = weighted_tick
        else:
            tick = final_tick
            # Heal Vasa if crystal survives
            heal_amount = int(vasa_hp * heal_percent)
            healed_state = np.zeros_like(vasa_state)
            for i in range(len(vasa_state)):
                if i == 0:
                    continue
                dest = min(i + heal_amount, len(vasa_state) - 1)
                healed_state[dest] += vasa_state[i]
            healed_state[0] = vasa_state[0]
            vasa_state = healed_state

        # Vasa attack phase
        for _ in range(post_crystal_attacks):
            tick += vasa_attack_speed
            vasa_state = vasa_mat @ vasa_state
            kill_prob_by_tick.append(vasa_state[0])
            tick_list.append(tick)
            if vasa_state[0] >= 0.999:
                break
        if vasa_state[0] >= 0.999:
            break

        # Crystal phase again: same weighted advancement
        crystal_state = np.zeros(crystal_hp + 1)
        crystal_state[crystal_hp] = 1.0
        n_attacks = max_crystal_phase_ticks // crystal_attack_speed
        death_tick_probs = []
        prev_dead = 0.0
        local_tick = tick
        for atk in range(n_attacks):
            local_tick += crystal_attack_speed
            crystal_state = crystal_mat @ crystal_state
            died_this_attack = crystal_state[0] - prev_dead
            if died_this_attack > 0:
                death_tick_probs.append((died_this_attack, local_tick))
            prev_dead = crystal_state[0]
        survived_prob = 1.0 - crystal_state[0]
        final_tick = tick + max_crystal_phase_ticks

        if death_tick_probs:
            weighted_tick = sum(prob * t for prob, t in death_tick_probs) / sum(prob for prob, t in death_tick_probs)
            tick = weighted_tick
        else:
            tick = final_tick
            heal_amount = int(vasa_hp * heal_percent)
            healed_state = np.zeros_like(vasa_state)
            for i in range(len(vasa_state)):
                if i == 0:
                    continue
                dest = min(i + heal_amount, len(vasa_state) - 1)
                healed_state[dest] += vasa_state[i]
            healed_state[0] = vasa_state[0]
            vasa_state = healed_state

        # 3 attacks on Vasa
        for _ in range(teleport_attacks):
            tick += vasa_attack_speed
            vasa_state = vasa_mat @ vasa_state
            kill_prob_by_tick.append(vasa_state[0])
            tick_list.append(tick)
            if vasa_state[0] >= 0.999:
                break
        if vasa_state[0] >= 0.999:
            break

        # Teleport phase
        tick += teleport_ticks
        cycles += 1

    # Expected TTK: first tick where cumulative kill probability >= 0.5 (median)
    kill_prob_arr = np.array(kill_prob_by_tick)
    tick_arr = np.array(tick_list)
    total_prob = np.cumsum(kill_prob_arr)
    for i, p in enumerate(total_prob):
        if p >= 0.5:
            median_ttk = tick_arr[i]
            break
    else:
        median_ttk = tick_arr[-1]
    # Weighted mean (expected value)
    kill_prob_increments = np.diff(np.insert(kill_prob_arr, 0, 0))
    expected_ttk = np.sum(tick_arr * kill_prob_increments)
    return kill_prob_arr, median_ttk, expected_ttk, tick_list


if __name__ == "__main__":
    import time
    

    # Load parameters from your Markov model's best style output
    with open("new_vasa_payload.json", "r") as f:
        payload = json.load(f)
    player = payload["player"]
    room = payload["room"]
    monsters = room["monsters"]

    # You may want to use your find_best_combat_style logic here, but for demo:
    # Fill these in with your actual values or extract from your Markov code
    best_style = find_best_combat_style(player, monsters[0], "ranged")
    vasa_hp = monsters[0]["skills"]["hp"]
    max_hit = best_style["max_hit"]
    # print(max_hit)
    accuracy = best_style["accuracy"]
    # print(accuracy)
    attack_speed = 5

    # Print probability of 0 damage and expected damage per attack
    p_zero = (1 - accuracy)
    expected_damage = accuracy * (sum(i for i in range(1, max_hit + 1)) / max_hit)
    best_style_crystal = find_best_combat_style(player, monsters[1], "melee")
    crystal_hp = monsters[1]["skills"]["hp"]
    max_hit_crystal = best_style_crystal["max_hit"]
    accuracy_crystal = best_style_crystal["accuracy"]
    attack_speed_crystal = player["gearSets"]["melee"]["selectedWeapon"].get("speed", 4)
    p_zero_crystal = (1 - accuracy_crystal)
    expected_damage_crystal = accuracy_crystal * (sum(i for i in range(1, max_hit_crystal + 1)) / max_hit_crystal)
    print(f'Accuracy: {accuracy:.4f}, Max Hit: {max_hit:.4f}')
    print(f"[Sim] Probability of 0 damage: {p_zero:.4f}")
    print(f"[Sim] Expected damage per attack: {expected_damage:.4f}")
    print(f'Accuracy (Crystal): {accuracy_crystal:.4f}, Max Hit (Crystal): {max_hit_crystal:.4f}')
    print(f"[Sim] Probability of 0 damage (Crystal): {p_zero_crystal:.4f}")
    print(f"[Sim] Expected damage per attack (Crystal): {expected_damage_crystal:.4f}")

    # vasa_hp = 2
    # max_hit = 2
    # accuracy = 1.0
    # vasa_mat = build_transition_matrix(vasa_hp, max_hit, accuracy)
    # print("Transition matrix:\n", vasa_mat)
    # vasa_state = np.zeros(vasa_hp + 1)
    # vasa_state[vasa_hp] = 1.0
    # print("Initial vasa_state:", vasa_state)
    # for atk in range(1, 3):
    #     vasa_state = vasa_mat @ vasa_state
    #     print(f"Attack {atk}, vasa_state: {vasa_state}, sum: {np.sum(vasa_state)}")
    start_time = time.time()
    # Input for the Markov model
    # vasa_hp = 450 Accuracy: 0.7652, Max Hit: 98.0000, Attack Speed: 5
    # crystal_hp = 120 Accuracy: 0.9082, Max Hit: 52.0000, Attack Speed: 4
    kill_prob, expected_ttk, kill_tick, tick_list = run_vasa_crystal_markov(
        vasa_hp, max_hit, accuracy, attack_speed,
        crystal_hp, max_hit_crystal, accuracy_crystal, attack_speed_crystal
    )
    markov_end_time = time.time()
    print(f"Expected TTK: {expected_ttk:.2f} ticks, {expected_ttk * 0.6:.2f} seconds")
    # Expected approximate output TTK: 119.53 ticks, 71.72 seconds
    print(f"Kill Tick: {kill_tick}")
    print(f"Simulation completed in {markov_end_time - start_time:.2f}.")
    # After running the Markov simulation
    # print("Kill probability by tick:", kill_prob)
    # print("Kill probability increments:", np.diff(np.insert(kill_prob, 0, 0)))
    
    # print("Tick list:", [int(t) for t in tick_list])
    # print("Any NaNs in vasa_mat?", np.isnan(vasa_mat).any())
    # print("Any Inf in vasa_mat?", np.isinf(vasa_mat).any())
    cap = 0.999
    capped_idx = np.argmax(kill_prob >= cap) + 1 if np.any(kill_prob >= cap) else len(kill_prob)
    tick_arr = tick_list[:capped_idx]
    # Print the Markov kill probability distribution (cumulative)
    kill_prob_increments = np.diff(np.insert(kill_prob, 0, 0))
    print("\n[Markov] Probability of dying at each tick (PDF, used for expected TTK):")
    for i in range(capped_idx):
        print(f"Tick {int(tick_arr[i])}: P(die at tick) = {kill_prob_increments[i]:.6f}, CDF = {kill_prob[i]:.6f}")

    # If you want to plot against tick_list (not just index)
    # tick_arr = np.arange(1, len(kill_prob) + 1)  # If you don't have tick_list
    # Or, if you want to use the actual tick values:
    # tick_arr = tick_list[:capped_idx]  # Uncomment if you have tick_list
    print("First 10 kill_prob_by_tick values:")
    for i in range(min(10, len(kill_prob))):
        print(f"{i}: {kill_prob[i]:.5f}")

    print("First 10 tick_list values:")
    for i in range(min(10, len(tick_list))):
        print(f"{i}: {tick_list[i]:.2f}")
    for i in range(10):
        print(f"tick={tick_arr[i]:.2f}, PDF={kill_prob_increments[i]:.6f}")
    print("Sum of kill_prob_increments:", np.sum(kill_prob_increments))

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=tick_arr[:capped_idx],
        y=kill_prob[:capped_idx],
        mode='lines',
        name='Markov Kill Probability'
    ))
    fig.update_layout(
        title="Markov Kill Probability Over Time",
        xaxis_title="Tick",
        yaxis_title="Cumulative Probability",
        legend_title="Legend",
        hovermode="x unified"
    )
    fig.show()

