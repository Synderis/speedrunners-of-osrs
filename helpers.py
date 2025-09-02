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
        "room": extract_monster(obj.get("room", {})),
        "config": obj.get("config", {}),
    }

def calculate_max_hit_for_style(player, monster, style, gear, gear_type="ranged"):
    if gear_type == "melee":
        level = player["combatStats"]["strength"]
        potion_bonus = 21.0  # super combat
        prayer_bonus = 1.23  # piety
        style_bonus = style.get("str", 0)
        void_bonus = 1.1 if player.get("void_melee", False) else 1.0
        effective_strength = int(((level + potion_bonus) * prayer_bonus + style_bonus + 8.0) * void_bonus)
        str_bonus = gear["bonuses"]["str"]
        max_hit = int(0.5 + (effective_strength * (str_bonus + 64.0)) / 640.0)
        return max_hit, effective_strength
    elif gear_type == "ranged":
        level = player["combatStats"]["ranged"]
        potion_bonus = 21.0
        prayer_bonus = 1.23
        style_bonus = style.get("ranged", 0)
        void_bonus = 1.0
        effective_ranged = int(((level + potion_bonus) * prayer_bonus + style_bonus + 8.0) * void_bonus)
        ranged_bonus = gear["bonuses"]["ranged_str"]
        max_hit_multiplier = 1.0
        if player["gearSets"]["ranged"].get("selectedWeapon", {}).get("name", "").lower() == "twisted bow":
            max_hit_multiplier = (250 + ((((10 * 3 * monster["skills"]["magic"]) / 10) - 14) / 100) - (((((3 * monster["skills"]["magic"]) / 10) - 140) ** 2) / 100)) / 100
            max_hit_multiplier = max(1.0, min(max_hit_multiplier, 2.50))
        max_hit = int(0.5 + (effective_ranged * (ranged_bonus + 64.0)) / 640.0)
        max_hit = int(max_hit * max_hit_multiplier)
        return max_hit, effective_ranged
    # Add magic here if needed
    else:
        raise ValueError("Unsupported gear_type")

def calculate_accuracy_for_style(player, monster, style, gear, gear_type="ranged"):
    if gear_type == "melee":
        attack_level = player["combatStats"]["attack"]
        potion_bonus = 21.0
        prayer_bonus = 1.20
        style_bonus = style.get("att", 0)
        void_bonus = 1.0
        effective_attack = int(((attack_level + potion_bonus) * prayer_bonus + style_bonus + 8.0) * void_bonus)
        attack_type = style.get("attack_type", "").lower()
        attack_bonus = gear["offensive"].get(attack_type, 0)
        max_attack_roll = effective_attack * (attack_bonus + 64)
        defence_bonus = monster["defensive"].get(attack_type, 0)
        max_defence_roll = (monster["skills"]["def"] + 9) * (defence_bonus + 64)
    elif gear_type == "ranged":
        attack_level = player["combatStats"]["ranged"]
        potion_bonus = 21.0
        prayer_bonus = 1.20
        style_bonus = style.get("ranged", 0)
        void_bonus = 1.0
        effective_attack = int(((attack_level + potion_bonus) * prayer_bonus + style_bonus + 8.0) * void_bonus)
        attack_type = style.get("attack_type", "").lower()
        attack_bonus = gear["offensive"].get(attack_type, 0)
        max_attack_roll = effective_attack * (attack_bonus + 64)
        
        defence_bonus = monster["defensive"].get('light', 0)
        # print(f"Ranged defence bonus: {defence_bonus}")
        max_defence_roll = (monster["skills"]["def"] + 9) * (defence_bonus + 64)
        accuracy_multiplier = 1.0
        if player["gearSets"]["ranged"].get("selectedWeapon", {}).get("name", "").lower() == "twisted bow":
            accuracy_multiplier = (140 + ((((10 * 3 * monster["skills"]["magic"]) / 10) - 10) / 100) - (((((3 * monster["skills"]["magic"]) / 10) - 100) ** 2) / 100)) / 100
            accuracy_multiplier = max(1.0, min(accuracy_multiplier, 1.40))
            max_attack_roll = int(max_attack_roll * accuracy_multiplier)
            # print(f"Ranged max attack roll: {max_attack_roll}")
    else:
        raise ValueError("Unsupported gear_type")

    if max_attack_roll > max_defence_roll:
        accuracy = 1.0 - (max_defence_roll + 2) / (2.0 * (max_attack_roll + 1))
    else:
        accuracy = max_attack_roll / (2.0 * (max_defence_roll + 1))
    # print(f"Accuracy: {accuracy}, Effective Attack: {effective_attack}, Max Attack Roll: {max_attack_roll}, Max Defence Roll: {max_defence_roll}")
    return accuracy, effective_attack, max_attack_roll, max_defence_roll

def find_best_combat_style(player, monster, gear_type):
    best_style = None
    best_dps = 0.0
    gear_set = player["gearSets"].get(gear_type)
    if not gear_set:
        return None
    weapon = gear_set.get("selectedWeapon")
    gear_stats = gear_set.get("gearStats")
    if weapon and gear_stats:
        for style in weapon.get("weapon_styles", []):
            max_hit, effective_strength = calculate_max_hit_for_style(player, monster, style, gear_stats, gear_type=gear_type)
            accuracy, effective_attack, max_attack_roll, max_defence_roll = calculate_accuracy_for_style(player, monster, style, gear_stats, gear_type=gear_type)
            effective_dps = max_hit * accuracy
            style_result = {
                "gear_type": gear_type,
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
    return best_style