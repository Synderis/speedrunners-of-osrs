import json
from supabase import create_client, Client
from supabase_temp_credentials import SUPABASE_URL, SUPABASE_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def insert_equipment_and_weapon_from_items():

    # Load the equipment JSON from temp2.json using absolute path
    with open(r'c:\Users\Dylan\osrs_sim\temp2.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Prepare all rows for bulk insert
    rows = []
    for item in data:
        row = {
            'item_id': item.get('id'),
            'name': item.get('name'),
            'version': item.get('version'),
            'slot': item.get('slot'),
            'image': item.get('image'),
            'speed': item.get('speed'),
            'category': item.get('category'),
            'two_handed': bool(item.get('two_handed', False)),
            'bonus_str': item.get('bonuses', {}).get('str'),
            'bonus_ranged_str': item.get('bonuses', {}).get('ranged_str'),
            'bonus_magic_str': item.get('bonuses', {}).get('magic_str'),
            'bonus_prayer': item.get('bonuses', {}).get('prayer'),
            'off_stab': item.get('offensive', {}).get('stab'),
            'off_slash': item.get('offensive', {}).get('slash'),
            'off_crush': item.get('offensive', {}).get('crush'),
            'off_magic': item.get('offensive', {}).get('magic'),
            'off_ranged': item.get('offensive', {}).get('ranged'),
            'def_stab': item.get('defensive', {}).get('stab'),
            'def_slash': item.get('defensive', {}).get('slash'),
            'def_crush': item.get('defensive', {}).get('crush'),
            'def_magic': item.get('defensive', {}).get('magic'),
            'def_ranged': item.get('defensive', {}).get('ranged'),
        }
        rows.append(row)
    # Bulk insert all rows at once
    resp = supabase.table('equipment').insert(rows).execute()
    print(f'Bulk inserted {len(rows)} equipment items:', resp)

if __name__ == "__main__":
    insert_equipment_and_weapon_from_items()
    print("Equipment, weapon, and weapon_stances tables populated from items table.")
