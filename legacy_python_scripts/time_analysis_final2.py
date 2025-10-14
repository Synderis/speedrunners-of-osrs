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
    
    # Add modulo 4 columns with special handling for Guardians (if needed)
    def check_output_mod4(row):
        value = row['Output (÷0.6)']
        # if row['Room'] == 'Guardians':
        #     return (value + 0) % 4  # Currently no adjustment
        return value % 4
    
    def check_diff_mod4(row):
        value = row['Output Diff']
        # if row['Room'] == 'Guardians':
        #     return (value + 0) % 4  # Currently no adjustment
        return value % 4
    
    df['Output % 4'] = df.apply(check_output_mod4, axis=1)
    df['Output Diff % 4'] = df.apply(check_diff_mod4, axis=1)
    
    return df

def analyze_divisibility_patterns(all_data):
    """Analyze modulo 4 patterns"""
    
    # Get the room order from the first raid's DataFrame
    if not all_data:
        return
    
    room_order = all_data[0]['df']['Room'].tolist()
    
    # Collect data by room
    room_output_mod4 = defaultdict(list)
    room_diff_mod4 = defaultdict(list)
    
    for raid_data in all_data:
        df = raid_data['df']
        for _, row in df.iterrows():
            room = row['Room']
            room_output_mod4[room].append(row['Output % 4'])
            room_diff_mod4[room].append(row['Output Diff % 4'])
    
    print("\n" + "="*80)
    print("MODULO 4 ANALYSIS")
    print("="*80)
    
    print("\n--- OUTPUT (÷0.6) MODULO 4 VALUES ---")
    for room in room_order:
        if room in room_output_mod4:
            values = room_output_mod4[room]
            value_counts = {i: values.count(i) for i in range(4)}
            unique_values = set(values)
            
            status = ""
            if len(unique_values) == 1:
                # All values are the same
                consistent_value = list(unique_values)[0]
                status = f" *** ALWAYS {consistent_value} ***"
            elif len(unique_values) == 2:
                status = " (Two values)"
            elif len(unique_values) == 3:
                status = " (Three values)"
            else:
                status = " (All four values)"
            
            print(f"{room:20} | 0:{value_counts[0]:2} 1:{value_counts[1]:2} 2:{value_counts[2]:2} 3:{value_counts[3]:2}{status}")
    
    # print("\n--- OUTPUT DIFF MODULO 4 VALUES ---")
    # for room in room_order:
    #     if room in room_diff_mod4:
    #         values = room_diff_mod4[room]
    #         value_counts = {i: values.count(i) for i in range(4)}
    #         unique_values = set(values)
            
    #         status = ""
    #         if len(unique_values) == 1:
    #             # All values are the same
    #             consistent_value = list(unique_values)[0]
    #             status = f" *** ALWAYS {consistent_value} ***"
    #         elif len(unique_values) == 2:
    #             status = " (Two values)"
    #         elif len(unique_values) == 3:
    #             status = " (Three values)"
    #         else:
    #             status = " (All four values)"
            
    #         print(f"{room:20} | 0:{value_counts[0]:2} 1:{value_counts[1]:2} 2:{value_counts[2]:2} 3:{value_counts[3]:2}{status}")

def process_raid_file(filename):
    """Process raid file and return DataFrames for each raid"""
    with open(filename, 'r') as f:
        content = f.read()
    
    raids = parse_raid_data(content)
    filtered_raids = [raid for raid in raids if raid.get('raid_number', 0) >= 100 and raid.get('raid_number', 0) <= 396]
    
    all_data = []  # Store all raid data for analysis
    skipped_raids = []  # Track skipped raids
    
    for i, raid in enumerate(filtered_raids):
        if 'rooms' in raid and raid['rooms']:
            times = [room['total'] for room in raid['rooms']]
            labels = [room['room'] for room in raid['rooms']]
            
            df = convert_times(times, labels)
            
            # Check specific rooms for modulo 4 condition
            rooms_to_check = ['Tekton', 'Mystics', 'Vespula', 'Guardians', 'Thieving', 'Muttadiles']
            # rooms_to_check = ['Tekton']
            skip_raid = False
            
            for room_name in rooms_to_check:
                room_rows = df[df['Room'] == room_name]
                if not room_rows.empty:
                    room_row = room_rows.iloc[0]  # Get first (and should be only) occurrence
                    if not (room_row['Output % 4'] == 0):
                        print(f"\n=== Raid {raid.get('raid_number', i+1)} SKIPPED ({room_name} not divisible by 4) ===")
                        print(f"{room_name} row: Output % 4={room_row['Output % 4']}, Output Diff % 4={room_row['Output Diff % 4']}")
                        skipped_raids.append(raid.get('raid_number', i+1))
                        skip_raid = True
                        break
            
            if skip_raid:
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
        print(f"\nSkipped raids due to erroneous entries: {skipped_raids}")
    
    print(f"Processed {len(all_data)} valid raids out of {len(filtered_raids)} total raids.")
    
    # Analyze patterns after processing all raids
    if all_data:
        analyze_divisibility_patterns(all_data)

# Process your specific file
if __name__ == "__main__":
    process_raid_file('/home/synderis/Desktop/Synteris_CmTimes.txt')