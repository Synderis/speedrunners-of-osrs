import json
from supabase import create_client, Client
from supabase_temp_credentials import SUPABASE_URL, SUPABASE_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def extract_item_fields(item):
    return {
        "id": item["id"],
        "name": item.get("name"),
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

# Load the items JSON (dict of dicts)
with open("items-complete.json", "r") as f:
    items_dict = json.load(f)

items_list = [extract_item_fields(item) for item in items_dict.values()]

batch_size = 10000
start_batch = 0  # 0-based index, so 0 means start at the first batch
for i in range(start_batch * batch_size, len(items_list), batch_size):
    batch = items_list[i:i+batch_size]
    supabase.table("items").insert(batch).execute()

print(f"All items loaded into Supabase starting from batch {start_batch+1} (index {start_batch * batch_size}).")