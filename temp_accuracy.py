import json
import numpy as np
import json
import plotly.graph_objs as go

def extract_combat_stats(obj):
    return {
        "attack": obj.get("attack", 0),
        "strength": obj.get("strength", 0),
        "defense": obj.get("defense", 0),
        "ranged": obj.get("ranged", 0),
        "magic": obj.get("magic", 0),
        "hitpoints": obj.get("hitpoints", 0),
        "prayer": obj.get("prayer", 0),
        "woodcutting": obj.get("woodcutting", 0),
        "mining": obj.get("mining", 0),
        "thieving": obj.get("thieving", 0),
    }

def extract_gear_bonuses(obj):
    return {
        "ranged_str": obj.get("ranged_str", 0),
        "magic_str": obj.get("magic_str", 0),
        "str": obj.get("str", 0),
        "prayer": obj.get("prayer", 0),
    }

def extract_gear_offensive(obj):
    return {
        "stab": obj.get("stab", 0),
        "slash": obj.get("slash", 0),
        "crush": obj.get("crush", 0),
        "magic": obj.get("magic", 0),
        "ranged": obj.get("ranged", 0),
    }

def extract_gear_defensive(obj):
    return {
        "stab": obj.get("stab", 0),
        "slash": obj.get("slash", 0),
        "crush": obj.get("crush", 0),
        "magic": obj.get("magic", 0),
        "ranged": obj.get("ranged", 0),
    }

def extract_gear_stats(obj):
    return {
        "bonuses": extract_gear_bonuses(obj.get("bonuses", {})),
        "offensive": extract_gear_offensive(obj.get("offensive", {})),
        "defensive": extract_gear_defensive(obj.get("defensive", {})),
    }

def extract_weapon_style(style):
    return {
        "name": style.get("name", ""),
        "attack_type": style.get("attack_type", ""),
        "combat_style": style.get("combat_style", ""),
        "att": style.get("att", 0),
        "str": style.get("str", 0),
        "def": style.get("def", 0),
        "ranged": style.get("ranged", 0),
        "magic": style.get("magic", 0),
        "att_spd_reduction": style.get("att_spd_reduction", 0),
    }

def extract_selected_weapon(obj):
    if not obj:
        return None
    return {
        "name": obj.get("name", ""),
        "id": obj.get("id", 0),
        "weapon_styles": [extract_weapon_style(ws) for ws in obj.get("weapon_styles", [])]
    }

def extract_gear_set_data(obj):
    return {
        "gearStats": extract_gear_stats(obj.get("gearStats", {})),
        "selectedWeapon": extract_selected_weapon(obj.get("selectedWeapon")),
        "gearType": obj.get("gearType", ""),
    }

def extract_all_gear_sets(obj):
    return {
        "melee": extract_gear_set_data(obj.get("melee", {})),
        "mage": extract_gear_set_data(obj.get("mage", {})),
        "ranged": extract_gear_set_data(obj.get("ranged", {})),
    }

def extract_monster_skills(obj):
    return {
        "atk": obj.get("atk", 0),
        "def": obj.get("def", 0),
        "hp": obj.get("hp", 0),
        "magic": obj.get("magic", 0),
        "ranged": obj.get("ranged", 0),
        "str": obj.get("str", 0),
    }

def extract_monster_offensive(obj):
    return {
        "ranged_str": obj.get("ranged_str", 0),
        "magic_str": obj.get("magic_str", 0),
        "atk": obj.get("atk", 0),
        "magic": obj.get("magic", 0),
        "ranged": obj.get("ranged", 0),
        "str": obj.get("str", 0),
    }

def extract_monster_defensive(obj):
    return {
        "flat_armour": obj.get("flat_armour", 0),
        "crush": obj.get("crush", 0),
        "magic": obj.get("magic", 0),
        "heavy": obj.get("heavy", 0),
        "standard": obj.get("standard", 0),
        "light": obj.get("light", 0),
        "slash": obj.get("slash", 0),
        "stab": obj.get("stab", 0),
    }

def extract_monster(obj):
    return {
        "id": obj.get("id", 0),
        "name": obj.get("name", ""),
        "version": obj.get("version"),
        "image": obj.get("image"),
        "level": obj.get("level"),
        "speed": obj.get("speed"),
        "style": obj.get("style"),
        "size": obj.get("size"),
        "max_hit": obj.get("max_hit"),
        "skills": extract_monster_skills(obj.get("skills", {})),
        "offensive": extract_monster_offensive(obj.get("offensive", {})),
        "defensive": extract_monster_defensive(obj.get("defensive", {})),
        "attributes": obj.get("attributes"),
        "immunities": obj.get("immunities"),
        "weakness": obj.get("weakness"),
    }

def extract_player(obj):
    return {
        "combatStats": extract_combat_stats(obj.get("combatStats", {})),
        "gearSets": extract_all_gear_sets(obj.get("gearSets", {})),
    }

def extract_dps_payload(obj):
    return {
        "player": extract_player(obj.get("player", {})),
        "monster": extract_monster(obj.get("monster", {})),
        "config": obj.get("config", {}),
    }

