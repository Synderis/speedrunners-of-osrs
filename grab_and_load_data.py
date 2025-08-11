import json
from supabase import create_client, Client
from supabase_temp_credentials import SUPABASE_URL, SUPABASE_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Load JSON files
with open("monster_json.json", "r") as f:
    monster = json.load(f)
with open("weapon_json.json", "r") as f:
    weapon = json.load(f)
with open("armor.json", "r") as f:
    armor = json.load(f)


def extract_monster_fields(monster):
    return {
        "id": monster["id"],
        "name": monster["name"],
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
        "attack_type": monster.get("attack_type"),
        "attributes": monster.get("attributes"),
        "category": monster.get("category"),
        "slayer_masters": monster.get("slayer_masters"),
    }

def extract_item_fields(item):
    return {
        "id": item["id"],
        "name": item["name"],
        "cost": item.get("cost"),
        "weight": item.get("weight"),
        "equipable": item.get("equipable"),
        "equipable_weapon": item.get("equipable_weapon"),
        "tradeable": item.get("tradeable"),
        "release_date": item.get("release_date"),
        "examine": item.get("examine"),
        "icon": item.get("icon"),
        "wiki_name": item.get("wiki_name"),
        "wiki_url": item.get("wiki_url"),
        "last_updated": item.get("last_updated"),
        "equipment": item.get("equipment"),
        "weapon": item.get("weapon"),
        }
# Insert monster into 'monsters' table
supabase.table("monsters").insert(extract_monster_fields(monster)).execute()

# Insert weapon and armor into 'items' table
supabase.table("items").insert(extract_item_fields(weapon)).execute()
supabase.table("items").insert(extract_item_fields(armor)).execute()

print("Data loaded into Supabase.")