import numpy as np
import pandas as pd
import re
from collections import defaultdict

def time_to_seconds(time_str):
    """Convert time string (MM:SS or MM:SS.S) to seconds"""
    parts = time_str.split(':')
    minutes = int(parts[0])
    seconds = float(parts[1])
    return minutes * 60 + seconds

def parse_raid_data(text_content):
    """Parse raid data from text content and return list of raids"""
    raids = []
    current_raid = {}
    
    lines = text_content.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        
        # Start of new raid
        if "Your completed Chambers of Xeric Challenge Mode count is:" in line:
            if current_raid:  # Save previous raid if exists
                raids.append(current_raid)
            current_raid = {'rooms': []}
            raid_count = re.search(r'count is: (\d+)', line)
            if raid_count:
                current_raid['raid_number'] = int(raid_count.group(1))
        
        # Room completions
        elif "complete!" in line and ("Duration:" in line or "Total:" in line):
            duration_match = re.search(r'Duration: (\d+:\d+\.?\d*)', line)
            total_match = re.search(r'Total: (\d+:\d+\.?\d*)', line)
            
            room_name = None
            if "`" in line:
                room_match = re.search(r'`([^`]+)`', line)
                if room_match:
                    room_name = room_match.group(1)
            elif "level complete!" in line:
                if "Upper" in line:
                    room_name = "Floor 1 Complete"
                elif "Middle" in line:
                    room_name = "Floor 2 Complete"
                elif "Lower" in line:
                    room_name = "Floor 3 Complete"
            
            if room_name and total_match:
                current_raid['rooms'].append({
                    'room': room_name,
                    'duration': duration_match.group(1) if duration_match else None,
                    'total': total_match.group(1)
                })
        
        # Special cases
        elif "Ice Demon pop duration:" in line:
            total_match = re.search(r'Total: (\d+:\d+\.?\d*)', line)
            duration_match = re.search(r'duration: (\d+:\d+\.?\d*)', line)
            if total_match:
                current_raid['rooms'].append({
                    'room': 'Ice Demon Pop',
                    'duration': duration_match.group(1) if duration_match else None,
                    'total': total_match.group(1)
                })
        
        elif "Olm phase" in line and "duration:" in line:
            phase_match = re.search(r'Olm phase (\d+) duration: (\d+:\d+\.?\d*)', line)
            total_match = re.search(r'Total: (\d+:\d+\.?\d*)', line)
            if phase_match:
                phase_num = phase_match.group(1)
                duration = phase_match.group(2)
                total = total_match.group(1) if total_match else None
                current_raid['rooms'].append({
                    'room': f'Olm Phase {phase_num}',
                    'duration': duration,
                    'total': total
                })
        
        elif "raid is complete!" in line:
            # Extract final completion time
            duration_match = re.search(r'Duration: (\d+:\d+\.?\d*)', line)
            if duration_match:
                current_raid['raid_complete_time'] = duration_match.group(1)
    
    # Add the last raid
    if current_raid:
        raids.append(current_raid)
    
    return raids

def convert_times(time_list, labels_list):
    """Convert list of time strings and create DataFrame with labels"""
    data = []
    
    for i, time_str in enumerate(time_list):
        seconds = time_to_seconds(time_str)
        converted = seconds / 0.6
        data.append({
            'Room': labels_list[i] if i < len(labels_list) else '',
            'Input Time': time_str,
            'Seconds': seconds,
            'Output (÷0.6)': converted
        })
    
    df = pd.DataFrame(data)
    
    # Add difference columns (current row - previous row)
    df['Seconds Diff'] = df['Seconds'].diff()
    df['Output Diff'] = df['Output (÷0.6)'].diff()
    
    # Set the first row differences to be calculated against 0
    df.loc[0, 'Seconds Diff'] = df.loc[0, 'Seconds'] - 0
    df.loc[0, 'Output Diff'] = df.loc[0, 'Output (÷0.6)'] - 0
    df['Output (÷0.6)'] = df['Output (÷0.6)'].astype(int)
    df['Output Diff'] = df['Output Diff'].astype(int)
    
    # Add divisibility by 4 columns with special handling for Shamans
    def check_output_div4(row):
        value = row['Output (÷0.6)']
        if row['Room'] == 'Guardians':
            return (value + 0) % 4 == 0
        return value % 4 == 0
    
    def check_diff_div4(row):
        value = row['Output Diff']
        if row['Room'] == 'Guardians':
            return (value + 0) % 4 == 0
        return value % 4 == 0
    
    df['Output ÷4'] = df.apply(check_output_div4, axis=1)
    df['Output Diff ÷4'] = df.apply(check_diff_div4, axis=1)
    
    return df

