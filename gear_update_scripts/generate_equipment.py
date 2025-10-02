import os
import requests
import json
import urllib.parse
import base64
from exclusion_aliases import *
import boto3
from botocore.exceptions import ClientError

FILE_NAME = 'equipment.json'
IMAGE_MAP_FILE = 'gear_image_map.json'
WIKI_BASE = 'https://oldschool.runescape.wiki'
API_BASE = WIKI_BASE + '/api.php'

BUCKET_API_FIELDS = [
    'page_name',
    'page_name_sub',
    'item_name',
    'image',
    'item_id',
    'version_anchor',
    'infobox_bonuses.crush_attack_bonus',
    'infobox_bonuses.crush_defence_bonus',
    'infobox_bonuses.equipment_slot',
    'infobox_bonuses.magic_damage_bonus',
    'infobox_bonuses.magic_attack_bonus',
    'infobox_bonuses.magic_defence_bonus',
    'infobox_bonuses.prayer_bonus',
    'infobox_bonuses.range_attack_bonus',
    'infobox_bonuses.ranged_strength_bonus',
    'infobox_bonuses.range_defence_bonus',
    'infobox_bonuses.slash_attack_bonus',
    'infobox_bonuses.slash_defence_bonus',
    'infobox_bonuses.stab_attack_bonus',
    'infobox_bonuses.stab_defence_bonus',
    'infobox_bonuses.strength_bonus',
    'infobox_bonuses.weapon_attack_range',
    'infobox_bonuses.weapon_attack_speed',
    'infobox_bonuses.combat_style',
]

ITEMS_TO_SKIP = [
    'The dogsword',
    'Drygore blowpipe',
    'Amulet of the monarchs',
    'Emperor ring',
    "Devil's element",
    "Nature's reprisal",
    'Gloves of the damned',
    'Crystal blessing',
    'Sunlight spear',
    'Sunlit bracers',
    'Thunder khopesh',
    'Thousand-dragon ward',
    'Arcane grimoire',
    'Wristbands of the arena',
    'Wristbands of the arena (i)',
    'Armadyl chainskirt (or)',
    'Armadyl chestplate (or)',
    'Armadyl helmet (or)',
    "Dagon'hai hat (or)",
    "Dagon'hai robe bottom (or)",
    "Dagon'hai robe top (or)",
    'Dragon warhammer (or)',
    'Centurion cuirass'
]

# Equipment name exclusions - items with these substrings will be filtered out
EQUIPMENT_NAME_EXCLUSIONS = get_name_substring_exclusions()

# Equipment ID exclusions - variant item IDs that should be filtered out
EQUIPMENT_ID_EXCLUSIONS = get_name_aliases()

def resolve_base_item_id(item_id):
    """
    Given an item ID, returns the base item ID if it's a known variant, else returns the original.
    """
    # Create reverse mapping
    reverse_map = {}
    for base_id, variants in EQUIPMENT_ID_EXCLUSIONS.items():
        for variant in variants:
            reverse_map[str(variant)] = str(base_id)
    
    return reverse_map.get(str(item_id), str(item_id))

def is_excluded_by_name(name):
    """Check if an item name contains any exclusion patterns"""
    return any(exclusion in name for exclusion in EQUIPMENT_NAME_EXCLUSIONS)

def get_magic_damage_value(prop):
    """Convert magic damage bonus to the expected format"""
    if prop is None:
        return None
    try:
        return round(float(prop) * 10)
    except (ValueError, TypeError):
        return None

def image_to_base64(image_url):
    """Download image and convert to base64"""
    try:
        r = requests.get(image_url, headers={
            'User-Agent': 'osrs-dps-calc (https://github.com/weirdgloop/osrs-dps-calc)'
        })
        if r.ok:
            return base64.b64encode(r.content).decode('utf-8')
        else:
            print(f'Unable to fetch image: {image_url}')
            return None
    except Exception as e:
        print(f'Error fetching image {image_url}: {e}')
        return None

def upload_to_s3(file_content, filename, bucket_name):
    """Upload file content to AWS S3 bucket"""
    s3 = boto3.client('s3')
    try:
        s3.put_object(
            Bucket=bucket_name,
            Key=filename,
            Body=file_content.encode('utf-8'),
            ContentType='application/json'
        )
        print(f'Successfully uploaded {filename} to S3 bucket {bucket_name}')
        return True
    except ClientError as e:
        print(f'Failed to upload {filename} to S3: {e}')
        return False

