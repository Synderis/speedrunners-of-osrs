export const SUPABASE_CONFIG = {
  url: 'https://your-project-id.supabase.co',
  bucket: 'gear-data',
  gearCsvPath: 'gear.csv'
};

export const getGearDataUrl = () => {
  return `${SUPABASE_CONFIG.url}/storage/v1/object/public/${SUPABASE_CONFIG.bucket}/${SUPABASE_CONFIG.gearCsvPath}`;
};