def analyze_divisibility_patterns(all_data):
    """Analyze which rooms consistently have True/False values"""
    
    # Get the room order from the first raid's DataFrame
    if not all_data:
        return
    
    room_order = all_data[0]['df']['Room'].tolist()
    
    # Collect data by room
    room_output_div4 = defaultdict(list)
    room_diff_div4 = defaultdict(list)
    
    for raid_data in all_data:
        df = raid_data['df']
        for _, row in df.iterrows():
            room = row['Room']
            room_output_div4[room].append(row['Output ÷4'])
            room_diff_div4[room].append(row['Output Diff ÷4'])
    
    print("\n" + "="*80)
    print("DIVISIBILITY BY 4 ANALYSIS")
    print("="*80)
    
    print("\n--- OUTPUT (÷0.6) DIVISIBILITY BY 4 ---")
    for room in room_order:  # Use room_order instead of sorted()
        if room in room_output_div4:
            values = room_output_div4[room]
            true_count = sum(values)
            false_count = len(values) - true_count
            percentage = (true_count / len(values)) * 100
            
            status = ""
            if all(values):
                status = " *** ALWAYS TRUE ***"
            elif not any(values):
                status = " *** ALWAYS FALSE ***"
            elif percentage >= 80:
                status = " (Mostly True)"
            elif percentage <= 20:
                status = " (Mostly False)"
            
            print(f"{room:20} | True: {true_count:2}, False: {false_count:2} ({percentage:5.1f}% True){status}")
    
    # print("\n--- OUTPUT DIFF DIVISIBILITY BY 4 ---")
    # for room in room_order:  # Use room_order instead of sorted()
    #     if room in room_diff_div4:
    #         values = room_diff_div4[room]
    #         true_count = sum(values)
    #         false_count = len(values) - true_count
    #         percentage = (true_count / len(values)) * 100
            
    #         status = ""
    #         if all(values):
    #             status = " *** ALWAYS TRUE ***"
    #         elif not any(values):
    #             status = " *** ALWAYS FALSE ***"
    #         elif percentage <= 20:
    #             status = " (Mostly False)"
            
    #         print(f"{room:20} | True: {true_count:2}, False: {false_count:2} ({percentage:5.1f}% True){status}")

def process_raid_file(filename):
    """Process raid file and return DataFrames for each raid"""
    with open(filename, 'r') as f:
        content = f.read()
    
    raids = parse_raid_data(content)
    filtered_raids = [raid for raid in raids if raid.get('raid_number', 0) >= 360 and raid.get('raid_number', 0) <= 396]
    
    all_data = []  # Store all raid data for analysis
    skipped_raids = []  # Track skipped raids
    
    for i, raid in enumerate(filtered_raids):
        if 'rooms' in raid and raid['rooms']:
            times = [room['total'] for room in raid['rooms']]
            labels = [room['room'] for room in raid['rooms']]
            
            df = convert_times(times, labels)
            
            # Check if first entry has both Output ÷4 and Output Diff ÷4 as True
            first_row = df.iloc[0]
            if not (first_row['Output ÷4'] and first_row['Output Diff ÷4']):
                print(f"\n=== Raid {raid.get('raid_number', i+1)} SKIPPED (First entry not divisible by 4) ===")
                print(f"First row: Output ÷4={first_row['Output ÷4']}, Output Diff ÷4={first_row['Output Diff ÷4']}")
                skipped_raids.append(raid.get('raid_number', i+1))
                continue
            
            print(f"\n=== Raid {raid.get('raid_number', i+1)} ===")
            print(df.to_string(index=False))
            
            # Store data for analysis
            all_data.append({
                'raid_number': raid.get('raid_number', i+1),
                'df': df
            })
            
            if 'raid_complete_time' in raid:
                print(f"\nFinal Completion Time: {raid['raid_complete_time']}")
        
        print("-" * 80)
    
    # Print summary of skipped raids
    if skipped_raids:
        print(f"\nSkipped raids due to erroneous first entries: {skipped_raids}")
    
    print(f"Processed {len(all_data)} valid raids out of {len(filtered_raids)} total raids.")
    
    # Analyze patterns after processing all raids
    if all_data:
        analyze_divisibility_patterns(all_data)

# Process your specific file
if __name__ == "__main__":
    process_raid_file('/home/synderis/Desktop/Synteris_CmTimes.txt')