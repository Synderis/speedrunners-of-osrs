"""
Dynamic Markov Model for OSRS Combat with Variable Accuracy
This script demonstrates how to integrate dynamic accuracy and max hit calculations (as in a simulation) into a Markov chain model for combat.
"""
import numpy as np

# Example function to calculate accuracy and max hit dynamically (replace with your own logic)
def calculate_accuracy_and_max_hit(attack_level, strength_level, enemy_defence, gear_bonus):
    # Placeholder: Replace with your own combat formula
    accuracy = min(1.0, max(0.0, (attack_level + gear_bonus - enemy_defence) / 200))
    max_hit = int(strength_level * 0.5 + gear_bonus)
    return accuracy, max_hit

def SingleMatrix(a, m, hp):
    matrix = np.zeros((hp+1, hp+1), dtype=float)
    for i in range(hp+1):
        for j in range(hp+1):
            if j == i and j != hp:
                matrix[i, j] = 1 - a
            if j > i and j <= i + m and j != hp:
                matrix[i, j] = a / m
            if j == hp:
                matrix[i, j] = 1 - np.sum(matrix[i, :])
    return matrix

def NPCState(hp):
    matrix = np.zeros((1, hp+1))
    matrix[0, 0] = 1
    return matrix

def DynamicMarkovCombat(hp, attack_level, strength_level, enemy_defence, gear_bonus, hits):
    state = NPCState(hp)
    original_defence = enemy_defence
    for hit in range(hits):
        # After the first 6 hits, change defence to 280 for 4 hits, then revert
        if 6 <= hit < 10:
            current_defence = 280
        else:
            current_defence = original_defence
        accuracy, max_hit = calculate_accuracy_and_max_hit(
            attack_level, strength_level, current_defence, gear_bonus
        )
        transition_matrix = SingleMatrix(accuracy, max_hit, hp)
        state = np.matmul(state, transition_matrix)
    return state

# Example usage:
hp = 50
attack_level = 118
strength_level = 118
enemy_defence = 200
gear_bonus = 120
hits = 10

final_state = DynamicMarkovCombat(hp, attack_level, strength_level, enemy_defence, gear_bonus, hits)
print("Probability distribution of NPC HP after {} hits:".format(hits))
print(final_state)
print("Probability NPC is dead:", final_state[0, hp])
