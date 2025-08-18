mining_level = 99
level_requirement = 60

import math
import json
import plotly.graph_objs as go

guardian_1 = {
    "id": 7570,
	"name": "Guardian (Chambers of Xeric)",
	"version": "Challenge Mode",
	"image": "Guardian (Chambers of Xeric, female).png",
	"level": 0,
	"speed": 4,
	"style": [
		"Slash"
	],
	"size": 0,
	"max_hit": "33",
	"skills": {
		"atk": 210,
		"def": 150,
		"hp": 375,
		"magic": 1,
		"ranged": 1,
		"str": 210
	},
	"offensive": {
		"atk": 0,
		"magic": 0,
		"magic_str": 0,
		"ranged": 0,
		"ranged_str": 0,
		"str": 20
	},
	"defensive": {
		"flat_armour": 0,
		"crush": -10,
		"magic": 0,
		"heavy": 0,
		"standard": 0,
		"light": 0,
		"slash": 180,
		"stab": 80
	},
	"attributes": [
		"xerician"
	],
	"immunities": {
		"burn": None
	},
	"weakness": None
}
guardian_2 = {
    "id": 7570,
	"name": "Guardian (Chambers of Xeric)",
	"version": "Challenge Mode",
	"image": "Guardian (Chambers of Xeric, female).png",
	"level": 0,
	"speed": 4,
	"style": [
		"Slash"
	],
	"size": 0,
	"max_hit": "33",
	"skills": {
		"atk": 210,
		"def": 150,
		"hp": 375,
		"magic": 1,
		"ranged": 1,
		"str": 210
	},
	"offensive": {
		"atk": 0,
		"magic": 0,
		"magic_str": 0,
		"ranged": 0,
		"ranged_str": 0,
		"str": 20
	},
	"defensive": {
		"flat_armour": 0,
		"crush": -10,
		"magic": 0,
		"heavy": 0,
		"standard": 0,
		"light": 0,
		"slash": 180,
		"stab": 80
	},
	"attributes": [
		"xerician"
	],
	"immunities": {
		"burn": None
	},
	"weakness": None
}