def calculate_max_hit_for_style(player, monster, combat_type, style, gear):
    level = player["combatStats"][combat_type]
    potion_bonus = 21.0
    prayer_bonus_dict = {
        "ranged": 1.23,
        "magic": 4,
        "melee": 1.23
    }
    prayer_bonus = prayer_bonus_dict.get(combat_type, 1.0)
    style_bonus = style.get(combat_type, 0)
    void_bonus = 1.0
    effective_level = int(((level + potion_bonus) * prayer_bonus + style_bonus + 8.0) * void_bonus)
    bonus_dict = {
        "melee": "str",
        "ranged": "ranged_str",
        "magic": "magic_str"
    }
    bonus = gear["bonuses"][bonus_dict.get(combat_type, "str")]
    if player["gearSets"][combat_type].get("selectedWeapon", {}).get("name", "").lower() == "twisted bow":
        max_hit_multiplier = (250 + ((((10 * 3 * monster["skills"]["magic"]) / 10) - 14) / 100) - (((((3 * monster["skills"]["magic"]) / 10) - 140) ** 2) / 100)) / 100
        max_hit_multiplier = max(1.0, min(max_hit_multiplier, 2.50))
    max_hit = int(0.5 + (effective_level * (bonus + 64.0)) / 640.0)

    max_hit = int(max_hit * max_hit_multiplier)
    return max_hit, effective_level

def calculate_att_def_max_roll(player, monster, combat_type, style, gear):
    level = player["combatStats"][combat_type]
    potion_bonus = 21.0
    prayer_bonus_dict = {
        "ranged": 1.20,
        "magic": 1.25,
        "melee": 1.20
    }
    prayer_bonus = prayer_bonus_dict.get(combat_type, 1.0)
    style_bonus = style.get(combat_type, 0)
    void_bonus = 1.0
    effective_level = int(((level + potion_bonus) * prayer_bonus + style_bonus + 8.0) * void_bonus)
    attack_type = style.get("attack_type", "").lower()
    equipment_bonus = {
        "stab": gear["offensive"]["stab"],
        "slash": gear["offensive"]["slash"],
        "crush": gear["offensive"]["crush"],
        "magic": gear["offensive"]["magic"],
        "ranged": gear["offensive"]["ranged"],
    }.get(attack_type, 0)
    bonus = equipment_bonus
    max_attack_roll = effective_level * (bonus + 64)
    defence_bonus = {
        "stab": monster["defensive"]["stab"],
        "slash": monster["defensive"]["slash"],
        "crush": monster["defensive"]["crush"],
        "magic": monster["defensive"]["magic"],
        "ranged": monster["defensive"]["standard"],
    }.get(attack_type, 0)
    max_defence_roll = (monster["skills"]["def"] + 9) * (defence_bonus + 64)
    return max_attack_roll, max_defence_roll

def calculate_accuracy_for_style(player, monster, combat_type, style, gear):
    max_attack_roll, max_defence_roll = calculate_att_def_max_roll(player, monster, combat_type, style, gear)
    accuracy_multiplier = 1.0
    if player["gearSets"][combat_type].get("selectedWeapon", {}).get("name", "").lower() == "twisted bow":
        accuracy_multiplier = (140 + ((((10 * 3 * monster["skills"]["magic"]) / 10) - 10) / 100) - (((((3 * monster["skills"]["magic"]) / 10) - 100) ** 2) / 100)) / 100
        accuracy_multiplier = max(1.0, min(accuracy_multiplier, 1.40))
    max_attack_roll = int(max_attack_roll * accuracy_multiplier)
    if max_attack_roll > max_defence_roll:
        accuracy = 1.0 - (max_defence_roll + 2) / (2.0 * (max_attack_roll + 1))
    else:
        accuracy = max_attack_roll / (2.0 * (max_defence_roll + 1))
    return accuracy, max_attack_roll, max_defence_roll

