"""
    Script to generate an equipment.json of all the equipment on the OSRS Wiki, and downloads images for each item.
    The JSON file is placed in ../src/lib/equipment.json.

    The images are placed in ../cdn/equipment/. This directory is NOT included in the Next.js app bundle, and should
    be deployed separately to our file storage solution.

    Written for Python 3.9.
"""

import requests
import json
import urllib.parse
import time
import os
import glob
from supabase_temp_credentials import SUPABASE_URL, SUPABASE_KEY

from supabase import create_client, Client

FILE_NAME = '../cdn/json/equipment.json'
WIKI_BASE = 'https://oldschool.runescape.wiki'
API_BASE = WIKI_BASE + '/api.php'
IMG_PATH = '../cdn/equipment/'

REQUIRED_PRINTOUTS = [
    'Crush attack bonus',
    'Crush defence bonus',
    'Equipment slot',
    'Item ID',
    'Image',
    'Magic Damage bonus',
    'Magic attack bonus',
    'Magic defence bonus',
    'Prayer bonus',
    'Range attack bonus',
    'Ranged Strength bonus',
    'Range defence bonus',
    'Slash attack bonus',
    'Slash defence bonus',
    'Stab attack bonus',
    'Stab defence bonus',
    'Strength bonus',
    'Version anchor',
    'Weapon attack range',
    'Weapon attack speed',
    'Combat style'
]

ITEMS_TO_SKIP = [
    'The dogsword',
    'Drygore blowpipe',
    'Amulet of the monarchs',
    'Emperor ring',
    'Devil\'s element',
    'Nature\'s reprisal',
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
    'Dagon\'hai hat (or)',
    'Dagon\'hai robe bottom (or)',
    'Dagon\'hai robe top (or)',
    'Dragon warhammer (or)',
    'Centurion cuirass'
]

SUPABASE_BUCKET = os.environ.get('VITE_SUPABASE_BUCKET', 'data')

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def getEquipmentData():
    equipment = {}
    offset = 0
    while True:
        print('Fetching equipment info: ' + str(offset))
        query = {
            'action': 'ask',
            'format': 'json',
            'query': '[[Equipment slot::+]][[Item ID::+]]|?' + '|?'.join(REQUIRED_PRINTOUTS) + '|limit=5000|offset=' + str(offset)
        }
        r = requests.get(API_BASE + '?' + urllib.parse.urlencode(query), headers={
            'User-Agent': 'osrs-dps-calc (https://github.com/weirdgloop/osrs-dps-calc)'
        })
        data = r.json()

        if 'query' not in data or 'results' not in data['query']:
            # No results?
            break

        equipment = equipment | data['query']['results']

        if 'query-continue-offset' not in data or int(data['query-continue-offset']) < offset:
            # If we are at the end of the results, break out of this loop
            break
        else:
            offset = data['query-continue-offset']
    return equipment


def getPrintoutValue(prop):
    # SMW printouts are all arrays, so ensure that the array is not empty
    if not prop:
        return None
    else:
        return prop[0]


def getMagicDamageValue(prop):
    if not prop:
        return None
    else:
        return int(prop[0] * 10)




start_time = time.time()
# Grab the equipment info using SMW, including all the relevant printouts
wiki_data = getEquipmentData()

# Convert the data into our own JSON structure
data = []
required_imgs = []

# Loop over the equipment data from the wiki
for k, v in wiki_data.items():
    print('Processing ' + k)
    # Sanity check: make sure that this equipment has printouts from SMW
    if 'printouts' not in v:
        print(k + ' is missing SMW printouts - skipping.')
        continue

    po = v['printouts']
    item_id = getPrintoutValue(po['Item ID'])
    equipment = {
        'name': k.rsplit('#', 1)[0],
        'id': item_id,
        'version': getPrintoutValue(po['Version anchor']) or '',
        'slot': getPrintoutValue(po['Equipment slot']) or '',
        'image': '' if not po['Image'] else po['Image'][0]['fulltext'].replace('File:', ''),
        'speed': getPrintoutValue(po['Weapon attack speed']) or 0,
        'category': getPrintoutValue(po['Combat style']) or '',
        'bonuses': {
            'str': getPrintoutValue(po['Strength bonus']),
            'ranged_str': getPrintoutValue(po['Ranged Strength bonus']),
            'magic_str': getMagicDamageValue(po['Magic Damage bonus']),
            'prayer': getPrintoutValue(po['Prayer bonus']),
        },
        'offensive': {
            'stab': getPrintoutValue(po['Stab attack bonus']),
            'slash': getPrintoutValue(po['Slash attack bonus']),
            'crush': getPrintoutValue(po['Crush attack bonus']),
            'magic': getPrintoutValue(po['Magic attack bonus']),
            'ranged': getPrintoutValue(po['Range attack bonus']),
        },
        'defensive': {
            'stab': getPrintoutValue(po['Stab defence bonus']),
            'slash': getPrintoutValue(po['Slash defence bonus']),
            'crush': getPrintoutValue(po['Crush defence bonus']),
            'magic': getPrintoutValue(po['Magic defence bonus']),
            'ranged': getPrintoutValue(po['Range defence bonus']),
        },
        'two_handed': False
    }

    # Handle 2H weapons
    if equipment['slot'] == '2h':
        equipment['slot'] = 'weapon'
        equipment['two_handed'] = True

    # If this is an item from Nightmare Zone, it will become the main variant for all NMZ/SW/Emir's variants
    if equipment['version'] == 'Nightmare Zone':
        equipment['version'] = ''

    # Skip last man standing items
    if "(Last Man Standing)" in equipment['name']:
        continue

    if equipment['name'] in ITEMS_TO_SKIP:
        continue

    if "Keris partisan of amascut" in equipment['name'] and "Outside ToA" in k:
        continue

    # Append the current equipment item to the calc's equipment list
    data.append(equipment)

    if not equipment['image'] == '':
        required_imgs.append(equipment['image'])

