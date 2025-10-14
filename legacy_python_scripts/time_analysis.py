import numpy as np
import pandas as pd

def time_to_seconds(time_str):
    """Convert time string (MM:SS or MM:SS.S) to seconds"""
    parts = time_str.split(':')
    minutes = int(parts[0])
    seconds = float(parts[1])
    return minutes * 60 + seconds

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
    
    # Add divisibility by 4 columns
    df['Output ÷4'] = df['Output (÷0.6)'] % 4 == 0
    df['Output Diff ÷4'] = df['Output Diff'] % 4 == 0
    
    return df

# Example usage:
times = [
    "1:07.2",
    "2:01.8",
    "3:56.4",
    "4:23.4",
    "5:16.8",
    "5:38.4",
    "7:28.8",
    "8:48.0",
    "9:45.6",
    "10:25.2",
    "10:36.0",
    "12:26.4", 
    "13:23.4",
    "15:15.0",
    "16:14.4",
    "16:38.4",
    "18:55.8",
    "20:54.6",
    "22:54.6",
    "24:04.2"
]
labels = [
    "Tekton",
    "Crabs",
    "Ice Demon Pop",
    "Ice Demon",
    "Shamans",
    "Floor 1 Complete",
    "Vangs",
    "Thieving",
    "Vespula",
    "Tightrope",
    "Floor 2 Complete",
    "Guardians",
    "Vasa",
    "Mystics",
    "Muttadiles",
    "Floor 3 Complete",
    "Olm Phase 1",
    "Olm Phase 2",
    "Olm Phase 3",
    "Raid Complete"
]

df = convert_times(times, labels)
print(df)

# If you want to save to CSV:
# df.to_csv('converted_times.csv', index=False)