def getEquipmentData():
    equipment = []
    offset = 0
    fields_csv = ",".join(f"'{field}'" for field in BUCKET_API_FIELDS)
    while True:
        print('Fetching equipment info: ' + str(offset))
        query = {
            'action': 'bucket',
            'format': 'json',
            'query': 
            (
                f"bucket('infobox_item')"
                f".select({fields_csv})"
                f".limit(5000).offset({offset})"
                f".where('infobox_bonuses.equipment_slot', '!=', bucket.Null())"
                f".where('item_id', '!=', bucket.Null())"
                f".join('infobox_bonuses', 'infobox_bonuses.page_name_sub', 'infobox_item.page_name_sub')"
                f".orderBy('page_name_sub', 'asc').run()"
            )
        }

        r = requests.get(API_BASE + '?' + urllib.parse.urlencode(query), headers={
            'User-Agent': 'osrs-dps-calc (https://github.com/weirdgloop/osrs-dps-calc)'
        })

        data = r.json()
        batch = data.get('bucket', [])
        equipment.extend(batch)

        if len(batch) < 5000:
            print('Finished fetching all equipment data.')
            break
        offset += 5000

    return equipment

def update_and_upload_image_map(filtered_result, BUCKET_NAME, IMAGE_MAP_FILE):
    import io

    s3 = boto3.client('s3')

    # 1. Download the current image map from S3
    try:
        obj = s3.get_object(Bucket=BUCKET_NAME, Key=IMAGE_MAP_FILE)
        image_map_json = obj['Body'].read().decode('utf-8')
        image_map = json.loads(image_map_json)
    except s3.exceptions.NoSuchKey:
        print("No existing image map found, starting fresh.")
        image_map = {}
    except Exception as e:
        print(f"Error downloading image map: {e}")
        image_map = {}

    # 2. Find all required images from equipment.json
    required_imgs = set(item['image'] for item in filtered_result if item.get('image'))

    # 3. Find missing images
    missing_imgs = required_imgs - set(image_map.keys())
    print(f"Missing images to fetch: {missing_imgs}")

    # 4. Fetch, encode, and add missing images
    for img in missing_imgs:
        image_url = WIKI_BASE + '/w/Special:Filepath/' + img
        base64_data = image_to_base64(image_url)
        if base64_data:
            image_map[img] = base64_data
            print(f"Added {img} to image map.")
        else:
            print(f"Failed to fetch/encode {img}")

    # 5. Save and upload updated image map
    updated_image_map_json = json.dumps(image_map, ensure_ascii=False, indent=2)
    upload_to_s3(updated_image_map_json, IMAGE_MAP_FILE, BUCKET_NAME)
    print("Updated image map uploaded.")

