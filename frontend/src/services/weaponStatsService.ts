import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

export interface WeaponStat {
  id: number;
  item_id: number;
  weapon_name: string;
  weapon_type: string;
  attack_speed: number;
  attack_bonus: number;
  combat_style: string;
  attack_type: string;
  attack_style: string;
  experience: string;
  boosts: string | null;
  icon: string;
}

const createS3Client = () => {
    const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_REF;
    const region = import.meta.env.VITE_SUPABASE_REGION || 'us-east-1';
    const accessKeyId = import.meta.env.VITE_SUPABASE_ACCESS_KEY_ID;
    const secretAccessKey = import.meta.env.VITE_SUPABASE_SECRET_ACCESS_KEY;

    return new S3Client({
        forcePathStyle: true,
        region: region,
        endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/s3`,
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
        }
    });
};

export const fetchWeaponStatsFromS3 = async (): Promise<WeaponStat[]> => {
//   console.log('🚀 Starting weapon stats fetch from S3...');
  try {
    const client = createS3Client();
    const bucket = import.meta.env.VITE_SUPABASE_BUCKET || 'data';

    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: 'weapon_stats_rows.csv'
    });

    // console.log('📡 Fetching weapon stats data from S3...');
    const response = await client.send(command);

    if (response.Body) {
        const csvText = await response.Body.transformToString();
        // console.log('✅ Successfully fetched weapon stats data');
        // console.log('📄 Raw CSV length:', csvText.length, 'characters');
        // console.log('📄 First 500 characters of CSV:', csvText.substring(0, 500));
        
        const parsedStats = parseWeaponStatsCSV(csvText);
        // console.log('✅ Parsed weapon stats count:', parsedStats.length);
        // console.log('🔍 First 3 parsed entries:', parsedStats.slice(0, 3));
        
        return parsedStats;
    } else {
        throw new Error('No weapon stats data received from S3');
    }
  } catch (error) {
    console.error('❌ Error fetching weapon stats from S3:', error);

    // Try fallback public URL
    try {
        const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_REF;
        const bucket = import.meta.env.VITE_SUPABASE_BUCKET || 'data';
        const publicUrl = `https://${projectRef}.supabase.co/storage/v1/object/public/${bucket}/weapon_stats_rows.csv`;

        // console.log('🔄 Trying public URL fallback:', publicUrl);
        const response = await fetch(publicUrl);

        if (response.ok) {
            const csvText = await response.text();
            // console.log('✅ Successfully fetched weapon stats from public URL');
            // console.log('📄 Raw CSV length:', csvText.length, 'characters');
            // console.log('📄 First 500 characters of CSV:', csvText.substring(0, 500));
            
            const parsedStats = parseWeaponStatsCSV(csvText);
            console.log('✅ Parsed weapon stats count:', parsedStats.length);
            
            return parsedStats;
        } else {
            console.error('❌ Public URL response not ok:', response.status, response.statusText);
        }
    } catch (fallbackError) {
        console.error('❌ Public URL fallback also failed:', fallbackError);
    }

    // Return empty array on failure
    // console.log('⚠️ Using empty weapon stats array as fallback');
    return [];
  }
};

const parseWeaponStatsCSV = (csvText: string): WeaponStat[] => {
//   console.log('🔧 Starting CSV parsing...');
  const lines = csvText.trim().split('\n');
//   console.log('📊 Total lines in CSV:', lines.length);
  
  if (lines.length < 2) {
    console.warn('⚠️ CSV has less than 2 lines, returning empty array');
    return [];
  }
  
//   console.log('📋 CSV Header:', lines[0]);
  
  const parsedEntries = lines.slice(1).map((line, index) => {
    const values = parseCSVLine(line);
    const entry = {
      id: parseInt(values[0]) || 0,
      item_id: parseInt(values[1]) || 0,
      weapon_name: values[2] || '',
      weapon_type: values[3] || '',
      attack_speed: parseInt(values[4]) || 0,
      attack_bonus: parseInt(values[5]) || 0,
      combat_style: values[6] || '',
      attack_type: values[7] || '',
      attack_style: values[8] || '',
      experience: values[9] || '',
      boosts: values[10] === 'null' || values[10] === '' ? null : values[10],
      icon: values[11] || ''
    };
    
    // Log first few entries for debugging
    if (index < 5) {
      console.log(`📝 Entry ${index + 1}:`, entry);
    }
    
    return entry;
  }).filter(stat => {
    const isValid = stat.item_id > 0 && stat.weapon_name !== '';
    if (!isValid) {
      console.warn('⚠️ Filtered out invalid entry:', stat);
    }
    return isValid;
  });
  
//   console.log('✅ Final parsed entries count:', parsedEntries.length);
  return parsedEntries;
};

// Parse CSV line handling commas within quoted fields (same as gear service)
const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
};

export const getWeaponStatsByItemId = (weaponStats: WeaponStat[], itemId: string): WeaponStat[] => {
  const numericItemId = parseInt(itemId);
//   console.log(`🔍 Searching for weapon stats with item_id: ${numericItemId} (from string: "${itemId}")`);
  
  const matchingStats = weaponStats.filter(stat => stat.item_id === numericItemId);
//   console.log(`📊 Found ${matchingStats.length} matching weapon stats:`, matchingStats);
  
  if (matchingStats.length === 0) {
    console.log('🔍 Available item_ids in cache (first 20):', 
      weaponStats.slice(0, 20).map(ws => ws.item_id)
    );
  }
  
  return matchingStats;
};
