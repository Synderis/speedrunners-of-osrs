import numpy as np

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

hp = 210
base_hp = 210

trials = 100000
tick_counts = []
for i in range(trials):
    hp = base_hp
    total_ticks = 0
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
    while hp > 0:
        time_after_dump += 1

        # Simulate chopping for second burner
        if burner_2_count == 0 and kindling_count < 23:
            if (time_after_dump - 1) % 5 == 0:
                kindling_count += np.random.randint(1, 9)
            if kindling_count >= 23:
                burner_2_count = kindling_count
                kindling_count = 0
                time_after_dump += 12  # time to dump into second burner

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
            time_after_dump += 6
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

            hp += heal_total * base_hp
            hp -= drain_total * base_hp
            if hp > base_hp:
                hp = base_hp

        if hp <= 0:
            break

    total_ticks += time_after_dump - 1
    tick_counts.append(total_ticks)

# print(f"Total ticks: {total_ticks}")
print(f"Average ticks per trial: {np.mean(tick_counts):.2f}")
print(f"Std Dev of ticks: {np.std(tick_counts):.2f}")
print(f"Max ticks in a trial: {np.max(tick_counts)}")