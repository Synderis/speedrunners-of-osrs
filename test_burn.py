import numpy as np
import math
import random
import matplotlib.pyplot as plt

trials = 100000
hit_count_dict = {120: 0, 118:0, 116:0, 114:0}
for i in range(trials):
    base_ovl_tick = np.random.randint(1, 26)
    base_5t_attack = np.random.randint(0, 5)
    # base_5t_attack = 1
    # print("Base ovl tick:", base_ovl_tick, "Base 5t attack:", base_5t_attack)
    base_lvl = 120
    burn_tick_total = 48
    tick_count = 0
    while burn_tick_total > 0:
        tick_count += 1
        if burn_tick_total % 8 == 0:
            # print("Level drop at tick", tick_count)
            base_lvl -= 2
        if tick_count == base_ovl_tick:
            # print("OVL at tick", tick_count)
            base_ovl_tick += 25
            base_lvl = 120
        if tick_count % 5 == base_5t_attack:
            # print("HIT at tick", tick_count, "with level", base_lvl, "and", burn_tick_total, "ticks remaining")
            if base_lvl not in hit_count_dict:
                hit_count_dict[base_lvl] = 1
            else: 
                hit_count_dict[base_lvl] += 1
        burn_tick_total -= 1
hits = 0
hits_prob = 0
for key in hit_count_dict:
    hit_count_dict[key] = hit_count_dict[key] / trials
    hits += hit_count_dict[key]
print("Total Hit Probability:", hits)
print(hit_count_dict)

for key in hit_count_dict:
    hit_count_dict[key] = hit_count_dict[key] / hits
    hits_prob += hit_count_dict[key]
    hit_count_dict[key] = round(hit_count_dict[key], 5)
print("Total Hit Probability:", round(hits_prob, 4))
print(hit_count_dict)

# for key in hit_count_dict_10:
#     hit_count_dict_10[key] = hit_count_dict_10[key] / 10
#     hits10 += hit_count_dict_10[key]
# print("Total Hit Probability (10):", hits10)
# print(hit_count_dict_10)