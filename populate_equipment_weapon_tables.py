import json
from supabase import create_client, Client
from supabase_temp_credentials import SUPABASE_URL, SUPABASE_KEY

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def insert_equipment_and_weapon_from_items():
    # Fetch all items with equipment or weapon blocks
    items = supabase.table("items").select("id, equipment, weapon").execute().data
    for item in items:
        item_id = item["id"]
        # Insert equipment if present
        equipment = item.get("equipment")
        if equipment:
            eq_row = {
                "item_id": item_id,
                "attack_stab": equipment.get("attack_stab"),
                "attack_slash": equipment.get("attack_slash"),
                "attack_crush": equipment.get("attack_crush"),
                "attack_magic": equipment.get("attack_magic"),
                "attack_ranged": equipment.get("attack_ranged"),
                "defence_stab": equipment.get("defence_stab"),
                "defence_slash": equipment.get("defence_slash"),
                "defence_crush": equipment.get("defence_crush"),
                "defence_magic": equipment.get("defence_magic"),
                "defence_ranged": equipment.get("defence_ranged"),
                "melee_strength": equipment.get("melee_strength"),
                "ranged_strength": equipment.get("ranged_strength"),
                "magic_damage": equipment.get("magic_damage"),
                "prayer": equipment.get("prayer"),
                "slot": equipment.get("slot"),
                "requirements": equipment.get("requirements"),
            }
            supabase.table("equipment").insert(eq_row).execute()
        # Insert weapon if present
        weapon = item.get("weapon")
        if weapon:
            weap_row = {
                "item_id": item_id,
                "attack_speed": weapon.get("attack_speed"),
                "weapon_type": weapon.get("weapon_type"),
                "stances": weapon.get("stances"),
            }
            # Insert weapon and get the inserted weapon row (to get weapon.id)
            weapon_insert = supabase.table("weapon").insert(weap_row).execute()
            # Get the weapon table id (serial PK)
            weapon_table_id = None
            if weapon_insert.data and len(weapon_insert.data) > 0:
                weapon_table_id = weapon_insert.data[0]["id"]
            # Insert stances if present
            stances = weapon.get("stances")
            if stances and weapon_table_id:
                for stance in stances:
                    stance_row = {
                        "weapon_id": weapon_table_id,
                        "combat_style": stance.get("combat_style"),
                        "attack_type": stance.get("attack_type"),
                        "attack_style": stance.get("attack_style"),
                        "experience": stance.get("experience"),
                        "boosts": stance.get("boosts"),
                    }
                    supabase.table("weapon_stances").insert(stance_row).execute()

if __name__ == "__main__":
    insert_equipment_and_weapon_from_items()
    print("Equipment, weapon, and weapon_stances tables populated from items table.")