player = {
	"combatStats": {
		"attack": 99,
		"strength": 99,
		"defense": 99,
		"ranged": 99,
		"magic": 99,
		"hitpoints": 99,
		"prayer": 99,
		"woodcutting": 99,
		"mining": 99,
		"thieving": 99
	},
	"gearSets": {
		"melee": {
			"gearStats": {
				"bonuses": {
					"str": 120,
					"ranged_str": 63,
					"magic_str": 20,
					"prayer": 7
				},
				"offensive": {
					"stab": 118,
					"slash": 77,
					"crush": 110,
					"magic": -62,
					"ranged": -42
				},
				"defensive": {
					"stab": 326,
					"slash": 316,
					"crush": 323,
					"magic": -5,
					"ranged": 319
				}
			},
			"selectedWeapon": {
				"name": "Dragon pickaxe",
				"id": "11920",
				"weapon_styles": [
					{
						"name": "Spike",
						"attack_type": "Stab",
						"combat_style": "Accurate",
						"att": 3,
						"str": 0,
						"def": 0,
						"ranged": 0,
						"magic": 0,
						"att_spd_reduction": 0
					},
					{
						"name": "Impale",
						"attack_type": "Stab",
						"combat_style": "Aggressive",
						"att": 0,
						"str": 3,
						"def": 0,
						"ranged": 0,
						"magic": 0,
						"att_spd_reduction": 0
					},
					{
						"name": "Smash",
						"attack_type": "Crush",
						"combat_style": "Aggressive",
						"att": 0,
						"str": 3,
						"def": 0,
						"ranged": 0,
						"magic": 0,
						"att_spd_reduction": 0
					},
					{
						"name": "Block",
						"attack_type": "Stab",
						"combat_style": "Defensive",
						"att": 0,
						"str": 0,
						"def": 3,
						"ranged": 0,
						"magic": 0,
						"att_spd_reduction": 0
					}
				]
			},
			"gearType": "melee"
		},
		"mage": {
			"gearStats": {
				"bonuses": {
					"str": 4,
					"ranged_str": 62,
					"magic_str": 260,
					"prayer": 5
				},
				"offensive": {
					"stab": 5,
					"slash": 5,
					"crush": 5,
					"magic": 177,
					"ranged": -6
				},
				"defensive": {
					"stab": 120,
					"slash": 112,
					"crush": 129,
					"magic": 103,
					"ranged": 15
				}
			},
			"selectedWeapon": {
				"name": "Tumeken's shadow",
				"id": "27275",
				"weapon_styles": [
					{
						"name": "Accurate",
						"attack_type": "Magic",
						"combat_style": "Accurate",
						"att": 0,
						"str": 0,
						"def": 0,
						"ranged": 0,
						"magic": 3,
						"att_spd_reduction": 0
					},
					{
						"name": "Accurate",
						"attack_type": "Magic",
						"combat_style": "Accurate",
						"att": 0,
						"str": 0,
						"def": 0,
						"ranged": 0,
						"magic": 3,
						"att_spd_reduction": 0
					},
					{
						"name": "Longrange",
						"attack_type": "Magic",
						"combat_style": "Longrange",
						"att": 0,
						"str": 0,
						"def": 3,
						"ranged": 0,
						"magic": 1,
						"att_spd_reduction": 0
					}
				]
			},
			"gearType": "mage"
		},
		"ranged": {
			"gearStats": {
				"bonuses": {
					"str": 6,
					"ranged_str": 102,
					"magic_str": 20,
					"prayer": 6
				},
				"offensive": {
					"stab": -3,
					"slash": -3,
					"crush": -3,
					"magic": 4,
					"ranged": 218
				},
				"defensive": {
					"stab": 132,
					"slash": 126,
					"crush": 149,
					"magic": 155,
					"ranged": 126
				}
			},
			"selectedWeapon": {
				"name": "Twisted bow",
				"id": "20997",
				"weapon_styles": [
					{
						"name": "Aim",
						"attack_type": "Ranged",
						"combat_style": "Accurate",
						"att": 3,
						"str": 0,
						"def": 0,
						"ranged": 0,
						"magic": 0,
						"att_spd_reduction": 0
					},
					{
						"name": "Shoot",
						"attack_type": "Ranged",
						"combat_style": "Aggressive",
						"att": 0,
						"str": 3,
						"def": 0,
						"ranged": 0,
						"magic": 0,
						"att_spd_reduction": 0
					},
					{
						"name": "Block",
						"attack_type": "None",
						"combat_style": "Defensive",
						"att": 0,
						"str": 0,
						"def": 3,
						"ranged": 0,
						"magic": 0,
						"att_spd_reduction": 0
					}
				]
			},
			"gearType": "ranged"
		}
	},
	"inventory": []
}

damage_multiplier = (50 + player["combatStats"]["mining"] + level_requirement) / 150

tick_count = 0
# exit()
def calculate_max_hit(player, style, gear):
    strength_level = player["combatStats"]["strength"]
    potion_bonus = 21  # Super strength potion
    prayer_strength_bonus = 1.23  # Piety
    style_bonus = style.get("str", 0)
    void_bonus = 1.0  # No void for now
    effective_strength = int(((strength_level + potion_bonus) * prayer_strength_bonus + style_bonus + 8) * void_bonus)
    strength_bonus = gear["bonuses"]["str"]
    max_hit = int(0.5 + (effective_strength * (strength_bonus + 64)) / 640)
    return max_hit, effective_strength

def calculate_accuracy(player, monster, style, gear):
    attack_level = player["combatStats"]["attack"]
    potion_bonus = 21  # Super attack potion
    prayer_attack_bonus = 1.20  # Piety
    style_bonus = style.get("att", 0)
    void_bonus = 1.0  # No void for now
    effective_attack = int(((attack_level + potion_bonus) * prayer_attack_bonus + style_bonus + 8) * void_bonus)
    attack_type = style.get("attack_type", "").lower()
    equipment_bonus = gear["offensive"].get(attack_type, 0)
    attack_bonus = equipment_bonus
    max_attack_roll = effective_attack * (attack_bonus + 64)
    defence_bonus = monster["defensive"].get(attack_type, 0)
    max_defence_roll = (monster["skills"]["def"] + 9) * (defence_bonus + 64)
    if max_attack_roll > max_defence_roll:
        accuracy = 1.0 - (max_defence_roll + 2) / (2 * (max_attack_roll + 1))
    else:
        accuracy = max_attack_roll / (2 * (max_defence_roll + 1))
    return accuracy, effective_attack, max_attack_roll, max_defence_roll

