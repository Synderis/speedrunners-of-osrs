import pandas as pd

# Load CSVs
# df12 = pd.read_csv("floor1_plus_floor2_plus_floor3.csv")
df12 = pd.read_csv("floor1_plus_floor2.csv")
df3o = pd.read_csv("olm.csv")

target = 2300

# For each time in floor1+floor2, compute probability of finishing floor3+olm in remaining time
threshold_time = None
for idx, row in df12.iterrows():
    t = row['time']
    p12 = row['probability']
    remaining = target - t
    # Find probability for floor3+olm in remaining time
    df3o_sub = df3o[df3o['time'] <= remaining]
    p3o = df3o_sub['probability'].max() if not df3o_sub.empty else 0.0
    # If probability of finishing from here is less than restarting, mark threshold
    if p12 < p3o:
        threshold_time = t
        break

if threshold_time is not None:
    print(f"Threshold time for floor1+floor2: {threshold_time} ticks")
else:
    print("It is always optimal to continue (no threshold found).")