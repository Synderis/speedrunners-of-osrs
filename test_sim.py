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

def calculate_max_hit_for_style(player, style, gear, mining_level):
    strength_level = player["combatStats"]["strength"]
    potion_bonus = 21.0
    prayer_strength_bonus = 1.23
    style_bonus = style.get("str", 0)
    void_bonus = 1.0
    effective_strength = int(((strength_level + potion_bonus) * prayer_strength_bonus + style_bonus + 8.0) * void_bonus)
    strength_bonus = gear["bonuses"]["str"]
    base_max_hit = int(0.5 + (effective_strength * (strength_bonus + 64.0)) / 640.0)
    level_requirement = 60.0
    damage_multiplier = (50.0 + mining_level + level_requirement) / 150.0
    max_hit = int((base_max_hit * damage_multiplier) + 0.9999)  # ceil
    return max_hit, effective_strength

def calculate_accuracy_for_style(player, monster, style, gear):
    attack_level = player["combatStats"]["attack"]
    potion_bonus = 21.0
    prayer_attack_bonus = 1.20
    style_bonus = style.get("att", 0)
    void_bonus = 1.0
    effective_attack = int(((attack_level + potion_bonus) * prayer_attack_bonus + style_bonus + 8.0) * void_bonus)
    attack_type = style.get("attack_type", "").lower()
    equipment_bonus = {
        "stab": gear["offensive"]["stab"],
        "slash": gear["offensive"]["slash"],
        "crush": gear["offensive"]["crush"],
        "magic": gear["offensive"]["magic"],
        "ranged": gear["offensive"]["ranged"],
    }.get(attack_type, 0)
    attack_bonus = equipment_bonus
    max_attack_roll = effective_attack * (attack_bonus + 64)
    defence_bonus = {
        "stab": monster["defensive"]["stab"],
        "slash": monster["defensive"]["slash"],
        "crush": monster["defensive"]["crush"],
        "magic": monster["defensive"]["magic"],
        "ranged": monster["defensive"]["standard"],
    }.get(attack_type, 0)
    max_defence_roll = (monster["skills"]["def"] + 9) * (defence_bonus + 64)
    if max_attack_roll > max_defence_roll:
        accuracy = 1.0 - (max_defence_roll + 2) / (2.0 * (max_attack_roll + 1))
    else:
        accuracy = max_attack_roll / (2.0 * (max_defence_roll + 1))
    return accuracy, effective_attack, max_attack_roll, max_defence_roll

def find_best_combat_style(player, monster, mining_level):
    best_style = None
    best_dps = 0.0
    melee = player["gearSets"]["melee"]
    weapon = melee.get("selectedWeapon")
    if weapon:
        for style in weapon["weapon_styles"]:
            max_hit, effective_strength = calculate_max_hit_for_style(player, style, melee["gearStats"], mining_level)
            accuracy, effective_attack, max_attack_roll, max_defence_roll = calculate_accuracy_for_style(player, monster, style, melee["gearStats"])
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
    if not best_style:
        # Fallback
        strength_level = player["combatStats"]["strength"]
        attack_level = player["combatStats"]["attack"]
        potion_bonus = 21.0
        prayer_strength_bonus = 1.23
        prayer_attack_bonus = 1.20
        effective_strength = int(((strength_level + potion_bonus) * prayer_strength_bonus + 8.0))
        effective_attack = int(((attack_level + potion_bonus) * prayer_attack_bonus + 8.0))
        strength_bonus = melee["gearStats"]["bonuses"]["str"]
        attack_bonus = melee["gearStats"]["offensive"]["stab"]
        base_max_hit = int(0.5 + (effective_strength * (strength_bonus + 64.0)) / 640.0)
        level_requirement = 60.0
        damage_multiplier = (50.0 + mining_level + level_requirement) / 150.0
        max_hit = int((base_max_hit * damage_multiplier) + 0.9999)
        max_attack_roll = effective_attack * (attack_bonus + 64)
        max_defence_roll = (monster["skills"]["def"] + 9) * (monster["defensive"]["stab"] + 64)
        if max_attack_roll > max_defence_roll:
            accuracy = 1.0 - (max_defence_roll + 2) / (2.0 * (max_attack_roll + 1))
        else:
            accuracy = max_attack_roll / (2.0 * (max_defence_roll + 1))
        best_style = {
            "combat_style": "fallback",
            "attack_type": "stab",
            "max_hit": max_hit,
            "accuracy": accuracy,
            "effective_dps": max_hit * accuracy,
            "effective_strength": effective_strength,
            "effective_attack": effective_attack,
            "max_attack_roll": max_attack_roll,
            "max_defence_roll": max_defence_roll,
        }
    return best_style

def single_matrix(a, m, hp):
    n = hp + 1
    mat = [0.0] * (n * n)
    for i in range(n):
        row_start = i * n
        for j in range(n):
            if j == i and j != hp:
                mat[row_start + j] = 1.0 - a
            if j > i and j <= i + m and j != hp:
                mat[row_start + j] = a / m
        s = sum(mat[row_start + j] for j in range(n))
        mat[row_start + (n - 1)] = 1.0 - s
    return mat

def npc_state(hp):
    v = [0.0] * (hp + 1)
    v[0] = 1.0
    return v

def row_vec_times_square_mat(row, mat, n):
    out = [0.0] * n
    for i in range(n):
        r = row[i]
        if r == 0.0:
            continue
        row_start = i * n
        for j in range(n):
            out[j] += r * mat[row_start + j]
    return out

def weapon_kill_times(hp, max_hit, acc, cap):
    n = hp + 1
    weapon = single_matrix(acc, max_hit, hp)
    state = npc_state(hp)
    out = []
    p_dead = state[n - 1]
    tick = 0
    while p_dead < cap:
        tick += 1
        if tick % 5 == 1:
            state = row_vec_times_square_mat(state, weapon, n)
        p_dead = state[n - 1]
        out.append(p_dead)
    return out

if __name__ == "__main__":
    with open("test_payload.json", "r") as f:
        payload = json.load(f)

    player = payload["player"]
    monster = payload["monster"]
    cap = payload["config"]["cap"]
    mining_level = player["combatStats"]["mining"]

    best_style = find_best_combat_style(player, monster, mining_level)
    print("Best style:", best_style)

    kill_times = weapon_kill_times(
        monster["skills"]["hp"],
        best_style["max_hit"],
        best_style["accuracy"],
        cap
    )
    expected_tick = sum((i + 1) * (kill_times[i] - (kill_times[i - 1] if i > 0 else 0)) for i in range(len(kill_times)))
    expected_seconds = expected_tick * 0.6
    print(f"Expected TTK: {expected_tick:.2f} ticks ({expected_seconds:.2f} seconds)")


    # Interactive plot with Plotly
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