def find_best_melee_style(player, monster):
    gear = player["gearSets"]["melee"]["gearStats"]
    weapon = player["gearSets"]["melee"]["selectedWeapon"]
    best = None
    best_dps = 0
    for style in weapon["weapon_styles"]:
        max_hit, effective_strength = calculate_max_hit(player, style, gear)
        max_hit = math.ceil(max_hit * damage_multiplier)
        accuracy, effective_attack, max_attack_roll, max_defence_roll = calculate_accuracy(player, monster, style, gear)
        print(accuracy, effective_attack, max_attack_roll, max_defence_roll)
        dps = max_hit * accuracy
        if dps > best_dps:
            best_dps = dps
            best = {
                "style": style,
                "max_hit": max_hit,
                "accuracy": accuracy,
                "effective_strength": effective_strength,
                "effective_attack": effective_attack,
                "max_attack_roll": max_attack_roll,
                "max_defence_roll": max_defence_roll,
                "dps": dps
            }
    return best

# Example usage:
best = find_best_melee_style(player, guardian_1)
print("Best style:", best["style"]["name"])
print("Max hit:", best["max_hit"])
print("Accuracy:", best["accuracy"])
print("Effective DPS:", best["dps"])
print("Guardian HP:", guardian_1["skills"]["hp"])

# --- Deterministic Markov Model Functions ---
def build_transition_matrix(hp, max_hit, accuracy):
	n = hp + 1
	mat = [[0.0 for _ in range(n)] for _ in range(n)]
	for i in range(n):
		if i == 0:
			mat[i][i] = 1.0  # Absorbing state
			continue
		# On miss, stay at same HP
		mat[i][i] += 1 - accuracy
		# On hit, can deal 0..max_hit damage, each equally likely
		for dmg in range(0, min(max_hit, i) + 1):
			next_hp = max(0, i - dmg)
			mat[i][next_hp] += accuracy / (max_hit + 1)
	return mat

def propagate_state(state, mat):
	n = len(state)
	new_state = [0.0 for _ in range(n)]
	for i in range(n):
		for j in range(n):
			new_state[j] += state[i] * mat[i][j]
	return new_state

def kill_time_distribution_matrix(hp, max_hit, accuracy, cap=0.99, max_steps=512):
	n = hp + 1
	mat = build_transition_matrix(hp, max_hit, accuracy)
	state = [0.0 for _ in range(n)]
	state[hp] = 1.0  # Start at full HP
	kill_times = []
	p_dead = 0.0
	while p_dead < cap and len(kill_times) < max_steps:
		state = propagate_state(state, mat)
		p_dead = state[0]
		kill_times.append(p_dead)
	return kill_times

# --- Output JSON Structure ---
kill_times = kill_time_distribution_matrix(
    hp=guardian_1["skills"]["hp"],
    max_hit=best["max_hit"],
    accuracy=best["accuracy"],
    cap=0.99
)

# Calculate expected kill time in ticks and seconds
expected_tick = sum((i + 1) * (kill_times[i] - (kill_times[i - 1] if i > 0 else 0)) for i in range(len(kill_times)))
expected_seconds = expected_tick
print(f"Expected TTK: {expected_tick:.2f} ticks ({expected_seconds:.2f} seconds)")

output = {
    "best_style": {
        "attack_type": best["style"]["attack_type"],
        "combat_style": best["style"]["combat_style"],
        "effective_dps": best["dps"],
        "gear_type": "melee"
    },
    "calculation": {
        "accuracy": best["accuracy"],
        "effective_attack": best["effective_attack"],
        "effective_strength": best["effective_strength"],
        "max_attack_roll": best["max_attack_roll"],
        "max_defence_roll": best["max_defence_roll"],
        "max_hit": best["max_hit"]
    },
    "kill_times": kill_times
}

# print(json.dumps(output))

fig = go.Figure()
fig.add_trace(go.Scatter(
    x=list(range(len(kill_times))),
    y=kill_times,
    mode='lines',
    name='Kill Probability'
))
fig.update_layout(
    title="Kill Probability Over Time",
    xaxis_title="Tick",
    yaxis_title="Cumulative Probability",
    legend_title="Legend",
    hovermode="x unified"
)
fig.show()