# add manual equipment that isn't pulled from the wiki
# this should ONLY be used for upcoming items that are not yet released
# with open('manual_equipment.json', 'r') as f:
#     manual_data = json.load(f)
#     data = data + manual_data

# print('Total equipment: ' + str(len(data)))
# data.sort(key=lambda d: d.get('name'))

# with open(FILE_NAME, 'w') as f:
#     print('Saving to JSON at file: ' + FILE_NAME)
#     json.dump(data, f, ensure_ascii=False, indent=2)

success_img_dls = 0
failed_img_dls = 0
skipped_img_dls = 0
required_imgs = set(required_imgs)

# Get list of images already in the local equipment folder
local_equipment_folder = os.path.abspath(os.path.join(os.path.dirname(__file__), 'equipment'))
local_images = set(os.path.basename(f) for f in glob.glob(os.path.join(local_equipment_folder, '*')))

# Fetch all the images from the wiki and store them in memory if not already present locally
downloaded_images = {}
for idx, img in enumerate(required_imgs):
    if img in local_images:
        print(f"Skipping download (already exists locally): {img}")
        continue
    print(f'({idx}/{len(required_imgs)}) Fetching image: {img}')
    r = requests.get(WIKI_BASE + '/w/Special:Filepath/' + img, headers={
        'User-Agent': 'osrs-dps-calc (https://github.com/weirdgloop/osrs-dps-calc)'
    })
    if r.status_code == 200:
        downloaded_images[img] = r.content
        # Save to local equipment folder
        with open(os.path.join(local_equipment_folder, img), 'wb') as f:
            f.write(r.content)
    else:
        print('Unable to fetch image:', img)
        failed_img_dls += 1

# List images in Supabase gear_images folder
supabase_images = set()
image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.webp')
offset = 0
page_size = 1000

while True:
    supabase_list = supabase.storage.from_(SUPABASE_BUCKET).list('gear_images', {'limit': page_size, 'offset': offset})
    if not supabase_list:
        break
    # Add image filenames to the set
    for obj in supabase_list:
        if 'name' in obj and obj['name'].split('/')[-1].lower().endswith(image_extensions):
            supabase_images.add(obj['name'].split('/')[-1])
    if len(supabase_list) < page_size:
        break
    offset += page_size

# Find which images are missing in Supabase
print("First 5 local_images:", list(set(local_images))[:5])
print("First 5 supabase_images:", list(supabase_images)[:5])
print("First 5 sorted local_images:", sorted(local_images)[:5])
print("First 5 sorted supabase_images:", sorted(supabase_images)[:5])

# import pandas as pd
# # ...existing code...

# # Save supabase_images and local_images to a CSV file using pandas
# import pandas as pd
# ...existing code...

# supabase_list_sorted = sorted(list(supabase_images))
# local_list_sorted = sorted(list(local_images))
# max_len = max(len(supabase_list_sorted), len(local_list_sorted))

# # Pad the shorter list with empty strings
# supabase_list_sorted += [''] * (max_len - len(supabase_list_sorted))
# local_list_sorted += [''] * (max_len - len(local_list_sorted))

# df = pd.DataFrame({
#     'supabase_images': supabase_list_sorted,
#     'local_images': local_list_sorted
# })
# # df.to_csv('image_sets.csv', index=False)

#

# import time
missing_in_supabase = set(local_images) - supabase_images
print(missing_in_supabase)
# time.sleep(100)


# If Supabase gear_images is empty, bulk upload all local images
# if not supabase_images:
#     print("Supabase gear_images folder is empty. Bulk uploading all local images...")
#     for img in local_images:
#         storage_path = f"gear_images/{img}"
#         try:
#             with open(os.path.join(local_equipment_folder, img), 'rb') as f:
#                 content = f.read()
#             supabase.storage.from_(SUPABASE_BUCKET).upload(storage_path, content)
#             print('Bulk uploaded to Supabase:', img)
#             success_img_dls += 1
#         except Exception as upload_err:
#             print('Unable to bulk upload to Supabase:', img, upload_err)
#             failed_img_dls += 1
# else:
    # Only upload images that are missing in Supabase
import base64
import json
# ...existing code...

# Create a dict with {image_name: image_str (base64 encoded)}
image_map = {}
for img in sorted(local_images):
    img_path = os.path.join(local_equipment_folder, img)
    with open(img_path, 'rb') as f:
        img_bytes = f.read()
        img_b64 = base64.b64encode(img_bytes).decode('utf-8')
        image_map[img] = img_b64

json_path = 'gear_image_map.json'
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(image_map, f, ensure_ascii=False, indent=2)

# Upload the JSON to Supabase Storage in the data bucket
with open(json_path, 'rb') as f:
    supabase.storage.from_(SUPABASE_BUCKET).upload('gear_image_map.json', f)

print(f'Uploaded gear_image_map.json to bucket {SUPABASE_BUCKET}')