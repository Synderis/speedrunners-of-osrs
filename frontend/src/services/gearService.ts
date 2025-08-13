import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { GearItem } from '../types/gear';

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

export const fetchGearFromSupabase = async (): Promise<GearItem[]> => {
    try {
        const client = createS3Client();
        const bucket = import.meta.env.VITE_SUPABASE_BUCKET || 'data';

        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: 'gear.csv'
        });

        console.log('Fetching gear data from S3...');
        const response = await client.send(command);

        if (response.Body) {
            const csvText = await response.Body.transformToString();
            console.log('Successfully fetched gear data');
            return parseGearCSV(csvText);
        } else {
            throw new Error('No data received from S3');
        }
    } catch (error) {
        console.error('Error fetching gear data from S3:', error);

        // Try fallback public URL
        try {
            const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_REF;
            const bucket = import.meta.env.VITE_SUPABASE_BUCKET || 'data';
            const publicUrl = `https://${projectRef}.supabase.co/storage/v1/object/public/${bucket}/gear.csv`;

            console.log('Trying public URL fallback:', publicUrl);
            const response = await fetch(publicUrl);

            if (response.ok) {
                const csvText = await response.text();
                console.log('Successfully fetched from public URL');
                return parseGearCSV(csvText);
            }
        } catch (fallbackError) {
            console.error('Public URL fallback also failed:', fallbackError);
        }

        // Return fallback data
        console.log('Using fallback gear data');
        return getFallbackGearData();
    }
};

const getFallbackGearData = (): GearItem[] => {
    // Provide some basic fallback gear data
    return [
        {
            id: '1',
            name: 'Iron Sword',
            image: '',
            slot: 'weapon',
            stats: {
                attack_stab: 5,
                attack_slash: 5,
                attack_crush: 0,
                attack_magic: 0,
                attack_ranged: 0,
                defence_stab: 0,
                defence_slash: 0,
                defence_crush: 0,
                defence_magic: 0,
                defence_ranged: 0,
                melee_strength: 5,
                ranged_strength: 0,
                magic_damage: 0,
                prayer: 0,
            }
        },
        {
            id: '2',
            name: 'Iron Shield',
            image: '',
            slot: 'shield',
            stats: {
                attack_stab: 0,
                attack_slash: 0,
                attack_crush: 0,
                attack_magic: 0,
                attack_ranged: 0,
                defence_stab: 5,
                defence_slash: 5,
                defence_crush: 5,
                defence_magic: 0,
                defence_ranged: 0,
                melee_strength: 0,
                ranged_strength: 0,
                magic_damage: 0,
                prayer: 0,
            }
        },
        // Add more fallback items as needed
    ];
};

const parseGearCSV = (csvText: string): GearItem[] => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const item: any = {};

        headers.forEach((header, index) => {
            item[header] = values[index] || '';
        });

        // Convert base64 icon to data URL
        const iconData = item.icon ? `data:image/png;base64,${item.icon}` : '';

        // Map CSV fields to GearItem structure
        return {
            id: item.item_id,
            name: item.item_name,
            image: iconData,
            slot: item.slot,
            stats: {
                attack_stab: parseInt(item.attack_stab) || 0,
                attack_slash: parseInt(item.attack_slash) || 0,
                attack_crush: parseInt(item.attack_crush) || 0,
                attack_magic: parseInt(item.attack_magic) || 0,
                attack_ranged: parseInt(item.attack_ranged) || 0,
                defence_stab: parseInt(item.defence_stab) || 0,
                defence_slash: parseInt(item.defence_slash) || 0,
                defence_crush: parseInt(item.defence_crush) || 0,
                defence_magic: parseInt(item.defence_magic) || 0,
                defence_ranged: parseInt(item.defence_ranged) || 0,
                melee_strength: parseInt(item.melee_strength) || 0,
                ranged_strength: parseInt(item.ranged_strength) || 0,
                magic_damage: parseInt(item.magic_damage) || 0,
                prayer: parseInt(item.prayer) || 0,
            }
        } as GearItem;
    }).filter(item => item.slot && item.name); // Filter out invalid items
};

// Parse CSV line handling commas within quoted fields
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

export const groupGearBySlot = (gearItems: GearItem[]) => {
    return gearItems.reduce((acc, item) => {
        if (!acc[item.slot]) {
            acc[item.slot] = [];
        }
        acc[item.slot].push(item);
        return acc;
    }, {} as Record<string, GearItem[]>);
};