def find_best_combat_style(player, monster):
    best_style = None
    best_dps = 0.0
    ranged = player["gearSets"]["ranged"]
    weapon = ranged.get("selectedWeapon")
    if weapon:
        for style in weapon["weapon_styles"]:
            max_hit, effective_strength = calculate_max_hit_for_style(player, monster, style, ranged["gearStats"])
            accuracy, effective_attack, max_attack_roll, max_defence_roll = calculate_accuracy_for_style(player, monster, style, ranged["gearStats"])
            effective_dps = max_hit * accuracy
            style_result = {
                "combat_style": style.get("combat_style", ""),
                "attack_type": style.get("attack_type", ""),
                "max_hit": max_hit,
                "accuracy": accuracy,
                "effective_dps": effective_dps,
                "effective_strength": effective_strength,
                "effective_attack": effective_attack,
                "max_attack_roll": max_attack_roll,
                "max_defence_roll": max_defence_roll,
            }
            if effective_dps > best_dps:
                best_dps = effective_dps
                best_style = style_result
    # if not best_style:
    #     # Fallback
    #     strength_level = player["combatStats"]["strength"]
    #     attack_level = player["combatStats"]["ranged"]
    #     potion_bonus = 21.0
    #     prayer_strength_bonus = 1.23
    #     prayer_ranged_bonus = 1.20
    #     effective_strength = int(((strength_level + potion_bonus) * prayer_strength_bonus + 8.0))
    #     effective_attack = int(((attack_level + potion_bonus) * prayer_ranged_bonus + 8.0))
    #     strength_bonus = ranged["gearStats"]["bonuses"]["str"]
    #     attack_bonus = ranged["gearStats"]["offensive"]["stab"]
    #     max_hit = int(0.5 + (effective_strength * (strength_bonus + 64.0)) / 640.0)
    #     max_attack_roll = effective_attack * (attack_bonus + 64)
    #     max_defence_roll = (monster["skills"]["def"] + 9) * (monster["defensive"]["stab"] + 64)
    #     if max_attack_roll > max_defence_roll:
    #         accuracy = 1.0 - (max_defence_roll + 2) / (2.0 * (max_attack_roll + 1))
    #     else:
    #         accuracy = max_attack_roll / (2.0 * (max_defence_roll + 1))
    #     best_style = {
    #         "combat_style": "fallback",
    #         "attack_type": "stab",
    #         "max_hit": max_hit,
    #         "accuracy": accuracy,
    #         "effective_dps": max_hit * accuracy,
    #         "effective_strength": effective_strength,
    #         "effective_attack": effective_attack,
    #         "max_attack_roll": max_attack_roll,
    #         "max_defence_roll": max_defence_roll,
    #     }
    return best_style

def simulate_ttk(monster_hp, max_hit, accuracy, attack_speed, trials=100_000):
    ttks = []
    for _ in range(trials):
        hp = monster_hp
        ticks = 0
        while hp > 0:
            ticks += attack_speed
            if np.random.rand() < accuracy:
                hit = np.random.randint(0, max_hit + 1)  # 0 to max_hit, inclusive
            else:
                hit = 0
            hp -= hit
        ttks.append(ticks)
    return np.mean(ttks), np.std(ttks)

if __name__ == "__main__":
    import time
    start_time = time.time()

    # Load parameters from your Markov model's best style output
    with open("test_vasa_payload.json", "r") as f:
        payload = json.load(f)
    player = payload["player"]
    room = payload["room"]
    monsters = room["monsters"]

    # You may want to use your find_best_combat_style logic here, but for demo:
    # Fill these in with your actual values or extract from your Markov code
    best_style = find_best_combat_style(player, monsters[0])
    monster_hp = monsters[0]["skills"]["hp"]
    max_hit = best_style["max_hit"]
    accuracy = best_style["accuracy"]
    attack_speed = 5

    # Print probability of 0 damage and expected damage per attack
    p_zero = (1 - accuracy) + accuracy / (max_hit + 1)
    expected_damage = accuracy * (sum(i for i in range(0, max_hit + 1)) / (max_hit + 1))
    print(f"[Sim] Probability of 0 damage: {p_zero:.4f}")
    print(f"[Sim] Expected damage per attack: {expected_damage:.4f}")

    # Simulation for empirical TTK and cumulative kill probability
    trials = 100_000
    max_attacks = 100  # Reasonable upper bound for plotting
    kill_attack_counts = []
    for _ in range(trials):
        hp = monster_hp
        attacks = 0
        while hp > 0 and attacks < max_attacks:
            attacks += 1
            if np.random.rand() < accuracy:
                hit = np.random.randint(0, max_hit + 1)
            else:
                hit = 0
            hp -= hit
        kill_attack_counts.append(attacks)

    # Empirical cumulative kill probability by attack number
    kill_prob = np.zeros(max_attacks)
    for a in kill_attack_counts:
        if a <= max_attacks:
            kill_prob[a-1:] += 1
    kill_prob = kill_prob / trials
    # Align the simulation so the first attack is at tick 0 (like Markov)
    attack_ticks = [i * attack_speed for i in range(max_attacks)]

    mean_ttk = np.mean([a * attack_speed for a in kill_attack_counts])
    std_ttk = np.std([a * attack_speed for a in kill_attack_counts])
    print(f"Expected TTK: {mean_ttk:.2f} ticks ({mean_ttk * 0.6:.2f} seconds)")
    print(f"Expected hit count: {np.mean(kill_attack_counts):.2f}")

    elapsed = time.time() - start_time
    print(f"Elapsed simulation time: {elapsed:.2f} seconds")

    # Cap the plot at 0.99 cumulative probability
    cap = 0.99
    capped_idx = np.argmax(kill_prob >= cap) + 1 if np.any(kill_prob >= cap) else len(kill_prob)

    # Print the empirical kill probability distribution (cumulative)
    print("\n[Sim] Empirical cumulative kill probability distribution (up to cap):")
    for i in range(capped_idx):
        print(f"Attack {i+1}: P(kill) = {kill_prob[i]:.5f}")

    # fig = go.Figure()
    # fig.add_trace(go.Scatter(
    #     x=attack_ticks[:capped_idx],
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