def lambda_handler(event, context):
    # Grab the equipment info using Bucket
    wiki_data = getEquipmentData()

    result = []
    required_imgs = []

    # Get all variant IDs for filtering
    all_variant_ids = set()
    for variants in EQUIPMENT_ID_EXCLUSIONS.values():
        all_variant_ids.update(str(v) for v in variants)

    # Handle item_id as list or string/int, always prefer base ID if present
    def extract_preferred_item_id(item_id):
        # Convert stringified list to list
        if isinstance(item_id, str) and item_id.startswith('[') and item_id.endswith(']'):
            try:
                parsed = json.loads(item_id.replace("'", '"'))
                item_id = parsed
            except Exception:
                pass

        # If it's a list, prefer the base ID if present
        if isinstance(item_id, list):
            # Convert all to str for comparison
            ids = [str(x) for x in item_id]
            # Find the first base ID (not in any variant list)
            for id_candidate in ids:
                if id_candidate not in all_variant_ids:
                    return id_candidate
            # Fallback: just use the first
            return ids[0] if ids else None
        # Otherwise, just return as str
        return str(item_id) if item_id is not None else None

    # Loop over the equipment data from the wiki
    for item in wiki_data:
        try:
            item_id = item.get('item_id')
            if not item_id:
                continue

            item_id = extract_preferred_item_id(item_id)
            if not item_id:
                continue

            # Skip non-integer item_ids
            try:
                item_id_int = int(resolve_base_item_id(item_id))
            except ValueError:
                print(f"SKIPPED: {item.get('page_name') or item.get('item_name')} (item_id: {item_id}) - resolve_base_item_id: {resolve_base_item_id(item_id)}")
                continue

            name = item.get('page_name') or item.get('item_name') or ''

            # Skip if item ID is a variant in the exclusion list
            if str(item_id) in all_variant_ids:
                continue

            slot = item.get('infobox_bonuses.equipment_slot') or ''
            two_handed = False
            if slot == '2h':
                slot = 'weapon'
                two_handed = True

            version = item.get('version_anchor') or ''
            if version == 'Nightmare Zone':
                version = ''

            # Skip Last Man Standing items
            if '(Last Man Standing)' in name:
                continue
                
            # Skip items in the exclusion list
            if name in ITEMS_TO_SKIP:
                continue
                
            # Skip Keris partisan special case
            if 'Keris partisan of amascut' in name and 'Outside ToA' in item.get('page_name_sub', ''):
                continue
                
            # Skip items with excluded name patterns
            if is_excluded_by_name(name):
                continue
                
            # Version filtering
            version_lower = version.lower()
            allowed_versions = ['', 'unpoisoned', 'normal', 'recoil', 'activated', 'undamaged', 'charged', 'restored', 'active']
            if version_lower not in allowed_versions:
                continue

            # Handle image field as list or string, remove "File:" prefix
            raw_image = item.get('image')
            img = ''
            if isinstance(raw_image, list) and raw_image:
                img = raw_image[0]
            elif isinstance(raw_image, str):
                img = raw_image
            if img.startswith('File:'):
                img = img[len('File:'):]

            equipment_item = {
                'name': name,
                'id': item_id_int,
                'version': version,
                'slot': slot,
                'image': img,
                'speed': int(item.get('infobox_bonuses.weapon_attack_speed') or 0),
                'category': item.get('infobox_bonuses.combat_style') or '',
                'bonuses': {
                    'str': item.get('infobox_bonuses.strength_bonus'),
                    'ranged_str': item.get('infobox_bonuses.ranged_strength_bonus'),
                    'magic_str': get_magic_damage_value(item.get('infobox_bonuses.magic_damage_bonus')),
                    'prayer': item.get('infobox_bonuses.prayer_bonus'),
                },
                'offensive': {
                    'stab': item.get('infobox_bonuses.stab_attack_bonus'),
                    'slash': item.get('infobox_bonuses.slash_attack_bonus'),
                    'crush': item.get('infobox_bonuses.crush_attack_bonus'),
                    'magic': item.get('infobox_bonuses.magic_attack_bonus'),
                    'ranged': item.get('infobox_bonuses.range_attack_bonus'),
                },
                'defensive': {
                    'stab': item.get('infobox_bonuses.stab_defence_bonus'),
                    'slash': item.get('infobox_bonuses.slash_defence_bonus'),
                    'crush': item.get('infobox_bonuses.crush_defence_bonus'),
                    'magic': item.get('infobox_bonuses.magic_defence_bonus'),
                    'ranged': item.get('infobox_bonuses.range_defence_bonus'),
                },
                'two_handed': two_handed,
            }

            # Filter: skip if all bonuses, offensive, and defensive stats are 0 or negative
            b = equipment_item['bonuses']
            o = equipment_item['offensive']
            d = equipment_item['defensive']
            all_stats = [
                b['str'], b['ranged_str'], b['magic_str'], b['prayer'],
                o['stab'], o['slash'], o['crush'], o['magic'], o['ranged'],
                d['stab'], d['slash'], d['crush'], d['magic'], d['ranged']
            ]
            
            excluded_ids = {'25975', '2550'}
            item_id_str = str(equipment_item['id'])

            # Filter: skip if all bonuses are negative or zero (no positive stat)
            all_negative = all(val is None or float(val or 0) <= 0 for val in all_stats)
            if all_negative and item_id_str not in excluded_ids:
                continue

            result.append(equipment_item)
            
            # Only add image if it's a string
            img = equipment_item['image']
            if isinstance(img, str) and img:
                required_imgs.append(img)

        except Exception as e:
            print(f"Error processing item: {e}")
            continue

    # Remove any items whose id appears as a variant in the alias list
    filtered_result = [item for item in result if str(item['id']) not in all_variant_ids]
    
    # Sort by name
    filtered_result.sort(key=lambda x: x['name'])

    print('Total equipment: ' + str(len(filtered_result)))

    # Create JSON strings for both files
    equipment_json = json.dumps(filtered_result, ensure_ascii=False, indent=2)
    # image_map_json = json.dumps(image_map, ensure_ascii=False, indent=2)

    # Upload to Supabase
    print('\nUploading files to Supabase storage...')
    BUCKET_NAME = 'osrs-sim-data-synderis'
    print('\nUploading files to AWS S3...')
    equipment_uploaded = upload_to_s3(equipment_json, FILE_NAME, BUCKET_NAME)
    print(f'Equipment JSON uploaded: {"✓" if equipment_uploaded else "✗"}')
    
    # Update and upload image map if needed
    update_and_upload_image_map(filtered_result, BUCKET_NAME, IMAGE_MAP_FILE)