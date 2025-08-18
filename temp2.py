# import pandas as pd

# df = pd.read_csv('image_sets.csv')

# supabase_set = set(df['supabase_images'].dropna().astype(str).str.strip())
# local_set = set(df['local_images'].dropna().astype(str).str.strip())

# missing_in_supabase = local_set - supabase_set
# missing_locally = supabase_set - local_set

# print("Missing in Supabase:", sorted(missing_in_supabase))
# print("Missing locally:", sorted(missing_locally))

import pandas as pd

df = pd.read_csv('image_sets.csv')

# Find rows where 'Zombie shirt.png' appears as a substring in either column (case-insensitive)
mask = df['supabase_images'].astype(str).str.contains('Zombie', case=False, na=False) | \
       df['local_images'].astype(str).str.contains('Zombie', case=False, na=False)

rows = df[mask]
print(rows)