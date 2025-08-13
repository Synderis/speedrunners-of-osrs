import json
from supabase import create_client, Client
from supabase_temp_credentials import SUPABASE_URL, SUPABASE_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def extract_monster_fields(monster):
    return {
        "id": monster["id"],
        "name": monster.get("name"),
        "combat_level": monster.get("combat_level"),
        "hitpoints": monster.get("hitpoints"),
        "max_hit": monster.get("max_hit"),
        "attack_speed": monster.get("attack_speed"),
        "slayer_level": monster.get("slayer_level"),
        "slayer_xp": monster.get("slayer_xp"),
        "attack_level": monster.get("attack_level"),
        "strength_level": monster.get("strength_level"),
        "defence_level": monster.get("defence_level"),
        "magic_level": monster.get("magic_level"),
        "ranged_level": monster.get("ranged_level"),
        "defence_stab": monster.get("defence_stab"),
        "defence_slash": monster.get("defence_slash"),
        "defence_crush": monster.get("defence_crush"),
        "defence_magic": monster.get("defence_magic"),
        "defence_ranged": monster.get("defence_ranged"),
        "last_updated": monster.get("last_updated"),
        "release_date": monster.get("release_date"),
        "examine": monster.get("examine"),
        "wiki_name": monster.get("wiki_name"),
        "wiki_url": monster.get("wiki_url"),
        "attack_type": monster.get("attack_type"),  # JSONB field
        "attributes": monster.get("attributes"),    # JSONB field
        "category": monster.get("category"),        # JSONB field
        "slayer_masters": monster.get("slayer_masters")  # JSONB field
    }

# Load the monsters JSON (dict of dicts)
with open("monsters-complete(1).json", "r") as f:
    monsters_dict = json.load(f)

monsters_list = [extract_monster_fields(monster) for monster in monsters_dict.values()]

batch_size = 100  # Smaller batch size for monsters since they have more complex data
start_batch = 0  # 0-based index, so 0 means start at the first batch

for i in range(start_batch * batch_size, len(monsters_list), batch_size):
    batch = monsters_list[i:i+batch_size]
    try:
        result = supabase.table("monsters").insert(batch).execute()
        print(f"Loaded batch {(i // batch_size) + 1}: {len(batch)} monsters")
    except Exception as e:
        print(f"Error loading batch {(i // batch_size) + 1}: {e}")
        # Optionally, you can continue with the next batch or break
        continue

print(f"All monsters loaded into Supabase starting from batch {start_batch+1} (index {start_batch * batch_size}).")