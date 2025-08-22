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

def calculate_max_hit_for_style(player, style, gear):
    strength_level = player["combatStats"]["strength"]
    potion_bonus = 21.0
    prayer_strength_bonus = 1.23
    style_bonus = style.get("str", 0)
    void_bonus = 1.0
    effective_strength = int(((strength_level + potion_bonus) * prayer_strength_bonus + style_bonus + 8.0) * void_bonus)
    strength_bonus = gear["bonuses"]["str"]
    max_hit = int(0.5 + (effective_strength * (strength_bonus + 64.0)) / 640.0)
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

def find_best_combat_style(player, monster):
    best_style = None
    best_dps = 0.0
    melee = player["gearSets"]["melee"]
    weapon = melee.get("selectedWeapon")
    if weapon:
        for style in weapon["weapon_styles"]:
            max_hit, effective_strength = calculate_max_hit_for_style(player, style, melee["gearStats"])
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
        max_hit = int(0.5 + (effective_strength * (strength_bonus + 64.0)) / 640.0)
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

def simulate_ttk(monster_hp, max_hit, accuracy, attack_speed, trials=100_000):
    # This function is not used in main, so leave as is for now
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
    with open("test_tekton.json", "r") as f:
        payload = json.load(f)
    player = payload["player"]
    # Fix: get monster from room
    monster = payload["room"]["monsters"][0]

    # --- Weapon swap simulation for first two hits ---
    # Get original weapon and Elder maul from inventory
    melee = player["gearSets"]["melee"]
    orig_weapon = melee["selectedWeapon"]
    orig_bonuses = melee["gearStats"]["bonuses"].copy()
    orig_offensive = melee["gearStats"]["offensive"].copy()
    orig_defensive = melee["gearStats"]["defensive"].copy()
    # Find Elder maul in inventory
    elder_maul = None
    for item in payload["player"].get("inventory", []):
        eq = item.get("equipment")
        if eq and eq.get("name", "").lower() == "elder maul":
            elder_maul = eq
            break
    if not elder_maul:
        raise Exception("Elder maul not found in inventory!")
    # Get Elder maul's bonuses
    em_bonuses = elder_maul["bonuses"]
    em_offensive = elder_maul["offensive"]
    em_defensive = elder_maul["defensive"]
    # Use best style for each weapon
    def get_best_style(weapon):
        best = None
        best_str = -9999
        for ws in weapon["weapon_styles"]:
            if ws.get("str", 0) > best_str:
                best = ws
                best_str = ws.get("str", 0)
        return best
    orig_style = get_best_style(orig_weapon)
    em_style = get_best_style(elder_maul)
    # Prepare gear dicts for each weapon
    def apply_bonuses(base, add, sign=1):
        for k in base:
            base[k] += sign * add.get(k, 0)
    # Simulation for empirical TTK and cumulative kill probability
    trials = 100_000
    max_attacks = 100
    kill_attack_counts = []
    for _ in range(trials):
        hp = monster["skills"]["hp"]
        attacks = 0
        # Copy gear for this trial
        gear_bonuses = orig_bonuses.copy()
        gear_offensive = orig_offensive.copy()
        gear_defensive = orig_defensive.copy()
        weapon = orig_weapon
        style = orig_style
        # Save original monster defense
        orig_monster_def = monster["skills"]["def"]
        # First hit: 35% defense reduction
        curr_monster_def = int(orig_monster_def * 0.65)
        # Remove original weapon bonuses
        apply_bonuses(gear_bonuses, orig_weapon["bonuses"], -1)
        apply_bonuses(gear_offensive, orig_weapon["offensive"], -1)
        apply_bonuses(gear_defensive, orig_weapon["defensive"], -1)
        # Add Elder maul bonuses
        apply_bonuses(gear_bonuses, em_bonuses, 1)
        apply_bonuses(gear_offensive, em_offensive, 1)
        apply_bonuses(gear_defensive, em_defensive, 1)
        weapon = elder_maul
        style = em_style
        # Use reduced defense for this attack
        monster_for_attack = dict(monster)
        monster_for_attack["skills"] = dict(monster["skills"])
        monster_for_attack["skills"]["def"] = curr_monster_def
        max_hit, _ = calculate_max_hit_for_style(player, style, {"bonuses": gear_bonuses, "offensive": gear_offensive, "defensive": gear_defensive})
        accuracy, _, _, _ = calculate_accuracy_for_style(player, monster_for_attack, style, {"bonuses": gear_bonuses, "offensive": gear_offensive, "defensive": gear_defensive})
        accuracy = min(accuracy * 1.25, 1.0)
        attack_speed = weapon.get("speed", 6)
        attacks += 1
        if np.random.rand() < accuracy:
            hit = np.random.randint(0, max_hit + 1)
            hit_landed = True
        else:
            hit = 0
            hit_landed = False
        hp -= hit
        # Remove Elder maul bonuses, add back original for next attack
        apply_bonuses(gear_bonuses, em_bonuses, -1)
        apply_bonuses(gear_offensive, em_offensive, -1)
        apply_bonuses(gear_defensive, em_defensive, -1)
        apply_bonuses(gear_bonuses, orig_weapon["bonuses"], 1)
        apply_bonuses(gear_offensive, orig_weapon["offensive"], 1)
        apply_bonuses(gear_defensive, orig_weapon["defensive"], 1)
        weapon = orig_weapon
        style = orig_style
        if hp <= 0:
            kill_attack_counts.append(attacks)
            continue
        # Second hit: 35% defense reduction if hit, else 5%, applied to already reduced defense
        apply_bonuses(gear_bonuses, orig_weapon["bonuses"], -1)
        apply_bonuses(gear_offensive, orig_weapon["offensive"], -1)
        apply_bonuses(gear_defensive, orig_weapon["defensive"], -1)
        apply_bonuses(gear_bonuses, em_bonuses, 1)
        apply_bonuses(gear_offensive, em_offensive, 1)
        apply_bonuses(gear_defensive, em_defensive, 1)
        weapon = elder_maul
        style = em_style
        if hit_landed:
            curr_monster_def = int(curr_monster_def * 0.65)
        else:
            curr_monster_def = int(curr_monster_def * 0.95)
        monster_for_attack2 = dict(monster)
        monster_for_attack2["skills"] = dict(monster["skills"])
        monster_for_attack2["skills"]["def"] = curr_monster_def
        max_hit, _ = calculate_max_hit_for_style(player, style, {"bonuses": gear_bonuses, "offensive": gear_offensive, "defensive": gear_defensive})
        accuracy, _, _, _ = calculate_accuracy_for_style(player, monster_for_attack2, style, {"bonuses": gear_bonuses, "offensive": gear_offensive, "defensive": gear_defensive})
        accuracy = min(accuracy * 1.25, 1.0)
        attack_speed = weapon.get("speed", 6)
        attacks += 1
        if np.random.rand() < accuracy:
            hit = np.random.randint(0, max_hit + 1)
        else:
            hit = 0
        hp -= hit
        # Remove Elder maul bonuses, add back original for next attack
        apply_bonuses(gear_bonuses, em_bonuses, -1)
        apply_bonuses(gear_offensive, em_offensive, -1)
        apply_bonuses(gear_defensive, em_defensive, -1)
        apply_bonuses(gear_bonuses, orig_weapon["bonuses"], 1)
        apply_bonuses(gear_offensive, orig_weapon["offensive"], 1)
        apply_bonuses(gear_defensive, orig_weapon["defensive"], 1)
        weapon = orig_weapon
        style = orig_style
        if hp <= 0:
            kill_attack_counts.append(attacks)
            continue
        # All subsequent attacks use the final reduced defense
        while hp > 0 and attacks < max_attacks:
            monster_for_attack3 = dict(monster)
            monster_for_attack3["skills"] = dict(monster["skills"])
            monster_for_attack3["skills"]["def"] = curr_monster_def
            max_hit, _ = calculate_max_hit_for_style(player, style, {"bonuses": gear_bonuses, "offensive": gear_offensive, "defensive": gear_defensive})
            accuracy, _, _, _ = calculate_accuracy_for_style(player, monster_for_attack3, style, {"bonuses": gear_bonuses, "offensive": gear_offensive, "defensive": gear_defensive})
            attack_speed = weapon.get("speed", 5)
            attacks += 1
            if np.random.rand() < accuracy:
                hit = np.random.randint(0, max_hit + 1)
            else:
                hit = 0
            hp -= hit
        kill_attack_counts.append(attacks)
        # Remaining attacks: use original weapon
        while hp > 0 and attacks < max_attacks:
            max_hit, _ = calculate_max_hit_for_style(player, style, {"bonuses": gear_bonuses, "offensive": gear_offensive, "defensive": gear_defensive})
            accuracy, _, _, _ = calculate_accuracy_for_style(player, monster, style, {"bonuses": gear_bonuses, "offensive": gear_offensive, "defensive": gear_defensive})
            attack_speed = weapon.get("speed", 5)
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
    # Use correct attack speed for plotting (approximate: use original weapon's speed)
    attack_ticks = [i * orig_weapon.get("speed", 5) for i in range(max_attacks)]

    mean_ttk = np.mean([a * orig_weapon.get("speed", 5) for a in kill_attack_counts])
    std_ttk = np.std([a * orig_weapon.get("speed", 5) for a in kill_attack_counts])
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
    fig.show()
